// Pointer handling: pick, drag, drop, deliver, and camera control.
//
// One pointer on an item drags it; one pointer on anything else orbits the
// camera; two pointers pinch to zoom. Works the same with mouse, pen and touch.

import * as THREE from 'three';
import { BOARD, DRAG_LIFT, posToCell } from './config.js';

const TAP_SLOP = 9;          // px of movement still counted as a tap
const TAP_TIME = 0.42;       // seconds

export class Input {
  constructor(view, board, orders, hooks = {}) {
    this.view = view;
    this.board = board;
    this.orders = orders;
    this.hooks = hooks;
    this.enabled = true;

    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(BOARD.surfaceY + DRAG_LIFT));
    this.hit = new THREE.Vector3();
    this.offset = new THREE.Vector3();

    this.pointers = new Map();
    this.mode = 'idle';       // idle | maybe | drag | orbit | pinch
    this.entry = null;
    this.startPx = new THREE.Vector2();
    this.startTime = 0;
    this.lastPx = new THREE.Vector2();
    this.pinchDist = 0;

    const el = view.renderer.domElement;
    this.el = el;
    el.style.touchAction = 'none';
    this._down = (e) => this.onDown(e);
    this._move = (e) => this.onMove(e);
    this._up = (e) => this.onUp(e);
    this._wheel = (e) => this.onWheel(e);
    this._keyDown = (e) => this.onKey(e, true);
    this._keyUp = (e) => this.onKey(e, false);
    el.addEventListener('pointerdown', this._down);
    window.addEventListener('pointermove', this._move, { passive: false });
    window.addEventListener('pointerup', this._up);
    window.addEventListener('pointercancel', this._up);
    el.addEventListener('wheel', this._wheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this._keyDown);
    window.addEventListener('keyup', this._keyUp);

