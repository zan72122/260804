/**
 * world.js — 高炉と鋳床（キャストハウス）のジオラマ。
 * 「工場っぽい何か」ではなく“高炉”に見える輪郭（炉底・朝顔・炉腹・シャフト・
 * 送風環管・羽口）を最小限のポリゴンで作る。
 */
import * as THREE from 'three';
import { sweepStrip, sweepClosed, roundedBox } from './geom.js';

/** 出銑口（すべての座標の基準点） */
export const TAPHOLE = new THREE.Vector3(0, 2.2, 1.15);
export const DRILL_PIVOT = new THREE.Vector3(-5.7, 0, 3.15);
export const MUDGUN_PIVOT = new THREE.Vector3(6.1, 0, 3.55);

/** 樋（ランナー）の中心線 */
export function troughCurve() {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.00, 1.06, 1.60),
    new THREE.Vector3(0.06, 1.00, 2.80),
    new THREE.Vector3(0.40, 0.92, 4.10),
    new THREE.Vector3(0.92, 0.83, 5.60),
    new THREE.Vector3(1.34, 0.75, 7.00),
    new THREE.Vector3(1.62, 0.69, 8.05),
  ], false, 'catmullrom', 0.4);
}

export function buildWorld(scene, M, quality) {
  const LOW = quality === 'low';
  const root = new THREE.Group();
  scene.add(root);
  const api = { root };

  /* ---------------- 背景ドーム（黒すぎない・赤が映える）---------------- */
  {
    const g = new THREE.SphereGeometry(90, 18, 12);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new THREE.Color(0x2a3648) }, uMid: { value: new THREE.Color(0x494349) }, uBot: { value: new THREE.Color(0x6b3d1f) } },
      vertexShader: `varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uTop,uMid,uBot; varying float vY;
        void main(){ float t=clamp(vY*0.5+0.5,0.,1.);
          vec3 c = t<0.5 ? mix(uBot,uMid,t*2.0) : mix(uMid,uTop,(t-0.5)*2.0);
          gl_FragColor=vec4(c,1.0); }`,
    });
    root.add(new THREE.Mesh(g, m));
  }

  /* ---------------- 鋳床の床 ---------------- */
  {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), M.floor([16, 16]));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);
    api.floor = floor;
  }

  /* ---------------- 高炉本体 ---------------- */
  const FZ = -4.2;                                    // 炉心の z
  const furnace = new THREE.Group();
  furnace.position.set(0, 0, FZ);
  root.add(furnace);
  api.furnace = furnace;

  const shell = M.metal(0x4b4a49, { metalness: 0.55, roughness: 0.72, repeat: [4, 4] });
  const shellDark = M.metal(0x3a3735, { metalness: 0.5, roughness: 0.8, repeat: [4, 4] });
  const refWall = M.refractory([3, 2]);

  const seg = LOW ? 18 : 30;
  const addPart = (geo, mat, y, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y; m.castShadow = cast; m.receiveShadow = true;
    furnace.add(m); return m;
  };
  // 炉底（ハース）— ここに出銑口がある
  addPart(new THREE.CylinderGeometry(4.60, 4.75, 3.6, seg, 1, true), refWall, 1.80);
  // 朝顔（ボッシュ）
  addPart(new THREE.CylinderGeometry(5.25, 4.60, 1.5, seg, 1, true), shell, 4.35);
  // 炉腹
  addPart(new THREE.CylinderGeometry(5.25, 5.25, 1.2, seg, 1, true), shell, 5.70);
  // シャフト
  addPart(new THREE.CylinderGeometry(3.05, 5.25, 3.6, seg, 1, true), shell, 8.10);
  // 炉喉
  addPart(new THREE.CylinderGeometry(2.85, 3.05, 0.9, seg, 1, true), shellDark, 10.35);
  // 炉頂
  addPart(new THREE.CylinderGeometry(1.05, 2.85, 1.2, seg, 1, true), shell, 11.40);
  addPart(new THREE.CylinderGeometry(0.6, 0.6, 2.2, 12, 1, true), shellDark, 13.1);

  // 補強フープ
  for (const [y, r] of [[0.55, 4.76], [3.2, 4.66], [5.7, 5.30], [7.0, 4.75], [9.2, 3.55], [10.3, 2.92]]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, LOW ? 16 : 26), shellDark);
    t.rotation.x = Math.PI / 2; t.position.y = y; t.castShadow = false; furnace.add(t);
  }
  // 送風環管（バッスルパイプ）— 高炉らしさの決め手
  {
    const bp = new THREE.Mesh(new THREE.TorusGeometry(6.05, 0.55, 8, LOW ? 18 : 30), M.metal(0x5f6d78, { metalness: 0.65, roughness: 0.55, repeat: [8, 2] }));
    bp.rotation.x = Math.PI / 2; bp.position.y = 4.85; bp.castShadow = true;
    furnace.add(bp);
    // 羽口（ブローパイプ）を放射状に
    const stub = new THREE.CylinderGeometry(0.26, 0.18, 1.7, 8);
    const stubMat = M.metal(0x9fa6ab, { metalness: 0.85, roughness: 0.4, repeat: [1, 1] });
    const N = LOW ? 8 : 12;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.26;
      const s = new THREE.Mesh(stub, stubMat);
      s.position.set(Math.sin(a) * 5.25, 4.05, Math.cos(a) * 5.25);
      s.lookAt(0, 4.85, 0); s.rotateX(Math.PI / 2);
      s.castShadow = true;
      furnace.add(s);
    }
  }

  /* ---------------- 出銑口まわり（主役） ---------------- */
  const tapArea = new THREE.Group();
  tapArea.position.copy(TAPHOLE);
  root.add(tapArea);
  api.tapArea = tapArea;

  // 出銑口を抱える耐火ブロック（前面 z = TAPHOLE.z）
  const bossMat = M.refractory([1.2, 1.2], 0xd8d2cc);
  const boss = new THREE.Mesh(roundedBox(2.1, 2.0, 1.5, 0.12), bossMat);
  boss.position.set(0, 0, -0.75);
  boss.castShadow = true; boss.receiveShadow = true;
  tapArea.add(boss);
  api.boss = boss;
  api.bossMat = bossMat;

  // ブロックのまわりの押さえ枠（鋼）
  {
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.075, 6, LOW ? 14 : 22), M.metal(0x8b9096, { metalness: 0.9, roughness: 0.38, repeat: [4, 1] }));
    frame.position.set(0, 0, 0.012); frame.castShadow = false;
    tapArea.add(frame);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + 0.5;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 6), M.metal(0xb2b6ba, { metalness: 0.95, roughness: 0.3, repeat: [1, 1] }));
      b.position.set(Math.cos(a) * 0.80, Math.sin(a) * 0.80, 0.05);
      b.rotation.x = Math.PI / 2;
      tapArea.add(b);
    }
  }

  // 出銑孔（内部）— 見えない因果を見せるための穴
  const BORE_R = 0.225, BORE_LEN = 1.50;
  const boreMat = new THREE.MeshStandardMaterial({
    color: 0x150e0a, roughness: 0.95, metalness: 0.0,
    emissive: new THREE.Color(0xff5a08), emissiveIntensity: 0.0,
    side: THREE.BackSide,
  });
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(BORE_R, BORE_R * 0.86, BORE_LEN, LOW ? 12 : 18, 1, true), boreMat);
  bore.rotation.x = Math.PI / 2;
  bore.position.set(0, 0, -BORE_LEN / 2 + 0.02);
  tapArea.add(bore);
  api.bore = bore; api.boreMat = boreMat; api.BORE_R = BORE_R; api.BORE_LEN = BORE_LEN;

  // 断面表示のときだけ光る“通り道”のガイド（子どもに孔の存在を示す）
  const ghostMat = new THREE.MeshBasicMaterial({
    color: 0x7fc9ff, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  });
  const boreGhost = new THREE.Mesh(new THREE.CylinderGeometry(BORE_R * 1.22, BORE_R * 1.12, BORE_LEN, 16, 1, true), ghostMat);
  boreGhost.rotation.x = Math.PI / 2;
  boreGhost.position.set(0, 0, -BORE_LEN / 2 + 0.02);
  boreGhost.renderOrder = 13;
  tapArea.add(boreGhost);

  // 孔の奥の“炉の中”（開いたときに赤く見える）
  const innerGlowMat = new THREE.MeshBasicMaterial({ color: 0xff6a10, toneMapped: false, transparent: true, opacity: 0 });
  const innerGlow = new THREE.Mesh(new THREE.CircleGeometry(BORE_R * 0.9, 16), innerGlowMat);
  innerGlow.position.set(0, 0, -BORE_LEN + 0.06);
  tapArea.add(innerGlow);
  api.innerGlow = innerGlow; api.innerGlowMat = innerGlowMat;

  // 閉塞材の栓（前回のマッド）— ドリルで削られ、マッドガンで詰め直される
  const plugMat = M.clay([1.2, 1.2]);
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(BORE_R * 0.97, BORE_R * 0.97, 1, LOW ? 12 : 18), plugMat);
  plug.rotation.x = Math.PI / 2;
  tapArea.add(plug);
  api.plug = plug; api.plugMat = plugMat;
  // 前面にはみ出した粘土の“だんご”
  const plugCap = new THREE.Mesh(new THREE.SphereGeometry(0.30, 12, 9), plugMat);
  plugCap.scale.set(1, 1, 0.55);
  tapArea.add(plugCap);
  api.plugCap = plugCap;

  /**
   * 栓の見た目を更新。
   * fill: 1 = 孔いっぱいに詰まっている / 0 = 空
   * mode 'back'  … ドリルが手前から削っていく（残りは奥にある）
   * mode 'front' … マッドガンが手前から詰めていく（先端が奥へ進む）
   */
  api.setPlug = (fill, mode = 'back') => {
    const f = THREE.MathUtils.clamp(fill, 0, 1);
    plug.visible = f > 0.012;
    plugCap.visible = f > 0.96;
    const len = Math.max(0.001, BORE_LEN * f);
    plug.scale.set(1, len, 1);
    plug.position.set(0, 0, mode === 'front' ? -len / 2 + 0.02 : -BORE_LEN + len / 2 + 0.02);
    plugCap.position.set(0, 0, 0.06);
    plugCap.scale.set(1, 1, 0.55 * THREE.MathUtils.clamp((f - 0.96) / 0.04, 0, 1));
  };
  api.setPlug(1);

  // 断面表示のときだけ内部を照らす小さな灯り（閉塞材の質感を見せるため）
  const cutLight = new THREE.PointLight(0xffd9b4, 0, 5.0, 2);
  cutLight.position.set(-1.0, TAPHOLE.y + 0.5, TAPHOLE.z + 0.7);
  scene.add(cutLight);
  api.cutLight = cutLight;

  /** 断面表示（局所カッタウェイ）：耐火ブロックを透かして内部の因果を見せる */
  const bossOpaque = { transparent: false, opacity: 1 };
  api.setCutaway = (v) => {
    const k = THREE.MathUtils.clamp(v, 0, 1);
    if (k < 0.01) {
      bossMat.transparent = false; bossMat.opacity = 1; bossMat.depthWrite = true;
      boss.renderOrder = 0;
      bossMat.emissive.setRGB(0, 0, 0);
      ghostMat.opacity = 0;
      cutLight.intensity = 0;
    } else {
      bossMat.transparent = true;
      bossMat.opacity = THREE.MathUtils.lerp(1, 0.24, k);
      bossMat.depthWrite = false;
      boss.renderOrder = 12;
      bossMat.emissive.setRGB(0.05 * k, 0.08 * k, 0.13 * k);
      ghostMat.opacity = 0.16 * k;
      cutLight.intensity = 9 * k;
    }
    bossMat.needsUpdate = true;
  };

  /* ---------------- 樋（U字の耐火チャネル） ---------------- */
  const curve = troughCurve();
  api.curve = curve;
  {
    const outer = [
      { x: -0.70, y: -0.42 }, { x: 0.70, y: -0.42 }, { x: 0.70, y: 0.34 },
      { x: 0.40, y: 0.34 }, { x: 0.36, y: -0.10 }, { x: -0.36, y: -0.10 },
      { x: -0.40, y: 0.34 }, { x: -0.70, y: 0.34 },
    ];
    const g = sweepClosed(curve, outer, LOW ? 26 : 48, { uvRepeatV: 7 });
    const m = M.refractory([1.2, 6], 0xd6c6ac);
    const trough = new THREE.Mesh(g, m);
    trough.castShadow = true; trough.receiveShadow = true;
    root.add(trough);
    api.trough = trough;

    // 支持台
    for (let i = 0.12; i < 1.0; i += 0.22) {
      const p = curve.getPointAt(i);
      const h = p.y - 0.42;
      const pier = new THREE.Mesh(roundedBox(1.5, h, 0.62, 0.06), M.metal(0x55524f, { metalness: 0.4, roughness: 0.8, repeat: [2, 2] }));
      pier.position.set(p.x, h / 2, p.z);
      pier.castShadow = true; pier.receiveShadow = true;
      root.add(pier);
    }
  }

  /* ---------------- 取鍋（たまっていくのが見える） ---------------- */
  {
    const lad = new THREE.Group();
    const p = curve.getPointAt(1);
    lad.position.set(p.x + 0.35, 0, p.z + 1.55);
    root.add(lad);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.25, 2.3, LOW ? 14 : 22, 1, true), M.metal(0x6d5a4c, { metalness: 0.55, roughness: 0.7, repeat: [4, 2] }));
    body.position.y = 1.3; body.castShadow = true; body.receiveShadow = true;
    lad.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 6, LOW ? 14 : 22), M.metal(0x8a8b8d, { metalness: 0.9, roughness: 0.4, repeat: [4, 1] }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 2.45; lad.add(rim);
    const base = new THREE.Mesh(roundedBox(2.6, 0.42, 2.2, 0.08), M.metal(0x44413f, { metalness: 0.5, roughness: 0.75, repeat: [2, 2] }));
    base.position.y = 0.24; base.castShadow = true; lad.add(base);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.2, 10), M.metal(0x2e2c2b, { metalness: 0.6, roughness: 0.7, repeat: [1, 1] }));
      w.rotation.z = Math.PI / 2; w.position.set(sx * 1.05, 0.26, sz * 0.8); lad.add(w);
    }
    // 中の溶銑（レベルが上がる）
    const fillMat = new THREE.MeshBasicMaterial({ color: 0xff8a1e, toneMapped: false, transparent: true, opacity: 0.98 });
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1.42, LOW ? 14 : 24), fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.4; fill.visible = false;
    lad.add(fill);
    api.ladle = lad; api.ladleFill = fill; api.ladleFillMat = fillMat;
    api.setLadle = (t) => {                        // t: 0..1
      const v = THREE.MathUtils.clamp(t, 0, 1);
      fill.visible = v > 0.005;
      fill.position.y = 0.45 + v * 1.85;
      fill.scale.setScalar(THREE.MathUtils.lerp(0.82, 1.0, v));
    };
    api.setLadle(0);
  }

  /* ---------------- 安全スクリーン＋見守りロボット ---------------- */
  {
    const grp = new THREE.Group();
    grp.position.set(3.9, 0, 10.6);
    grp.rotation.y = Math.atan2(TAPHOLE.x - grp.position.x, TAPHOLE.z - grp.position.z);
    root.add(grp);

    // 防護スクリーン（安全な見守り位置）
    const postMat = M.metal(0xf2c218, { metalness: 0.35, roughness: 0.55, repeat: [1, 3] });
    for (const x of [-1.25, 1.25]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.0, 8), postMat);
      post.position.set(x, 1.0, 0); post.castShadow = true; grp.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.5, 8), postMat);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.9, 0); grp.add(bar);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.5),
      new THREE.MeshPhysicalMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.20, roughness: 0.12, metalness: 0, side: THREE.DoubleSide }));
    screen.position.set(0, 1.15, 0); grp.add(screen);

    // 整備ロボット（人のかわりに、安全な位置から見守る）
    const bot = new THREE.Group();
    bot.position.set(0.15, 0, -0.8);
    bot.rotation.y = Math.PI * 0.02;
    grp.add(bot);
    const paint = M.metal(0x2fa8e0, { metalness: 0.45, roughness: 0.42, repeat: [2, 2] });
    const paint2 = M.metal(0xffd23f, { metalness: 0.4, roughness: 0.45, repeat: [2, 2] });
    const body = new THREE.Mesh(roundedBox(0.68, 0.72, 0.52, 0.18), paint);
    body.position.y = 0.72; body.castShadow = true; bot.add(body);
    const head = new THREE.Mesh(roundedBox(0.56, 0.44, 0.46, 0.16), paint2);
    head.position.y = 1.32; head.castShadow = true; bot.add(head);
    const visor = new THREE.Mesh(roundedBox(0.42, 0.20, 0.06, 0.05), new THREE.MeshStandardMaterial({ color: 0x0a1620, roughness: 0.15, metalness: 0.3, emissive: 0x22d3ff, emissiveIntensity: 0.8 }));
    visor.position.set(0, 1.34, 0.24); bot.add(visor);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd8fbff, toneMapped: false });
    for (const x of [-0.10, 0.10]) {
      const e = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), eyeMat);
      e.position.set(x, 1.34, 0.276); bot.add(e);
    }
    const arms = [];
    for (const s of [-1, 1]) {
      const a = new THREE.Group();
      a.position.set(s * 0.40, 1.00, 0);
      const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.36, 3, 6), paint2);
      seg1.position.y = -0.22; a.add(seg1);
      bot.add(a); arms.push(a);
    }
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.5, 12), M.metal(0x2b2a29, { metalness: 0.5, roughness: 0.8, repeat: [1, 1] }));
    wheel.rotation.z = Math.PI / 2; wheel.position.y = 0.30; wheel.castShadow = true; bot.add(wheel);
    api.robot = { root: bot, arms, head, cheer: 0 };
  }

  /* ---------------- 背景の付帯設備（シルエット程度） ---------------- */
  if (!LOW) {
    const dark = M.metal(0x3a3a3d, { metalness: 0.5, roughness: 0.8, repeat: [3, 6] });
    for (let i = 0; i < 3; i++) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, 15, 14, 1, true), dark);
      st.position.set(-16 + i * 5.2, 7.5, -20 - i * 1.5);
      root.add(st);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(2.0, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
      cap.position.set(st.position.x, 15, st.position.z); root.add(cap);
    }
    // 鉄骨の柱
    for (const x of [-11, 11, -16, 16]) {
      const col = new THREE.Mesh(roundedBox(0.7, 13, 0.7, 0.05), dark);
      col.position.set(x, 6.5, -2 + Math.abs(x) * 0.2); root.add(col);
    }
    const beam = new THREE.Mesh(roundedBox(34, 0.8, 0.8, 0.05), dark);
    beam.position.set(0, 12.6, -0.5); root.add(beam);
  }

  /* ---------------- ライト ---------------- */
  const hemi = new THREE.HemisphereLight(0xa6bcdc, 0x60381f, 1.15);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff1d8, 2.05);
  key.position.set(9, 15, 12);
  key.target.position.set(0, 2.2, 2.0);
  scene.add(key.target);
  if (!LOW) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -14; key.shadow.camera.right = 14;
    key.shadow.camera.top = 16; key.shadow.camera.bottom = -6;
    key.shadow.camera.near = 4; key.shadow.camera.far = 48;
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.035;
  }
  scene.add(key);
  api.key = key;

  const rim = new THREE.DirectionalLight(0x8cbcff, 1.0);
  rim.position.set(-12, 9, -6);
  scene.add(rim);

  const front = new THREE.DirectionalLight(0xffe6c8, 0.75);
  front.position.set(-2, 6, 18);
  scene.add(front);

  const fillLight = new THREE.PointLight(0xffc190, 14, 30, 2);
  fillLight.position.set(0, 4.2, 6.0);
  scene.add(fillLight);
  api.fillLight = fillLight;

  scene.fog = new THREE.FogExp2(0x2c2422, 0.0075);

  return api;
}
