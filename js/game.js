/* =========================================================
   game.js — 進行と、いちばんの みせば（フィナーレ）
   ========================================================= */
(function (global) {
  'use strict';

  var G = {};
  var st = null;                 // Scene.state への参照
  var tw = new U.Tweener();
  var tl = new U.Timeline();
  var mode = 'title';            // title | prep | finale
  var step = -1;
  var theme = null;
  var shootTimer = 0;
  var yawSpeed = 0.9;
  var prepT = 0;
  var yawAuto = true;

  /* その星座の ほうを むく（yaw は 方位角 + 90°） */
  function lookAtFigure(i, dur) {
    var f = theme.figures[i];
    if (!f) return;
    var target = f.az + 90;
    while (target - st.camYaw > 180) target -= 360;
    while (target - st.camYaw < -180) target += 360;
    tw.to(st, 'camYaw', target, dur, U.easeInOutCubic);
    tw.to(st, 'camPitch', U.clamp(f.alt - 3, 40, 66), dur, U.easeInOutCubic);
    tw.to(st, 'fov', 74, dur, U.easeInOutCubic);
  }

  var HINTS = [
    { icon: '👆', text: 'レンズを くるくる' },
    { icon: '💿', text: 'すきな ディスクを さしこもう' },
    { icon: '🪐', text: 'まるを うごかして あわせよう' },
    { icon: '🔌', text: 'ケーブルを ちかづけよう' },
    { icon: '🎚️', text: 'レバーを したまで さげて！' }
  ];

  /* ---------------- 起動 ---------------- */
  G.init = function () {
    st = Scene.state;
    theme = THEMES[0];
    Scene.setTheme(theme);
    UI.setPanel(U.$('#panel'));

    /* タイトルは「よぞら」から始まる */
    st.dim = 1; st.roomLight = 0; st.starReveal = 0.62; st.starAlpha = 1;
    st.mw = 0.85; st.planetA = 0.7; st.moonA = 0;
    st.c0 = 0; st.c1 = 0; st.c2 = 0; st.c3 = 0;
    st.camPitch = 24; st.camYaw = 0; st.reflect = 0.5; st.projGlow = 0.5;
    st.camY = -6; st.camZ = 40; st.fov = 62;

    /* 常設のバインド（要素は使い回し） */
    UI.lens.bind();
    UI.lever.bind();

    U.$('#startBtn').addEventListener('click', G.start);
    U.$('#againBtn').addEventListener('click', function () { G.replay(false); });
    U.$('#themeBtn').addEventListener('click', function () { G.replay(true); });
  };

  /* ---------------- タイトル → 準備室 ---------------- */
  G.start = function () {
    if (mode !== 'title') return;
    if (global.Snd) { Snd.resume(); Snd.chime(523.25); Snd.whoosh(1.8); }
    mode = 'prep';
    U.$('#title').classList.add('gone');
    setTimeout(function () { U.hide(U.$('#title')); }, 750);

    tw.to(st, 'dim', 0, 2.2, U.easeInOutCubic);
    tw.to(st, 'roomLight', 1, 1.9, U.easeOutCubic, 0.25);
    tw.to(st, 'starAlpha', 0, 1.2, U.easeOutCubic);
    tw.to(st, 'mw', 0, 1.0, U.easeOutCubic);
    tw.to(st, 'planetA', 0, 0.9, U.easeOutCubic);
    tw.to(st, 'camPitch', 0, 2.6, U.easeInOutCubic);
    tw.to(st, 'camY', -10, 2.6, U.easeInOutCubic);
    tw.to(st, 'camZ', 82, 3.0, U.easeInOutCubic);
    tw.to(st, 'reflect', 0, 1.5, U.easeOutCubic);
    tw.to(st, 'projGlow', 0.14, 1.5, U.easeOutCubic);

    U.show(U.$('#lamps'));
    U.show(U.$('#panel'));
    U.$('#panel').classList.remove('fade');
    setTimeout(function () { goStep(0); }, 900);
  };

  /* ---------------- ステップ進行 ---------------- */
  function lamps() {
    U.$$('#lamps i').forEach(function (e, i) {
      e.classList.toggle('on', i < step);
      e.classList.toggle('cur', i === step);
    });
  }

  function setHint(i) {
    var h = U.$('#hint');
    if (i < 0) { U.hide(h); return; }
    U.show(h);
    h.classList.remove('out');
    U.$('#hintIcon').textContent = HINTS[i].icon;
    U.$('#hintText').textContent = HINTS[i].text;
    /* アニメを再生し直す */
    h.style.animation = 'none';
    void h.offsetWidth;
    h.style.animation = '';
  }

  function goStep(i) {
    step = i;
    lamps();
    setHint(i);

    /* カメラを ちょっと動かして いきいきさせる */
    tw.to(st, 'camPitch', [0, 3, -2, 1, 4][i], 1.4, U.easeInOutCubic);
    tw.to(st, 'camZ', [82, 78, 86, 80, 74][i], 1.8, U.easeInOutCubic);

    if (i === 0) {
      UI.activate('#task-lens');
      UI.lens.init(function () { goStep(1); });
    } else if (i === 1) {
      UI.activate('#task-disc');
      UI.disc.init(THEMES, function (idx) {
        theme = THEMES[idx];
        Scene.setTheme(theme);
        goStep(2);
      });
    } else if (i === 2) {
      UI.activate('#task-planet');
      UI.planet.init(theme, function (pcts) {
        Scene.planetAz = pcts.map(function (p, k) {
          return [30, 165, 285][k] + (p - 50) * 1.6;
        });
        goStep(3);
      });
    } else if (i === 3) {
      UI.activate('#task-cable');
      UI.cable.init(function () { goStep(4); });
    } else if (i === 4) {
      UI.activate('#task-lever');
      UI.lever.init(onLever, startFinale);
    }
  }

  /* レバーを下げるほど 会場が暗くなる（その場で見える） */
  function onLever(p) {
    if (mode !== 'prep') return;
    tw.kill(st, 'dim'); tw.kill(st, 'roomLight'); tw.kill(st, 'wash');
    st.dim = p * 0.42;
    st.roomLight = 1 - p * 0.82;
    st.projGlow = 0.14 + p * 0.5;
    var pan = U.$('#panel');
    pan.style.opacity = String(1 - p * 0.25);
  }

  /* ============================================================
     フィナーレ ── ここが いちばんの みせば
     ============================================================ */
  function startFinale() {
    if (mode === 'finale') return;
    mode = 'finale';
    yawAuto = true;
    if (global.Snd) { Snd.resume(); Snd.whoosh(2.8); }

    /* UI を しずかに 消す */
    var pan = U.$('#panel');
    pan.style.opacity = '';
    pan.classList.add('fade');
    U.$('#hint').classList.add('out');
    setTimeout(function () {
      U.hide(pan); U.hide(U.$('#hint')); U.hide(U.$('#lamps'));
    }, 620);

    tl.clear();

    /* --- ① 会場の照明が ゆっくり おちる --- */
    tw.to(st, 'roomLight', 0, 2.8, U.easeInOutCubic);
    tw.to(st, 'dim', 1, 3.2, U.easeInOutCubic);
    tw.to(st, 'projGlow', 1.5, 1.8, U.easeOutCubic);
    tw.to(st, 'twinkle', 1, 0.1, U.easeOutCubic);
    tw.to(st, 'starAlpha', 1, 0.4, U.easeOutCubic);
    st.starReveal = 0;
    st.c0 = st.c1 = st.c2 = st.c3 = 0;
    st.mw = 0; st.planetA = 0; st.moonA = 0; st.reflect = 0;

    /* --- カメラが 天頂へ（ゆっくり 前へ すべりながら） --- */
    tw.to(st, 'camPitch', 56, 7.2, U.easeInOutCubic, 0.9);
    tw.to(st, 'fov', 76, 6.0, U.easeInOutCubic, 0.9);
    tw.to(st, 'camZ', 70, 8.0, U.easeInOutCubic, 0.9);
    tw.to(st, 'camY', -4, 8.0, U.easeInOutCubic, 0.9);

    tl.at(1.0, function () { if (global.Snd) Snd.rumble(); });

    /* --- ② 星が ひとつずつ --- */
    tl.at(2.1, function () {
      tw.to(st, 'starReveal', 0.078, 3.4, U.easeOutCubic);
    });
    for (var k = 0; k < 9; k++) {
      (function (i) {
        tl.at(2.35 + i * 0.34, function () { if (global.Snd) Snd.pop(i); });
      })(k);
    }

    /* --- ③ そして いっきに ひろがる --- */
    tl.at(5.6, function () {
      tw.to(st, 'beamAmt', 1.0, 0.5, U.easeOutCubic);
      tw.to(st, 'wash', 0.10, 0.4, U.easeOutCubic);
    });
    tl.at(6.0, function () {
      tw.to(st, 'starReveal', 1.0, 2.9, U.easeOutCubic);
      tw.to(st, 'beamAmt', 0, 3.2, U.easeInOutCubic);
      tw.to(st, 'wash', 0, 1.6, U.easeOutCubic);
      var f = U.$('#flash');
      f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
      tw.to(st, 'projGlow', 0.30, 3.4, U.easeInOutCubic, 0.8);
      if (global.Snd) { Snd.bloom(); Snd.starRun(9, 523.25); }
    });

    /* --- ④ 惑星と おつきさま --- */
    tl.at(8.8, function () {
      tw.to(st, 'planetA', 1, 2.4, U.easeOutCubic);
      if (theme.moon) tw.to(st, 'moonA', 1, 3.0, U.easeOutCubic, 0.6);
    });

    /* --- ⑤ 星座の線が つながる（そのたびに 首が そちらを むく） --- */
    ['c0', 'c1', 'c2', 'c3'].forEach(function (key, i) {
      tl.at(9.6 + i * 2.0, function () {
        yawAuto = false;
        lookAtFigure(i, 1.9);
        tw.to(st, key, 1, 2.1, U.easeInOutCubic, 0.55);
        if (global.Snd) Snd.chime(392.0 * Math.pow(2, i / 12 * 3));
        setTimeout(function () { showName(Scene.figureName(i)); }, 2000);
      });
    });

    /* --- ⑥ 天の川が ドームの はしから はしへ --- */
    tl.at(18.4, function () {
      tw.to(st, 'mw', 1, 8.0, U.easeInOutCubic);
      tw.to(st, 'camPitch', 58, 3.0, U.easeInOutCubic);
      tw.to(st, 'fov', 78, 3.0, U.easeInOutCubic);
      setTimeout(function () { yawAuto = true; }, 3000);
      if (global.Snd) Snd.whoosh(5.0);
    });

    /* --- ⑦ 足元まで 反射光 --- */
    tl.at(6.4, function () { tw.to(st, 'reflect', 1, 5.0, U.easeInOutCubic); });

    /* --- ⑧ ゆっくり 視線を おろして、星あかりの 客席を みせる --- */
    tl.at(25.0, function () {
      yawAuto = true;
      tw.to(st, 'camPitch', 16, 11.0, U.easeInOutCubic);
      tw.to(st, 'camZ', 104, 11.0, U.easeInOutCubic);
      tw.to(st, 'camY', -9, 11.0, U.easeInOutCubic);
      tw.to(st, 'fov', 66, 11.0, U.easeInOutCubic);
    });

    /* --- ⑨ 音の うみ --- */
    tl.at(4.5, function () { if (global.Snd) Snd.droneOn(theme.id === 'sea' ? 110 : 130.81); });

    /* --- ⑩ 流れ星 --- */
    tl.at(20.2, function () { Scene.shootingStar(false); });
    tl.at(22.8, function () { Scene.shootingStar(true); });

    /* --- ⑪ ゆっくり ながめる時間のあとで ボタン --- */
    tl.at(28.5, function () {
      U.show(U.$('#replay'));
    });

    tl.start();
    shootTimer = 0;
  }

  var nameTimer = null;
  function showName(txt) {
    if (!txt) return;
    var el = U.$('#figureName');
    U.show(U.$('#afterglow'));
    el.classList.remove('show');
    void el.offsetWidth;
    el.textContent = txt;
    el.classList.add('show');
    if (nameTimer) clearTimeout(nameTimer);
    nameTimer = setTimeout(function () { el.classList.remove('show'); }, 3500);
  }

  /* ---------------- もういっかい ---------------- */
  G.replay = function (changeTheme) {
    if (mode !== 'finale') return;
    mode = 'prep';
    if (global.Snd) { Snd.tap(); Snd.droneOff(); Snd.whoosh(1.6); }
    tl.clear();
    U.hide(U.$('#replay'));
    U.hide(U.$('#afterglow'));

    /* 明かりが もどる */
    tw.to(st, 'starAlpha', 0, 1.6, U.easeInOutCubic);
    tw.to(st, 'mw', 0, 1.4, U.easeInOutCubic);
    tw.to(st, 'planetA', 0, 1.2, U.easeInOutCubic);
    tw.to(st, 'moonA', 0, 1.2, U.easeInOutCubic);
    tw.to(st, 'c0', 0, 1.0, U.easeInOutCubic);
    tw.to(st, 'c1', 0, 1.0, U.easeInOutCubic);
    tw.to(st, 'c2', 0, 1.0, U.easeInOutCubic);
    tw.to(st, 'c3', 0, 1.0, U.easeInOutCubic);
    tw.to(st, 'dim', 0, 2.0, U.easeInOutCubic, 0.4);
    tw.to(st, 'roomLight', 1, 2.0, U.easeOutCubic, 0.6);
    tw.to(st, 'reflect', 0, 1.6, U.easeInOutCubic);
    tw.to(st, 'projGlow', 0.14, 1.6, U.easeInOutCubic);
    tw.to(st, 'camPitch', 2, 2.4, U.easeInOutCubic);
    tw.to(st, 'fov', 62, 2.4, U.easeInOutCubic);
    tw.to(st, 'camZ', 95, 2.6, U.easeInOutCubic);
    tw.to(st, 'camY', -10, 2.6, U.easeInOutCubic);

    setTimeout(function () {
      st.starReveal = 0;
      U.show(U.$('#lamps'));
      var pan = U.$('#panel');
      U.show(pan);
      pan.classList.remove('fade');
      goStep(changeTheme ? 1 : 0);
    }, 1500);
  };

  /* ---------------- 毎フレーム ---------------- */
  G.update = function (dt) {
    tw.update(dt);
    tl.update(dt);

    if (mode === 'title') {
      st.camYaw += dt * 1.4;
    } else if (mode === 'finale') {
      if (yawAuto) st.camYaw += dt * yawSpeed;
      /* ときどき 流れ星 */
      shootTimer -= dt;
      if (tl.t > 20 && shootTimer <= 0) {
        shootTimer = 2.0 + Math.random() * 6.0 / Math.max(0.15, theme.shootRate * 3);
        if (Math.random() < 0.85) Scene.shootingStar(Math.random() < 0.4);
      }
    } else {
      prepT += dt;
      st.camYaw = Math.sin(prepT * 0.16) * 4.0;
    }
  };

  G.isFinale = function () { return mode === 'finale'; };

  global.Game = G;
})(window);
