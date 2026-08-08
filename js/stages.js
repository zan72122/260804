/* ------------------------------------------------------------------
   stages.js — 遊びの流れ
   まるめる → のばす → まわす → とばす → ソース → ぐざい →
   ピールへ → 窯へスッ → やける → くるっ → 手前へスッ → カット → できた！
   失敗は用意しない。どの操作も必ず気持ちよく着地する。
------------------------------------------------------------------ */
(function () {
  'use strict';
  const PZ = window.PZ;
  const U = PZ.util;
  const A = PZ.art;
  const C = A.colors;
  const S = PZ.snd;
  const TAU = U.TAU;

  const AUTO_HELP = 15;   // これだけ触らなければ職人がやってみせる

  /* ================================================================
     レシピ（文字は使わない・絵だけ）
  ================================================================ */
  const RECIPES = (PZ.RECIPES = [
    {
      id: 'margherita', sauce: true,
      items: ['cheese', 'tomato', 'basil'],
      icon: ['cheese', 'tomato', 'basil'],
      need: 6
    },
    {
      id: 'corn', sauce: true,
      items: ['cheese', 'corn'],
      icon: ['corn', 'cheese', 'corn'],
      need: 8
    },
    {
      id: 'veggie', sauce: true,
      items: ['cheese', 'pepperR', 'pepperY', 'pepperG', 'broccoli', 'corn'],
      icon: ['pepperR', 'pepperG', 'corn', 'pepperY', 'broccoli', 'cheese'],
      need: 8
    },
    {
      id: 'free', sauce: true, rainbow: true,
      items: ['cheese', 'tomato', 'corn', 'pepperR', 'pepperY', 'pepperG', 'basil', 'olive', 'broccoli', 'mushroom'],
      icon: ['pepperR', 'corn', 'basil', 'tomato', 'olive', 'cheese'],
      need: 5
    }
  ]);

  const BOWL_COL = {
    cheese: '#f6e7c4', tomato: '#f0b0a4', basil: '#b8dcae', corn: '#fbe6a8',
    pepperR: '#f5b8ad', pepperY: '#fbe4a6', pepperG: '#b6dfae', olive: '#cfcbb6',
    broccoli: '#b6dcae', mushroom: '#e6d8c0'
  };

  /* ================================================================
     小道具
  ================================================================ */
  function drawLadle(ctx, x, y, ang, sc, sauceAmt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(sc, sc);
    // 柄
    ctx.strokeStyle = '#c9d3dc'; ctx.lineWidth = 15; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-16, -120); ctx.stroke();
    ctx.strokeStyle = U.css(C.pinkDeep); ctx.lineWidth = 19;
    ctx.beginPath(); ctx.moveTo(-10, -74); ctx.lineTo(-16, -122); ctx.stroke();
    // さじ
    const g = ctx.createLinearGradient(0, -34, 0, 34);
    g.addColorStop(0, '#eef4f9'); g.addColorStop(1, '#a8b6c2');
    ctx.fillStyle = g;
    U.ellipse(ctx, 0, 0, 40, 30); ctx.fill();
    ctx.fillStyle = U.css(C.sauce, 0.9 * sauceAmt);
    U.ellipse(ctx, 0, 2, 31, 22); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
    U.ellipse(ctx, 0, 0, 40, 30); ctx.stroke();
    ctx.restore();
  }

  function drawDoughBowl(ctx, x, y, r, hasBall) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    U.ellipse(ctx, x, y + r * 0.36, r * 1.04, r * 0.4); ctx.fill();
    const g = ctx.createLinearGradient(0, y - r, 0, y + r * 0.5);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#e8d8c0');
    ctx.fillStyle = g;
    U.ellipse(ctx, x, y, r, r * 0.6); ctx.fill();
    ctx.fillStyle = 'rgba(120,90,60,0.18)';
    U.ellipse(ctx, x, y + 2, r * 0.86, r * 0.48); ctx.fill();
    if (hasBall) {
      const bg = ctx.createRadialGradient(x - r * 0.2, y - r * 0.28, r * 0.05, x, y - r * 0.06, r * 0.62);
      bg.addColorStop(0, '#fdf3e0'); bg.addColorStop(0.7, '#efdcb8'); bg.addColorStop(1, '#d9bf92');
      ctx.fillStyle = bg;
      U.ellipse(ctx, x, y - r * 0.1, r * 0.6, r * 0.44); ctx.fill();
    }
    ctx.restore();
  }

  function sparkleBurst(g, x, y, n) {
    g.parts.star(x, y, n || 14, 60, '#fff2b8');
    S.sparkle(4);
  }

  /* トレイ（画面座標） */
  function trayLayout(g) {
    const items = g.recipe.items.slice(0, 6);
    const n = items.length;
    const arr = [];
    if (g.land) {
      const r = Math.min(g.H * 0.145, (g.H - 30) / (n * 2.25), 78);
      const gap = r * 2.25;
      const total = (n - 1) * gap;
      const y0 = g.H / 2 - total / 2;
      for (let i = 0; i < n; i++) arr.push({ type: items[i], x: r * 1.35, y: y0 + i * gap, r: r });
      arr.band = { x: 0, y: 0, w: r * 2.7, h: g.H, vertical: true };
    } else {
      const r = Math.min(g.W * 0.135, (g.W - 20) / (n * 2.2), 78);
      const gap = Math.min(r * 2.2, (g.W - r * 2.2) / Math.max(1, n - 1));
      const total = (n - 1) * gap;
      const x0 = g.W / 2 - total / 2;
      const y = g.H - r * 1.15;
      for (let i = 0; i < n; i++) arr.push({ type: items[i], x: x0 + i * gap, y: y, r: r });
      arr.band = { x: 0, y: g.H - r * 2.1, w: g.W, h: r * 2.1, vertical: false };
    }
    return arr;
  }

  /* ================================================================
     ステージ定義
  ================================================================ */
  const St = (PZ.stages = {});

  /* ---------------------------------------------------------------
     えらぶ（レシピ選択）
  --------------------------------------------------------------- */
  St.CHOOSE = {
    cam: 'choose',
    enter(g) {
      g.pizza.reset();
      g.pz.visible = false;
      this.anim = 0;
      this.cards = [];
    },
    layout(g) {
      const n = RECIPES.length;
      const cards = [];
      if (g.land) {
        const cw = Math.min(g.W / 4.6, g.H * 0.62);
        const gap = cw * 0.18;
        const total = n * cw + (n - 1) * gap;
        const x0 = g.W / 2 - total / 2;
        for (let i = 0; i < n; i++) cards.push({ x: x0 + i * (cw + gap) + cw / 2, y: g.H * 0.56, s: cw / 2, r: RECIPES[i] });
      } else {
        const cw = Math.min(g.W / 2.35, g.H * 0.26);
        const gap = cw * 0.2;
        const x0 = g.W / 2 - (cw + gap) / 2;
        const y0 = g.H * 0.4;
        for (let i = 0; i < n; i++) {
          cards.push({ x: x0 + (i % 2) * (cw + gap), y: y0 + Math.floor(i / 2) * (cw + gap), s: cw / 2, r: RECIPES[i] });
        }
      }
      this.cards = cards;
      return cards;
    },
    update(g, dt) {
      this.anim = Math.min(1, this.anim + dt * 1.6);
      this.layout(g);
      g.pz.visible = false;
      g.peel.visible = false;
      g.fireLevel = 0.8;
    },
    drawScreen(g, ctx) {
      const t = g.t;
      // 看板ピザ
      ctx.save();
      const hy = g.land ? g.H * 0.15 : g.H * 0.18;
      const hr = g.land ? g.H * 0.11 : g.W * 0.15;
      ctx.save();
      ctx.translate(g.W / 2, hy);
      ctx.rotate(Math.sin(t * 0.8) * 0.08);
      A.drawMiniPizza(ctx, 0, 0, hr, { icon: ['cheese', 'basil', 'tomato', 'corn'] }, t);
      ctx.restore();
      ctx.restore();

      for (let i = 0; i < this.cards.length; i++) {
        const c = this.cards[i];
        const k = U.sat((this.anim - i * 0.09) * 1.7);
        if (k <= 0) continue;
        const pop = U.easeOutBack(k);
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(pop, pop);
        const bob = Math.sin(t * 1.8 + i) * c.s * 0.03;
        ctx.translate(0, bob);
        // 台紙
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        U.roundRect(ctx, -c.s, -c.s + 8, c.s * 2, c.s * 2, c.s * 0.3); ctx.fill();
        const g2 = ctx.createLinearGradient(0, -c.s, 0, c.s);
        g2.addColorStop(0, '#fff8f2'); g2.addColorStop(1, '#ffe3ee');
        ctx.fillStyle = g2;
        U.roundRect(ctx, -c.s, -c.s, c.s * 2, c.s * 2, c.s * 0.3); ctx.fill();
        ctx.strokeStyle = c.r.rainbow ? '#f7a8c8' : 'rgba(244,138,176,0.8)';
        ctx.lineWidth = c.s * 0.09;
        U.roundRect(ctx, -c.s, -c.s, c.s * 2, c.s * 2, c.s * 0.3); ctx.stroke();
        if (c.r.rainbow) {
          for (let j = 0; j < 6; j++) {
            ctx.fillStyle = A.rainbow[j];
            ctx.beginPath();
            ctx.arc(-c.s + c.s * 0.28 + j * c.s * 0.29, -c.s + c.s * 0.22, c.s * 0.075, 0, TAU);
            ctx.fill();
          }
        }
        A.drawMiniPizza(ctx, 0, c.s * 0.06, c.s * 0.72, c.r, t);
        ctx.restore();
      }
    },
    guideScreen(g, ctx, al) {
      if (!this.cards.length) return;
      const i = Math.floor(g.t / 1.5) % this.cards.length;
      const c = this.cards[i];
      A.drawTapRing(ctx, c.x, c.y, (g.t % 1), al * 0.9, c.s * 0.7);
      A.drawGhostHand(ctx, c.x + c.s * 0.36, c.y + c.s * 0.52, 0, c.s / 135, al * 0.8);
    },
    up(g) {
      const i = g.input;
      for (let k = 0; k < this.cards.length; k++) {
        const c = this.cards[k];
        if (Math.abs(i.sx - c.x) < c.s * 1.1 && Math.abs(i.sy - c.y) < c.s * 1.1) {
          g.recipe = c.r;
          S.tap(1.1); sparkleBurst(g, g.board.x, g.board.y, 8);
          g.setStage('DOUGH');
          return;
        }
      }
    }
  };

  /* ---------------------------------------------------------------
     生地玉を置く
  --------------------------------------------------------------- */
  St.DOUGH = {
    cam: 'bench',
    enter(g) {
      g.pizza.reset();
      this.placed = false;
      this.fly = null;
      this.bowl = { x: g.board.x - g.board.rx * 0.95, y: g.board.y - g.board.ry * 0.72 };
      g.pz.visible = false;
    },
    update(g, dt) {
      g.fireLevel = 0.75;
      if (this.fly) {
        this.fly.t += dt * 2.2;
        const k = U.sat(this.fly.t);
        const p = U.easeOut(k);
        g.pz.x = U.lerp(this.fly.x0, g.board.x, p);
        g.pz.y = U.lerp(this.fly.y0, g.board.y, p) - Math.sin(k * Math.PI) * 110;
        g.pz.visible = true;
        g.pz.squash = 0.88;
        g.pz.scale = 1;
        if (k >= 1) {
          this.fly = null; this.placed = true;
          S.doughDrop(); S.flour(1.4);
          g.parts.flour(g.board.x, g.board.y, 16, 90, 30);
          g.shake(6);
          g.setStage('SHAPE');
        }
      } else if (!this.placed) {
        g.pz.visible = false;
      }
    },
    drawWorld(g, ctx) {
      drawDoughBowl(ctx, this.bowl.x, this.bowl.y, g.board.rx * 0.28, !this.fly && !this.placed);
    },
    guide(g, ctx, al) {
      if (this.fly) return;
      const b = this.bowl;
      const k = (g.t * 0.6) % 1;
      const hx = U.lerp(b.x, g.board.x, U.easeInOut(k));
      const hy = U.lerp(b.y, g.board.y, U.easeInOut(k)) - Math.sin(k * Math.PI) * 60;
      A.drawArrow(ctx, b.x + 40, b.y + 20, g.board.x - 40, g.board.y - 20, al * 0.75, 13);
      A.drawHalo(ctx, b.x, b.y, g.board.rx * 0.4, g.t, al);
      A.drawGhostHand(ctx, hx, hy + 26, 0, 1.1, al);
      A.drawTapRing(ctx, g.board.x, g.board.y, (g.t % 1), al * 0.6, g.board.rx * 0.5);
    },
    down(g) { this.go(g); },
    auto(g) { this.go(g); },
    go(g) {
      if (this.fly || this.placed) return;
      this.fly = { t: 0, x0: this.bowl.x, y0: this.bowl.y - 12 };
      S.tap(0.9);
    }
  };

  /* ---------------------------------------------------------------
     押し広げる＋まわす
  --------------------------------------------------------------- */
  St.SHAPE = {
    cam: 'bench',
    enter(g) {
      this.done = false;
      this.doneT = 0;
      this.prsT = 0;
      this.spinSound = 0;
      this.lastAng = null;
      this.target = 182;
      g.pz.x = g.board.x; g.pz.y = g.board.y;
    },
    update(g, dt) {
      const p = g.pizza;
      g.fireLevel = 0.75;
      p.applySpin(dt);
      p.relax(dt, 0.7);
      const m = p.meanR();
      const prog = U.sat(U.inv(p.r0, this.target, m));
      g.pz.x = g.board.x; g.pz.y = g.board.y;
      g.pz.squash = U.lerp(0.88, 0.60, U.smooth(prog * 1.2));
      g.pz.scale = 1;
      g.pz.visible = true;

      if (Math.abs(p.spin) > 1.2) {
        this.spinSound -= dt;
        if (this.spinSound <= 0) { this.spinSound = 0.22; S.spin(U.sat(Math.abs(p.spin) / 8)); }
        if (U.chance(dt * 9)) {
          const a = U.rand(0, TAU);
          g.parts.flour(g.pz.x + Math.cos(a) * m * 0.9, g.pz.y + Math.sin(a) * m * 0.55, 1, 26, 12);
        }
      }

      if (!this.done && m >= this.target * 0.97) {
        this.done = true;
        sparkleBurst(g, g.pz.x, g.pz.y, 18);
        g.parts.flour(g.pz.x, g.pz.y, 14, m, 40);
      }
      if (this.done) {
        this.doneT += dt;
        if (this.doneT > 0.7) g.setStage('TOSS');
      }
    },
    drawWorld(g, ctx) { },
    guide(g, ctx, al) {
      const p = g.pizza;
      const m = p.meanR();
      const hit = m >= this.target * 0.97;
      A.drawTargetRing(ctx, g.pz.x, g.pz.y, this.target, g.pz.squash, g.t, al * 0.85, hit);
      if (this.done) return;
      // 押す→まわす を交互に見せる
      const cycle = (g.t / 3.4) % 1;
      if (cycle < 0.5) {
        const k = (cycle / 0.5);
        const a = Math.sin(k * TAU * 1.0) * 1.2 + 0.6;
        const r0 = m * 0.35, r1 = Math.min(this.target, m + 70);
        const rr = U.lerp(r0, r1, U.smooth(Math.abs(Math.sin(k * Math.PI))));
        const hx = g.pz.x + Math.cos(a) * rr, hy = g.pz.y + Math.sin(a) * rr * g.pz.squash;
        A.drawArrow(ctx, g.pz.x + Math.cos(a) * r0, g.pz.y + Math.sin(a) * r0 * g.pz.squash,
          g.pz.x + Math.cos(a) * r1 * 1.05, g.pz.y + Math.sin(a) * r1 * g.pz.squash * 1.05, al * 0.7, 12);
        A.drawGhostHand(ctx, hx, hy, 0, 1.15, al);
      } else {
        A.drawCircleHint(ctx, g.pz.x, g.pz.y, m * 0.78, g.pz.squash, g.t * 1.1, al * 0.9);
      }
    },
    move(g) {
      const i = g.input, p = g.pizza;
      if (!i.down) return;
      const mx = i.x - g.pz.x, my = (i.y - g.pz.y) / Math.max(0.2, g.pz.squash);
      const d = Math.hypot(mx, my);
      const spd = Math.hypot(i.vx, i.vy / Math.max(0.2, g.pz.squash));
      // 押し広げ
      if (d < p.maxRad() * 1.35) {
        const grew = p.press(mx, my, spd, i.dt);
        this.prsT -= i.dt;
        if (this.prsT <= 0 && spd > 60) {
          this.prsT = 0.14;
          S.press(U.sat(spd / 900));
          if (U.chance(0.55)) {
            g.parts.flour(i.x + U.rand(-14, 14), i.y + U.rand(-10, 10), 1, 22, 16);
            S.flour(0.7);
          }
        }
      }
      // まわす（中心まわりの角度変化）
      const ang = Math.atan2(my, mx);
      if (this.lastAng !== null && d > p.meanR() * 0.22) {
        const da = U.angDiff(this.lastAng, ang);
        if (Math.abs(da) < 1.2) {
          p.spin += da * (5.0 + 6.0 * U.sat(d / Math.max(1, p.meanR())));
          p.spin = U.clamp(p.spin, -13, 13);
        }
      }
      this.lastAng = ang;
      g.wake();
    },
    up(g) { this.lastAng = null; },
    auto(g) {
      const p = g.pizza;
      const a = U.rand(0, TAU);
      p.press(Math.cos(a) * p.meanR() * 0.8, Math.sin(a) * p.meanR() * 0.8, 700, 0.45);
      p.spin += 5;
      g.parts.flour(g.pz.x, g.pz.y, 4, 60, 24);
      S.press(0.5);
      g.autoT = 0.6;
    }
  };

  /* ---------------------------------------------------------------
     空中へ！
  --------------------------------------------------------------- */
  St.TOSS = {
    cam: 'toss',
    enter(g) {
      this.flight = null;
      this.count = 0;
      this.wait = 0;
      this.hint = 0;
    },
    update(g, dt) {
      const p = g.pizza;
      g.fireLevel = 0.75;
      g.pz.visible = true;
      g.pz.x = g.board.x; g.pz.y = g.board.y;
      g.pz.scale = 1; g.pz.squash = 0.60;
      g.pz.flip = 0;
      p.applySpin(dt);
      p.relax(dt, 0.5);

      if (this.flight) {
        const f = this.flight;
        f.t += dt;
        const k = U.sat(f.t / f.dur);
        const h = Math.sin(k * Math.PI) * f.height;
        g.pz.y = g.board.y - h;
        g.pz.groundY = g.board.y;
        g.pz.scale = 1 + (h / 900) * 0.55;
        g.pz.flip = f.flips * k;
        p.rot += f.spin * dt;
        g.pz.squash = 0.60;
        if (U.chance(dt * 14 * f.power)) {
          g.parts.flour(g.pz.x + U.rand(-40, 40), g.pz.y + U.rand(-20, 20), 1, 30, 6);
        }
        if (k >= 1) {
          this.flight = null;
          g.pz.flip = 0;
          p.tossGrow(f.power);
          p.spin *= 0.5;
          S.catchDough(f.power);
          g.parts.flour(g.board.x, g.board.y, 12 + f.power * 16, p.meanR() * 0.9, 34);
          g.shake(6 + f.power * 12);
          g.squish = 0.5 + f.power * 0.5;
          this.count++;
          this.wait = 2.1;
          if (this.count === 1) sparkleBurst(g, g.board.x, g.board.y - 40, 10);
        }
      } else {
        // 着地後の弾み
        if (this.count > 0) {
          this.wait -= dt;
          if (this.wait <= 0) g.setStage('SAUCE');
        }
      }
    },
    guide(g, ctx, al) {
      if (this.flight) return;
      const p = g.pizza;
      const y0 = g.board.y - p.meanR() * 0.3;
      const y1 = y0 - 260;
      const k = (g.t * 0.75) % 1;
      A.drawArrow(ctx, g.board.x, y0, g.board.x, y1, al * 0.85, 15);
      A.drawGhostHand(ctx, g.board.x, U.lerp(y0 + 30, y1 + 40, U.easeOut(k)), 0, 1.2, al * (1 - k * 0.5));
      if (this.count > 0) {
        // つぎへ進めることも示す（うっすら）
        A.drawHalo(ctx, g.board.x, g.board.y, p.meanR() * 1.1, g.t, al * 0.3);
      }
    },
    up(g) {
      if (this.flight) return;
      const i = g.input;
      const speed = -i.vy;                          // 上向きのふりの速さ
      const dist = this.start ? (this.start.y - i.y) : 0;   // 上へ動かした距離
      this.start = null;
      if (dist < 26 && speed < 90) return;          // ほとんど動いていなければ何もしない
      // ゆっくりでも「ふわっ」、速ければ「高くくるくる」
      const power = U.clamp(Math.max((speed - 90) / 2400, (dist - 26) / 620), 0.08, 1);
      this.launch(g, power);
    },
    down(g) {
      if (this.flight) return;
      this.start = { x: g.input.x, y: g.input.y };
    },
    auto(g) {
      // 一度やってみせたら、あとは先へ進ませる
      if (this.count === 0 && !this.flight) this.launch(g, 0.55);
      g.autoT = 6;
    },
    launch(g, power) {
      const p = U.clamp(power, 0.12, 1);
      this.flight = {
        t: 0, dur: 0.62 + p * 0.8, height: 62 + p * 232,
        flips: 1 + Math.round(p * 2), power: p,
        spin: U.rand(-2, 2) + 3 * p
      };
      S.toss(p);
      g.parts.flour(g.board.x, g.board.y, 8 + p * 12, 90, 40);
      g.wake();
    }
  };

  /* ---------------------------------------------------------------
     トマトソースをうずまきに
  --------------------------------------------------------------- */
  St.SAUCE = {
    cam: 'bench',
    enter(g) {
      this.done = false; this.doneT = 0;
      this.lx = null; this.sndT = 0;
      this.ladle = { x: g.board.x, y: g.board.y - g.pizza.meanR() * 0.2, a: 0, on: 0 };
      this.autoPhase = 0;
    },
    update(g, dt) {
      const p = g.pizza;
      g.fireLevel = 0.75;
      g.pz.visible = true;
      g.pz.x = g.board.x; g.pz.y = g.board.y;
      g.pz.scale = 1; g.pz.squash = 0.60;
      p.applySpin(dt);
      const i = g.input;
      if (i.down) {
        this.ladle.x = U.approach(this.ladle.x, i.x, 34, dt);
        this.ladle.y = U.approach(this.ladle.y, i.y, 34, dt);
        this.ladle.on = U.approach(this.ladle.on, 1, 10, dt);
      } else {
        this.ladle.on = U.approach(this.ladle.on, 0.35, 5, dt);
      }
      this.ladle.a = U.approach(this.ladle.a, U.clamp(i.vx / 900, -0.5, 0.5), 8, dt);

      if (!this.done && p.sauceCover >= 0.60) {
        this.done = true;
        sparkleBurst(g, g.pz.x, g.pz.y, 16);
      }
      if (this.done) {
        this.doneT += dt;
        if (this.doneT > 0.8) g.setStage('TOPPING');
      }
    },
    drawTop(g, ctx) {
      const l = this.ladle;
      const sc = 0.85 + l.on * 0.15;
      drawLadle(ctx, l.x, l.y - 26 * (1 - l.on) - 8, this.ladle.a, sc, U.sat(1 - g.pizza.sauceCover * 0.8));
    },
    guide(g, ctx, al) {
      if (this.done) return;
      const p = g.pizza;
      A.drawSpiralHint(ctx, g.pz.x, g.pz.y, p.innerR() * 0.88, g.pz.squash, (g.t * 0.42) % 1, al * 0.85);
    },
    move(g) {
      const i = g.input, p = g.pizza;
      if (!i.down) return;
      const mx = i.x - g.pz.x, my = (i.y - g.pz.y) / Math.max(0.2, g.pz.squash);
      if (Math.hypot(mx, my) > p.meanR() * 1.25) return;
      // 途中を補間して塗る（速く動かしても切れない）
      const lx = (i.lx - g.pz.x), ly = (i.ly - g.pz.y) / Math.max(0.2, g.pz.squash);
      const steps = Math.min(8, 1 + Math.floor(Math.hypot(mx - lx, my - ly) / 14));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        p.paintSauce(U.lerp(lx, mx, t), U.lerp(ly, my, t), 46);
      }
      this.sndT -= i.dt;
      if (this.sndT <= 0) { this.sndT = 0.16; S.sauce(U.sat(Math.hypot(i.vx, i.vy) / 700)); }
      g.wake();
    },
    auto(g) {
      const p = g.pizza;
      this.autoPhase += 0.5;
      const a = this.autoPhase * 1.4;
      const rr = (this.autoPhase / 14) * p.innerR();
      p.paintSauce(Math.cos(a) * rr, Math.sin(a) * rr, 62);
      this.ladle.x = g.pz.x + Math.cos(a) * rr;
      this.ladle.y = g.pz.y + Math.sin(a) * rr * g.pz.squash;
      this.ladle.on = 1;
      S.sauce(0.5);
      g.autoT = 0.12;
    }
  };

  /* ---------------------------------------------------------------
     ぐざいをのせる → ピールへ
  --------------------------------------------------------------- */
  St.TOPPING = {
    cam: 'topping',
    enter(g) {
      this.held = null;
      this.sprinkleT = 0;
      this.peelReady = false;
      this.peelIn = 0;
      this.movingPizza = false;
      this.pizzaOff = { x: 0, y: 0 };
      this.snapped = false;
      this.snapT = 0;
      this.bowls = trayLayout(g);
    },
    peelPos(g) {
      // 板の手前側にピールが差し出される
      const a = g.pathAt(-1);
      return a;
    },
    update(g, dt) {
      const p = g.pizza;
      g.fireLevel = 0.75;
      this.bowls = trayLayout(g);
      p.updateToppings(dt);
      p.applySpin(dt);
      g.pz.visible = true;
      g.pz.scale = 1; g.pz.squash = 0.60;

      const need = g.recipe.need;
      if (!this.peelReady && p.toppings.length >= need) {
        this.peelReady = true;
        S.slide(0.5, 0.5);
      }
      if (this.peelReady) this.peelIn = Math.min(1, this.peelIn + dt * 2.2);

      const pp = this.peelPos(g);
      if (this.snapped) {
        this.snapT += dt;
        const k = U.sat(this.snapT / 0.45);
        g.pz.x = U.lerp(this.snapFrom.x, pp.x, U.easeOut(k));
        g.pz.y = U.lerp(this.snapFrom.y, pp.y, U.easeOut(k));
        if (this.snapT > 0.6) g.setStage('INSERT');
      } else {
        g.pz.x = g.board.x + this.pizzaOff.x;
        g.pz.y = g.board.y + this.pizzaOff.y;
      }

      // ピール表示
      if (this.peelIn > 0) {
        const e = U.easeOut(this.peelIn);
        g.peel.visible = true;
        g.peel.x = U.lerp(pp.x - g.nearDir.x * 320, pp.x, e);
        g.peel.y = U.lerp(pp.y - g.nearDir.y * 320, pp.y, e);
        g.peel.scale = pp.scale; g.peel.squash = pp.squash;
        g.peel.shade = 1; g.peel.shadow = true;
        g.peel.glow = this.snapped ? 0 : this.peelIn;
      }
    },
    drawScreen(g, ctx) {
      const t = g.t;
      // トレイの下敷き
      const bd = this.bowls.band;
      if (bd) {
        ctx.save();
        const bg = bd.vertical
          ? ctx.createLinearGradient(bd.x, 0, bd.x + bd.w, 0)
          : ctx.createLinearGradient(0, bd.y, 0, bd.y + bd.h);
        bg.addColorStop(0, 'rgba(48,22,14,0.72)');
        bg.addColorStop(1, 'rgba(48,22,14,0.0)');
        ctx.fillStyle = bg;
        ctx.fillRect(bd.x, bd.y, bd.w, bd.h);
        ctx.restore();
      }
      // トレイの器
      for (let i = 0; i < this.bowls.length; i++) {
        const b = this.bowls[i];
        const glow = (this.held && this.held.type === b.type) ? 0 : 0.5;
        A.drawBowl(ctx, b.x, b.y, b.r, BOWL_COL[b.type] || '#eee', glow * 0.6, t + i);
        // 中身
        for (let k = 0; k < 3; k++) {
          const a = k * 2.1 + i;
          A.drawTopping(ctx, b.type, b.x + Math.cos(a) * b.r * 0.30, b.y + Math.sin(a) * b.r * 0.18 - b.r * 0.14,
            b.r * 0.38, a, 0, 0);
        }
      }
      if (this.held) {
        const h = this.held;
        A.drawTopping(ctx, h.type, h.sx, h.sy, h.r, h.rot, 0, 0);
      }
    },
    guide(g, ctx, al) {
      const p = g.pizza;
      if (this.peelReady && !this.snapped) {
        const pp = this.peelPos(g);
        const k = (g.t * 0.7) % 1;
        A.drawArrow(ctx, g.pz.x, g.pz.y + p.meanR() * 0.3, pp.x, pp.y - 30, al * 0.85, 15);
        A.drawGhostHand(ctx,
          U.lerp(g.pz.x, pp.x, U.easeInOut(k)), U.lerp(g.pz.y, pp.y, U.easeInOut(k)),
          0, 1.2, al * 0.9);
        A.drawHalo(ctx, pp.x, pp.y, 190, g.t, al * 0.8);
      }
    },
    guideScreen(g, ctx, al) {
      if (this.peelReady) return;
      if (!this.bowls.length) return;
      const i = Math.floor(g.t / 2.2) % this.bowls.length;
      const b = this.bowls[i];
      const c = g.toScreen(g.pz.x, g.pz.y);
      const k = (g.t / 2.2) % 1;
      const kk = U.smooth(U.sat((k - 0.15) / 0.7));
      A.drawHalo(ctx, b.x, b.y, b.r * 1.7, g.t, al * 0.9);
      A.drawGhostHand(ctx, U.lerp(b.x, c.x, kk), U.lerp(b.y, c.y, kk), 0, b.r / 72, al * 0.72);
    },
    down(g) {
      const i = g.input;
      for (let k = 0; k < this.bowls.length; k++) {
        const b = this.bowls[k];
        if (U.dist(i.sx, i.sy, b.x, b.y) < b.r * 1.35) {
          this.held = { type: b.type, sx: i.sx, sy: i.sy, r: b.r * 0.5, rot: U.rand(0, TAU) };
          S.tap(1.2);
          return;
        }
      }
      // ピザ本体をつかんでピールへ
      if (this.peelReady) {
        const p = g.pizza;
        const dx = i.x - g.pz.x, dy = (i.y - g.pz.y) / Math.max(0.2, g.pz.squash);
        if (Math.hypot(dx, dy) < p.meanR() * 1.3) {
          this.movingPizza = true;
          this.grab = { x: i.x - g.pz.x, y: i.y - g.pz.y };
        }
      }
    },
    move(g) {
      const i = g.input, p = g.pizza;
      if (this.held) {
        this.held.sx = i.sx; this.held.sy = i.sy;
        const w = g.toWorld(i.sx, i.sy);
        const mx = w.x - g.pz.x, my = (w.y - g.pz.y) / Math.max(0.2, g.pz.squash);
        if (this.held.type === 'cheese' && Math.hypot(mx, my) < p.innerR()) {
          this.sprinkleT -= i.dt;
          if (this.sprinkleT <= 0) {
            this.sprinkleT = 0.055;
            p.addTopping('cheese', mx + U.rand(-20, 20), my + U.rand(-20, 20));
            if (U.chance(0.35)) S.plop(1.6);
          }
        }
        g.wake();
        return;
      }
      if (this.movingPizza && !this.snapped) {
        this.pizzaOff.x = U.approach(this.pizzaOff.x, i.x - this.grab.x - g.board.x, 30, i.dt);
        this.pizzaOff.y = U.approach(this.pizzaOff.y, i.y - this.grab.y - g.board.y, 30, i.dt);
        const pp = this.peelPos(g);
        if (U.dist(g.pz.x, g.pz.y, pp.x, pp.y) < 190) this.snap(g);
        g.wake();
      }
    },
    up(g) {
      const i = g.input, p = g.pizza;
      if (this.held) {
        const w = g.toWorld(i.sx, i.sy);
        const mx = w.x - g.pz.x, my = (w.y - g.pz.y) / Math.max(0.2, g.pz.squash);
        const d = Math.hypot(mx, my);
        if (d < p.meanR() * 1.5) {                       // 吸着つき
          const t = p.addTopping(this.held.type, mx, my);
          S.plop(this.held.type === 'cheese' ? 1.6 : 1);
          g.parts.crumb(g.pz.x + t.x, g.pz.y + t.y * g.pz.squash, 3, '#fff');
        }
        this.held = null;
        return;
      }
      if (this.movingPizza) {
        this.movingPizza = false;
        if (!this.snapped) {
          const pp = this.peelPos(g);
          if (U.dist(g.pz.x, g.pz.y, pp.x, pp.y) < 320) this.snap(g);
          else { this.pizzaOff.x = 0; this.pizzaOff.y = 0; }
        }
      }
    },
    snap(g) {
      if (this.snapped) return;
      this.snapped = true; this.snapT = 0;
      this.snapFrom = { x: g.pz.x, y: g.pz.y };
      S.slide(0.8, 0.5);
      g.parts.flour(g.pz.x, g.pz.y, 8, 90, 20);
    },
    auto(g) {
      const p = g.pizza;
      if (!this.peelReady) {
        const b = this.bowls[U.randInt(0, this.bowls.length - 1)];
        const a = U.rand(0, TAU), rr = U.rand(0, p.innerR() * 0.85);
        p.addTopping(b.type, Math.cos(a) * rr, Math.sin(a) * rr);
        S.plop(1);
        g.autoT = 0.35;
      } else {
        this.snap(g);
      }
    }
  };

  /* ---------------------------------------------------------------
     ★ 看板動作 ★ ピールで石窯の奥へスッ
  --------------------------------------------------------------- */
  St.INSERT = {
    cam: 'oven',
    enter(g) {
      g.pz.v = -1;
      this.v = -1;
      this.grab = null;
      this.launch = null;
      this.retreat = null;
      this.slideSnd = 0;
      this.best = -1;
      g.peel.visible = true;
      S.startFire();
    },
    update(g, dt) {
      const p = g.pizza;
      g.fireLevel = 1;
      p.applySpin(dt);
      g.pz.visible = true;
      g.peel.visible = true;
      g.peel.held = true;

      if (this.launch) {
        const L = this.launch;
        L.t += dt;
        // ピザ：最後のひと押しで奥へスルッ
        const k1 = U.sat(L.t / 0.44);
        const over = U.lerp(L.v0, g.vBake + 0.14, U.easeOut(k1));
        const k2 = U.sat((L.t - 0.44) / 0.34);
        this.v = k2 > 0 ? U.lerp(g.vBake + 0.14, g.vBake, U.easeOut(k2)) : over;
        // ピール：一拍おいてスッと手前へ引く
        const pk = U.sat((L.t - 0.08) / 0.36);
        L.peelV = U.lerp(L.v0, -1.45, U.easeIn(pk));
        if (L.t > 0.16 && !L.snd) { L.snd = true; S.landStone(); }
        if (L.t > 0.2 && !L.spark) {
          L.spark = true;
          const q = g.pathAt(g.vBake);
          g.parts.spark(q.x, q.y, 16, 90, 60);
          g.parts.smoke(q.x, q.y - 20, 3, 60);
        }
        g.peel.visible = pk < 1;
        if (L.t > 0.95) {
          g.pz.v = g.vBake;
          g.setStage('BAKE');
          return;
        }
      } else if (this.retreat) {
        this.retreat.t += dt;
        const k = U.sat(this.retreat.t / 0.5);
        this.v = U.lerp(this.retreat.v0, -1, U.easeOut(k));
        if (k >= 1) this.retreat = null;
      }

      this.v = U.clamp(this.v, -1.2, 1);
      g.pz.v = this.v;
      const q = g.pathAt(this.v);
      g.pz.x = q.x; g.pz.y = q.y; g.pz.scale = q.scale; g.pz.squash = q.squash;
      g.pz.inOven = this.v > -0.02;
      g.pz.shade = q.shade;

      const pv = this.launch ? this.launch.peelV : this.v;
      const pq = g.pathAt(pv);
      g.peel.x = pq.x; g.peel.y = pq.y;
      g.peel.scale = pq.scale; g.peel.squash = pq.squash;
      g.peel.shade = pq.shade;
      g.peel.inOven = pv > -0.02;
      g.peel.glow = this.grab ? 0 : 0.5;
      g.peel.shadow = pv < -0.1;

      // 奥へ進むほど火の粉と音
      if (this.v > this.best) {
        this.best = this.v;
        if (this.v > 0.1 && U.chance(0.5)) g.parts.spark(q.x, q.y, 2, 60, 40);
      }
      const spd = Math.abs(this.vSpeed || 0);
      if (spd > 0.25) {
        this.slideSnd -= dt;
        if (this.slideSnd <= 0) { this.slideSnd = 0.13; S.slide(U.sat(spd / 2.2), 0.28); }
      }
    },
    guide(g, ctx, al) {
      if (this.launch) return;
      const a = g.pathAt(-0.92), b = g.pathAt(0.42);
      A.drawArrow(ctx, a.x, a.y, b.x, b.y, al * 0.9, 17);
      const k = (g.t * 0.55) % 1;
      const q = g.pathAt(U.lerp(-0.92, 0.42, U.easeInOut(k)));
      A.drawGhostHand(ctx, q.x, q.y + 40 * q.scale, 0, 1.3 * q.scale, al * (1 - k * 0.35));
      A.drawHalo(ctx, g.pz.x, g.pz.y, 200 * g.pz.scale, g.t, al * 0.5);
    },
    down(g) {
      if (this.launch) return;
      this.retreat = null;
      const v = g.projectV(g.input.x, g.input.y);
      this.grab = { v0: v, off: this.v - v };
      g.wake();
    },
    move(g) {
      if (!this.grab || this.launch) return;
      const i = g.input;
      const v = g.projectV(i.x, i.y) + this.grab.off;
      const nv = U.clamp(v, -1.15, 0.98);
      this.vSpeed = (nv - this.v) / Math.max(0.001, i.dt);
      this.v = nv;
      g.wake();
    },
    up(g) {
      if (!this.grab || this.launch) return;
      const fast = (this.vSpeed || 0) > 0.6;
      if (this.v > 0.30 || (this.v > 0.02 && fast)) {
        this.doLaunch(g);
      } else {
        this.retreat = { t: 0, v0: this.v };
        if (this.v > -0.9) S.slide(0.4, 0.4);
      }
      this.grab = null;
      this.vSpeed = 0;
    },
    doLaunch(g) {
      this.launch = { t: 0, v0: this.v, peelV: this.v };
      S.slide(1, 0.5);
      g.shake(10);
      g.camPush = 0.9;
    },
    auto(g) {
      // 職人がやってみせる
      if (this.launch) return;
      if (!this.autoAnim) this.autoAnim = 0;
      this.autoAnim += 0.06;
      this.v = U.lerp(-1, 0.5, U.easeInOut(U.sat(this.autoAnim)));
      if (this.autoAnim >= 1) { this.doLaunch(g); this.autoAnim = 0; }
      g.autoT = 0.1;
    }
  };

  /* ---------------------------------------------------------------
     焼ける（見て楽しむ）
  --------------------------------------------------------------- */
  function bakeCommon(g, dt, self) {
    const p = g.pizza;
    g.fireLevel = 1.1;
    const q = g.pathAt(g.vBake);
    g.pz.visible = true; g.pz.inOven = true;
    g.pz.x = q.x; g.pz.y = q.y + Math.sin(g.t * 5) * 0.6;
    g.pz.scale = q.scale; g.pz.squash = q.squash;
    g.pz.shade = 0.9;
    g.pz.v = g.vBake;
    p.bakeStep(dt, 1, g.flameAngle);
    p.applySpin(dt);
    if (U.chance(dt * 2.2)) {
      g.parts.spark(q.x + U.rand(-120, 120) * q.scale, q.y, 1, 20, 30);
    }
    if (U.chance(dt * 0.8)) S.sizzle(1);
    if (U.chance(dt * 1.1)) g.parts.smoke(q.x + U.rand(-90, 90), q.y - 14, 1, 30);
  }

  St.BAKE = {
    cam: 'bake',
    enter(g) {
      g.pizza.startBake();
      this.t = 0;
      g.peel.visible = false;
    },
    update(g, dt) {
      bakeCommon(g, dt, this);
      this.t += dt;
      if (this.t > 6.2) g.setStage('ROTATE');
    },
    down(g) {
      // 窯をつつくと火がぶわっ
      const q = g.pathAt(1);
      g.parts.spark(q.x, q.y + 20, 14, 100, 80);
      S.flare();
      g.flare = 1;
      g.wake();
    },
    guide(g, ctx, al) {
      // 焼けている様子そのものが見どころ。うっすら光らせるだけ。
      A.drawHalo(ctx, g.pz.x, g.pz.y, 220 * g.pz.scale, g.t, al * 0.25);
    }
  };

  St.BAKE2 = {
    cam: 'bake',
    enter(g) { this.t = 0; g.peel.visible = false; },
    update(g, dt) {
      bakeCommon(g, dt, this);
      this.t += dt;
      if (this.t > 5.4) g.setStage('RETRIEVE');
    },
    down: St.BAKE.down,
    guide: St.BAKE.guide
  };

  /* ---------------------------------------------------------------
     窯の中でくるっと回す
  --------------------------------------------------------------- */
  St.ROTATE = {
    cam: 'bake',
    enter(g) {
      this.peelIn = 0;
      this.turned = 0;
      this.lastA = null;
      this.grab = false;
      this.out = 0;
      this.done = false;
      g.peel.visible = false;
    },
    update(g, dt) {
      const p = g.pizza;
      bakeCommon(g, dt, this);
      const q = g.pathAt(g.vBake);

      if (this.grab || this.done) this.peelIn = Math.min(1, this.peelIn + dt * 3.4);
      if (this.done) {
        this.out += dt;
        if (this.out > 0.5) { g.setStage('BAKE2'); return; }
      }
      const ease = this.done ? 1 - U.easeIn(U.sat(this.out / 0.5)) : U.easeOut(this.peelIn);
      if (ease > 0.01) {
        g.peel.visible = true;
        g.peel.held = true;
        const from = g.pathAt(-0.6);
        g.peel.x = U.lerp(from.x, q.x, ease);
        g.peel.y = U.lerp(from.y, q.y, ease);
        g.peel.scale = U.lerp(from.scale, q.scale, ease);
        g.peel.squash = U.lerp(from.squash, q.squash, ease);
        g.peel.shade = U.lerp(from.shade, q.shade, ease);
        g.peel.inOven = ease > 0.4;
        g.peel.glow = 0;
        g.peel.shadow = false;
        g.peel.under = true;
      }
      // 惰性
      if (!this.grab) p.spin *= Math.exp(-2.4 * dt);
    },
    guide(g, ctx, al) {
      if (this.done) return;
      A.drawCircleHint(ctx, g.pz.x, g.pz.y, 200 * g.pz.scale, g.pz.squash, g.t * 1.2, al * 0.95);
      // 焦げの強い側を光らせる
      const q = g.pathAt(g.vBake);
      A.drawHalo(ctx, q.x, q.y, 210 * g.pz.scale, g.t, al * 0.4);
    },
    down(g) {
      this.grab = true;
      this.lastA = null;
      g.wake();
    },
    move(g) {
      if (!this.grab || this.done) return;
      const i = g.input, p = g.pizza;
      const a = Math.atan2((i.y - g.pz.y) / Math.max(0.2, g.pz.squash), i.x - g.pz.x);
      if (this.lastA !== null && this.peelIn > 0.5) {
        let da = U.angDiff(this.lastA, a);
        if (Math.abs(da) > 1.2) da = 0;
        // 横方向のスワイプでも回るように補助
        p.spin = U.clamp(p.spin + da * 9, -12, 12);
        this.turned += Math.abs(da);
        if (this.turned > 2.4 && !this.done) this.finish(g);
      }
      this.lastA = a;
      g.wake();
    },
    up(g) { this.grab = false; this.lastA = null; },
    finish(g) {
      this.done = true;
      S.kuru();
      const q = g.pathAt(g.vBake);
      g.parts.spark(q.x, q.y, 14, 110, 60);
      g.parts.star(q.x, q.y - 30, 8, 70, '#ffd98a');
      g.pizza.spin = U.sign(g.pizza.spin || 1) * 7;
    },
    auto(g) {
      this.grab = true;
      if (this.peelIn > 0.6) {
        g.pizza.spin = 7;
        this.turned += 0.5;
        if (this.turned > 2.4 && !this.done) this.finish(g);
      }
      g.autoT = 0.12;
    }
  };

  /* ---------------------------------------------------------------
     ピールで手前へスッと引き出す
  --------------------------------------------------------------- */
  St.RETRIEVE = {
    cam: 'oven',
    enter(g) {
      this.peelIn = 0;
      this.grab = null;
      this.v = g.vBake;
      this.done = null;
      this.slideSnd = 0;
      g.peel.visible = false;
    },
    update(g, dt) {
      const p = g.pizza;
      g.fireLevel = 1.05;
      p.applySpin(dt);
      p.bakeStep(dt * (this.v > 0.2 ? 1 : 0.15), 1, g.flameAngle);
      g.pz.visible = true;

      if (this.grab || this.peelIn > 0) this.peelIn = Math.min(1, this.peelIn + dt * 3.6);

      if (this.done) {
        this.done.t += dt;
        const k = U.sat(this.done.t / 0.55);
        this.v = U.lerp(this.done.v0, -1.05, U.easeOut(k));
        if (this.done.t > 0.75) { g.setStage('CUT'); return; }
      }

      this.v = U.clamp(this.v, -1.1, 1);
      const q = g.pathAt(this.v);
      g.pz.x = q.x; g.pz.y = q.y; g.pz.scale = q.scale; g.pz.squash = q.squash;
      g.pz.inOven = this.v > -0.02;
      g.pz.v = this.v;

      const ease = U.easeOut(this.peelIn);
      const from = g.pathAt(-1.2);
      g.peel.visible = this.peelIn > 0.02;
      g.peel.held = g.peel.visible;
      g.peel.x = U.lerp(from.x, q.x, ease);
      g.peel.y = U.lerp(from.y, q.y, ease);
      g.peel.scale = U.lerp(from.scale, q.scale, ease);
      g.peel.squash = U.lerp(from.squash, q.squash, ease);
      g.peel.shade = U.lerp(1, q.shade, ease);
      g.peel.inOven = this.v > -0.02 && ease > 0.5;
      g.peel.glow = this.grab ? 0 : 0.6;
      g.peel.under = true;
      g.peel.shadow = this.v < -0.2;

      const spd = Math.abs(this.vSpeed || 0);
      if (spd > 0.25) {
        this.slideSnd -= dt;
        if (this.slideSnd <= 0) { this.slideSnd = 0.13; S.slide(U.sat(spd / 2), 0.26); }
      }
      if (this.v < 0.2 && U.chance(dt * 3)) g.parts.smoke(q.x + U.rand(-70, 70), q.y - 20, 1, 30);
    },
    guide(g, ctx, al) {
      if (this.done) return;
      const a = g.pathAt(g.vBake), b = g.pathAt(-0.9);
      A.drawArrow(ctx, a.x, a.y, b.x, b.y, al * 0.9, 17);
      const k = (g.t * 0.55) % 1;
      const q = g.pathAt(U.lerp(g.vBake, -0.9, U.easeInOut(k)));
      A.drawGhostHand(ctx, q.x, q.y + 40 * q.scale, 0, 1.3 * q.scale, al * (1 - k * 0.3));
    },
    down(g) {
      if (this.done) return;
      this.grab = { pending: true };
      g.wake();
    },
    move(g) {
      if (!this.grab || this.done) return;
      const i = g.input;
      if (this.peelIn < 0.9) { this.grab.off = null; return; }
      const v = g.projectV(i.x, i.y);
      if (this.grab.off === null || this.grab.off === undefined) this.grab.off = this.v - v;
      const nv = U.clamp(v + this.grab.off, -1.05, 1);
      this.vSpeed = (nv - this.v) / Math.max(0.001, i.dt);
      this.v = nv;
      g.wake();
    },
    up(g) {
      if (!this.grab || this.done) return;
      this.grab = null;
      if (this.v < -0.15 || (this.vSpeed || 0) < -0.6) {
        this.done = { t: 0, v0: this.v };
        S.slide(0.9, 0.6);
        g.shake(8);
      }
      this.vSpeed = 0;
    },
    auto(g) {
      if (this.done) return;
      this.peelIn = Math.min(1, this.peelIn + 0.12);
      if (this.peelIn >= 1) {
        this.v = U.lerp(this.v, -0.4, 0.12);
        if (this.v < -0.2) { this.done = { t: 0, v0: this.v }; S.slide(0.9, 0.6); }
      }
      g.autoT = 0.12;
    }
  };

  /* ---------------------------------------------------------------
     大人の職人が安全にカット → チーズがのびる
  --------------------------------------------------------------- */
  const CUT_ANGLES = [0, Math.PI / 4, Math.PI / 2, Math.PI * 0.75];

  St.CUT = {
    cam: 'bench',
    enter(g) {
      this.slide = 0;
      this.from = { x: g.pz.x, y: g.pz.y };
      this.cutter = { x: g.board.x, y: g.board.y - 260, a: 0, on: 0 };
      this.drag = null;
      this.lift = null;
      this.lifted = 0;
      this.done = 0;
      g.pizza.cuts.length = 0;
      g.peel.visible = false;
    },
    update(g, dt) {
      const p = g.pizza;
      g.fireLevel = 0.85;
      g.pz.visible = true;
      this.slide = Math.min(1, this.slide + dt * 1.5);
      const k = U.easeOut(this.slide);
      g.pz.x = U.lerp(this.from.x, g.board.x, k);
      g.pz.y = U.lerp(this.from.y, g.board.y, k);
      g.pz.scale = U.lerp(g.pz.scale, 1, U.sat(dt * 5));
      g.pz.squash = U.lerp(g.pz.squash, 0.60, U.sat(dt * 5));
      p.spin *= Math.exp(-3 * dt);
      p.applySpin(dt);
      p.steam = U.approach(p.steam, 0, 0.4, dt);
      if (U.chance(dt * 2.5)) g.parts.smoke(g.pz.x + U.rand(-100, 100), g.pz.y - 20, 1, 30);

      // カッター位置
      const i = g.input;
      if (i.down && this.drag) {
        this.cutter.x = U.approach(this.cutter.x, i.x, 28, dt);
        this.cutter.y = U.approach(this.cutter.y, i.y, 28, dt);
        this.cutter.on = U.approach(this.cutter.on, 1, 9, dt);
      } else {
        const rest = this.restPos(g);
        this.cutter.x = U.approach(this.cutter.x, rest.x, 6, dt);
        this.cutter.y = U.approach(this.cutter.y, rest.y, 6, dt);
        this.cutter.on = U.approach(this.cutter.on, 0.25, 4, dt);
      }
      this.cutter.a = U.approach(this.cutter.a, U.clamp(i.vx / 1400, -0.4, 0.4) + Math.sin(g.t * 2) * 0.05, 7, dt);

      if (this.lift) {
        this.lift.k = U.approach(this.lift.k, this.lift.target, 12, dt);
        if (this.lift.target === 0 && this.lift.k < 0.02) this.lift = null;
      }
      if (p.cuts.length >= 4 && this.lifted >= 1) {
        this.done += dt;
        if (this.done > 0.9) g.setStage('DONE');
      }
      g.chefCut = p.cuts.length < 4 ? { x: this.cutter.x, y: this.cutter.y } : null;
    },
    restPos(g) {
      const p = g.pizza;
      return { x: g.board.x + p.meanR() * 1.1, y: g.board.y - p.meanR() * 0.9 };
    },
    drawWorld(g, ctx) {
      A.drawPlate(ctx, g.pz.x, g.pz.y + g.pizza.meanR() * g.pz.squash * 0.16,
        g.pizza.meanR() * g.pz.scale * 1.17, g.pz.squash);
    },
    drawTop(g, ctx) {
      const p = g.pizza;
      if (this.lift && this.lift.k > 0.02) {
        const l = this.lift;
        const ox = Math.cos(l.mid) * 190 * l.k, oy = Math.sin(l.mid) * 110 * l.k - 90 * l.k;
        p.drawCheeseStrands(ctx,
          g.pz.x + Math.cos(l.mid) * p.meanR() * 0.4, g.pz.y + Math.sin(l.mid) * p.meanR() * 0.25,
          g.pz.x + ox, g.pz.y + oy, l.k, g.t);
      }
      const c = this.cutter;
      const cs = 0.9 + c.on * 0.15;
      const cy = c.y - 40 * (1 - c.on);
      A.drawCutter(ctx, c.x, cy, c.a, cs, 1);
      // 大人の手が柄をにぎる
      A.drawKidHand(ctx, c.x + Math.sin(c.a) * 96 * cs, cy - Math.cos(c.a) * 96 * cs,
        c.a + Math.PI, cs * 0.95, 1, true);
    },
    guide(g, ctx, al) {
      const p = g.pizza;
      if (p.cuts.length < 4) {
        const idx = p.cuts.length % CUT_ANGLES.length;
        const a = CUT_ANGLES[idx];
        const r = p.meanR() * 1.15;
        const x0 = g.pz.x - Math.cos(a) * r, y0 = g.pz.y - Math.sin(a) * r * g.pz.squash;
        const x1 = g.pz.x + Math.cos(a) * r, y1 = g.pz.y + Math.sin(a) * r * g.pz.squash;
        A.drawArrow(ctx, x0, y0, x1, y1, al * 0.85, 13);
        const k = (g.t * 0.7) % 1;
        A.drawGhostHand(ctx, U.lerp(x0, x1, U.easeInOut(k)), U.lerp(y0, y1, U.easeInOut(k)), 0, 1.1, al * 0.9);
      } else if (this.lifted < 1) {
        const a = -Math.PI * 0.25;
        const r = p.meanR() * 0.6;
        const x0 = g.pz.x + Math.cos(a) * r, y0 = g.pz.y + Math.sin(a) * r * g.pz.squash;
        A.drawArrow(ctx, x0, y0, x0 + Math.cos(a) * 190, y0 + Math.sin(a) * 150 - 60, al * 0.9, 15);
        A.drawGhostHand(ctx, x0, y0, 0, 1.15, al * 0.9);
      }
    },
    down(g) {
      const p = g.pizza, i = g.input;
      const dx = i.x - g.pz.x, dy = (i.y - g.pz.y) / Math.max(0.2, g.pz.squash);
      const d = Math.hypot(dx, dy);
      if (p.cuts.length < 4) {
        this.drag = { x0: i.x, y0: i.y };
      } else if (d < p.meanR() * 1.15) {
        const n = p.cuts.length * 2;
        let a = Math.atan2(dy, dx) - p.rot - p.cuts[0];
        a = ((a % TAU) + TAU) % TAU;
        const idx = Math.floor(a / TAU * n) % n;
        this.lift = { index: idx, mid: p.cuts[0] + ((idx + 0.5) / n) * TAU + p.rot, k: 0, target: 1 };
        S.stretch();
      }
      g.wake();
    },
    move(g) { g.wake(); },
    up(g) {
      const p = g.pizza, i = g.input;
      if (this.drag && p.cuts.length < 4) {
        const dx = i.x - this.drag.x0, dy = (i.y - this.drag.y0) / Math.max(0.2, g.pz.squash);
        const len = Math.hypot(dx, dy);
        if (len > p.meanR() * 0.45) {
          let a = Math.atan2(dy, dx) - p.rot;
          // 45°刻みにスナップし、まだ使っていない角度を選ぶ
          a = ((a % Math.PI) + Math.PI) % Math.PI;
          let best = 0, bd = 9;
          for (let k = 0; k < CUT_ANGLES.length; k++) {
            if (p.cuts.indexOf(CUT_ANGLES[k]) >= 0) continue;
            const d2 = Math.min(Math.abs(a - CUT_ANGLES[k]), Math.PI - Math.abs(a - CUT_ANGLES[k]));
            if (d2 < bd) { bd = d2; best = k; }
          }
          if (p.cuts.indexOf(CUT_ANGLES[best]) < 0) {
            p.cuts.push(CUT_ANGLES[best]);
            p.cuts.sort((x, y) => x - y);
            S.cut();
            g.parts.crumb(g.pz.x, g.pz.y, 6, '#e8cd9e');
            g.shake(5);
            if (p.cuts.length >= 4) sparkleBurst(g, g.pz.x, g.pz.y, 16);
          }
        }
        this.drag = null;
      }
      if (this.lift && this.lift.target === 1) {
        this.lift.target = 0;
        this.lifted++;
        if (this.lifted === 1) { sparkleBurst(g, g.pz.x, g.pz.y - 60, 14); S.fanfare(); }
      }
    },
    auto(g) {
      const p = g.pizza;
      if (p.cuts.length < 4) {
        for (let k = 0; k < CUT_ANGLES.length; k++) {
          if (p.cuts.indexOf(CUT_ANGLES[k]) < 0) {
            p.cuts.push(CUT_ANGLES[k]); p.cuts.sort((x, y) => x - y);
            S.cut(); g.shake(5);
            if (p.cuts.length >= 4) sparkleBurst(g, g.pz.x, g.pz.y, 16);
            break;
          }
        }
        g.autoT = 0.8;
      } else if (this.lifted < 1) {
        this.lift = { index: 0, mid: p.cuts[0] + 0.4 + p.rot, k: 0, target: 1 };
        S.stretch();
        this.lifted = 1;
        setTimeout(() => { if (this.lift) this.lift.target = 0; }, 900);
        sparkleBurst(g, g.pz.x, g.pz.y - 60, 14); S.fanfare();
      }
    }
  };

  /* ---------------------------------------------------------------
     できた！ → つぎをえらぶ
  --------------------------------------------------------------- */
  St.DONE = {
    cam: 'bench',
    enter(g) {
      this.t = 0;
      this.cards = [];
      S.fanfare();
      sparkleBurst(g, g.pz.x, g.pz.y, 26);
      g.peel.visible = false;
    },
    layout(g) {
      const n = 3;
      const cards = [];
      const cw = g.land ? Math.min(g.W / 5.2, g.H * 0.30) : Math.min(g.W / 3.9, g.H * 0.17);
      const gap = cw * 0.28;
      const total = n * cw + (n - 1) * gap;
      const x0 = g.W / 2 - total / 2 + cw / 2;
      const y = g.H - cw * 0.64;
      for (let i = 0; i < n; i++) cards.push({ x: x0 + i * (cw + gap), y: y, s: cw / 2, kind: i });
      this.cards = cards;
      return cards;
    },
    update(g, dt) {
      const p = g.pizza;
      this.t += dt;
      g.fireLevel = 0.85;
      g.pz.visible = true;
      g.pz.x = g.board.x;
      g.pz.y = g.board.y - Math.min(1, this.t * 0.9) * (g.land ? 105 : 130);
      g.pz.scale = U.approach(g.pz.scale, g.land ? 0.86 : 0.9, 4, dt);
      g.pz.squash = 0.60;
      p.spin *= Math.exp(-2 * dt);
      p.applySpin(dt);
      this.layout(g);
      if (U.chance(dt * 3.5)) {
        const a = U.rand(0, TAU);
        g.parts.star(g.pz.x + Math.cos(a) * p.meanR() * 1.1, g.pz.y + Math.sin(a) * p.meanR() * 0.7, 1, 20, '#ffe9a8');
      }
    },
    drawWorld(g, ctx) {
      A.drawPlate(ctx, g.pz.x, g.pz.y + g.pizza.meanR() * g.pz.squash * 0.16,
        g.pizza.meanR() * g.pz.scale * 1.17, g.pz.squash);
    },
    drawScreen(g, ctx) {
      const t = g.t;
      for (let i = 0; i < this.cards.length; i++) {
        const c = this.cards[i];
        const k = U.sat((this.t - 0.5 - i * 0.12) * 2.4);
        if (k <= 0) continue;
        const pop = U.easeOutBack(k);
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(pop, pop);
        ctx.translate(0, Math.sin(t * 2 + i) * c.s * 0.04);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        U.roundRect(ctx, -c.s, -c.s + 7, c.s * 2, c.s * 2, c.s * 0.3); ctx.fill();
        const gg = ctx.createLinearGradient(0, -c.s, 0, c.s);
        gg.addColorStop(0, '#fffaf4'); gg.addColorStop(1, '#ffe1ec');
        ctx.fillStyle = gg;
        U.roundRect(ctx, -c.s, -c.s, c.s * 2, c.s * 2, c.s * 0.3); ctx.fill();
        ctx.strokeStyle = 'rgba(244,138,176,0.85)'; ctx.lineWidth = c.s * 0.09;
        U.roundRect(ctx, -c.s, -c.s, c.s * 2, c.s * 2, c.s * 0.3); ctx.stroke();
        if (c.kind === 0) {
          A.drawMiniPizza(ctx, 0, 0, c.s * 0.62, g.recipe, t);
          // くるっと矢印
          ctx.strokeStyle = 'rgba(120,180,120,0.95)'; ctx.lineWidth = c.s * 0.11; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(0, 0, c.s * 0.78, -0.4, Math.PI * 1.2); ctx.stroke();
        } else if (c.kind === 1) {
          for (let j = 0; j < 3; j++) {
            A.drawMiniPizza(ctx, (j - 1) * c.s * 0.52, (j === 1 ? -c.s * 0.16 : c.s * 0.1), c.s * 0.34, RECIPES[j], t);
          }
        } else {
          A.drawMiniPizza(ctx, 0, 0, c.s * 0.62, RECIPES[3], t);
          for (let j = 0; j < 6; j++) {
            ctx.fillStyle = A.rainbow[j];
            ctx.beginPath(); ctx.arc(-c.s * 0.6 + j * c.s * 0.24, -c.s * 0.72, c.s * 0.08, 0, TAU); ctx.fill();
          }
        }
        ctx.restore();
      }
    },
    guideScreen(g, ctx, al) {
      if (this.t < 1.4 || !this.cards.length) return;
      const i = Math.floor(g.t / 1.6) % this.cards.length;
      const c = this.cards[i];
      A.drawTapRing(ctx, c.x, c.y, (g.t % 1), al * 0.8, c.s * 0.8);
      A.drawGhostHand(ctx, c.x + c.s * 0.32, c.y + c.s * 0.56, 0, c.s / 110, al * 0.78);
    },
    up(g) {
      if (this.t < 0.9) return;
      const i = g.input;
      for (let k = 0; k < this.cards.length; k++) {
        const c = this.cards[k];
        if (Math.abs(i.sx - c.x) < c.s * 1.15 && Math.abs(i.sy - c.y) < c.s * 1.15) {
          S.tap(1.1);
          if (c.kind === 0) { g.setStage('DOUGH'); }
          else if (c.kind === 1) { g.setStage('CHOOSE'); }
          else { g.recipe = RECIPES[3]; g.setStage('DOUGH'); }
          return;
        }
      }
    }
  };

})();
