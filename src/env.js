// キッチン環境: 近景（作業台）・中景（棚/オーブン/小物）・遠景（壁/窓）を分離して奥行きを作る
import * as THREE from '../vendor/three.module.js';
import { woodTexture, tileTexture, canvasTexture } from './util.js';

export function buildKitchen(scene) {
  const kitchen = new THREE.Group();
  scene.add(kitchen);

  // --- 照明 ---
  // 窓からの暖かい太陽光（キーライト・影あり）※主役を照らすキーとして強化
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.6);
  sun.position.set(0.9, 1.6, 0.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.2;
  sun.shadow.camera.far = 5;
  sun.shadow.camera.left = -0.9;
  sun.shadow.camera.right = 0.9;
  sun.shadow.camera.top = 0.9;
  sun.shadow.camera.bottom = -0.9;
  // 高解像度化に合わせてbias/normalBiasを調整（アクネと接地部の浮き=ピーターパンを抑制）
  sun.shadow.bias = -0.00012;
  sun.shadow.normalBias = 0.012;
  scene.add(sun);
  scene.add(sun.target);

  // 空からの環境光（上: 空色 / 下: 木の照り返し）
  const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x8a6a48, 0.78);
  scene.add(hemi);

  // 手元を照らすフィルライト
  const fill = new THREE.PointLight(0xffe6c8, 0.5, 3, 2);
  fill.position.set(-0.6, 0.8, 0.8);
  scene.add(fill);

  // リムライト（輪郭光）: スタンド上の主役(0,0.1,0)付近を背後上方から狙い、
  // シルエットのエッジに薄いハイライトを乗せて立体感を出す。影は持たせない（負荷/アクネ回避）。
  const rim = new THREE.SpotLight(0xdcebff, 3.2, 3.2, Math.PI * 0.32, 0.55, 1.4);
  rim.position.set(-0.15, 1.05, -0.55);
  rim.target.position.set(0, 0.12, 0);
  rim.castShadow = false;
  scene.add(rim);
  scene.add(rim.target);

  // 空気遠近: 暖色フォグで遠景を溶かす（近中遠の分離をわずかに強める）
  scene.fog = new THREE.Fog(0xefd6b8, 1.7, 5.0);
  scene.background = new THREE.Color(0xefd6b8);

  // 環境マップ（金属・クリアコートの反射用）: 窓明かりのある室内を模したグラデーション
  // 天井-床の明暗差・窓ハイライトの強さ/数を増やし「窓が映り込んでいる」と分かる高コントラスト版に
  const envTex = canvasTexture(512, (g, s) => {
    const gr = g.createLinearGradient(0, 0, 0, s);
    gr.addColorStop(0, '#fffdf6');    // 天井: 明るい暖白（より明るく）
    gr.addColorStop(0.32, '#f2e2c4'); // 上壁
    gr.addColorStop(0.5, '#cfa877');  // 地平（やや暗め）
    gr.addColorStop(0.52, '#8a6a52'); // 地平のクール寄りの陰
    gr.addColorStop(1, '#241408');    // 床: 濃い木の茶（コントラスト強化）
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    // 窓のハイライト（強い反射光源）を3枚・より明るく大きく、柔らかい縁でにじませる
    const windows = [
      [s * 0.18, s * 0.30, s * 0.11],
      [s * 0.62, s * 0.32, s * 0.085],
      [s * 0.80, s * 0.27, s * 0.06],
    ];
    for (const [wx, wy, wr] of windows) {
      const wg = g.createRadialGradient(wx, wy, 0, wx, wy, wr);
      wg.addColorStop(0, 'rgba(255,255,255,1)');
      wg.addColorStop(0.55, 'rgba(238,248,255,0.9)');
      wg.addColorStop(1, 'rgba(238,248,255,0)');
      g.fillStyle = wg;
      g.beginPath(); g.arc(wx, wy, wr, 0, Math.PI * 2); g.fill();
    }
    // 反対側にわずかにクールな空の映り込みを足し、暖色→クール差を演出
    const cg = g.createRadialGradient(s * 0.9, s * 0.18, 0, s * 0.9, s * 0.18, s * 0.16);
    cg.addColorStop(0, 'rgba(200,225,255,0.55)');
    cg.addColorStop(1, 'rgba(200,225,255,0)');
    g.fillStyle = cg;
    g.beginPath(); g.arc(s * 0.9, s * 0.18, s * 0.16, 0, Math.PI * 2); g.fill();
  }, { srgb: true });
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = envTex;

  // --- 近景: 作業台 ---
  const counterTex = woodTexture();
  const counterMat = new THREE.MeshStandardMaterial({ map: counterTex, roughness: 0.75, metalness: 0.02 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 1.1), counterMat);
  counter.position.set(0, -0.03, 0);
  counter.receiveShadow = true;
  kitchen.add(counter);
  // 台の脚まわり（前板）
  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.85, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xa77c52, roughness: 0.85 })
  );
  apron.position.set(0, -0.49, -0.1);
  kitchen.add(apron);

  // 大理石の作業スラブ（中央・ケーキを置く場所の下）
  const marbleTex = canvasTexture(256, (g, s) => {
    g.fillStyle = '#f2eee8'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 22; i++) {
      g.strokeStyle = `rgba(150,150,160,${0.08 + Math.random() * 0.12})`;
      g.lineWidth = 0.5 + Math.random() * 1.5;
      g.beginPath();
      let x = Math.random() * s, y = Math.random() * s;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 90; y += (Math.random() - 0.5) * 90; g.lineTo(x, y); }
      g.stroke();
    }
  });
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.018, 0.5),
    new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.35, metalness: 0.0 })
  );
  slab.position.set(0, 0.009, 0.02);
  slab.receiveShadow = true;
  kitchen.add(slab);

  // 接触影ブロブ（主役=スタンド直下に柔らかい放射グラデの暗部を追加し、シャドウマップと併用して接地感を強化）
  const blobShadowTex = canvasTexture(128, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(18,12,8,0.5)');
    grd.addColorStop(0.5, 'rgba(18,12,8,0.28)');
    grd.addColorStop(0.8, 'rgba(18,12,8,0.1)');
    grd.addColorStop(1, 'rgba(18,12,8,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
  }, { srgb: false });
  const blobShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.4),
    new THREE.MeshBasicMaterial({ map: blobShadowTex, transparent: true, depthWrite: false, toneMapped: false })
  );
  blobShadow.rotation.x = -Math.PI / 2;
  blobShadow.position.set(0, 0.0192, 0.02);
  blobShadow.renderOrder = 1;
  kitchen.add(blobShadow);

  // --- 遠景: 床・壁・窓 ---
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ map: woodTexture('#caa273', '#9c7245', false), roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.92;
  kitchen.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.6 });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.4), wallMat);
  backWall.position.set(0, 0.7, -2.6);
  kitchen.add(backWall);
  const sideWallL = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.4), wallMat.clone());
  sideWallL.rotation.y = Math.PI / 2;
  sideWallL.position.set(-2.6, 0.7, -0.5);
  kitchen.add(sideWallL);
  const sideWallR = sideWallL.clone();
  sideWallR.rotation.y = -Math.PI / 2;
  sideWallR.position.set(2.6, 0.7, -0.5);
  kitchen.add(sideWallR);

  // 窓（外は明るい空 → 逆光気味の奥行き）
  const skyTex = canvasTexture(256, (g, s) => {
    const gr = g.createLinearGradient(0, 0, 0, s);
    gr.addColorStop(0, '#9fd3ff');
    gr.addColorStop(0.65, '#e8f4ff');
    gr.addColorStop(1, '#ffe9c9');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y, r] of [[60, 70, 22], [92, 66, 16], [180, 110, 26], [214, 104, 15]]) {
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.beginPath(); g.arc(x + 20, y + 6, r * 0.8, 0, 7); g.fill();
    }
  });
  const window1 = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15),
    new THREE.MeshBasicMaterial({ map: skyTex, fog: false })
  );
  window1.position.set(0.85, 0.95, -2.58);
  kitchen.add(window1);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xfdfdf8, roughness: 0.6 });
  const mkBar = (w, h, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.045), frameMat);
    m.position.set(0.85 + x, 0.95 + y, -2.56);
    kitchen.add(m);
  };
  mkBar(1.25, 0.07, 0, 0.61); mkBar(1.25, 0.07, 0, -0.61);
  mkBar(0.07, 1.25, 0.61, 0); mkBar(0.07, 1.25, -0.61, 0);
  mkBar(0.05, 1.2, 0, 0); mkBar(1.2, 0.05, 0, 0);
  // カーテン
  const curtain = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 1.3, 8, 1),
    new THREE.MeshStandardMaterial({ color: 0xffc9d6, roughness: 0.9, side: THREE.DoubleSide })
  );
  const cpos = curtain.geometry.attributes.position;
  for (let i = 0; i < cpos.count; i++) cpos.setZ(i, Math.sin(cpos.getX(i) * 40) * 0.02);
  curtain.geometry.computeVertexNormals();
  curtain.position.set(0.18, 0.95, -2.5);
  kitchen.add(curtain);
  const curtain2 = curtain.clone();
  curtain2.position.x = 1.52;
  kitchen.add(curtain2);

  // --- 中景: 奥のカウンターと棚・小物 ---
  const backCounter = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.9, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xead9c3, roughness: 0.8 })
  );
  backCounter.position.set(-0.6, -0.47, -2.2);
  kitchen.add(backCounter);
  const backTop = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.05, 0.6),
    new THREE.MeshStandardMaterial({ map: woodTexture('#8a6242', '#6b4828', false), roughness: 0.6 })
  );
  backTop.position.set(-0.6, -0.01, -2.2);
  kitchen.add(backTop);

  // 棚
  const shelf = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.045, 0.28),
    new THREE.MeshStandardMaterial({ map: woodTexture('#a5794e', '#7c5631', false), roughness: 0.7 })
  );
  shelf.position.set(-1.55, 0.85, -2.4);
  kitchen.add(shelf);

  // 棚の上の瓶・缶
  const jarGlass = new THREE.MeshPhysicalMaterial({ color: 0xdfeef2, roughness: 0.15, transmission: 0.6, thickness: 0.02, transparent: true });
  const jarColors = [0xffb3c1, 0xffe08a, 0xa8e6cf, 0xc3b1e1, 0xffd3a5];
  for (let i = 0; i < 5; i++) {
    const jar = new THREE.Group();
    const h = 0.14 + (i % 3) * 0.035;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 14), jarGlass);
    body.position.y = h / 2;
    const filling = new THREE.Mesh(
      new THREE.CylinderGeometry(0.043, 0.043, h * 0.7, 12),
      new THREE.MeshStandardMaterial({ color: jarColors[i], roughness: 0.8 })
    );
    filling.position.y = h * 0.37;
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.053, 0.053, 0.02, 14),
      new THREE.MeshStandardMaterial({ color: 0xb08b5e, roughness: 0.5, metalness: 0.3 })
    );
    lid.position.y = h + 0.01;
    jar.add(body, filling, lid);
    jar.position.set(-2.12 + i * 0.28, 0.873, -2.4);
    kitchen.add(jar);
  }

  // 奥カウンターの上の小物（ボウル・ケトル・まな板）
  const bowl2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 20, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0x7fb8c9, roughness: 0.35, side: THREE.DoubleSide })
  );
  bowl2.scale.y = 0.8;
  bowl2.position.set(-1.5, 0.115, -2.15);
  kitchen.add(bowl2);
  const kettle = new THREE.Group();
  const kbody = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 18, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8a15c, metalness: 0.75, roughness: 0.3 })
  );
  kbody.scale.y = 0.85;
  const kspout = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.024, 0.12, 8), kbody.material);
  kspout.position.set(0.1, 0.03, 0);
  kspout.rotation.z = -0.8;
  kettle.add(kbody, kspout);
  kettle.position.set(0.3, 0.1, -2.15);
  kitchen.add(kettle);

  // 吊り下げユテンシル
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 1.1, 8),
    new THREE.MeshStandardMaterial({ color: 0x8b8b93, metalness: 0.8, roughness: 0.35 })
  );
  rail.rotation.z = Math.PI / 2;
  rail.position.set(-1.55, 1.35, -2.42);
  kitchen.add(rail);
  const utensilMat = new THREE.MeshStandardMaterial({ color: 0xcfcfd6, metalness: 0.85, roughness: 0.3 });
  for (let i = 0; i < 3; i++) {
    const u = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), utensilMat);
    handle.position.y = -0.1;
    const head = new THREE.Mesh(
      i === 0 ? new THREE.SphereGeometry(0.035, 10, 8) : i === 1 ? new THREE.BoxGeometry(0.06, 0.07, 0.01) : new THREE.TorusGeometry(0.03, 0.008, 6, 12),
      utensilMat
    );
    head.position.y = -0.23;
    u.add(handle, head);
    u.position.set(-1.85 + i * 0.3, 1.33, -2.42);
    u.rotation.z = (Math.random() - 0.5) * 0.1;
    kitchen.add(u);
  }

  // --- オーブン（中景左・演出で使用） ---
  const oven = buildOven();
  oven.group.position.set(-0.78, 0.19, -0.62);
  oven.group.rotation.y = 0.55;
  kitchen.add(oven.group);

  return { kitchen, sun, oven };
}

