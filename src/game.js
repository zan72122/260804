/**
 * game.js — 「あける → でる → ふさぐ」の循環。
 * 失敗もゲームオーバーも制限時間もない。迷えばヒントが出て、
 * それでも動かなければゲームがそっと進めてくれる。
 */
import * as THREE from 'three';
import { ONOMAT } from './audio.js';
import { TAPHOLE } from './world.js';

export const PH = {
  TITLE: 'TITLE', READY: 'READY',
  DRILL_IN: 'DRILL_IN', DRILL_WORK: 'DRILL_WORK', BREAK: 'BREAK', FLOW: 'FLOW',
  MUD_IN: 'MUD_IN', MUD_CLOSE: 'MUD_CLOSE', PLUG: 'PLUG', SEALED: 'SEALED', REPLAY: 'REPLAY',
};

const damp = (cur, to, tau, dt) => cur + (to - cur) * (1 - Math.exp(-dt / Math.max(1e-4, tau)));
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function createGame({ world, drill, mudgun, molten, cam, ui, input, sfx }) {
  const S = {
    phase: PH.TITLE, t: 0,
    free: false,                 // じゆうにあそぶ（ずっとループ）
    cycles: 0, ladle: 0, LADLE_CAP: 3,

    // 機械の状態（目標値と実値を分け、重量感のある追従にする）
    dSwing: 0, dSwingT: 0, dAdv: 0, dAdvT: 0, dSpin: 0, dSpinT: 0, depth: 0,
    mSwing: 0, mSwingT: 0, mAdv: 0, mAdvT: 0, push: 0,
    plugFill: 1,
    prog: 0,                     // その工程の進み具合（ゲージ）
    saidGuru: false, saidGugu: false, saidDoba: false,
    steamClock: 0, dustClock: 0,
    cheer: 0,
  };

  const tmpV = new THREE.Vector3();
  const minDim = () => Math.min(window.innerWidth, window.innerHeight);

  /* ------------------------------------------------------------------ */
  function go(p) {
    S.phase = p; S.t = 0; S.prog = 0;
    input.clear();
    ui.noHint();
    enter(p);
  }

  function resetCycle() {
    S.depth = 0; S.push = 0; S.plugFill = 1;
    S.saidGuru = S.saidGugu = S.saidDoba = false;
    world.setPlug(1, 'back');
    world.setCutaway(0);
    world.innerGlowMat.opacity = 0;
    world.boreMat.emissiveIntensity = 0;
    molten.reset();
    S.dSwingT = 0; S.dAdvT = 0; S.mSwingT = 0; S.mAdvT = 0;
  }

  function enter(p) {
    switch (p) {
      case PH.TITLE:
        ui.screen('title'); ui.task(null); ui.gauge(null);
        cam.cut('wide', { speed: 1.1 });
        resetCycle();
        break;

      case PH.READY:
        ui.screen(null);
        ui.say(ONOMAT.ready, '#ffe27a'); sfx.say('ready'); sfx.blip(880, 0.1);
        break;

      case PH.DRILL_IN:
        resetCycle();
        cam.cut('drillIn', { speed: 0.85 });
        ui.task('🛠️', 'ドリル、こっちへ');
        sfx.startRumble(); sfx.setRumble(0.15);
        break;

      case PH.DRILL_WORK:
        cam.cut('drillWork', { speed: 0.7 });
        ui.task('🌀', 'ぐるぐる！');
        sfx.stopRumble(); sfx.startDrill();
        break;

      case PH.BREAK:
        ui.task(null); ui.gauge(null); ui.noHint();
        sfx.setDrill(0.25);
        break;

      case PH.FLOW:
        cam.cut('flow', { speed: 0.8 });
        ui.task('👀', 'みてて！');
        ui.gauge(null);
        break;

      case PH.MUD_IN:
        cam.cut('mudIn', { speed: 0.9 });
        ui.task('🚧', 'おおきいの、こっちへ');
        sfx.startRumble(); sfx.setRumble(0.2);
        ui.say(ONOMAT.gogo, '#ffd08a'); sfx.say('gogo');
        break;

      case PH.MUD_CLOSE:
        cam.cut('mudClose', { speed: 0.7 });
        ui.task(null); ui.gauge(null);
        break;

      case PH.PLUG:
        cam.cut('cutaway', { speed: 0.75 });
        ui.task('👇', 'ながーく おす！');
        break;

      case PH.SEALED:
        ui.task(null); ui.gauge(1); ui.noHint();
        sfx.stopPush(); sfx.stopGush();
        sfx.sealed(); sfx.hiss(1.1);
        ui.say(ONOMAT.fusa, '#9dff9d'); sfx.say('fusa');
        molten.puffSteam(new THREE.Vector3(TAPHOLE.x, TAPHOLE.y, TAPHOLE.z + 0.25), 22);
        S.cheer = 1;
        S.cycles++;
        S.ladle = S.ladle + 1;
        S.ladleT = 0;
        // 取鍋がたまっていくのが見える＝また遊びたくなる
        world.setLadle((S.ladle % (S.LADLE_CAP + 1)) / (S.LADLE_CAP + 1));
        break;

      case PH.REPLAY:
        ui.gauge(null); ui.task(null);
        cam.cut('wide', { speed: 1.0 });
        ui.ladle(S.ladle % (S.LADLE_CAP + 1), S.LADLE_CAP);
        ui.screen('replay');
        sfx.say('again');
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* ヒント：迷ったら自然に出す                                          */
  function maybeHint(kind, after = 1.5) {
    if (input.idle > after && !input.holding) ui.hint(kind);
    else if (input.idle < 0.15) ui.noHint();
  }

  /* ------------------------------------------------------------------ */
  function update(dt) {
    S.t += dt;
    input.tick(dt);

    // ループ音は毎フレーム「その工程にあるべき音」を宣言する。
    // start* は多重起動しないので、タブ復帰などで止まっても自然に鳴り直す。
    if (S.phase === PH.DRILL_WORK) sfx.startDrill();
    if (S.phase === PH.DRILL_IN || S.phase === PH.MUD_IN) sfx.startRumble();
    if (S.phase === PH.FLOW || S.phase === PH.MUD_IN || S.phase === PH.MUD_CLOSE) sfx.startGush();

    switch (S.phase) {
      /* ---------------- M1 待機 ---------------- */
      case PH.TITLE: {
        if (input.takeTap()) start();
        break;
      }
      case PH.READY: {
        if (S.t > 0.75) go(PH.DRILL_IN);
        break;
      }

      /* ---------------- M2a ドリル接近（スワイプ） ---------------- */
      case PH.DRILL_IN: {
        const need = minDim() * 1.05;
        S.prog = clamp01(S.prog + input.takeDrag() / need);
        if (input.idle > 4.0) S.prog = clamp01(S.prog + dt * 0.30);   // 迷っても必ず進む
        S.dSwingT = S.prog;
        S.dAdvT = S.prog * drill.contactAdvance;
        ui.gauge(S.prog);
        maybeHint('swipe', 1.4);
        sfx.setRumble(0.10 + Math.min(0.7, input.speed / 900));
        if (S.prog >= 1) { sfx.blip(660, 0.12); go(PH.DRILL_WORK); }
        break;
      }

      /* ---------------- M2b 開孔（ぐるぐる） ---------------- */
      case PH.DRILL_WORK: {
        const NEED_TURNS = 2.6;
        const gain = input.takeTurns() / NEED_TURNS + input.takeRaw() / (minDim() * 16);
        let rate = gain / Math.max(dt, 1e-3);
        if (input.idle > 4.5) { const a = 0.16; S.depth = clamp01(S.depth + a * dt); rate = Math.max(rate, a); }
        S.depth = clamp01(S.depth + gain);

        S.dSpinT = Math.min(46, rate * 26);
        S.dAdvT = drill.contactAdvance + (1 - drill.contactAdvance) * S.depth;
        S.plugFill = Math.max(0, 1 - (drill.penetration / drill.boreLen) * S.depth);

        ui.gauge(S.depth);
        maybeHint('circle', 1.2);

        if (S.dSpin > 4 && !S.saidGuru) { S.saidGuru = true; ui.say(ONOMAT.guru, '#ffdf7a'); sfx.say('guru'); }
        sfx.setDrill(S.dSpin / 24);

        // 削り粉と火花（先端の少し上に出るので、指で隠れない）
        if (S.dSpin > 3) {
          drill.tipWorld(tmpV);
          molten.drillDust(tmpV, Math.min(1, S.dSpin / 20));
        }
        // 奥が赤くなってくる（もうすぐ貫通する予感）
        world.boreMat.emissiveIntensity = S.depth * 1.4;
        molten.setPreheat(Math.max(0, S.depth - 0.25) * 1.05);
        world.innerGlowMat.opacity = Math.max(0, S.depth - 0.45) * 1.4;
        world.innerGlow.scale.setScalar(0.7 + S.depth * 0.6);
        if (S.depth > 0.55) cam.punch(0.006 * (S.dSpin / 24), 6);

        if (S.depth >= 1) go(PH.BREAK);
        break;
      }

      /* ---------------- M3 貫通 ---------------- */
      case PH.BREAK: {
        S.dSpinT = 0; S.dAdvT = drill.contactAdvance + (1 - drill.contactAdvance);
        if (S.t < 0.30) {
          // 一瞬の“ため”
          S.dSpin = damp(S.dSpin, 2, 0.12, dt);
        } else if (!S.saidDoba) {
          S.saidDoba = true;
          sfx.stopDrill();
          sfx.breakthrough();
          ui.say(ONOMAT.aita, '#fff2a8'); sfx.say('aita');
          ui.flash(1.0);
          cam.punch(0.42, 3.0);
          cam.cut('breakOut', { speed: 0.36 });
          molten.burst(1);
          S.plugFill = 0;
          world.setPlug(0);
          world.innerGlowMat.opacity = 1;
          world.boreMat.emissiveIntensity = 2.2;
          S.cheer = 1;
          molten.setPreheat(0);
        }
        if (S.t > 0.62) {
          molten.setOpen(Math.min(1, (S.t - 0.62) * 2.6));
          if (!S.doba2) {
            S.doba2 = true;
            sfx.startGush(); sfx.setGush(1);
            ui.say(ONOMAT.doba, '#ff9a3c'); sfx.say('doba');
            molten.splash(new THREE.Vector3(0, 1.1, 1.9), 26, 5);
          }
        }
        if (S.t > 0.55) S.dAdvT = 0.0;          // 開いたらすぐ工具を抜く
        if (S.t > 1.75) { S.doba2 = false; go(PH.FLOW); }
        break;
      }

      /* ---------------- M4 溶銑観察 ---------------- */
      case PH.FLOW: {
        molten.setOpen(1);
        molten.setFill(clamp01(molten.state.fill + dt * 0.42));
        sfx.setGush(0.9);
        S.dAdvT = 0;
        if (S.t > 0.8) S.dSwingT = 0;           // ドリルは安全な位置へ戻る
        if (input.takeTap()) {
          const f = molten.state.fill;
          const p = world.curve.getPointAt(Math.min(0.95, Math.max(0.05, f * 0.7)));
          molten.splash(new THREE.Vector3(p.x, p.y + 0.05, p.z), 16, 4.5);
          sfx.blip(520 + Math.random() * 400, 0.09);
        }
        if (molten.state.fill > 0.99) S.ladleT = Math.min(1, (S.ladleT || 0) + dt * 0.13);
        world.setLadle(((S.ladle % (S.LADLE_CAP + 1)) + (S.ladleT || 0)) / (S.LADLE_CAP + 1));
        if (S.t > 7.6) go(PH.MUD_IN);
        break;
      }

      /* ---------------- M5 mud gun 接近 ---------------- */
      case PH.MUD_IN: {
        molten.setOpen(1);
        molten.setFill(1);
        S.dSwingT = 0; S.dAdvT = 0;                    // ドリルは退避
        const need = minDim() * 1.15;
        S.prog = clamp01(S.prog + input.takeDrag() / need);
        if (input.idle > 4.0) S.prog = clamp01(S.prog + dt * 0.26);
        S.mSwingT = S.prog;
        S.mAdvT = S.prog * 0.45;
        ui.gauge(S.prog);
        maybeHint('swipe', 1.4);
        sfx.setRumble(0.18 + Math.min(0.75, input.speed / 800));
        if (S.prog >= 1) go(PH.MUD_CLOSE);
        break;
      }

      /* ---------------- M5b ノズル密着 ---------------- */
      case PH.MUD_CLOSE: {
        molten.setOpen(1); molten.setFill(1);
        S.mSwingT = 1;
        S.mAdvT = THREE.MathUtils.smoothstep(S.t / 1.15, 0, 1);
        sfx.setRumble(0.5 * (1 - THREE.MathUtils.smoothstep(S.t / 1.3, 0, 1)));
        if (S.t > 1.15 && !S.thudDone) {
          S.thudDone = true;
          sfx.stopRumble(); sfx.thud();
          cam.punch(0.20, 4.0);
          mudgun.nozzleWorld(tmpV);
          molten.puffSteam(tmpV, 10);
        }
        if (S.t > 1.45) { S.thudDone = false; go(PH.PLUG); }
        break;
      }

      /* ---------------- M6 閉塞（長押し） ---------------- */
      case PH.PLUG: {
        world.setCutaway(THREE.MathUtils.smoothstep(S.t / 0.8, 0, 1));
        S.mSwingT = 1; S.mAdvT = 1;
        const holding = input.holding;
        if (holding) {
          S.push = clamp01(S.push + dt / 2.2);
          sfx.startPush(); sfx.setPush(S.push);
          if (!S.saidGugu) { S.saidGugu = true; ui.say(ONOMAT.gugu, '#e6b98a'); sfx.say('gugu'); }
          mudgun.shake(0.012 + S.push * 0.02);
          if ((S.steamClock -= dt) < 0) {
            S.steamClock = 0.22;
            molten.puffSteam(new THREE.Vector3(TAPHOLE.x, TAPHOLE.y - 0.1, TAPHOLE.z + 0.3), 3);
          }
          cam.punch(0.012, 8);
        } else {
          sfx.stopPush();
          if (input.idle > 4.5) S.push = clamp01(S.push + dt * 0.14);
        }
        mudgun.setPush(S.push);
        S.plugFill = S.push;
        // 詰まるほど溶銑は細くなり、やがて止まる
        const open = clamp01(1 - S.push * 1.25);
        molten.setOpen(open * open);
        if (open <= 0.001) molten.setTail(clamp01(molten.state.tail + dt * 0.5));
        sfx.setGush(open);

        ui.gauge(S.push);
        maybeHint('hold', 1.1);
        if (S.push >= 1) go(PH.SEALED);
        break;
      }

      /* ---------------- 完了 ---------------- */
      case PH.SEALED: {
        S.plugFill = 1;
        molten.setOpen(0);
        molten.setTail(clamp01(molten.state.tail + dt * 0.75));
        world.setCutaway(1 - THREE.MathUtils.smoothstep((S.t - 0.9) / 1.0, 0, 1));
        world.boreMat.emissiveIntensity = Math.max(0, 2.2 * (1 - S.t));
        world.innerGlowMat.opacity = Math.max(0, 1 - S.t * 1.5);
        // マッドガンは押し込みを保ってから、ゆっくり戻る
        if (S.t > 1.2) { S.mAdvT = 0; }
        if (S.t > 1.9) { S.mSwingT = 0; }
        if (S.t > 1.2) mudgun.setPush(Math.max(0, 1 - (S.t - 1.2) * 1.2));
        if (S.t > 1.0) cam.cut('wide', { speed: 1.0 });
        if (S.t > 3.1) {
          S.ladleT = 0;
          if (S.free) go(PH.DRILL_IN); else go(PH.REPLAY);
        }
        break;
      }

      case PH.REPLAY: {
        molten.setOpen(0);
        break;
      }
    }

    /* ---------------- 機械の実際の動き（重量感のある追従） ---------------- */
    S.dSwing = damp(S.dSwing, S.dSwingT, 0.42, dt);
    const dAdvTau = S.dAdvT < S.dAdv ? 0.22                       // 抜くときは素早く
      : (S.phase === PH.DRILL_WORK ? 0.16 : 0.45);
    S.dAdv = damp(S.dAdv, S.dAdvT, dAdvTau, dt);
    S.dSpin = damp(S.dSpin, S.dSpinT, 0.28, dt);
    drill.setSwing(S.dSwing);
    drill.setAdvance(S.dAdv);
    drill.setSpin(S.dSpin * dt);
    if (S.dSpin > 1) drill.shake(0.004 + S.dSpin * 0.0016); else drill.shake(0);

    S.mSwing = damp(S.mSwing, S.mSwingT, 0.85, dt);     // でかいのでゆっくり
    // 密着はきっちり決める（隙間が見えると因果が伝わらない）
    S.mAdv = damp(S.mAdv, S.mAdvT, S.phase === PH.PLUG || S.phase === PH.SEALED ? 0.12 : 0.30, dt);
    mudgun.setSwing(S.mSwing);
    mudgun.setAdvance(S.mAdv);

    world.setPlug(S.plugFill, S.phase === PH.PLUG || S.phase === PH.SEALED ? 'front' : 'back');

    /* ---------------- ロボットの反応 ---------------- */
    const bot = world.robot;
    S.cheer = Math.max(0, S.cheer - dt * 0.8);
    const bob = Math.sin(S.t * 2.4) * 0.02;
    bot.root.position.y = bob + S.cheer * Math.abs(Math.sin(S.t * 12)) * 0.10;
    const armUp = S.cheer * 2.2;
    bot.arms[0].rotation.z = -armUp - 0.1;
    bot.arms[1].rotation.z = armUp + 0.1;
    bot.head.rotation.y = Math.sin(S.t * 0.9) * 0.18;

    /* ---------------- 画面の熱 ---------------- */
    ui.heat(molten.state.heat * 0.55);
  }

  /* ------------------------------------------------------------------ */
  function start() {
    ui.screen(null);
    S.free = false;
    go(PH.READY);
  }
  function again(free) {
    S.free = !!free;
    ui.screen(null);
    go(PH.DRILL_IN);
  }

  return {
    S, update, start, again, go,
    get phase() { return S.phase; },
    toTitle() { go(PH.TITLE); },
  };
}
