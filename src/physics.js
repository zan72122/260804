// 玩具物理。
// ・動く剛体は「景品 1 個」だけ。
// ・バーと爪は運動学的な線分（丸棒）、床と壁は範囲つき平面。
// ・接触は「線分上のサンプル点 vs 景品の厳密 SDF」で作るので、
//   角・辺・丸みが自然に効き、貫通しない。
// ・逐次インパルス + Baumgarte 位置補正。反発はゼロ（予測可能さ優先）。

import { Vector3, Quaternion, Matrix3 } from '../vendor/three.module.js';

const GRAVITY = -9.81;
const SUBSTEPS = 4;
const ITERATIONS = 8;
const SLOP = 0.0004;
const BETA = 0.22;
const MAX_BIAS_VEL = 0.35;
const MAX_LIN = 1.6;
const MAX_ANG = 12.0;
const REST_LIN = 0.013;
const REST_ANG = 0.16;
const REST_TIME = 0.30;
const MAX_CONTACTS_PER_SEG = 8;

const _p = new Vector3();
const _q = new Vector3();
const _n = new Vector3();
const _r = new Vector3();
const _t1 = new Vector3();
const _t2 = new Vector3();
const _tmp = new Vector3();
const _tmp2 = new Vector3();
const _iq = new Quaternion();
const _rot = new Matrix3();
const _rotT = new Matrix3();
const _inertia = new Matrix3();
const UP_AXIS = new Vector3(0, 1, 0);

function rotFromQuat(q, m) {
  const x = q.x, y = q.y, z = q.z, w = q.w;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return m.set(
    1 - (yy + zz), xy - wz, xz + wy,
    xy + wz, 1 - (xx + zz), yz - wx,
    xz - wy, yz + wx, 1 - (xx + yy),
  );
}

function boxSdf(q, hx, hy, hz, outN) {
  const dx = Math.abs(q.x) - hx;
  const dy = Math.abs(q.y) - hy;
  const dz = Math.abs(q.z) - hz;
  const ox = Math.max(dx, 0), oy = Math.max(dy, 0), oz = Math.max(dz, 0);
  const outside = Math.sqrt(ox * ox + oy * oy + oz * oz);
  if (outside > 1e-9) {
    outN.set(Math.sign(q.x) * ox, Math.sign(q.y) * oy, Math.sign(q.z) * oz).divideScalar(outside);
    return outside + Math.min(Math.max(dx, Math.max(dy, dz)), 0);
  }
  if (dx >= dy && dx >= dz) outN.set(Math.sign(q.x) || 1, 0, 0);
  else if (dy >= dz) outN.set(0, Math.sign(q.y) || 1, 0);
  else outN.set(0, 0, Math.sign(q.z) || 1);
  return Math.max(dx, Math.max(dy, dz));
}

function capsuleSdf(q, halfLen, radius, outN) {
  const cx = Math.max(-halfLen, Math.min(halfLen, q.x));
  outN.set(q.x - cx, q.y, q.z);
  const len = outN.length();
  if (len > 1e-9) outN.divideScalar(len);
  else outN.set(0, 1, 0);
  return len - radius;
}

export class Prize {
  constructor(def) {
    this.def = def;
    this.kind = def.kind;
    this.mass = def.mass;
    this.invMass = 1 / def.mass;
    this.friction = def.friction;
    this.rollDamp = def.rollDamp;
    this.com = new Vector3();
    this.quat = new Quaternion();
    this.vel = new Vector3();
    this.omega = new Vector3();
    // 重心 -> 幾何中心（局所）
    this.shapeOffset = new Vector3(-def.comOffset[0], -def.comOffset[1], -def.comOffset[2]);
    this.frozen = true;
    this.resting = false;
    this.restTimer = 0;
    this.invInertiaBody = new Matrix3();
    this.invInertiaWorld = new Matrix3();
    this.lastImpulse = 0;
    this.barContactSides = 0;
    this.accel = new Vector3();
    this._prevVel = new Vector3();
    this._planePts = [];
    const count = def.kind === 'box' ? 8 : 2;
    for (let i = 0; i < count; i++) this._planePts.push(new Vector3());
    this._buildInertia();
  }

