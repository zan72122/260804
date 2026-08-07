/* =========================================================================
   stage_smoker.js — ①燻煙
   蛇腹をおすたび シュポッ と白い煙が出て，巣門へ流れこむ。
   ミツバチはだんだん落ちついて，巣の中へもどっていく。
   ========================================================================= */
(function (global) {
  'use strict';

  // 養蜂場のレイアウト（全ステージ共有）
  global.LAYOUT = {
    hiveY: 0.34,
    entrance: new THREE.Vector3(0, 0.352, 0.235),
    smokerCrate: new THREE.Vector3(0.14, 0, 0.76),
    table: new THREE.Vector3(1.72, 0, 0.26),
    tableH: 0.74,
    extractor: new THREE.Vector3(3.06, 0, -0.06),
    jarBlock: new THREE.Vector3(3.06, 0, 0.24),
    shelf: new THREE.Vector3(3.78, 0, 0.60)
  };

  global.Stages = global.Stages || {};

  var S = {
    smoker: null, bel: null, spout: new THREE.Vector3(),
    swarm: null, proxy: null,
    press: 0, pressGoal: 0, holdT: 0,
    puffs: 0, need: 5, calm: 0, done: 0, ring: null
  };

  Stages.smoker = {
    id: 'smoker',

    build: function (G) {
      var L = LAYOUT;
      // 燻煙器を載せる木箱
      var crate = P.crate(0.38, 0.30, 0.32, 151);
      crate.position.copy(L.smokerCrate);
      crate.rotation.y = -0.20;
      G.scene.add(crate);
      var sb = P.shadowBlob(0.28, 0.26, 0.45);
      sb.position.set(L.smokerCrate.x, 0.006, L.smokerCrate.z);
      G.scene.add(sb);

      var sm = P.smoker();
      sm.position.set(L.smokerCrate.x, 0.30, L.smokerCrate.z);
      sm.rotation.y = 2.35;                     // 蛇腹のひだが手前を向き，煙の出口は巣門側へ
      sm.rotation.z = 0.09;
      sm.scale.setScalar(1.12);
      G.scene.add(sm);
      S.smoker = sm;
      S.bel = sm.userData.bellows;

      // 押す場所（見えない当たり判定）
      var proxy = new THREE.Mesh(
        new THREE.BoxGeometry(0.30, 0.22, 0.24),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      proxy.position.copy(sm.position).add(new THREE.Vector3(0.055, 0.10, 0.115));
      G.scene.add(proxy);
      S.proxy = proxy;

      // 巣門のまわりを飛ぶミツバチ
      S.swarm = new Swarm(38, {
        center: new THREE.Vector3(L.entrance.x, L.entrance.y + 0.10, L.entrance.z + 0.13),
        radius: 0.22,
        entrance: L.entrance,
        shadow: false
      });
      G.scene.add(S.swarm.group);

      // 巣門でひろがる光の輪（進みぐあいの合図）
      var ring = new THREE.Mesh(
        new THREE.RingGeometry(0.052, 0.062, 40),
        new THREE.MeshBasicMaterial({
          color: MAT.C(0xffd888), transparent: true, opacity: 0, side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      ring.position.copy(L.entrance).add(new THREE.Vector3(0, 0.02, 0.02));
      ring.renderOrder = 8;
      G.scene.add(ring);
      S.ring = ring;

      // 使いこんだ道具を足元に散らす（生活感）
      var tool = P.box(0.24, 0.008, 0.028,
        MAT.metal({ base: '#c0c6ca', grime: 1.6, dents: 20, seed: 141, rough: .42, metal: .9 }),
        L.smokerCrate.x + 0.44, 0.014, L.smokerCrate.z - 0.30);
      tool.rotation.y = 0.7; tool.rotation.z = 0.02;
      G.scene.add(tool);
      var br = P.box(0.20, 0.03, 0.045, MAT.wood({ seed: 143 }),
        L.smokerCrate.x + 0.60, 0.016, L.smokerCrate.z - 0.10);
      br.rotation.y = -0.4;
      G.scene.add(br);
    },

    enter: function (G) {
      var L = LAYOUT;
      S.puffs = 0; S.calm = 0; S.done = 0; S.press = 0; S.pressGoal = 0; S.holdT = 0;
      S.swarm.calm = 0; S.swarm.hidden = 0;
      // 新しい周回では巣枠を作りなおす
      Stages.frames.reset(G);

      G.setCam(
        new THREE.Vector3(0.09, 0.46, 0.48),
        new THREE.Vector3(0.13, 0.33, 0.94).normalize(),
        0.42, { speed: 2.2, minW: 0.27 }
      );
      World.setShadowFocus(new THREE.Vector3(0.25, 0.4, 0.3));
      SFX.beeLoop(0.55);

      S.smoker.getWorldPosition(S.spout);
      S.spout.copy(S.smoker.localToWorld(S.smoker.userData.spout.clone()));

      Hint.set({ type: 'press', at: S.proxy.position.clone().add(new THREE.Vector3(0, 0.02, 0)), delay: 1.6 });
    },

    exit: function (G) {
      SFX.beeLoop(0);
      S.swarm.group.visible = false;
    },

    puff: function (G) {
      S.puffs++;
      SFX.puff(1);
      var origin = S.smoker.localToWorld(S.smoker.userData.spout.clone());
      var dir = LAYOUT.entrance.clone().sub(origin);
      dir.y -= 0.02;
      dir.normalize();
      // ノズルが向いている方向も混ぜて，出口から素直に出るようにする
      var nd = S.smoker.userData.spoutDir.clone().transformDirection(S.smoker.matrixWorld);
      dir.lerp(nd, 0.12).normalize();
      G.smoke.puff(origin, dir, 1.0);
      S.calm = Math.min(1, S.calm + 1 / S.need);
      // 巣門に光の輪
      S.ring.userData.t = 0;
      G.camShake(0.0035);
    },

    update: function (G, dt) {
      var p = G.ptr;

      /* --- 入力：どこを押しても蛇腹が動く（4歳でも必ず成功する） --- */
      if (!S.done) {
        if (p.justDown) {
          S.pressGoal = 1; S.holdT = 0;
          Stages.smoker.puff(G);
        }
        if (p.down) {
          S.holdT += dt;
          if (S.holdT > 0.62) { S.holdT = 0; S.pressGoal = 1; Stages.smoker.puff(G); }
          if (S.holdT > 0.16) S.pressGoal = 0.25;
        }
        if (!p.down) S.pressGoal = 0;
      } else S.pressGoal = 0;

      S.press = U.damp(S.press, S.pressGoal, S.pressGoal > S.press ? 26 : 9, dt);
      S.bel.userData.rebuild(U.lerp(0.062, 0.021, S.press));
      // 押すと本体がわずかに沈む（重さの表現）
      S.smoker.position.y = 0.30 - S.press * 0.0035;

      /* --- 煙が消えぎわに巣門へ吸いこまれる --- */
      if (S.calm > 0.28) {
        G.smoke.wisp(LAYOUT.entrance.clone().add(new THREE.Vector3(0, 0.02, 0.03)), 4 * S.calm, dt);
      }

      /* --- ハチが落ちつく --- */
      S.swarm.calm = U.damp(S.swarm.calm, S.calm, 1.6, dt);
      S.swarm.update(dt, G.time);
      SFX.beeLoop(0.55 * (1 - S.swarm.calm * 0.92));

      /* --- 光の輪 --- */
      if (S.ring.userData.t != null) {
        S.ring.userData.t += dt;
        var t = S.ring.userData.t;
        if (t < 0.9) {
          var e = U.easeOut(t / 0.9);
          S.ring.scale.setScalar(0.35 + e * 1.5);
          S.ring.material.opacity = (1 - e) * 0.40;
        } else { S.ring.material.opacity = 0; S.ring.userData.t = null; }
      }

      /* --- 完了 --- */
      if (!S.done && S.calm >= 0.999 && S.swarm.calm > 0.93) {
        S.done = 1;
        Hint.clear();
        SFX.fanfare();
        G.sparkle.burst(LAYOUT.entrance.clone().add(new THREE.Vector3(0, 0.05, 0.02)), 22, 0.7, 0.05);
        setTimeout(function () { if (G.stage === 0) G.next(); }, 1250);
      }

      if (S.done) S.swarm.hidden = U.damp(S.swarm.hidden, 1, 3, dt);
    }
  };
})(window);
