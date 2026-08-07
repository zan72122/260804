// The merge board: grid bookkeeping plus the physical behaviour of the items
// sitting on it — how they land, settle, get picked up, and how they merge.

import * as THREE from 'three';
import * as G from '../engine/geo.js';
import * as TEX from '../engine/textures.js';
import { damp, easeOutBack, easeOutCubic, clamp } from '../engine/util.js';
import { BOARD, cellPos, DRAG_LIFT } from './config.js';
import { ITEMS, PRODUCERS, buildMesh } from './items.js';

const _v = new THREE.Vector3();

class Entry {
  constructor(id, col, row, mesh, shadow) {
    this.id = id;
    this.col = col; this.row = row;
    this.mesh = mesh;
    this.shadow = shadow;
    this.def = ITEMS[id] || PRODUCERS[id];
    this.isProducer = !!PRODUCERS[id];
    this.tier = this.def.tier || 0;
    this.mass = this.isProducer ? 5 : this.tier;     // heavier tiers land harder
    this.drag = false;
    this.y = 0;              // height above the tray
    this.vy = 0;
    this.spin = 0;
    this.pop = 0;            // 0..1 spawn/merge pop timer
    this.popKind = 'spawn';
    this.tilt = new THREE.Vector2();
    this.target = new THREE.Vector3();
    this.idle = Math.random() * Math.PI * 2;
    this.locked = false;     // producers cannot be dragged
  }
}

