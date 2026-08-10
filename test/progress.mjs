/**
 * The one measurement that matters: does every grab change the support state,
 * and does the round walk through
 *
 *   bridged → one side moved → turned → hanging off a bar → one corner left
 *   → wobbling → fallen
 *
 * Prints, per grab, how far the box slid, how far it turned, how far it tilted,
 * how many contacts each bar still has, and how deep it has sunk into the gap.
 *
 *   node test/progress.mjs [rounds] [alt]
 */

import { makeGame, runUntilIdle } from './physics-sim.mjs';
import { makeRound, resetRoundCounter, BAR } from '../src/config.js';
import { PHASE } from '../src/crane.js';

/** Yaw is folded into [-90°, 90°]; compare across that seam properly. */
const turnDelta = (a, b) => {
  let d = a - b;
  while (d > 90) d -= 180;
  while (d < -90) d += 180;
  return d;
};

const DT = 1 / 60;
const rounds = Number(process.argv[2] ?? 4);
const alt = process.argv.includes('alt');

/** Human-readable support state, straight from the contact manifolds. */
function support(p) {
  const [l, r] = p.barSupport();
  const st = p.prizeState();
  const sunk = BAR.topY + p.prizeDims.h / 2 - st.pos.y;
  const bars = (l > 0 ? 1 : 0) + (r > 0 ? 1 : 0);
  let label;
  if (st.pos.y < 0.3) label = 'FALLEN';
  else if (bars === 0) label = 'unsupported';
  else if (sunk > 0.02) label = bars === 1 ? 'half in the gap' : 'wedged in the gap';
  else if (bars === 1) label = l + r <= 2 ? 'one corner' : 'one bar';
  else label = l <= 2 || r <= 2 ? 'edge only' : 'bridged';
  return { l, r, sunk, label };
}

let dead = 0;
let grabsTotal = 0;
let wins = 0;
const perGrab = [];

for (let r = 0; r < rounds; r++) {
  resetRoundCounter();
  for (let i = 0; i < r; i++) makeRound();
  const round = makeRound();
  const { g, p } = await makeGame(round);
  console.log(`\n── round ${r + 1}  box ${(round.box.w * 100).toFixed(1)}×${(round.box.h * 100).toFixed(1)}×${(round.box.d * 100).toFixed(1)}cm  bars ${(round.barSpacing * 100).toFixed(1)}cm`);
  console.log(`   start: ${support(p).label}`);

  let n = 0;
  let side = 'left';
  while (n < 12 && g.phase !== PHASE.WON) {
    const e = g.prizeEnds();
    if (alt) side = n % 2 === 0 ? 'left' : 'right';
    const corner = alt ? (n % 3 === 0 ? -0.85 : 0.85) : -0.85;
    g.setAim(side === 'left' ? e.left.x + 0.046 : e.right.x - 0.046, e.c.z + corner * 0.85 * e.dz);
    for (let i = 0; i < 50; i++) g.update(DT);

    const b = p.prizeState();
    const byaw = (p.prizeYaw() * 180) / Math.PI;
    const btilt = (p.prizeTilt() * 180) / Math.PI;
    if (!g.grab()) break;
    runUntilIdle(g, 18);
    n++;
    grabsTotal++;

    const a = p.prizeState();
    const slid = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) * 100;
    const turned = turnDelta((p.prizeYaw() * 180) / Math.PI, byaw);
    const tilted = (p.prizeTilt() * 180) / Math.PI - btilt;
    const s = support(p);
    const visible = slid > 0.7 || Math.abs(turned) > 4 || Math.abs(tilted) > 4;
    if (!visible && g.phase !== PHASE.WON) dead++;
    perGrab.push({ slid, turned, tilted, visible });
    console.log(
      `   ${String(n).padStart(2)}. ${side.padEnd(5)} slid ${slid.toFixed(1).padStart(5)}cm  turn ${turned.toFixed(0).padStart(4)}°` +
      `  tilt ${tilted.toFixed(0).padStart(4)}°  sunk ${(s.sunk * 100).toFixed(1).padStart(5)}cm` +
      `  contacts L${s.l}/R${s.r}  → ${s.label}${visible ? '' : '   [no visible change]'}`,
    );
  }
  if (g.phase === PHASE.WON) wins++;
}

const visible = perGrab.filter((x) => x.visible).length;
console.log(`\nrounds won ${wins}/${rounds}   grabs ${grabsTotal} (avg ${(grabsTotal / rounds).toFixed(1)})`);
console.log(`grabs with a visible change: ${visible}/${perGrab.length} (${Math.round((visible / perGrab.length) * 100)}%)   dead grabs: ${dead}`);
const med = (k) => {
  const v = perGrab.map((x) => Math.abs(x[k])).sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)]?.toFixed(1);
};
console.log(`median slide ${med('slid')}cm   median turn ${med('turned')}°   median tilt ${med('tilted')}°`);
