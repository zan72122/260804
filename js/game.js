/* =========================================================
   game.js — 進行と、いちばんの みせば（フィナーレ）
   画面に 出る 2D は ひとつも ない。案内は ぜんぶ 3D の 光。
   ========================================================= */
(function (global) {
  'use strict';

  var G = {};
  var st = null;
  var tw = new U.Tweener();
  var tl = new U.Timeline();

  var mode = 'title';        // title | goto | work | finale | outro
  var theme = null;
  var legs = ['lens', 'shelf', 'slot', 'console', 'power', 'lever'];
  var leg = -1;
  var idle = 0;
  var shootTimer = 0;
  var lookSky = { az: 90, alt: 45, k: 0 };
  var finaleT = 0;
  var camLock = false;

  /* ---------------- 起動 ---------------- */
  G.init = function () {
    st = Scene.state;
    theme = THEMES[0];
    Scene.setTheme(theme);
    Room.init();
    Room.setThemeColors(THEMES);
    Room.state.knobColors = theme.planets.map(function (p) { return p.color; });
    Actor.init();
    Nav.build();
    Tasks.init();

    var e = Room.standSafe('entrance');
    Actor.placeAt(e, 292);
    Room.state.girlXZ = [e[0], e[2]];

    /* タイトル ── 暗いドームの 中に 立っている */
    st.dim = 0.90; st.roomLight = 0.06; st.starReveal = 0.55; st.starAlpha = 0.55;
    st.mw = 0.5; st.planetA = 0.35; st.moonA = 0; st.projGlow = 0.30; st.reflect = 0.55;
    st.c0 = st.c1 = st.c2 = st.c3 = 0;
    Room.state.hotPad = [e[0], e[2]];
    Room.state.hotAmt = 1;
    Room.state.padAlpha = 1;
    Room.state.padMode = 0;

    Cam.orbit();
    Cam.aim([e[0], e[1] + 16, e[2]], Actor.yaw + 176, 14, 60, 60);
    Cam.snap();
  };

  /* ---------------- テーマ・惑星 ---------------- */
  G.pickTheme = function (i) {
    theme = THEMES[i];
    Scene.setTheme(theme);
    Room.state.knobColors = theme.planets.map(function (p) { return p.color; });
  };
  G.setPlanets = function (ts) {
    Scene.planetAz = ts.map(function (t, k) {
      return [30, 165, 285][k] + (t - 0.5) * 120;
    });
  };

  /* 家具を よけて 歩く */
  function walkVia(target, onDone) {
    var pts = Nav.path([Actor.pos[0], Actor.pos[2]], [target[0], target[2]]);
    Actor.walkPath(pts, onDone);
  }

  /* ---------------- 進行 ---------------- */
  function gotoLeg(i) {
    leg = i;
    if (i >= legs.length) return;
    mode = 'goto';
    idle = 0;
    var key = legs[i];
    var p = Room.standSafe(key);
    Room.state.hotPad = [p[0], p[2]];
    Room.state.hotAmt = 1;
    Room.state.padAlpha = 1;
    /* 次の もちばの ほうへ 体を むける ── カメラも ついてまわるので
       目じるしが かならず 画面に 入る */
    Actor.targetYaw = Math.atan2(p[2] - Actor.pos[2], p[0] - Actor.pos[0]) * 180 / Math.PI;
  }

  function arrive() {
    var key = legs[leg];
    mode = 'work';
    Actor.targetYaw = Room.facing(key);
    Room.state.hotAmt = 0.15;
    tw.to(Room.state, 'padAlpha', 0.28, 0.6, U.easeOutCubic);
    setTimeout(function () {
      if (mode !== 'work') return;
      Tasks.begin(key, function () {
        tw.to(Room.state, 'padAlpha', 1, 0.6, U.easeOutCubic);
        Actor.cheer = 0;
        if (leg + 1 >= legs.length) startFinale();
        else gotoLeg(leg + 1);
      });
    }, 620);
  }

  /* ---------------- ゆび ---------------- */
  G.down = function (x, y) {
    idle = 0;
    if (mode === 'title') { begin(); return; }
    if (mode === 'finale') return;

    if (mode === 'work' && Tasks.down(x, y)) return;

    /* パッドを たたいたら そこまで 歩く */
    var pad = Room.padAt(x, y);
    if (!pad) return;
    if (mode === 'outro') {
      Actor.targetYaw = null;
      walkVia(pad.p, function () { checkOutro(pad); });
      if (global.Snd) Snd.tap();
      return;
    }
    if (mode === 'work') {
      /* もちばの パッドで なければ しごとを 中断して 歩きだす */
      var here = Room.standSafe(legs[leg]);
      if (Math.hypot(pad.p[0] - here[0], pad.p[2] - here[2]) < 6) return;
      Tasks.end();
      mode = 'goto';
      tw.to(Room.state, 'padAlpha', 1, 0.4, U.easeOutCubic);
      Room.state.hotAmt = 1;
    }
    Actor.targetYaw = null;
    walkVia(pad.p, null);
    if (global.Snd) Snd.tap();
  };
  G.move = function (x, y) { idle = 0; if (mode === 'work') Tasks.move(x, y); };
  G.up = function (x, y) { if (mode === 'work') Tasks.up(x, y); };

  /* ---------------- タイトル → しごと ---------------- */
  function begin() {
    mode = 'goto';
    if (global.Snd) { Snd.resume(); Snd.chime(523.25); Snd.whoosh(1.8); }
    tw.to(st, 'dim', 0, 2.2, U.easeInOutCubic);
    tw.to(st, 'roomLight', 1, 1.9, U.easeOutCubic, 0.2);
    tw.to(st, 'starAlpha', 0, 1.2, U.easeOutCubic);
    tw.to(st, 'mw', 0, 1.0, U.easeOutCubic);
    tw.to(st, 'planetA', 0, 0.9, U.easeOutCubic);
    tw.to(st, 'reflect', 0, 1.4, U.easeOutCubic);
    tw.to(st, 'projGlow', 0.16, 1.4, U.easeOutCubic);
    setTimeout(function () { gotoLeg(0); }, 900);
  }

  /* ---------------- レバーを さげている あいだ ---------------- */
  G.onLever = function (p) {
    if (mode !== 'work') return;
    tw.kill(st, 'dim'); tw.kill(st, 'roomLight');
    st.dim = p * 0.44;
    st.roomLight = 1 - p * 0.84;
    st.projGlow = 0.85 + p * 0.6;
    Room.state.padAlpha = 0.28 * (1 - p);
  };

  /* ============================================================
     フィナーレ
     ============================================================ */
  function startFinale() {
    mode = 'finale';
    finaleT = 0;
    camLock = false;
    if (global.Snd) { Snd.resume(); Snd.whoosh(2.8); }
    Tasks.end();

    Room.state.padAlpha = 0;
    Room.state.hotAmt = 0;
    Actor.lean = 0; Actor.reachL = null; Actor.reachR = null; Actor.gripLever = false;

    /* ドームの まんなかへ 歩いていって、見あげる */
    var open = Room.at(90, 62, 0);
    walkVia(open, function () {
      Actor.targetYaw = 268;
      tw.to(Actor, 'lookUp', 1, 2.2, U.easeInOutCubic);
    });

    tw.to(st, 'roomLight', 0, 2.8, U.easeInOutCubic);
    tw.to(st, 'dim', 1, 3.2, U.easeInOutCubic);
    tw.to(st, 'projGlow', 1.5, 1.8, U.easeOutCubic);
    tw.to(st, 'starAlpha', 1, 0.4, U.easeOutCubic);
    st.starReveal = 0;
    st.c0 = st.c1 = st.c2 = st.c3 = 0;
    st.mw = 0; st.planetA = 0; st.moonA = 0; st.reflect = 0;
    lookSky = { az: 268, alt: 16, k: 0 };

    tl.clear();
    tl.at(1.0, function () { if (global.Snd) Snd.rumble(); });
    tl.at(1.6, function () { tw.to(lookSky, 'alt', 52, 5.0, U.easeInOutCubic); });
    tl.at(2.1, function () { tw.to(st, 'starReveal', 0.078, 3.4, U.easeOutCubic); });
    for (var k = 0; k < 9; k++) {
      (function (i) { tl.at(2.35 + i * 0.34, function () { if (global.Snd) Snd.pop(i); }); })(k);
    }
    tl.at(5.6, function () {
      tw.to(st, 'beamAmt', 1.0, 0.5, U.easeOutCubic);
      tw.to(st, 'wash', 0.10, 0.4, U.easeOutCubic);
    });
    tl.at(6.0, function () {
      tw.to(st, 'starReveal', 1.0, 2.9, U.easeOutCubic);
      tw.to(st, 'beamAmt', 0, 3.2, U.easeInOutCubic);
      tw.to(st, 'wash', 0, 1.6, U.easeOutCubic);
      tw.to(st, 'projGlow', 0.30, 3.4, U.easeInOutCubic, 0.8);
      var f = document.getElementById('flash');
      f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
      if (global.Snd) { Snd.bloom(); Snd.starRun(9, 523.25); }
    });
    tl.at(6.4, function () { tw.to(st, 'reflect', 1, 5.0, U.easeInOutCubic); });
    tl.at(8.8, function () {
      tw.to(st, 'planetA', 1, 2.4, U.easeOutCubic);
      if (theme.moon) tw.to(st, 'moonA', 1, 3.0, U.easeOutCubic, 0.6);
    });

    /* 星座：そのたびに 彼女も カメラも そちらを むく */
    ['c0', 'c1', 'c2', 'c3'].forEach(function (key, i) {
      tl.at(9.6 + i * 2.0, function () {
        var f = theme.figures[i];
        if (f) {
          camLock = true;
          tw.to(lookSky, 'az', nearestAngle(lookSky.az, f.az), 1.9, U.easeInOutCubic);
          tw.to(lookSky, 'alt', U.clamp(f.alt, 24, 66), 1.9, U.easeInOutCubic);
          Actor.targetYaw = f.az;
        }
        tw.to(st, key, 1, 2.1, U.easeInOutCubic, 0.55);
        if (global.Snd) Snd.chime(392.0 * Math.pow(2, i / 12 * 3));
      });
    });

    tl.at(18.4, function () {
      camLock = false;
      tw.to(st, 'mw', 1, 8.0, U.easeInOutCubic);
      tw.to(lookSky, 'alt', 62, 3.0, U.easeInOutCubic);
      if (global.Snd) Snd.whoosh(5.0);
    });
    tl.at(4.5, function () { if (global.Snd) Snd.droneOn(theme.id === 'sea' ? 110 : 130.81); });
    tl.at(20.2, function () { Scene.shootingStar(false); });
    tl.at(22.8, function () { Scene.shootingStar(true); });

    /* 余韻：ゆっくり 視線を おろして 星あかりの 客席を みせる */
    tl.at(25.0, function () {
      tw.to(lookSky, 'alt', 18, 9.0, U.easeInOutCubic);
    });
    tl.at(28.5, function () { openOutro(); });
    tl.start();
    shootTimer = 0;
  }

  function nearestAngle(cur, target) {
    var t = target;
    while (t - cur > 180) t -= 360;
    while (t - cur < -180) t += 360;
    return t;
  }

  /* ---------------- もういっかい ---------------- */
  function openOutro() {
    mode = 'outro';
    Actor.lookUp = 0;
    Room.state.padMode = 1;
    tw.to(Room.state, 'padAlpha', 1, 1.6, U.easeOutCubic);
    Room.state.hotAmt = 0.9;
    var a = Room.outroPads[0];
    Room.state.hotPad = [a[0], a[2]];
  }

  function checkOutro(pad) {
    if (mode !== 'outro') return;
    var a = Room.outroPads[0], b = Room.outroPads[1];
    var da = Math.hypot(pad.p[0] - a[0], pad.p[2] - a[2]);
    var db = Math.hypot(pad.p[0] - b[0], pad.p[2] - b[2]);
    if (da < 12) restart(false);
    else if (db < 12) restart(true);
  }

  function restart(changeTheme) {
    mode = 'goto';
    if (global.Snd) { Snd.droneOff(); Snd.chime(523.25); Snd.whoosh(1.6); }
    tl.clear();
    Room.state.padMode = 0;

    tw.to(st, 'starAlpha', 0, 1.6, U.easeInOutCubic);
    tw.to(st, 'mw', 0, 1.4, U.easeInOutCubic);
    tw.to(st, 'planetA', 0, 1.2, U.easeInOutCubic);
    tw.to(st, 'moonA', 0, 1.2, U.easeInOutCubic);
    ['c0', 'c1', 'c2', 'c3'].forEach(function (k) { tw.to(st, k, 0, 1.0, U.easeInOutCubic); });
    tw.to(st, 'dim', 0, 2.0, U.easeInOutCubic, 0.4);
    tw.to(st, 'roomLight', 1, 2.0, U.easeOutCubic, 0.6);
    tw.to(st, 'reflect', 0, 1.6, U.easeInOutCubic);
    tw.to(st, 'projGlow', 0.16, 1.6, U.easeInOutCubic);

    /* 会場を もとに もどす */
    Room.resetForReplay(changeTheme);
    Scene.setTheme(theme);
    Actor.carry = 0; Actor.lookUp = 0;

    setTimeout(function () {
      st.starReveal = 0;
      Cam.orbit();
      gotoLeg(changeTheme ? 1 : 0);
    }, 1500);
  }

  /* ============================================================
     毎フレーム
     ============================================================ */
  G.update = function (dt) {
    tw.update(dt);
    tl.update(dt);
    Tasks.update(dt);
    Actor.update(dt);
    idle += dt;

    Room.state.girlXZ = [Actor.pos[0], Actor.pos[2]];
    Room.state.carry = Tasks.discMatrix();
    if (Room.state.discIn) Room.state.discSpin += dt * 90;

    if (mode === 'finale') finaleT += dt;

    /* もちばに 着いたら（すこし ずれていても）しごとが 始まる */
    if (mode === 'goto' && leg >= 0 && leg < legs.length && !Actor.isWalking()) {
      var tp = Room.standSafe(legs[leg]);
      var dd = Math.hypot(Actor.pos[0] - tp[0], Actor.pos[2] - tp[2]);
      if (dd < 3.5) arrive();
      else if (dd < 18) walkVia(tp, null);
    }

    /* 迷ったら 指さす */
    Actor.point = null;
    if ((mode === 'goto' || mode === 'outro') && idle > 3.2 && !Actor.isWalking()) {
      var hp = Room.state.hotPad;
      Actor.point = [hp[0], Actor.pos[1] + 6, hp[1]];
    }

    camera(dt);
    Cam.update(dt);
  };

  function camera(dt) {
    var c = Actor.chestPos();

    if (mode === 'finale') {
      /* 彼女を 画面の 下に のこしたまま 天井を 見あげる */
      /* 低い位置から 彼女ごしに 見あげる。
         視線を 上げても、彼女の あたまが 画面の 下がわに のこる。 */
      var d = U.dirFromAzAlt(lookSky.az, lookSky.alt);
      var back = U.dirFromAzAlt(lookSky.az + 180, 0);
      var eye = [
        Actor.pos[0] + back[0] * 31,
        Actor.pos[1] + 8.5,
        Actor.pos[2] + back[2] * 31
      ];
      var tgt = [eye[0] + d[0] * 150, eye[1] + d[1] * 150, eye[2] + d[2] * 150];
      Cam.free(eye, tgt, 74);
      if (!camLock) lookSky.az += dt * 1.6;
      return;
    }

    Cam.orbit();

    if (mode === 'title') {
      Cam.aim([c[0], c[1] + 3, c[2]], Actor.yaw + 176, 14, 60, 60);
      return;
    }

    if (mode === 'outro') {
      /* 星空を のこしたまま、ふたつの 輪が 見える ひろい絵 */
      Cam.aim([c[0], c[1] + 8, c[2]], Actor.yaw + 180, 8, 76, 66);
      return;
    }

    if (mode === 'work' && Tasks.active()) {
      var k = Tasks.camera();
      if (k) { Cam.aim(k.target, k.yaw, k.pitch, k.dist, k.fov); return; }
    }

    /* ついていく */
    Cam.aim([c[0], c[1] + 3, c[2]], Actor.yaw + 180, 21, 68, 60);
  }

  G.mode = function () { return mode; };
  G.isFinale = function () { return mode === 'finale'; };
  global.Game = G;
})(window);