  _buildInertia() {
    const d = this.def;
    const m = this.mass;
    let ix, iy, iz;
    if (d.kind === 'box') {
      const x = 2 * d.hx, y = 2 * d.hy, z = 2 * d.hz;
      ix = m * (y * y + z * z) / 12;
      iy = m * (x * x + z * z) / 12;
      iz = m * (x * x + y * y) / 12;
    } else {
      const L = 2 * d.halfLen, R = d.radius;
      ix = 0.5 * m * R * R;
      iy = iz = m * (3 * R * R + L * L) / 12 + 0.35 * m * R * R;
    }
    // 幾何中心まわり -> 重心まわり（平行軸の定理）
    const dx = -this.shapeOffset.x, dy = -this.shapeOffset.y, dz = -this.shapeOffset.z;
    _inertia.set(
      ix + m * (dy * dy + dz * dz), -m * dx * dy, -m * dx * dz,
      -m * dx * dy, iy + m * (dx * dx + dz * dz), -m * dy * dz,
      -m * dx * dz, -m * dy * dz, iz + m * (dx * dx + dy * dy),
    );
    this.invInertiaBody.copy(_inertia).invert();
  }

  sdf(q, outN) {
    const d = this.def;
    if (d.kind === 'box') return boxSdf(q, d.hx, d.hy, d.hz, outN);
    return capsuleSdf(q, d.halfLen, d.radius, outN);
  }

  toLocal(worldPoint, out) {
    _iq.copy(this.quat).invert();
    return out.copy(worldPoint).sub(this.com).applyQuaternion(_iq).sub(this.shapeOffset);
  }

  setPose(pos, quat) {
    this.com.copy(pos);
    this.quat.copy(quat);
    this.vel.set(0, 0, 0);
    this.omega.set(0, 0, 0);
    this.resting = false;
    this.restTimer = 0;
    this.accel.set(0, 0, 0);
  }

  // 現在姿勢での world AABB（爪の降下量を決めるのに使う）
  aabb(min, max) {
    const d = this.def;
    min.set(Infinity, Infinity, Infinity);
    max.set(-Infinity, -Infinity, -Infinity);
    const pts = this._planePts;
    if (d.kind === 'box') {
      for (let i = 0; i < 8; i++) {
        pts[i].set((i & 1 ? 1 : -1) * d.hx, (i & 2 ? 1 : -1) * d.hy, (i & 4 ? 1 : -1) * d.hz);
      }
    } else {
      pts[0].set(-d.halfLen, 0, 0);
      pts[1].set(d.halfLen, 0, 0);
    }
    const pad = d.kind === 'box' ? 0 : d.radius;
    for (const lp of pts) {
      _tmp.copy(lp).add(this.shapeOffset).applyQuaternion(this.quat).add(this.com);
      min.set(Math.min(min.x, _tmp.x - pad), Math.min(min.y, _tmp.y - pad), Math.min(min.z, _tmp.z - pad));
      max.set(Math.max(max.x, _tmp.x + pad), Math.max(max.y, _tmp.y + pad), Math.max(max.z, _tmp.z + pad));
    }
    return { min, max };
  }

  centerWorld(out) {
    return out.copy(this.shapeOffset).applyQuaternion(this.quat).add(this.com);
  }
}

export class World {
  constructor() {
    this.segments = [];
    this.planes = [];
    this.prize = null;
    // これより下へ落ちた景品は、寝かせてシュートへ向かわせる（玩具的な補助）
    this.assistBelowY = -Infinity;
    this.contacts = [];
    this._pool = [];
    this._scratch = [];
  }

  addSegment(seg) {
    const s = Object.assign({
      a: new Vector3(), b: new Vector3(), radius: 0.011, mu: 0.4, samples: 44,
      maxImpulse: Infinity, tag: '', side: 0, active: true, vel: new Vector3(),
    }, seg);
    this.segments.push(s);
    return s;
  }

