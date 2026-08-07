import * as THREE from 'three';

/** Gradient dome + sun disc + a few soft cumulus bands. Cheap, one draw call. */
export class Sky {
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;

  constructor(radius = 3000) {
    this.uniforms = {
      uTop: { value: new THREE.Color(0x2f79bd) },
      uHorizon: { value: new THREE.Color(0xbfe0ef) },
      uGround: { value: new THREE.Color(0x0a3450) },
      uSunDir: { value: new THREE.Vector3(0.45, 0.55, -0.7).normalize() },
      uSunColor: { value: new THREE.Color(0xfff3d8) },
      uTime: { value: 0 },
      uCloud: { value: 0.55 },
    };
    const geo = new THREE.SphereGeometry(radius, 32, 20);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * p;
          gl_Position.z = gl_Position.w; // always at the far plane
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uHorizon, uGround, uSunColor, uSunDir;
        uniform float uTime, uCloud;
        varying vec3 vDir;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float vnoise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                     mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55));
          col = mix(col, uGround, smoothstep(0.0, -0.28, h));

          // sun
          float s = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSunColor * pow(s, 900.0) * 3.0;
          col += uSunColor * pow(s, 12.0) * 0.22;

          // soft high cloud, only above the horizon
          if (h > 0.02) {
            vec2 uv = d.xz / max(h, 0.06) * 0.35;
            float n = vnoise(uv * 1.6 + uTime * 0.004);
            n = n * 0.6 + vnoise(uv * 3.7 - uTime * 0.006) * 0.4;
            float c = smoothstep(0.52, 0.82, n) * smoothstep(0.02, 0.22, h) * uCloud;
            col = mix(col, vec3(1.0, 0.99, 0.96), c * 0.75);
          }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  update(time: number, camera: THREE.Object3D) {
    this.uniforms.uTime.value = time;
    this.mesh.position.copy(camera.position);
  }

  setMood(top: number, horizon: number, sun: number) {
    (this.uniforms.uTop.value as THREE.Color).setHex(top);
    (this.uniforms.uHorizon.value as THREE.Color).setHex(horizon);
    (this.uniforms.uSunColor.value as THREE.Color).setHex(sun);
  }
}
