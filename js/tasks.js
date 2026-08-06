/* =========================================================
   tasks.js — 6つの もちば の しごと
   ぜんぶ 3D空間の 中で おこる。画面に 小窓は 出ない。
   ========================================================= */
(function (global) {
  'use strict';

  var T = {};
  var cur = null;            // いま はたらいている しごと
  var done = null;           // 終わったら 呼ぶ
  var tw = new U.Tweener();
  var A = null, RM = null, S = null;

  T.init = function () {
    A = global.Actor; RM = global.Room; S = Scene.state;
    tw.list.length = 0;
    cur = null;
  };

  T.begin = function (key, onDone) {
    A = global.Actor; RM = global.Room; S = Scene.state;
    done = onDone;
    cur = JOBS[key];
    if (cur && cur.begin) cur.begin();
  };
  T.end = function () {
    if (cur && cur.end) cur.end();
    cur = null;
  };
  T.active = function () { return !!cur; };
  T.key = function () { return cur ? cur.key : null; };

  T.update = function (dt) {
    tw.update(dt);
    if (cur && cur.update) cur.update(dt);
  };
  T.down = function (x, y) { return cur && cur.down ? !!cur.down(x, y) : false; };
  T.move = function (x, y) { return cur && cur.move ? !!cur.move(x, y) : false; };
  T.up = function (x, y) { return cur && cur.up ? !!cur.up(x, y) : false; };

  /* カメラの 寄りかた（肩ごし） */
  T.camera = function () {
    if (!cur) return null;
    var f = cur.focus ? cur.focus() : RM.focus[cur.key];
    return {
      target: f,
      yaw: A.yaw + 180 + (cur.side || 20),
      pitch: cur.pitch === undefined ? 13 : cur.pitch,
      dist: cur.dist || 36,
      fov: cur.fov || 58
    };
  };

  function finish(delay) {
    var cb = done;
    setTimeout(function () {
      T.end();
      if (cb) cb();
    }, delay === undefined ? 700 : delay);
  }

  /* =========================================================
     ① レンズを みがく
     ========================================================= */
  var lensLast = null, lensDist = 0, lensDone = false;

  var JOB_LENS = {
    key: 'lens', side: 44, pitch: 28, dist: 48, fov: 52,
    begin: function () {
      lensDone = false; lensLast = null; lensDist = 0;
      RM.lensReset();
      A.lean = 0.45;
      A.reachR = { p: RM.focus.lens, n: RM.lensDir, gap: 2.6 };
      A.holdCloth = true;
    },
    end: function () { A.lean = 0; A.reachR = null; A.holdCloth = false; },
    focus: function () { return RM.focus.lens; },
    down: function (x, y) {
      if (lensDone) return true;
      var h = RM.lensHit(x, y);
      if (!h) return false;
      lensLast = h;
      rub(h);
      if (global.Snd) Snd.polishOn();
      return true;
    },
    move: function (x, y) {
      if (lensDone) return true;
      var h = RM.lensHit(x, y);
      if (!h) return true;
      if (lensLast) {
        var d = Math.hypot(h.u - lensLast.u, h.v - lensLast.v);
        var n = Math.min(8, Math.ceil(d / 0.05));
        for (var i = 1; i <= n; i++) {
          rub({ u: U.lerp(lensLast.u, h.u, i / n), v: U.lerp(lensLast.v, h.v, i / n), p: h.p });
        }
        lensDist += d;
        if (global.Snd) Snd.polishPitch(U.clamp(d * 12, 0, 1));
        if (lensDist > 0.55) {
          lensDist = 0;
          if (global.Snd) Snd.sparkle();
        }
      }
      lensLast = h;
      return true;
    },
    up: function () {
      lensLast = null;
      if (global.Snd) Snd.polishOff();
      return true;
    }
  };

  function rub(h) {
    RM.lensWipe(h.u, h.v, 0.19);
    A.reachR = { p: h.p, n: RM.lensDir, gap: 2.6 };
    if (!lensDone && RM.lensProgress() > 0.62) {
      lensDone = true;
      if (global.Snd) { Snd.polishOff(); Snd.chime(659.25); }
      tw.to(RM, 'lensFogAmt', 0, 0.7, U.easeOutCubic);
      tw.to(RM, 'lensShine', 1.1, 0.35, U.easeOutCubic, 0.25,
        function () { tw.to(RM, 'lensShine', 0, 1.1, U.easeOutCubic); });
      A.reachR = null;
      A.lean = 0.1;
      A.cheer = 1;
      finish(1500);
    }
  }

  /* =========================================================
     ② 棚から ディスクを えらんで 抜きとる
     ========================================================= */
  var shelfPicked = -1;
  var JOB_SHELF = {
    key: 'shelf', side: 16, pitch: 20, dist: 96, fov: 60,
    begin: function () {
      shelfPicked = -1;
      A.lean = 0.12;
      RM.state.shelfGlow = 1;
    },
    end: function () { A.lean = 0; A.reachR = null; RM.state.shelfGlow = 0; },
    focus: function () { return RM.focus.shelf; },
    down: function (x, y) {
      if (shelfPicked >= 0) return true;
      var items = [];
      for (var i = 0; i < 4; i++) {
        if (RM.state.discTaken === i) continue;
        items.push({ c: RM.shelfSlots[i], r: 6.5, i: i });
      }
      var best = Pick.pickBest(x, y, items);
      if (!best) return false;
      take(best.i);
      return true;
    }
  };

  function take(i) {
    shelfPicked = i;
    A.reachR = { p: RM.shelfSlots[i], n: RM.shelfDir, gap: 2.2 };
    if (global.Snd) Snd.tap();
    setTimeout(function () {
      RM.state.discTaken = i;
      RM.state.carryAnim = 0;
      A.reachR = null;
      A.carry = 1;
      if (global.Snd) { Snd.snap(); Snd.chime(587.33); }
      if (global.Game.pickTheme) global.Game.pickTheme(i);
      finish(900);
    }, 520);
  }

  /* =========================================================
     ③ ディスクを 差込口へ
     ========================================================= */
  var slotGrab = false, slotDone = false, slotPos = null;
  var JOB_SLOT = {
    key: 'slot', side: -40, pitch: 30, dist: 62, fov: 56,
    begin: function () {
      slotGrab = false; slotDone = false; slotPos = null;
      A.lean = 0.25;
      RM.state.slotGlow = 1;
    },
    end: function () { A.lean = 0; RM.state.slotGlow = 0; },
    focus: function () { return RM.focus.slot; },
    down: function (x, y) {
      if (slotDone) return true;
      /* 差込口を たたいても 入る（ゆびが あまくても だいじょうぶ） */
      var items = [
        { c: RM.focus.slot, r: 13, k: 'slot' },
        { c: discWorld(), r: 8, k: 'disc' }
      ];
      var best = Pick.pickBest(x, y, items);
      if (!best) return false;
      if (best.k === 'slot') { insert(); return true; }
      slotGrab = true;
      slotPos = discWorld();
      return true;
    },
    move: function (x, y) {
      if (!slotGrab || slotDone) return slotDone;
      var ray = Pick.ray(x, y);
      if (!ray) return true;
      /* カメラに 正対する 面の 上を すべらせる */
      var n = U.V.norm(U.V.sub(Cam.eye, RM.focus.slot));
      var dn = U.V.dot(ray.d, n);
      if (Math.abs(dn) > 1e-4) {
        var t = U.V.dot(U.V.sub(RM.focus.slot, ray.o), n) / dn;
        if (t > 0) slotPos = [ray.o[0] + ray.d[0] * t, ray.o[1] + ray.d[1] * t, ray.o[2] + ray.d[2] * t];
      }
      /* 差込口に 近づくと 吸いつく */
      var d = dist3(slotPos, RM.focus.slot);
      if (d < 26) {
        var k = U.smoothstep(26, 6, d) * 0.7;
        slotPos = [U.lerp(slotPos[0], RM.focus.slot[0], k),
                   U.lerp(slotPos[1], RM.focus.slot[1], k),
                   U.lerp(slotPos[2], RM.focus.slot[2], k)];
      }
      if (d < 9) insert();
      return true;
    },
    up: function () {
      if (slotDone) return true;
      if (slotGrab && slotPos && dist3(slotPos, RM.focus.slot) < 34) { insert(); return true; }
      slotGrab = false; slotPos = null;
      return true;
    },
    /* いま ディスクを どこに 描くか */
    discMatrix: function () {
      if (slotDone) return null;
      if (slotGrab && slotPos) {
        return U.M.multiply(U.M.orient(slotPos, RM.slotDir, [0, 1, 0]), U.M.rotateX(U.rad(90)));
      }
      return A.carryMatrix();
    }
  };

  function discWorld() {
    if (slotGrab && slotPos) return slotPos;
    var m = A.carryMatrix();
    return [m[12], m[13], m[14]];
  }
  function dist3(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

  function insert() {
    if (slotDone) return;
    slotDone = true; slotGrab = false;
    A.carry = 0;
    RM.state.discIn = true;
    RM.state.carry = null;
    if (global.Snd) { Snd.snap(); Snd.click(); }
    tw.to(RM.state, 'discSpin', 24, 2.4, U.easeOutCubic);
    tw.to(S, 'projGlow', 0.55, 1.4, U.easeOutCubic);
    setTimeout(function () { if (global.Snd) Snd.chime(698.46); }, 320);
    A.cheer = 1;
    finish(1500);
  }

  /* =========================================================
     ④ 惑星を レールで あわせる
     ========================================================= */
  var knobGrab = -1, knobLock = [false, false, false];
  var JOB_CONSOLE = {
    key: 'console', side: 22, pitch: 34, dist: 80, fov: 62,
    begin: function () {
      knobGrab = -1; knobLock = [false, false, false];
      RM.state.knobShow = 1;
      RM.state.knobT = [0.14, 0.86, 0.20];
      A.lean = 0.35;
    },
    end: function () { A.lean = 0; A.reachR = null; },
    focus: function () { return RM.focus.console; },
    down: function (x, y) {
      var items = [];
      for (var i = 0; i < 3; i++) {
        if (knobLock[i]) continue;
        items.push({ c: knobPos(i), r: 9, i: i });
      }
      var best = Pick.pickBest(x, y, items);
      if (!best) return false;
      knobGrab = best.i;
      A.reachR = { p: knobPos(knobGrab), n: [0, 1, 0], gap: 1.9 };
      if (global.Snd) Snd.tap();
      return true;
    },
    move: function (x, y) {
      if (knobGrab < 0) return false;
      var rail = RM.rails[knobGrab];
      var ray = Pick.ray(x, y);
      if (!ray) return true;
      /* レール（直線）に いちばん近い 点 */
      var t = closestOnLine(ray, rail.c, rail.x, rail.half);
      RM.state.knobT[knobGrab] = U.clamp(t * 0.5 + 0.5, 0.02, 0.98);
      A.reachR = { p: knobPos(knobGrab), n: [0, 1, 0], gap: 1.9 };
      return true;
    },
    up: function () {
      if (knobGrab < 0) return false;
      var i = knobGrab;
      knobGrab = -1;
      /* すこしの ズレは のこす（自分で あわせた かんじ） */
      var d = RM.state.knobT[i] - RM.knobTarget[i];
      var fin = RM.knobTarget[i] + U.clamp(d, -0.045, 0.045);
      tw.to(RM.state.knobT, i, fin, 0.42, U.easeOutBack);
      knobLock[i] = true;
      A.reachR = null;
      if (global.Snd) Snd.pop(i + 2);
      if (knobLock[0] && knobLock[1] && knobLock[2]) {
        if (global.Snd) setTimeout(function () { Snd.chime(523.25); }, 320);
        if (global.Game.setPlanets) global.Game.setPlanets(RM.state.knobT);
        A.cheer = 1;
        finish(1400);
      }
      return true;
    }
  };

  function knobPos(i) {
    var rail = RM.rails[i];
    var t = RM.state.knobT[i] * 2 - 1;
    return [rail.c[0] + rail.x[0] * t * rail.half, rail.c[1] + 5.4,
            rail.c[2] + rail.x[2] * t * rail.half];
  }

  /* レイに いちばん近い レール上の 位置 (-1..1) */
  function closestOnLine(ray, c, dir, half) {
    var w0 = U.V.sub(c, ray.o);
    var a = U.V.dot(dir, dir), b = U.V.dot(dir, ray.d), cc = U.V.dot(ray.d, ray.d);
    var d = U.V.dot(dir, w0), e = U.V.dot(ray.d, w0);
    var den = a * cc - b * b;
    if (Math.abs(den) < 1e-6) return 0;
    var s = (b * e - cc * d) / -den;
    return U.clamp(s / half, -1, 1);
  }

  /* =========================================================
     ⑤ しゃがんで ケーブルを つなぐ
     ========================================================= */
  var plugGrab = -1, plugMoved = 0, plugStart = null;
  var JOB_POWER = {
    key: 'power', side: 22, pitch: 28, dist: 82, fov: 60,
    begin: function () {
      plugGrab = -1;
      tw.to(A, 'crouch', 1, 0.85, U.easeOutCubic);
      A.lean = 0.25;
      RM.state.plugState = [0, 0, 0];
      RM.state.plugDrag = [null, null, null];
      RM.state.lampOn = [0, 0, 0];
    },
    end: function () {
      tw.to(A, 'crouch', 0, 0.7, U.easeInOutCubic);
      A.lean = 0; A.reachR = null;
    },
    focus: function () { return RM.focus.power; },
    down: function (x, y) {
      var items = [];
      for (var i = 0; i < 3; i++) {
        if (RM.state.plugState[i] === 2) continue;
        items.push({ c: plugPos(i), r: 10, i: i });
      }
      var best = Pick.pickBest(x, y, items);
      if (!best) return false;
      plugGrab = best.i;
      plugMoved = 0;
      plugStart = [x, y];
      RM.state.plugState[plugGrab] = 1;
      RM.state.plugDrag[plugGrab] = plugPos(plugGrab);
      A.reachR = { p: plugPos(plugGrab), n: [0, 1, 0], gap: 2.0 };
      if (global.Snd) Snd.tap();
      return true;
    },
    move: function (x, y) {
      if (plugGrab < 0) return false;
      plugMoved = Math.max(plugMoved, Math.hypot(x - plugStart[0], y - plugStart[1]));
      var ray = Pick.ray(x, y);
      var p = Pick.floorHit(ray, RM.sockets[0].c[1]);
      if (!p) return true;
      /* いちばん近い あいてる ソケットへ 吸いよせる */
      var s = nearestSocket(p);
      if (s.d < 40) {
        var k = U.smoothstep(40, 8, s.d) * 0.75;
        p = [U.lerp(p[0], s.s.c[0], k), U.lerp(p[1], s.s.c[1], k), U.lerp(p[2], s.s.c[2], k)];
      }
      RM.state.plugDrag[plugGrab] = p;
      A.reachR = { p: p, n: [0, 1, 0], gap: 2.0 };
      if (s.d < 11) connect(plugGrab, s.s);
      return true;
    },
    up: function () {
      if (plugGrab < 0) return false;
      var i = plugGrab;
      var p = RM.state.plugDrag[i] || plugPos(i);
      var s = nearestSocket(p);
      if (s.s && (plugMoved < 14 || s.d < 55)) connect(i, s.s);
      else {
        RM.state.plugState[i] = 0;
        RM.state.plugDrag[i] = null;
      }
      plugGrab = -1;
      A.reachR = null;
      return true;
    }
  };

  function plugPos(i) {
    return RM.state.plugDrag[i] ||
      (RM.state.plugState[i] === 2 ? RM.sockets[i].c : RM.cableHome[i]);
  }
  function nearestSocket(p) {
    var best = null, bd = 1e9;
    for (var i = 0; i < 3; i++) {
      if (RM.sockets[i].used) continue;
      var d = dist3(p, RM.sockets[i].c);
      if (d < bd) { bd = d; best = RM.sockets[i]; }
    }
    return { s: best, d: bd };
  }
  function connect(i, sock) {
    if (RM.state.plugState[i] === 2) return;
    sock.used = true;
    RM.state.plugState[i] = 2;
    RM.state.plugDrag[i] = sock.c;
    plugGrab = -1;
    A.reachR = null;
    var li = RM.sockets.indexOf(sock);
    tw.to(RM.state.lampOn, li, 1, 0.3, U.easeOutCubic);
    if (global.Snd) { Snd.click(); Snd.pop(i + 3); }
    var n = 0;
    for (var k = 0; k < 3; k++) if (RM.state.plugState[k] === 2) n++;
    if (n >= 3) {
      if (global.Snd) setTimeout(function () { Snd.chime(698.46); }, 300);
      tw.to(S, 'projGlow', 0.85, 1.2, U.easeOutCubic);
      A.cheer = 1;
      finish(1600);
    }
  }

  /* =========================================================
     ⑥ 主投影レバー
     ========================================================= */
  var levGrab = false, levStartY = 0, levStart = 0, levMoved = 0, levLocked = false;
  var levAuto = -1;
  var JOB_LEVER = {
    key: 'lever', side: 34, pitch: 22, dist: 48, fov: 58,
    begin: function () {
      levGrab = false; levLocked = false; levAuto = -1;
      RM.state.lever = 0;
      A.lean = 0.15;
      A.gripLever = true;
    },
    end: function () { A.lean = 0; A.gripLever = false; A.reachL = null; A.reachR = null; },
    focus: function () { return [RM.leverPivot[0], RM.leverPivot[1] + 8, RM.leverPivot[2]]; },
    down: function (x, y) {
      if (levLocked) return true;
      var best = Pick.pickBest(x, y, [{ c: RM.leverGripPos || RM.focus.lever, r: 11 }]);
      if (!best) return false;
      levGrab = true; levStartY = y; levStart = RM.state.lever; levMoved = 0;
      return true;
    },
    move: function (x, y) {
      if (!levGrab || levLocked) return levGrab;
      levMoved = Math.max(levMoved, Math.abs(y - levStartY));
      var span = global.innerHeight * 0.30;
      setLever(levStart + (y - levStartY) / span);
      return true;
    },
    up: function () {
      if (!levGrab || levLocked) return true;
      levGrab = false;
      if (levMoved < 12) { levAuto = 0; return true; }         // タップだけでも 下りる
      if (RM.state.lever > 0.62) lock();
      else tw.to(RM.state, 'lever', 0, 0.45, U.easeOutBack);
      return true;
    },
    update: function (dt) {
      /* 両手で にぎりを つかんでいる */
      if (RM.leverGripPos) { A.reachL = RM.leverGripPos; A.reachR = RM.leverGripPos; }
      if (levAuto >= 0 && !levLocked) {
        levAuto += dt / 1.5;
        setLever(U.easeInOutCubic(U.clamp(levAuto, 0, 1)));
        if (levAuto >= 1) lock();
      }
    }
  };

  function setLever(v) {
    var p = U.clamp(v, 0, 1);
    var old = RM.state.lever;
    RM.state.lever = p;
    if (global.Game.onLever) global.Game.onLever(p);
    if (Math.floor(p * 7) !== Math.floor(old * 7) && global.Snd) Snd.tap();
  }
  function lock() {
    if (levLocked) return;
    levLocked = true;
    tw.to(RM.state, 'lever', 1, 0.28, U.easeOutCubic, 0, function () {
      if (global.Game.onLever) global.Game.onLever(1);
    });
    if (global.Snd) Snd.snap();
    finish(240);
  }

  var JOBS = {
    lens: JOB_LENS, shelf: JOB_SHELF, slot: JOB_SLOT,
    console: JOB_CONSOLE, power: JOB_POWER, lever: JOB_LEVER
  };
  T.JOBS = JOBS;

  /* 運んでいる ディスクの 行列（Game から 毎フレーム 使う） */
  T.discMatrix = function () {
    if (cur === JOB_SLOT) return JOB_SLOT.discMatrix();
    if (Actor.carry > 0.5) return Actor.carryMatrix();
    return null;
  };

  global.Tasks = T;
})(window);
