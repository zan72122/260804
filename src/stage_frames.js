/* =========================================================================
   stage_frames.js — ②巣箱をあける／巣枠を垂直に引き抜く
   ふたを大きくドラッグしてはずすと，中に木の巣枠がずらりと並んでいる。
   一枚を上へスワイプすると スーーーーッ と垂直に抜けてくる。
   ========================================================================= */
(function (global) {
  'use strict';

  var S = {
    hive: null, lid: null, frames: [], pull: [], picked: 0,
    phase: 'lid',           // lid → pull → present → stow → done
    grab: null, grabY0: 0, frameY0: 0, lastY: 0, vel: 0,
    lidGrab: false, lidOff: 0, lidAnim: null,
    glow: null, rack: null, rackSlots: [],
    present: 0, presentFrame: null, swarm: null,
    slotY: 0.464, tmp: new THREE.Vector3(), tmp2: new THREE.Vector3(),
    dragPlaneN: new THREE.Vector3(), stow: null, freeSpots: []
  };

  var NFRAMES = 8;
  var PULL_IDX = [5, 3, 1];      // 引き抜く順（外側から）
  var NEED = 3;
  var PULL_DIST = 0.30;

  global.Stages = global.Stages || {};

  Stages.frames = {
    id: 'frames',

    build: function (G) {
      var L = LAYOUT;
      S.hive = World.activeHive;
      S.lid = S.hive.userData.lid;
      // 内ぶたはふたと一緒に持ち上がる（プロポリスでくっついている）
      var inner = S.hive.userData.innerCover;
      S.hive.remove(inner);
      inner.position.y -= S.lid.position.y;
      S.lid.add(inner);

      // 巣枠を並べる
      var z0 = -(NFRAMES - 1) * 0.038 / 2;
      for (var i = 0; i < NFRAMES; i++) {
        var f = P.frame({ seed: 20 + i * 3, pollen: i === 0 || i === NFRAMES - 1 ? 0.16 : 0.04 });
        f.position.set(0, S.slotY, z0 + i * 0.038);
        f.userData.homeZ = f.position.z;
        f.userData.idx = i;
        G.scene.add(f);
        S.frames.push(f);
      }

      // 抜いた巣枠を立てておく台（作業台の上）
      var rack = P.frameRack(NEED);
      rack.position.set(L.table.x - 0.28, L.tableH, L.table.z - 0.09);
      rack.rotation.y = 0.10;
      G.scene.add(rack);
      S.rack = rack;
      for (var k = 0; k < NEED; k++) {
        S.rackSlots.push(new THREE.Vector3(
          rack.position.x, L.tableH + rack.userData.topY - 0.094,
          rack.position.z - 0.052 + k * 0.052));
      }

      // 次に抜く巣枠を示すやわらかな光
      var glow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.50, 0.075),
        new THREE.MeshBasicMaterial({
          map: TEX.spark(), color: MAT.C(0xffe08a), transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
        })
      );
      glow.rotation.x = -Math.PI / 2;
      glow.renderOrder = 30;
      G.scene.add(glow);
      S.glow = glow;

      // 巣枠の上を歩くハチ
      S.swarm = new Swarm(14, { mode: 'surface', area: new THREE.Vector2(0.40, 0.17) });
      S.swarm.group.visible = false;
      G.scene.add(S.swarm.group);
    },

    // 新しい周回のたびに巣箱を元通りにする
    reset: function (G) {
      var L = LAYOUT;
      S.phase = 'lid';
      S.picked = 0; S.grab = null; S.lidGrab = false; S.lidOff = 0; S.lidAnim = null;
      S.present = 0; S.presentFrame = null; S.stow = null;
      S.lid.position.copy(S.hive.userData.lidHome);
      S.lid.rotation.set(0, 0, 0);
      S.lid.visible = true;
      var z0 = -(NFRAMES - 1) * 0.038 / 2;
      for (var i = 0; i < S.frames.length; i++) {
        var f = S.frames[i];
        // 前の周回で分離機のポケットに入ったままの巣枠をシーンへ戻す
        if (f.parent !== G.scene) G.scene.add(f);
        f.position.set(0, S.slotY, z0 + i * 0.038);
        f.rotation.set(0, 0, 0);
        f.visible = true;
        f.userData.mask.reset(0);
        f.userData.mask.flush();
        f.userData.comb.uniforms.uDrain.value = 0;
        f.userData.state = 'in';
      }
      S.pull = PULL_IDX.map(function (i) { return S.frames[i]; });
      S.glow.material.opacity = 0;
      S.swarm.group.visible = false;
    },

    enter: function (G) {
      S.phase = 'lid';
      G.setCam(
        new THREE.Vector3(0, 0.62, 0.02),
        new THREE.Vector3(0.12, 0.68, 0.90).normalize(),
        0.36, { speed: 2.0, minW: 0.30 }
      );
      World.setShadowFocus(new THREE.Vector3(0, 0.55, 0));
      SFX.beeLoop(0.16);
      var lp = S.lid.getWorldPosition(new THREE.Vector3());
      lp.y += 0.06;
      Hint.set({ type: 'drag', at: lp, dir: { x: -0.86, y: 0.5 }, len: 165, delay: 1.8 });
    },

    exit: function () {
      SFX.slideLoop(0);
      SFX.beeLoop(0);
      S.swarm.group.visible = false;
      S.glow.material.opacity = 0;
    },

    /* ------------------------------------------------------------------ */
    update: function (G, dt) {
      var p = G.ptr;

      if (S.phase === 'lid') updateLid(G, dt, p);
      else if (S.phase === 'pull') updatePull(G, dt, p);
      else if (S.phase === 'present') updatePresent(G, dt);
      else if (S.phase === 'stow') updateStow(G, dt);

      // 光の点滅
      if (S.phase === 'pull' && !S.grab) {
        var f = S.pull[S.picked];
        if (f) {
          S.glow.position.set(f.position.x, f.position.y + 0.125, f.position.z);
          S.glow.material.opacity = 0.30 + Math.sin(G.time * 4.2) * 0.20;
        }
      } else {
        S.glow.material.opacity = U.damp(S.glow.material.opacity, 0, 10, dt);
      }

      if (S.swarm.group.visible) S.swarm.update(dt, G.time);
    }
  };

  /* =======================================================================
     ふたをはずす
     ======================================================================= */
  function updateLid(G, dt, p) {
    if (S.lidAnim) {
      S.lidAnim.t += dt;
      var t = U.sat(S.lidAnim.t / S.lidAnim.dur);
      var e = U.easeInOut(t);
      S.lid.position.lerpVectors(S.lidAnim.from, S.lidAnim.to, e);
      S.lid.position.y += Math.sin(t * Math.PI) * 0.10;
      S.lid.rotation.z = U.lerp(0, S.lidAnim.rz, e);
      S.lid.rotation.x = U.lerp(0, S.lidAnim.rx, e);
      if (t >= 1) {
        S.lidAnim = null;
        SFX.woodThunk(1);
        G.camShake(0.006);
        startPull(G);
      }
      return;
    }

    if (p.justDown) S.lidGrab = true;
    if (S.lidGrab && p.down) {
      // 水平面上で指を追う（どこをつかんでも動く）
      var hit = G.rayPlane(new THREE.Vector3(0, 1, 0), S.tmp.set(0, 0.60, 0), S.tmp2);
      if (hit) {
        if (!S.lidStart) S.lidStart = { x: hit.x, z: hit.z, lx: S.lid.position.x, lz: S.lid.position.z };
        var dx = hit.x - S.lidStart.x, dz = hit.z - S.lidStart.z;
        var d = Math.hypot(dx, dz);
        S.lid.position.x = S.lidStart.lx + dx;
        S.lid.position.z = S.lidStart.lz + dz;
        S.lid.position.y = S.hive.userData.lidHome.y + Math.min(0.09, d * 0.55);
        S.lid.rotation.z = U.clamp(-dx * 0.5, -0.28, 0.28);
        S.lid.rotation.x = U.clamp(dz * 0.5, -0.28, 0.28);
        if (d > 0.02) SFX.slideLoop(U.sat(p.speed / 900) * 0.8);
        else SFX.slideLoop(0);
      }
    }
    if (S.lidGrab && !p.down) {
      S.lidGrab = false; S.lidStart = null;
      SFX.slideLoop(0);
      var moved = Math.hypot(S.lid.position.x, S.lid.position.z - S.hive.userData.lidHome.z);
      // 少しでも動かせば（タップだけでも）ふたは外れる
      // 実際の養蜂どおり，屋根はひっくり返して地面に置く
      S.lidAnim = {
        t: 0, dur: 0.78,
        from: S.lid.position.clone(),
        to: new THREE.Vector3(-0.72, -0.262, 0.22),
        rz: Math.PI, rx: 0
      };
      if (moved < 0.02) S.lidAnim.dur = 0.95;
    }
  }

  /* =======================================================================
     巣枠を垂直に引き抜く
     ======================================================================= */
  function startPull(G) {
    S.phase = 'pull';
    G.setCam(
      new THREE.Vector3(0, 0.58, 0.0),
      new THREE.Vector3(0.10, 0.44, 0.95).normalize(),
      0.34, { speed: 2.2, minW: 0.29 }
    );
    hintPull(G);
  }

  function hintPull(G) {
    var f = S.pull[S.picked];
    if (!f) return;
    Hint.set({
      type: 'swipe',
      at: new THREE.Vector3(f.position.x, f.position.y + 0.10, f.position.z),
      dir: { x: 0, y: -1 }, len: 190, delay: 1.8
    });
  }

  function updatePull(G, dt, p) {
    var target = S.pull[S.picked];
    if (!target) return;

    if (p.justDown && !S.grab) {
      // 巣枠に当たればそれを，外れても「次の一枚」をつかむ（意図をくむ）
      var hit = G.pick(S.frames, true);
      var f = target;
      if (hit) {
        var o = hit.object;
        while (o && S.frames.indexOf(o) < 0) o = o.parent;
        if (o && S.pull.indexOf(o) === S.picked) f = o;
      }
      S.dragPlaneN.copy(G.camera.getWorldDirection(new THREE.Vector3()));
      S.dragPlaneN.y = 0;
      if (S.dragPlaneN.lengthSq() < 1e-6) S.dragPlaneN.set(0, 0, 1);
      S.dragPlaneN.normalize();
      var h = G.rayPlane(S.dragPlaneN, f.position, S.tmp2);
      if (h) {
        S.grab = f;
        S.grabY0 = h.y;
        S.frameY0 = f.position.y;
        S.lastY = f.position.y;
        S.vel = 0;
        Hint.clear();
      }
    }

    if (S.grab) {
      var f2 = S.grab;
      if (p.down) {
        var h2 = G.rayPlane(S.dragPlaneN, f2.position, S.tmp2);
        if (h2) {
          var dy = (h2.y - S.grabY0) * 1.18;       // 少し増幅して軽く感じさせる
          var ny = S.frameY0 + Math.max(0, dy);
          f2.position.y = U.damp(f2.position.y, ny, 26, dt);
        }
      } else {
        // 指を離しても，十分上がっていればそのまま抜ける
        var lift = f2.position.y - S.frameY0;
        if (lift < PULL_DIST * 0.999) {
          f2.position.y = U.damp(f2.position.y, S.frameY0, 8, dt);
          if (f2.position.y - S.frameY0 < 0.004) {
            f2.position.y = S.frameY0; S.grab = null; SFX.slideLoop(0); hintPull(G);
          }
        }
      }

      var lift2 = f2.position.y - S.frameY0;
      S.vel = Math.abs(f2.position.y - S.lastY) / Math.max(dt, 1e-4);
      S.lastY = f2.position.y;
      SFX.slideLoop(U.sat(S.vel / 0.55) * (0.35 + 0.65 * U.sat(lift2 / PULL_DIST)));

      // 抜けきった
      if (lift2 >= PULL_DIST) {
        SFX.slideLoop(0);
        SFX.chime(7, 0.8);
        beginPresent(G, f2);
      }
    } else {
      SFX.slideLoop(0);
    }
  }

  /* =======================================================================
     抜けた巣枠を見せる（六角形と黄金の蜜）
     ======================================================================= */
  function beginPresent(G, f) {
    S.phase = 'present';
    S.presentFrame = f;
    S.present = 0;
    S.grab = null;
    f.userData.state = 'out';
    S.presentFrom = { p: f.position.clone(), ry: f.rotation.y };
    // カメラの正面に向ける
    S.presentTo = new THREE.Vector3(0.06, 0.82, 0.30);
    G.setCam(S.presentTo.clone().add(new THREE.Vector3(0, -0.01, 0)),
      new THREE.Vector3(0.06, 0.16, 1.0).normalize(), 0.16, { speed: 2.8, minW: 0.27 });
    World.setShadowFocus(S.presentTo);
    G.sparkle.burst(f.position.clone().add(new THREE.Vector3(0, 0.02, 0)), 24, 0.7, 0.045);
    // ハチを巣脾の表面に載せる
    S.swarm.setMode('surface', f.userData.combFront, new THREE.Vector2(0.40, 0.17));
    S.swarm.group.visible = true;
    SFX.beeLoop(0.30);
  }

  function updatePresent(G, dt) {
    S.present += dt;
    var t = U.sat(S.present / 1.05);
    var e = U.easeInOut(t);
    var f = S.presentFrame;
    f.position.lerpVectors(S.presentFrom.p, S.presentTo, e);
    f.rotation.y = U.lerp(S.presentFrom.ry, 0, e);
    f.rotation.z = Math.sin(t * Math.PI) * 0.06;
    // ゆっくり傾けて蜜のつやを見せる
    if (t >= 1) {
      f.rotation.y = Math.sin((S.present - 1.05) * 1.5) * 0.22;
      f.rotation.z = Math.sin((S.present - 1.05) * 1.1) * 0.03;
    }
    if (S.present > 2.5) {
      S.picked++;
      S.swarm.group.visible = false;
      SFX.beeLoop(0.12);
      beginStow(G, f);
    }
  }

  function beginStow(G, f) {
    S.phase = 'stow';
    S.stow = {
      t: 0, dur: 0.85, f: f,
      from: f.position.clone(), fromRy: f.rotation.y,
      to: S.rackSlots[S.picked - 1].clone(), toRy: S.rack.rotation.y
    };
  }

  function updateStow(G, dt) {
    var st = S.stow;
    st.t += dt;
    var t = U.sat(st.t / st.dur);
    var e = U.easeInOut(t);
    st.f.position.lerpVectors(st.from, st.to, e);
    st.f.position.y += Math.sin(t * Math.PI) * 0.12;
    st.f.rotation.y = U.lerp(st.fromRy, st.toRy, e);
    st.f.rotation.z = U.lerp(st.f.rotation.z, 0, e);
    if (t >= 1) {
      SFX.woodThunk(0.5);
      S.stow = null;
      if (S.picked >= NEED) {
        SFX.fanfare();
        setTimeout(function () { if (G.stage === 1) G.next(); }, 700);
        S.phase = 'done';
      } else {
        S.phase = 'pull';
        G.setCam(new THREE.Vector3(0, 0.58, 0.0),
          new THREE.Vector3(0.10, 0.44, 0.95).normalize(), 0.34, { speed: 2.4, minW: 0.29 });
        World.setShadowFocus(new THREE.Vector3(0, 0.55, 0));
        hintPull(G);
      }
    }
  }

  // ほかのステージから抜いた巣枠を参照する
  Stages.frames.pulled = function () {
    return S.pull.slice(0, NEED);
  };
  Stages.frames.rackSlot = function (i) { return S.rackSlots[i]; };
})(window);
