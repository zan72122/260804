/** Aim → outcome map: one grab from an identical start for a grid of aim points. */
import { makeGame, runUntilIdle, snapshot } from './physics-sim.mjs';
import { resetRoundCounter, makeRound } from '../src/config.js';

const base = (() => { resetRoundCounter(); return makeRound(); })();
console.log('round', JSON.stringify(base.box), 'spacing', base.barSpacing.toFixed(3));
const rows = [];
for (const fz of [-0.85, 0, 0.85]) {
  const cells = [];
  for (const fx of [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0]) {
    const { g } = await makeGame(JSON.parse(JSON.stringify(base)));
    const e = g.prizeEnds();
    const hw = base.box.w / 2;
    g.setAim(e.c.x + fx * (hw - 0.02), e.c.z + fz * base.box.d / 2);
    for (let i = 0; i < 60; i++) g.update(1 / 60);
    const b = snapshot(g);
    g.grab(); runUntilIdle(g);
    const a = snapshot(g);
    cells.push(`x${fx.toFixed(1).padStart(4)}: dx=${(a.x-b.x).toFixed(3).padStart(6)} dz=${(a.z-b.z).toFixed(3).padStart(6)} dyaw=${(a.yawDeg-b.yawDeg).toFixed(1).padStart(6)}`);
  }
  rows.push(`z=${fz.toFixed(2)}\n   ` + cells.join('\n   '));
}
console.log(rows.join('\n'));
