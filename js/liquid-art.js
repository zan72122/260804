/* Rainbow Glass Tower — cached liquid-art sprite factory.

   Stateless, pure rendering utilities built on top of window.Tint. Every
   glass in a 171-glass tower can now hold a different colour, so building a
   fresh gradient sprite per glass per frame would be real time lost on an
   iPad. Instead every sprite this module draws is cached by colour (plus the
   handful of numbers that affect its pixels) and reused until evicted or
   until clearCache() is called (resize / theme change).

   Shapes are ported as-is from the old js/game.js (bowlPath, buildLiquidSprite,
   buildStreamSprite) — only the colour source changed, from a themed gradient
   to Tint.cssStops(tint). */
'use strict';

window.LiquidArt = (function () {
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // coupe profile defaults — identical to js/game.js, do not change without
  // updating the contract (§5)
  const BOWL_H = 0.52;              // bowl depth / glass height
  const BOWL_TIP = 0.26;            // bowl half-width at its base / rim half-width
  const BOWL_RY = BOWL_H / Math.sin(Math.acos(BOWL_TIP));

  const LQ_PAD = 2;                 // CSS px padding baked around the bowl sprite

  const BOWL_MAX = 48;              // LRU bound, per contract
  const STREAM_MAX = 96;            // small key space (tint x core), generous headroom

  // ---------- tiny LRU maps (Map preserves insertion order; re-set moves to end) ----------
  const bowlCache = new Map();
  const streamCache = new Map();

  function touch(map, key) {
    const v = map.get(key);
    map.delete(key);
    map.set(key, v);
    return v;
  }
  function evict(map, max) {
    while (map.size > max) map.delete(map.keys().next().value);
  }

  function resolveOpts(opts) {
    const bowlH = (opts && opts.bowlH != null) ? opts.bowlH : BOWL_H;
    const bowlTip = (opts && opts.bowlTip != null) ? opts.bowlTip : BOWL_TIP;
    const bowlRy = (opts && opts.bowlRy != null) ? opts.bowlRy
      : bowlH / Math.sin(Math.acos(bowlTip));
    return { bowlH, bowlTip, bowlRy };
  }

  // 5-stop vertical gradient built from Tint.cssStops, top->bottom
  function tintGradient(c, tint, y0, y1) {
    const grad = c.createLinearGradient(0, y0, 0, y1);
    const stops = Tint.cssStops(tint);
    for (let k = 0; k < stops.length; k++) grad.addColorStop(k / (stops.length - 1), stops[k]);
    return grad;
  }

  // ---------- coupe bowl silhouette (ported from js/game.js bowlPath) ----------
  function bowlPath(c, w, h, inset, bowlRy, bowlHFrac) {
    const hw = w * 0.5 - inset, ry = h * bowlRy - inset;
    const bh = h * bowlHFrac;
    const th = Math.asin(clamp(bh / ry, 0, 1));
    c.beginPath();
    c.moveTo(hw, 0);
    c.ellipse(0, 0, hw, ry, 0, 0, th);
    c.lineTo(-hw * Math.cos(th), bh);
    c.ellipse(0, 0, hw, ry, 0, Math.PI - th, Math.PI);
    c.closePath();
  }

  // Bowl liquid sprite for one tint — cached by (Tint.key, w, h, dpr, geometry).
  // Draw origin inside the sprite is the rim centre, offset (pad, pad) from
  // the sprite's top-left, so the caller never has to guess it.
  function bowlSprite(tint, glassW, glassH, dpr, opts) {
    tint = tint || Tint.WHITE;
    dpr = dpr || 1;
    const o = resolveOpts(opts);
    const key = Tint.key(tint) + '|' + glassW + '|' + glassH + '|' + dpr +
                '|' + o.bowlH + '|' + o.bowlRy;

    const hit = bowlCache.get(key);
    if (hit) return touch(bowlCache, key);

    const pad = LQ_PAD;                       // CSS px
    const bowlHCss = glassH * o.bowlH;         // CSS px height of the bowl region
    const cw = Math.max(2, Math.ceil((glassW + pad * 2) * dpr));
    const ch = Math.max(2, Math.ceil((bowlHCss + pad * 2) * dpr));
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const c = canvas.getContext('2d');
    c.scale(dpr, dpr);
    c.translate(glassW / 2 + pad, pad);        // origin = rim centre
    c.fillStyle = tintGradient(c, tint, 0, bowlHCss);
    bowlPath(c, glassW, glassH, 1.1, o.bowlRy, o.bowlH);
    c.fill();

    const entry = { canvas, pad, scale: dpr, bowlH: bowlHCss };
    bowlCache.set(key, entry);
    evict(bowlCache, BOWL_MAX);
    return entry;
  }

  // ---------- falling-stream ribbon (ported from js/game.js buildStreamSprite) ----------
  function drawStreamShape(c, tint, core) {
    c.clearRect(0, 0, 24, 64);
    const stops = Tint.cssStops(tint);
    const grad = c.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(1, stops[stops.length - 1]);
    // soft outer bloom so the ribbon reads against the dark sky
    c.globalAlpha = 0.35;
    c.fillStyle = grad;
    c.fillRect(1, 2, 22, 60);
    c.globalAlpha = 1;
    c.beginPath();
    c.moveTo(4, 6); c.quadraticCurveTo(4, 0, 12, 0); c.quadraticCurveTo(20, 0, 20, 6);
    c.lineTo(20, 58); c.quadraticCurveTo(20, 64, 12, 64); c.quadraticCurveTo(4, 64, 4, 58);
    c.closePath();
    c.fill();
    if (core) {
      c.fillStyle = 'rgba(255,255,255,0.38)';
      c.fillRect(9, 3, 6, 58);
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.fillRect(10.8, 3, 2.4, 58);
    }
  }

  // 24x64 vertical ribbon sprite for one tint — cached by (Tint.key, core).
  function streamSprite(tint, core) {
    tint = tint || Tint.WHITE;
    core = !!core;
    const key = Tint.key(tint) + '|' + (core ? 1 : 0);

    const hit = streamCache.get(key);
    if (hit) return touch(streamCache, key);

    const canvas = document.createElement('canvas');
    canvas.width = 24; canvas.height = 64;
    drawStreamShape(canvas.getContext('2d'), tint, core);

    streamCache.set(key, canvas);
    evict(streamCache, STREAM_MAX);
    return canvas;
  }

  // Small solid swatch/gradient fill — used by album thumbnails & palette preview.
  function tintFill(ctx, tint, x, y, w, h) {
    ctx.fillStyle = tintGradient(ctx, tint || Tint.WHITE, y, y + h);
    ctx.fillRect(x, y, w, h);
  }

  function clearCache() {
    bowlCache.clear();
    streamCache.clear();
  }

  function stats() {
    return { bowl: bowlCache.size, stream: streamCache.size };
  }

  return { bowlSprite, streamSprite, tintFill, clearCache, stats };
})();
