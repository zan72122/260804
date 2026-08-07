// DOM overlay: resources, order list, toasts, travel dialog. The 3-D scene
// carries the game; this layer only carries numbers and words.

import { fmt } from '../engine/util.js';
import { DESTINATIONS } from '../world/destinations.js';
import { ITEMS } from '../game/items.js';

const $ = (id) => document.getElementById(id);

const CHAIN_ICON = { veg: '🍅', bread: '🥖', sea: '🐟', drink: '🍋', table: '🍕' };

export class Hud {
  constructor(state) {
    this.state = state;
    this.el = {
      hud: $('hud'),
      lv: $('lv-num'), xp: $('xp-fill'),
      coin: $('coin-num'), en: $('en-num'), enFill: $('en-fill'), enTimer: $('en-timer'),
      place: $('place-name'), placeSub: $('place-sub'),
      orders: $('orders'), toasts: $('toasts'), hint: $('hint'),
      travel: $('travel'), travelList: $('travel-list'),
      btnTravel: $('btn-travel'), btnCam: $('btn-cam'), btnQuality: $('btn-quality'),
      btnPinball: $('btn-pinball'),
      pinbar: $('pinbar'), pinLoad: $('pinbar-load'), made: $('pinbar-made'),
      btnSound: $('btn-sound'), btnReset: $('btn-reset'), travelClose: $('travel-close'),
    };
    this.orderNodes = new Map();
  }

  show() { this.el.hud.classList.remove('hidden'); }

  sync() {
    const s = this.state;
    this.el.lv.textContent = s.level;
    this.el.xp.style.width = `${Math.min(100, (s.xp / s.xpNeeded) * 100)}%`;
    this.el.coin.textContent = fmt(s.coins);
    this.el.en.textContent = `${Math.floor(s.energy)}/${s.energyMax}`;
    this.el.enFill.style.width = `${(s.energy / s.energyMax) * 100}%`;
    const eta = s.energyEta;
    this.el.enTimer.textContent = eta > 0 ? `${Math.floor(eta / 60)}:${String(Math.floor(eta % 60)).padStart(2, '0')}` : '満タン';
  }

  setPlace(dest) {
    this.el.place.textContent = dest.name;
    this.el.placeSub.textContent = dest.sub;
  }

  /** Mirror of the 3-D order tickets, for quick scanning. */
  setOrders(list) {
    const seen = new Set();
    for (const entry of list) {
      if (!entry.order || (entry.state !== 'waiting' && entry.state !== 'arriving')) continue;
      seen.add(entry.index);
      const key = `${entry.index}:${entry.order.itemId}`;
      let node = this.orderNodes.get(entry.index);
      if (!node || node.dataset.key !== key) {
        node?.remove();
        node = document.createElement('div');
        node.className = 'order-card';
        node.dataset.key = key;
        node.innerHTML = `
          <div class="order-face">${CHAIN_ICON[ITEMS[entry.order.itemId]?.chain] || '🍽'}</div>
          <div class="order-body">
            <div class="order-name"></div>
            <div class="order-meta"></div>
          </div>`;
        this.el.orders.appendChild(node);
        this.orderNodes.set(entry.index, node);
      }
      node.querySelector('.order-name').textContent = entry.order.name;
      node.querySelector('.order-meta').innerHTML =
        `<b>◉${entry.order.coin}</b> ・ +${entry.order.xp}XP ・ ⚡+${entry.order.energy}`;
    }
    for (const [idx, node] of [...this.orderNodes]) {
      if (!seen.has(idx)) { node.remove(); this.orderNodes.delete(idx); }
    }
  }

  markReady(indices) {
    for (const [idx, node] of this.orderNodes) {
      node.classList.toggle('ready', indices.has(idx));
      const meta = node.querySelector('.order-meta');
      if (indices.has(idx) && !meta.querySelector('.ready-tag')) {
        meta.insertAdjacentHTML('beforeend', ' <span class="ready-tag">✓ 用意できた</span>');
      } else if (!indices.has(idx)) {
        meta.querySelector('.ready-tag')?.remove();
      }
    }
  }

  // ------------------------------------------------------- pinball ----
  /** Build the ingredient loader once; the callback fires with an item id. */
  setupPinball(ids, onLoad) {
    const bar = this.el.pinLoad;
    bar.innerHTML = '';
    this.loadButtons = new Map();
    for (const id of ids) {
      const item = ITEMS[id];
      if (!item) continue;
      const b = document.createElement('button');
      b.className = 'load-btn';
      b.innerHTML = `<span class="ico">${CHAIN_ICON[item.chain] || '🍽'}</span>${item.name}`;
      b.addEventListener('click', () => onLoad(id));
      bar.appendChild(b);
      this.loadButtons.set(id, b);
    }
  }

  showPinball(on) {
    this.el.pinbar.classList.toggle('hidden', !on);
    if (on) this.el.made.innerHTML = '';
  }

  /** Grey the loaders out while the lane is occupied. */
  setLoadersBusy(busy) {
    for (const b of this.loadButtons?.values() || []) b.classList.toggle('busy', busy);
  }

  /** Announce something produced on the table. */
  addMade(def) {
    if (!def) return;
    const chip = document.createElement('div');
    chip.className = `made-chip${def.kind === 'dish' || def.isMax ? '' : ' proc'}`;
    chip.textContent = def.name;
    this.el.made.appendChild(chip);
    while (this.el.made.children.length > 4) this.el.made.firstChild.remove();
    setTimeout(() => chip.remove(), 4200);
  }

  toast(text, kind = '') {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = text;
    this.el.toasts.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }

  hint(text) { this.el.hint.textContent = text; }

  openTravel(onPick) {
    const s = this.state;
    this.el.travelList.innerHTML = '';
    for (const d of DESTINATIONS) {
      const owned = s.unlocked.includes(d.id);
      const affordable = owned || s.coins >= d.cost;
      const current = s.destination === d.id;
      const node = document.createElement('div');
      node.className = `travel-item${affordable ? '' : ' locked'}${current ? ' current' : ''}`;
      node.innerHTML = `
        <div class="ti-swatch" style="background:${d.swatch}"></div>
        <div>
          <div class="ti-name">${d.name}</div>
          <div class="ti-sub">${d.sub}</div>
        </div>
        <div class="ti-cost">${current ? '滞在中' : owned ? '訪問済み' : `◉ ${fmt(d.cost)}`}</div>`;
      if (affordable && !current) node.addEventListener('click', () => { onPick(d); this.closeTravel(); });
      this.el.travelList.appendChild(node);
    }
    this.el.travel.classList.remove('hidden');
  }

  closeTravel() { this.el.travel.classList.add('hidden'); }
}
