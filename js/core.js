// NerikiriCore — ゲーム状態機械・切断ロジック・回転・進行（Agent-CORE 所有）
// CONTRACT.md の「Core API」「ゲーム状態」「tapAt の仕様」に準拠。
(function () {
  'use strict';

  function cfg() {
    return (typeof window !== 'undefined' && window.NCFG) ? window.NCFG : {};
  }

  function safeEmit(name, payload) {
    var bus = (typeof window !== 'undefined') ? window.NBus : null;
    if (bus && typeof bus.emit === 'function') {
      try { bus.emit(name, payload); } catch (e) { console.error('core emit error', name, e); }
    }
  }

  // 角度差を (-PI, PI] に正規化
  function normDiff(a) {
    var TWO_PI = Math.PI * 2;
    a = a % TWO_PI;
    if (a > Math.PI) a -= TWO_PI;
    if (a <= -Math.PI) a += TWO_PI;
    return a;
  }

  // target を current から見た最短方向の等価角へ変換
  function shortestEquivalent(target, current) {
    return current + normDiff(target - current);
  }

  function slotAngle(ring, slot) {
    return ring.offset + slot * (Math.PI * 2 / ring.n);
  }

  // ring 内の未カットスロットのうち、ワールド角(slotAngle+rotation)が
  // ANCHOR_ANGLE に最も近いものを返す。無ければ null。
  function pickAnchorHint(ring, rotation) {
    var C = cfg();
    var anchor = (C.ANCHOR_ANGLE != null) ? C.ANCHOR_ANGLE : Math.PI / 2;
    var best = -1, bestDist = Infinity, bestAngle = 0;
    for (var i = 0; i < ring.n; i++) {
      if (ring.cut[i]) continue;
      var sa = slotAngle(ring, i);
      var world = sa + rotation;
      var d = Math.abs(normDiff(world - anchor));
      if (d < bestDist) {
        bestDist = d;
        best = i;
        bestAngle = sa;
      }
    }
    if (best < 0) return null;
    return { slot: best, angle: bestAngle };
  }

  function buildState(themeIndex) {
    var C = cfg();
    var ringDefs = (C && C.RINGS) ? C.RINGS : [];
    var rings = [];
    for (var r = 0; r < ringDefs.length; r++) {
      var rd = ringDefs[r];
      var n = rd.n;
      var cut = new Array(n);
      var lift = new Array(n);
      for (var i = 0; i < n; i++) { cut[i] = false; lift[i] = 0; }
      rings.push({ r: rd.r, n: n, offset: rd.offset, cut: cut, lift: lift });
    }
    var need = (C && C.CENTER_TAPS != null) ? C.CENTER_TAPS : 3;
    return {
      phase: 'play',
      themeIndex: themeIndex || 0,
      time: 0,
      rotation: 0,
      rotationTarget: 0,
      activeRing: 0,
      rings: rings,
      center: { need: need, count: 0, squish: 0 },
      nextHint: null,
      revealT: 0,
    };
  }

  function create() {
    var state = buildState(0);
    var lastCutTime = -Infinity;
    var finishTimer = 0;
    var SQUISH_DECAY_SEC = 0.35;

    var game = {};

    game.state = state;

    game.update = function (dt) {
      if (typeof dt !== 'number' || !isFinite(dt) || dt < 0) dt = 0;
      var C = cfg();
      var TIMING = (C && C.TIMING) ? C.TIMING : {};

      state.time += dt;

      // --- lift: cut済みスロットを 0->1 へ ---
      var liftSec = TIMING.liftSec != null ? TIMING.liftSec : 0.55;
      if (liftSec <= 0) liftSec = 0.0001;
      for (var r = 0; r < state.rings.length; r++) {
        var ring = state.rings[r];
        for (var i = 0; i < ring.n; i++) {
          if (ring.cut[i] && ring.lift[i] < 1) {
            ring.lift[i] += dt / liftSec;
            if (ring.lift[i] > 1) ring.lift[i] = 1;
          }
        }
      }

      // --- rotation イージング ---
      var rotEase = TIMING.rotEase != null ? TIMING.rotEase : 4.5;
      var diff = state.rotationTarget - state.rotation;
      var factor = Math.min(1, Math.max(0, rotEase * dt));
      state.rotation += diff * factor;
      if (Math.abs(state.rotationTarget - state.rotation) < 1e-4) {
        state.rotation = state.rotationTarget;
      }

      // --- center squish 減衰 ---
      if (state.center.squish > 0) {
        state.center.squish -= dt / SQUISH_DECAY_SEC;
        if (state.center.squish < 0) state.center.squish = 0;
      }

      // --- phase 進行 ---
      if (state.phase === 'finishing') {
        finishTimer += dt;
        var finishSec = TIMING.finishSec != null ? TIMING.finishSec : 1.4;
        if (finishTimer >= finishSec) {
          state.phase = 'reveal';
          state.revealT = 0;
          safeEmit('phase:change', { phase: 'reveal' });
        }
      } else if (state.phase === 'reveal') {
        var revealSec = TIMING.revealSec != null ? TIMING.revealSec : 1.6;
        if (revealSec <= 0) revealSec = 0.0001;
        if (state.revealT < 1) {
          state.revealT += dt / revealSec;
          if (state.revealT > 1) state.revealT = 1;
        }
      }

      // --- nextHint 更新 ---
      if (state.phase !== 'play') {
        state.nextHint = null;
      } else if (state.activeRing === 0 || state.activeRing === 1) {
        var activeRingObj = state.rings[state.activeRing];
        var hint = activeRingObj ? pickAnchorHint(activeRingObj, state.rotation) : null;
        if (hint) {
          state.nextHint = {
            ringIndex: state.activeRing,
            slot: hint.slot,
            angle: hint.angle,
            radius: activeRingObj.r,
          };
        } else {
          state.nextHint = null;
        }
      } else if (state.activeRing === 2) {
        state.nextHint = { ringIndex: 2, slot: 0, angle: 0, radius: 0 };
      } else {
        state.nextHint = null;
      }
    };

    game.tapAt = function (localAngle, localRadius, screenX, screenY) {
      var C = cfg();
      var TIMING = (C && C.TIMING) ? C.TIMING : {};

      if (state.phase !== 'play') return false;

      var cooldown = TIMING.cutCooldown != null ? TIMING.cutCooldown : 0.18;
      if (state.time - lastCutTime < cooldown) return false;

      if (localRadius > 1.55) {
        safeEmit('cut:miss', { x: screenX, y: screenY });
        return false;
      }

      if (state.activeRing === 0 || state.activeRing === 1) {
        var ring = state.rings[state.activeRing];
        if (!ring) return false;

        var best = -1, bestDist = Infinity;
        for (var i = 0; i < ring.n; i++) {
          if (ring.cut[i]) continue;
          var sa = slotAngle(ring, i);
          var d = Math.abs(normDiff(localAngle - sa));
          if (d < bestDist) { bestDist = d; best = i; }
        }
        if (best < 0) return false; // このリングは既に全カット済み(通常は起きない)

        ring.cut[best] = true;
        var cutAngle = slotAngle(ring, best);
        lastCutTime = state.time;

        safeEmit('cut:done', {
          ringIndex: state.activeRing,
          slot: best,
          angle: cutAngle,
          radius: ring.r,
        });

        var anyUncut = false;
        for (var j = 0; j < ring.n; j++) {
          if (!ring.cut[j]) { anyUncut = true; break; }
        }

        if (anyUncut) {
          var hint = pickAnchorHint(ring, state.rotation);
          if (hint) {
            var anchor = (C && C.ANCHOR_ANGLE != null) ? C.ANCHOR_ANGLE : Math.PI / 2;
            var rawTarget = anchor - hint.angle;
            state.rotationTarget = shortestEquivalent(rawTarget, state.rotation);
          }
        } else {
          safeEmit('ring:complete', { ringIndex: state.activeRing });
          state.activeRing++;
        }

        return true;
      }

      if (state.activeRing === 2) {
        if (localRadius < 0.9) {
          state.center.count++;
          state.center.squish = 1;
          lastCutTime = state.time;
          safeEmit('center:press', { count: state.center.count, need: state.center.need });
          if (state.center.count >= state.center.need) {
            safeEmit('flower:complete', {});
            state.phase = 'finishing';
            finishTimer = 0;
            safeEmit('phase:change', { phase: 'finishing' });
          }
          return true;
        }
        safeEmit('cut:miss', { x: screenX, y: screenY });
        return false;
      }

      return false;
    };

    game.reset = function (themeIndex) {
      var idx = (typeof themeIndex === 'number') ? themeIndex : state.themeIndex;
      state = buildState(idx);
      lastCutTime = -Infinity;
      finishTimer = 0;
      game.state = state;
      safeEmit('phase:change', { phase: 'play' });
    };

    return game;
  }

  window.NerikiriCore = { create: create };
})();