    // Pinball mode takes the pointer over completely: screen halves become
    // flippers, so nothing about the merge-board drag survives into it.
    this.pinball = null;
    this.plungerDrag = null;
    this.heldFlipper = new Map();
  }

  setPinball(pinball) { this.pinball = pinball; }
  get pinballActive() { return !!this.pinball?.active; }

  dispose() {
    this.el.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('pointercancel', this._up);
    this.el.removeEventListener('wheel', this._wheel);
    window.removeEventListener('keydown', this._keyDown);
    window.removeEventListener('keyup', this._keyUp);
  }

  // ---------------------------------------------------------- pinball ----
  _pinballDown(e) {
    // Grabbing the plunger itself starts a launch; anywhere else is a flipper.
    const mesh = this.pinball.table.plungerMesh;
    if (mesh) {
      this._setNdc(e.clientX, e.clientY);
      if (this.ray.intersectObject(mesh, true).length) {
        this.plungerDrag = { id: e.pointerId, y: e.clientY };
        this.pinball.chargePlunger(0);
        return;
      }
    }
    const side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
    this.heldFlipper.set(e.pointerId, side);
    this.pinball.setFlipper(side, true);
  }

  _pinballMove(e) {
    if (this.plungerDrag?.id === e.pointerId) {
      // Drag downward to draw it back — 150 px of travel is a full charge.
      this.pinball.chargePlunger((e.clientY - this.plungerDrag.y) / 150);
      e.preventDefault?.();
    }
  }

  _pinballUp(e) {
    if (this.plungerDrag?.id === e.pointerId) {
      this.plungerDrag = null;
      this.pinball.releasePlunger();
      return;
    }
    const side = this.heldFlipper.get(e.pointerId);
    if (side) {
      this.heldFlipper.delete(e.pointerId);
      if (![...this.heldFlipper.values()].includes(side)) this.pinball.setFlipper(side, false);
    }
  }

  onKey(e, down) {
    if (!this.pinballActive || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') { this.pinball.setFlipper('left', down); e.preventDefault(); }
    else if (k === 'arrowright' || k === 'd') { this.pinball.setFlipper('right', down); e.preventDefault(); }
    else if (k === ' ' || k === 'enter') {
      // Hold to charge, release to fire.
      if (down) { this._keyCharge = performance.now(); this.pinball.chargePlunger(0); }
      else if (this._keyCharge) {
        this.pinball.chargePlunger((performance.now() - this._keyCharge) / 900);
        this.pinball.releasePlunger();
        this._keyCharge = 0;
      }
      e.preventDefault();
    } else if (down && (k === 'z' || k === 'x')) {
      this.pinball.nudge(k === 'z' ? -1 : 1);
    }
  }

  _setNdc(x, y) {
    this.ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.view.camera);
  }

  _planePoint(x, y, lift = DRAG_LIFT) {
    this.dragPlane.constant = -(BOARD.surfaceY + lift);
    this._setNdc(x, y);
    return this.ray.ray.intersectPlane(this.dragPlane, this.hit) ? this.hit : null;
  }

  _pickEntry(x, y) {
    this._setNdc(x, y);
    const hits = this.ray.intersectObjects(this.board.pickables(), true);
    if (!hits.length) return null;
    return this.board.entryForObject(hits[0].object);
  }

  /**
   * Customer under the pointer — but only if they are actually in front of the
   * counter surface. The customers stand behind the tray, so a ray aimed at a
   * cell keeps going and hits one of them; without the depth test every drop
   * on the board would read as a delivery attempt.
   */
  _pickCustomer(x, y) {
    const targets = this.orders.hitTargets();
    if (!targets.length) return null;
    const plane = this._planePoint(x, y, 0);
    const limit = plane ? this.view.camera.position.distanceTo(plane) : Infinity;
    this._setNdc(x, y);
    const hits = this.ray.intersectObjects(targets, true);
    if (!hits.length || hits[0].distance >= limit) return null;
    return this.orders.customerFor(hits[0].object);
  }

  // ------------------------------------------------------------ events ----
  onDown(e) {
    if (!this.enabled) return;
    this.el.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinballActive) { this._pinballDown(e); return; }

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.mode === 'drag' && this.entry) this._cancelDrag();
      this.mode = 'pinch';
      return;
    }

    this.startPx.set(e.clientX, e.clientY);
    this.lastPx.copy(this.startPx);
    this.startTime = performance.now() / 1000;

    const entry = e.button === 2 ? null : this._pickEntry(e.clientX, e.clientY);
    if (entry) {
      this.entry = entry;
      this.mode = 'maybe';
      const p = this._planePoint(e.clientX, e.clientY, entry.locked ? 0 : DRAG_LIFT);
      if (p) this.offset.set(entry.mesh.position.x - p.x, 0, entry.mesh.position.z - p.z);
    } else {
      this.mode = 'orbit';
      this.entry = null;
    }
  }

  onMove(e) {
    if (!this.enabled) return;
    const rec = this.pointers.get(e.pointerId);
    if (rec) { rec.x = e.clientX; rec.y = e.clientY; }
    if (this.pinballActive) { this._pinballMove(e); return; }

    // Idle: pointer position drives a small camera parallax.
    if (this.mode === 'idle' || this.mode === 'drag') {
      this.view.setPointer(
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1),
      );
    }

    if (this.mode === 'pinch' && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.view.zoom((this.pinchDist - d) * 0.004);
      this.pinchDist = d;
      return;
    }

    if (!rec) return;
    const dx = e.clientX - this.lastPx.x, dy = e.clientY - this.lastPx.y;
    this.lastPx.set(e.clientX, e.clientY);

    if (this.mode === 'maybe') {
      const moved = Math.hypot(e.clientX - this.startPx.x, e.clientY - this.startPx.y);
      if (moved > TAP_SLOP) {
        if (this.entry.locked) {
          // Producers are bolted down — dragging one just moves the camera.
          this.mode = 'orbit';
          this.entry = null;
        } else {
          this.mode = 'drag';
          this.board.pick(this.entry);
          this.hooks.onPickup?.(this.entry);
        }
      }
    }

    if (this.mode === 'drag' && this.entry) {
      const p = this._planePoint(e.clientX, e.clientY);
      if (p) {
        const x = p.x + this.offset.x, z = p.z + this.offset.z;
        this.board.dragTo(this.entry, x, z);
        this._updateHover(x, z, e.clientX, e.clientY);
      }
      e.preventDefault?.();
    } else if (this.mode === 'orbit') {
      this.view.orbit(-dx * 0.0042, dy * 0.0032);
    }
  }

  _updateHover(x, z, px, py) {
    const cust = this._pickCustomer(px, py);
    if (cust && cust.order?.itemId === this.entry.id) {
      this.board.setHover(null, 'none');
      this.hooks.onHoverCustomer?.(cust, true);
      this.hoverCustomer = cust;
      return;
    }
    this.hoverCustomer = null;
    this.hooks.onHoverCustomer?.(null, false);

    const cell = posToCell(x, z);
    if (!cell) { this.board.setHover(null, 'none'); return; }
    const occ = this.board.get(cell.col, cell.row);
    let mode = 'place';
    if (occ && occ !== this.entry) {
      const mergeable = occ.id === this.entry.id && !occ.isProducer && !occ.def.isMax;
      mode = mergeable ? 'merge' : 'blocked';
    }
    this.board.setHover(cell, mode);
  }

  onUp(e) {
    this.pointers.delete(e.pointerId);
    try { this.el.releasePointerCapture?.(e.pointerId); } catch { /* already released */ }
    if (!this.enabled) { this.mode = 'idle'; return; }
    if (this.pinballActive) { this._pinballUp(e); return; }

    if (this.mode === 'pinch') {
      if (this.pointers.size === 0) this.mode = 'idle';
      return;
    }

    const dt = performance.now() / 1000 - this.startTime;
    const moved = Math.hypot(e.clientX - this.startPx.x, e.clientY - this.startPx.y);

    if (this.mode === 'maybe' && this.entry) {
      if (moved <= TAP_SLOP && dt < TAP_TIME) this.hooks.onTap?.(this.entry);
    } else if (this.mode === 'drag' && this.entry) {
      const cust = this._pickCustomer(e.clientX, e.clientY);
      const p = this._planePoint(e.clientX, e.clientY);
      const x = p ? p.x + this.offset.x : this.entry.mesh.position.x;
      const z = p ? p.z + this.offset.z : this.entry.mesh.position.z;
      this.board.release(this.entry);
      this.board.setHover(null, 'none');
      this.hooks.onDrop?.(this.entry, posToCell(x, z), cust);
      this.hooks.onHoverCustomer?.(null, false);
    }

    this.entry = null;
    if (this.pointers.size === 0) this.mode = 'idle';
  }

  _cancelDrag() {
    if (this.entry) {
      this.board.release(this.entry);
      this.board.setHover(null, 'none');
      this.hooks.onDrop?.(this.entry, { col: this.entry.col, row: this.entry.row }, null);
      this.entry = null;
    }
  }

  onWheel(e) {
    if (!this.enabled || this.pinballActive) return;
    e.preventDefault();
    this.view.zoom(Math.sign(e.deltaY) * 0.1);
  }
}
