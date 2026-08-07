/* =========================================================================
   hint.js — 文字を使わない操作ガイド
   何もしないでいると，やってほしい指の動きを「おばけの手」がなぞって見せる。
   ========================================================================= */
(function (global) {
  'use strict';

  var Hint = {
    canvas: null, ctx: null, w: 0, h: 0, dpr: 1,
    idle: 0, show: 0, phase: 0,
    cfg: null, delay: 2.4
  };

  Hint.init = function (canvas) {
    Hint.canvas = canvas;
    Hint.ctx = canvas.getContext('2d');
  };

  Hint.resize = function (w, h, dpr) {
    Hint.w = w; Hint.h = h; Hint.dpr = dpr;
    Hint.canvas.width = Math.floor(w * dpr);
    Hint.canvas.height = Math.floor(h * dpr);
  };

  // cfg: {type, at:Vector3|fn, dir:{x,y}, len, radius, delay}
  Hint.set = function (cfg) {
    Hint.cfg = cfg;
    Hint.idle = 0; Hint.phase = 0;
    Hint.delay = cfg && cfg.delay != null ? cfg.delay : 2.4;
  };
  Hint.clear = function () { Hint.cfg = null; Hint.show = 0; };
  Hint.poke = function () { Hint.idle = 0; };

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // かわいい指さしの手（白／濃い輪郭）
  function drawHand(g, x, y, s, rot, press) {
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    g.scale(s, s);
    g.lineJoin = 'round';
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(60,38,10,.55)';
    g.fillStyle = 'rgba(255,255,255,.95)';

    // 手のひら
    g.beginPath();
    g.moveTo(-17, 22);
    g.bezierCurveTo(-24, 40, -18, 60, 0, 62);
    g.bezierCurveTo(20, 62, 26, 44, 24, 24);
    g.bezierCurveTo(24, 14, 12, 12, 8, 18);
    g.lineTo(8, 8);
    g.bezierCurveTo(8, 0, -2, 0, -2, 8);
    g.lineTo(-2, 20);
    g.closePath();
    g.fill(); g.stroke();

    // 人差し指
    var fl = 34 - (press || 0) * 6;
    roundRect(g, -9, -fl, 14, fl + 22, 7);
    g.fill(); g.stroke();

    // 指先の光
    g.beginPath();
    g.arc(-2, -fl + 8, 4.6, 0, 7);
    g.fillStyle = 'rgba(255,236,170,.9)';
    g.fill();
    g.restore();
  }

  function ripple(g, x, y, r, a) {
    g.beginPath(); g.arc(x, y, r, 0, 7);
    g.strokeStyle = 'rgba(255,240,180,' + a + ')';
    g.lineWidth = 5; g.stroke();
  }

  function arrow(g, x0, y0, x1, y1, a) {
    g.strokeStyle = 'rgba(255,238,170,' + a + ')';
    g.lineWidth = 11; g.lineCap = 'round';
    g.setLineDash([16, 14]);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.setLineDash([]);
    var ang = Math.atan2(y1 - y0, x1 - x0);
    g.fillStyle = 'rgba(255,238,170,' + a + ')';
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x1 - Math.cos(ang - 0.5) * 26, y1 - Math.sin(ang - 0.5) * 26);
    g.lineTo(x1 - Math.cos(ang + 0.5) * 26, y1 - Math.sin(ang + 0.5) * 26);
    g.closePath(); g.fill();
  }

  var _tmp = {};

  Hint.update = function (dt, camera, active) {
    var g = Hint.ctx;
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, Hint.canvas.width, Hint.canvas.height);
    if (!Hint.cfg || !active) { Hint.show = U.damp(Hint.show, 0, 8, dt); if (Hint.show < 0.01) return; }

    Hint.idle += dt;
    var want = (Hint.cfg && active && Hint.idle > Hint.delay) ? 1 : 0;
    Hint.show = U.damp(Hint.show, want, 5, dt);
    if (Hint.show < 0.012) return;
    Hint.phase += dt;

    var c = Hint.cfg;
    if (!c) return;
    var pt;
    if (c.at && c.at.isVector3) pt = U.toScreen(c.at, camera, Hint.w, Hint.h, _tmp);
    else if (typeof c.at === 'function') pt = c.at();
    else pt = c.at || { x: Hint.w / 2, y: Hint.h / 2 };

    g.setTransform(Hint.dpr, 0, 0, Hint.dpr, 0, 0);
    g.globalAlpha = Hint.show * (c.alpha == null ? 1 : c.alpha);

    var S = Math.min(Hint.w, Hint.h) / 640;
    S = U.clamp(S, 0.62, 1.5);
    var hs = 0.92 * S;

    if (c.type === 'tap' || c.type === 'press') {
      var t = (Hint.phase % 1.5) / 1.5;
      var press = t < 0.28 ? U.easeOut(t / 0.28) : (t < 0.5 ? 1 - U.easeOut((t - 0.28) / 0.22) : 0);
      for (var i = 0; i < 2; i++) {
        var rt = ((Hint.phase + i * 0.55) % 1.5) / 1.5;
        if (rt < 0.8) ripple(g, pt.x, pt.y, 22 * S + rt * 70 * S, (1 - rt / 0.8) * 0.55);
      }
      drawHand(g, pt.x + 6 * S, pt.y + 10 * S, hs, 0.14, press);
    } else if (c.type === 'swipe') {
      var d = c.dir || { x: 0, y: -1 };
      var len = (c.len || 150) * S;
      var t2 = (Hint.phase % 1.8) / 1.8;
      var e = t2 < 0.72 ? U.easeInOut(t2 / 0.72) : 0;
      var fade = t2 < 0.72 ? 1 : 1 - (t2 - 0.72) / 0.28;
      arrow(g, pt.x, pt.y, pt.x + d.x * len, pt.y + d.y * len, 0.55);
      drawHand(g, pt.x + d.x * len * e + 6 * S, pt.y + d.y * len * e + 10 * S, hs, 0.14, 0.6);
      g.globalAlpha = Hint.show * fade;
    } else if (c.type === 'circle') {
      var R = (c.radius || 80) * S;
      var t3 = (Hint.phase % 2.2) / 2.2;
      var a0 = t3 * Math.PI * 2 - Math.PI / 2;
      // 円のガイド
      g.strokeStyle = 'rgba(255,238,170,.5)';
      g.lineWidth = 10; g.setLineDash([18, 16]);
      g.beginPath(); g.arc(pt.x, pt.y, R, 0, 7); g.stroke();
      g.setLineDash([]);
      // 進む矢じり
      for (var k = 0; k < 3; k++) {
        var aa = a0 - k * 0.4;
        var ax = pt.x + Math.cos(aa) * R, ay = pt.y + Math.sin(aa) * R;
        g.fillStyle = 'rgba(255,240,180,' + (0.7 - k * 0.2) + ')';
        g.save(); g.translate(ax, ay); g.rotate(aa + Math.PI / 2);
        g.beginPath(); g.moveTo(0, -13); g.lineTo(-10, 8); g.lineTo(10, 8); g.closePath(); g.fill();
        g.restore();
      }
      drawHand(g, pt.x + Math.cos(a0) * R + 6 * S, pt.y + Math.sin(a0) * R + 10 * S, hs, 0.14, 0.7);
    } else if (c.type === 'drag') {
      var d2 = c.dir || { x: 1, y: 0 };
      var len2 = (c.len || 160) * S;
      var t4 = (Hint.phase % 2.0) / 2.0;
      var e2 = t4 < 0.75 ? U.easeInOut(t4 / 0.75) : 0;
      arrow(g, pt.x, pt.y, pt.x + d2.x * len2, pt.y + d2.y * len2, 0.5);
      drawHand(g, pt.x + d2.x * len2 * e2 + 6 * S, pt.y + d2.y * len2 * e2 + 10 * S, hs, 0.14, 0.9);
    }
    g.globalAlpha = 1;
  };

  global.Hint = Hint;
})(window);
