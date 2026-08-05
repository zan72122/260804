/* =========================================================
   camera.js — 注視点つきの 軌道カメラ
   ついていく / 肩ごしに寄る / しゃがみ / 天井を見あげる
   ========================================================= */
(function (global) {
  'use strict';

  var C = {
    /* 実際に使われる値（毎フレーム なめらかに 目標へ 近づく） */
    tx: 0, ty: 0, tz: 0,        // 注視点
    yaw: 90, pitch: -12,        // 度
    dist: 62, fov: 62,
    roll: 0,

    /* 目標値 */
    gx: 0, gy: 0, gz: 0,
    gyaw: 90, gpitch: -12, gdist: 62, gfov: 62,

    rate: 3.4,                  // 追従のはやさ
    yawRate: 2.6,
    free: false,                // true のあいだは Tweener などが 直接いじる

    eye: [0, 0, 0],
    VP: null, invVP: null,
    aspect: 1
  };

  C.snap = function () {
    C.tx = C.gx; C.ty = C.gy; C.tz = C.gz;
    C.yaw = C.gyaw; C.pitch = C.gpitch;
    C.dist = C.gdist; C.fov = C.gfov;
  };

  /* 目標を セットする（度・世界座標） */
  C.aim = function (target, yaw, pitch, dist, fov) {
    C.gx = target[0]; C.gy = target[1]; C.gz = target[2];
    if (yaw !== undefined && yaw !== null) C.gyaw = yaw;
    if (pitch !== undefined && pitch !== null) C.gpitch = pitch;
    if (dist !== undefined && dist !== null) C.gdist = dist;
    if (fov !== undefined && fov !== null) C.gfov = fov;
  };

  /* --- 目の位置を じかに 指定する（フィナーレ用） --- */
  C.mode = 'orbit';
  C.ex = 0; C.ey = 0; C.ez = 0;
  C.gex = 0; C.gey = 0; C.gez = 0;

  C.free = function (eye, target, fov) {
    C.mode = 'free';
    C.gex = eye[0]; C.gey = eye[1]; C.gez = eye[2];
    C.gx = target[0]; C.gy = target[1]; C.gz = target[2];
    if (fov !== undefined) C.gfov = fov;
  };
  C.orbit = function () { C.mode = 'orbit'; };
  C.snapFree = function () { C.ex = C.gex; C.ey = C.gey; C.ez = C.gez; C.snap(); };

  C.update = function (dt) {
    var r = C.rate;
    if (C.mode === 'free') {
      C.ex = U.approach(C.ex, C.gex, r, dt);
      C.ey = U.approach(C.ey, C.gey, r, dt);
      C.ez = U.approach(C.ez, C.gez, r, dt);
    }
    C.tx = U.approach(C.tx, C.gx, r, dt);
    C.ty = U.approach(C.ty, C.gy, r, dt);
    C.tz = U.approach(C.tz, C.gz, r, dt);
    C.yaw = U.approachAngle(C.yaw, C.gyaw, C.yawRate, dt);
    C.pitch = U.approach(C.pitch, C.gpitch, C.yawRate, dt);
    C.dist = U.approach(C.dist, C.gdist, r * 0.8, dt);
    C.fov = U.approach(C.fov, C.gfov, r * 0.8, dt);
  };

  /* 注視点・yaw・pitch・dist から 目の位置を 出す。
     yaw = カメラが 立っている 方位（度、注視点から見て）。
     pitch > 0 なら カメラが 上にいて 見おろす。 */
  C.limitR = 188;               // ドームの 外に 出ないように
  C.limitY = [null, null];      // [下限, 上限]

  C.computeEye = function () {
    var p = U.rad(C.pitch);
    var cp = Math.cos(p);
    var horiz = cp * C.dist;
    var ey = C.ty + Math.sin(p) * C.dist;

    /* 望みの 向き（水平） */
    var y = U.rad(C.yaw);
    var ox = Math.cos(y), oz = Math.sin(y);

    /* 壁に ぶつかるなら、向きは 変えずに 引きを みじかくする。
       （まわりこませると 見ている ほうが 変わって しまうので しない） */
    var b = C.tx * ox + C.tz * oz;
    var cc = C.tx * C.tx + C.tz * C.tz - C.limitR * C.limitR;
    var disc = b * b - cc;
    if (disc > 0) {
      var hMax = -b + Math.sqrt(disc);
      if (hMax < horiz) horiz = Math.max(20, hMax);
    } else {
      horiz = Math.max(20, horiz);
    }

    var ex = C.tx + ox * horiz;
    var ez = C.tz + oz * horiz;
    var rr = Math.hypot(ex, ez);
    if (rr > C.limitR) { var k = C.limitR / rr; ex *= k; ez *= k; }
    if (C.limitY[0] !== null && ey < C.limitY[0]) ey = C.limitY[0];
    if (C.limitY[1] !== null && ey > C.limitY[1]) ey = C.limitY[1];
    C.eye = [ex, ey, ez];
    return C.eye;
  };

  /* 行列を 作って しまっておく（ピックで 使う） */
  C.matrices = function (W, H, near, far) {
    C.aspect = W / H;
    var fov = U.rad(C.fov / (C.aspect > 1 ? 1.16 : 1.0));
    var proj = U.M.perspective(fov, C.aspect, near || 2, far || 480);
    var eye;
    if (C.mode === 'free') {
      var rr = Math.hypot(C.ex, C.ez);
      var ex = C.ex, ez = C.ez;
      if (rr > C.limitR) { var k = C.limitR / rr; ex *= k; ez *= k; }
      eye = C.eye = [ex, C.ey, ez];
    } else {
      eye = C.computeEye();
    }
    var view = U.M.lookAt(eye, [C.tx, C.ty, C.tz], [0, 1, 0]);
    C.VP = U.M.multiply(proj, view);
    C.invVP = U.M.invert(C.VP);
    return C.VP;
  };

  global.Cam = C;
})(window);
