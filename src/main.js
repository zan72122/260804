// Tasty Travels 3D — entry point and game rules.

import * as THREE from 'three';
import { View } from './engine/view.js';
import { FX } from './engine/fx.js';
import { Audio } from './engine/audio.js';
import { Environment } from './world/environment.js';
import { Stall } from './world/stall.js';
import { DESTINATIONS, destById } from './world/destinations.js';
import { Board } from './game/board.js';
import { GameState } from './game/state.js';
import { OrderSystem } from './game/orders.js';
import { Input } from './game/input.js';
import { Hud } from './ui/hud.js';
import { Pinball } from './pinball/mode.js';
import { LOADABLE } from './pinball/recipes.js';
import { ITEMS, PRODUCERS, CHAINS, chainById } from './game/items.js';
import { BOARD, PRODUCER_CELLS, cellPos } from './game/config.js';
import { clamp } from './engine/util.js';

const boot = document.getElementById('boot');
const bootFill = document.getElementById('boot-fill');
const bootStep = document.getElementById('boot-step');
const bootStart = document.getElementById('boot-start');

const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
async function step(label, pct, fn) {
  bootStep.textContent = label;
  bootFill.style.width = `${pct}%`;
  await frame(); await frame();
  return fn?.();
}

function fatal(err) {
  console.error(err);
  const el = document.getElementById('fatal');
  el.classList.remove('hidden');
  el.textContent =
    `このブラウザでは 3D 表示を初期化できませんでした。\n\n${err?.message || err}\n\n` +
    'WebGL2 に対応した最新のブラウザでお試しください。';
}

class Game {
  constructor() {
    this.state = new GameState();
    this.state.load();
    this.dest = destById(this.state.destination);

    this.view = new View(document.getElementById('stage'));
    this.view.setQuality(this._autoQuality());
    this.fx = new FX(this.view.scene);
    this.audio = new Audio();
    this.env = new Environment(this.view);
    this.stall = new Stall(this.view);
    this.board = new Board(this.view, this.fx);
    this.orders = new OrderSystem(this.view, this.state, this.fx);
    this.pinball = new Pinball(this.view, this.stall, this.fx, this.audio);
    this.hud = new Hud(this.state);

    this.saveTimer = 0;
    this.hudTimer = 0;
    this.elapsed = 0;
    this.tutorial = this.state.tutorialDone ? 3 : 0;
  }

  _autoQuality() {
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    if (mobile || cores <= 4 || mem <= 3) return 'mid';
    return 'high';
  }

  async build() {
    await step('地形と空をつくる…', 18, () => this.env.build(this.dest));
    await step('屋台を組み立てる…', 42, () => this.stall.build(this.dest));
    await step('食材を仕込む…', 62, () => this.setupBoard());
    await step('お客さんを呼ぶ…', 80, () => this.orders.restore(this.state.orders));
    await step('仕上げ…', 94, () => {
      this.env.setLightBudget(this.view.quality);
      this._applyShadowSizes();
      this.bindUi();
      this.hud.setPlace(this.dest);
      this.hud.sync();
      this.hud.setOrders(this.orders.list());
    });
    bootFill.style.width = '100%';
    bootStep.textContent = '準備完了';
  }

  // ------------------------------------------------------------ board ----
  setupBoard() {
    this.board.clear();
    // Producers first — they own the four corners of the tray.
    this.placeProducers();

    const layout = this.state.boardLayout;
    if (layout?.length) {
      for (const it of layout) {
        if (!ITEMS[it.id]) continue;
        if (this.board.get(it.c, it.r)) continue;
        this.board.add(it.id, it.c, it.r, { animate: 'none' });
      }
    } else {
      // Opening hand: enough to make the first merge obvious.
      const start = [
        ['veg1', 2, 1], ['veg1', 3, 1], ['veg2', 4, 2],
        ['bread1', 2, 3], ['bread1', 3, 3], ['veg2', 3, 2],
      ];
      for (const [id, c, r] of start) this.board.add(id, c, r, { animate: 'none' });
    }
  }

  placeProducers() {
    CHAINS.forEach((chain, i) => {
      if (this.state.level < chain.unlockLevel) return;
      const cell = PRODUCER_CELLS[i];
      const occupant = this.board.get(cell.col, cell.row);
      if (occupant?.id === chain.producer.id) return;
      if (occupant) {
        const free = this.board.findFree(3, 2);
        if (free) this.board.moveTo(occupant, free.col, free.row);
        else this.board.remove(occupant);
      }
      this.board.add(chain.producer.id, cell.col, cell.row, { animate: 'spawn', rotation: (i % 2 ? 0.2 : -0.2) });
    });
  }

