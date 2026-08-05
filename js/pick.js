/* =========================================================
   pick.js — 画面のゆびを 3D空間に あてる
   4歳の指は ねらいが あまい。あたり判定は 見た目より 大きめ。
   ========================================================= */
(function (global) {
  'use strict';

  var P = {};

  /* 画面座標(CSSピクセル) → ワールドの レイ */
  P.ray = function (sx, sy) {
    var w = global.innerWidth, h = global.innerHeight;
    var ndcX = (sx / w) * 2 - 1;
    var ndcY = 1 - (sy / h) * 2;
    var inv = Cam.invVP;
    if (!inv) return null;
    var a = U.M.project(inv, [ndcX, ndcY, -1]);
    var b = U.M.project(inv, [ndcX, ndcY, 1]);
    var d = U.V.norm(U.V.sub(b, a));
    return { o: a, d: d };
  };

  /* レイと 水平面 y=py の 交点 */
  P.floorHit = function (ray, py) {
    if (!ray || Math.abs(ray.d[1]) < 1e-6) return null;
    var t = (py - ray.o[1]) / ray.d[1];
    if (t < 0) return null;
    return [ray.o[0] + ray.d[0] * t, py, ray.o[2] + ray.d[2] * t];
  };

  /* レイと 球 の 交点までの 距離（なければ -1） */
  P.sphereHit = function (ray, c, r) {
    var oc = U.V.sub(ray.o, c);
    var b = U.V.dot(oc, ray.d);
    var cc = U.V.dot(oc, oc) - r * r;
    var h = b * b - cc;
    if (h < 0) return -1;
    h = Math.sqrt(h);
    var t = -b - h;
    if (t < 0) t = -b + h;
    return t < 0 ? -1 : t;
  };

  /* レイと 円板（中心 c・法線 n・半径 r）の 交点 */
  P.diskHit = function (ray, c, n, r) {
    var dn = U.V.dot(ray.d, n);
    if (Math.abs(dn) < 1e-6) return null;
    var t = U.V.dot(U.V.sub(c, ray.o), n) / dn;
    if (t < 0) return null;
    var p = [ray.o[0] + ray.d[0] * t, ray.o[1] + ray.d[1] * t, ray.o[2] + ray.d[2] * t];
    var v = U.V.sub(p, c);
    var d2 = U.V.dot(v, v);
    if (d2 > r * r) return null;
    return { p: p, t: t, local: v };
  };

  /* 候補のうち いちばん「指に近い」ものを 選ぶ。
     ねらいが あまくても 拾えるよう、画面上の 距離でも 評価する。 */
  P.pickBest = function (sx, sy, items) {
    var ray = P.ray(sx, sy);
    if (!ray) return null;
    var best = null, bestScore = 1e9;
    var h = global.innerHeight;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.enabled === false) continue;
      var t = P.sphereHit(ray, it.c, it.r);
      var score;
      if (t >= 0) {
        score = t * 0.001;                         // 直撃なら 最優先
      } else {
        var sp = P.toScreen(it.c);
        if (!sp) continue;
        var dpx = Math.hypot(sp[0] - sx, sp[1] - sy);
        var slack = it.slack || (h * 0.11);        // 画面上の 甘さ
        if (dpx > slack) continue;
        score = 1 + dpx / slack;
      }
      if (score < bestScore) { bestScore = score; best = it; }
    }
    return best;
  };

  /* ワールド座標 → 画面座標(CSSピクセル)。カメラの後ろなら null */
  P.toScreen = function (p) {
    if (!Cam.VP) return null;
    var m = Cam.VP;
    var w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    if (w <= 0.0001) return null;
    var x = (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w;
    var y = (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w;
    return [(x * 0.5 + 0.5) * global.innerWidth, (0.5 - y * 0.5) * global.innerHeight];
  };

  global.Pick = P;
})(window);