  addPlane(p) {
    const pl = Object.assign({ mu: 0.3, bounds: null, minComY: -Infinity, tag: '' }, p);
    pl.n = pl.n.clone().normalize();
    this.planes.push(pl);
    return pl;
  }

  _contact() {
    let c = this._pool[this.contacts.length];
    if (!c) {
      c = {
        n: new Vector3(), r: new Vector3(), otherVel: new Vector3(),
        pen: 0, mu: 0, jn: 0, jnPure: 0, jt1: 0, jt2: 0, maxImpulse: Infinity, tag: '',
      };
      this._pool[this.contacts.length] = c;
    }
    this.contacts.push(c);
    return c;
  }

  _collectSegment(body, seg) {
    const list = this._scratch;
    list.length = 0;
    const n = seg.samples;
    for (let i = 0; i <= n; i++) {
      _p.lerpVectors(seg.a, seg.b, i / n);
      body.toLocal(_p, _q);
      const sd = body.sdf(_q, _n);
      const d = sd - seg.radius;
      if (d < 0) {
        _tmp.copy(_q).addScaledVector(_n, -sd);
        list.push({
          pen: -d, nx: _n.x, ny: _n.y, nz: _n.z,
          sx: _tmp.x, sy: _tmp.y, sz: _tmp.z,
        });
      }
    }
    if (list.length === 0) return 0;
    if (list.length > MAX_CONTACTS_PER_SEG) {
      list.sort((a, b) => b.pen - a.pen);
      list.length = MAX_CONTACTS_PER_SEG;
    }
    for (const s of list) {
      const c = this._contact();
      // 法線は「景品表面 -> 棒の中心」向き。押し出しはその逆。
      c.n.set(-s.nx, -s.ny, -s.nz).applyQuaternion(body.quat);
      c.r.set(s.sx, s.sy, s.sz).add(body.shapeOffset).applyQuaternion(body.quat);
      c.pen = s.pen;
      c.mu = Math.min(body.friction, seg.mu);
      c.otherVel.copy(seg.vel);
      c.maxImpulse = seg.maxImpulse;
      c.jn = 0; c.jnPure = 0; c.jt1 = 0; c.jt2 = 0;
      c.tag = seg.tag;
    }
    return list.length;
  }

  _collectPlane(body, pl) {
    if (body.com.y < pl.minComY) return;
    const d = body.def;
    const pts = body._planePts;
    if (d.kind === 'box') {
      for (let i = 0; i < 8; i++) {
        pts[i].set((i & 1 ? 1 : -1) * d.hx, (i & 2 ? 1 : -1) * d.hy, (i & 4 ? 1 : -1) * d.hz);
      }
    } else {
      _iq.copy(body.quat).invert();
      _tmp.copy(pl.n).applyQuaternion(_iq).multiplyScalar(-d.radius);
      pts[0].set(-d.halfLen, 0, 0).add(_tmp);
      pts[1].set(d.halfLen, 0, 0).add(_tmp);
    }
    for (const lp of pts) {
      _tmp.copy(lp).add(body.shapeOffset).applyQuaternion(body.quat);
      _p.copy(_tmp).add(body.com);
      if (pl.bounds && !insideBounds(_p, pl.bounds)) continue;
      const dist = _p.dot(pl.n) - pl.d;
      if (dist < 0) {
        const c = this._contact();
        c.n.copy(pl.n);
        c.r.copy(_tmp);
        c.pen = -dist;
        c.mu = Math.min(body.friction, pl.mu);
        c.otherVel.set(0, 0, 0);
        c.maxImpulse = Infinity;
        c.jn = 0; c.jnPure = 0; c.jt1 = 0; c.jt2 = 0;
        c.tag = pl.tag;
      }
    }
  }

