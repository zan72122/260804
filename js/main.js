/* にじいろタウン - 起動・ループ・カメラ・入力 */
window.NT = window.NT || {};
(function () {
  const U = NT.U;

  const worldCv = document.getElementById('world');
  const inkCv = document.getElementById('ink');
  const wctx = worldCv.getContext('2d');
  const ictx = inkCv.getContext('2d');

  let W = 0, H = 0, DPR = 1;
  let state = 'title'; // title | town | make | after
  let t = 0;
  let lastFrame = performance.now();
  let afterT = 0;
  let tutorialActive = false;

  /* ---------- カメラ ---------- */
  const cam = { x: 1000, y: 800, s: 0.5 };
  let camFrom = null, camTo = null, camT = 0, camDur = 0.9;

  function camTween(target, dur) {
    camFrom = { x: cam.x, y: cam.y, s: cam.s };
    camTo = target;
    camT = 0;
    camDur = dur || 0.9;
  }
  function camUpdate(dt) {
    if (!camTo) return;
    camT += dt;
    const k = U.easeInOutCubic(Math.min(1, camT / camDur));
    cam.x = U.lerp(camFrom.x, camTo.x, k);
    cam.y = U.lerp(camFrom.y, camTo.y, k);
    cam.s = U.lerp(camFrom.s, camTo.s, k);
    if (camT >= camDur) camTo = null;
  }

  function townCam() {
    const rect = { x: 40, y: 340, w: 1920, h: 850 };
    const s = Math.min(W / rect.w, H / rect.h) * 0.98;
    const cy = H > W
      ? rect.y + rect.h / 2
      : Math.max(rect.y + (H / s) / 2 - 40, rect.y + rect.h / 2 - 60);
    return { x: rect.x + rect.w / 2, y: cy, s };
  }

  function makeCam(site) {
    const r = site.viewRect;
    const portrait = H > W;
    // 縦：下部クレヨンバーの分を空ける／横：住民が見える右余白
    const s = portrait
      ? Math.min((W * 0.94) / r.w, (H * 0.66) / r.h)
      : Math.min((W * 0.66) / r.w, (H * 0.88) / r.h);
    let cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    if (portrait) cy += (H * 0.055) / s;
    else cx += (W * 0.12) / s;
    return { x: cx, y: cy, s };
  }

  function toWorld(sx, sy) {
    return { x: (sx - W / 2) / cam.s + cam.x, y: (sy - H / 2) / cam.s + cam.y };
  }
  function toScreen(wx, wy) {
    return { x: (wx - cam.x) * cam.s + W / 2, y: (wy - cam.y) * cam.s + H / 2 };
  }

  /* ---------- リサイズ ---------- */
  let dprCap = 2; // 低速端末では自動で下げる
  function resize() {
    DPR = Math.min(dprCap, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    for (const cv of [worldCv, inkCv]) {
      cv.width = Math.round(W * DPR);
      cv.height = Math.round(H * DPR);
    }
    ictx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // 現在のシーンに合わせてカメラを即再フィット
    if (state === 'town' || state === 'title' || state === 'after') {
      const c = townCam();
      if (!camTo) Object.assign(cam, c); else camTo = c;
    } else if (state === 'make') {
      const c = makeCam(NT.make.site);
      Object.assign(cam, c);
      camTo = null;
      NT.make.redrawInk(toScreen, cam);
    }
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));

  /* ---------- UI要素 ---------- */
  const elTitle = document.getElementById('title');
  const elBack = document.getElementById('btnBack');
  const elReset = document.getElementById('btnReset');
  const elConfirm = document.getElementById('confirmReset');
  const elDone = document.getElementById('doneBanner');
  const elHint = document.getElementById('hintHand');

  function setUI() {
    elBack.classList.toggle('hidden', !(state === 'make' && NT.make.state !== 'grow'));
    elReset.classList.toggle('hidden', state !== 'town');
  }

  elBack.addEventListener('pointerdown', ev => {
    ev.stopPropagation();
    if (state !== 'make' || NT.make.state === 'grow') return;
    NT.audio.init(); NT.audio.tap();
    NT.make.exit();
    state = 'town';
    camTween(townCam(), 0.8);
    setUI();
  });

  elReset.addEventListener('pointerdown', ev => {
    ev.stopPropagation();
    NT.audio.init(); NT.audio.tap();
    elConfirm.classList.remove('hidden');
  });
  document.getElementById('btnResetYes').addEventListener('pointerdown', ev => {
    ev.stopPropagation();
    NT.audio.tap();
    elConfirm.classList.add('hidden');
    NT.town.reset();
    startTutorialIfNeeded();
  });
  document.getElementById('btnResetNo').addEventListener('pointerdown', ev => {
    ev.stopPropagation();
    NT.audio.tap();
    elConfirm.classList.add('hidden');
  });

  /* ---------- チュートリアル ---------- */
  function startTutorialIfNeeded() {
    const hasAny = NT.town.works.garden || NT.town.works.house || NT.town.works.cake;
    if (NT.save.data.tutorialDone || hasAny) { tutorialActive = false; return; }
    tutorialActive = true;
    const guide = NT.town.residents[0];
    guide.scripted = true;
    guide.speed = 140;
    guide.goTo(1000, 985);
    NT.town.runScript([
      dt => !guide.moving,
      () => { guide.mood = 'trouble'; guide.moodT = 0; return true; },
      (function () { let e = 0; return dt => { e += dt; return e >= 0.5; }; })(),
      () => {
        if (tutorialActive && state === 'town') {
          NT.town.tutorialTarget = 'garden';
          elHint.classList.remove('hidden');
        }
        return true;
      }
    ]);
  }

  function positionHint() {
    if (!tutorialActive || state !== 'town') {
      elHint.classList.add('hidden');
      return;
    }
    if (elHint.classList.contains('hidden')) {
      if (NT.town.tutorialTarget) elHint.classList.remove('hidden');
      else return;
    }
    const s = NT.town.SITES.garden;
    const p = toScreen(s.hit.x, s.hit.y - 40);
    elHint.style.left = (p.x - 45) + 'px';
    elHint.style.top = (p.y - 30) + 'px';
  }

  /* ---------- シーン遷移 ---------- */
  function enterMake(siteId) {
    state = 'make';
    NT.make.enter(siteId);
    camTween(makeCam(NT.town.SITES[siteId]), 0.9);
    NT.town.summonWatcher(siteId);
    if (tutorialActive) {
      NT.town.tutorialTarget = null;
      elHint.classList.add('hidden');
      const guide = NT.town.residents[0];
      guide.mood = 'normal';
      guide.scripted = true;
      guide.goTo(640, 1100); // そばで見守る
    }
    setUI();
  }

  NT.make.onCommit = function (siteId, record) {
    NT.town.setArtwork(siteId, record);
    NT.make.exit();
    if (tutorialActive) {
      NT.save.setTutorialDone();
      tutorialActive = false;
      const guide = NT.town.residents[0];
      guide.scripted = false;
    }
    state = 'after';
    afterT = 0;
    elDone.classList.remove('hidden');
    camTween(townCam(), 1.1);
    setTimeout(() => NT.town.reaction(siteId), 500);
    setUI();
  };

  /* ---------- 入力 ---------- */
  let downPos = null;

  worldCv.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    NT.audio.init();
    const sx = ev.clientX, sy = ev.clientY;
    downPos = { sx, sy };

    if (state === 'title') {
      dismissTitle();
      return;
    }
    if (state === 'after') {
      finishAfter();
      return;
    }
    if (state === 'make') {
      const w = toWorld(sx, sy);
      NT.make.onDown(sx, sy, w.x, w.y, cam);
      if (NT.make.state === 'draw') {
        try { worldCv.setPointerCapture(ev.pointerId); } catch (e) {}
      }
    }
  }, { passive: false });

  worldCv.addEventListener('pointermove', ev => {
    if (state !== 'make') return;
    ev.preventDefault();
    const evs = [];
    if (ev.getCoalescedEvents) {
      for (const e of ev.getCoalescedEvents()) evs.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    }
    if (!evs.length) evs.push({ x: ev.clientX, y: ev.clientY, t: ev.timeStamp });
    NT.make.onMove(evs, cam, toWorld);
  }, { passive: false });

  function pointerEnd(ev) {
    if (state === 'make') {
      NT.make.onUp();
      setUI();
    } else if (state === 'town' && downPos) {
      const d = U.dist(downPos.sx, downPos.sy, ev.clientX, ev.clientY);
      if (d < 14) {
        const w = toWorld(ev.clientX, ev.clientY);
        const site = NT.town.siteAt(w.x, w.y);
        if (site) {
          NT.audio.tap();
          enterMake(site.id);
        }
      }
    }
    downPos = null;
  }
  worldCv.addEventListener('pointerup', pointerEnd);
  worldCv.addEventListener('pointercancel', () => {
    if (state === 'make') NT.make.onUp();
    downPos = null;
  });

  // iOSのダブルタップズーム等を抑止
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());

  function dismissTitle() {
    if (state !== 'title') return;
    state = 'town';
    elTitle.classList.add('fade');
    setTimeout(() => elTitle.classList.add('hidden'), 700);
    startTutorialIfNeeded();
    setUI();
  }

  function finishAfter() {
    if (state !== 'after') return;
    state = 'town';
    elDone.classList.add('hidden');
    setUI();
  }

  /* ---------- メインループ ---------- */
  let fpsAcc = 0, fpsN = 0, fpsDowngrades = 0;
  function watchFps(dt) {
    if (dt <= 0 || fpsDowngrades >= 2) return;
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 2.5) {
      const avg = fpsN / fpsAcc;
      fpsAcc = 0; fpsN = 0;
      // 描画中はキャンバスを作り直さない（線が消えるため）
      const ms = NT.make.state;
      if (avg < 40 && DPR > 1.01 && ms !== 'draw' && ms !== 'pon' && ms !== 'grow') {
        dprCap = Math.max(1, DPR - 0.5);
        fpsDowngrades++;
        resize();
      }
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    t += dt;
    watchFps(dt);

    camUpdate(dt);
    NT.town.update(dt, t, state === 'town' || state === 'after');
    NT.make.update(dt);
    NT.fx.update(dt);

    if (state === 'after') {
      afterT += dt;
      if (afterT > 3.0) finishAfter();
    }

    draw();
    positionHint();
    requestAnimationFrame(frame);
  }

  function applyCam(f) {
    // f: パララックス係数（1で通常）
    const cx = U.lerp(NT.town.WORLD.w / 2, cam.x, f);
    const cy = U.lerp(NT.town.WORLD.horizon, cam.y, f);
    wctx.setTransform(DPR * cam.s, 0, 0, DPR * cam.s,
      DPR * (W / 2 - cx * cam.s), DPR * (H / 2 - cy * cam.s));
  }

  function draw() {
    // 空（スクリーン空間）
    wctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    NT.town.drawSky(wctx, W, H, t);

    // 遠景（パララックス）
    applyCam(0.45);
    NT.town.drawFar(wctx, t);

    // ワールド
    applyCam(1);
    const opts = {};
    if (state === 'make' && (NT.make.state === 'choose' || NT.make.state === 'draw' || NT.make.state === 'pon' || NT.make.state === 'grow')) {
      opts.hideArt = NT.make.siteId;
    }
    NT.town.draw(wctx, t, opts);
    NT.make.drawWorld(wctx, t);
    NT.fx.draw(wctx);

    // スクリーンオーバーレイ
    wctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (state === 'make') NT.make.drawScreen(wctx, W, H, toScreen);
  }

  /* ---------- デバッグ／テスト用フック ---------- */
  NT.app = {
    get state() { return state; },
    get cam() { return cam; },
    toScreen, toWorld, enterMake,
    dismissTitle
  };

  /* ---------- 起動 ---------- */
  NT.save.load();
  NT.town.init(NT.save.data);
  NT.make.bindInk(ictx);
  resize();
  Object.assign(cam, townCam());
  setUI();

  // タイトルは短く：3.5秒で自動遷移（タップでも進む）
  elTitle.addEventListener('pointerdown', () => { NT.audio.init(); dismissTitle(); });
  setTimeout(dismissTitle, 3500);

  requestAnimationFrame(frame);
})();
