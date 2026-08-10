import { makeGame, snapshot } from './physics-sim.mjs';
import { makeRound, resetRoundCounter, BAR } from '../src/config.js';
resetRoundCounter();
for (const off of [0.03, 0.045, 0.05, 0.055, 0.06, 0.07, 0.09]) {
  const r = makeRound(); resetRoundCounter();
  r.start.x = off; r.start.yaw = 0; r.start.z = -0.02;
  const { g } = await makeGame(r);
  const a = snapshot(g);
  for (let i=0;i<240;i++) g.update(1/60);
  const b = snapshot(g);
  const half = r.barSpacing/2;
  console.log(`start x=${off} w=${r.box.w.toFixed(3)} spacing=${r.barSpacing.toFixed(3)} loseLeftAt=${(r.box.w/2-half+BAR.radius).toFixed(3)} rightBar=${half.toFixed(3)} -> after: x=${b.x} y=${b.y} tilt=${b.tiltDeg} fell=${b.y<0.3}`);
}
