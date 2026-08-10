/* Rainbow Glass Tower — album: keeps a small gallery of finished towers.
   Each completed pyramid is rendered to a pretty little keepsake thumbnail
   (a bead pyramid on a dark rounded card) and stashed in localStorage. */
'use strict';

window.Album = (function () {
  const STORE_KEY = 'rgt_album';
  const MAX_ITEMS = 12;
  const THUMB = 180;
  const TAU = Math.PI * 2;

  let btn = null, badge = null, overlay = null, grid = null, closeBtn = null;
  let cache = null; // lazily-loaded array of {ts, thumb, rows, cells}

  // ---------- storage ----------
  function load() {
    if (cache) return cache;
    cache = [];
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const parsed = raw && JSON.parse(raw);
      if (Array.isArray(parsed)) cache = parsed;
    } catch (e) { cache = []; }
    return cache;
  }

  function persist(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
    catch (e) { /* private mode / quota — the in-memory cache still works */ }
  }

  function css(tint, l) {
    if (window.Tint && typeof Tint.css === 'function') return Tint.css(tint, l);
    return `hsl(0 0% ${Math.round(l * 100)}%)`; // fallback if Tint isn't ready yet
  }

  // ---------- thumbnail rendering ----------
  function roundRectPath(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawBead(c, x, y, rad, tint) {
    // soft contact shadow so beads read as sitting objects, not flat dots
    c.beginPath();
    c.arc(x, y + rad * 0.2, rad * 1.05, 0, TAU);
    c.fillStyle = 'rgba(0,0,0,0.30)';
    c.fill();

    const grad = c.createRadialGradient(x - rad * 0.35, y - rad * 0.42, rad * 0.08,
                                         x, y, rad * 1.08);
    grad.addColorStop(0, css(tint, 0.88));
    grad.addColorStop(0.55, css(tint, 0.62));
    grad.addColorStop(1, css(tint, 0.40));
    c.beginPath();
    c.arc(x, y, rad, 0, TAU);
    c.fillStyle = grad;
    c.fill();
    c.lineWidth = Math.max(0.6, rad * 0.1);
    c.strokeStyle = 'rgba(255,255,255,0.32)';
    c.stroke();

    // tiny glossy highlight
    c.beginPath();
    c.arc(x - rad * 0.32, y - rad * 0.4, rad * 0.26, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.fill();
  }

  // grid is Game.getTintGrid() -> { rows, cells: [{r, i, h, c}] }
  function renderThumbnail(gridData) {
    const cv = document.createElement('canvas');
    cv.width = THUMB; cv.height = THUMB;
    const c = cv.getContext('2d');
    const rows = Math.max(1, (gridData && gridData.rows) || 1);
    const cells = (gridData && gridData.cells) || [];

    // dark rounded keepsake card
    c.save();
    roundRectPath(c, 0, 0, THUMB, THUMB, THUMB * 0.12);
    c.clip();
    const bg = c.createLinearGradient(0, 0, 0, THUMB);
    bg.addColorStop(0, '#2c2650');
    bg.addColorStop(1, '#15111f');
    c.fillStyle = bg;
    c.fillRect(0, 0, THUMB, THUMB);
    const glow = c.createRadialGradient(THUMB * 0.5, THUMB * 0.4, THUMB * 0.04,
                                         THUMB * 0.5, THUMB * 0.4, THUMB * 0.62);
    glow.addColorStop(0, 'rgba(255,255,255,0.12)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, THUMB, THUMB);
    c.restore();

    if (cells.length) {
      const pad = THUMB * 0.15;
      const spanX = (THUMB - pad * 2) / rows;
      const rowStep = (THUMB - pad * 2) / rows;
      const cx = THUMB / 2;
      const topY = pad + rowStep * 0.5;
      const rad = Math.max(2.2, Math.min(spanX, rowStep) * 0.42);

      const sorted = cells.slice().sort((a, b) => a.r - b.r || a.i - b.i);
      for (const cell of sorted) {
        const x = cx + (cell.i - cell.r / 2) * spanX;
        const y = topY + cell.r * rowStep;
        drawBead(c, x, y, rad, { h: cell.h, c: cell.c });
      }
    }

    // slim bright rim so the card reads crisply even shrunk to gallery size
    c.save();
    roundRectPath(c, 0.75, 0.75, THUMB - 1.5, THUMB - 1.5, THUMB * 0.12);
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(255,255,255,0.10)';
    c.stroke();
    c.restore();

    return cv.toDataURL('image/png');
  }

  // ---------- UI ----------
  function updateBadge() {
    if (!badge) return;
    const n = count();
    badge.textContent = n > 0 ? String(n) : '';
    badge.classList.toggle('hidden', n === 0);
  }

  function renderEmptyState() {
    const wrap = document.createElement('div');
    wrap.className = 'album-empty';
    wrap.style.cssText = 'grid-column:1/-1;display:flex;flex-direction:column;' +
      'align-items:center;gap:14px;padding:24px 8px;';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:10px;';
    for (let i = 0; i < 6; i++) {
      const f = document.createElement('div');
      f.style.cssText = 'width:64px;height:64px;border-radius:16px;' +
        'border:2px dashed rgba(255,255,255,0.2);background:rgba(255,255,255,0.04);' +
        'opacity:' + (0.6 - i * 0.06).toFixed(2) + ';';
      row.appendChild(f);
    }
    const msg = document.createElement('p');
    msg.textContent = 'タワーが完成すると、ここに思い出がたまるよ';
    msg.style.cssText = 'color:rgba(255,255,255,0.6);font-size:14px;' +
      'text-align:center;margin:0;';
    wrap.appendChild(row);
    wrap.appendChild(msg);
    grid.appendChild(wrap);
  }

  function renderGrid() {
    if (!grid) return;
    grid.innerHTML = '';
    const list = load();
    if (!list.length) { renderEmptyState(); return; }
    for (const item of list) {
      const img = document.createElement('img');
      img.src = item.thumb;
      img.className = 'album-thumb';
      img.alt = 'できあがったタワー';
      img.width = THUMB; img.height = THUMB;
      grid.appendChild(img);
    }
  }

  // ---------- public API ----------
  function init() {
    btn = document.getElementById('btn-album');
    badge = document.getElementById('album-badge');
    overlay = document.getElementById('album-overlay');
    grid = document.getElementById('album-grid');
    closeBtn = document.getElementById('album-close');
    if (btn) btn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (overlay) overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    updateBadge();
  }

  function save(gridData) {
    if (!gridData || !gridData.cells || !gridData.cells.length) return;
    const list = load();
    const thumb = renderThumbnail(gridData);
    list.unshift({ ts: Date.now(), thumb, rows: gridData.rows, cells: gridData.cells });
    if (list.length > MAX_ITEMS) list.length = MAX_ITEMS;
    cache = list;
    persist(list);
    updateBadge();
  }

  function open() {
    if (!overlay) return;
    renderGrid();
    overlay.classList.remove('hidden');
  }

  function close() {
    if (!overlay) return;
    overlay.classList.add('hidden');
  }

  function count() {
    return load().length;
  }

  return { init, save, open, close, count };
})();
