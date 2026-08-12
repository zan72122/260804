/* にじいろタウン - 制作シーン：クレヨン選択 → 一本の線 → さいごに、ぽん！ → 育つ */
window.NT = window.NT || {};
(function () {
  const U = NT.U;

  const M = {
    state: 'idle',   // idle | choose | draw | pon | grow
    siteId: null, site: null, gen: null,
    colorIdx: 0,
    pts: [],          // ワールド座標 {x,y,w}
    drawing: false,
    art: null, record: null,
    growT: 0, growDur: 1.7,
    heroDone: false,
    onCommit: null    // main が設定
  };

  let inkCtx = null;
  let last = null;   // {sx,sy,t}
  let curW = 15;     // スクリーンpx
  let sparkleThrottle = 0;

  M.bindInk = function (ctx) { inkCtx = ctx; };

  /* ---------- クレヨンUI ---------- */
  function crayonSVG(c, i) {
    const id = 'cr' + i;
    return `<svg viewBox="0 0 90 160">
      <defs>
        <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${c.dark}"/>
          <stop offset="0.35" stop-color="${c.base}"/>
          <stop offset="0.75" stop-color="${c.light}"/>
          <stop offset="1" stop-color="${c.base}"/>
        </linearGradient>
        ${c.rainbow ? `<linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ff8fa8"/><stop offset="0.25" stop-color="#ffca5f"/>
          <stop offset="0.5" stop-color="#a9e8b8"/><stop offset="0.75" stop-color="#9fd8ff"/>
          <stop offset="1" stop-color="#cdb3ff"/></linearGradient>` : ''}
      </defs>
      <path d="M45 6 L62 44 L28 44 Z" fill="${c.rainbow ? `url(#${id}r)` : c.base}" stroke="${c.dark}" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="24" y="42" width="42" height="108" rx="10" fill="${c.rainbow ? `url(#${id}r)` : `url(#${id}b)`}" stroke="${c.dark}" stroke-width="2.5"/>
      <rect x="24" y="76" width="42" height="40" rx="6" fill="rgba(255,255,255,0.92)" stroke="${c.dark}" stroke-width="2"/>
      <path d="M45 86 c-5 -6 -14 -1 -9 6 c3 4 9 8 9 8 c0 0 6 -4 9 -8 c5 -7 -4 -12 -9 -6 Z" fill="${c.rainbow ? '#ffca5f' : c.base}"/>
      <rect x="30" y="50" width="7" height="94" rx="3.5" fill="rgba(255,255,255,0.5)"/>
    </svg>`;
  }

  function showCrayons() {
    const bar = document.getElementById('crayonBar');
    const row = document.getElementById('crayonRow');
    row.innerHTML = '';
    M.gen.crayons.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'crayonBtn';
      b.innerHTML = crayonSVG(c, i);
      b.addEventListener('pointerdown', ev => {
        ev.stopPropagation();
        NT.audio.init(); NT.audio.select(i);
        M.colorIdx = i;
        [...row.children].forEach(el => el.classList.remove('sel'));
        b.classList.add('sel');
        setTimeout(() => {
          bar.classList.add('hidden');
          M.state = 'draw';
        }, 240);
      });
      row.appendChild(b);
    });
    bar.classList.remove('hidden');
  }

  /* ---------- シーン制御 ---------- */
  M.enter = function (siteId) {
    M.siteId = siteId;
    M.site = NT.town.SITES[siteId];
    M.gen = NT.generators[siteId];
    M.state = 'choose';
    M.pts = [];
    M.art = null;
    M.drawing = false;
    clearInk();
    showCrayons();
  };

  M.exit = function () {
    M.state = 'idle';
    document.getElementById('crayonBar').classList.add('hidden');
    document.getElementById('ponBanner').classList.add('hidden');
    clearInk();
    NT.audio.drawStop();
  };

  function clearInk() {
    if (!inkCtx) return;
    const cv = inkCtx.canvas;
    inkCtx.save();
    inkCtx.setTransform(1, 0, 0, 1, 0, 0);
    inkCtx.clearRect(0, 0, cv.width, cv.height);
    inkCtx.restore();
  }

  M.pal = function () { return M.gen.crayons[M.colorIdx]; };

  /* ---------- 入力（main から呼ばれる） ---------- */
  // 地区ごとの描ける範囲（花壇からはみ出さない等）
  function strokeBounds(site) {
    const m = 40;
    let yMax;
    if (site.id === 'cake') yMax = site.counterY - 10;
    else if (site.id === 'house') yMax = site.groundY - 46;
    else yMax = site.groundY - 6;
    return {
      x0: site.drawRect.x - m, x1: site.drawRect.x + site.drawRect.w + m,
      y0: site.id === 'cake' ? site.drawRect.y + 6 : site.drawRect.y - 50,
      y1: yMax
    };
  }

  M.onDown = function (sx, sy, wx, wy, cam) {
    if (M.state === 'draw') {
      M.drawing = true;
      last = { sx, sy, t: performance.now() };
      curW = 15;
      const b = strokeBounds(M.site);
      const cx = U.clamp(wx, b.x0, b.x1);
      const cy = U.clamp(wy, b.y0, b.y1);
      M.pts = [{ x: cx, y: cy, w: curW / cam.s }];
      const pal = M.pal();
      NT.stroke.dab(inkCtx, sx, sy, curW, pal.rainbow ? NT.stroke.rainbowPal(0) : pal, Math.random);
      NT.audio.drawMove(0.3);
    } else if (M.state === 'pon') {
      placePon(wx, wy);
    }
  };

  M.onMove = function (events, cam, toWorld) {
    if (M.state !== 'draw' || !M.drawing) return;
    const pal = M.pal();
    for (const ev of events) {
      const sx = ev.x, sy = ev.y;
      const d = U.dist(last.sx, last.sy, sx, sy);
      if (d < 2) continue;
      const now = ev.t || performance.now();
      const dtms = Math.max(1, now - last.t);
      const v = d / dtms; // px/ms
      const targetW = U.clamp(19 - 7.5 * Math.min(1.5, v), 9, 23);
      curW = U.lerp(curW, targetW, 0.28);

      const p = pal.rainbow ? NT.stroke.rainbowPal(M.pts.length) : pal;
      NT.stroke.segment(inkCtx, last.sx, last.sy, sx, sy, curW, p, Math.random);

      const w = toWorld(sx, sy);
      const b = strokeBounds(M.site);
      M.pts.push({
        x: U.clamp(w.x, b.x0, b.x1),
        y: U.clamp(w.y, b.y0, b.y1),
        w: curW / cam.s
      });
      NT.audio.drawMove(v);
      last = { sx, sy, t: now };
    }
  };

  M.onUp = function () {
    if (M.state === 'draw' && M.drawing) {
      M.drawing = false;
      NT.audio.drawStop();
      if (M.pts.length >= 1) {
        M.state = 'pon';
        document.getElementById('ponBanner').classList.remove('hidden');
      }
    }
  };

  function inflate(r, m) { return { x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2 }; }

  // リサイズ／回転時：ワールド座標のストロークをインクへ再投影
  M.redrawInk = function (toScreenFn, cam) {
    if (!inkCtx) return;
    clearInk();
    if ((M.state !== 'draw' && M.state !== 'pon') || !M.pts.length) return;
    const pal = M.pal();
    if (M.pts.length === 1) {
      const s0 = toScreenFn(M.pts[0].x, M.pts[0].y);
      NT.stroke.dab(inkCtx, s0.x, s0.y, (M.pts[0].w || 14) * cam.s, pal.rainbow ? NT.stroke.rainbowPal(0) : pal, Math.random);
      return;
    }
    for (let i = 1; i < M.pts.length; i++) {
      const a = toScreenFn(M.pts[i - 1].x, M.pts[i - 1].y);
      const b = toScreenFn(M.pts[i].x, M.pts[i].y);
      const p = pal.rainbow ? NT.stroke.rainbowPal(i) : pal;
      NT.stroke.segment(inkCtx, a.x, a.y, b.x, b.y, (M.pts[i].w || 14) * cam.s, p, Math.random);
    }
  };

  /* ---------- ぽん！ → 育つ ---------- */
  function placePon(wx, wy) {
    const b = strokeBounds(M.site);
    const pon = { x: U.clamp(wx, b.x0 + 10, b.x1 - 10), y: U.clamp(wy, b.y0 + 10, b.y1) };

    // ストロークを保存用に整える（世界座標・等間隔化、個性は保持）
    let pts = M.pts;
    if (pts.length > 2) {
      pts = U.resample(pts, 5);
      if (pts.length > 340) pts = U.resample(M.pts, U.polylineLength(M.pts) / 340);
    }
    M.record = {
      colorIdx: M.colorIdx,
      seed: (Math.floor(Math.random() * 0xffffff) ^ Date.now()) >>> 0,
      pts, pon
    };
    M.art = NT.town.buildArtwork(M.siteId, M.record);
    for (const p of M.art.parts) p.popped = false;
    M.growT = 0;
    M.heroDone = false;
    M.state = 'grow';
    document.getElementById('ponBanner').classList.add('hidden');

    NT.audio.pon();
    NT.audio.haptic(12);
    NT.fx.ring(pon.x, pon.y, { r: 8, r2: 60 });
    NT.fx.sparkle(pon.x, pon.y, { n: 8 });
    setTimeout(() => NT.audio.grow(1.3), 200);

    // インクを消す（ストロークはアートワークのパーツとして即再表示される）
    clearInk();
  }

  M.update = function (dt) {
    sparkleThrottle -= dt;
    if (M.state !== 'grow' || !M.art) return;
    M.growT += dt;
    const prog = Math.min(1, M.growT / M.growDur);
    for (const p of M.art.parts) {
      if (!p.popped && prog >= p.t0) {
        p.popped = true;
        if (p.popAt) {
          NT.fx.sparkle(p.popAt.x, p.popAt.y, { n: 3, r: 4 });
          if (sparkleThrottle <= 0) { NT.audio.sparkle(); sparkleThrottle = 0.12; }
        }
        if (p.hero) {
          NT.audio.bloom();
          NT.audio.haptic(8);
          const h = M.art.meta.heroPos;
          NT.fx.ring(h.x, h.y, { r: 12, r2: 90, color: 'rgba(255,240,180,0.95)' });
          NT.fx.sparkle(h.x, h.y, { n: 10, r: 6 });
          M.heroDone = true;
        }
      }
    }
    if (M.growT >= M.growDur + 0.35) {
      const rec = M.record, sid = M.siteId;
      M.art = null;
      M.state = 'idle';
      if (M.onCommit) M.onCommit(sid, rec);
    }
  };

  /* ---------- 描画 ---------- */
  // ワールド変換済み ctx（town.draw のあとに呼ばれる）
  M.drawWorld = function (ctx, t) {
    if (M.state === 'pon' && M.pts.length) {
      // 線がやわらかく明滅して「あと一点」を誘う
      const pulse = 0.35 + (Math.sin(t * 5) + 1) * 0.2;
      NT.stroke.drawGlow(ctx, M.pts, pulse, 26, 'rgba(255,255,255,0.9)');
    }
    if (M.state === 'grow' && M.art) {
      const prog = Math.min(1, M.growT / M.growDur);
      // 線を走る光
      if (prog < 0.45 && M.pts.length > 1) {
        const sweep = prog / 0.45;
        const n = Math.max(2, Math.floor(M.pts.length * sweep));
        NT.stroke.drawGlow(ctx, M.pts.slice(0, n), 0.7 * (1 - sweep * 0.6), 30, 'rgba(255,250,220,0.95)');
      }
      for (const p of M.art.parts) {
        const k = U.clamp((prog - p.t0) / (p.dur || 0.2), 0, 1);
        if (k > 0) p.draw(ctx, k, t);
      }
    }
  };

  // スクリーン空間のオーバーレイ（フォーカスのビネット）
  M.drawScreen = function (ctx, W, H, project) {
    if (M.state === 'idle') return;
    const r = M.site.drawRect;
    const c = project(r.x + r.w / 2, r.y + r.h / 2);
    const rad = Math.max(W, H) * 0.75;
    const g = ctx.createRadialGradient(c.x, c.y, rad * 0.38, c.x, c.y, rad);
    g.addColorStop(0, 'rgba(255,240,250,0)');
    g.addColorStop(1, 'rgba(240,190,225,0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };

  NT.make = M;
})();