export class Board {
  constructor(view, fx) {
    this.view = view;
    this.fx = fx;
    this.root = new THREE.Group();
    this.root.name = 'board-items';
    view.scene.add(this.root);

    this.cells = new Array(BOARD.cols * BOARD.rows).fill(null);
    this.entries = [];

    this.shadowGeo = G.plane(1, 1);
    this.shadowTex = TEX.radialFalloff(2.1);

    // Highlight ring that follows the hovered cell while dragging.
    this.hover = new THREE.Mesh(
      new THREE.RingGeometry(BOARD.cell * 0.40, BOARD.cell * 0.46, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffdca8, transparent: true, opacity: 0, side: THREE.DoubleSide,
        depthWrite: false, toneMapped: false,
      }),
    );
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.position.y = BOARD.surfaceY + 0.0016;
    this.hover.renderOrder = 5;
    view.scene.add(this.hover);
    this.hoverTarget = null;
    this.hoverMode = 'none';   // 'place' | 'merge' | 'blocked'
  }

  idx(col, row) { return row * BOARD.cols + col; }
  get(col, row) {
    if (col < 0 || row < 0 || col >= BOARD.cols || row >= BOARD.rows) return null;
    return this.cells[this.idx(col, row)];
  }
  set(col, row, entry) { this.cells[this.idx(col, row)] = entry; }

  /** Nearest empty cell to (col,row), searched in rings so spawns land close. */
  findFree(col = 3, row = 2) {
    if (!this.get(col, row)) return { col, row };
    for (let r = 1; r < Math.max(BOARD.cols, BOARD.rows); r++) {
      const ring = [];
      for (let dc = -r; dc <= r; dc++) {
        for (let dr = -r; dr <= r; dr++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== r) continue;
          ring.push([col + dc, row + dr]);
        }
      }
      ring.sort(() => 0); // stable: keeps scan order predictable
      for (const [c, rr] of ring) {
        if (c < 0 || rr < 0 || c >= BOARD.cols || rr >= BOARD.rows) continue;
        if (!this.get(c, rr)) return { col: c, row: rr };
      }
    }
    return null;
  }

  // ------------------------------------------------------------- add ----
  add(id, col, row, o = {}) {
    const mesh = buildMesh(id);
    const radius = Math.max(mesh.userData.radius, 0.018);

    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.5,
      alphaMap: this.shadowTex, depthWrite: false,
    });
    const shadow = new THREE.Mesh(this.shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.setScalar(radius * 3.1);
    shadow.renderOrder = 2;

    const e = new Entry(id, col, row, mesh, shadow);
    e.baseShadow = radius * 3.1;
    e.radius = radius;
    if (e.isProducer) e.locked = true;

    this.root.add(mesh, shadow);
    this.set(col, row, e);
    this.entries.push(e);

    const p = cellPos(col, row);
    e.target.set(p.x, BOARD.surfaceY, p.z);
    mesh.position.copy(e.target);
    shadow.position.set(p.x, BOARD.surfaceY + 0.0018, p.z);
    mesh.rotation.y = o.rotation ?? (Math.random() - 0.5) * 0.5;

    if (o.animate === 'drop') {
      e.y = 0.16; e.vy = 0; e.pop = 0;
    } else if (o.animate !== 'none') {
      e.pop = 1; e.popKind = 'spawn';
      mesh.scale.setScalar(0.01);
    }
    return e;
  }

  remove(e, { silent = false } = {}) {
    if (this.get(e.col, e.row) === e) this.set(e.col, e.row, null);
    this.root.remove(e.mesh, e.shadow);
    e.shadow.material.dispose();
    const i = this.entries.indexOf(e);
    if (i >= 0) this.entries.splice(i, 1);
  }

  moveTo(e, col, row) {
    if (this.get(e.col, e.row) === e) this.set(e.col, e.row, null);
    e.col = col; e.row = row;
    this.set(col, row, e);
    const p = cellPos(col, row);
    e.target.set(p.x, BOARD.surfaceY, p.z);
  }

  /** Swap two occupied cells (classic merge-board behaviour on a bad drop). */
  swap(a, b) {
    const ac = a.col, ar = a.row;
    this.set(b.col, b.row, a);
    this.set(ac, ar, b);
    const bc = b.col, br = b.row;
    a.col = b.col; a.row = b.row;
    b.col = ac; b.row = ar;
    const pa = cellPos(a.col, a.row), pb = cellPos(b.col, b.row);
    a.target.set(pa.x, BOARD.surfaceY, pa.z);
    b.target.set(pb.x, BOARD.surfaceY, pb.z);
    b.y = Math.max(b.y, 0.012);
    b.vy = 0.12;
  }

  // ----------------------------------------------------------- drag ----
  pick(e) {
    if (e.locked) return false;
    e.drag = true;
    e.vy = 0;
    return true;
  }

  dragTo(e, x, z) {
    e.dragX = x; e.dragZ = z;
  }

  release(e) {
    e.drag = false;
    e.dragX = e.dragZ = undefined;
    e.vy = Math.min(e.vy, -0.15);
  }

  setHover(cell, mode) {
    this.hoverTarget = cell;
    this.hoverMode = mode;
  }

  // ---------------------------------------------------------- merge ----
  /**
   * Merge `from` into `onto`. Returns the new entry, or null if the pair is
   * already at the top of its chain.
   */
  merge(from, onto) {
    const def = ITEMS[onto.id];
    if (!def || !def.next) return null;
    const col = onto.col, row = onto.row;
    this.remove(from);
    this.remove(onto);
    const e = this.add(def.next, col, row, { animate: 'merge' });
    e.pop = 1; e.popKind = 'merge';
    e.mesh.scale.setScalar(0.01);
    e.y = 0.02;
    return e;
  }

  // --------------------------------------------------------- update ----
  update(dt, t) {
    for (const e of this.entries) {
      // ---- horizontal placement -------------------------------------
      if (e.drag && e.dragX !== undefined) {
        e.mesh.position.x = damp(e.mesh.position.x, e.dragX, 26, dt);
        e.mesh.position.z = damp(e.mesh.position.z, e.dragZ, 26, dt);
        // Lean into the motion: the item has mass and the hand is moving it.
        const vx = (e.dragX - e.mesh.position.x), vz = (e.dragZ - e.mesh.position.z);
        e.tilt.x = damp(e.tilt.x, clamp(vz * 5.5, -0.32, 0.32), 12, dt);
        e.tilt.y = damp(e.tilt.y, clamp(-vx * 5.5, -0.32, 0.32), 12, dt);
      } else {
        e.mesh.position.x = damp(e.mesh.position.x, e.target.x, 18, dt);
        e.mesh.position.z = damp(e.mesh.position.z, e.target.z, 18, dt);
        e.tilt.x = damp(e.tilt.x, 0, 10, dt);
        e.tilt.y = damp(e.tilt.y, 0, 10, dt);
      }

      // ---- vertical: lift while held, gravity + bounce when dropped ---
      if (e.drag) {
        e.y = damp(e.y, DRAG_LIFT, 16, dt);
        e.vy = 0;
      } else if (e.y > 0 || e.vy !== 0) {
        e.vy -= 6.2 * dt;                        // scaled-down gravity: reads well at 10 cm
        e.y += e.vy * dt;
        if (e.y <= 0) {
          const impact = -e.vy;
          e.y = 0;
          // Heavier items bounce less and thud harder.
          const restitution = clamp(0.26 - e.mass * 0.035, 0.05, 0.26);
          e.vy = impact > 0.25 ? impact * restitution : 0;
          if (impact > 0.4) {
            e.squash = Math.min(0.35, impact * 0.32);
            this.fx.dust(_v.set(e.mesh.position.x, BOARD.surfaceY + 0.004, e.mesh.position.z),
              Math.round(2 + e.mass), 0.035 + e.mass * 0.004);
            this.view.addShake(Math.min(0.22, impact * 0.12));
          }
        }
      }
      e.mesh.position.y = BOARD.surfaceY + e.y;

      // ---- squash & stretch on landing -------------------------------
      let sy = 1, sxz = 1;
      if (e.squash > 0) {
        e.squash = Math.max(0, e.squash - dt * 2.6);
        const s = e.squash;
        sy = 1 - s * 0.6; sxz = 1 + s * 0.34;
      }

      // ---- spawn / merge pop ----------------------------------------
      if (e.pop > 0) {
        e.pop = Math.max(0, e.pop - dt * (e.popKind === 'merge' ? 2.4 : 3.0));
        const k = 1 - e.pop;
        const s = e.popKind === 'merge'
          ? easeOutBack(clamp(k * 1.15, 0, 1))
          : easeOutCubic(clamp(k * 1.1, 0, 1));
        sy *= s; sxz *= s;
        e.spin = (1 - k) * (e.popKind === 'merge' ? 2.2 : 0.8);
      }

      e.mesh.scale.set(sxz, sy, sxz);
      e.mesh.rotation.x = e.tilt.x;
      e.mesh.rotation.z = e.tilt.y;

      // Top-tier dishes get a slow hover + turn so they read as the prize.
      if (e.def?.isMax && !e.drag) {
        e.idle += dt;
        e.mesh.position.y += Math.sin(e.idle * 1.4) * 0.0035 + 0.002;
        e.mesh.rotation.y += dt * 0.25;
      } else if (e.spin > 0.001) {
        e.mesh.rotation.y += e.spin * dt * 3;
        e.spin = damp(e.spin, 0, 6, dt);
      }

      // ---- contact shadow --------------------------------------------
      // Rising off the surface: the shadow widens, softens and lags behind —
      // the single cheapest cue that an object is airborne.
      const lift = clamp(e.y / DRAG_LIFT, 0, 1.4);
      const sc = e.baseShadow * (1 + lift * 0.55) * sxz;
      e.shadow.scale.setScalar(sc);
      e.shadow.material.opacity = (0.52 - lift * 0.24) * (e.pop > 0 ? 1 - e.pop : 1);
      e.shadow.position.set(
        e.mesh.position.x + lift * 0.012,
        BOARD.surfaceY + 0.0018,
        e.mesh.position.z + lift * 0.014,
      );
      e.shadow.visible = e.shadow.material.opacity > 0.02;
    }

    // ---- hover ring -------------------------------------------------
    const hm = this.hover.material;
    if (this.hoverTarget) {
      const p = cellPos(this.hoverTarget.col, this.hoverTarget.row);
      this.hover.position.x = damp(this.hover.position.x, p.x, 22, dt);
      this.hover.position.z = damp(this.hover.position.z, p.z, 22, dt);
      const pulse = 0.86 + Math.sin(t * 7) * 0.06;
      const col = this.hoverMode === 'merge' ? 0x9be07a : this.hoverMode === 'blocked' ? 0xe07a5a : 0xffdca8;
      hm.color.setHex(col);
      hm.opacity = damp(hm.opacity, this.hoverMode === 'merge' ? 0.95 : 0.55, 14, dt);
      this.hover.scale.setScalar(this.hoverMode === 'merge' ? pulse * 1.12 : 1);
      this.hover.visible = true;
    } else {
      hm.opacity = damp(hm.opacity, 0, 14, dt);
      this.hover.visible = hm.opacity > 0.01;
    }
  }

  /** All draggable/tappable meshes, for raycasting. */
  pickables() { return this.entries.map((e) => e.mesh); }

  entryForObject(obj) {
    let o = obj;
    while (o) {
      const found = this.entries.find((e) => e.mesh === o);
      if (found) return found;
      o = o.parent;
    }
    return null;
  }

  serialize() {
    return this.entries
      .filter((e) => !e.isProducer)
      .map((e) => ({ id: e.id, c: e.col, r: e.row }));
  }

  clear() {
    for (const e of [...this.entries]) this.remove(e);
    this.cells.fill(null);
  }
}
