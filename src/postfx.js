// 画面をうっとりさせる仕上げ：にじむ光（ブルーム）＋トーンマップ＋周辺減光＋幕開けの閃光
import * as THREE from '../vendor/three.module.min.js';

const QUAD = new THREE.PlaneGeometry(2, 2);

function fsMaterial(fragment, uniforms) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    vertexShader: /* glsl */`
      in vec3 position; in vec2 uv;
      out vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      in vec2 vUv; out vec4 outColor;
      ${fragment}
    `,
    depthTest: false, depthWrite: false,
  });
}

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = true;
    this.bloomStrength = 0.85;
    this.threshold = 0.72;
    this.exposure = 1.0;
    this.flash = 0.0;
    this.vignette = 0.55;
    this.tint = new THREE.Color(0x1a1230);
    this.tintAmount = 0.12;
    this.saturation = 1.14;
    this.grain = 0.012;
    this.time = 0;

    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false };
    this.rtScene = new THREE.WebGLRenderTarget(2, 2, rtOpts);
    this.rtScene.texture.colorSpace = THREE.NoColorSpace;
    const halfOpts = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
    this.rtA = new THREE.WebGLRenderTarget(2, 2, halfOpts);
    this.rtB = new THREE.WebGLRenderTarget(2, 2, halfOpts);
    this.rtC = new THREE.WebGLRenderTarget(2, 2, halfOpts);
    this.rtD = new THREE.WebGLRenderTarget(2, 2, halfOpts);
    for (const rt of [this.rtA, this.rtB, this.rtC, this.rtD]) {
      rt.texture.colorSpace = THREE.NoColorSpace;
      rt.texture.minFilter = THREE.LinearFilter;
      rt.texture.magFilter = THREE.LinearFilter;
    }

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(QUAD, null);
    this.fsScene = new THREE.Scene();
    this.fsScene.add(this.quad);

    this.mBright = fsMaterial(/* glsl */`
      uniform sampler2D tDiffuse; uniform float uThreshold;
      void main(){
        vec3 c = texture(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float k = smoothstep(uThreshold, uThreshold + 0.55, l);
        outColor = vec4(c * k, 1.0);
      }
    `, { tDiffuse: { value: null }, uThreshold: { value: 0.72 } });

    this.mBlur = fsMaterial(/* glsl */`
      uniform sampler2D tDiffuse; uniform vec2 uDir;
      void main(){
        vec3 sum = vec3(0.0);
        sum += texture(tDiffuse, vUv - uDir * 4.0).rgb * 0.0162;
        sum += texture(tDiffuse, vUv - uDir * 3.0).rgb * 0.0540;
        sum += texture(tDiffuse, vUv - uDir * 2.0).rgb * 0.1216;
        sum += texture(tDiffuse, vUv - uDir * 1.0).rgb * 0.1946;
        sum += texture(tDiffuse, vUv).rgb                * 0.2270;
        sum += texture(tDiffuse, vUv + uDir * 1.0).rgb * 0.1946;
        sum += texture(tDiffuse, vUv + uDir * 2.0).rgb * 0.1216;
        sum += texture(tDiffuse, vUv + uDir * 3.0).rgb * 0.0540;
        sum += texture(tDiffuse, vUv + uDir * 4.0).rgb * 0.0162;
        outColor = vec4(sum, 1.0);
      }
    `, { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } });

    this.mComposite = fsMaterial(/* glsl */`
      uniform sampler2D tScene, tBloomA, tBloomB;
      uniform float uBloom, uExposure, uFlash, uVignette, uTintAmt, uSat, uGrain, uTime;
      uniform vec3 uTint, uFlashColor;

      vec3 aces(vec3 x){
        const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;
        return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
      }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

      void main(){
        vec3 col = texture(tScene, vUv).rgb;
        vec3 bl = texture(tBloomA, vUv).rgb * 0.62 + texture(tBloomB, vUv).rgb * 0.90;
        col += bl * uBloom;

        // 幕開けの一瞬だけ、白くふわっと満たす
        col += uFlashColor * uFlash;

        // 周辺減光（舞台をのぞきこむ感じ）
        vec2 q = vUv - 0.5;
        float vig = 1.0 - uVignette * dot(q, q) * 1.85;
        col *= clamp(vig, 0.0, 1.0);

        col = aces(col * uExposure);

        // 影に軽く色をのせる
        float l = dot(col, vec3(0.2126,0.7152,0.0722));
        col = mix(col, uTint, (1.0 - l) * uTintAmt);
        col = mix(vec3(l), col, uSat);

        // ほんの少しの粒子感
        float g = hash(vUv * vec2(1024.0, 768.0) + fract(uTime)) - 0.5;
        col += g * uGrain;

        col = clamp(col, 0.0, 1.0);
        outColor = vec4(pow(col, vec3(1.0/2.2)), 1.0);
      }
    `, {
      tScene: { value: null }, tBloomA: { value: null }, tBloomB: { value: null },
      uBloom: { value: 0.85 }, uExposure: { value: 1.0 }, uFlash: { value: 0.0 },
      uVignette: { value: 0.55 }, uTintAmt: { value: 0.12 }, uSat: { value: 1.14 },
      uGrain: { value: 0.012 }, uTime: { value: 0 },
      uTint: { value: new THREE.Color(0x1a1230) },
      uFlashColor: { value: new THREE.Color(0xffffff) },
    });
  }

  setSize(w, h) {
    this.rtScene.setSize(w, h);
    this.rtA.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    this.rtB.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    this.rtC.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2));
    this.rtD.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2));
    this._w = w; this._h = h;
  }

  _pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.clear(true, false, false);
    this.renderer.render(this.fsScene, this.camera);
  }

  render(scene, camera, dt) {
    this.time += dt;
    const r = this.renderer;
    if (!this.enabled) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(scene, camera);

    this.mBright.uniforms.tDiffuse.value = this.rtScene.texture;
    this.mBright.uniforms.uThreshold.value = this.threshold;
    this._pass(this.mBright, this.rtA);

    const w1 = this.rtA.width, h1 = this.rtA.height;
    this.mBlur.uniforms.tDiffuse.value = this.rtA.texture;
    this.mBlur.uniforms.uDir.value.set(1.4 / w1, 0);
    this._pass(this.mBlur, this.rtB);
    this.mBlur.uniforms.tDiffuse.value = this.rtB.texture;
    this.mBlur.uniforms.uDir.value.set(0, 1.4 / h1);
    this._pass(this.mBlur, this.rtA);

    // もう一段ぼかして、大きな光のにじみを作る
    const w2 = this.rtC.width, h2 = this.rtC.height;
    this.mBlur.uniforms.tDiffuse.value = this.rtA.texture;
    this.mBlur.uniforms.uDir.value.set(2.6 / w2, 0);
    this._pass(this.mBlur, this.rtC);
    this.mBlur.uniforms.tDiffuse.value = this.rtC.texture;
    this.mBlur.uniforms.uDir.value.set(0, 2.6 / h2);
    this._pass(this.mBlur, this.rtD);
    this.mBlur.uniforms.tDiffuse.value = this.rtD.texture;
    this.mBlur.uniforms.uDir.value.set(4.5 / w2, 0);
    this._pass(this.mBlur, this.rtC);
    this.mBlur.uniforms.tDiffuse.value = this.rtC.texture;
    this.mBlur.uniforms.uDir.value.set(0, 4.5 / h2);
    this._pass(this.mBlur, this.rtD);

    const u = this.mComposite.uniforms;
    u.tScene.value = this.rtScene.texture;
    u.tBloomA.value = this.rtA.texture;
    u.tBloomB.value = this.rtD.texture;
    u.uBloom.value = this.bloomStrength;
    u.uExposure.value = this.exposure;
    u.uFlash.value = this.flash;
    u.uVignette.value = this.vignette;
    u.uTintAmt.value = this.tintAmount;
    u.uSat.value = this.saturation;
    u.uGrain.value = this.grain;
    u.uTime.value = this.time;
    u.uTint.value.copy(this.tint);
    this._pass(this.mComposite, null);
  }
}
