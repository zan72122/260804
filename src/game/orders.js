// Customers and their orders.
//
// An order is not a UI card first — it is a person standing at your counter
// holding a paper ticket, with the dish they want floating above it as an
// actual 3-D model. You deliver by dragging the dish onto them.

import * as THREE from 'three';
import * as M from '../engine/materials.js';
import * as G from '../engine/geo.js';
import * as TEX from '../engine/textures.js';
import { buildPerson, walkPose, idlePose } from '../world/people.js';
import { CHAINS, ITEMS, buildIcon } from './items.js';
import { CUSTOMER_SLOTS, COUNTER } from './config.js';
import { makeRng, damp, clamp, easeOutCubic } from '../engine/util.js';

const rng = makeRng(20240411);

const ARRIVE_FROM = 2.6;       // metres to the side the customer walks in from

class Customer {
  constructor(slot, index) {
    this.slot = slot;
    this.index = index;
    this.state = 'empty';       // empty | arriving | waiting | happy | leaving
    this.t = 0;
    this.order = null;
    this.group = new THREE.Group();
    this.person = null;
    this.bubble = null;
    this.icon = null;
    this.hit = null;
    this.seed = rng.range(0, 10);
  }
}

export class OrderSystem {
  constructor(view, state, fx) {
    this.view = view;
    this.state = state;
    this.fx = fx;
    this.root = new THREE.Group();
    this.root.name = 'customers';
    view.scene.add(this.root);
    this.customers = CUSTOMER_SLOTS.map((s, i) => new Customer(s, i));
    for (const c of this.customers) this.root.add(c.group);
    this.onChange = null;
  }

  // ------------------------------------------------------ generation ----
  availableChains() {
    return CHAINS.filter((c) => this.state.level >= c.unlockLevel);
  }

  rollOrder() {
    const chains = this.availableChains();
    const chain = chains[Math.floor(rng() * chains.length)];
    const lv = this.state.level;
    // Ask for what the player can plausibly build right now: tier 2 early,
    // creeping up to the top of the chain as they level.
    let lo = 2, hi = 2;
    if (lv >= 2) hi = 3;
    if (lv >= 4) { lo = 2; hi = 4; }
    if (lv >= 7) { lo = 3; hi = 5; }
    if (lv >= 11) { lo = 3; hi = 5; }
    const tier = Math.min(chain.items.length, lo + Math.floor(rng() * (hi - lo + 1)));
    const item = chain.items[tier - 1];
    const def = ITEMS[item.id];
    return {
      itemId: item.id,
      name: def.name,
      coin: Math.round(def.coin * 2.4 + lv * 4),
      xp: Math.round(def.xp * 2 + 1),
      energy: def.tier >= 4 ? 6 : def.tier >= 3 ? 3 : 1,
      patience: 1,
    };
  }

  /** Fill any empty slot, spacing arrivals so three do not pop in at once. */
  refill(immediate = false) {
    let delay = 0;
    for (const c of this.customers) {
      if (c.state !== 'empty') continue;
      this.spawn(c, this.rollOrder(), immediate ? 0 : delay);
      delay += 0.9;
    }
  }

