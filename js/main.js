'use strict';
/* ============================================================
 * main.js — キャンバス、ループ、入力、シーン遷移、保存。
 * ============================================================ */

const Game = {
  works: [],
  total: 0,
  _id: 1,
  count() { return this.total; },
  nextId() { return this._id++; },
  addWork(w) {
    this.works.push(w);
    this.total++;
    if (this.works.length > 24) this.works.shift();
    this.save();
  },
  save() {
    try {
      localStorage.setItem('okashi.street.v1', JSON.stringify({
        v: 1, total: this.total, id: this._id, works: this.works,
      }));
    } catch (e) { /* プライベートモード等は保存なしで続行 */ }
  },
  load() {
    try {
      const d = JSON.parse(localStorage.getItem('okashi.street.v1'));
      if (d && d.v === 1) {
        this.works = Array.isArray(d.works) ? d.works : [];
        this.total = d.total || this.works.length;
        this._id = d.id || this.works.length + 1;
      }
    } catch (e) { /* 壊れた保存は無視 */ }
  },
};

const Main = {
  canvas: null,
  ctx: null,
  w: 0, h: 0,
  scene: null,
  last: 0,
  pointerId: null,
  transition: { active: false, phase: 0, t: 0, focus: null, next: null },

  init() {
    Game.load();
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.resize());
    }
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));

    const c = this.canvas;
    c.addEventListener('pointerdown', e => this.onDown(e), { passive: false });
    c.addEventListener('pointermove', e => this.onMove(e), { passive: false });
    c.addEventListener('pointerup', e => this.onUp(e), { passive: false });
    c.addEventListener('pointercancel', e => this.onUp(e), { passive: false });
    c.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    c.addEventListener('contextmenu', e => e.preventDefault());

    this.scene = StreetScene;
    StreetScene.enter({});
    requestAnimationFrame(t => this.frame(t));
  },

  resize() {
    const w = window.innerWidth;
    const h = (window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w; this.h = h;
    this.canvas.width = Math.ceil(w * dpr);
    this.canvas.height = Math.ceil(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  },

  onDown(e) {
    e.preventDefault();
    SFX.unlock();
    if (this.transition.active) return;
    if (this.pointerId !== null) return; // 1本指のみ
    this.pointerId = e.pointerId;
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { }
    const p = this.pos(e);
    this.scene.pointerDown(p.x, p.y, this.w, this.h);
  },
  onMove(e) {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    if (this.transition.active) return;
    // 高頻度イベント(getCoalescedEventsがあれば全部使う)
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) {
      const p = this.pos(ev);
      if (this.scene.pointerMove) this.scene.pointerMove(p.x, p.y, this.w, this.h);
    }
  },
  onUp(e) {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.pointerId = null;
    const p = this.pos(e);
    if (!this.transition.active && this.scene.pointerUp) {
      this.scene.pointerUp(p.x, p.y, this.w, this.h);
    } else if (this.transition.active && this.scene === MakingScene) {
      SFX.drawLoopStop();
    }
  },

  /* ---------- シーン遷移(ズーム+クリーム色のフェード) ---------- */
  startTransition(focus, next) {
    this.transition = { active: true, phase: 1, t: 0, focus, next };
  },

  gotoMaking(shopId, resident, focus) {
    this.startTransition(focus, () => {
      MakingScene.enter(shopId, resident);
      this.scene = MakingScene;
    });
  },
  gotoStreet(celebrateShopId) {
    SFX.drawLoopStop();
    const focus = { x: this.w / 2, y: this.h / 2 };
    this.startTransition(focus, () => {
      this.scene = StreetScene;
      StreetScene.enter({ celebrate: celebrateShopId });
    });
  },

  frame(now) {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    SFX.tick(dt);
    const ctx = this.ctx;
    const w = this.w, h = this.h;

    this.scene.update(dt, w, h);

    // 遷移
    const tr = this.transition;
    let zoom = 1, fade = 0, focus = tr.focus || { x: w / 2, y: h / 2 };
    if (tr.active) {
      tr.t += dt;
      const D1 = 0.42, D2 = 0.38;
      if (tr.phase === 1) {
        const p = U.clamp(tr.t / D1, 0, 1);
        zoom = 1 + Ease.inCubic(p) * 0.7;
        fade = Ease.inCubic(p);
        if (p >= 1) {
          tr.next();
          tr.phase = 2; tr.t = 0;
          tr.focus = null;
          this.scene.update(0, w, h);
        }
      } else {
        const p = U.clamp(tr.t / D2, 0, 1);
        zoom = 1.06 - Ease.outCubic(p) * 0.06;
        fade = 1 - Ease.outCubic(p);
        focus = { x: w / 2, y: h / 2 };
        if (p >= 1) tr.active = false;
      }
    }

    ctx.save();
    if (zoom !== 1) {
      ctx.translate(focus.x, focus.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-focus.x, -focus.y);
    }
    this.scene.draw(ctx, w, h);
    ctx.restore();

    if (fade > 0) {
      ctx.fillStyle = `rgba(253,238,236,${fade})`;
      ctx.fillRect(0, 0, w, h);
      // フェード中のきらり
      if (fade > 0.25) {
        drawSparkle(ctx, w * 0.5, h * 0.45, 26 * fade, tr.t * 3, fade, '#FFE9A8');
        drawSparkle(ctx, w * 0.36, h * 0.6, 13 * fade, -tr.t * 2, fade * 0.8, '#FFD1E0');
        drawSparkle(ctx, w * 0.66, h * 0.35, 15 * fade, tr.t * 2.4, fade * 0.8, '#D6F0FF');
      }
    }

    requestAnimationFrame(t => this.frame(t));
  },
};

window.addEventListener('DOMContentLoaded', () => Main.init());
