/* =========================================================================
   stage_uncap.js — ③蜜蓋除去
   白っぽい蜜蓋を，太い蜜掻きフォークで上から下へなぞって剥がす。
   ひとなでごとに 白 → 黄金 の帯があらわれ，蝋のかけらがトレイに落ちる。
   ========================================================================= */
(function (global) {
  'use strict';

  var S = {
    tray: null, holder: null, fork: null, pivot: null,
    frames: [], idx: 0, cur: null,
    phase: 'bring',        // bring → scrape → finish → done
    anim: null, lastUV: null, cover: 0, coverT: 0,
    curls: null, drops: null, scrapeT: 0,
    home: new THREE.Vector3(1.92, 0.966, 0.30),
    tmpV: new THREE.Vector3(), tmpN: new THREE.Vector3(),
    toolT: 0, toolShow: 0, finishT: 0, wetT: 0,
    _q: new THREE.Quaternion(),
    _roll: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.10, 0, 0.16))
  };

  var BRUSH_U = 0.115, BRUSH_V = 0.115;   // 刃幅 ≒ 8.8cm 相当
  var GOAL = 0.80;

  global.Stages = global.Stages || {};

  /* ---------- 蝋のかけら（削りくず） ---------- */
  function Curls(scene, n) {
    var geo = new THREE.TorusGeometry(0.0105, 0.0030, 5, 9, Math.PI * 1.5);
    geo.scale(1, 1, 0.55);
    var mat = new THREE.MeshStandardMaterial({
      color: MAT.C(0xf6ecd6), roughness: 0.55, metalness: 0,
      envMap: MAT.env, envMapIntensity: 0.4
    });
    var im = new THREE.InstancedMesh(geo, mat, n);
    im.castShadow = true;
    im.frustumCulled = false;
    scene.add(im);
    this.mesh = im;
    this.n = n; this.next = 0;
    this.items = [];
    var m = new THREE.Matrix4();
    m.makeScale(0.0001, 0.0001, 0.0001);
    for (var i = 0; i < n; i++) {
      this.items.push({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), rv: new THREE.Vector3(), rest: 0, sc: 1 });
      im.setMatrixAt(i, m);
    }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3();
  }
  Curls.prototype.spawn = function (p, v, restY) {
    var it = this.items[this.next];
    this.next = (this.next + 1) % this.n;
    it.alive = true; it.rest = 0;
    it.p.copy(p); it.v.copy(v);
    it.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    it.rv.set(U.rand(-7, 7), U.rand(-7, 7), U.rand(-7, 7));
    it.sc = U.rand(0.7, 1.35);
    it.restY = restY;
  };
  Curls.prototype.update = function (dt) {
    var m = this._m, q = this._q, s = this._s;
    for (var i = 0; i < this.n; i++) {
      var it = this.items[i];
      if (!it.alive) continue;
      if (!it.rest) {
        it.v.y -= 2.4 * dt;
        it.v.multiplyScalar(Math.exp(-1.2 * dt));
        it.p.addScaledVector(it.v, dt);
        it.r.x += it.rv.x * dt; it.r.y += it.rv.y * dt; it.r.z += it.rv.z * dt;
        if (it.p.y <= it.restY) {
          it.p.y = it.restY + U.rand(0, 0.006);
          it.rest = 1;
          it.r.x = Math.PI / 2 + U.rand(-.4, .4);
          it.r.z = U.rand(0, 6);
        }
      }
      q.setFromEuler(it.r);
      s.setScalar(it.sc);
      m.compose(it.p, q, s);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  };
  Curls.prototype.clear = function () {
    var m = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
    for (var i = 0; i < this.n; i++) { this.items[i].alive = false; this.mesh.setMatrixAt(i, m); }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.next = 0;
  };

  /* ================================================================== */
  Stages.uncap = {
    id: 'uncap',

    build: function (G) {
      var L = LAYOUT;
      // 作業台
      var table = P.table(1.16, 0.64, L.tableH);
      table.position.set(L.table.x, 0, L.table.z);
      G.scene.add(table);
      var sb = P.shadowBlob(0.62, 0.40, 0.45);
      sb.position.set(L.table.x, 0.006, L.table.z);
      G.scene.add(sb);

      // 蜜蓋を受けるトレイ
      var tray = P.tray(0.60, 0.34);
      tray.position.set(S.home.x, L.tableH, S.home.z);
      G.scene.add(tray);
      S.tray = tray;
      S.trayFloorY = L.tableH + 0.006;

      // 巣枠を立てる支柱（上端にV字の切り欠き）
      var hm = MAT.wood({ seed: 181, repX: 1, repY: 2, base: [176, 138, 88], dark: [112, 76, 38] });
      var holder = new THREE.Group();
      [-1, 1].forEach(function (s) {
        var post = P.box(0.030, 0.32, 0.034, hm, s * 0.245, 0.16, 0);
        holder.add(post);
        var notch = P.box(0.030, 0.016, 0.050, hm, s * 0.245, 0.322, 0.008);
        notch.rotation.x = -0.22;
        holder.add(notch);
        var brace = P.box(0.024, 0.020, 0.14, hm, s * 0.245, 0.012, 0.04);
        holder.add(brace);
      });
      holder.position.set(S.home.x, L.tableH, S.home.z);
      holder.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      G.scene.add(holder);
      S.holder = holder;

      // 道具
      var pivot = new THREE.Group();
      var fork = P.uncapFork();
      fork.position.set(-fork.userData.tip.x, -fork.userData.tip.y, -fork.userData.tip.z);
      pivot.add(fork);
      pivot.visible = false;
      G.scene.add(pivot);
      S.fork = fork; S.pivot = pivot;

      // 台の上に置いてある予備の道具（生活感）
      var spare = P.uncapFork();
      spare.position.set(L.table.x - 0.44, L.tableH + 0.02, L.table.z + 0.20);
      spare.rotation.set(Math.PI / 2, 0, 0.5);
      G.scene.add(spare);

      S.curls = new Curls(G.scene, 46);
      S.drops = new FX.Quads(90, TEX.blob(), { color: MAT.C(0xffffff), emissive: 0.2, renderOrder: 11 });
      G.scene.add(S.drops.mesh);
    },

    enter: function (G) {
      S.frames = Stages.frames.pulled();
      S.idx = 0;
      S.curls.clear();
      S.drops.clear();
      bring(G);
    },

    exit: function () {
      S.pivot.visible = false;
      SFX.slideLoop(0);
    },

    update: function (G, dt) {
      if (S.phase === 'bring') updateBring(G, dt);
      else if (S.phase === 'scrape') updateScrape(G, dt, G.ptr);
      else if (S.phase === 'finish') updateFinish(G, dt);
      else if (S.phase === 'return') updateReturn(G, dt);
      S.curls.update(dt);
      S.drops.update(dt, G.time);
    }
  };

  /* ---------- 巣枠を支柱へ運ぶ ---------- */
  function bring(G) {
    var f = S.frames[S.idx];
    S.cur = f;
    S.phase = 'bring';
    S.anim = { t: 0, dur: 0.8, from: f.position.clone(), fromQ: f.quaternion.clone() };
    var q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.22, 0, 0));
    S.anim.toQ = q;
    S.anim.to = S.home.clone();
    S.cover = 0; S.lastUV = null; S.wetT = 0;

    G.setCam(new THREE.Vector3(S.home.x, S.home.y - 0.008, S.home.z),
      new THREE.Vector3(0.05, 0.30, 1.0).normalize(), 0.145, { speed: 2.1, minW: 0.255 });
    World.setShadowFocus(S.home);
  }

  function updateBring(G, dt) {
    var a = S.anim;
    a.t += dt;
    var t = U.sat(a.t / a.dur), e = U.easeInOut(t);
    S.cur.position.lerpVectors(a.from, a.to, e);
    S.cur.position.y += Math.sin(t * Math.PI) * 0.10;
    S.cur.quaternion.slerpQuaternions(a.fromQ, a.toQ, e);
    if (t >= 1) {
      S.phase = 'scrape';
      SFX.woodThunk(0.4);
      setHint(G);
    }
  }

  function setHint(G) {
    var f = S.cur;
    var top = f.localToWorld(new THREE.Vector3(0, 0.07, 0.03));
    Hint.set({ type: 'swipe', at: top, dir: { x: 0, y: 1 }, len: 190, delay: 1.6 });
  }

  /* ---------- 削る ---------- */
  function combUV(G, f, out) {
    var cf = f.userData.combFront;
    cf.updateWorldMatrix(true, false);
    // 巣脾の面の法線
    S.tmpN.set(0, 0, 1).transformDirection(cf.matrixWorld).normalize();
    var wp = new THREE.Vector3().setFromMatrixPosition(cf.matrixWorld);
    var hit = G.rayPlane(S.tmpN, wp, S.tmpV);
    if (!hit) return null;
    var local = cf.worldToLocal(hit.clone());
    out.u = local.x / P.FRAME.COMB_W + 0.5;
    out.v = local.y / P.FRAME.COMB_H + 0.5;
    out.world = hit.clone();
    out.n = S.tmpN.clone();
    return out;
  }

  var _uv = {}, _prevWorld = new THREE.Vector3();

  function updateScrape(G, dt, p) {
    var f = S.cur;
    var mask = f.userData.mask;
    var res = combUV(G, f, _uv);

    // 道具は指を追う（画面外に出ないよう uv をゆるく丸める）
    S.toolShow = U.damp(S.toolShow, (p.down && res) ? 1 : 0.55, 8, dt);
    if (res) {
      var cu = U.clamp(res.u, -0.12, 1.12), cv = U.clamp(res.v, -0.14, 1.14);
      var cf = f.userData.combFront;
      var lp = new THREE.Vector3((cu - 0.5) * P.FRAME.COMB_W, (cv - 0.5) * P.FRAME.COMB_H, 0.003);
      var wp = cf.localToWorld(lp);
      S.pivot.visible = true;
      S.pivot.position.lerp(wp, Math.min(1, dt * 26));
      // 道具は巣脾の面にそのまま当たる向き（歯が面へ，柄は手前下へ）
      cf.getWorldQuaternion(S._q);
      S._q.multiply(S._roll);
      S.pivot.quaternion.slerp(S._q, Math.min(1, dt * 14));
    }

    if (p.justDown) { S.lastUV = null; }

    if (p.down && res) {
      var u = U.clamp(res.u, -0.05, 1.05), v = U.clamp(res.v, -0.05, 1.05);
      if (S.lastUV) {
        var du = u - S.lastUV.u, dv = v - S.lastUV.v;
        var d = Math.hypot(du * 2.2, dv);
        if (d > 0.0015) {
          mask.stroke(S.lastUV.u, S.lastUV.v, u, v, BRUSH_U, BRUSH_V);
          S.lastUV = { u: u, v: v };
          S.scrapeT -= d;
          if (S.scrapeT <= 0) {
            S.scrapeT = 0.055;
            SFX.scrape(U.clamp(d * 12, 0.35, 1));
            // 蝋のかけらと蜜のしずくが落ちる
            var wp2 = res.world;
            for (var i = 0; i < 2; i++) {
              S.curls.spawn(
                new THREE.Vector3(wp2.x + U.rand(-.03, .03), wp2.y + U.rand(-.01, .01), wp2.z + U.rand(0, .015)),
                new THREE.Vector3(U.rand(-.12, .12), U.rand(-.05, .12), U.rand(.05, .22)),
                S.trayFloorY + U.rand(0, 0.012));
            }
            if (Math.random() < 0.55) {
              S.drops.spawn({
                x: wp2.x + U.rand(-.05, .05), y: wp2.y, z: wp2.z + 0.012,
                vx: U.rand(-.04, .04), vy: -0.05, vz: U.rand(0, .06),
                life: 0.8, s0: U.rand(0.006, 0.013), s1: 0.004,
                alpha: 0.95, grav: -1.6, drag: 0.2
              });
            }
            G.sparkle.burst(wp2, 3, 0.25, 0.018);
          }
        }
      } else {
        mask.paint(u, v, BRUSH_U, BRUSH_V);
        S.lastUV = { u: u, v: v };
        SFX.scrape(0.6);
      }
    }
    if (!p.down) S.lastUV = null;

    mask.flush();

    // 進みぐあい
    S.coverT -= dt;
    if (S.coverT <= 0) {
      S.coverT = 0.18;
      S.cover = mask.coverage();
      if (S.cover >= GOAL) beginFinish(G);
    }
  }

  /* ---------- 仕上げ（残りを一気にきれいに） ---------- */
  function beginFinish(G) {
    S.phase = 'finish';
    S.finishT = 0;
    Hint.clear();
    S.pivot.visible = false;
    SFX.chime(12, 0.9);
    var wp = S.cur.getWorldPosition(new THREE.Vector3());
    G.sparkle.burst(wp, 34, 0.85, 0.04);
  }

  function updateFinish(G, dt) {
    S.finishT += dt;
    var f = S.cur;
    var mask = f.userData.mask;
    // 残りを下から上へ拭き上げる
    var t = U.sat(S.finishT / 0.55);
    var v = t;
    for (var i = 0; i < 3; i++) {
      mask.paint(0.15 + i * 0.35, v, 0.30, 0.16);
      mask.paint(0.0, v, 0.28, 0.16);
      mask.paint(1.0, v, 0.28, 0.16);
    }
    mask.flush();
    // つやを強調
    f.userData.comb.uniforms.uWet.value = 1.0 + Math.sin(S.finishT * 6) * 0.15;
    f.rotation.y = Math.sin(S.finishT * 3.4) * 0.14;

    if (S.finishT > 1.35) {
      f.userData.comb.uniforms.uWet.value = 1;
      f.rotation.y = 0;
      // 台へもどす
      var slot = Stages.frames.rackSlot(S.idx);
      S.anim = {
        t: 0, dur: 0.75, from: f.position.clone(), to: slot.clone(),
        fromQ: f.quaternion.clone(), toQ: new THREE.Quaternion()
      };
      S.phase = 'return';
    }
  }

  /* ---------- 台へもどす ---------- */
  function updateReturn(G, dt) {
    var a = S.anim;
    a.t += dt;
    var t = U.sat(a.t / a.dur), e = U.easeInOut(t);
    S.cur.position.lerpVectors(a.from, a.to, e);
    S.cur.position.y += Math.sin(t * Math.PI) * 0.09;
    S.cur.quaternion.slerpQuaternions(a.fromQ, a.toQ, e);
    if (t >= 1) {
      SFX.woodThunk(0.4);
      S.idx++;
      if (S.idx >= S.frames.length) {
        SFX.fanfare();
        S.phase = 'done';
        setTimeout(function () { if (G.stage === 2) G.next(); }, 750);
      } else {
        bring(G);
      }
    }
  }
})(window);
