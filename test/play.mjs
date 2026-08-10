/** Plays whole rounds with a simple "keep working the same corner" strategy. */
import { makeGame, runUntilIdle, snapshot } from './physics-sim.mjs';
import { makeRound, resetRoundCounter, BAR } from '../src/config.js';
import { PHASE } from '../src/crane.js';

const rounds = Number(process.argv[2] ?? 6);
resetRoundCounter();
let wins = 0, totalGrabs = 0;
for (let r = 0; r < rounds; r++) {
  const round = makeRound();
  const { g, p } = await makeGame(round);
  let n = 0, throughGap = null, minDelta = 9, stalls = 0;
  // `alt` mimics a child poking about: ends and corners alternate every grab,
  // so each move partly undoes the last. It is the worst case for convergence.
  const alt = process.argv.includes('alt');
  let side = r % 2 === 0 ? 'left' : 'right';
  let corner = r % 3 === 0 ? -0.85 : 0.85;
  while (n < 14 && g.phase !== PHASE.WON) {
    const e = g.prizeEnds();
    if (alt) { side = n % 2 === 0 ? 'left' : 'right'; corner = n % 3 === 0 ? -0.85 : 0.85; }
    g.setAim(side === 'left' ? e.left.x + 0.045 : e.right.x - 0.045, e.c.z + corner * e.dz);
    for (let i = 0; i < 70; i++) g.update(1 / 60);
    if (!g.grab()) break;
    // watch the crossing point
    let t = 0;
    while (t < 14) {
      g.update(1 / 60); t += 1 / 60;
      const st = p.prizeState();
      if (throughGap === null && st.pos.y < BAR.topY - 0.03) throughGap = st.pos.x;
      if (!g.busy) break;
    }
    n++;
    if (g.phase !== PHASE.WON) { minDelta = Math.min(minDelta, g.lastGrabDelta); if (g.lastGrabDelta < 0.1) stalls++; }
  }
  const won = g.phase === PHASE.WON;
  if (won) { wins++; totalGrabs += n; }
  const half = round.barSpacing / 2 + BAR.radius;
  console.log(
    `round ${r + 1} [${side}/${corner > 0 ? 'front' : 'back'}] won=${won} grabs=${n} stalls=${stalls}` +
    ` fellAtX=${throughGap === null ? '-' : throughGap.toFixed(3)}` +
    ` betweenBars=${throughGap !== null && Math.abs(throughGap) < half + 0.03}` +
    ` final=${JSON.stringify(snapshot(g))}`);
}
console.log(`\nwins ${wins}/${rounds}, avg grabs ${(totalGrabs / Math.max(1, wins)).toFixed(1)}`);