  spawn(c, order, delay = 0) {
    this._teardown(c);
    c.order = order;
    c.state = 'arriving';
    c.t = -delay;

    const person = buildPerson(rng, { height: rng.range(1.58, 1.88), detail: 'near' });
    person.position.set(0, 0, 0);
    c.person = person;
    c.group.add(person);

    // Order ticket: a real card of paper on a wooden clip, held up at chest
    // height, with the requested dish modelled above it.
    const bubble = new THREE.Group();
    const def = ITEMS[order.itemId];
    const tex = TEX.label({
      w: 320, h: 200, bg: '#f3e7c9', radius: 18,
      lines: [
        { text: def.name, size: 40, color: '#4a3520', y: 52 },
        { text: `◉ ${order.coin}`, size: 34, color: '#8a6a24', y: 116 },
        { text: `+${order.xp} XP   ⚡+${order.energy}`, size: 24, color: '#7a6b52', y: 162 },
      ],
      border: '#c9a45c', grain: 0.09,
    });
    const card = G.mesh(G.box(0.19, 0.12, 0.006, 0.008), M.paper(0xf3e7c9), { pos: [0, 0, 0], parent: bubble });
    G.mesh(G.plane(0.185, 0.115), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }),
      { pos: [0, 0, 0.0035], parent: bubble, cast: false });
    G.mesh(G.box(0.05, 0.014, 0.012, 0.004), M.steel(0.4), { pos: [0, 0.064, 0], parent: bubble });
    // Little tail pointing down at its owner.
    G.mesh(G.cone(0.018, 0.03, 3), M.paper(0xf3e7c9), { pos: [-0.05, -0.072, 0], rot: [0, 0, Math.PI], parent: bubble });

    const icon = buildIcon(order.itemId);
    icon.position.set(0, 0.145, 0.01);
    icon.scale.setScalar(1.35);
    bubble.add(icon);
    c.icon = icon;

    // Held out to the side at chest height, clear of their face.
    bubble.position.set(0.2, 1.2, 0.24);
    bubble.scale.setScalar(0.001);
    c.bubble = bubble;
    c.group.add(bubble);

    // Invisible capsule used for delivery hit-testing — generous on purpose.
    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 1.5, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.set(0, 1.0, 0);
    hit.userData.customer = c;
    c.hit = hit;
    c.group.add(hit);

    // Customers stand on the far side of the counter facing the player, so
    // rotation 0 (the model faces +z) is "looking at you".
    c.group.position.set(c.slot.x + (c.index % 2 ? ARRIVE_FROM : -ARRIVE_FROM), 0, c.slot.z - 0.5);
    c.group.rotation.y = c.index % 2 ? -Math.PI / 2 : Math.PI / 2;
    this.onChange?.();
  }

  _teardown(c) {
    for (const child of [...c.group.children]) {
      c.group.remove(child);
      child.traverse?.((o) => { if (o.isMesh && !o.geometry.userData.shared) o.geometry.dispose?.(); });
    }
    c.person = null; c.bubble = null; c.icon = null; c.hit = null;
  }

  // -------------------------------------------------------- delivery ----
  hitTargets() {
    return this.customers.filter((c) => c.state === 'waiting' && c.hit).map((c) => c.hit);
  }

  customerFor(object) {
    let o = object;
    while (o) {
      if (o.userData?.customer) return o.userData.customer;
      o = o.parent;
    }
    return null;
  }

  /** Complete an order. Returns the reward, or null if it does not match. */
  deliver(c, itemId) {
    if (!c || c.state !== 'waiting' || c.order.itemId !== itemId) return null;
    const reward = c.order;
    c.state = 'happy';
    c.t = 0;

    const worldPos = new THREE.Vector3();
    c.group.getWorldPosition(worldPos);
    worldPos.y = 1.25;
    this.fx.flash(worldPos, 0xffe0a0, 0.4);
    this.fx.sparks(worldPos, 0xffd070, 20, 0.7);
    this.state.stats.delivered++;
    this.onChange?.();
    return reward;
  }

  // ---------------------------------------------------------- update ----
  update(dt, t) {
    for (const c of this.customers) {
      c.t += dt;
      if (!c.person) continue;
      const home = c.slot;

      if (c.state === 'arriving') {
        if (c.t < 0) { c.group.visible = false; continue; }
        c.group.visible = true;
        const k = clamp(c.t / 1.5, 0, 1);
        const e = easeOutCubic(k);
        const fromX = home.x + (c.index % 2 ? ARRIVE_FROM : -ARRIVE_FROM);
        c.group.position.x = fromX + (home.x - fromX) * e;
        c.group.position.z = (home.z - 0.5) + 0.5 * e;
        c.group.rotation.y = damp(c.group.rotation.y, home.ry, 5, dt);
        const bob = walkPose(c.person, c.t * 9, 1 - e);
        c.person.position.y = bob;
        // Ticket unfurls as they arrive.
        c.bubble.scale.setScalar(easeOutCubic(clamp((c.t - 0.7) / 0.5, 0, 1)) * 1.0 + 0.001);
        if (k >= 1) { c.state = 'waiting'; c.t = 0; this.onChange?.(); }
      } else if (c.state === 'waiting') {
        idlePose(c.person, t, c.seed);
        c.person.position.y = 0;
        c.group.position.x = damp(c.group.position.x, home.x, 6, dt);
        c.group.position.z = damp(c.group.position.z, home.z, 6, dt);
        c.group.rotation.y = damp(c.group.rotation.y, home.ry, 6, dt);
        // The ticket hovers and always faces the camera; the dish above it
        // turns slowly so you can read its silhouette from any angle.
        c.bubble.position.y = 1.2 + Math.sin(t * 1.2 + c.seed) * 0.012;
        c.icon.rotation.y += dt * 0.8;
        c.icon.position.y = 0.145 + Math.sin(t * 1.6 + c.seed) * 0.006;
        this._faceCamera(c);
      } else if (c.state === 'happy') {
        // A hop, arms up, then they head off with the food.
        const k = clamp(c.t / 1.3, 0, 1);
        c.person.position.y = Math.abs(Math.sin(k * Math.PI * 2.2)) * 0.09 * (1 - k);
        for (const a of c.person.userData.arms) {
          a.shoulder.rotation.x = damp(a.shoulder.rotation.x, -1.9, 9, dt);
        }
        c.person.userData.head.rotation.y = Math.sin(c.t * 8) * 0.2;
        c.bubble.scale.setScalar(Math.max(0.001, 1 - k * 1.6));
        this._faceCamera(c);
        if (k >= 1) { c.state = 'leaving'; c.t = 0; }
      } else if (c.state === 'leaving') {
        const k = clamp(c.t / 2.0, 0, 1);
        const dir = c.index % 2 ? 1 : -1;
        c.group.position.x = home.x + dir * ARRIVE_FROM * easeOutCubic(k);
        c.group.position.z = home.z - 0.35 * easeOutCubic(k);
        c.group.rotation.y = damp(c.group.rotation.y, (Math.PI / 2) * (dir > 0 ? 1 : -1), 4, dt);
        c.person.position.y = walkPose(c.person, c.t * 9, 1);
        if (k >= 1) {
          this._teardown(c);
          c.state = 'empty';
          c.order = null;
          this.onChange?.();
          this.spawn(c, this.rollOrder(), 0.6);
        }
      }
    }
  }

  _faceCamera(c) {
    const cam = this.view.camera.position;
    const w = new THREE.Vector3();
    c.bubble.getWorldPosition(w);
    const angle = Math.atan2(cam.x - w.x, cam.z - w.z);
    c.bubble.rotation.y = angle - c.group.rotation.y;
  }

  /** Orders currently on screen, for the HUD strip. */
  list() {
    return this.customers.map((c) => ({
      index: c.index,
      state: c.state,
      order: c.order,
    }));
  }

  serialize() {
    return this.customers.map((c) => (c.order && (c.state === 'waiting' || c.state === 'arriving')
      ? { itemId: c.order.itemId, coin: c.order.coin, xp: c.order.xp, energy: c.order.energy }
      : null));
  }

  restore(saved) {
    if (!Array.isArray(saved)) { this.refill(true); return; }
    saved.forEach((o, i) => {
      const c = this.customers[i];
      if (!c) return;
      if (o && ITEMS[o.itemId]) {
        this.spawn(c, { ...o, name: ITEMS[o.itemId].name, patience: 1 }, i * 0.35);
      }
    });
    this.refill();
  }
}