  step(dt) {
    const body = this.prize;
    if (!body || body.frozen) return;
    const h = dt / SUBSTEPS;
    body._prevVel.copy(body.vel);
    for (let s = 0; s < SUBSTEPS; s++) this._substep(body, h);
    body.accel.subVectors(body.vel, body._prevVel).divideScalar(dt);
  }

  _substep(body, h) {
    body.vel.y += GRAVITY * h;
    body.vel.multiplyScalar(Math.max(0, 1 - 0.02 * h));

    rotFromQuat(body.quat, _rot);
    _rotT.copy(_rot).transpose();
    body.invInertiaWorld.copy(_rot).multiply(body.invInertiaBody).multiply(_rotT);

    this.contacts.length = 0;
    let barSides = 0;
    let supportX = 0, supportW = 0, supportNy = 0;
    for (const seg of this.segments) {
      if (!seg.active) continue;
      const before = this.contacts.length;
      this._collectSegment(body, seg);
      if (this.contacts.length > before && seg.tag === 'bar') {
        barSides |= seg.side > 0 ? 2 : 1;
        for (let i = before; i < this.contacts.length; i++) {
          supportX += body.com.x + this.contacts[i].r.x;
          supportNy += this.contacts[i].n.y;
          supportW++;
        }
      }
    }
    for (const pl of this.planes) this._collectPlane(body, pl);
    body.barContactSides = barSides;

    if (this.contacts.length === 0) {
      this._integrate(body, h);
      this._restCheck(body, h);
      return;
    }

    // 落ちる寸前・挟まった時だけ、自然に落ちきるのを助ける
    if (supportW > 0) {
      const still = body.vel.lengthSq() < 0.006 && body.omega.lengthSq() < 0.08;
      const ny = supportNy / supportW;
      if (still && ny < 0.45) {
        // バーの間で斜めに引っかかっている：今の傾きを深めて通り抜けさせる
        _tmp.set(0, 1, 0).applyQuaternion(body.quat);
        const roll = Math.atan2(-_tmp.x, Math.abs(_tmp.y) < 1e-6 ? 1e-6 : _tmp.y);
        body.omega.z += (Math.sign(roll) || 1) * 2.2 * h;
        body.vel.y -= 0.3 * h;
      } else if (still && (barSides === 1 || barSides === 2)) {
        // 片側のバーにしか乗っていない：重心の外れた方へそっと倒す
        const off = body.com.x - supportX / supportW;
        if (Math.abs(off) > 0.002) body.omega.z += -Math.sign(off) * 1.4 * h;
      }
    }

    for (let it = 0; it < ITERATIONS; it++) {
      for (const c of this.contacts) this._solveContact(body, c, h);
    }

    // 落ちた景品が斜面の途中で立ったまま止まらないようにする
    if (body.com.y < this.assistBelowY
      && body.vel.lengthSq() < 0.02 && body.omega.lengthSq() < 0.6) {
      _tmp.set(0, 1, 0).applyQuaternion(body.quat);
      if (_tmp.y < 0.8) {
        _tmp2.crossVectors(_tmp, UP_AXIS);
        const l = _tmp2.length();
        if (l > 1e-6) body.omega.addScaledVector(_tmp2.divideScalar(l), 7.0 * h);
      }
      body.vel.z += 0.9 * h;
    }

    let maxJ = 0;
    for (const c of this.contacts) if (c.jn > maxJ) maxJ = c.jn;
    body.lastImpulse = maxJ;

    body.omega.multiplyScalar(Math.exp(-body.rollDamp * h));
    clampVec(body.vel, MAX_LIN);
    clampVec(body.omega, MAX_ANG);
    this._integrate(body, h);
    this._restCheck(body, h);
  }