  // -------------------------------------------------------------- ui ----
  bindUi() {
    const h = this.hud.el;
    h.btnTravel.addEventListener('click', () => {
      this.audio.resume();
      this.hud.openTravel((d) => this.travelTo(d));
    });
    h.travelClose.addEventListener('click', () => this.hud.closeTravel());
    h.travel.addEventListener('click', (e) => { if (e.target === h.travel) this.hud.closeTravel(); });
    h.btnPinball.addEventListener('click', () => this.togglePinball());
    h.btnCam.addEventListener('click', () => this.view.resetCamera());
    h.btnQuality.addEventListener('click', () => this.cycleQuality());
    h.btnSound.addEventListener('click', () => {
      this.audio.setEnabled(!this.audio.enabled);
      h.btnSound.textContent = this.audio.enabled ? '♪ ON' : '♪ OFF';
    });
    h.btnReset.addEventListener('click', () => {
      if (!confirm('進行状況を消して最初からやり直しますか？')) return;
      if (this.pinball.active) this.togglePinball();
      this.state.wipe();
      this.state.reset();
      this.dest = destById(this.state.destination);
      this.env.build(this.dest);
      this.stall.build(this.dest);
      this._applyShadowSizes();
      this.setupBoard();
      for (const c of this.orders.customers) { this.orders._teardown(c); c.state = 'empty'; c.order = null; }
      this.orders.refill(true);
      this.hud.setPlace(this.dest);
      this.hud.sync();
      this.tutorial = 0;
      this.hud.toast('新しい旅を始めました', 'good');
    });

    this.input = new Input(this.view, this.board, this.orders, {
      onPickup: (e) => { this.audio.resume(); this.audio.pickup(); },
      onTap: (e) => this.onTap(e),
      onDrop: (e, cell, cust) => this.onDrop(e, cell, cust),
    });

    this.input.setPinball(this.pinball);
    this.hud.setupPinball(LOADABLE, (id) => this.loadPinballBall(id));
    this.pinball.onMake = ({ def }) => this.hud.addMade(def);
    this.pinball.onDeliver = ({ def, quality, score }) => {
      this.hud.addMade(def);
      this.hud.toast(`${def.name} 納品！ ${quality > 1.5 ? '熱々 ' : ''}+${score}`, 'gold');
    };

    this.orders.onChange = () => {
      this.hud.setOrders(this.orders.list());
      this.refreshReady();
    };

    this.state.on('levelup', (lv) => this.onLevelUp(lv));
    this.state.on('chainunlock', (chain) => {
      this.placeProducers();
      this.hud.toast(`${chain.name}の仕入れが解放されました`, 'gold');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
      else this.state.tick();
    });
    window.addEventListener('beforeunload', () => this.save());
  }

  /** Raise the counter into a pinball table, or lower it back. */
  togglePinball() {
    this.audio.resume();
    if (this.pinball.active) {
      this.pinball.exit();
      this.board.root.visible = true;
      this.hud.showPinball(false);
      this.hud.el.btnPinball.textContent = '🕹 ピンボール';
      this.hud.hint('食材をドラッグして重ねるとマージ。注文の品はお客さんへ。');
    } else {
      this.board.root.visible = false;
      this.board.hover.visible = false;
      this.pinball.enter(this.dest);
      this.hud.showPinball(true);
      this.hud.el.btnPinball.textContent = '🍅 作業台へ戻る';
      this.hud.hint('麺棒を下へドラッグして離すと発射（Space長押しでも可）。画面左右タップ／←→キーでフリッパー。Z・Xで台を揺らす。');
    }
  }

  /** Feed an ingredient into the shooter lane. */
  loadPinballBall(id) {
    this.audio.resume();
    const res = this.pinball.loadBall(id);
    if (res === 'occupied') this.hud.toast('レーンに球が残っています', 'bad');
    else if (res === 'full') this.hud.toast('台の上がいっぱいです', 'bad');
  }

  cycleQuality() {
    const order = ['high', 'mid', 'low'];
    const next = order[(order.indexOf(this.view.quality) + 1) % order.length];
    this.view.setQuality(next);
    this.env.setLightBudget(next);
    this._applyShadowSizes();
    this.hud.el.btnQuality.textContent = `画質: ${next === 'high' ? '高' : next === 'mid' ? '中' : '低'}`;
  }

  _applyShadowSizes() {
    const size = this.view.shadowSize;
    for (const light of [this.env.sun, this.stall.lamp]) {
      if (!light) continue;
      light.shadow.mapSize.set(size, size);
      light.shadow.map?.dispose();
      light.shadow.map = null;
    }
  }

  // ------------------------------------------------------ interaction ----
  onTap(entry) {
    this.audio.resume();
    if (entry.isProducer) return this.produce(entry);
    const def = ITEMS[entry.id];
    entry.vy = 0.32;                     // a nudge, like poking it with a finger
    entry.y = Math.max(entry.y, 0.001);
    this.hud.toast(`${def.name}（Lv.${def.tier}）`, '');
    this.audio.pickup();
  }

