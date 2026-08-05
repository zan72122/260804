// 工房の空間。奥行き（視差・遮蔽・空気遠近）を作るための背景と作業台。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeWoodTexture, makeSoftCircleTexture, makePatternTexture } from '../core/materials.js';
import { makeToolbox } from './tools.js';
import { rand, mulberry32 } from '../core/util.js';

const std = (color, rough = 0.8, metal = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

export class Workshop {
  constructor(scene, apron) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.benchTopY = 0;
    this._build(apron);
  }

  _build(apron) {
    const g = this.group;

    // --- 床 ---
    const floorTex = makeWoodTexture({ base: '#b07f4c', grain: '#6d4522', grainWeight: 0.9, knots: 2, seed: 9 });
    floorTex.repeat.set(6, 6);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.78;
    floor.receiveShadow = true;
    g.add(floor);

    // --- 奥の壁 ---
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 6),
      std('#e8d3ae', 0.95),
    );
    wall.position.set(0, 1.4, -3.2);
    wall.receiveShadow = true;
    g.add(wall);

    // 有孔ボード（道具の掛かった壁）
    const board = new THREE.Mesh(new RoundedBoxGeometry(2.1, 1.15, 0.05, 2, 0.02), std('#d9a86a', 0.85));
    board.position.set(-0.15, 1.05, -3.1);
    board.castShadow = true;
    board.receiveShadow = true;
    g.add(board);
    this._hangTools(board);

    // 窓（暖かい光）
    const win = new THREE.Group();
    const frame = new THREE.Mesh(new RoundedBoxGeometry(0.95, 1.15, 0.06, 2, 0.02), std('#f6f1e6', 0.6));
    win.add(frame);
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.82, 1.0),
      new THREE.MeshBasicMaterial({ color: '#fff6df', toneMapped: false }),
    );
    glass.position.z = 0.04;
    win.add(glass);
    for (const [x, y, w, h] of [[0, 0, 0.03, 1.02], [0, 0, 0.84, 0.03]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), std('#f6f1e6', 0.6));
      bar.position.set(x, y, 0.05);
      win.add(bar);
    }
    win.position.set(1.55, 1.35, -3.1);
    g.add(win);

    // 光の帯（空気の存在を見せる）
    const shaftMat = new THREE.MeshBasicMaterial({
      map: makeSoftCircleTexture('rgba(255,240,200,0.5)', 'rgba(255,240,200,0)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.5,
    });
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.0), shaftMat);
    shaft.position.set(1.1, 0.75, -2.2);
    shaft.rotation.set(0, -0.35, 0.22);
    shaft.renderOrder = 0;
    g.add(shaft);

    // --- 作業台 ---
    const bench = new THREE.Group();
    const topTex = makeWoodTexture({ base: '#a97544', grain: '#63391a', grainWeight: 1.1, knots: 3, seed: 5 });
    topTex.repeat.set(3, 1.2);
    const top = new THREE.Mesh(
      new RoundedBoxGeometry(1.9, 0.075, 0.86, 3, 0.014),
      new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.78, metalness: 0 }),
    );
    top.position.y = -0.0375;
    top.receiveShadow = true;
    top.castShadow = true;
    bench.add(top);
    this.benchTop = top;

    const legMat = std('#a9723e', 0.85);
    for (const [x, z] of [[-0.82, -0.33], [0.82, -0.33], [-0.82, 0.33], [0.82, 0.33]]) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.71, 0.085, 2, 0.012), legMat);
      leg.position.set(x, -0.43, z);
      leg.castShadow = true;
      leg.receiveShadow = true;
      bench.add(leg);
    }
    for (const [z] of [[-0.33], [0.33]]) {
      const rail = new THREE.Mesh(new RoundedBoxGeometry(1.62, 0.055, 0.05, 2, 0.01), legMat);
      rail.position.set(0, -0.62, z);
      rail.castShadow = true;
      bench.add(rail);
    }
    // 下の棚と端材
    const shelf = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.03, 0.6, 2, 0.008), legMat);
    shelf.position.set(0, -0.56, 0);
    shelf.receiveShadow = true;
    bench.add(shelf);
    const rnd = mulberry32(17);
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(
        new RoundedBoxGeometry(0.7 + rnd() * 0.5, 0.026, 0.13, 2, 0.006),
        std(['#e5c391', '#d9ab74', '#c99a63'][i % 3], 0.85),
      );
      p.position.set(-0.2 + rnd() * 0.3, -0.53 + i * 0.028, -0.12 + rnd() * 0.24);
      p.rotation.y = (rnd() - 0.5) * 0.06;
      p.castShadow = true;
      bench.add(p);
    }
    g.add(bench);
    this.bench = bench;

    // 作業台の万力（雰囲気）
    const vise = new THREE.Group();
    const vj = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.09, 0.05, 2, 0.01), std('#5f6b7a', 0.4, 0.7));
    vj.position.set(0, -0.09, 0);
    vise.add(vj);
    const vs = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.16, 10), std('#c8ced6', 0.3, 0.9));
    vs.rotation.z = Math.PI / 2;
    vs.position.set(0, -0.09, 0.05);
    vise.add(vs);
    vise.position.set(-0.78, 0, 0.42);
    vise.children.forEach((c) => (c.castShadow = true));
    g.add(vise);

    // --- 道具箱（柄を選べる） ---
    this.toolbox = makeToolbox(apron);
    this.toolbox.group.position.set(0.72, 0.0, -0.24);
    this.toolbox.group.scale.setScalar(0.72);
    this.toolbox.group.traverse((o) => { o.castShadow = true; });
    g.add(this.toolbox.group);

    // --- 奥行きを作る小物（視差） ---
    this._props();
    this._motes();
  }

  _hangTools(board) {
    const mk = (geo, mat, x, y, z = 0.05, rot = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.z = rot;
      m.castShadow = true;
      board.add(m);
      return m;
    };
    const steel = std('#c3cad3', 0.35, 0.85);
    const wood = std('#c98c4a', 0.7);
    const red = std('#e05a52', 0.5);
    // のこぎり
    const sawG = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.006), steel);
    sawG.add(b);
    const h = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.13, 0.03, 2, 0.03), red);
    h.position.x = 0.3;
    sawG.add(h);
    sawG.position.set(-0.55, 0.28, 0.06);
    sawG.rotation.z = -0.08;
    sawG.children.forEach((c) => (c.castShadow = true));
    board.add(sawG);
    // 金づち・スパナ・定規など
    mk(new THREE.BoxGeometry(0.03, 0.32, 0.03), wood, 0.15, 0.2, 0.06, 0.1);
    mk(new RoundedBoxGeometry(0.11, 0.06, 0.06, 2, 0.015), steel, 0.15, 0.39, 0.06, 0.1);
    mk(new THREE.BoxGeometry(0.03, 0.3, 0.02), std('#f0c14b', 0.5), 0.45, 0.2, 0.06, -0.06);
    mk(new THREE.TorusGeometry(0.06, 0.014, 8, 18), steel, 0.62, 0.3, 0.06);
    mk(new THREE.BoxGeometry(0.42, 0.035, 0.014), std('#f5e6c8', 0.6), -0.3, -0.16, 0.06, 0.03);
    mk(new RoundedBoxGeometry(0.09, 0.09, 0.05, 2, 0.02), std('#4aa3e0', 0.45), 0.5, -0.12, 0.06);
    mk(new THREE.TorusGeometry(0.05, 0.012, 8, 16), std('#7ac7a5', 0.5), -0.68, -0.2, 0.06);
  }

  _props() {
    const g = this.group;
    // 立てかけた木材（左奥）
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(
        new RoundedBoxGeometry(0.11, 1.5 + Math.random() * 0.4, 0.03, 2, 0.008),
        std(['#e5c391', '#d0a06a', '#bb8a55'][i % 3], 0.85),
      );
      p.position.set(-1.75 - i * 0.06, -0.05, -1.6 + i * 0.09);
      p.rotation.set(0.1 + Math.random() * 0.05, 0.2, 0.06 + i * 0.012);
      p.castShadow = true;
      g.add(p);
    }
    // 木のたる（右奥）
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.6, 18), std('#b8834f', 0.85));
    barrel.position.set(1.75, -0.48, -1.3);
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    g.add(barrel);
    for (const y of [-0.62, -0.32]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.014, 8, 20), std('#8e9aa8', 0.4, 0.7));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(1.75, y, -1.3);
      g.add(ring);
    }
    // 観葉植物（手前奥行き用）
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.2, 14), std('#e0785f', 0.7));
    pot.position.set(-1.5, -0.68, 0.3);
    pot.castShadow = true;
    g.add(pot);
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), std('#6fbf73', 0.8));
      leaf.scale.set(1, 0.35, 0.55);
      const a = (i / 9) * Math.PI * 2;
      leaf.position.set(-1.5 + Math.cos(a) * 0.12, -0.5 + (i % 3) * 0.09, 0.3 + Math.sin(a) * 0.12);
      leaf.rotation.set(0.3, a, 0.5);
      leaf.castShadow = true;
      g.add(leaf);
    }
    // 積んだ箱（奥）
    for (let i = 0; i < 3; i++) {
      const box = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.24, 0.3, 2, 0.02), std(i % 2 ? '#d8b98c' : '#c9a271', 0.85));
      box.position.set(-1.15 + i * 0.05, -0.66 + i * 0.25, -1.9);
      box.rotation.y = 0.2 - i * 0.15;
      box.castShadow = true;
      box.receiveShadow = true;
      g.add(box);
    }
    // ぶら下がる電球
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.9, 6), std('#5a4a3a', 0.8));
    cord.position.set(-0.6, 1.75, -0.9);
    g.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 18, 1, true), new THREE.MeshStandardMaterial({ color: '#e8695e', roughness: 0.5, side: THREE.DoubleSide }));
    shade.position.set(-0.6, 1.25, -0.9);
    g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshBasicMaterial({ color: '#fff1c9', toneMapped: false }));
    bulb.position.set(-0.6, 1.19, -0.9);
    g.add(bulb);
    const lamp = new THREE.PointLight('#ffd9a0', 2.2, 4, 2);
    lamp.position.set(-0.6, 1.15, -0.9);
    this.scene.add(lamp);
  }

  /** 空気中に舞う細かいほこり（光の中で見える） */
  _motes() {
    const N = 90;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    this._motePhase = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = rand(-2.2, 2.2);
      pos[i * 3 + 1] = rand(-0.3, 1.8);
      pos[i * 3 + 2] = rand(-2.4, 0.9);
      this._motePhase[i] = rand(0, 100);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.016, map: makeSoftCircleTexture(), transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending, color: '#fff3d6', toneMapped: false,
    });
    this.motes = new THREE.Points(geo, mat);
    this.motes.frustumCulled = false;
    this.group.add(this.motes);
  }

  update(dt, t) {
    if (!this.motes) return;
    const p = this.motes.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const ph = this._motePhase[i];
      p.array[i * 3 + 1] += Math.sin(t * 0.4 + ph) * 0.0006 + 0.0004;
      p.array[i * 3] += Math.sin(t * 0.25 + ph * 1.7) * 0.0007;
      if (p.array[i * 3 + 1] > 1.9) p.array[i * 3 + 1] = -0.3;
    }
    p.needsUpdate = true;
  }

  setApron(apron) {
    if (!this.toolbox) return;
    const tex = makePatternTexture(apron.pattern, apron.bg, apron.fg);
    tex.repeat.set(2, 1);
    const body = this.toolbox.group.children[0];
    if (body && body.material) {
      body.material.map = tex;
      body.material.needsUpdate = true;
    }
  }
}