  _solveContact(body, c, h) {
    _tmp.crossVectors(body.omega, c.r).add(body.vel).sub(c.otherVel);
    const vn = _tmp.dot(c.n);
    _r.crossVectors(c.r, c.n).applyMatrix3(body.invInertiaWorld);
    _tmp2.crossVectors(_r, c.r);
    const kn = body.invMass + _tmp2.dot(c.n);
    if (kn <= 1e-9) return;
    const bias = Math.min(BETA * Math.max(c.pen - SLOP, 0) / h, MAX_BIAS_VEL);
    // 摩擦の上限には「めり込み補正ぶんを含まない」インパルスを使う。
    // 含めると、着地の一瞬だけ摩擦が跳ね上がって斜面に貼り付いてしまう。
    c.jnPure = Math.min(c.maxImpulse, Math.max(0, c.jnPure + (-vn) / kn));
    const old = c.jn;
    c.jn = Math.max(0, old + (-vn + bias) / kn);
    if (c.jn > c.maxImpulse) c.jn = c.maxImpulse;
    const dj = c.jn - old;
    if (dj !== 0) {
      _tmp.copy(c.n).multiplyScalar(dj);
      body.vel.addScaledVector(_tmp, body.invMass);
      _tmp2.crossVectors(c.r, _tmp).applyMatrix3(body.invInertiaWorld);
      body.omega.add(_tmp2);
    }
    if (c.jn <= 0) return;

    buildBasis(c.n, _t1, _t2);
    c.jt1 = this._solveFriction(body, c, _t1, c.jt1);
    c.jt2 = this._solveFriction(body, c, _t2, c.jt2);
  }

  // 接線インパルスは接触ごとに累積して上限を掛ける。
  // （毎回ゼロから掛け直すと、反復回数のぶんだけ摩擦が強くなってしまう）
  _solveFriction(body, c, t, acc) {
    _tmp.crossVectors(body.omega, c.r).add(body.vel).sub(c.otherVel);
    const vt = _tmp.dot(t);
    _r.crossVectors(c.r, t).applyMatrix3(body.invInertiaWorld);
    _tmp2.crossVectors(_r, c.r);
    const kt = body.invMass + _tmp2.dot(t);
    if (kt <= 1e-9) return acc;
    const lim = c.mu * c.jnPure;
    const next = Math.max(-lim, Math.min(lim, acc - vt / kt));
    const dj = next - acc;
    if (dj !== 0) {
      _tmp.copy(t).multiplyScalar(dj);
      body.vel.addScaledVector(_tmp, body.invMass);
      _tmp2.crossVectors(c.r, _tmp).applyMatrix3(body.invInertiaWorld);
      body.omega.add(_tmp2);
    }
    return next;
  }

  _integrate(body, h) {
    clampVec(body.vel, MAX_LIN);
    clampVec(body.omega, MAX_ANG);
    body.com.addScaledVector(body.vel, h);
    const w = body.omega;
    _iq.set(w.x * h * 0.5, w.y * h * 0.5, w.z * h * 0.5, 0).multiply(body.quat);
    body.quat.set(
      body.quat.x + _iq.x, body.quat.y + _iq.y,
      body.quat.z + _iq.z, body.quat.w + _iq.w,
    ).normalize();
  }

  // 「落ち着いた」判定だけを行う（計算自体は止めない。止めると
  // 斜面の途中で貼り付いたまま動かなくなることがある）
  _restCheck(body, h) {
    if (body.vel.lengthSq() < REST_LIN * REST_LIN && body.omega.lengthSq() < REST_ANG * REST_ANG) {
      body.restTimer += h;
      if (body.restTimer > REST_TIME) body.resting = true;
    } else {
      body.restTimer = 0;
      body.resting = false;
    }
  }
}

function insideBounds(p, b) {
  if (b.x && (p.x < b.x[0] || p.x > b.x[1])) return false;
  if (b.y && (p.y < b.y[0] || p.y > b.y[1])) return false;
  if (b.z && (p.z < b.z[0] || p.z > b.z[1])) return false;
  return true;
}

function clampVec(v, max) {
  const l = v.length();
  if (l > max) v.multiplyScalar(max / l);
}

function buildBasis(n, t1, t2) {
  if (Math.abs(n.x) > 0.57735) t1.set(n.y, -n.x, 0);
  else t1.set(0, n.z, -n.y);
  t1.normalize();
  t2.crossVectors(n, t1);
}
