/* ゲーム進行・カメラ・入力・演出 */
(function (root) {
  'use strict';
  var DD = (root.DD = root.DD || {});
  var m4 = DD.m4, U = DD.util, W = DD.W, G = DD.geom;

  var PH = {
    APPROACH: 0, GATE_CLOSE: 1, PUMP: 2, EXPOSED: 3, FLOOD: 4, GATE_OPEN: 5, DEPART: 6
  };

  var SHIP_DOCK_X = 4;        // 入渠完了位置
  var SHIP_START_X = -262;
  var GATE_OPEN = Math.PI;        // 倒伏（水路に寝ている）
  var GATE_CLOSED = Math.PI * 0.5; // 起立（閉鎖）
  var LEVER = { x: -60, y: W.COPING_Y + 0.42, z: W.TOP_HW + 4.2, yaw: 0 };

  function Game(renderer, audio) {
    this.R = renderer;
    this.A = audio;
    this.P = new DD.Particles(1400);
    this.reset(true);
  }

  Game.prototype.reset = function (full) {
    this.phase = PH.APPROACH;
    this.phaseT = 0;
    this.st = {
      time: 0,
      waterLevel: W.SEA_Y,
      wetLevel: W.SEA_Y,
      wetAmount: 1.0,
      wetLen: 6.0,
      shipX: SHIP_START_X,
      shipY: W.SHIP_FLOAT_Y,
      shipPitch: 0,
      shipRoll: 0,
      propAngle: 0,
      rudderAngle: 0,
      gateAngle: GATE_OPEN,
      lever: LEVER,
      leverTilt: -0.55,
      tugX: SHIP_START_X - 128,
      tugZ: 12,
      tugYaw: 0,
      tugVisible: true,
      vortices: [
        { x: -96, z: 17, w: 0 },
        { x: 96, z: 17, w: 0 },
        { x: 0, z: 0, w: 0 },
        { x: 0, z: 0, w: 0 }
      ],
      dockChop: 0.55,
      puddle: 0,
      foamBoost: 0,
      fade: 1,
      propTint: [1, 1, 1],
      hint: { x: 0, y: 0, z: 0, size: 6, kind: 0, opacity: 0 }
    };
    this.pumpSet = 0;          // 0 = 満水, 1 = 空
    this.pumpVel = 0;
    this.landed = false;
    this.landTimer = 0;
    this.idle = 0;
    this.exposedT = 0;
    this.propSpeed = 0;
    this.washAmount = 0;
    this.washActive = 0;
    this.hintTimer = 0;
    this.hintIndex = 0;
    this.drag = null;
    this.camState = null;
    this.gateSound = false;
    this.gateClosing = false;
    this.hornDone = false;
    this.approachBoost = 0;
    this.emitAcc = { wall: 0, sump: 0, hull: 0, out: 0, mist: 0, gate: 0 };
    this.prevLevel = this.st.waterLevel;
    if (full && this.R) this.R.clearWash();
    if (this.R) this.R.clearWash();
  };

  /* ---------------- 更新 ---------------- */
  Game.prototype.update = function (dt, aspect) {
    dt = Math.min(dt, 0.05);
    var st = this.st;
    st.time += dt;
    this.phaseT += dt;
    this.idle += dt;
    this.prevLevel = st.waterLevel;

    switch (this.phase) {
      case PH.APPROACH: this.updApproach(dt); break;
      case PH.GATE_CLOSE: this.updGateClose(dt); break;
      case PH.PUMP: this.updPump(dt); break;
      case PH.EXPOSED: this.updExposed(dt); break;
      case PH.FLOOD: this.updFlood(dt); break;
      case PH.GATE_OPEN: this.updGateOpen(dt); break;
      case PH.DEPART: this.updDepart(dt); break;
    }

    this.updWater(dt);
    this.updShip(dt);
    this.updProp(dt);
    this.updHint(dt);
    this.emit(dt);
    this.P.update(dt);
    this.updAudio(dt);
    this.updCamera(dt, aspect);
    if (this.A) this.A.update(dt);
  };

  /* --- 各フェーズ --- */
  Game.prototype.updApproach = function (dt) {
    var st = this.st;
    // 放置しても待ちすぎないよう、時間とともに少しずつ加速する
    var patience = 1.0 + U.smoothstep(9, 26, this.phaseT) * 1.3;
    var speed = (5.4 + this.approachBoost) * patience;
    this.approachBoost = Math.max(0, this.approachBoost - dt * 0.7);
    var d = SHIP_DOCK_X - st.shipX;
    var v = Math.min(speed, 0.55 + Math.abs(d) * 0.12);
    st.shipX += v * dt;
    st.tugX = st.shipX - 128;
    st.shipRoll = Math.sin(st.time * 0.55) * 0.006 + Math.sin(st.time * 0.31) * 0.004;
    st.shipPitch = Math.sin(st.time * 0.42) * 0.003;
    if (d < 0.6) {
      st.shipX = SHIP_DOCK_X;
      this.setPhase(PH.GATE_CLOSE);
    }
  };

  Game.prototype.updGateClose = function (dt) {
    var st = this.st;
    // ゲートの見通しを塞がないよう、タグは速やかに退場する
    st.tugX -= dt * 16;
    st.tugZ = U.approach(st.tugZ, 18, 0.8, dt);
    st.tugVisible = this.phaseT < 2.5;
    st.shipRoll = U.approach(st.shipRoll, 0, 0.7, dt);
    st.shipPitch = U.approach(st.shipPitch, 0, 0.7, dt);
    if (this.gateClosing) {
      var d = st.gateAngle - GATE_CLOSED;
      var v = Math.min(0.19, 0.030 + d * 0.45);
      st.gateAngle = Math.max(GATE_CLOSED, st.gateAngle - v * dt);
      st.foamBoost = 0.55;
      if (st.gateAngle <= GATE_CLOSED + 0.0015) {
        st.gateAngle = GATE_CLOSED;
        if (this.A) { this.A.clank(); this.A.chime(false); }
        this.setPhase(PH.PUMP);
        st.foamBoost = 0;
      }
    } else if (this.phaseT > 7.0) {
      this.startGateClose();
    }
  };

  Game.prototype.startGateClose = function () {
    if (this.gateClosing) return;
    this.gateClosing = true;
    if (this.A) this.A.gate();
  };

  Game.prototype.updPump = function (dt) {
    var st = this.st;
    st.tugVisible = false;
    // 放置しても進むようにゆっくり自動排水（触っている間は邪魔しない）
    if (this.idle > 9.0) this.pumpSet = Math.min(1, this.pumpSet + dt / 40);
    if (st.waterLevel < 0.09 && this.pumpSet > 0.985) {
      this.landTimer += dt;
      if (this.landTimer > 2.4) this.setPhase(PH.EXPOSED);
    } else this.landTimer = 0;
  };

  Game.prototype.updExposed = function (dt) {
    var st = this.st;
    st.tugVisible = false;
    this.exposedT += dt;
    // レバーを戻したら注水へ
    if (this.pumpSet < 0.80) { this.setPhase(PH.FLOOD); return; }
    if (this.exposedT > 70 && this.idle > 14) {
      this.pumpSet = Math.max(0, this.pumpSet - dt / 20);
      if (this.pumpSet < 0.80) this.setPhase(PH.FLOOD);
    }
  };

  Game.prototype.updFlood = function (dt) {
    var st = this.st;
    st.tugVisible = false;
    if (this.idle > 9.0) this.pumpSet = Math.max(0, this.pumpSet - dt / 30);
    // もう一度抜きたくなったら排水へ戻れる
    if (this.pumpSet > 0.90 && st.waterLevel < W.LAND_LEVEL) { this.setPhase(PH.PUMP); return; }
    if (st.waterLevel > W.SEA_Y - 0.07 && this.pumpSet < 0.012) {
      this.setPhase(PH.GATE_OPEN);
    }
  };

  Game.prototype.updGateOpen = function (dt) {
    var st = this.st;
    st.tugVisible = false;
    if (this.phaseT > 1.2) {
      if (!this.gateSound) { this.gateSound = true; if (this.A) this.A.gate(); }
      var d = GATE_OPEN - st.gateAngle;
      var v = Math.min(0.19, 0.030 + d * 0.45);
      st.gateAngle = Math.min(GATE_OPEN, st.gateAngle + v * dt);
      if (st.gateAngle >= GATE_OPEN - 0.0015) {
        st.gateAngle = GATE_OPEN;
        this.setPhase(PH.DEPART);
      }
    }
  };

  Game.prototype.updDepart = function (dt) {
    var st = this.st;
    if (!this.hornDone && this.phaseT > 0.5) { this.hornDone = true; if (this.A) this.A.horn(); }
    st.tugVisible = true;
    if (this.phaseT < 0.05) st.tugX = W.SHORE_X - 30;
    var t = Math.max(0, this.phaseT - 2.0);
    var v = Math.min(3.4, 0.35 + t * 0.55);
    st.shipX -= v * dt;
    st.tugX = st.shipX - 116;
    st.tugZ = U.approach(st.tugZ, 15, 0.6, dt);
    st.shipRoll = Math.sin(st.time * 0.55) * 0.006 * Math.min(1, t * 0.3);
    if (st.shipX < -300) {
      st.fade = Math.max(0, st.fade - dt * 0.75);
      if (st.fade <= 0.001) {
        var self = this;
        this.reset(true);
        this.st.fade = 0;
        this.fadingIn = true;
      }
    }
    if (st.shipX < -140) st.tugVisible = true;
  };

  Game.prototype.setPhase = function (p) {
    this.phase = p;
    this.phaseT = 0;
    this.hintTimer = 0;
    this.idle = 0;
    if (p === PH.EXPOSED) {
      this.exposedT = 0;
      if (this.A) this.A.chime(true);
    }
    if (p === PH.PUMP) { this.pumpSet = Math.max(this.pumpSet, 0.0); }
    if (p === PH.GATE_OPEN) this.gateSound = false;
  };

  /* --- 水位 --- */
  Game.prototype.updWater = function (dt) {
    var st = this.st;
    if (this.fadingIn) {
      st.fade = Math.min(1, st.fade + dt * 0.8);
      if (st.fade >= 1) this.fadingIn = false;
    }
    var target = U.lerp(W.SEA_Y, 0.055, this.pumpSet);
    var diff = target - st.waterLevel;
    var maxRate = 0.66;                  // ポンプの最大流量に相当
    var rate = U.clamp(diff * 1.6, -maxRate, maxRate);
    // 動き出しの慣性
    this.pumpVel = U.approach(this.pumpVel, rate, 2.2, dt);
    st.waterLevel += this.pumpVel * dt;
    st.waterLevel = U.clamp(st.waterLevel, 0.05, W.SEA_Y);

    var draining = this.pumpVel < -0.02;
    var filling = this.pumpVel > 0.02;

    // 濡れ表現：水面直下ほど濡れ、上ほど乾く
    st.wetLevel = st.waterLevel;
    if (draining || filling) {
      st.wetAmount = U.approach(st.wetAmount, 1.0, 2.0, dt);
      st.wetLen = U.approach(st.wetLen, 5.5, 0.9, dt);
    } else {
      st.wetAmount = U.approach(st.wetAmount, 0.42, 0.055, dt);
      st.wetLen = U.approach(st.wetLen, 2.2, 0.05, dt);
    }

    // 水たまりへの分裂
    st.puddle = U.smoothstep(0.85, 0.10, st.waterLevel) * 0.80;
    // 内水面の波立ち
    var targetChop = 0.20 + (draining ? 0.55 : 0) + (filling ? 1.0 : 0);
    st.dockChop = U.approach(st.dockChop, targetChop, 1.2, dt);
    st.foamBoost = U.approach(st.foamBoost, filling ? 0.8 : (draining ? 0.25 : 0.0), 1.5, dt);

    // 排水渦（水位が下がるほど強く）
    var vs = 0;
    if (draining) vs = U.smoothstep(7.5, 1.2, st.waterLevel) * U.smoothstep(0.06, 0.35, st.waterLevel);
    this.vortexStrength = U.approach(this.vortexStrength || 0, vs, 1.6, dt);
    st.vortices[0].w = this.vortexStrength;
    st.vortices[1].w = this.vortexStrength * 0.85;
    // 注水時はゲート際が荒れる
    st.vortices[2].x = W.DOCK_X0 + 9; st.vortices[2].z = -9;
    st.vortices[3].x = W.DOCK_X0 + 9; st.vortices[3].z = 9;
    var gv = filling ? U.smoothstep(0.4, 3.0, st.waterLevel) * 0.9 : 0;
    this.gateVortex = U.approach(this.gateVortex || 0, gv, 2.0, dt);
    st.vortices[2].w = this.gateVortex;
    st.vortices[3].w = this.gateVortex;

    st.leverTilt = U.approach(st.leverTilt, U.lerp(-0.55, 0.95, this.pumpSet), 8, dt);
  };

  /* --- 船の浮沈 --- */
  Game.prototype.updShip = function (dt) {
    var st = this.st;
    var floatY = st.waterLevel - W.SHIP_DRAFT;
    var y = Math.max(W.SHIP_LAND_Y, floatY);
    var wasLanded = this.landed;
    this.landed = floatY <= W.SHIP_LAND_Y + 0.002;
    if (this.phase >= PH.PUMP && this.phase <= PH.FLOOD) {
      st.shipY = U.approach(st.shipY, y, 6.0, dt);
      if (this.landed && !wasLanded && this.pumpVel < 0) {
        if (this.A) { this.A.thud(1.0); }
        this.landEvent = 1.0;
        this.landDust = 26;
      }
      if (!this.landed && wasLanded) {
        if (this.A) this.A.splash(0.7);
        this.floatEvent = 1.0;
      }
      // 着底直後のわずかな沈み込み
      if (this.landed) {
        this.settle = U.approach(this.settle || 0, 0, 1.4, dt);
        st.shipRoll = U.approach(st.shipRoll, 0, 3.0, dt);
        st.shipPitch = U.approach(st.shipPitch, 0, 3.0, dt);
      } else {
        var amp = U.smoothstep(W.SHIP_LAND_Y, W.SHIP_LAND_Y + 3.5, floatY);
        st.shipRoll = Math.sin(st.time * 0.62) * 0.0045 * amp + Math.sin(st.time * 0.29) * 0.003 * amp;
        st.shipPitch = Math.sin(st.time * 0.44) * 0.0022 * amp;
      }
    } else {
      st.shipY = U.approach(st.shipY, W.SHIP_FLOAT_Y, 4.0, dt);
    }
    this.landEvent = Math.max(0, (this.landEvent || 0) - dt * 1.4);
  };

  Game.prototype.updProp = function (dt) {
    var st = this.st;
    this.propSpeed *= Math.exp(-0.55 * dt);
    if (Math.abs(this.propSpeed) < 0.002) this.propSpeed = 0;
    st.propAngle += this.propSpeed * dt;
    st.rudderAngle = U.approach(st.rudderAngle, 0, 0.07, dt);
    this.washActive = Math.max(0, this.washActive - dt * 3.5);
  };

  /* --- ヒント（文字なしの指示） --- */
  Game.prototype.updHint = function (dt) {
    var st = this.st, h = st.hint;
    this.hintTimer += dt;
    var show = false, kind = 0, pos = [0, 0, 0], size = 8;

    if (this.phase === PH.GATE_CLOSE && !this.gateClosing) {
      show = this.idle > 1.0; kind = 0;
      pos = [W.GATE_X - 3, W.SEA_Y + 4.5, 0];
      size = 9;
    } else if (this.phase === PH.PUMP || this.phase === PH.FLOOD) {
      show = this.idle > 2.6; kind = 1;
      pos = this.leverKnob();
      pos[1] += 1.4;
      size = 3.4;
    } else if (this.phase === PH.EXPOSED) {
      show = this.idle > 3.2;
      var cyc = Math.floor(this.hintTimer / 4.2) % 4;
      if (cyc === 0) { kind = 2; pos = this.propWorld(); size = 6.2; }
      else if (cyc === 1) { kind = 3; pos = this.rudderWorld(); size = 5.0; }
      else if (cyc === 2) { kind = 4; pos = this.hullWashPoint(); size = 6.0; }
      else { kind = 1; pos = this.leverKnob(); pos[1] += 1.4; size = 3.4; }
    } else if (this.phase === PH.APPROACH && this.phaseT > 6) {
      show = false;
    }

    h.kind = kind;
    if (show) {
      h.x = pos[0]; h.y = pos[1]; h.z = pos[2]; h.size = size;
    }
    h.opacity = U.approach(h.opacity, show ? 0.9 : 0, 3.5, dt);
  };

  Game.prototype.leverKnob = function () {
    var st = this.st;
    var t = st.leverTilt;
    return [LEVER.x, LEVER.y + 1.15 + Math.cos(t) * 2.1, LEVER.z + Math.sin(t) * 2.1];
  };
  Game.prototype.propWorld = function () {
    var st = this.st;
    return [st.shipX + W.PROP_X, st.shipY + W.PROP_Y, 0];
  };
  Game.prototype.rudderWorld = function () {
    var st = this.st;
    return [st.shipX + W.RUDDER_X, st.shipY + 4.4, 0];
  };
  Game.prototype.hullWashPoint = function () {
    var st = this.st;
    var t = 0.42;
    var s = [0, 0, 0];
    G.hullSection(t, 0.18, s);
    return [st.shipX + s[0], st.shipY + s[1], s[2] + 0.6];
  };

  /* ---------------- パーティクル生成 ---------------- */
  Game.prototype.emit = function (dt) {
    var st = this.st, P = this.P, E = this.emitAcc;
    var lvl = st.waterLevel;
    var draining = this.pumpVel < -0.03;
    var filling = this.pumpVel > 0.03;
    var HW = W.DOCK_HW;

    function rr(a, b) { return a + (b - a) * Math.random(); }

    // 渦のしぶき
    if (this.vortexStrength > 0.05) {
      E.sump += dt * 70 * this.vortexStrength;
      while (E.sump > 1) {
        E.sump -= 1;
        var vi = Math.random() < 0.5 ? 0 : 1;
        var v = st.vortices[vi];
        var a = Math.random() * 6.2832, r = rr(0.4, 4.0);
        P.spawn({
          x: v.x + Math.cos(a) * r, y: lvl + rr(-0.2, 0.4), z: v.z + Math.sin(a) * r,
          vx: -Math.sin(a) * rr(1.5, 5) + Math.cos(a) * -1.5,
          vy: rr(0.4, 3.4),
          vz: Math.cos(a) * rr(1.5, 5) + Math.sin(a) * -1.5,
          life: rr(0.5, 1.4), size: rr(0.10, 0.30), size1: rr(0.05, 0.14),
          kind: 0, r: 0.95, g: 1.0, b: 1.0, drag: 1.1, grav: 9.8, floorY: -2
        });
      }
      E.mist += dt * 16 * this.vortexStrength;
      while (E.mist > 1) {
        E.mist -= 1;
        var vi2 = Math.random() < 0.5 ? 0 : 1;
        var v2 = st.vortices[vi2];
        P.spawn({
          x: v2.x + rr(-5, 5), y: lvl + rr(0, 1.2), z: v2.z + rr(-4, 4),
          vx: rr(-0.6, 0.6), vy: rr(0.3, 1.2), vz: rr(-0.6, 0.6),
          life: rr(1.6, 3.4), size: rr(1.2, 2.6), size1: rr(3.5, 7.0),
          kind: 1, r: 0.92, g: 0.96, b: 0.98, drag: 0.8, grav: -0.4
        });
      }
    }

    // 壁を伝う水の筋
    if (draining && lvl > 0.3) {
      E.wall += dt * 40;
      while (E.wall > 1) {
        E.wall -= 1;
        var side = Math.random() < 0.5 ? 1 : -1;
        var hw = HW + (lvl > 9 ? 3.0 : lvl > 4.6 ? 1.5 : 0) - 0.25;
        var x = rr(W.DOCK_X0 + 4, W.DOCK_X1 - 4);
        var y0 = lvl + rr(0.2, 4.5);
        P.spawn({
          x: x, y: y0, z: side * hw,
          vx: 0, vy: rr(-1.5, -0.2), vz: side * -0.15,
          life: rr(0.5, 1.5), size: rr(0.07, 0.16), size1: rr(0.04, 0.09),
          kind: 0, r: 0.9, g: 0.95, b: 0.98, drag: 0.15, grav: 9.8, floorY: lvl - 0.1
        });
      }
    }

    // 船体から滴る水
    if (lvl < W.SHIP_DRAFT + W.SHIP_LAND_Y && this.phase >= PH.PUMP && this.phase <= PH.EXPOSED) {
      var wetness = st.wetAmount;
      E.hull += dt * 46 * wetness;
      while (E.hull > 1) {
        E.hull -= 1;
        var t = rr(0.06, 0.94);
        var vn = rr(0.02, 0.55);
        var sec = [0, 0, 0];
        G.hullSection(t, vn, sec);
        var sgn = Math.random() < 0.5 ? 1 : -1;
        var wy = st.shipY + sec[1];
        if (wy < lvl) continue;
        P.spawn({
          x: st.shipX + sec[0], y: wy, z: sec[2] * sgn,
          vx: rr(-0.1, 0.1), vy: rr(-0.6, 0), vz: sgn * rr(0.0, 0.35),
          life: rr(0.7, 1.9), size: rr(0.06, 0.14), size1: rr(0.03, 0.07),
          kind: 0, r: 0.92, g: 0.96, b: 0.98, drag: 0.1, grav: 9.8, floorY: -0.4
        });
      }
    }

    // ポンプ吐出（外海へ）
    if (draining) {
      E.out += dt * 90;
      var ox = W.SHORE_X - 12.5, oy = W.SEA_Y + 2.6;
      var oz = (Math.random() < 0.5 ? -W.TOP_HW - 9 : -W.TOP_HW - 13.2);
      while (E.out > 1) {
        E.out -= 1;
        P.spawn({
          x: ox + rr(-1.0, 1.0), y: oy + rr(-1.3, 1.3), z: oz + rr(-1.3, 1.3),
          vx: rr(-14, -9), vy: rr(-1.0, 1.0), vz: rr(-1.0, 1.0),
          life: rr(0.5, 1.1), size: rr(0.2, 0.6), size1: rr(0.5, 1.4),
          kind: Math.random() < 0.35 ? 1 : 0, r: 0.9, g: 0.95, b: 0.97, drag: 0.6, grav: 9.8, floorY: W.SEA_Y - 0.2
        });
      }
    }

    // ゲートが水面を割って立ち上がるときの水膜としぶき
    if (this.gateClosing && this.phase === PH.GATE_CLOSE) {
      var ga = st.gateAngle;
      var tipX = W.GATE_X + 14.8 * Math.cos(ga);
      var tipY = W.SILL_Y + 0.05 + 14.8 * Math.sin(ga);
      E.gaterise = (E.gaterise || 0) + dt * 320;
      while (E.gaterise > 1) {
        E.gaterise -= 1;
        var gz = rr(-23, 23);
        var above = tipY > W.SEA_Y - 1.5;
        P.spawn({
          x: tipX + rr(-1.6, 1.6), y: Math.min(tipY, W.SEA_Y) + rr(-0.6, 1.4), z: gz,
          vx: rr(-3.5, -0.5), vy: above ? rr(-1.5, 1.2) : rr(0.2, 2.6), vz: rr(-1.2, 1.2),
          life: rr(0.5, 1.5), size: rr(0.12, 0.45), size1: rr(0.35, 1.2),
          kind: Math.random() < 0.45 ? 1 : 0, r: 0.94, g: 0.97, b: 0.99,
          drag: 1.1, grav: 9.8, floorY: W.SEA_Y - 1.0
        });
      }
    }

    // 注水時のゲート際の激流
    if (filling) {
      E.gate += dt * 110;
      while (E.gate > 1) {
        E.gate -= 1;
        var gz = rr(-16, 16);
        P.spawn({
          x: W.DOCK_X0 + rr(1, 12), y: lvl + rr(-0.3, 1.2), z: gz,
          vx: rr(2, 11), vy: rr(0.5, 3.2), vz: rr(-1.5, 1.5),
          life: rr(0.6, 1.6), size: rr(0.12, 0.4), size1: rr(0.3, 1.0),
          kind: Math.random() < 0.5 ? 1 : 0, r: 0.93, g: 0.97, b: 0.98, drag: 1.0, grav: 9.8, floorY: lvl - 0.5
        });
      }
    }

    // 着底時の粉塵
    if (this.landDust > 0) {
      var n = Math.min(this.landDust, Math.ceil(dt * 90));
      this.landDust -= n;
      for (var i = 0; i < n; i++) {
        var bx = rr(-80, 80);
        P.spawn({
          x: bx, y: W.BLOCK_TOP - 0.4, z: rr(-3, 3),
          vx: rr(-3, 3), vy: rr(0.4, 2.2), vz: rr(-3, 3),
          life: rr(1.5, 3.2), size: rr(0.8, 1.8), size1: rr(3, 6),
          kind: 1, r: 0.75, g: 0.71, b: 0.62, drag: 1.2, grav: -0.2
        });
      }
    }

    // 洗浄の飛沫
    if (this.washActive > 0.05 && this.washPoint) {
      E.wash = (E.wash || 0) + dt * 130 * this.washActive;
      while (E.wash > 1) {
        E.wash -= 1;
        var wp = this.washPoint;
        P.spawn({
          x: wp[0] + rr(-0.5, 0.5), y: wp[1] + rr(-0.5, 0.5), z: wp[2] + rr(-0.5, 0.5),
          vx: rr(-4, 4), vy: rr(-2, 4), vz: rr(-4, 4) + Math.sign(wp[2]) * 4,
          life: rr(0.3, 0.9), size: rr(0.08, 0.24), size1: rr(0.2, 0.6),
          kind: Math.random() < 0.5 ? 1 : 0, r: 0.95, g: 0.98, b: 1.0, drag: 1.5, grav: 9.8, floorY: -0.4
        });
      }
    }

    // プロペラから飛ぶ水滴
    if (Math.abs(this.propSpeed) > 0.8 && st.wetAmount > 0.45) {
      var cnt = Math.ceil(dt * 40 * Math.min(1, Math.abs(this.propSpeed) / 4));
      var pw = this.propWorld();
      for (var k = 0; k < cnt; k++) {
        var ang = Math.random() * 6.2832;
        var rr2 = rr(1.5, W.PROP_R);
        var tanv = this.propSpeed * rr2 * 0.55;
        P.spawn({
          x: pw[0] + rr(-0.6, 0.6), y: pw[1] + Math.cos(ang) * rr2, z: pw[2] + Math.sin(ang) * rr2,
          vx: rr(-1, 1), vy: -Math.sin(ang) * tanv, vz: Math.cos(ang) * tanv,
          life: rr(0.4, 1.1), size: rr(0.06, 0.14), size1: rr(0.03, 0.08),
          kind: 0, r: 0.94, g: 0.97, b: 0.99, drag: 0.5, grav: 9.8, floorY: -0.4
        });
      }
    }
  };

  /* ---------------- 音 ---------------- */
  Game.prototype.updAudio = function (dt) {
    if (!this.A || !this.A.ready) return;
    var st = this.st;
    var pumping = Math.abs(this.pumpVel) > 0.02;
    var pv = Math.min(1, Math.abs(this.pumpVel) / 0.66);
    this.A.setPump(this.phase >= PH.PUMP && this.phase <= PH.FLOOD ? (0.22 + pv * 0.78) : 0);
    this.A.setFlow(pumping ? (0.35 + pv * 0.65) : 0, U.clamp(1 - st.waterLevel / W.SEA_Y, 0, 1));
    this.A.setProp(this.propSpeed);
    this.A.setWash(this.washActive);
  };

  /* ---------------- カメラ ----------------
     フェーズごとに eye / target を実座標で与える。
     ドックの近側壁（天端 y=16, z=23.2）に視線が遮られないことを前提に配置する。 */
  function key(ex, ey, ez, tx, ty, tz) { return { ex: ex, ey: ey, ez: ez, tx: tx, ty: ty, tz: tz }; }
  function mixKey(a, b, t) {
    return key(
      U.lerp(a.ex, b.ex, t), U.lerp(a.ey, b.ey, t), U.lerp(a.ez, b.ez, t),
      U.lerp(a.tx, b.tx, t), U.lerp(a.ty, b.ty, t), U.lerp(a.tz, b.tz, t));
  }

  Game.prototype.updCamera = function (dt, aspect) {
    var st = this.st;
    var c = this.camTarget(aspect);
    if (!this.camState) {
      this.camState = { ex: c.ex, ey: c.ey, ez: c.ez, tx: c.tx, ty: c.ty, tz: c.tz, fov: c.fov };
    }
    var s = this.camState;
    var k = 1.05;
    s.ex = U.approach(s.ex, c.ex, k, dt);
    s.ey = U.approach(s.ey, c.ey, k, dt);
    s.ez = U.approach(s.ez, c.ez, k, dt);
    s.tx = U.approach(s.tx, c.tx, k * 1.15, dt);
    s.ty = U.approach(s.ty, c.ty, k * 1.15, dt);
    s.tz = U.approach(s.tz, c.tz, k * 1.15, dt);
    s.fov = U.approach(s.fov, c.fov, k, dt);

    // 手持ちのような微かな揺れ（視差が生まれる）
    var t = st.time;
    this.camNudgeAz = U.approach(this.camNudgeAz || 0, 0, 0.5, dt);
    this.camNudgeEl = U.approach(this.camNudgeEl || 0, 0, 0.5, dt);
    var a = Math.sin(t * 0.071) * 0.017 + Math.sin(t * 0.0293) * 0.011 + (this.camNudgeAz || 0);
    var dx = s.ex - s.tx, dz = s.ez - s.tz;
    var ca = Math.cos(a), sa = Math.sin(a);
    var ex = s.tx + dx * ca + dz * sa;
    var ez = s.tz - dx * sa + dz * ca;
    var rise = Math.hypot(dx, dz) * ((this.camNudgeEl || 0) * 0.55);
    var ey = s.ey + Math.sin(t * 0.0517) * 0.9 + Math.sin(t * 0.0213) * 0.6 + rise;
    if (ey < 2.0) ey = 2.0;
    this.camera = { eye: [ex, ey, ez], target: [s.tx, s.ty, s.tz], fov: s.fov };
  };

  Game.prototype.camTarget = function (aspect) {
    var st = this.st;
    var k;
    switch (this.phase) {
      case PH.APPROACH: {
        // 前半はドックの中から、開いた入口越しに近づく船を見る。
        // 船が入ってくる前に、脇から全体を見る位置へ移る。
        var p = U.smoothstep(-236, -178, st.shipX);
        var inside = key(-58, 25, 13, -205, 11.5, 0);
        var side = key(-124, 33, 35, -34, 10, 2);
        k = mixKey(inside, side, p);
        break;
      }
      case PH.GATE_CLOSE:
        k = key(-176, 15.5, 11, -123, 12, 0);   // 水面すれすれから、起き上がるゲートを見る
        break;
      case PH.PUMP:
      case PH.FLOOD: {
        var q = U.clamp(1 - st.waterLevel / W.SEA_Y, 0, 1);
        var k0 = key(-113, 38, 36, -30, 11.5, 3);
        var k1 = key(-118, 27, 25, -26, 8.0, 3);
        var k2 = key(-108, 19, 18, -20, 5.0, 3);
        var qq = U.smoothstep(0.02, 1.0, q);
        k = qq < 0.55 ? mixKey(k0, k1, qq / 0.55) : mixKey(k1, k2, (qq - 0.55) / 0.45);
        break;
      }
      case PH.EXPOSED: {
        var mode = this.focus || 0;
        if (mode === 1) {           // プロペラ
          k = key(st.shipX + W.PROP_X - 21, 7.6, 20.0, st.shipX + W.PROP_X + 3, 5.2, -1);
        } else if (mode === 2) {    // 舵
          k = key(st.shipX + W.RUDDER_X - 19, 8.0, 17.0, st.shipX + W.RUDDER_X + 1, 5.6, 0);
        } else if (mode === 3) {    // 船底洗浄
          var wx = this.washFocusX === undefined ? st.shipX - 30 : this.washFocusX;
          wx = U.clamp(wx, W.DOCK_X0 + 28, W.DOCK_X1 - 62);
          k = key(wx + 48, 15.0, 26.0, wx - 10, 6.2, 1);
        } else {
          var sw = Math.sin(this.exposedT * 0.042) * 0.5 + 0.5;
          var lo = key(-108, 7.0, 13.0, -56, 8.0, 0);      // 船尾を見上げる
          var hi = key(-100, 20, 18, -18, 5.0, 3);         // 引いて全体を見る
          k = mixKey(lo, hi, sw);
        }
        break;
      }
      case PH.GATE_OPEN:
        k = key(-178, 15.5, 12, -123, 12, 0);
        break;
      case PH.DEPART:
        k = key(62, 32, 22, Math.max(-240, st.shipX - 30), 11, 0);
        break;
      default:
        k = key(-118, 27, 25, -26, 8.0, 3);
    }

    // 縦持ち対応：少しだけ引いて、画角を広げる。
    // 引きすぎるとゲートや壁の中に入ってしまうので、安全な範囲へ寄せ戻す。
    var fov = 0.60;
    if (aspect < 1.0) {
      var inv = 1 / Math.max(aspect, 0.34);
      var ds = U.clamp(Math.pow(inv, 0.34), 1, 1.30);
      fov = 0.60 * U.clamp(1 + (inv - 1) * 0.55, 1, 1.50);
      k = key(
        k.tx + (k.ex - k.tx) * ds, k.ty + (k.ey - k.ty) * ds, k.tz + (k.ez - k.tz) * ds,
        k.tx, k.ty, k.tz);
    } else if (aspect > 2.0) {
      fov = 0.60 * 0.92;
    }
    // 排水中はドックの中に留まる（壁やゲートの内側に入り込まないように）
    if (this.phase >= PH.PUMP && this.phase <= PH.FLOOD) {
      k.ex = U.clamp(k.ex, -113, 100);
      k.ez = U.clamp(k.ez, -44, 44);
    }
    if (k.ey < 3.5) k.ey = 3.5;
    k.fov = fov;
    return k;
  };

  /* ---------------- 入力 ---------------- */
  Game.prototype.screenRay = function (ndcX, ndcY) {
    var R = this.R;
    var p0 = [0, 0, 0], p1 = [0, 0, 0];
    var a = new Float32Array([ndcX, ndcY, -1]);
    var b = new Float32Array([ndcX, ndcY, 1]);
    m4.transformPoint(p0, R.invViewProj, a);
    m4.transformPoint(p1, R.invViewProj, b);
    var d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    var l = Math.hypot(d[0], d[1], d[2]) || 1;
    return { o: p0, d: [d[0] / l, d[1] / l, d[2] / l] };
  };

  Game.prototype.projectToNdc = function (p) {
    var R = this.R;
    var vp = R.viewProj;
    var x = p[0], y = p[1], z = p[2];
    var cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (cw <= 0.0001) return null;
    return [
      (vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / cw,
      (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / cw
    ];
  };

  function raySphere(o, d, c, r) {
    var ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
    var b = ox * d[0] + oy * d[1] + oz * d[2];
    var cc = ox * ox + oy * oy + oz * oz - r * r;
    var h = b * b - cc;
    if (h < 0) return -1;
    h = Math.sqrt(h);
    var t = -b - h;
    if (t < 0) t = -b + h;
    return t;
  }

  /* 船体（ローカル座標）へのレイキャスト → {t,u,v,p} */
  Game.prototype.raycastHull = function (ray) {
    var st = this.st;
    var ox = ray.o[0] - st.shipX, oy = ray.o[1] - st.shipY, oz = ray.o[2];
    var d = ray.d;
    var tris = this.R.hullTris;
    var best = -1, bu = 0, bv = 0;
    for (var i = 0; i < tris.length; i++) {
      var T = tris[i];
      var a = T[0], b = T[1], c = T[2];
      var e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
      var e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
      var px = d[1] * e2z - d[2] * e2y;
      var py = d[2] * e2x - d[0] * e2z;
      var pz = d[0] * e2y - d[1] * e2x;
      var det = e1x * px + e1y * py + e1z * pz;
      if (det > -1e-7 && det < 1e-7) continue;
      var inv = 1 / det;
      var tx = ox - a[0], ty = oy - a[1], tz = oz - a[2];
      var u = (tx * px + ty * py + tz * pz) * inv;
      if (u < 0 || u > 1) continue;
      var qx = ty * e1z - tz * e1y;
      var qy = tz * e1x - tx * e1z;
      var qz = tx * e1y - ty * e1x;
      var v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
      if (v < 0 || u + v > 1) continue;
      var t = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (t <= 0.2) continue;
      if (best < 0 || t < best) {
        best = t;
        var w = 1 - u - v;
        bu = a[3] * w + b[3] * u + c[3] * v;
        bv = a[4] * w + b[4] * u + c[4] * v;
      }
    }
    if (best < 0) return null;
    return {
      t: best, u: bu, v: bv,
      p: [ray.o[0] + d[0] * best, ray.o[1] + d[1] * best, ray.o[2] + d[2] * best]
    };
  };

  Game.prototype.pointerDown = function (ndcX, ndcY) {
    this.idle = 0;
    var st = this.st;
    var ray = this.screenRay(ndcX, ndcY);
    this.drag = { x: ndcX, y: ndcY, x0: ndcX, y0: ndcY, moved: 0, mode: 'none' };

    // レバー
    var knob = this.leverKnob();
    var kp = this.projectToNdc(knob);
    if (kp && (this.phase === PH.PUMP || this.phase === PH.FLOOD || this.phase === PH.EXPOSED)) {
      var dx = (kp[0] - ndcX), dy = (kp[1] - ndcY) * 0.62;
      if (dx * dx + dy * dy < 0.055) {
        this.drag.mode = 'lever';
        this.drag.base = this.pumpSet;
        return;
      }
    }

    if (this.phase === PH.EXPOSED) {
      // プロペラ
      var pw = this.propWorld();
      if (raySphere(ray.o, ray.d, pw, W.PROP_R + 1.2) > 0) {
        this.drag.mode = 'prop';
        this.focus = 1;
        var c = this.projectToNdc(pw);
        this.drag.cx = c ? c[0] : 0; this.drag.cy = c ? c[1] : 0;
        this.drag.ang = Math.atan2(ndcY - this.drag.cy, ndcX - this.drag.cx);
        return;
      }
      // 舵
      var rw = this.rudderWorld();
      if (raySphere(ray.o, ray.d, rw, 5.0) > 0) {
        this.drag.mode = 'rudder';
        this.focus = 2;
        this.drag.base = st.rudderAngle;
        return;
      }
      // 船体（洗浄）
      var hit = this.raycastHull(ray);
      if (hit) {
        this.drag.mode = 'wash';
        this.focus = 3;
        this.washFocusX = hit.p[0];
        this.doWash(hit);
        return;
      }
      // 船に当たらなかった上下ドラッグは水位操作として扱う（幼児でも戻せるように）
      this.focus = 0;
      this.drag.mode = 'lever';
      this.drag.base = this.pumpSet;
      return;
    }

    if (this.phase === PH.GATE_CLOSE) {
      this.startGateClose();
      this.drag.mode = 'tap';
      return;
    }
    if (this.phase === PH.APPROACH) {
      this.approachBoost = Math.min(3.0, this.approachBoost + 1.4);
      this.drag.mode = 'tap';
      return;
    }
    if (this.phase === PH.PUMP || this.phase === PH.FLOOD) {
      this.drag.mode = 'lever';
      this.drag.base = this.pumpSet;
      return;
    }
    this.drag.mode = 'look';
  };

  Game.prototype.pointerMove = function (ndcX, ndcY) {
    var d = this.drag;
    if (!d) return;
    this.idle = 0;
    var st = this.st;
    var dx = ndcX - d.x, dy = ndcY - d.y;
    d.moved += Math.hypot(dx, dy);

    if (d.mode === 'lever') {
      var prev = this.pumpSet;
      this.pumpSet = U.clamp(d.base - (ndcY - d.y0) * 0.95, 0, 1);
      if (this.phase === PH.EXPOSED && this.pumpSet < 0.999) {
        // 注水フェーズへは updExposed が遷移させる
      }
      if (Math.floor(prev * 22) !== Math.floor(this.pumpSet * 22) && this.A) this.A.tick(this.pumpSet);
    } else if (d.mode === 'prop') {
      var a = Math.atan2(ndcY - d.cy, ndcX - d.cx);
      var da = a - d.ang;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      d.ang = a;
      st.propAngle -= da;
      this.propSpeed = U.clamp(this.propSpeed - da * 26, -9, 9);
    } else if (d.mode === 'rudder') {
      st.rudderAngle = U.clamp(d.base + (ndcX - d.x0) * 1.5, -0.62, 0.62);
    } else if (d.mode === 'wash') {
      var ray = this.screenRay(ndcX, ndcY);
      var hit = this.raycastHull(ray);
      if (hit) { this.washFocusX = hit.p[0]; this.doWash(hit); }
    } else if (d.mode === 'look') {
      this.camNudgeAz = U.clamp((this.camNudgeAz || 0) - dx * 0.55, -0.35, 0.35);
      this.camNudgeEl = U.clamp((this.camNudgeEl || 0) + dy * 0.45, -0.10, 0.30);
    }
    d.x = ndcX; d.y = ndcY;
  };

  Game.prototype.pointerUp = function () {
    this.drag = null;
    this.idle = 0;
  };

  Game.prototype.doWash = function (hit) {
    // 喫水線より上は洗わない
    var st = this.st;
    var localY = hit.p[1] - st.shipY;
    if (localY > W.SHIP_DRAFT + 1.4) return;
    var ru = 0.030, rv = 0.075;
    this.R.paintWash(hit.u, hit.v, ru, rv, 0.34);
    this.washPoint = hit.p;
    this.washActive = 1.0;
    this.washAmount = Math.min(1, this.washAmount + 0.004);
  };

  DD.Game = Game;
  DD.PHASE = PH;
})(typeof window !== 'undefined' ? window : this);