  produce(entry) {
    const def = PRODUCERS[entry.id];
    const res = this.state.useProducer(entry.id);
    if (res === 'empty') {
      this.hud.toast('仕入れ待ち — しばらくすると補充されます', 'bad');
      this.audio.deny();
      entry.tilt.set(0.1, 0);
      return;
    }
    if (res === 'tired') {
      this.hud.toast('エネルギーが足りません', 'bad');
      this.audio.deny();
      return;
    }
    const free = this.board.findFree(entry.col, entry.row);
    if (!free) {
      this.hud.toast('作業台がいっぱいです', 'bad');
      this.audio.deny();
      // Refund: nothing was produced.
      this.state.producers[entry.id].charges++;
      this.state.addEnergy(def.cost);
      return;
    }
    const e = this.board.add(def.seed, free.col, free.row, { animate: 'drop' });
    // Toss the new item out of the crate rather than teleporting it.
    const from = cellPos(entry.col, entry.row);
    e.mesh.position.set(from.x, BOARD.surfaceY + 0.1, from.z);
    e.y = 0.1; e.vy = 0.55;

    const p = new THREE.Vector3(from.x, BOARD.surfaceY + 0.06, from.z);
    this.fx.dust(p, 5, 0.05);
    this.fx.ring(p, 0xffe0b0, 0.09, 0.4);
    entry.vy = 0.22; entry.y = Math.max(entry.y, 0.001);
    this.audio.produce();
    this.hud.sync();
    this.advanceTutorial(1);
  }

  onDrop(entry, cell, customer) {
    this.audio.drop(entry.mass);

    // 1) Delivery to a customer.
    if (customer && customer.order?.itemId === entry.id) {
      const reward = this.orders.deliver(customer, entry.id);
      if (reward) {
        const from = entry.mesh.position.clone();
        this.board.remove(entry);
        this.state.addCoins(reward.coin);
        this.state.addXp(reward.xp);
        this.state.addEnergy(reward.energy);
        const bowl = this.stall.coinBowl?.position?.clone() || new THREE.Vector3(-0.45, BOARD.surfaceY, 0.3);
        bowl.y += 0.03;
        this.fx.coins(from.clone().setY(from.y + 0.05), bowl, 7);
        this.fx.steam(from.clone().setY(from.y + 0.04));
        this.audio.coin(5);
        this.hud.toast(`◉ +${reward.coin}   +${reward.xp}XP`, 'gold');
        this.hud.sync();
        this.advanceTutorial(3);
        this.queueSave();
        return;
      }
    }
    if (customer) {
      // Wrong dish: the customer shakes their head, item goes home.
      this.hud.toast('その品は注文と違うようです', 'bad');
      this.audio.deny();
      this.returnHome(entry);
      return;
    }

    // 2) Board placement.
    if (!cell) { this.returnHome(entry); return; }
    const occ = this.board.get(cell.col, cell.row);
    if (!occ || occ === entry) {
      this.board.moveTo(entry, cell.col, cell.row);
      return;
    }
    if (occ.id === entry.id && !occ.isProducer && !ITEMS[occ.id]?.isMax) {
      this.doMerge(entry, occ);
      return;
    }
    if (occ.isProducer || occ.locked) { this.returnHome(entry); return; }
    this.board.swap(entry, occ);
  }

  returnHome(entry) {
    const p = cellPos(entry.col, entry.row);
    entry.target.set(p.x, BOARD.surfaceY, p.z);
  }

  doMerge(from, onto) {
    const made = this.board.merge(from, onto);
    if (!made) { this.returnHome(from); return; }
    const def = ITEMS[made.id];
    const pos = new THREE.Vector3(made.mesh.position.x, BOARD.surfaceY + 0.03, made.mesh.position.z);
    this.fx.flash(pos, 0xffd9a0, 0.14 + def.tier * 0.03);
    this.fx.sparks(pos, def.tier >= 4 ? 0xffe08a : 0xffc46a, 8 + def.tier * 4, 0.4 + def.tier * 0.06);
    this.fx.ring(pos.clone().setY(BOARD.surfaceY), 0xffd9a0, 0.1 + def.tier * 0.02, 0.5);
    if (def.isMax) this.fx.steam(pos.clone().setY(BOARD.surfaceY + 0.06));
    this.view.addShake(0.08 + def.tier * 0.02);
    this.audio.merge(def.tier);

    this.state.stats.merges++;
    this.state.addXp(def.xp);
    this.state.addCoins(Math.round(def.coin * 0.25));
    this.hud.sync();
    this.refreshReady();
    this.advanceTutorial(2);
    this.queueSave();
  }

