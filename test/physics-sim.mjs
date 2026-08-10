/**
 * Head-less physics harness. Runs the real gameplay module (no rendering) so
 * the bridge physics can be checked without a browser.
 *
 *   node test/physics-sim.mjs [scenario]
 */

import { initPhysics, CranePhysics } from '../src/physics.js';
import { CraneGame, PHASE } from '../src/crane.js';
import { makeRound, BAR, resetRoundCounter } from '../src/config.js';

const DT = 1 / 60;

export async function makeGame(round) {
  await initPhysics();
  const p = new CranePhysics();
  const g = new CraneGame(p);
  g.startRound(round ?? makeRound());
  // let it settle on the bars
  for (let i = 0; i < 180; i++) g.update(DT);
  return { p, g };
}

export function runUntilIdle(g, maxSeconds = 14) {
  let t = 0;
  while (t < maxSeconds) {
    g.update(DT);
    t += DT;
    if (!g.busy) break;
  }
  return t;
}

export function snapshot(g) {
  const st = g.p.prizeState();
  return {
    x: +st.pos.x.toFixed(4),
    y: +st.pos.y.toFixed(4),
    z: +st.pos.z.toFixed(4),
    yawDeg: +((g.p.prizeYaw() * 180) / Math.PI).toFixed(1),
    tiltDeg: +((g.p.prizeTilt() * 180) / Math.PI).toFixed(1),
    speed: +st.speed.toFixed(4),
    spin: +st.spin.toFixed(3),
    inst: +g.instability.toFixed(2),
  };
}

async function main() {
  const scenario = process.argv[2] ?? 'all';

  if (scenario === 'rest' || scenario === 'all') {
    resetRoundCounter();
    const { g } = await makeGame();
    const a = snapshot(g);
    for (let i = 0; i < 300; i++) g.update(DT);
    const b = snapshot(g);
    console.log('[rest] start', a);
    console.log('[rest] after 5s', b);
    const drift = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    console.log('[rest] drift', drift.toFixed(5), 'settled=', b.speed < 0.01 && b.spin < 0.05);
    console.log('[rest] restsOnBars=', Math.abs(b.y - (BAR.topY + g.p.prizeDims.h / 2)) < 0.01);
  }

  if (scenario === 'aim' || scenario === 'all') {
    for (const label of ['left', 'centre', 'right']) {
      resetRoundCounter();
      const { g } = await makeGame();
      const ends = g.prizeEnds();
      const x = label === 'left' ? ends.left.x + 0.045 : label === 'right' ? ends.right.x - 0.045 : ends.c.x;
      const before = snapshot(g);
      g.setAim(x, ends.c.z - ends.dz * 0.85);
      for (let i = 0; i < 90; i++) g.update(DT);
      g.grab();
      runUntilIdle(g);
      const after = snapshot(g);
      console.log(`[aim ${label}] dx=${(after.x - before.x).toFixed(4)} dz=${(after.z - before.z).toFixed(4)} dyaw=${(after.yawDeg - before.yawDeg).toFixed(1)}° tilt=${after.tiltDeg}° delta=${g.lastGrabDelta.toFixed(3)}`);
    }
  }

  if (scenario === 'play' || scenario === 'all') {
    resetRoundCounter();
    const { g } = await makeGame();
    let grabs = 0;
    const log = [];
    while (grabs < 12 && g.phase !== PHASE.WON) {
      const ends = g.prizeEnds();
      // always work the same end + same near corner, the way a player learns to
      const x = ends.left.x + 0.045;
      const z = ends.c.z - ends.dz * 0.85;
      g.setAim(x, z);
      for (let i = 0; i < 60; i++) g.update(DT);
      if (!g.grab()) break;
      runUntilIdle(g);
      grabs++;
      log.push(`  grab ${grabs}: ${JSON.stringify(snapshot(g))}`);
      if (g.phase === PHASE.WON) break;
    }
    console.log('[play] grabs to win:', grabs, 'won=', g.phase === PHASE.WON);
    console.log(log.join('\n'));
    if (g.phase === PHASE.WON) {
      for (let i = 0; i < 180; i++) g.update(DT);
      console.log('[play] landed', snapshot(g));
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
