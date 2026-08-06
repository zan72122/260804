/* =========================================================
   actor.js — プラネタリウム技師の 女の子
   プリミティブの 組み立て + 手続きアニメ（骨データなし）
   身長 ≒ 30単位（1単位 ≒ 4cm）
   ========================================================= */
(function (global) {
  'use strict';

  var A = {};
  var gl = null, mesh = null, idx = {};

  /* ---- からだの 寸法 ---- */
  var HIP_Y = 11.4;        // 立っているときの 腰の 高さ
  var SHO_Y = 8.0;         // 腰から 肩まで
  var UPPER = 5.4, FORE = 5.0;
  var THIGH = 5.6, SHIN = 5.2;
  var SHO_X = 3.7, HIP_X = 1.9;

  /* 素材: 0=塗装 1=金属 2=木 3=布 */
  var M = { skin: 0, cloth: 3, metal: 1 };

  var C = {
    skin:   [0.98, 0.82, 0.72],
    hair:   [0.36, 0.20, 0.14],
    hairHi: [0.48, 0.28, 0.18],
    suit:   [0.20, 0.36, 0.46],
    suitHi: [0.26, 0.46, 0.58],
    apron:  [0.92, 0.90, 0.86],
    boot:   [0.72, 0.26, 0.30],
    eye:    [0.10, 0.07, 0.10],
    cheek:  [0.98, 0.62, 0.60],
    star:   [1.0, 0.86, 0.42]
  };

  /* ---------------- 状態 ---------------- */
  A.pos = [0, 0, 0];          // 足もとの 位置（床の上）
  A.yaw = 90;                 // 度。向いている 方位
  A.walkPhase = 0;
  A.speed = 0;
  A.crouch = 0;               // 0..1
  A.lean = 0;                 // 前かがみ 0..1
  A.carry = 0;                // 両手で 抱える 0..1
  A.reachL = null;            // 世界座標 or null
  A.reachR = null;
  A.point = null;             // 指さす 方向（世界座標）
  A.lookUp = 0;               // 見あげる 0..1
  A.holdCloth = false;        // みがき用の クロスを もつ
  A.gripLever = false;        // レバーを 両手で にぎる
  A.cheer = 0;                // できた！の ポーズ
  A.visible = true;
  A.t = 0;

  /* 歩く 目的地 */
  var path = null;            // {to:[x,z], onDone}
  var WALK_SPEED = 48;

  A.init = function () {
    gl = Scene.gl;
    build();
  };

  /* ============================================================
     モデル
     ============================================================ */
  function build() {
    var b = new GLC.Builder();
    var T = U.M.translate, mul = U.M.multiply, RX = U.M.rotateX, RZ = U.M.rotateZ;
    var S = U.M.scale;

    /* ---- あたま（首のつけね を 原点に、+Y へ） ---- */
    var head0 = b.I.length;
    b.push(GLC.cylinder(1.5, 1.7, 2.0, 10), T(0, 1.0, 0), C.skin, 0, 5);              // 首
    b.push(GLC.sphere(5.0, 20, 14, 180, false), mul(T(0, 6.4, 0), S(1.0, 0.97, 0.95)), C.skin, 0, 5);
    /* うしろ髪：軸を -Z に むけた おわん（顔は あける） */
    b.push(GLC.sphere(5.28, 22, 14, 116, false),
      mul(T(0, 6.45, 0), RX(U.rad(-90))), C.hair, 0, 5);
    /* 前髪：ひたいの 上だけ */
    b.push(GLC.sphere(5.24, 20, 10, 54, false),
      mul(mul(T(0, 6.5, 0.1), RX(U.rad(-26))), S(1.0, 0.92, 1.0)), C.hairHi, 0, 5);
    /* おさげ 2本 */
    [-1, 1].forEach(function (s) {
      b.push(GLC.sphere(2.15, 12, 9, 180, false), T(s * 4.85, 6.9, -1.1), C.hair, 0, 5);
      b.push(GLC.cylinder(1.85, 1.15, 5.6, 10), T(s * 5.45, 3.4, -1.5), C.hair, 0, 5);
      b.push(GLC.sphere(1.25, 10, 8, 180, false), T(s * 5.6, 0.6, -1.6), C.hairHi, 0, 5);
    });
    /* 目・ほっぺ・くち */
    [-1, 1].forEach(function (s) {
      b.push(GLC.sphere(0.82, 10, 8, 180, false), mul(T(s * 1.9, 6.15, 4.28), S(0.86, 1.1, 0.7)), C.eye, 0, 5);
      b.push(GLC.sphere(0.30, 8, 6, 180, false), T(s * 1.66, 6.55, 4.62), [1, 1, 1], 0.5, 5);
      b.push(GLC.sphere(1.05, 10, 8, 180, false), mul(T(s * 3.15, 5.15, 3.75), S(1, 0.55, 0.45)), C.cheek, 0, 5);
    });
    b.push(GLC.sphere(0.42, 8, 6, 180, false), mul(T(0, 4.62, 4.55), S(1.5, 0.7, 0.5)), [0.80, 0.44, 0.42], 0, 5);
    /* 髪かざりの 星 */
    b.push(GLC.sphere(1.0, 8, 6, 180, false), T(3.5, 9.2, 1.1), C.star, 0.9, 5, M.metal);
    idx.head = { first: head0, count: b.I.length - head0 };

    /* ---- どうたい（腰を 原点に、+Y へ） ---- */
    var tor0 = b.I.length;
    b.push(GLC.cylinder(3.9, 3.5, SHO_Y, 16), T(0, SHO_Y / 2, 0), C.suit, 0, 5, M.cloth);
    b.push(GLC.cylinder(4.2, 3.9, 1.4, 16), T(0, 0.4, 0), C.suitHi, 0, 5, M.cloth);          // 腰まわり
    b.push(GLC.cylinder(3.6, 4.3, 1.2, 16), T(0, SHO_Y + 0.2, 0), C.suitHi, 0, 5, M.cloth);  // 肩
    /* スカート（ひろがる すそ） */
    b.push(GLC.cylinder(3.9, 5.5, 3.8, 18), T(0, -0.2, 0), C.suitHi, 0, 5, M.cloth);
    /* エプロン（むねあて＋ひも） */
    b.push(GLC.roundBox(5.0, 6.4, 0.8, 0.5, 2), T(0, 4.4, 3.62), C.apron, 0, 5, M.cloth);
    b.push(GLC.roundBox(6.8, 3.2, 0.8, 0.5, 2), T(0, 0.9, 3.85), C.apron, 0, 5, M.cloth);
    [-1, 1].forEach(function (s) {
      b.push(GLC.box(0.9, 4.6, 0.7), mul(T(s * 1.9, 6.7, 3.42), RX(U.rad(6))), C.apron, 0, 5, M.cloth);
    });
    /* えり */
    b.push(GLC.cylinder(2.5, 2.5, 1.0, 12), T(0, SHO_Y + 0.9, 0), C.apron, 0, 5, M.cloth);
    /* むねの きらきらバッジ */
    b.push(GLC.sphere(0.8, 8, 6, 180, false), T(2.1, 6.4, 3.62), C.star, 0.9, 5, M.metal);
    idx.torso = { first: tor0, count: b.I.length - tor0 };

    /* ---- 骨（原点から -Y に のびる） ---- */
    function bone(r0, r1, len, col) {
      var f = b.I.length;
      b.push(GLC.cylinder(r0, r1, len, 10), T(0, -len / 2, 0), col, 0, 5);
      b.push(GLC.sphere(r0 * 0.95, 10, 7, 180, false), U.M.identity(), col, 0, 5);
      return { first: f, count: b.I.length - f };
    }
    idx.upper = bone(1.55, 1.35, UPPER, C.suit);
    idx.fore = bone(1.35, 1.15, FORE, C.skin);
    idx.thigh = bone(2.10, 1.80, THIGH, C.suit);
    idx.shin = bone(1.80, 1.45, SHIN, C.suit);

    var h0 = b.I.length;
    b.push(GLC.sphere(1.55, 12, 9, 180, false), U.M.identity(), C.skin, 0, 5);
    idx.hand = { first: h0, count: b.I.length - h0 };

    var f0 = b.I.length;
    b.push(GLC.roundBox(3.4, 2.4, 5.6, 1.0, 2), T(0, -0.9, 1.1), C.boot, 0, 5, M.skin);
    idx.foot = { first: f0, count: b.I.length - f0 };

    mesh = b.upload(gl);
    A.verts = b.vo;
  }

  /* ============================================================
     移動
     ============================================================ */
  A.walkTo = function (xz, onDone) {
    path = { pts: [[xz[0], xz[2] === undefined ? xz[1] : xz[2]]], i: 0, onDone: onDone || null };
  };
  /* 経由点の 列を たどって 歩く */
  A.walkPath = function (pts, onDone) {
    if (!pts || !pts.length) { if (onDone) onDone(); return; }
    path = { pts: pts.slice(), i: 0, onDone: onDone || null };
  };
  A.stop = function () { path = null; A.speed = 0; };
  A.isWalking = function () { return !!path; };
  A.pathLeft = function () { return path ? path.pts.length - path.i : 0; };

  A.placeAt = function (p, yawDeg) {
    A.pos = [p[0], p[1], p[2]];
    if (yawDeg !== undefined) A.yaw = yawDeg;
    path = null;
  };

  /* 立ち位置の 世界座標（腰・肩・胸） */
  A.hipPos = function () { return [A.pos[0], A.pos[1] + hipY(), A.pos[2]]; };
  A.chestPos = function () { return [A.pos[0], A.pos[1] + hipY() + SHO_Y * 0.62, A.pos[2]]; };
  A.headPos = function () { return [A.pos[0], A.pos[1] + hipY() + SHO_Y + 6.4, A.pos[2]]; };

  function hipY() { return U.lerp(HIP_Y, 6.3, A.crouch); }

  /* 前向きベクトル */
  function fwd() {
    var a = U.rad(A.yaw);
    return [Math.cos(a), 0, Math.sin(a)];
  }
  A.forward = fwd;
  function right() {
    var a = U.rad(A.yaw);
    return [-Math.sin(a), 0, Math.cos(a)];
  }

  A.faceTowards = function (p) {
    A.targetYaw = Math.atan2(p[2] - A.pos[2], p[0] - A.pos[0]) * 180 / Math.PI;
  };
  A.targetYaw = null;

  A.update = function (dt) {
    A.t += dt;

    if (path) {
      var tgt = path.pts[path.i];
      var dx = tgt[0] - A.pos[0], dz = tgt[1] - A.pos[2];
      var d = Math.hypot(dx, dz);
      var step = WALK_SPEED * dt;
      if (d <= step || d < 0.6) {
        A.pos[0] = tgt[0]; A.pos[2] = tgt[1];
        path.i++;
        if (path.i >= path.pts.length) {
          var cb = path.onDone; path = null;
          A.speed = 0;
          if (cb) cb();
        }
      } else {
        A.pos[0] += dx / d * step;
        A.pos[2] += dz / d * step;
        A.speed = WALK_SPEED;
        A.yaw = U.approachAngle(A.yaw, Math.atan2(dz, dx) * 180 / Math.PI, 9, dt);
      }
    } else {
      A.speed = U.approach(A.speed, 0, 8, dt);
      if (A.targetYaw !== null) {
        A.yaw = U.approachAngle(A.yaw, A.targetYaw, 6, dt);
      }
    }

    /* 安全網 ── 何が あっても 機械の 中には いない */
    if (global.Room && Room.pushOut) {
      var safe = Room.pushOut(A.pos[0], A.pos[2]);
      A.pos[0] = safe[0]; A.pos[2] = safe[1];
    }

    if (A.speed > 1) A.walkPhase += dt * 1.55;
    if (A.cheer > 0) A.cheer = Math.max(0, A.cheer - dt * 0.75);
  };

  /* ============================================================
     ポーズを 組む
     ============================================================ */
  function pose() {
    var f = fwd(), rt = right();
    var walking = A.speed > 1;
    var ph = A.walkPhase * Math.PI * 2;
    var bob = walking ? -Math.abs(Math.sin(ph * 2.0)) * 0.75 : Math.sin(A.t * 1.6) * 0.16;
    var hy = hipY() + bob;
    var hip = [A.pos[0], A.pos[1] + hy, A.pos[2]];

    /* 体の 前かがみ */
    var leanA = U.rad(U.lerp(0, 22, A.lean) + A.crouch * 16 + (walking ? 5 : 0));
    var up = [Math.sin(leanA) * f[0], Math.cos(leanA), Math.sin(leanA) * f[2]];

    var sho = [hip[0] + up[0] * SHO_Y, hip[1] + up[1] * SHO_Y, hip[2] + up[2] * SHO_Y];

    /* --- 脚（足を 床に おいてから 逆運動学で ひざを 曲げる） --- */
    var legs = [];
    var stride = walking ? 7.4 : 0;
    var STEP_LIFT = 2.9;
    for (var s = -1; s <= 1; s += 2) {
      var hipP = [hip[0] + rt[0] * HIP_X * s, hip[1], hip[2] + rt[2] * HIP_X * s];
      var spread = HIP_X + 0.5 + A.crouch * 1.4;
      var fwdOff = 0, lifted = 0, toe = 0;
      if (walking) {
        var u = A.walkPhase + (s > 0 ? 0.5 : 0);
        u = u - Math.floor(u);
        if (u < 0.5) {                                  // 地についている
          var k = u / 0.5;
          fwdOff = (0.5 - k) * stride;
          toe = -0.10;
        } else {                                        // ふりだす
          var k2 = (u - 0.5) / 0.5;
          fwdOff = (-0.5 + k2) * stride;
          lifted = Math.sin(k2 * Math.PI) * STEP_LIFT;
          toe = 0.30 * Math.sin(k2 * Math.PI);
        }
      } else if (A.crouch > 0.02) {
        fwdOff = 2.4 * A.crouch;
        toe = -0.16 * A.crouch;
      } else {
        fwdOff = 0.3 * s;
      }
      var foot = [
        A.pos[0] + rt[0] * spread * s + f[0] * fwdOff,
        A.pos[1] + 1.75 + lifted,
        A.pos[2] + rt[2] * spread * s + f[2] * fwdOff
      ];
      var pole = [f[0] + rt[0] * 0.18 * s, 0.45, f[2] + rt[2] * 0.18 * s];
      var ikL = U.M.ik2(hipP, foot, THIGH, SHIN, pole);
      legs.push({ hip: hipP, knee: ikL.elbow, ankle: ikL.end, toe: toe });
    }

    /* --- 腕 --- */
    var arms = [];
    var sIdx = 0;
    for (var q = -1; q <= 1; q += 2) {
      var shoP = [sho[0] + rt[0] * SHO_X * q, sho[1] - 0.4, sho[2] + rt[2] * SHO_X * q];
      var target = reachPoint((q < 0) ? A.reachL : A.reachR);
      var elbow, wrist;

      if (A.cheer > 0.05 && !target) {
        /* できた！ 両手を あげる */
        var c = Math.sin(Math.min(1, A.cheer) * Math.PI) ;
        target = [
          sho[0] + rt[0] * 5.0 * q + f[0] * 1.5,
          sho[1] + 3.0 + 4.5 * c,
          sho[2] + rt[2] * 5.0 * q + f[2] * 1.5
        ];
      }
      if (A.carry > 0.5) {
        /* ディスクの ふちを 両手で つかむ */
        var cm = carryFrame(hip, f, rt);
        /* ふちの すこし 下がわを、盤面の うしろから つかむ */
        var e2 = U.V.norm(U.V.cross(rt, cm.n));      // 盤面の中の「上」
        var gc = Math.cos(U.rad(24)) * cm.grip, gs = Math.sin(U.rad(24)) * cm.grip;
        target = [
          cm.c[0] + rt[0] * gc * q - e2[0] * gs - cm.n[0] * 2.4,
          cm.c[1] + rt[1] * gc * q - e2[1] * gs - cm.n[1] * 2.4,
          cm.c[2] + rt[2] * gc * q - e2[2] * gs - cm.n[2] * 2.4
        ];
      }
      if (A.point && q > 0) {
        var pd = U.V.norm(U.V.sub(A.point, shoP));
        target = [shoP[0] + pd[0] * (UPPER + FORE) * 0.94,
                  shoP[1] + pd[1] * (UPPER + FORE) * 0.94,
                  shoP[2] + pd[2] * (UPPER + FORE) * 0.94];
      }

      if (target) {
        var pole = [rt[0] * q * 1.2 - f[0] * 0.9, -0.55, rt[2] * q * 1.2 - f[2] * 0.9];
        var ik = U.M.ik2(shoP, target, UPPER, FORE, pole);
        elbow = ik.elbow; wrist = ik.end;
      } else {
        var aSw = walking ? -Math.sin(ph + (q > 0 ? Math.PI : 0)) * 0.42 : 0.06;
        var da = dirFrom(f, aSw);
        /* 少し 外へ ひらく */
        da = U.V.norm([da[0] + rt[0] * 0.16 * q, da[1], da[2] + rt[2] * 0.16 * q]);
        elbow = [shoP[0] + da[0] * UPPER, shoP[1] + da[1] * UPPER, shoP[2] + da[2] * UPPER];
        var db = dirFrom(f, aSw - 0.28);
        wrist = [elbow[0] + db[0] * FORE, elbow[1] + db[1] * FORE, elbow[2] + db[2] * FORE];
      }
      arms.push({ sho: shoP, elbow: elbow, wrist: wrist });
      sIdx++;
    }

    return { hip: hip, sho: sho, up: up, f: f, rt: rt, legs: legs, arms: arms, lean: leanA };
  }

  /* reach の 目標を 世界座標に する。
     面の 法線が ついていれば、その ぶんだけ 手前で 止める。 */
  function reachPoint(t) {
    if (!t) return null;
    if (t.length === 3) return t;
    var g = (t.gap === undefined) ? 2.0 : t.gap;
    return [t.p[0] + t.n[0] * g, t.p[1] + t.n[1] * g, t.p[2] + t.n[2] * g];
  }
  A.reachPoint = reachPoint;

  /* 前方 f を 基準に、角度 a だけ 前へ ふった「下向き」の 方向 */
  function dirFrom(f, a) {
    return [Math.sin(a) * f[0], -Math.cos(a), Math.sin(a) * f[2]];
  }

  A.pose = pose;

  /* 運んでいる ディスクの 位置と 向き。
     体の 前・へその 高さ。歩くと わずかに ゆれる。 */
  A.DISC_R = 5.0;
  function carryFrame(hip, f, rt) {
    var sway = Math.sin(A.walkPhase * Math.PI * 2) * (A.speed > 1 ? 0.9 : 0);
    var bob = Math.sin(A.walkPhase * Math.PI * 4) * (A.speed > 1 ? 0.5 : 0);
    var c = [
      hip[0] + f[0] * 8.4 + rt[0] * sway,
      hip[1] + 3.6 + bob,
      hip[2] + f[2] * 8.4 + rt[2] * sway
    ];
    /* 面は すこし 上を むいて、子どもが のぞきこむ 角度 */
    var tilt = U.rad(20);
    var n = U.V.norm([
      f[0] * Math.cos(tilt) + 0,
      Math.sin(tilt),
      f[2] * Math.cos(tilt)
    ]);
    return { c: c, n: n, grip: A.DISC_R + 1.1, sway: sway };
  }

  A.carryMatrix = function () {
    var f = fwd(), rt = right();
    var hip = [A.pos[0], A.pos[1] + hipY(), A.pos[2]];
    var cm = carryFrame(hip, f, rt);
    /* GLC.disc は 軸が +Y。法線 n に 軸を むける */
    return U.M.multiply(U.M.orient(cm.c, cm.n, [0, 1, 0]), U.M.rotateX(U.rad(90)));
  };
  A.handPos = function (which) {
    var p = pose();
    return (which === 'L') ? p.arms[0].wrist : p.arms[1].wrist;
  };

  /* ============================================================
     描画
     ============================================================ */
  A.render = function () {
    if (!A.visible || !mesh) return;
    var p = pose();
    var yawRad = -U.rad(A.yaw) + Math.PI / 2;

    /* どうたい */
    var torsoM = U.M.multiply(
      U.M.trs(p.hip, yawRad, 1),
      U.M.rotateX(p.lean)
    );
    Scene.drawObj(mesh, torsoM, idx.torso.first, idx.torso.count);

    /* あたま（首のつけね から） */
    var neck = [p.sho[0], p.sho[1] + 0.6, p.sho[2]];
    var headPitch = -U.rad(A.lookUp * 46) + p.lean * 0.35;
    var headM = U.M.multiply(
      U.M.trs(neck, yawRad, 1),
      U.M.rotateX(headPitch)
    );
    Scene.drawObj(mesh, headM, idx.head.first, idx.head.count);

    /* 脚 */
    for (var i = 0; i < 2; i++) {
      var L = p.legs[i];
      Scene.drawObj(mesh, U.M.bone(L.hip, L.knee, p.rt), idx.thigh.first, idx.thigh.count);
      Scene.drawObj(mesh, U.M.bone(L.knee, L.ankle, p.rt), idx.shin.first, idx.shin.count);
      var footM = U.M.multiply(U.M.trs(L.ankle, yawRad, 1), U.M.rotateX(L.toe));
      Scene.drawObj(mesh, footM, idx.foot.first, idx.foot.count);
    }

    /* 腕 */
    for (var j = 0; j < 2; j++) {
      var R2 = p.arms[j];
      Scene.drawObj(mesh, U.M.bone(R2.sho, R2.elbow, p.rt), idx.upper.first, idx.upper.count);
      Scene.drawObj(mesh, U.M.bone(R2.elbow, R2.wrist, p.rt), idx.fore.first, idx.fore.count);
      Scene.drawObj(mesh, U.M.trs(R2.wrist, yawRad, 1), idx.hand.first, idx.hand.count);
    }
  };

  global.Actor = A;
})(window);
