'use strict';
/* WebGL ポストプロセス: ブルーム + 色調補正 + ビネット
   シーン(2D canvas)をテクスチャとして取り込み、表示canvasへ合成する。
   WebGL が使えない環境では enabled=false のまま(2D直描画にフォールバック)。 */
const Post = (() => {
  const VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const FS_BRIGHT =
    'precision mediump float;varying vec2 uv;uniform sampler2D t;' +
    'void main(){vec3 c=texture2D(t,uv).rgb;' +
    'float l=dot(c,vec3(.299,.587,.114));' +
    'float k=smoothstep(.855,.995,l);' +
    'gl_FragColor=vec4(c*k,1.);}';
  const FS_BLUR =
    'precision mediump float;varying vec2 uv;uniform sampler2D t;uniform vec2 d;' +
    'void main(){vec3 s=texture2D(t,uv).rgb*.227;' +
    's+=(texture2D(t,uv+d*1.38).rgb+texture2D(t,uv-d*1.38).rgb)*.316;' +
    's+=(texture2D(t,uv+d*3.23).rgb+texture2D(t,uv-d*3.23).rgb)*.07;' +
    'gl_FragColor=vec4(s,1.);}';
  const FS_FINAL =
    'precision mediump float;varying vec2 uv;' +
    'uniform sampler2D scene;uniform sampler2D bloom;uniform float blm;' +
    'void main(){' +
    'vec3 c=texture2D(scene,uv).rgb+texture2D(bloom,uv).rgb*blm;' +
    'c=clamp(c*1.04-.012,0.,1.);' +                       // ソフトコントラスト
    'float g=dot(c,vec3(.299,.587,.114));' +
    'c=mix(vec3(g),c,1.14);' +                            // 彩度アップ
    'c*=vec3(1.035,1.0,.972);' +                          // 暖色トーン
    'vec2 q=uv-.5;c*=1.-.34*dot(q,q)*2.1;' +              // ビネット
    'gl_FragColor=vec4(c,1.);}';

  let gl, canvas, progs = {}, buf, sceneTex, fbo = [null, null], fboTex = [null, null];
  let sw = 0, sh = 0, bw = 0, bh = 0, div = 4;
  const P = { enabled: false, bloomStrength: 0.5 };

  function compile(fsSrc) {
    const mk = (ty, src) => {
      const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s);
      return s;
    };
    const pr = gl.createProgram();
    gl.attachShader(pr, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw gl.getProgramInfoLog(pr);
    return pr;
  }
  function mkTex(w, h) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }
  function quad(pr) {
    const loc = gl.getAttribLocation(pr, 'p');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  P.init = function (displayCanvas) {
    try {
      if (location.search.indexOf('nopost') >= 0) return false;
      canvas = displayCanvas;
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });
      if (!gl) return false;
      progs.bright = compile(FS_BRIGHT);
      progs.blur = compile(FS_BLUR);
      progs.final = compile(FS_FINAL);
      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      sceneTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      P.enabled = true;
      return true;
    } catch (e) { P.enabled = false; return false; }
  };

  P.resize = function (w, h, bloomDiv) {
    if (!P.enabled) return;
    sw = w; sh = h; div = bloomDiv || 4;
    canvas.width = w; canvas.height = h;
    bw = Math.max(8, Math.floor(w / div)); bh = Math.max(8, Math.floor(h / div));
    for (let i = 0; i < 2; i++) {
      if (fbo[i]) { gl.deleteFramebuffer(fbo[i]); gl.deleteTexture(fboTex[i]); }
      fboTex[i] = mkTex(bw, bh);
      fbo[i] = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex[i], 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  P.render = function (sceneCanvas) {
    if (!P.enabled) return;
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sceneCanvas);
    // 1) 明部抽出 → fbo0
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[0]);
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(progs.bright);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(gl.getUniformLocation(progs.bright, 't'), 0);
    quad(progs.bright);
    // 2) ぼかし H → fbo1, V → fbo0
    gl.useProgram(progs.blur);
    const dLoc = gl.getUniformLocation(progs.blur, 'd');
    const tLoc = gl.getUniformLocation(progs.blur, 't');
    gl.uniform1i(tLoc, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1]);
    gl.bindTexture(gl.TEXTURE_2D, fboTex[0]);
    gl.uniform2f(dLoc, 1 / bw, 0);
    quad(progs.blur);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[0]);
    gl.bindTexture(gl.TEXTURE_2D, fboTex[1]);
    gl.uniform2f(dLoc, 0, 1 / bh);
    quad(progs.blur);
    // 3) 合成 → 画面
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, sw, sh);
    gl.useProgram(progs.final);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(gl.getUniformLocation(progs.final, 'scene'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fboTex[0]);
    gl.uniform1i(gl.getUniformLocation(progs.final, 'bloom'), 1);
    gl.uniform1f(gl.getUniformLocation(progs.final, 'blm'), P.bloomStrength);
    quad(progs.final);
    gl.activeTexture(gl.TEXTURE0);
  };
  return P;
})();
