// Persistent game state: economy, progression, producer charges, and the
// board layout. Everything lives in one serialisable object saved to
// localStorage, so closing the tab never costs the player a shift.

import { PRODUCERS, CHAINS } from './items.js';
import { DESTINATIONS } from '../world/destinations.js';

const KEY = 'tastytravels3d.save.v1';
const ENERGY_MAX = 60;
const ENERGY_PERIOD = 22;      // seconds per point

export const xpForLevel = (lv) => Math.round(38 * Math.pow(lv, 1.42));

export class GameState {
  constructor() {
    this.listeners = new Map();
    this.reset(true);
  }

  on(evt, fn) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt).push(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn) {
    const a = this.listeners.get(evt);
    if (a) a.splice(a.indexOf(fn) >>> 0, 1);
  }
  emit(evt, payload) {
    for (const fn of this.listeners.get(evt) || []) fn(payload);
  }

  reset(silent = false) {
    this.coins = 60;
    this.xp = 0;
    this.level = 1;
    this.energy = ENERGY_MAX;
    this.energyMax = ENERGY_MAX;
    this.lastTick = Date.now() / 1000;
    this.destination = DESTINATIONS[0].id;
    this.unlocked = [DESTINATIONS[0].id];
    this.stats = { merges: 0, delivered: 0, produced: 0 };
    this.producers = {};
    for (const id of Object.keys(PRODUCERS)) {
      this.producers[id] = { charges: PRODUCERS[id].capacity, last: Date.now() / 1000 };
    }
    this.boardLayout = null;
    this.orders = null;
    this.tutorialDone = false;
    if (!silent) this.emit('change', this);
  }

  // ------------------------------------------------------- economy ----
  addCoins(n) {
    this.coins = Math.max(0, this.coins + n);
    this.emit('coins', n);
    this.emit('change', this);
  }

  spendCoins(n) {
    if (this.coins < n) return false;
    this.coins -= n;
    this.emit('change', this);
    return true;
  }

  addXp(n) {
    this.xp += n;
    let leveled = 0;
    while (this.xp >= xpForLevel(this.level)) {
      this.xp -= xpForLevel(this.level);
      this.level++;
      leveled++;
    }
    if (leveled) {
      this.energy = this.energyMax;      // level-up refills the shift
      this.emit('levelup', this.level);
      const unlocked = CHAINS.filter((c) => c.unlockLevel === this.level);
      for (const c of unlocked) this.emit('chainunlock', c);
    }
    this.emit('change', this);
    return leveled;
  }

  get xpNeeded() { return xpForLevel(this.level); }

  // -------------------------------------------------------- energy ----
  spendEnergy(n) {
    if (this.energy < n) return false;
    this.energy -= n;
    this.emit('change', this);
    return true;
  }

  addEnergy(n) {
    this.energy = Math.min(this.energyMax, this.energy + n);
    this.emit('change', this);
  }

  /** Offline-aware regeneration; also refills producer charges. */
  tick() {
    const now = Date.now() / 1000;
    const dt = Math.max(0, now - this.lastTick);
    if (this.energy < this.energyMax) {
      const gained = Math.floor(dt / ENERGY_PERIOD);
      if (gained > 0) {
        this.energy = Math.min(this.energyMax, this.energy + gained);
        this.lastTick += gained * ENERGY_PERIOD;
        this.emit('change', this);
      }
    } else {
      this.lastTick = now;
    }

    for (const [id, p] of Object.entries(this.producers)) {
      const def = PRODUCERS[id];
      if (p.charges >= def.capacity) { p.last = now; continue; }
      const gained = Math.floor((now - p.last) / def.refill);
      if (gained > 0) {
        p.charges = Math.min(def.capacity, p.charges + gained);
        p.last += gained * def.refill;
        this.emit('producers', id);
      }
    }
  }

  /** Seconds until the next energy point. */
  get energyEta() {
    if (this.energy >= this.energyMax) return 0;
    return Math.max(0, ENERGY_PERIOD - (Date.now() / 1000 - this.lastTick));
  }

  useProducer(id) {
    const p = this.producers[id];
    const def = PRODUCERS[id];
    if (!p || p.charges <= 0) return 'empty';
    if (this.energy < def.cost) return 'tired';
    if (p.charges >= def.capacity) p.last = Date.now() / 1000;
    p.charges--;
    this.energy -= def.cost;
    this.stats.produced++;
    this.emit('change', this);
    this.emit('producers', id);
    return 'ok';
  }

  producerCharges(id) { return this.producers[id]?.charges ?? 0; }

  // ------------------------------------------------------- travel ----
  travel(destId) {
    const d = DESTINATIONS.find((x) => x.id === destId);
    if (!d) return false;
    if (!this.unlocked.includes(destId)) {
      if (!this.spendCoins(d.cost)) return false;
      this.unlocked.push(destId);
    }
    this.destination = destId;
    this.emit('travel', d);
    this.emit('change', this);
    return true;
  }

  // --------------------------------------------------------- save ----
  serialize(board, orders) {
    return {
      v: 1,
      coins: this.coins, xp: this.xp, level: this.level,
      energy: this.energy, lastTick: this.lastTick,
      destination: this.destination, unlocked: this.unlocked,
      producers: this.producers, stats: this.stats,
      tutorialDone: this.tutorialDone,
      board: board ? board.serialize() : this.boardLayout,
      orders: orders ? orders.serialize() : this.orders,
    };
  }

  save(board, orders) {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.serialize(board, orders)));
    } catch (err) {
      // Private-mode / quota: the game keeps running, it just will not persist.
      console.warn('save failed', err);
    }
  }

  load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch { return false; }
    if (!raw) return false;
    try {
      const d = JSON.parse(raw);
      if (!d || d.v !== 1) return false;
      this.coins = d.coins ?? this.coins;
      this.xp = d.xp ?? 0;
      this.level = d.level ?? 1;
      this.energy = Math.min(this.energyMax, d.energy ?? this.energyMax);
      this.lastTick = d.lastTick ?? Date.now() / 1000;
      this.destination = d.destination ?? DESTINATIONS[0].id;
      this.unlocked = d.unlocked?.length ? d.unlocked : [DESTINATIONS[0].id];
      this.stats = d.stats ?? this.stats;
      this.tutorialDone = !!d.tutorialDone;
      for (const id of Object.keys(PRODUCERS)) {
        this.producers[id] = d.producers?.[id] ?? { charges: PRODUCERS[id].capacity, last: Date.now() / 1000 };
      }
      this.boardLayout = Array.isArray(d.board) ? d.board : null;
      this.orders = Array.isArray(d.orders) ? d.orders : null;
      return true;
    } catch (err) {
      console.warn('load failed', err);
      return false;
    }
  }

  wipe() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }
}