  onLevelUp(lv) {
    this.hud.toast(`レベル ${lv} に上がりました！`, 'good');
    this.audio.levelup();
    const p = new THREE.Vector3(BOARD.centerX, BOARD.surfaceY, BOARD.centerZ);
    this.fx.ring(p, 0xffe6b0, 0.55, 0.9);
    this.fx.sparks(p.clone().setY(BOARD.surfaceY + 0.1), 0xffe6b0, 26, 0.8);
    this.view.addShake(0.3);
    this.hud.sync();
  }

  /** Highlight orders the player can already fulfil from the board. */
  refreshReady() {
    const have = new Set(this.board.entries.map((e) => e.id));
    const ready = new Set();
    for (const c of this.orders.customers) {
      if (c.state === 'waiting' && c.order && have.has(c.order.itemId)) ready.add(c.index);
    }
    this.hud.markReady(ready);
  }

  // ---------------------------------------------------------- travel ----
  travelTo(dest) {
    if (dest.id === this.state.destination) return;
    if (this.pinball.active) this.togglePinball();
    if (!this.state.travel(dest.id)) {
      this.hud.toast('コインが足りません', 'bad');
      return;
    }
    this.audio.travel();
    this.dest = dest;
    // Quick veil so the rebuild is not a visible pop.
    boot.classList.remove('fade');
    boot.style.transition = 'opacity .35s ease';
    boot.style.opacity = '1';
    boot.classList.remove('hidden');
    bootStep.textContent = `${dest.name} へ移動中…`;
    bootStart.classList.add('hidden');
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.env.build(dest);
        this.stall.build(dest);
        this._applyShadowSizes();
        this.env.setLightBudget(this.view.quality);
        this.hud.setPlace(dest);
        this.hud.toast(`${dest.name} に到着`, 'gold');
        this.view.resetCamera();
        boot.style.opacity = '0';
        setTimeout(() => boot.classList.add('hidden'), 400);
        this.queueSave();
      }, 380);
    });
  }

  // -------------------------------------------------------- tutorial ----
  advanceTutorial(stage) {
    if (this.tutorial >= 3) return;
    if (stage <= this.tutorial) return;
    this.tutorial = stage;
    if (stage === 1) this.hud.hint('同じ食材どうしを重ねるとマージして上位の品になります。');
    if (stage === 2) this.hud.hint('注文の品ができたら、お客さんへドラッグして届けましょう。');
    if (stage === 3) {
      this.hud.hint('コインを貯めて次の街へ。背景をドラッグすると視点を動かせます。');
      this.state.tutorialDone = true;
    }
  }

  // ------------------------------------------------------------ loop ----
  queueSave() { this.saveTimer = Math.min(this.saveTimer, 1.2); }

  save() { this.state.save(this.board, this.orders); }

  /** Advance the simulation by dt seconds. Rendering is the caller's job. */
  step(dt) {
    this.elapsed += dt;
    this.view.update(dt);
    this.env.update(dt, this.elapsed);
    this.stall.update(dt, this.elapsed);
    if (this.pinball.active) {
      this.pinball.update(dt, this.elapsed);
      this.hud.setLoadersBusy(!!this.pinball.waitingBall || this.pinball.balls.length >= 6);
      this.hud.setPinScore(this.pinball.score, this.pinball.delivered.length);
    } else {
      this.board.update(dt, this.elapsed);
    }
    this.orders.update(dt, this.elapsed);
    this.fx.update(dt);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.5;
      this.state.tick();
      this.hud.sync();
    }
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) { this.saveTimer = 8; this.save(); }
  }

  start() {
    this.hud.show();
    let last = performance.now() / 1000;
    const tick = () => {
      const now = performance.now() / 1000;
      // Clamped so a slow frame or a backgrounded tab cannot teleport items
      // across the board or fast-forward the whole shift.
      const dt = Math.min(0.05, now - last);
      last = now;
      this.step(dt);
      this.view.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// ------------------------------------------------------------ bootstrap ----
(async () => {
  try {
    const game = new Game();
    window.game = game;                    // handy for debugging in the console
    await game.build();
    game.refreshReady();
    if (!game.state.tutorialDone) game.hud.hint('まずは四隅の仕入れ箱をタップして食材を出しましょう。');

    bootStart.classList.remove('hidden');
    bootStep.textContent = '';
    bootStart.addEventListener('click', () => {
      game.audio.resume();
      boot.classList.add('fade');
      setTimeout(() => boot.classList.add('hidden'), 650);
      game.start();
    }, { once: true });

    // Render one frame behind the boot screen so the first visible frame is warm.
    game.view.update(0.016);
    game.view.render();
  } catch (err) {
    fatal(err);
  }
})();
