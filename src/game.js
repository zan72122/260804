/* 空港グランドハンドリング — ゲーム本体 */
(function (AG) {
  'use strict';
  const M = AG.M, G = AG.G, Mo = AG.Models, Au = AG.Audio, Obj = AG.Obj;
  const PI = Math.PI;
  const clamp = M.clamp, lerp = M.lerp, damp = M.damp, sat = M.sat;

  /* ===================== 配置定数 ===================== */
  const STOP_Z = -9.5;      /* 停止時の機首Z */
  const BRIDGE_X = -44;     /* ロタンダX */
  const PUSH_MAX = 14;      /* プッシュバック距離 */
  const IDLE_HELP = 6.5;    /* これだけ触らなければ、ゲーム側が手伝う（秒） */

  /* ===================== DOM ===================== */
  const D = {};
  function $(id) { return document.getElementById(id); }
  function initDom() {
    D.hint = $('hint'); D.hintIcon = $('hintIcon'); D.hintText = $('hintText');
    D.ghost = $('ghost'); D.ghand = $('ghand');
    D.menu = $('menu'); D.toast = $('toast'); D.action = $('action');
    D.steps = $('steps'); D.gauge = $('gauge'); D.gaugeArc = $('gaugeArc'); D.gaugeIcon = $('gaugeIcon');
    D.aim = $('aim');
  }

  let hintTimer = 0;
  function hint(icon, text) {
    D.hintIcon.textContent = icon;
    D.hintText.textContent = text;
    D.hint.classList.add('on');
  }
  function hintOff() { D.hint.classList.remove('on'); }

  /* 操作ゴースト: type = h | v | tap | hold | drag */
  function ghost(type, xPct, yPct) {
    if (!type) { D.ghost.classList.remove('on'); ghostAnim.mode = null; return; }
    ghostAnim.mode = null;
    D.ghand.style.opacity = '';
    D.ghand.className = 'gm-' + type;
    D.ghand.style.left = xPct + '%';
    D.ghand.style.top = yPct + '%';
    D.ghost.classList.add('on');
  }
  function ghostOff() { D.ghost.classList.remove('on'); ghostAnim.mode = null; }

  /* 画面上の目標マーカー。3Dの物陰に隠れても常に見える */
  function aimAt(px, py) {
    D.aim.style.transform = 'translate(' + Math.round(px) + 'px,' + Math.round(py) + 'px)';
    D.aim.classList.add('on');
  }
  function aimOff() { D.aim.classList.remove('on'); }

  /* 「ここからここへ」を指でなぞって見せるゴースト */
  const ghostAnim = { mode: null, t: 0 };
  function ghostPath(dt, ax, ay, bx, by) {
    if (ghostAnim.mode !== 'path') { ghostAnim.mode = 'path'; ghostAnim.t = 0; D.ghand.className = ''; }
    ghostAnim.t = (ghostAnim.t + dt * 0.45) % 1;
    const u = M.smooth(clamp(ghostAnim.t * 1.35, 0, 1));
    D.ghand.style.left = (ax + (bx - ax) * u) + 'px';
    D.ghand.style.top = (ay + (by - ay) * u) + 'px';
    D.ghand.style.opacity = ghostAnim.t > 0.86 ? (1 - ghostAnim.t) / 0.14 : 1;
    D.ghost.classList.add('on');
  }

  function toast(txt) {
    D.toast.textContent = txt;
    D.toast.classList.remove('pop');
    void D.toast.offsetWidth;
    D.toast.classList.add('pop');
  }

  function showAction(emoji, label, cb) {
    D.action.innerHTML = '';
    const b = document.createElement('div');
    b.className = 'btn';
    b.innerHTML = '<span class="em">' + emoji + '</span><span>' + label + '</span>';
    b.addEventListener('pointerup', (e) => { e.stopPropagation(); hideAction(); cb(); });
    D.action.appendChild(b);
    D.action.classList.add('on');
  }
  function hideAction() { D.action.classList.remove('on'); D.action.innerHTML = ''; }

  function showMenu(title, sub, items) {
    D.menu.innerHTML = '';
    if (title) {
      const h = document.createElement('h1');
      h.innerHTML = title + (sub ? '<small>' + sub + '</small>' : '');
      D.menu.appendChild(h);
    }
    items.forEach((it, i) => {
      const b = document.createElement('div');
      b.className = 'btn' + (i === 1 ? ' b2' : i === 2 ? ' b3' : '');
      b.innerHTML = '<span class="em">' + it[0] + '</span><span>' + it[1] + '</span>';
      b.addEventListener('pointerup', (e) => { e.stopPropagation(); hideMenu(); Au.unlock(); it[2](); });
      D.menu.appendChild(b);
    });
    D.menu.classList.add('on');
  }
  function hideMenu() { D.menu.classList.remove('on'); D.menu.innerHTML = ''; }

  const STEP_ICONS = ['🛬', '🧱', '🌉', '🧰', '🚜'];
  function setSteps(cur) {
    if (cur < 0) { D.steps.classList.remove('on'); return; }
    if (D.steps.children.length !== STEP_ICONS.length) {
      D.steps.innerHTML = '';
      STEP_ICONS.forEach((e) => { const d = document.createElement('div'); d.textContent = e; D.steps.appendChild(d); });
    }
    for (let i = 0; i < STEP_ICONS.length; i++) {
      const el = D.steps.children[i];
      el.className = i < cur ? 'done' : i === cur ? 'cur' : '';
    }
    D.steps.classList.add('on');
  }
  function gauge(v, icon) {
    if (v < 0) { D.gauge.classList.remove('on'); return; }
    D.gaugeIcon.textContent = icon || '⛽';
    D.gaugeArc.setAttribute('stroke-dashoffset', String(264 * (1 - sat(v))));
    D.gauge.classList.add('on');
  }

  /* ===================== 入力 ===================== */
  const In = {
    down: false, x: 0, y: 0, px: 0, py: 0, dx: 0, dy: 0,
    sx: 0, sy: 0, hold: 0, moved: 0, still: 0, justDown: false, justUp: false,
    tapped: false, id: null,
  };
  function initInput(canvas) {
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    canvas.addEventListener('pointerdown', (e) => {
      /* 先に触れていた指があっても、新しい指を優先する（手のひら誤接触対策） */
      Au.unlock();
      In.id = e.pointerId;
      const p = pos(e);
      In.x = In.px = In.sx = p[0]; In.y = In.py = In.sy = p[1];
      In.down = true; In.justDown = true; In.hold = 0; In.moved = 0; In.still = 0;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== In.id) return;
      const p = pos(e);
      In.x = p[0]; In.y = p[1];
      e.preventDefault();
    }, { passive: false });
    const up = (e) => {
      if (e.pointerId !== In.id) return;
      In.id = null; In.down = false; In.justUp = true;
      if (In.moved < 16 && In.hold < 0.45) In.tapped = true;
      e.preventDefault();
    };
    canvas.addEventListener('pointerup', up, { passive: false });
    canvas.addEventListener('pointercancel', up, { passive: false });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function inputFrame(dt) {
    In.dx = In.x - In.px; In.dy = In.y - In.py;
    In.px = In.x; In.py = In.y;
    if (In.down) {
      In.hold += dt;
      const mv = Math.hypot(In.dx, In.dy);
      In.moved += mv;
      /* 指を止めている時間（長押し判定に使う。誘導のあとに止めてもよい） */
      In.still = mv > 2.5 ? 0 : In.still + dt;
    } else In.still = 0;
  }
  function inputEnd() { In.justDown = false; In.justUp = false; In.tapped = false; }

  /* ===================== 粒子 ===================== */
  const parts = [];
  function puff(x, y, z, n, opt) {
    opt = opt || {};
    for (let i = 0; i < n; i++) {
      const a = Math.random() * PI * 2, s = (opt.spd || 1) * (0.3 + Math.random() * 0.9);
      parts.push({
        p: [x + (Math.random() - .5) * (opt.rad || .3), y + Math.random() * (opt.rad || .3), z + (Math.random() - .5) * (opt.rad || .3)],
        v: [Math.cos(a) * s, (opt.up === undefined ? 0.5 : opt.up) * (0.4 + Math.random()), Math.sin(a) * s],
        life: 0, max: opt.life || 1.2,
        s0: opt.s0 || 0.25, s1: opt.s1 || 1.4,
        col: opt.col || [0.62, 0.58, 0.52],
        g: opt.g === undefined ? -0.25 : opt.g,
        a0: opt.a0 === undefined ? 0.5 : opt.a0,
      });
    }
  }
  function sparkle(x, y, z, n) {
    puff(x, y, z, n, { spd: 2.4, up: 1.6, life: 1.0, s0: 0.12, s1: 0.02, col: [2.2, 1.9, 0.9], g: -3.2, a0: 1, rad: 0.5 });
  }
  function updateParts(dt, R) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.v[1] += p.g * dt;
      p.p[0] += p.v[0] * dt; p.p[1] += p.v[1] * dt; p.p[2] += p.v[2] * dt;
      if (p.p[1] < 0.02) { p.p[1] = 0.02; p.v[1] *= -0.2; p.v[0] *= 0.7; p.v[2] *= 0.7; }
      const t = p.life / p.max;
      R.addSprite(p.p, lerp(p.s0, p.s1, t), p.col, p.a0 * (1 - t) * (1 - t));
    }
  }

  /* ===================== 状態 ===================== */
  const st = {
    phase: '', t: 0, sub: 0,
    plane: { x: 0, z: -95, yaw: 0, v: 0, pitch: 0, pitchV: 0, wheel: 0, stopped: false, sink: 0 },
    steer: 0, steerTarget: 0, stopHold: 0, stopSignal: false, autoStopT: 0, idle: 0,
    bridgeExt: 0, bridgeV: 0, bridgeDocked: false,
    push: 0, pushV: 0, pushTarget: 0,
    fuel: 0, boom: -0.12, cargoDone: 0,
    enginePow: 0, camShake: 0, sigMode: 'come',
    freeMode: false, sameAircraft: false, liveryIdx: 0,
    lightsOn: false,
  };

  let R, MAT, TEX, world, ac, acRig, marshal, bridge, tractor, loader, gpu, fueler;
  let chocks = [], bags = [], guides = {}, cable, cableMesh, hose, hoseMesh, plug, nozzle;
  let farPlanes = [], dolly;
  const camPos = [0, 3, 12], camTgt = [0, 3, -14];
  const camGoalP = [0, 3, 12], camGoalT = [0, 3, -14];
  let camSnap = false, camLambda = 2.2;
  const tmp = [0, 0, 0], tmp2 = [0, 0, 0], sp = [0, 0, 0], sp2 = [0, 0, 0];

  function setCam(p, t, instant, lam) {
    camGoalP[0] = p[0]; camGoalP[1] = p[1]; camGoalP[2] = p[2];
    camGoalT[0] = t[0]; camGoalT[1] = t[1]; camGoalT[2] = t[2];
    camLambda = lam || 2.2;
    if (instant) camSnap = true;
  }
  function updateCam(dt) {
    if (camSnap) {
      camPos[0] = camGoalP[0]; camPos[1] = camGoalP[1]; camPos[2] = camGoalP[2];
      camTgt[0] = camGoalT[0]; camTgt[1] = camGoalT[1]; camTgt[2] = camGoalT[2];
      camSnap = false;
    } else {
      for (let i = 0; i < 3; i++) {
        camPos[i] = damp(camPos[i], camGoalP[i], camLambda, dt);
        camTgt[i] = damp(camTgt[i], camGoalT[i], camLambda, dt);
      }
    }
    /* 実際に使う視点。camPos 自体は書き換えない */
    let ex = camPos[0], ey = camPos[1], ez = camPos[2];
    const asp = R.aspect || 1;
    if (asp < 1) {
      /* 縦画面は水平画角を保つため被写体が小さくなる。注視点へ少しだけ寄せて補う */
      const dx = camTgt[0] - ex, dy = camTgt[1] - ey, dz = camTgt[2] - ez;
      const d = Math.hypot(dx, dy, dz) || 1;
      const step = Math.min(d * 0.14 * (1 - asp), 1.1);
      ex += dx / d * step; ey += dy / d * step; ez += dz / d * step;
    }
    let sh = st.camShake;
    if (sh > 0) {
      st.camShake = Math.max(0, sh - dt * 1.7);
      const k = sh * sh * 0.30;
      ex += (Math.random() - .5) * k; ey += (Math.random() - .5) * k; ez += (Math.random() - .5) * k;
    }
    R.camPos[0] = ex; R.camPos[1] = ey; R.camPos[2] = ez;
    R.camTarget[0] = camTgt[0]; R.camTarget[1] = camTgt[1]; R.camTarget[2] = camTgt[2];
    /* 影のボリュームは「注視点」と「機体」の両方を覆う */
    const px = st.plane.x, pz = st.plane.z - 16;
    const cx = (camTgt[0] + px) * 0.5, cz = (camTgt[2] + pz) * 0.5;
    const spread = Math.max(Math.abs(camTgt[0] - px), Math.abs(camTgt[2] - pz)) * 0.5;
    R.shadowCenter[0] = damp(R.shadowCenter[0], cx, 6, dt);
    R.shadowCenter[2] = damp(R.shadowCenter[2], cz, 6, dt);
    R.shadowRadius = damp(R.shadowRadius, clamp(spread + 30, 34, 90), 6, dt);
    /* 近景シャドウは注視点まわりを密に覆う（接地の影がはっきり出る） */
    const cd = Math.hypot(ex - camTgt[0], ey - camTgt[1], ez - camTgt[2]);
    R.shadowCenterN[0] = damp(R.shadowCenterN[0], camTgt[0], 8, dt);
    R.shadowCenterN[2] = damp(R.shadowCenterN[2], camTgt[2], 8, dt);
    R.shadowRadiusN = damp(R.shadowRadiusN, clamp(cd * 0.62, 5.5, 26), 8, dt);
  }

  /* 画面上での「ワールド方向」を求める（操作方向の自動整合に使う） */
  function screenDir(worldPos, dir) {
    R.project(worldPos, sp);
    tmp[0] = worldPos[0] + dir[0]; tmp[1] = worldPos[1] + dir[1]; tmp[2] = worldPos[2] + dir[2];
    R.project(tmp, sp2);
    let dx = sp2[0] - sp[0], dy = sp2[1] - sp[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  }
  function worldOf(o, out) {
    out = out || [0, 0, 0];
    out[0] = o.world[12]; out[1] = o.world[13]; out[2] = o.world[14];
    return out;
  }
  function localToWorld(o, v, out) { return M.xformPoint(out || [0, 0, 0], o.world, v); }

  /* ===================== ガイド表示（3D） ===================== */
  function buildGuides() {
    /* 地面のリング */
    const ringGeo = G.merge([G.rot(G.torus(0.62, 0.075, 20, 8), 0, 0, 0)]);
    guides.ringMesh = R.mesh(ringGeo);
    /* 矢印 */
    const ag = G.mk();
    const pts = [[0, 0, 1.0], [-0.62, 0, 0.15], [-0.26, 0, 0.15], [-0.26, 0, -0.95], [0.26, 0, -0.95], [0.26, 0, 0.15], [0.62, 0, 0.15]];
    const idx = [];
    for (const p of pts) idx.push(G.vert(ag, p[0], 0, p[2], 0, 1, 0, 0, 0));
    G.tri(ag, idx[0], idx[1], idx[2]); G.tri(ag, idx[0], idx[2], idx[6]); G.tri(ag, idx[6], idx[2], idx[5]);
    G.quad(ag, idx[2], idx[3], idx[4], idx[5]);
    /* 立てて手前を向かせた矢印（+X を指す） */
    G.rot(ag, 0, PI / 2, 0);
    G.rot(ag, -PI / 2, 0, 0);
    guides.arrowMesh = R.mesh(ag);
    /* 停止マーカー（太い横棒） */
    guides.barMesh = R.mesh(G.box(9.0, 0.06, 0.55));

    guides.ringA = mk(guides.ringMesh, MAT.guideOK);
    guides.ringB = mk(guides.ringMesh, MAT.guideOK);
    guides.arrowL = mk(guides.arrowMesh, MAT.guideDir);
    guides.arrowR = mk(guides.arrowMesh, MAT.guideDir);
    guides.stopBar = mk(guides.barMesh, MAT.guideDir);
    guides.target = mk(guides.ringMesh, MAT.guideOK);
    function mk(mesh, mat) {
      const o = new Obj(mesh, Object.assign({}, mat));
      o.cast = false; o.visible = false;
      world.add(o);
      return o;
    }
  }
  function pulseMat(o, base, speed) {
    const k = base + Math.sin(R.time * (speed || 5)) * 0.18;
    o.mat.alpha = clamp(k, 0.12, 0.95);
  }

  /* ===================== ワールド構築 ===================== */
  function buildWorld() {
    const mm = Mo.materials(R);
    MAT = mm.mat; TEX = mm.tex;
    world = new Obj();
    world.add(Mo.environment(R, MAT));

    acRig = new Obj();
    world.add(acRig);
    ac = Mo.aircraft(R, MAT);
    ac.setPos(0, 0, -ac.userData.MG_Z);   /* 主脚接地点を回転中心にする */
    acRig.add(ac);

    /* 遠方に駐機する僚機 */
    for (let i = 0; i < 2; i++) {
      const c = Mo.cloneAircraft(ac);
      c.setPos(0, 0, -ac.userData.MG_Z);
      const rig = new Obj();
      rig.setPos(-30 - i * 5, 0, -84 - i * 68);
      rig.setRot(0, 0.06 - i * 0.10, 0);
      rig.add(c);
      world.add(rig);
      farPlanes.push(rig);
    }

    /* ドアの開口部（開いたときだけ表示） */
    const holeMat = { color: Mo.C('#0d1014'), gloss: 0.15, shine: 20 };
    function makeHole(pos, ang, h, len, panelUp) {
      const g = new Obj();
      g.setPos(pos[0], pos[1], pos[2]);
      g.setRot(0, 0, ang);
      const inner = new Obj(R.mesh(G.merge([
        G.place(G.box(0.10, h, len), [0.05, 0, 0]),
        G.place(G.box(0.30, h * 0.9, len * 0.92), [-0.14, 0, 0]),
      ])), holeMat);
      inner.cast = false;
      g.add(inner);
      /* 開いた扉 */
      const panel = new Obj(R.mesh(G.place(G.box(0.07, h, len), [0.04, h / 2, 0])), MAT.white);
      panel.setPos(0.06, h / 2, 0);
      panel.r[2] = panelUp;
      g.add(panel);
      g.visible = false;
      ac.add(g);
      return g;
    }
    const cd = ac.userData.cargoR;
    st.cargoHole = makeHole([cd[0] * 1.03, cd[1] - 0.05, cd[2]],
      Math.atan2(cd[1] - ac.userData.AXIS, cd[0]), 1.28, 1.50, -1.9);
    const pd = ac.userData.doorL1;
    st.paxHole = makeHole([pd[0] * 1.02, pd[1], pd[2]],
      Math.atan2(pd[1] - ac.userData.AXIS, pd[0]), 1.86, 0.86, 1.8);

    marshal = Mo.person(R, MAT, {});
    marshal.setPos(0, 0, 2.0);
    marshal.setRot(0, PI, 0);
    world.add(marshal);
    marshal.userData.trail = [[], []];

    /* 地上作業員（翼下） */
    const crew = Mo.person(R, MAT, { wands: false });
    crew.setPos(8.9, 0, -25.2); crew.setRot(0, -2.3, 0);
    world.add(crew);
    st.crew = crew;

    bridge = Mo.jetBridge(R, MAT);
    bridge.setPos(BRIDGE_X, 0, -13.9);
    world.add(bridge);

    tractor = Mo.tractor(R, MAT);
    tractor.setPos(26, 0, 12); tractor.setRot(0, PI, 0);
    world.add(tractor);

    loader = Mo.beltLoader(R, MAT);
    loader.setPos(24, 0, -6); loader.setRot(0, PI, 0);
    world.add(loader);

    gpu = Mo.gpu(R, MAT);
    gpu.setPos(-8.8, 0, -3.2); gpu.setRot(0, 0.80, 0);
    world.add(gpu);

    fueler = Mo.fueler(R, MAT);
    fueler.setPos(10.4, 0, -29.4); fueler.setRot(0, PI, 0);
    world.add(fueler);

    for (let i = 0; i < 2; i++) {
      const c = Mo.chock(R, MAT);
      c.visible = false;
      world.add(c);
      chocks.push(c);
    }
    for (let i = 0; i < 3; i++) {
      const b = Mo.bag(R, MAT, i);
      b.visible = false;
      world.add(b);
      bags.push(b);
    }
    dolly = Mo.dolly(R, MAT);
    dolly.setPos(13.4, 0, -12.0); dolly.setRot(0, PI / 2, 0);
    world.add(dolly);

    /* 電源ケーブル・給油ホース（動的メッシュ） */
    plug = new Obj(R.mesh(G.merge([
      G.place(G.cyl(0.17, 0.17, 0.42, 16), [0, 0, 0], [PI / 2, 0, 0]),
      G.place(G.cyl(0.13, 0.13, 0.16, 14), [0, 0, -0.28], [PI / 2, 0, 0]),
      G.place(G.box(0.26, 0.38, 0.16), [0, 0.22, 0.08]),
      G.place(G.box(0.30, 0.10, 0.10), [0, 0.42, 0.08]),
    ])), MAT.plugYellow);
    plug.visible = false; world.add(plug);
    cableMesh = R.mesh(cableGeo([0, 0, 0], [1, 0, 0], 0.055), true);
    cable = new Obj(cableMesh, MAT.cableRed);
    cable.visible = false; cable.cast = false; world.add(cable);

    nozzle = new Obj(R.mesh(G.merge([
      G.place(G.cyl(0.10, 0.13, 0.5, 14), [0, 0, 0], [PI / 2, 0, 0]),
      G.place(G.box(0.16, 0.22, 0.34), [0, -0.16, -0.1]),
      G.place(G.cyl(0.16, 0.16, 0.1, 14), [0, 0, 0.26], [PI / 2, 0, 0]),
    ])), MAT.chrome);
    nozzle.visible = false; world.add(nozzle);
    hoseMesh = R.mesh(cableGeo([0, 0, 0], [1, 0, 0], 0.085), true);
    hose = new Obj(hoseMesh, MAT.hoseBlack);
    hose.visible = false; hose.cast = false; world.add(hose);

    buildGuides();
  }

  /* ---- 塗装（別の機体に見せる） ---- */
  const liveryCache = [];
  function setLivery(i) {
    const T = AG.T;
    i = ((i % T.PALETTES.length) + T.PALETTES.length) % T.PALETTES.length;
    st.liveryIdx = i;
    if (!liveryCache[i]) {
      const pal = T.PALETTES[i];
      liveryCache[i] = {
        fuse: R.texture(T.fuselage(pal)),
        fin: R.texture(T.fin(pal)),
        accent: Mo.C(pal.a),
      };
    }
    MAT.fuse.map = liveryCache[i].fuse;
    MAT.finM.map = liveryCache[i].fin;
    MAT.navy.color = liveryCache[i].accent;
  }

  /* たるんだケーブル形状 */
  const cablePts = [];
  function cableGeo(a, b, r) {
    cablePts.length = 0;
    const d = M.vdist(a, b);
    const sag = Math.min(1.5, 0.16 * d + 0.15);
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const s = Math.sin(t * PI);
      cablePts.push([
        lerp(a[0], b[0], t) + Math.sin(t * 7) * 0.03,
        lerp(a[1], b[1], t) - sag * s,
        lerp(a[2], b[2], t) + Math.cos(t * 5) * 0.03,
      ]);
    }
    return G.tube(cablePts, r, 0, 7);
  }
  function updateCable(obj, mesh, a, b, r) {
    R.updateMesh(mesh, cableGeo(a, b, r));
  }

  /* ===================== ドラッグ課題 =====================
     指の位置を「掴んだ地点→目標」の画面上の線分へ射影して進める。
     水平面へ投影する方式だと画面上方で発散して物が飛ぶため、この方式にした。 */
  const drag = { items: [], active: null, done: 0, t: 0, tOff: 0 };
  function setDrag(items) {
    drag.items = items; drag.active = null; drag.done = 0; drag.t = 0;
    for (const it of items) { it.done = false; it.from = it.obj.p.slice(); }
  }
  /* 指の画面位置 → 経路上の進み具合 t */
  function dragParam(it, px, py) {
    R.project(it.from, sp);
    R.project(it.to, sp2);
    const ax = sp2[0] - sp[0], ay = sp2[1] - sp[1];
    const L2 = ax * ax + ay * ay;
    if (L2 < 900) {
      /* 画面上でほぼ重なっている場合は、目標までの画面距離で判定 */
      const r = Math.min(R.canvas.clientWidth, R.canvas.clientHeight) * 0.30;
      return 1 - clamp(Math.hypot(px - sp2[0], py - sp2[1]) / r, 0, 1);
    }
    return ((px - sp[0]) * ax + (py - sp[1]) * ay) / L2;
  }
  function updateDrag(dt) {
    if (!drag.items.length) return;
    const pickR = Math.min(R.canvas.clientWidth, R.canvas.clientHeight) * 0.36;
    if (In.justDown) {
      /* 物そのものでも、目標でも、近い方を掴んだとみなす */
      let best = null, bd = pickR;
      for (const it of drag.items) {
        if (it.done) continue;
        R.project(worldOf(it.obj, tmp), sp);
        const d1 = sp[2] > 0 ? Math.hypot(sp[0] - In.sx, sp[1] - In.sy) : 1e9;
        R.project(it.to, sp2);
        const d2 = sp2[2] > 0 ? Math.hypot(sp2[0] - In.sx, sp2[1] - In.sy) * 1.4 : 1e9;
        const d = Math.min(d1, d2);
        if (d < bd) { bd = d; best = it; }
      }
      /* 残りがひとつなら、画面のどこを触っても掴めたことにする */
      if (!best) {
        const left = drag.items.filter((x) => !x.done);
        if (left.length === 1) best = left[0];
      }
      if (best) {
        best.from = best.obj.p.slice();
        drag.active = best;
        drag.t = 0;
        drag.tOff = dragParam(best, In.sx, In.sy);
        Au.blip(true);
      }
    }
    const it = drag.active;
    if (it && In.down) {
      const t = clamp(dragParam(it, In.x, In.y) - drag.tOff, -0.05, 1.15);
      drag.t = damp(drag.t, t, 18, dt);
      const u = clamp(drag.t, 0, 1);
      for (let k = 0; k < 3; k++) it.obj.p[k] = it.from[k] + (it.to[k] - it.from[k]) * u;
      if (it.rot) for (let k = 0; k < 3; k++) it.obj.r[k] = damp(it.obj.r[k], it.rot[k], 6, dt);
      if (drag.t > 0.80) snapItem(it);
    }
    if (it && In.justUp) {
      if (!it.done && drag.t > 0.45) snapItem(it);   /* 途中で離しても意図を汲む */
      drag.active = null;
    }
  }
  /* 放置されたときに自動で完了させる（4歳児が手を止めても詰まらないように） */
  function autoFinishDrag(dt, speed) {
    const it = drag.items.find((x) => !x.done);
    if (!it) return false;
    it.from = it.from || it.obj.p.slice();
    drag.t = Math.min(1, drag.t + dt * (speed || 0.55));
    for (let k = 0; k < 3; k++) it.obj.p[k] = it.from[k] + (it.to[k] - it.from[k]) * drag.t;
    if (drag.t >= 1) { drag.t = 0; snapItem(it); }
    return true;
  }

  function snapItem(it) {
    if (it.done) return;
    it.done = true; drag.done++;
    it.obj.p[0] = it.to[0]; it.obj.p[1] = it.to[1]; it.obj.p[2] = it.to[2];
    if (it.rot) { it.obj.r[0] = it.rot[0]; it.obj.r[1] = it.rot[1]; it.obj.r[2] = it.rot[2]; }
    drag.active = null;
    if (it.onSnap) it.onSnap(it);
  }

  /* ===================== マーシャラーの動作 ===================== */
  const pose = {
    /* [shoulderZ, elbowX] 左右対称。stop は交差 */
    idle: { sh: 0.22, el: -0.25 },
    come: { sh: 2.45, el: -0.35 },
    slow: { sh: 1.15, el: -0.30 },
    stop: { sh: 3.30, el: -0.05 },
    turn: { sh: 1.55, el: -0.10 },
    salute: { sh: 2.30, el: -0.9 },
  };
  const armState = { lsh: 0.22, lel: -0.25, rsh: 0.22, rel: -0.25, lean: 0, twist: 0 };

  function updateMarshal(dt, mode, steer, active) {
    const a = marshal.userData.arms;
    let tl = pose.idle, tr = pose.idle;
    let beatL = 0, beatR = 0;
    const beat = Math.sin(R.time * 6.4);

    if (mode === 'come') {
      tl = tr = pose.come;
      beatL = beatR = beat * 0.62;
    } else if (mode === 'stop') {
      tl = tr = pose.stop;
    } else if (mode === 'slow') {
      tl = tr = pose.slow;
      beatL = beatR = Math.sin(R.time * 2.6) * 0.42;
    } else if (mode === 'turn') {
      /* 曲がる側の腕を止め、もう一方で招く */
      if (steer > 0) { tl = pose.turn; tr = pose.come; beatR = beat * 0.75; }
      else { tr = pose.turn; tl = pose.come; beatL = beat * 0.75; }
    } else if (mode === 'salute') {
      tl = tr = pose.salute;
      beatL = beatR = Math.sin(R.time * 3.2) * 0.5;
    }

    const k = 7.5;
    armState.lsh = damp(armState.lsh, tl.sh, k, dt);
    armState.rsh = damp(armState.rsh, tr.sh, k, dt);
    armState.lel = damp(armState.lel, tl.el + beatL, 11, dt);
    armState.rel = damp(armState.rel, tr.el + beatR, 11, dt);

    /* 体の傾き（指の動きに反応） */
    armState.lean = damp(armState.lean, clamp(steer, -1, 1) * 0.13, 6, dt);
    armState.twist = damp(armState.twist, clamp(steer, -1, 1) * 0.22, 6, dt);

    /* 交差ポーズのときは左右を内側へ寄せる */
    const cross = mode === 'stop' ? 1 : 0;
    a.r.shoulder.r[2] = armState.rsh;
    a.l.shoulder.r[2] = -armState.lsh;
    a.r.shoulder.r[0] = cross * -0.18;
    a.l.shoulder.r[0] = cross * -0.18;
    a.r.elbow.r[0] = armState.rel;
    a.l.elbow.r[0] = armState.lel;
    a.r.hand.r[0] = 0.2; a.l.hand.r[0] = 0.2;

    marshal.r[2] = -armState.lean * 0.5;
    marshal.r[1] = PI + armState.twist;
    marshal.p[1] = Math.abs(Math.sin(R.time * 3.2)) * 0.012 * (mode === 'come' ? 1 : 0.3);

    /* ワンドの軌跡 */
    const w = marshal.userData.wands;
    if (w) {
      const list = [w.l, w.r];
      for (let i = 0; i < 2; i++) {
        localToWorld(list[i], list[i].userData.tip, tmp);
        const tr2 = marshal.userData.trail[i];
        tr2.push([tmp[0], tmp[1], tmp[2], 0]);
        if (tr2.length > 12) tr2.shift();
        for (let j = 0; j < tr2.length; j++) {
          const f = j / tr2.length;
          R.addSprite(tr2[j], 0.045 + f * 0.055, [1.5, 0.72, 0.16], 0.30 * f * f);
        }
        R.addSprite(tmp, 0.115, [1.9, 1.15, 0.55], 0.80);
        R.addSprite(tmp, 0.30, [1.1, 0.45, 0.10], 0.22);
      }
    }
  }

  /* ===================== 機体の更新 ===================== */
  function applyPlane() {
    const p = st.plane;
    acRig.p[0] = p.x;
    acRig.p[1] = -p.sink;
    acRig.p[2] = p.z + ac.userData.MG_Z;
    acRig.r[0] = p.pitch;
    acRig.r[1] = p.yaw;
    const wheels = ac.userData.wheels;
    for (let i = 0; i < wheels.length; i++) wheels[i].r[0] = p.wheel;
    for (const e of ac.userData.engines) e.r[2] = st.engineSpin || 0;
  }
  function planeMove(dist) {
    const p = st.plane;
    p.x += Math.sin(p.yaw) * dist;
    p.z += Math.cos(p.yaw) * dist;
    p.wheel += dist / 0.62;
  }
  function planeLights(dt) {
    const L = ac.userData.lights;
    const on = st.lightsOn;
    const t = R.time;
    /* ビーコン: 約1.2秒周期の赤閃光 */
    const bf = (t % 1.2) < 0.10 ? 1 : 0;
    const beacon = st.beaconOn ? bf : 0;
    for (const k of ['beaconTop', 'beaconBot']) {
      L[k].visible = true;
      L[k].mat = beacon ? MAT.lightRed : MAT.glass;
      if (beacon) { worldOf(L[k], tmp); R.addSprite(tmp, 0.40, [3.0, 0.25, 0.15], 0.9); }
    }
    L.navL.visible = L.navR.visible = on;
    if (on) {
      worldOf(L.navL, tmp); R.addSprite(tmp, 0.26, [2.6, 0.25, 0.2], 0.9);
      worldOf(L.navR, tmp); R.addSprite(tmp, 0.26, [0.25, 2.4, 0.5], 0.9);
      /* ストロボ */
      const sf = (t % 1.6);
      if (sf < 0.06 || (sf > 0.14 && sf < 0.20)) {
        worldOf(L.navL, tmp); R.addSprite(tmp, 0.85, [3, 3, 3], 0.95);
        worldOf(L.navR, tmp); R.addSprite(tmp, 0.85, [3, 3, 3], 0.95);
      }
      worldOf(L.logo, tmp); R.addSprite(tmp, 0.35, [1.6, 1.5, 1.3], 0.45);
    }
    const taxi = st.taxiLights;
    L.taxi.visible = L.landL.visible = L.landR.visible = !!taxi;
    if (taxi) {
      for (const k of ['taxi', 'landL', 'landR']) {
        worldOf(L[k], tmp);
        R.addSprite(tmp, 0.42, [2.2, 2.1, 1.85], 0.85);
        R.addSprite(tmp, 1.25, [0.9, 0.86, 0.75], 0.16);
      }
    }
    L.logo.visible = on;
  }

  /* ===================== フェーズ ===================== */
  function enter(phase) {
    /* 目標位置を機体のワールド行列から取るので、先に最新化しておく */
    applyPlane();
    world.updateWorld(null);
    st.phase = phase; st.t = 0; st.sub = 0; st.idle = 0;
    hintOff(); ghostOff(); hideAction(); gauge(-1);
    drag.items = []; drag.active = null;
    for (const k in guides) if (guides[k] && guides[k].visible !== undefined) guides[k].visible = false;
    PH[phase] && PH[phase].enter && PH[phase].enter();
  }

  const PH = {};

  /* ---------- タイトル ---------- */
  PH.title = {
    enter() {
      setSteps(-1);
      resetScene();
      st.plane.z = -27; st.plane.x = -1.9;
      st.beaconOn = true; st.lightsOn = true; st.taxiLights = true;
      setCam([16.5, 5.2, 9], [-3.0, 5.6, -25], true);
      Au.ambient(1);
      showMenu('くうこう<br>グランドハンドリング',
        'ひこうきを むかえて おくりだそう',
        [['🛬', 'はじめる', () => enter('marshal')],
        ['🎏', 'マーシャリングだけ', () => { st.freeMode = true; enter('marshal'); }]]);
    },
    update(dt) {
      const p = st.plane;
      p.z += 0.55 * dt;
      p.wheel += 0.55 * dt / 0.62;
      st.engineSpin += dt * 3.4;
      applyPlane();
      Au.engine(0.35, 0.85);
      camGoalP[0] = 16.5 + Math.sin(R.time * 0.09) * 4;
      camGoalP[2] = 9 + Math.cos(R.time * 0.09) * 3.0;
    },
  };

  function resetScene() {
    const p = st.plane;
    p.x = (Math.random() < 0.5 ? -1 : 1) * (2.6 + Math.random() * 2.2);
    p.z = -76; p.yaw = 0; p.v = 0; p.pitch = 0; p.pitchV = 0; p.wheel = 0; p.stopped = false; p.sink = 0;
    st.steer = 0; st.steerTarget = 0; st.stopHold = 0; st.stopSignal = false; st.autoStopT = 0;
    st.bridgeExt = 0; st.bridgeV = 0; st.bridgeGoal = 0; st.bridgeDocked = false;
    st.push = 0; st.pushV = 0; st.pushGoal = 0; st.fuel = 0; st.boom = -0.12; st.cargoDone = 0;
    st.engineSpin = 0; st.lightsOn = false; st.beaconOn = true; st.taxiLights = true;
    bridge.userData.ext = 0;
    for (const c of chocks) c.visible = false;
    for (const b of bags) b.visible = false;
    if (st.cargoHole) st.cargoHole.visible = false;
    if (st.paxHole) st.paxHole.visible = false;
    plug.visible = false; cable.visible = false;
    nozzle.visible = false; hose.visible = false;
    tractor.setPos(26, 0, 12); tractor.setRot(0, PI * 0.15, 0);
    tractor.userData.bar.visible = false;
    loader.setPos(24, 0, -6); loader.setRot(0, PI, 0);
    marshal.setPos(0, 0, 2.0);
    applyBridge(0);
  }

  /* ---------- 1. マーシャリング ---------- */
  PH.marshal = {
    enter() {
      setSteps(0);
      const p = st.plane;
      if (p.z > -40) { p.z = -76; p.x = (Math.random() < 0.5 ? -1 : 1) * (2.6 + Math.random() * 2.0); }
      p.yaw = 0; p.stopped = false; p.pitch = 0; p.sink = 0;
      st.beaconOn = true; st.taxiLights = true; st.lightsOn = false;
      st.stopSignal = false; st.stopHold = 0; st.autoStopT = 0; st.steer = 0; st.steerTarget = 0;
      marshal.setPos(0, 0, 2.0);
      setCam([0, 2.15, 5.4], [0, 3.4, -16], true);
      guides.stopBar.visible = true;
      guides.stopBar.setPos(0, 0.04, STOP_Z);
      hint('🛬', 'ゆびを よこに うごかして ひこうきを まっすぐに！');
      ghost('h', 50, 76);
      Au.ambient(1);
    },
    update(dt) {
      const p = st.plane;
      const dist = STOP_Z - p.z;   /* 残り距離 */

      /* --- 入力 -> 誘導信号 --- */
      if (In.down) {
        const w = R.canvas.clientWidth;
        st.steerTarget = clamp((In.x - In.sx) / (w * 0.16), -1, 1);
        if (In.still > 0.45) st.stopSignal = true;
      } else {
        st.steerTarget = damp(st.steerTarget, 0, 4.5, dt);
        st.stopSignal = false;      /* 指を離したら合図も解除 */
      }
      const prevSteer = st.steer;
      st.steer = damp(st.steer, st.steerTarget, 9, dt);
      if (Math.abs(st.steer - prevSteer) > 0.05) Au.whoosh(Math.abs(st.steer - prevSteer) * 4);

      if (!p.stopped) {
        /* 速度: 遠いほど速く、近づくほどゆっくり */
        let target = clamp(2.1 + dist * 0.145, 1.7, 10.0);
        if (st.slowSignal) target = Math.min(target, 1.15);
        p.v = damp(p.v, target, 2.4, dt);

        /* 操縦: 指の位置に即応 + 自動センタリング補正 */
        /* 近づくほど自動整列を強め、何もしなくても大きくは外れないようにする */
        const assistK = dist < 16 ? 0.038 + (16 - dist) * 0.006 : 0.038;
        const assist = clamp(-p.x * assistK, -0.20, 0.20);
        const ty = clamp(st.steer * 0.24 + assist, -0.30, 0.30);
        p.yaw = damp(p.yaw, ty, 3.2, dt);
        p.x = clamp(p.x, -9, 9);
        planeMove(p.v * dt);

        /* 停止判定 */
        const inZone = dist < 5.2;
        if (st.stopSignal) {
          if (inZone) { doStop(); }
          else { st.slowSignal = true; }
        }
        if (dist < 1.4) { st.autoStopT += dt; if (st.autoStopT > 0.7) doStop(); }

        /* エンジン音 */
        const near = clamp(1 - dist / 90, 0, 1);
        Au.engine(0.35 + near * 0.75, 0.75 + near * 0.45);
        /* 排気の揺らぎ */
        if (Math.random() < dt * 22) {
          localToWorld(ac, [4.6, 1.0, -17.0], tmp);
          puff(tmp[0], tmp[1], tmp[2], 1, { spd: 1.2, up: 0.4, life: 1.4, s0: 0.4, s1: 2.6, col: [0.5, 0.48, 0.46], a0: 0.10, g: 0.1 });
        }
      } else {
        /* 停止後の沈み込みと揺り戻し */
        p.v = damp(p.v, 0, 6, dt);
      }

      /* --- ノーズの上下動（バネ） --- */
      const targetPitch = p.stopped ? 0 : 0;
      p.pitchV += (targetPitch - p.pitch) * 42 * dt - p.pitchV * 4.2 * dt;
      p.pitch += p.pitchV * dt;
      p.sink = damp(p.sink, 0, 4, dt);

      applyPlane();

      /* --- マーシャラーの動作 --- */
      let mode = 'come';
      if (p.stopped) mode = st.t - (st.stopTime || 0) < 2.2 ? 'stop' : 'salute';
      else if (st.stopSignal && !p.stopped) mode = 'stop';
      else if (Math.abs(st.steer) > 0.22) mode = 'turn';
      else if (st.slowSignal) mode = 'slow';
      st.sigMode = mode;
      updateMarshal(dt, mode, st.steer, true);

      /* --- ガイド表示 --- */
      const off = p.x;
      const aligned = Math.abs(off) < 1.1;
      guides.stopBar.visible = !p.stopped;
      pulseMat(guides.stopBar, dist < 8 ? 0.75 : 0.30, 6);
      guides.stopBar.mat.color = dist < 5.2 ? MAT.guideOK.color : MAT.guideDir.color;
      guides.stopBar.mat.emissive = dist < 5.2 ? MAT.guideOK.emissive : MAT.guideDir.emissive;

      if (!p.stopped && !aligned) {
        const dirRight = off < 0;      /* 機体が左にずれていれば右へ寄せる */
        const a = dirRight ? guides.arrowR : guides.arrowL;
        const b = dirRight ? guides.arrowL : guides.arrowR;
        a.visible = true; b.visible = false;
        a.setPos(dirRight ? 4.2 : -4.2, 2.1, -7.5);
        a.setRot(0, 0, dirRight ? 0 : PI);
        const k = 1.15 + Math.sin(R.time * 6) * 0.10;
        a.setScale(k, k, k);
        pulseMat(a, 0.66, 7);
      } else {
        guides.arrowL.visible = guides.arrowR.visible = false;
      }

      /* センターラインのきらめき（そろっている合図） */
      if (aligned && !p.stopped) {
        for (let i = 0; i < 6; i++) {
          const z = STOP_Z - 3 - i * 5;
          R.addSprite([0, 0.06, z], 0.55, [0.2, 2.2, 0.8], 0.32 + Math.sin(R.time * 6 - i) * 0.16);
        }
      }

      /* 停止指示のヒント切替 */
      if (!p.stopped) {
        if (dist < 5.2) {
          hint('✋', 'いま！ ゆびを ながおしして とめて！');
          ghost('hold', 50, 74);
        } else if (dist < 16) {
          hint('🛬', 'まっすぐ たしかめて…');
          ghost('h', 50, 76);
        }
      }

      /* 停止演出後、次へ */
      if (p.stopped) {
        st.stopTime = st.stopTime || st.t;
        const el = st.t - st.stopTime;
        if (el > 1.2 && !st.stopMsg) {
          st.stopMsg = true;
          toast('ピタッ！');
          Au.chime();
          hint('👏', 'ぴったり とまった！');
          ghostOff();
        }
        if (el > 2.2) {
          if (st.freeMode) { freeMarshalEnd(); }
          else enter('chocks');
        }
      }
    },
  };

  function doStop() {
    const p = st.plane;
    if (p.stopped) return;
    p.stopped = true;
    st.stopTime = null; st.stopMsg = false;
    st.slowSignal = false;
    st.camShake = 1.0;
    p.pitchV = 0.055 * Math.max(0.6, p.v);   /* 前のめり */
    p.sink = 0.055;
    Au.squeal(0.9);
    Au.hiss();
    Au.engine(0.30, 0.62);
    setTimeout(() => { Au.engine(0.14, 0.5); }, 1400);
    st.taxiLights = false;
    /* タイヤの土煙 */
    for (const w of ac.userData.wheels) {
      worldOf(w, tmp);
      puff(tmp[0], 0.05, tmp[2], 7, { spd: 1.7, up: 0.5, life: 1.5, s0: 0.2, s1: 1.7, col: [0.66, 0.62, 0.56], a0: 0.4 });
    }
  }

  function freeMarshalEnd() {
    toast('もう いちど！');
    st.plane.z = -76;
    st.plane.x = (Math.random() < 0.5 ? -1 : 1) * (2.6 + Math.random() * 2.2);
    st.plane.stopped = false; st.plane.v = 0; st.plane.yaw = 0;
    st.stopSignal = false; st.stopHold = 0; st.autoStopT = 0;
    st.stopTime = null; st.stopMsg = false;
    st.taxiLights = true;
    st.t = 0;
  }

  /* ---------- 2. 輪止め ---------- */
  PH.chocks = {
    enter() {
      setSteps(1);
      const mgz = st.plane.z + ac.userData.MG_Z;
      const wx = -4.25;
      setCam([-9.2, 1.62, mgz - 4.6], [-4.35, 0.62, mgz - 0.3], false, 1.8);
      st.beaconOn = true;
      const targets = [[wx, 0, mgz + 0.86], [wx, 0, mgz - 0.86]];
      const starts = [[-7.5, 0, mgz - 1.5], [-6.1, 0, mgz - 3.3]];
      const items = [];
      for (let i = 0; i < 2; i++) {
        const c = chocks[i];
        c.visible = true;
        c.setPos(starts[i][0], 0, starts[i][2]);
        c.setRot(0, i === 0 ? PI : 0, 0);
        items.push({
          obj: c, to: targets[i], snap: 0.85, rot: [0, i === 0 ? PI : 0, 0],
          onSnap: (it) => {
            Au.thunk();
            st.camShake = 0.55;
            puff(it.to[0], 0.05, it.to[2], 8, { spd: 1.3, up: 0.5, life: 1.0, s0: 0.12, s1: 0.9, col: [0.68, 0.64, 0.58], a0: 0.5 });
            sparkle(it.to[0], 0.4, it.to[2], 10);
            toast('カコン！');
            if (drag.done >= 2) {
              setTimeout(() => { Au.chime(); }, 350);
            }
          },
        });
      }
      setDrag(items);
      guides.ringA.visible = guides.ringB.visible = true;
      guides.ringA.setPos(targets[0][0], 0.04, targets[0][2]);
      guides.ringB.setPos(targets[1][0], 0.04, targets[1][2]);
      hint('🧱', 'わどめを タイヤの まえと うしろへ');
      ghost('drag', 30, 70);
    },
    update(dt) {
      updateDrag(dt);
      if (st.idle > IDLE_HELP) autoFinishDrag(dt, 0.5);
      guides.ringA.visible = !drag.items[0].done;
      guides.ringB.visible = !drag.items[1].done;
      pulseMat(guides.ringA, 0.55, 5.5);
      pulseMat(guides.ringB, 0.55, 5.5);
      for (const it of drag.items) {
        if (!it.done) R.addSprite([it.to[0], 0.35, it.to[2]], 0.3, [0.4, 2.2, 1.0], 0.28 + Math.sin(R.time * 5) * 0.12);
      }
      Au.engine(0.10, 0.5);
      if (drag.done >= 2) {
        st.sub += dt;
        ghostOff();
        hint('👏', 'これで ひこうきは うごかない！');
        if (st.sub > 1.3) enter('bridge');
      }
      updateMarshal(dt, 'idle', 0, false);
      applyPlane();
    },
  };

  /* ---------- 3. ボーディングブリッジ ---------- */
  function applyBridge(ext) {
    const U = bridge.userData;
    const IX0 = 1.0, IX1 = 16.85;
    const bell = 0.15 + M.smooth(sat((ext - 0.78) / 0.22)) * 1.75;
    const ix = lerp(IX0, IX1, ext);
    U.inner.p[0] = ix;
    U.cab.p[0] = ix + 20.0;
    U.column.p[0] = ix + 21.3;
    const NB = U.bellowFrames.length;
    for (let i = 0; i < NB; i++) {
      U.bellowFrames[i].p[0] = 3.2 + (i / (NB - 1)) * bell;
    }
    U.bumper.p[0] = 3.2 + bell + 0.06;
    for (const w of U.bogieWheels) w.r[0] = ext * 16.4 / 0.52;
    U.ext = ext;
    U.bumperWorldX = BRIDGE_X + ix + 20.0 + 3.2 + bell;
  }

  PH.bridge = {
    enter() {
      setSteps(2);
      setCam([-28.5, 8.0, 9.0], [-12.5, 4.3, -12.5], false, 1.6);
      hint('🌉', 'ゆびを よこに うごかして ブリッジを のばそう');
      ghost('h', 48, 72);
      st.bridgeExt = 0; st.bridgeV = 0; st.bridgeGoal = 0; st.bridgeDocked = false;
      applyBridge(0);
    },
    update(dt) {
      const U = bridge.userData;
      localToWorld(ac, ac.userData.doorL1, tmp);
      const doorX = tmp[0];
      /* 伸ばす方向の画面上の向きを求め、指の動きを合わせる */
      const bumperW = [U.bumperWorldX, U.cy + 0.1, -13.9];
      const dir = screenDir(bumperW, [1, 0, 0]);

      if (!st.bridgeDocked) {
        /* 一振りで大きく動かし、離しても慣性で伸び続ける（断続的な入力でも積み上がる） */
        /* 一振りごとに「ここまで伸ばす」量を積み、機械はゆっくり追いかける。
           断続的な入力でも必ず積み上がり、動きは常にゆっくりのまま。 */
        const w = R.canvas.clientWidth;
        if (In.down) {
          const along = In.dx * dir[0] + In.dy * dir[1];
          if (along > 0) st.bridgeGoal = Math.min(1, (st.bridgeGoal || 0) + along / (w * 0.75));
        }
        if (st.idle > IDLE_HELP) st.bridgeGoal = Math.min(1, (st.bridgeGoal || 0) + dt * 0.13);
        let spd = Math.min(0.34, Math.max(0, (st.bridgeGoal || 0) - st.bridgeExt) * 3.2);
        st.bridgeV = spd;
        /* ドアに近づくと自動減速 */
        const gap = U.bumperWorldX - (doorX - 0.06);
        if (gap < 2.2 && spd > 0) spd *= clamp(gap / 2.2, 0.22, 1);
        st.bridgeExt = clamp(st.bridgeExt + spd * dt, 0, 1);
        applyBridge(st.bridgeExt);

        const mv = Math.abs(spd);
        Au.bridge(clamp(mv * 4.0, 0, 1), 0.78 + clamp(mv * 2.4, 0, 1.4) * 0.30);

        const gap2 = U.bumperWorldX - (doorX - 0.06);
        if (gap2 < 0.28 && st.bridgeExt > 0.80) dock();
        if (st.bridgeExt > 0.985) dock();

        if (!st.bridgeDocked && st.bridgeExt > 0.70) hint('🎯', 'ドアの まえで そっと…');
      } else {
        Au.bridge(0, 1);
        st.sub += dt;
        if (st.sub > 1.7) enter('ground');
      }

      /* 目標リング */
      if (!st.bridgeDocked) {
        localToWorld(ac, ac.userData.doorL1, tmp);
        guides.target.visible = true;
        guides.target.setPos(tmp[0] - 0.15, tmp[1], tmp[2]);
        guides.target.setRot(0, 0, PI / 2);
        guides.target.setScale(2.4, 1, 2.2);
        pulseMat(guides.target, 0.5, 5);
        R.addSprite([tmp[0] - 0.3, tmp[1], tmp[2]], 1.0, [0.3, 2.0, 0.9], 0.25 + Math.sin(R.time * 5) * 0.12);
      } else guides.target.visible = false;

      /* ブリッジの作業灯 */
      R.addSprite([U.bumperWorldX - 1.2, U.cy + 1.7, -13.9], 0.5, [1.8, 1.7, 1.4], 0.35);

      Au.engine(0.08, 0.5);
      updateMarshal(dt, 'idle', 0, false);
      applyPlane();
    },
  };

  function dock() {
    if (st.bridgeDocked) return;
    st.bridgeDocked = true;
    st.bridgeExt = 1; applyBridge(1);
    st.sub = 0;
    st.camShake = 0.4;
    Au.dock();
    setTimeout(() => Au.chime(), 500);
    toast('コトン！');
    if (st.paxHole) st.paxHole.visible = true;
    hint('🚶', 'おきゃくさんが のれるよ！');
    ghostOff();
    const U = bridge.userData;
    puff(U.bumperWorldX - 0.3, U.cy + 0.1, -13.9, 8, { spd: 0.5, up: 0.2, life: 0.9, s0: 0.1, s1: 0.6, col: [0.7, 0.7, 0.7], a0: 0.3 });
    sparkle(U.bumperWorldX - 0.4, U.cy + 0.2, -13.9, 14);
  }

  /* ---------- 4. 地上作業 ---------- */
  PH.ground = {
    enter() {
      setSteps(3);
      st.sub = 0;
      groundTask(0);
    },
    update(dt) {
      GT[st.gTask] && GT[st.gTask](dt);
      updateMarshal(dt, 'idle', 0, false);
      applyPlane();
      Au.engine(0.06, 0.5);
    },
  };

  function groundTask(i) {
    st.gTask = i; st.sub = 0;
    drag.items = []; drag.active = null;
    guides.target.visible = false;
    gauge(-1);
    if (i === 0) {   /* 地上電源 */
      localToWorld(ac, ac.userData.gpuPort, tmp);
      const port = [tmp[0], tmp[1], tmp[2]];
      setCam([-7.8, 2.30, 1.2], [-1.5, 1.90, -11.0], false, 1.7);
      plug.visible = true; cable.visible = true;
      const reel = [gpu.p[0] + 0.75, 1.62, gpu.p[2] + 0.55];
      st.reel = reel;
      plug.setPos(reel[0] + 1.8, port[1], reel[2] - 1.6);
      plug.setRot(0, 0.4, 0);
      setDrag([{
        obj: plug, to: [port[0] - 0.05, port[1], port[2]], snap: 0.85, rot: [0, PI / 2, 0],
        onSnap: () => {
          Au.click(); Au.latch();
          st.lightsOn = true;
          toast('カチッ！');
          sparkle(port[0], port[1], port[2], 14);
          setTimeout(() => Au.chime(), 250);
          hint('💡', 'ひこうきに でんきが ついた！');
          st.sub = 0;
        },
      }]);
      hint('🔌', 'でんげんプラグを きたいへ さしこもう');
      ghost('drag', 34, 62);
    } else if (i === 1) {   /* 給油 */
      localToWorld(ac, ac.userData.fuelPort, tmp);
      const port = [tmp[0], tmp[1], tmp[2]];
      st.fuelPort = port;
      fueler.setPos(port[0] + 5.4, 0, port[2] - 1.6);
      fueler.setRot(0, PI, 0);
      setCam([port[0] + 7.6, 2.9, port[2] + 6.6], [port[0] + 1.2, 1.8, port[2] - 0.8], false, 1.7);
      nozzle.visible = true; hose.visible = true;
      const reel = [fueler.p[0] - 1.0, 1.86, fueler.p[2] - 0.72];
      st.reel = reel;
      nozzle.setPos(reel[0] - 1.5, port[1], reel[2] + 2.0);
      nozzle.setRot(0, -0.5, 0);
      setDrag([{
        obj: nozzle, to: [port[0] + 0.30, port[1], port[2]], snap: 0.9, rot: [0, -PI / 2, 0],
        onSnap: () => {
          Au.latch(); toast('ガチャン！');
          hint('⛽', 'ゆびを ながおしして きゅうゆ！');
          ghost('hold', 52, 68);
          st.sub = 0;
        },
      }]);
      hint('⛽', 'きゅうゆホースを つばさへ はこぼう');
      ghost('drag', 30, 64);
    } else {   /* 貨物 */
      setSteps(3);
      localToWorld(ac, ac.userData.cargoR, tmp);
      const door = [tmp[0], tmp[1], tmp[2]];
      st.cargoDoor = door;
      /* ブーム先端がドアに届く停車位置 */
      st.loaderGoal = door[0] + 0.45 - 1.6 + 6.6;
      loader.setPos(st.loaderGoal + 9, 0, door[2]); loader.setRot(0, PI, 0);
      st.loaderX = st.loaderGoal + 9;
      st.boom = -0.12; st.cargoDone = 0;
      dolly.setPos(door[0] + 9.0, 0, door[2] + 3.0);
      dolly.setRot(0, PI / 2, 0);
      setCam([door[0] + 7.4, 3.5, door[2] + 12.2], [door[0] + 3.4, 2.0, door[2] - 0.8], false, 1.6);
      for (const b of bags) b.visible = false;
      hint('🚚', 'ベルトローダーが きたよ');
      ghostOff();
    }
  }

  const GT = {};
  /* 地上電源 */
  GT[0] = function (dt) {
    updateDrag(dt);
    if (st.idle > IDLE_HELP) autoFinishDrag(dt, 0.5);
    const reel = st.reel;
    worldOf(plug, tmp);
    updateCable(cable, cableMesh, reel, [tmp[0], tmp[1] + 0.05, tmp[2] + 0.1], 0.075);
    if (drag.items[0] && drag.items[0].done) {
      st.sub += dt;
      guides.target.visible = false;
      if (st.sub > 1.5) groundTask(1);
    } else {
      const to = drag.items[0].to;
      guides.target.visible = true;
      guides.target.setPos(to[0], to[1], to[2]);
      guides.target.setRot(0, 0, PI / 2);
      guides.target.setScale(1.0, 1, 0.9);
      pulseMat(guides.target, 0.5, 5.5);
      R.addSprite(to, 0.6, [0.3, 2.0, 0.9], 0.3 + Math.sin(R.time * 5) * 0.14);
    }
  };
  /* 給油 */
  GT[1] = function (dt) {
    updateDrag(dt);
    if (st.idle > IDLE_HELP) autoFinishDrag(dt, 0.5);
    const reel = st.reel;
    worldOf(nozzle, tmp);
    updateCable(hose, hoseMesh, reel, [tmp[0], tmp[1], tmp[2] - 0.2], 0.085);
    const it = drag.items[0];
    if (!it.done) {
      guides.target.visible = true;
      guides.target.setPos(it.to[0], it.to[1], it.to[2]);
      guides.target.setRot(0, 0, PI / 2);
      guides.target.setScale(1.0, 1, 0.9);
      pulseMat(guides.target, 0.5, 5.5);
      R.addSprite(it.to, 0.6, [0.3, 2.0, 0.9], 0.3 + Math.sin(R.time * 5) * 0.14);
      return;
    }
    guides.target.visible = false;
    gauge(st.fuel, '⛽');
    if (st.fuel < 1) {
      if (In.down) {
        st.fuel = sat(st.fuel + dt * 0.34);
        Au.pump(1);
        if (Math.random() < dt * 8) {
          R.addSprite([st.fuelPort[0] + 0.4, st.fuelPort[1] + 0.1, st.fuelPort[2]], 0.3, [1.4, 1.3, 0.7], 0.3);
        }
      } else if (st.idle > IDLE_HELP) {
        st.fuel = sat(st.fuel + dt * 0.30);
        Au.pump(1);
      } else {
        Au.pump(0);
      }
      if (st.fuel >= 1) {
        Au.pump(0); Au.chime();
        toast('まんタン！');
        hint('👍', 'ねんりょう まんタン！');
        ghostOff();
        st.sub = 0;
      }
    } else {
      st.sub += dt;
      if (st.sub > 1.4) groundTask(2);
    }
  };
  /* 貨物 */
  GT[2] = function (dt) {
    const U = loader.userData;
    const door = st.cargoDoor;
    const hingeX = () => loader.p[0] + 1.6;
    const tipPos = () => [hingeX() - U.boomLen * Math.cos(st.boom), 1.30 + U.boomLen * Math.sin(st.boom), door[2]];

    if (st.cargoDone === 0) {
      /* ローダーが自動で所定位置へ */
      st.loaderX = damp(st.loaderX, st.loaderGoal, 3.0, dt);
      loader.p[0] = st.loaderX;
      for (const w of U.wheels) w.r[0] -= dt * 2.2;
      Au.diesel(clamp((st.loaderX - st.loaderGoal) * 0.4, 0, 1), 0.85);
      if (st.loaderX < st.loaderGoal + 0.6) {
        st.cargoDone = 1; st.sub = 0;
        Au.diesel(0, 1);
        hint('⬆️', 'ゆびを たてに うごかして ベルトを あげよう');
        ghost('v', 62, 56);
      }
      U.boom.r[2] = st.boom;
      return;
    }

    if (st.cargoDone === 1) {
      /* ブームの俯仰 */
      const dir = screenDir(tipPos(), [0, 1, 0]);
      let input = 0;
      if (In.down) input = (In.dx * dir[0] + In.dy * dir[1]);
      const h = R.canvas.clientHeight;
      st.boom = clamp(st.boom + (input / (h * 2.2)) * 0.55, -0.14, 0.16);
      U.boom.r[2] = st.boom;
      Au.bridge(In.down && Math.abs(input) > 0.6 ? 0.5 : 0, 0.6);

      const goalY = door[1] - 0.10;
      /* 放置されたら自動で高さを合わせる */
      if (st.idle > IDLE_HELP) {
        const want = Math.asin(clamp((goalY - 1.30) / U.boomLen, -1, 1));
        st.boom = M.moveTo(st.boom, want, dt * 0.10);
        U.boom.r[2] = st.boom;
      }
      guides.target.visible = true;
      guides.target.setPos(door[0] + 0.75, goalY, door[2]);
      guides.target.setRot(0, 0, PI / 2);
      guides.target.setScale(1.4, 1, 1.2);
      pulseMat(guides.target, 0.5, 5.5);
      const tip = tipPos();
      R.addSprite(tip, 0.35, [1.6, 1.5, 0.6], 0.35);
      if (Math.abs(tip[1] - goalY) < 0.45) {
        st.cargoDone = 2; st.sub = 0;
        Au.bridge(0, 1); Au.latch();
        toast('ぴったり！');
        guides.target.visible = false;
        if (st.cargoHole) st.cargoHole.visible = true;
        hint('🧳', 'にもつを ベルトに のせよう');
        ghost('drag', 70, 62);
        const items = [];
        for (let i = 0; i < 2; i++) {
          const b = bags[i];
          b.visible = true;
          b.setPos(door[0] + 9.0, 0.98, door[2] + 3.9 - i * 0.95);
          b.setRot(0, PI / 2 + 0.06 * i, 0);
          items.push({
            obj: b, to: [hingeX() - 0.9, 1.16, door[2]], snap: 1.5, rot: [0, PI / 2, 0],
            onSnap: (it) => {
              Au.thunk();
              it.ride = 0;
              toast('どうぞ！');
              if (drag.done >= 2) setTimeout(() => Au.chime(), 400);
            },
          });
        }
        setDrag(items);
      }
      return;
    }

    /* 荷物をベルトへ */
    updateDrag(dt);
    if (st.idle > IDLE_HELP) autoFinishDrag(dt, 0.6);
    let riding = 0;
    for (const it of drag.items) {
      if (!it.done) continue;
      it.ride = (it.ride || 0) + dt * 0.34;
      const t = sat(it.ride);
      if (t < 1) riding++;
      const e = M.smooth(t);
      it.obj.p[0] = lerp(hingeX() - 0.9, hingeX() - U.boomLen * Math.cos(st.boom) + 0.2, e);
      it.obj.p[1] = lerp(1.16, 1.30 + U.boomLen * Math.sin(st.boom) + 0.24, e);
      it.obj.p[2] = door[2];
      it.obj.r[1] = PI / 2;
      if (t > 0.97) it.obj.visible = false;
    }
    U.beltMat.uvOff[1] = (U.beltMat.uvOff[1] - dt * 0.55) % 1;
    Au.belt(riding > 0 || (drag.done >= 2 && st.sub < 2.5) ? 1 : 0, 1);
    if (drag.done >= 2) {
      st.sub += dt;
      hint('👏', 'にもつ ぜんぶ のせた！');
      ghostOff();
      if (st.sub > 2.0) { Au.belt(0, 1); enter('pushback'); }
    }
  };

  /* ---------- 5. プッシュバック ---------- */
  PH.pushback = {
    enter() {
      setSteps(4);
      setCam([9.6, 3.1, 10.5], [-0.6, 3.9, -17.0], false, 1.5);
      st.push = 0; st.pushV = 0; st.pushGoal = 0; st.pushStage = 0;
      st.lightsOn = true; st.beaconOn = true;
      st.bridgeRetract = st.bridgeExt;   /* ブリッジを引き離す */
      /* トラクターを機首前方へ */
      tractor.setPos(10.8, 0, -2.4);
      tractor.setRot(0, PI * 0.15, 0);
      tractor.userData.bar.visible = true;
      /* 作業を終えた車両は退去、ケーブル類も外す */
      plug.visible = false; cable.visible = false;
      nozzle.visible = false; hose.visible = false;
      loader.setPos(30, 0, -8); dolly.setPos(34, 0, -6);
      fueler.setPos(28, 0, -34);
      if (st.cargoHole) st.cargoHole.visible = false;
      marshal.setPos(6.8, 0, 1.2);
      marshal.setRot(0, -1.35, 0);
      /* 輪止めを外す（自動） */
      for (const c of chocks) c.visible = false;
      hint('🚜', 'トラクターを ひこうきの まえあしへ');
      ghost('drag', 62, 66);
      localToWorld(ac, ac.userData.towPoint, tmp);
      const tow = [tmp[0], tmp[1], tmp[2]];
      st.towPoint = tow;
      setDrag([{
        obj: tractor, to: [tow[0], 0, tow[2] + 8.05], snap: 1.9, rot: [0, PI / 2, 0],
        onSnap: () => {
          Au.latch();
          toast('ガチャン！');
          st.camShake = 0.5;
          st.pushStage = 1; st.sub = 0;
          hint('👉', 'ゆっくり スワイプして おしていこう');
          ghost('v', 50, 62);
          sparkle(tow[0], 0.5, tow[2], 12);
        },
      }]);
    },
    update(dt) {
      const p = st.plane;
      /* ボーディングブリッジを離す */
      if (st.bridgeRetract > 0) {
        st.bridgeRetract = Math.max(0, st.bridgeRetract - dt * 0.34);
        st.bridgeExt = st.bridgeRetract;
        applyBridge(st.bridgeExt);
        Au.bridge(0.5, 0.7);
        if (st.bridgeRetract <= 0) Au.bridge(0, 1);
      }
      if (st.pushStage === 0) {
        tractor.r[1] = damp(tractor.r[1], PI / 2, 3, dt);
        updateDrag(dt);
        if (st.idle > IDLE_HELP) autoFinishDrag(dt, 0.45);
        for (const w of tractor.userData.wheels) w.r[0] -= dt * 1.2;
        Au.diesel(0.55, 0.8);
        guides.target.visible = true;
        guides.target.setPos(st.towPoint[0], 0.05, st.towPoint[2] + 8.05);
        guides.target.setScale(2.0, 1, 2.0);
        pulseMat(guides.target, 0.55, 5.5);
        applyPlane();
        updateMarshal(dt, 'idle', 0, false);
        return;
      }
      guides.target.visible = false;

      if (st.pushStage === 1) {
        /* 押し戻す方向（機体後方）の画面上の向き */
        const back = [-Math.sin(p.yaw), 0, -Math.cos(p.yaw)];
        localToWorld(ac, [0, 3, -18], tmp);
        const dir = screenDir(tmp, back);
        const h = R.canvas.clientHeight;
        if (In.down) {
          /* 機体が下がる向きへのスワイプ、または単純な上方向スワイプのどちらでも押せる */
          const along = Math.max(In.dx * dir[0] + In.dy * dir[1], -In.dy * 0.8);
          if (along > 0) st.pushGoal = Math.min(PUSH_MAX, (st.pushGoal || 0) + (along / (h * 0.22)) * 2.4);
        }
        if (st.idle > IDLE_HELP) st.pushGoal = Math.min(PUSH_MAX, (st.pushGoal || 0) + dt * 1.6);
        /* 巨大な質量: 目標まで 1.1m/s 上限でゆっくり動き続ける */
        st.pushV = damp(st.pushV, Math.min(1.1, Math.max(0, (st.pushGoal || 0) - st.push) * 1.6), 3.0, dt);
        const step = st.pushV * dt;
        if (step > 0.0002) {
          st.push += step;
          /* 後退しながら、ゆっくり機首を誘導路方向へ振る */
          const turnRate = 1.30 / PUSH_MAX;
          p.yaw += turnRate * step;
          p.x -= Math.sin(p.yaw) * step;
          p.z -= Math.cos(p.yaw) * step;
          p.wheel -= step / 0.62;
        }
        /* トラクターは機首に追従 */
        localToWorld(ac, ac.userData.towPoint, tmp);
        tractor.p[0] = tmp[0] + Math.sin(p.yaw) * 8.05;
        tractor.p[2] = tmp[2] + Math.cos(p.yaw) * 8.05;
        tractor.r[1] = PI / 2 + p.yaw;
        for (const w of tractor.userData.wheels) w.r[0] -= step / 0.56;
        tractor.userData.barWheel.r[0] -= step / 0.20;

        const mv = clamp(st.pushV / 1.6, 0, 1);
        Au.diesel(0.45 + mv * 0.55, 0.72 + mv * 0.45);
        Au.engine(0.05, 0.5);
        st.camShake = Math.max(st.camShake, mv * 0.16);
        if (mv > 0.15 && Math.random() < dt * 20) {
          for (const w of ac.userData.wheels) {
            if (Math.random() < 0.3) {
              worldOf(w, tmp);
              puff(tmp[0], 0.04, tmp[2], 1, { spd: 0.7, up: 0.25, life: 1.5, s0: 0.15, s1: 1.1, col: [0.66, 0.62, 0.56], a0: 0.20 });
            }
          }
        }

        /* 機体が遠ざかりすぎないよう、カメラを少しだけ追従させる */
        localToWorld(ac, [0, 3.2, -11], tmp2);
        camGoalT[0] = damp(camGoalT[0], tmp2[0], 1.0, dt);
        camGoalT[2] = damp(camGoalT[2], tmp2[2], 1.0, dt);
        camGoalP[0] = damp(camGoalP[0], tmp2[0] + 9.0, 0.55, dt);
        camGoalP[2] = damp(camGoalP[2], tmp2[2] + 25.0, 0.55, dt);

        if (st.push < PUSH_MAX * 0.25 && st.push > 0.4) hint('👏', 'おおきな ひこうきが うごいた！');
        else if (st.push > PUSH_MAX * 0.55) hint('🚜', 'もう すこし！');

        if (st.push >= PUSH_MAX) {
          st.pushStage = 2; st.sub = 0;
          Au.diesel(0.25, 0.6);
          hint('🔓', 'トーバーを はずそう');
          ghostOff();
          st.disconnectCb = () => {
            st.disconnectCb = null;
            st.pushStage = 3; st.sub = 0;
            Au.latch();
            toast('はずれた！');
            tractor.userData.bar.visible = false;
            /* マーシャラーが見送り位置へ */
            localToWorld(ac, [10.5, 0, 5.0], tmp);
            marshal.setPos(tmp[0], 0, tmp[2]);
            marshal.r[1] = st.plane.yaw - PI / 2;
            hint('👋', 'マーシャラーが おみおくり');
          };
          showAction('🔓', 'きりはなす', st.disconnectCb);
        }
      } else if (st.pushStage === 2) {
        Au.diesel(0.25, 0.6);
        if (st.idle > IDLE_HELP + 2 && st.disconnectCb) { const cb = st.disconnectCb; st.disconnectCb = null; hideAction(); cb(); }
      } else if (st.pushStage === 3) {
        /* トラクター退出 */
        st.sub += dt;
        tractor.p[0] += dt * 4.2;
        tractor.p[2] += dt * 1.4;
        tractor.r[1] = damp(tractor.r[1], PI * 0.12, 1.5, dt);
        for (const w of tractor.userData.wheels) w.r[0] -= dt * 7;
        Au.diesel(clamp(0.6 - st.sub * 0.1, 0, 1), 0.9);
        if (st.sub > 2.0) { enter('depart'); }
      }
      /* 回転灯 */
      worldOf(tractor.userData.beacon, tmp);
      const bf = (R.time % 0.9) < 0.16;
      if (bf) R.addSprite(tmp, 1.1, [3.0, 1.6, 0.2], 0.8);
      applyPlane();
      updateMarshal(dt, st.pushStage >= 2 ? 'salute' : 'idle', 0, false);
    },
  };

  /* ---------- 6. 出発 ---------- */
  PH.depart = {
    enter() {
      setSteps(-1);
      hint('✈️', 'いってらっしゃい！');
      ghostOff();
      st.taxiLights = true; st.lightsOn = true;
      st.departV = 0;
      Au.engine(0.4, 0.8);
      localToWorld(ac, [10.5, 0, 5.0], tmp);
      marshal.setPos(tmp[0], 0, tmp[2]);
      marshal.r[1] = st.plane.yaw - PI / 2;
      localToWorld(ac, [17, 5.2, 10], tmp);
      localToWorld(ac, [0, 4.2, -14], tmp2);
      setCam([tmp[0], tmp[1], tmp[2]], [tmp2[0], tmp2[1], tmp2[2]], false, 1.2);
    },
    update(dt) {
      const p = st.plane;
      st.sub += dt;
      st.departV = damp(st.departV, st.sub > 0.8 ? 10.5 : 0, 0.8, dt);
      planeMove(st.departV * dt);
      st.engineSpin += dt * (6 + st.departV * 2.5);
      Au.engine(clamp(0.5 + st.departV * 0.09, 0, 1.4), 0.85 + clamp(st.departV * 0.04, 0, 0.5));
      /* ジェットブラスト */
      if (Math.random() < dt * 40 && st.departV > 1) {
        localToWorld(ac, [4.6 * (Math.random() < 0.5 ? 1 : -1), 0.9, -17.5], tmp);
        puff(tmp[0], tmp[1], tmp[2], 1, { spd: 2.0, up: 0.5, life: 1.8, s0: 0.5, s1: 4.0, col: [0.6, 0.57, 0.53], a0: 0.14, g: 0.15 });
      }
      applyPlane();
      updateMarshal(dt, 'salute', 0, false);
      /* カメラは緩やかに見送る */
      localToWorld(ac, [0, 4.0, -14], tmp2);
      camGoalT[0] = damp(camGoalT[0], tmp2[0], 0.7, dt);
      camGoalT[2] = damp(camGoalT[2], tmp2[2], 0.7, dt);
      camGoalP[1] = 5.6;
      if (st.sub > 2.2 && !st.departMsg) { st.departMsg = true; toast('いってらっしゃい！'); Au.fanfare(); }
      if (st.sub > 6.2) enter('end');
    },
  };

  /* ---------- 終了メニュー ---------- */
  PH.end = {
    enter() {
      setSteps(-1);
      hintOff(); ghostOff();
      st.departMsg = false;
      setCam([16, 9, 26], [-6, 5, -20], false, 0.9);
      Au.engine(0.16, 0.7);
      showMenu('また あそぼう！', '',
        [['🛬', 'つぎの ひこうき', () => { st.freeMode = false; setLivery(st.liveryIdx + 1); resetScene(); enter('marshal'); }],
        ['🔁', 'おなじ ひこうきで もういちど', () => { st.freeMode = false; resetScene(); enter('marshal'); }],
        ['🎏', 'マーシャリングだけ', () => { st.freeMode = true; resetScene(); enter('marshal'); }]]);
    },
    update(dt) {
      const p = st.plane;
      planeMove(9.5 * dt);
      st.engineSpin += dt * 10;
      applyPlane();
      camGoalP[0] = 16 + Math.sin(R.time * 0.12) * 4;
    },
  };

  /* 自由マーシャリング中の「もどる」ボタン */
  function freeBackButton() {
    if (st.freeMode && st.phase === 'marshal' && !D.action.classList.contains('on')) {
      showAction('🏠', 'もどる', () => { st.freeMode = false; enter('title'); });
    }
  }

  /* 目標マーカーと「なぞる指」を、実際の目標の画面位置に合わせる */
  function updateAim(dt) {
    R.updateCamera();          /* 1フレーム前の行列で投影しないよう最新化 */
    const it = drag.items.find((x) => !x.done);
    if (!it || st.phase === 'title' || st.phase === 'end') { aimOff(); return; }
    R.project(it.to, sp2);
    if (sp2[2] <= 0) { aimOff(); return; }
    aimAt(sp2[0], sp2[1]);
    if (!drag.active) {
      R.project(worldOf(it.obj, tmp), sp);
      if (sp[2] > 0) ghostPath(dt, sp[0], sp[1], sp2[0], sp2[1]);
    } else {
      D.ghost.classList.remove('on');
    }
  }

  /* ===================== メインループ ===================== */
  let last = 0, acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const t = now * 0.001;
    let dt = last ? t - last : 0.016;
    last = t;
    if (dt > 0.06) dt = 0.06;

    inputFrame(dt);
    if (In.down) st.idle = 0; else st.idle += dt;
    world.updateWorld(null);

    const ph = PH[st.phase];
    if (ph && ph.update) { st.t += dt; ph.update(dt); }

    if (st.freeMode && st.phase === 'marshal') freeBackButton();

    updateCam(dt);
    updateAim(dt);
    planeLights(dt);
    updateParts(dt, R);

    /* 遠方の駐機機体もビーコンを光らせる */
    for (const f of farPlanes) {
      if ((R.time + f.p[2] * 0.01) % 1.4 < 0.1) {
        R.addSprite([f.p[0], 5.4, f.p[2] - 12], 0.9, [2.4, 0.2, 0.15], 0.55);
      }
    }

    R.render(world, dt);
    inputEnd();
  }

  /* ===================== 起動 ===================== */
  AG.dbg = {
    st, enter, setCam, drag, In, groundTask,
    snapCam() { camSnap = true; },
    get R() { return R; }, get world() { return world; }, get ac() { return ac; },
    /* テスト用: 現在のドラッグ対象と目標の画面座標 */
    dragPoints() {
      return drag.items.filter((it) => !it.done).map((it) => {
        const a = R.project(worldOf(it.obj, [0, 0, 0]), [0, 0, 0]);
        const b2 = R.project(it.to, [0, 0, 0]);
        return { from: [Math.round(a[0]), Math.round(a[1])], to: [Math.round(b2[0]), Math.round(b2[1])] };
      });
    },
  };

  function boot() {
    initDom();
    const canvas = $('gl');
    try {
      R = new AG.Renderer(canvas);
    } catch (e) {
      const el = $('err');
      el.style.display = 'flex';
      el.textContent = 'この ブラウザでは WebGL が つかえません。Safari や Chrome の さいしんばんで ひらいてください。';
      $('loading').classList.add('off');
      console.error(e);
      return;
    }
    R.resize();
    initInput(canvas);

    /* 夕方前のやわらかい斜光 */
    R.sunDir = M.vnorm([0, 0, 0], [-0.52, 0.36, 0.58]);
    R.sunCol = [2.05, 1.76, 1.34];
    R.skyCol = [0.19, 0.27, 0.44];
    R.gndCol = [0.15, 0.13, 0.11];
    R.fogCol = [0.46, 0.57, 0.74];
    R.fogCol2 = [0.92, 0.80, 0.62];
    R.fogDens = 0.00105;
    R.zenith = [0.09, 0.24, 0.60];
    R.horizon = [0.60, 0.71, 0.86];

    setTimeout(() => {
      buildWorld();
      applyBridge(0);
      enter('title');
      $('loading').classList.add('off');
      requestAnimationFrame(frame);
    }, 30);

    window.addEventListener('resize', () => R.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => R.resize(), 250));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) Au.stopAll(); else last = 0;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.AG);
