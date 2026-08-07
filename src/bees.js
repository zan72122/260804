/* =========================================================================
   bees.js — ミツバチの群れ（InstancedMesh）
   飛ぶ個体・巣脾の上を歩く個体・煙で落ち着いて巣に入る個体を扱う。
   ========================================================================= */
(function (global) {
  'use strict';

  /* ---------- ジオメトリの手動マージ（three.min.js には Utils が無いため） ---------- */
  function mergeGeoms(list) {
    var pos = [], nor = [], col = [], uvs = [];
    var hasUV = list.every(function (it) { return !!it.geo.attributes.uv; });
    list.forEach(function (item) {
      var g = item.geo.index ? item.geo.toNonIndexed() : item.geo;
      var p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      var mtx = item.matrix || new THREE.Matrix4();
      var nm = new THREE.Matrix3().getNormalMatrix(mtx);
      var v = new THREE.Vector3(), vn = new THREE.Vector3();
      for (var i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(mtx);
        pos.push(v.x, v.y, v.z);
        vn.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
        nor.push(vn.x, vn.y, vn.z);
        var c = item.colorFn ? item.colorFn(v, i) : (item.color || new THREE.Color(1, 1, 1));
        col.push(c.r, c.g, c.b);
        if (hasUV && u) uvs.push(u.getX(i), u.getY(i));
      }
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (hasUV && uvs.length === (pos.length / 3) * 2) {
      out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    }
    return out;
  }

  var _beeGeo = null, _wingGeo = null;

  function beeGeometry() {
    if (_beeGeo) return _beeGeo;
    var S = 1.35;                      // 体長 ≒ 14mm（見やすさのため少しだけ大きく）
    var black = MAT.C(0x231a10);
    var amber = MAT.C(0xd99a22);
    var fuzz = MAT.C(0x8a6a34);

    var abd = new THREE.SphereGeometry(0.0042 * S, 12, 9);
    abd.scale(1.0, 0.88, 1.85);
    var mAbd = new THREE.Matrix4().makeTranslation(0, 0, -0.0062 * S);

    var tho = new THREE.SphereGeometry(0.0040 * S, 12, 9);
    tho.scale(1.0, 0.96, 1.05);
    var mTho = new THREE.Matrix4().makeTranslation(0, 0.0004, 0.0012 * S);

    var head = new THREE.SphereGeometry(0.0029 * S, 10, 7);
    head.scale(1.0, 1.0, 0.85);
    var mHead = new THREE.Matrix4().makeTranslation(0, 0, 0.0060 * S);

    _beeGeo = mergeGeoms([
      {
        geo: abd, matrix: mAbd, colorFn: function (v) {
          // 腹部の縞（実物は 3 本）
          var t = (v.z + 0.0135) / 0.0155;
          var s = Math.sin(t * 13.0);
          return s > 0.05 ? amber : black;
        }
      },
      { geo: tho, matrix: mTho, color: fuzz },
      { geo: head, matrix: mHead, color: black }
    ]);
    return _beeGeo;
  }

  function wingGeometry() {
    if (_wingGeo) return _wingGeo;
    var w = new THREE.PlaneGeometry(0.0150, 0.0066);
    w.translate(0.0062, 0, 0);
    var a = w.clone(); a.rotateY(0); a.rotateZ(0.10);
    var mA = new THREE.Matrix4().makeRotationY(-0.42);
    mA.setPosition(0.0016, 0.0034, -0.0006);
    var b = w.clone();
    var mB = new THREE.Matrix4().makeRotationY(Math.PI + 0.42);
    mB.setPosition(-0.0016, 0.0034, -0.0006);
    _wingGeo = mergeGeoms([
      { geo: a, matrix: mA, color: new THREE.Color(1, 1, 1) },
      { geo: b, matrix: mB, color: new THREE.Color(1, 1, 1) }
    ]);
    return _wingGeo;
  }

  /* =======================================================================
     Swarm
     ======================================================================= */
  function Swarm(count, opt) {
    opt = opt || {};
    this.count = count;
    this.opt = opt;
    this.group = new THREE.Group();
    this.calm = 0;              // 0=活発 1=完全に落ち着いた
    this.hidden = 0;

    var bodyMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.72, metalness: 0.0,
      envMap: MAT.env, envMapIntensity: 0.25
    });
    var wingMat = new THREE.MeshStandardMaterial({
      color: MAT.C(0xffffff), transparent: true, opacity: 0.28, roughness: 0.15,
      metalness: 0, side: THREE.DoubleSide, depthWrite: false,
      envMap: MAT.env, envMapIntensity: 0.9
    });

    this.body = new THREE.InstancedMesh(beeGeometry(), bodyMat, count);
    this.wing = new THREE.InstancedMesh(wingGeometry(), wingMat, count);
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wing.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.body.castShadow = !!opt.shadow;
    this.body.frustumCulled = false;
    this.wing.frustumCulled = false;
    this.group.add(this.body, this.wing);

    var C = opt.center || new THREE.Vector3();
    var R = opt.radius || 0.25;
    this.b = [];
    for (var i = 0; i < count; i++) {
      this.b.push({
        p: new THREE.Vector3(
          C.x + U.rand(-R, R), C.y + U.rand(-R * 0.5, R * 0.8), C.z + U.rand(-R, R)),
        v: new THREE.Vector3(U.rand(-.2, .2), U.rand(-.1, .1), U.rand(-.2, .2)),
        t: new THREE.Vector3(),
        ph: Math.random() * 100,
        sp: U.rand(0.7, 1.35),
        sc: U.rand(0.82, 1.20),
        home: Math.random(),
        inside: 0,
        retarget: 0
      });
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._fwd = new THREE.Vector3();
    this._zero = new THREE.Vector3();
    this._rx = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    this.center = C.clone();
    this.radius = R;
    this.entrance = (opt.entrance || C).clone();
    this.mode = opt.mode || 'orbit';
    this.plane = opt.plane || null;   // 'surface' モード用の Object3D
    this.area = opt.area || new THREE.Vector2(0.4, 0.18);
  }

  Swarm.prototype.setMode = function (m, plane, area) {
    this.mode = m;
    if (plane) this.plane = plane;
    if (area) this.area = area;
  };

  Swarm.prototype.update = function (dt, time) {
    var i, b, n = this.count;
    var calm = this.calm;
    var m = this._m, q = this._q, s = this._s, fwd = this._fwd;
    var surf = (this.mode === 'surface' && this.plane);
    if (surf) this.plane.updateWorldMatrix(true, false);

    for (i = 0; i < n; i++) {
      b = this.b[i];

      if (surf) {
        /* --- 巣脾の上を歩く --- */
        b.retarget -= dt;
        if (b.retarget <= 0) {
          b.retarget = U.rand(0.7, 2.4);
          b.t.set(U.rand(-1, 1) * this.area.x * 0.5, U.rand(-1, 1) * this.area.y * 0.5, 0);
        }
        var lp = b.p;
        lp.x += (b.t.x - lp.x) * Math.min(1, dt * 1.4 * b.sp * (1 - calm * 0.7));
        lp.y += (b.t.y - lp.y) * Math.min(1, dt * 1.4 * b.sp * (1 - calm * 0.7));
        lp.z = 0.006 + Math.sin(time * 3 + b.ph) * 0.0006;
        var ang = Math.atan2(b.t.y - lp.y, b.t.x - lp.x);
        m.makeRotationZ(ang - Math.PI / 2);
        m.multiply(this._rx);
        s.setScalar(b.sc);
        m.scale(s);
        m.setPosition(lp.x, lp.y, lp.z);
        m.premultiply(this.plane.matrixWorld);
      } else {
        /* --- 空中を飛ぶ --- */
        b.retarget -= dt;
        if (b.retarget <= 0) {
          b.retarget = U.rand(0.5, 1.8);
          var R = this.radius * (1 - calm * 0.55);
          b.t.set(
            this.center.x + U.rand(-R, R),
            this.center.y + U.rand(-R * 0.35, R * 0.75),
            this.center.z + U.rand(-R, R)
          );
          // 落ち着くと巣門へ吸い寄せられる
          if (calm > 0.15) b.t.lerp(this.entrance, calm * 0.85);
        }
        var acc = 2.2 * b.sp * (1 - calm * 0.55);
        b.v.x += (b.t.x - b.p.x) * acc * dt;
        b.v.y += (b.t.y - b.p.y) * acc * dt;
        b.v.z += (b.t.z - b.p.z) * acc * dt;
        // ふらふらした揺らぎ
        var w = (1 - calm * 0.8);
        b.v.x += Math.sin(time * 9.3 + b.ph) * 0.09 * w * dt * 60 * 0.016;
        b.v.y += Math.cos(time * 11.1 + b.ph * 1.7) * 0.09 * w * dt * 60 * 0.016;
        b.v.z += Math.sin(time * 8.1 + b.ph * 2.3) * 0.09 * w * dt * 60 * 0.016;
        b.v.multiplyScalar(Math.exp(-3.4 * dt));
        var maxv = 0.85 * b.sp * (1 - calm * 0.6);
        var sp = b.v.length();
        if (sp > maxv) b.v.multiplyScalar(maxv / sp);
        b.p.addScaledVector(b.v, dt);

        // 巣門に届いたら中へ（消える）
        if (calm > 0.5) {
          var d2 = b.p.distanceTo(this.entrance);
          if (d2 < 0.05) b.inside = Math.min(1, b.inside + dt * 2.2);
        } else b.inside = Math.max(0, b.inside - dt * 1.6);

        fwd.copy(b.v);
        if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, 1);
        fwd.normalize();
        m.lookAt(fwd, this._zero, this._up);
        var scl = b.sc * (1 - b.inside) * (1 - this.hidden);
        s.setScalar(scl);
        m.scale(s);
        m.setPosition(b.p.x, b.p.y, b.p.z);
      }

      this.body.setMatrixAt(i, m);
      this.wing.setMatrixAt(i, m);
    }
    this.body.instanceMatrix.needsUpdate = true;
    this.wing.instanceMatrix.needsUpdate = true;
  };

  global.Swarm = Swarm;
  global.mergeGeoms = mergeGeoms;
})(window);