function buildOven() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xfff4ec, roughness: 0.4, metalness: 0.1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.4), bodyMat);
  body.castShadow = true;
  group.add(body);
  // 扉の窓
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x2a1a12 });
  const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), glowMat);
  windowPane.position.set(0, -0.015, 0.201);
  group.add(windowPane);
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.25, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xd88aa8, roughness: 0.5 })
  );
  rim.position.set(0, -0.015, 0.196);
  group.add(rim);
  const pane2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), glowMat);
  pane2.position.set(0, -0.015, 0.203);
  group.add(pane2);
  // ハンドルとつまみ
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.36, 10),
    new THREE.MeshStandardMaterial({ color: 0xc9a15f, metalness: 0.7, roughness: 0.3 })
  );
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0, 0.145, 0.225);
  group.add(handle);
  for (let i = 0; i < 3; i++) {
    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10),
      new THREE.MeshStandardMaterial({ color: 0xe0637c, roughness: 0.5 })
    );
    knob.rotation.x = Math.PI / 2;
    knob.position.set(-0.12 + i * 0.12, -0.155, 0.205);
    group.add(knob);
  }
  // 脚
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.06, 8), bodyMat);
    leg.position.set(sx * 0.19, -0.22, sz * 0.16);
    group.add(leg);
  }
  // 内部照明（焼き上げ時に点灯）
  const innerLight = new THREE.PointLight(0xff8c3a, 0, 1.2, 2);
  innerLight.position.set(0, 0, 0.15);
  group.add(innerLight);

  return {
    group,
    setGlow(v) {
      innerLight.intensity = v * 2.2;
      glowMat.color.setHSL(0.07, 0.9, 0.05 + v * 0.35);
      pane2.material = glowMat;
    },
  };
}
