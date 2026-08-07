// Pinball physics: balls rolling on an inclined plane.
//
// This is a 2-D solver living in the table's own (u, v) coordinates — u across
// the table, v up the slope — which is all a pinball table ever needs. Gravity
// is the component of g along the slope, so the tilt angle is a real physical
// dial rather than a fudge factor.
//
// Fixed 1/240 s substeps keep it deterministic: the same launch always produces
// the same shot, which is what makes a table learnable (and testable).

const SUBSTEP = 1 / 240;
const MAX_SUBSTEPS = 12;          // ~50 ms of catch-up, then we let time slip
const MAX_SPEED = 5.0;            // m/s — a real ball tops out around here
const SLEEP_SPEED = 0.012;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Ball {
  constructor(o = {}) {
    this.u = o.u ?? 0;
    this.v = o.v ?? 0;
    this.vu = o.vu ?? 0;
    this.vv = o.vv ?? 0;
    this.r = o.r ?? 0.033;
    this.mass = o.mass ?? 1;
    this.id = o.id ?? 'ball';
    this.data = o.data ?? null;    // gameplay payload (ingredient, heat, …)
    this.alive = true;
    this.held = false;             // sitting in the plunger lane / a saucer
    this.travelled = 0;            // metres rolled, used for the spin visual
  }
  get speed() { return Math.hypot(this.vu, this.vv); }
}

class Segment {
  constructor(x0, y0, x1, y1, o = {}) {
    this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1;
    this.restitution = o.restitution ?? 0.42;
    this.friction = o.friction ?? 1.5;   // per second
    this.tag = o.tag ?? 'wall';
    this.oneWay = o.oneWay ?? 0;   // 0 none, ±1: only blocks from one side
    this.kick = o.kick ?? 0;       // extra impulse along the normal (slingshots)
    const dx = x1 - x0, dy = y1 - y0;
    this.len = Math.hypot(dx, dy) || 1e-6;
    this.dx = dx / this.len; this.dy = dy / this.len;
    this.nx = -this.dy; this.ny = this.dx;   // left-hand normal
  }
  /** Closest point on the segment to (px, py). */
  closest(px, py, out) {
    let t = ((px - this.x0) * this.dx + (py - this.y0) * this.dy) / this.len;
    t = clamp(t, 0, 1);
    out.x = this.x0 + this.dx * this.len * t;
    out.y = this.y0 + this.dy * this.len * t;
    return out;
  }
}

class Post {
  constructor(x, y, r, o = {}) {
    this.x = x; this.y = y; this.r = r;
    this.restitution = o.restitution ?? 0.5;
    this.kick = o.kick ?? 0;       // pop bumpers push the ball away
    this.tag = o.tag ?? 'post';
    this.cooldown = 0;
  }
}

export class Flipper {
  /**
   * @param {object} o pivot {u,v}, length, restAngle/activeAngle in radians,
   *                   measured from the +u axis in table space.
   */
  constructor(o) {
    this.pu = o.pivot[0]; this.pv = o.pivot[1];
    this.length = o.length ?? 0.155;
    this.radius = o.radius ?? 0.019;
    this.rest = o.restAngle;
    this.active = o.activeAngle;
    this.speed = o.speed ?? 26;    // rad/s
    this.angle = this.rest;
    this.omega = 0;
    this.pressed = false;
    this.side = o.side ?? 'left';
    this.restitution = o.restitution ?? 0.36;
  }

  step(h) {
    const target = this.pressed ? this.active : this.rest;
    const d = target - this.angle;
    const maxStep = this.speed * h * (this.pressed ? 1 : 0.62);   // return is slower
    if (Math.abs(d) <= maxStep) {
      this.omega = d / h;
      this.angle = target;
    } else {
      const s = Math.sign(d) * maxStep;
      this.omega = s / h;
      this.angle += s;
    }
  }

  tip(out) {
    out.x = this.pu + Math.cos(this.angle) * this.length;
    out.y = this.pv + Math.sin(this.angle) * this.length;
    return out;
  }
}

export class PinballWorld {
  constructor(o = {}) {
    this.gravity = o.gravity ?? 1.2;      // m/s² along -v (g · sin tilt)
    this.damping = o.damping ?? 0.22;     // rolling resistance, per second
    this.drainV = o.drainV ?? -0.02;
    this.segments = [];
    this.posts = [];
    this.flippers = [];
    this.balls = [];
    this.events = [];
    this._acc = 0;
    this._p = { x: 0, y: 0 };
    this.nudge = { u: 0, v: 0 };          // impulse queued by a table nudge
  }

