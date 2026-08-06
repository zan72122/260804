/* =========================================================
   shadow.js — 会場の 落ち影（シャドウマップ）
   深度は RGBA に 詰めるので 拡張機能に たよらない。
   会場が 暗転したら パスごと 止まるので、いちばん 重い
   フィナーレでは まったく 走らない。
   ========================================================= */
(function (global) {
  'use strict';

  var S = { enabled: true, size: 1024, ready: false, lightVP: null, tex: null };
  var gl = null, fbo = null, rb = null, prog = null;
  var prevViewport = [0, 0, 1, 1];

  /* 深度を RGBA に 詰める／もどす */
  var PACK = [
    'vec4 packDepth(float d){',
    '  vec4 bs = vec4(1.0, 255.0, 65025.0, 16581375.0);',
    '  vec4 r = fract(d * bs);',
    '  r -= r.gbaa * vec4(1.0/255.0, 1.0/255.0, 1.0/255.0, 0.0);',
    '  return r;',
    '}'
  ].join('\n');

  S.UNPACK = [
    'float unpackDepth(vec4 c){',
    '  return dot(c, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0));',
    '}'
  ].join('\n');

  var DEPTH_VS = [
    'attribute vec3 aPos;',
    'uniform mat4 uVP, uModel;',
    'varying float vZ;',
    'void main(){',
    '  vec4 p = uVP * uModel * vec4(aPos,1.0);',
    '  vZ = p.z / p.w * 0.5 + 0.5;',
    '  gl_Position = p;',
    '}'
  ].join('\n');

  var DEPTH_FS = [
    'precision highp float;',
    'varying float vZ;',
    PACK,
    'void main(){ gl_FragColor = packDepth(clamp(vZ, 0.0, 1.0)); }'
  ].join('\n');

  S.init = function (glc) {
    gl = glc;
    prog = GLC.program(gl, DEPTH_VS, DEPTH_FS);
    if (!prog) { S.enabled = false; return false; }
    if (!alloc(S.size)) { S.enabled = false; return false; }
    S.ready = true;
    return true;
  };

  function alloc(size) {
    if (fbo) { gl.deleteFramebuffer(fbo); gl.deleteTexture(S.tex); gl.deleteRenderbuffer(rb); }
    S.size = size;
    S.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, S.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);

    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, S.tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok;
  }

  S.setSize = function (size) {
    if (!S.ready || size === S.size) return;
    if (!alloc(size)) S.enabled = false;
  };

  /* 会場照明の 向き（OBJ シェーダの L と そろえる） */
  var LIGHT = [0.25, 1.0, 0.12];
  var EXTENT = 200;        // 覆う 範囲（半径）
  var DEPTH = 320;

  function buildLightVP(centerY) {
    var L = U.V.norm(LIGHT);
    var eye = [L[0] * DEPTH * 0.55, centerY + L[1] * DEPTH * 0.55, L[2] * DEPTH * 0.55];
    var view = U.M.lookAt(eye, [0, centerY, 0], [0, 0, 1]);
    /* 正射影 */
    var e = EXTENT, n = -DEPTH, f = DEPTH;
    var proj = new Float32Array([
      1 / e, 0, 0, 0,
      0, 1 / e, 0, 0,
      0, 0, -2 / (f - n), 0,
      0, 0, -(f + n) / (f - n), 1
    ]);
    return U.M.multiply(proj, view);
  }

  /* 影を 焼く。draw(cb) の 中で Scene.drawObj を 呼ぶ。 */
  S.render = function (drawAll, centerY) {
    if (!S.enabled || !S.ready) return null;
    S.lightVP = buildLightVP(centerY === undefined ? -10 : centerY);
    prevViewport = gl.getParameter(gl.VIEWPORT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, S.size, S.size);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.useProgram(prog.p);
    gl.uniformMatrix4fv(prog.u.uVP, false, S.lightVP);
    Scene.useProgram(prog);
    drawAll();
    Scene.useProgram(null);
    GLC.disableAll(gl, prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]);
    gl.enable(gl.BLEND);
    return S.lightVP;
  };

  global.Shadow = S;
})(window);
