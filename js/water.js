// Canal water with true planar reflection (mirrored camera render target)
// plus procedural waves, fresnel, and sun glints. Adapted from the
// three.js Reflector approach (MIT).
import * as THREE from './vendor/three.module.js';

export const REFLECT_HIDE_LAYER = 7; // objects on this layer don't show in the reflection

export function makeWater({ width, length, sunDir, fog }) {
  const geometry = new THREE.PlaneGeometry(width, length, 1, 1);
  geometry.rotateX(-Math.PI / 2);

  const rtSize = 768;
  const renderTarget = new THREE.WebGLRenderTarget(rtSize, Math.round(rtSize / 2), {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  renderTarget.texture.colorSpace = THREE.SRGBColorSpace;

  const reflectorPlane = new THREE.Plane();
  const normal = new THREE.Vector3();
  const reflectorWorldPosition = new THREE.Vector3();
  const cameraWorldPosition = new THREE.Vector3();
  const rotationMatrix = new THREE.Matrix4();
  const lookAtPosition = new THREE.Vector3(0, 0, -1);
  const clipPlane = new THREE.Vector4();
  const view = new THREE.Vector3();
  const target = new THREE.Vector3();
  const q = new THREE.Vector4();
  const textureMatrix = new THREE.Matrix4();
  const virtualCamera = new THREE.PerspectiveCamera();

  const uniforms = {
    tRefl: { value: renderTarget.texture },
    textureMatrix: { value: textureMatrix },
    time: { value: 0 },
    sunDir: { value: sunDir.clone().normalize() },
    deepColor: { value: new THREE.Color(0x11374a) },
    shallowColor: { value: new THREE.Color(0x2a6a72) },
    fogColor: { value: fog.color },
    fogNear: { value: fog.near },
    fogFar: { value: fog.far },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      uniform mat4 textureMatrix;
      varying vec4 vRefl;
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vRefl = textureMatrix * wp;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tRefl;
      uniform float time;
      uniform vec3 sunDir;
      uniform vec3 deepColor;
      uniform vec3 shallowColor;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying vec4 vRefl;
      varying vec3 vWorld;

      // analytic gradient of summed directional sine waves
      vec2 waveGrad(vec2 p, float t) {
        vec2 g = vec2(0.0);
        // (dir, freq, speed, amp)
        g += normalize(vec2( 1.0, 0.35)) * 0.045 * 1.9 * cos(dot(p, normalize(vec2( 1.0, 0.35))) * 1.9 + t * 1.1);
        g += normalize(vec2(-0.6, 1.0 )) * 0.035 * 2.7 * cos(dot(p, normalize(vec2(-0.6, 1.0 ))) * 2.7 + t * 1.6);
        g += normalize(vec2( 0.2,-1.0 )) * 0.020 * 5.3 * cos(dot(p, normalize(vec2( 0.2,-1.0 ))) * 5.3 + t * 2.3);
        g += normalize(vec2(-1.0,-0.4 )) * 0.006 * 9.1 * cos(dot(p, normalize(vec2(-1.0,-0.4 ))) * 9.1 + t * 3.1);
        return g;
      }

      void main() {
        vec2 g = waveGrad(vWorld.xz, time);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 viewDir = normalize(cameraPosition - vWorld);

        // distorted planar reflection
        vec2 ruv = vRefl.xy / vRefl.w + n.xz * 0.5;
        vec3 refl = texture2D(tRefl, ruv).rgb;

        float cosT = clamp(dot(viewDir, n), 0.0, 1.0);
        float fresnel = 0.06 + 0.94 * pow(1.0 - cosT, 4.0);

        vec3 base = mix(deepColor, shallowColor, 0.35 + 0.4 * n.x);
        vec3 col = mix(base, refl, clamp(fresnel * 1.55, 0.0, 0.94));

        // sun glints
        vec3 h = normalize(viewDir + normalize(sunDir));
        float spec = pow(max(dot(n, h), 0.0), 300.0) * 0.9;
        spec += pow(max(dot(n, h), 0.0), 40.0) * 0.10;
        col += vec3(1.0, 0.92, 0.75) * spec;

        // aerial perspective fog (match scene fog)
        float dist = length(cameraPosition - vWorld);
        float f = smoothstep(fogNear, fogFar, dist);
        col = mix(col, fogColor, f);

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.matrixAutoUpdate = true;

  mesh.onBeforeRender = function (renderer, scene, camera) {
    reflectorWorldPosition.setFromMatrixPosition(mesh.matrixWorld);
    cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);

    rotationMatrix.extractRotation(mesh.matrixWorld);
    normal.set(0, 1, 0).applyMatrix4(rotationMatrix).normalize();

    view.subVectors(reflectorWorldPosition, cameraWorldPosition);
    if (view.dot(normal) > 0) return; // camera below water

    view.reflect(normal).negate();
    view.add(reflectorWorldPosition);

    rotationMatrix.extractRotation(camera.matrixWorld);
    lookAtPosition.set(0, 0, -1).applyMatrix4(rotationMatrix).add(cameraWorldPosition);

    target.subVectors(reflectorWorldPosition, lookAtPosition);
    target.reflect(normal).negate();
    target.add(reflectorWorldPosition);

    virtualCamera.position.copy(view);
    virtualCamera.up.set(0, 1, 0).applyMatrix4(rotationMatrix).reflect(normal);
    virtualCamera.lookAt(target);
    virtualCamera.far = camera.far;
    virtualCamera.updateMatrixWorld();
    virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
    virtualCamera.layers.mask = camera.layers.mask;
    virtualCamera.layers.disable(REFLECT_HIDE_LAYER);

    textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0,
    );
    textureMatrix.multiply(virtualCamera.projectionMatrix);
    textureMatrix.multiply(virtualCamera.matrixWorldInverse);

    // oblique near-plane clipping so nothing below the water leaks in
    reflectorPlane.setFromNormalAndCoplanarPoint(normal, reflectorWorldPosition);
    reflectorPlane.applyMatrix4(virtualCamera.matrixWorldInverse);
    clipPlane.set(reflectorPlane.normal.x, reflectorPlane.normal.y, reflectorPlane.normal.z, reflectorPlane.constant);
    const projectionMatrix = virtualCamera.projectionMatrix;
    q.x = (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
    q.y = (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
    q.z = -1.0;
    q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];
    clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));
    projectionMatrix.elements[2] = clipPlane.x;
    projectionMatrix.elements[6] = clipPlane.y;
    projectionMatrix.elements[10] = clipPlane.z + 1.0;
    projectionMatrix.elements[14] = clipPlane.w;

    mesh.visible = false;
    const currentRenderTarget = renderer.getRenderTarget();
    const currentXrEnabled = renderer.xr.enabled;
    const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(renderTarget);
    renderer.state.buffers.depth.setMask(true);
    if (renderer.autoClear === false) renderer.clear();
    renderer.render(scene, virtualCamera);
    renderer.xr.enabled = currentXrEnabled;
    renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
    renderer.setRenderTarget(currentRenderTarget);
    const viewport = camera.viewport;
    if (viewport !== undefined) renderer.state.viewport(viewport);
    mesh.visible = true;
  };

  mesh.update = (t) => { uniforms.time.value = t; };
  return mesh;
}