  addSegment(x0, y0, x1, y1, o) { const s = new Segment(x0, y0, x1, y1, o); this.segments.push(s); return s; }

  /** Add a chain of segments from a flat list of points. */
  addPolyline(points, o) {
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      out.push(this.addSegment(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], o));
    }
    return out;
  }

  addPost(x, y, r, o) { const p = new Post(x, y, r, o); this.posts.push(p); return p; }
  addFlipper(o) { const f = new Flipper(o); this.flippers.push(f); return f; }
  addBall(b) { this.balls.push(b); return b; }
  removeBall(b) {
    const i = this.balls.indexOf(b);
    if (i >= 0) this.balls.splice(i, 1);
  }

  /** Advance by dt seconds in fixed substeps. Returns the event list. */
  step(dt) {
    this.events.length = 0;
    this._acc = Math.min(this._acc + dt, SUBSTEP * MAX_SUBSTEPS);
    while (this._acc >= SUBSTEP) {
      this._sub(SUBSTEP);
      this._acc -= SUBSTEP;
    }
    return this.events;
  }

  _sub(h) {
    this._h = h;
    for (const f of this.flippers) f.step(h);
    for (const p of this.posts) if (p.cooldown > 0) p.cooldown -= h;

    const damp = Math.exp(-this.damping * h);
    for (const b of this.balls) {
      if (!b.alive || b.held) continue;

      b.vv -= this.gravity * h;
      if (this.nudge.u || this.nudge.v) { b.vu += this.nudge.u; b.vv += this.nudge.v; }
      b.vu *= damp; b.vv *= damp;

      const sp = Math.hypot(b.vu, b.vv);
      if (sp > MAX_SPEED) { b.vu *= MAX_SPEED / sp; b.vv *= MAX_SPEED / sp; }
      else if (sp < SLEEP_SPEED && Math.abs(this.gravity) < 1e-6) { b.vu = 0; b.vv = 0; }

      b.u += b.vu * h;
      b.v += b.vv * h;
      b.travelled += sp * h;
    }
    this.nudge.u = this.nudge.v = 0;

    for (const b of this.balls) {
      if (!b.alive || b.held) continue;
      this._collideSegments(b);
      this._collidePosts(b);
      this._collideFlippers(b, h);
      if (b.v < this.drainV) {
        b.alive = false;
        this.events.push({ type: 'drain', ball: b });
      }
    }
    this._collideBalls();
  }

  /**
   * Push the ball out of a surface and reflect it.
   *
   * `friction` is a *per second* rate, not a per-contact fraction: a ball
   * resting on a slope touches the surface every single substep, so a flat
   * per-contact fraction would bleed away its tangential speed 240 times a
   * second and glue it in place instead of letting it roll off.
   */
  _resolve(b, nx, ny, penetration, restitution, friction, extra = 0, surfVu = 0, surfVv = 0) {
    b.u += nx * penetration;
    b.v += ny * penetration;
    const rvu = b.vu - surfVu, rvv = b.vv - surfVv;
    const vn = rvu * nx + rvv * ny;
    if (vn >= 0) return 0;
    const j = -(1 + restitution) * vn + extra;
    let nu = rvu + nx * j, nv = rvv + ny * j;
    // Tangential friction bleeds a little speed off grazing hits and rolling
    // contact, scaled by the substep so sustained contact is not a brake.
    const tvn = nu * nx + nv * ny;
    const tu = nu - nx * tvn, tv = nv - ny * tvn;
    const f = 1 - Math.exp(-friction * this._h);
    nu -= tu * f; nv -= tv * f;
    b.vu = nu + surfVu;
    b.vv = nv + surfVv;
    return -vn;
  }

  _collideSegments(b) {
    const p = this._p;
    for (const s of this.segments) {
      s.closest(b.u, b.v, p);
      let dx = b.u - p.x, dy = b.v - p.y;
      let dist = Math.hypot(dx, dy);
      if (dist >= b.r) continue;
      let nx, ny;
      if (dist < 1e-6) { nx = s.nx; ny = s.ny; dist = 0; }
      else { nx = dx / dist; ny = dy / dist; }
      // One-way gates let a ball out of the launch lane but not back in.
      if (s.oneWay) {
        const side = nx * s.nx + ny * s.ny;
        if (side * s.oneWay < 0) continue;
      }
      const impact = this._resolve(b, nx, ny, b.r - dist, s.restitution, s.friction, s.kick);
      if (impact > 0.12) this.events.push({ type: 'hit', tag: s.tag, ball: b, impact, u: p.x, v: p.y, target: s });
    }
  }

  _collidePosts(b) {
    for (const o of this.posts) {
      const dx = b.u - o.x, dy = b.v - o.y;
      const rr = b.r + o.r;
      const dist = Math.hypot(dx, dy);
      if (dist >= rr) continue;
      const nx = dist < 1e-6 ? 0 : dx / dist;
      const ny = dist < 1e-6 ? 1 : dy / dist;
      const kick = o.cooldown > 0 ? 0 : o.kick;
      const impact = this._resolve(b, nx, ny, rr - dist, o.restitution, 1.5, kick);
      if (impact > 0.1 || kick > 0) {
        if (o.kick > 0) o.cooldown = 0.08;
        this.events.push({ type: 'hit', tag: o.tag, ball: b, impact, u: o.x, v: o.y, target: o });
      }
    }
  }

  _collideFlippers(b, h) {
    const p = this._p;
    for (const f of this.flippers) {
      const tx = f.pu + Math.cos(f.angle) * f.length;
      const ty = f.pv + Math.sin(f.angle) * f.length;
      // Closest point on the flipper's centre line.
      const dx = tx - f.pu, dy = ty - f.pv;
      const len2 = dx * dx + dy * dy;
      let t = ((b.u - f.pu) * dx + (b.v - f.pv) * dy) / len2;
      t = clamp(t, 0, 1);
      p.x = f.pu + dx * t; p.y = f.pv + dy * t;
      const ox = b.u - p.x, oy = b.v - p.y;
      const rr = b.r + f.radius;
      const dist = Math.hypot(ox, oy);
      if (dist >= rr) continue;
      const nx = dist < 1e-6 ? 0 : ox / dist;
      const ny = dist < 1e-6 ? 1 : oy / dist;
      // Surface velocity at the contact point: ω × r, in 2-D that is ω·perp(r).
      const rx = p.x - f.pu, ry = p.y - f.pv;
      const surfVu = -f.omega * ry;
      const surfVv = f.omega * rx;
      const impact = this._resolve(b, nx, ny, rr - dist, f.restitution, 4, 0, surfVu, surfVv);
      if (impact > 0.05 || Math.abs(f.omega) > 1) {
        this.events.push({ type: 'flipper', ball: b, flipper: f, impact, u: p.x, v: p.y });
      }
    }
  }

  _collideBalls() {
    const list = this.balls;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive || a.held) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive || b.held) continue;
        const dx = b.u - a.u, dy = b.v - a.v;
        const rr = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const dist = Math.sqrt(d2) || 1e-6;
        const nx = dx / dist, ny = dy / dist;
        const pen = (rr - dist) * 0.5;
        a.u -= nx * pen; a.v -= ny * pen;
        b.u += nx * pen; b.v += ny * pen;

        const rvu = b.vu - a.vu, rvv = b.vv - a.vv;
        const vn = rvu * nx + rvv * ny;
        const closing = -vn;
        if (vn > 0) continue;
        const e = 0.5;
        const j2 = -(1 + e) * vn / 2;
        a.vu -= nx * j2; a.vv -= ny * j2;
        b.vu += nx * j2; b.vv += ny * j2;
        this.events.push({
          type: 'balls', a, b, impact: closing,
          u: (a.u + b.u) / 2, v: (a.v + b.v) / 2,
        });
      }
    }
  }

  /** Shake the table. Repeated nudges are the caller's problem (TILT). */
  applyNudge(du, dv) {
    this.nudge.u += du;
    this.nudge.v += dv;
  }

  reset() {
    this.balls.length = 0;
    this.events.length = 0;
    this._acc = 0;
    for (const f of this.flippers) { f.angle = f.rest; f.omega = 0; f.pressed = false; }
  }

  /** Drop all static geometry, so a table can be rebuilt from scratch. */
  clearStatics() {
    this.segments.length = 0;
    this.posts.length = 0;
    this.flippers.length = 0;
  }
}
