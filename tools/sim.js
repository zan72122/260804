// 描画なしで玩具物理だけを回し、4 種類の配置で挙動が「はっきり違う」ことと
// 「同じ操作なら暴れない」ことを確かめる。node tools/sim.js
import { CLAW, PRIZE, SLOT_Y } from '../src/config.js';
import { World, Prize } from '../src/physics.js';
import { addStaticSurfaces, barEnds, barTopAt, inChute, makeBarState, startPose } from '../src/rig.js';

const LAYOUTS = {
  '狭い平行': [[0, 1], [0, 1]],
  '広い平行': [[2, 1], [2, 1]],
  'ハの字': [[2, 1], [0, 1]],   // 手前が広い
  'ゆるい坂': [[1, 0], [1, 1]], // 手前が低い
  'ハの字＋坂': [[2, 0], [0, 1]],
};

function makeBars(spec) {
  return [-1, 1].map((side) => {
    const b = makeBarState();
    b.placed = true;
    b.side = side;
    b.front = { xi: spec[0][0], yi: spec[0][1] };
    b.back = { xi: spec[1][0], yi: spec[1][1] };
    return b;
  });
}

function run(kind, spec, clawX) {
  const bars = makeBars(spec);
  const world = new World();
  const barSegs = bars.map((b, i) => {
    const { a, b: e } = barEnds(b, i);
    return world.addSegment({ a, b: e, radius: 0.011, mu: 0.45, samples: 52, tag: 'bar', side: b.side });
  });
  void barSegs;
  const clawSegs = [];
  for (let i = 0; i < 4; i++) {
    clawSegs.push(world.addSegment({
      radius: CLAW.bladeHalfX, samples: 16, tag: 'claw',
      mu: 0.18, maxImpulse: CLAW.maxImpulse, active: false,
    }));
  }
  addStaticSurfaces(world);
  world.assistBelowY = SLOT_Y[0] - 0.06;

  const prize = new Prize(PRIZE[kind]);
  const pose = startPose(bars, prize);
  prize.setPose(pose.com, pose.quat);
  prize.frozen = false;
  world.prize = prize;

  const dt = 1 / 60;
  let tipY = CLAW.homeTipY;
  let x = clawX;
  let gantryZ = prize.com.z;
  let phase = 'intro';
  let t = 0;
  let moved = 0;
  let chuted = false;
  let maxSpeed = 0;
  let touched = 0;
  let target = CLAW.homeTipY;

  for (let step = 0; step < 60 * 9; step++) {
    const vel = { x: 0, y: 0, z: 0 };
    if (phase === 'intro') {
      gantryZ += (Math.max(CLAW.gantryZMin, Math.min(CLAW.gantryZMax, prize.com.z)) - gantryZ) * Math.min(1, dt * 4.5);
      t += dt;
      if (t > 0.85 && (prize.resting || t > 3.2)) {
        phase = 'descend';
        const V3 = prize.com.constructor;
        const side = Math.max(barTopAt(bars[0], gantryZ).y, barTopAt(bars[1], gantryZ).y) + 0.014;
        const bb = prize.aabb(new V3(), new V3());
        const r = CLAW.bladeHalfX;
        const overlaps = [x - CLAW.spacing, x + CLAW.spacing]
          .some((px) => px + r > bb.min.x && px - r < bb.max.x)
          && gantryZ + CLAW.bladeHalfZ > bb.min.z && gantryZ - CLAW.bladeHalfZ < bb.max.z;
        target = overlaps ? Math.max(side, bb.max.y - 0.004) : side;
      }
    } else if (phase === 'descend') {
      tipY -= CLAW.descendSpeed * dt; vel.y = -CLAW.descendSpeed;
      if (tipY <= target) { tipY = target; phase = 'push'; }
    } else if (phase === 'push') {
      const dir = x <= prize.com.x ? 1 : -1;
      x += dir * CLAW.strokeSpeed * dt; moved += CLAW.strokeSpeed * dt;
      vel.x = dir * CLAW.strokeSpeed;
      if (moved >= CLAW.stroke) phase = 'settle';
    }
    const active = phase !== 'intro';
    for (let i = 0; i < 4; i++) {
      const sx = i < 2 ? -1 : 1;
      const sz = (i % 2) === 0 ? -1 : 1;
      const seg = clawSegs[i];
      seg.a.set(x + sx * CLAW.spacing, tipY, gantryZ + sz * CLAW.bladeHalfZ * 0.55);
      seg.b.set(x + sx * CLAW.spacing, tipY + CLAW.rodLength, gantryZ + sz * CLAW.bladeHalfZ * 0.55);
      seg.vel.set(vel.x, vel.y, vel.z);
      seg.active = active;
    }
    world.step(dt);
    if (world.contacts.some((c) => c.tag === 'claw')) touched++;
    maxSpeed = Math.max(maxSpeed, prize.vel.length());
    if (inChute(prize.com)) chuted = true;
  }
  const fell = prize.com.y < SLOT_Y[0];
  return {
    fell, chuted, touched,
    pos: [prize.com.x, prize.com.y, prize.com.z].map((v) => +v.toFixed(3)),
    maxSpeed: +maxSpeed.toFixed(2),
    resting: prize.resting,
  };
}

const AIMS = [-0.14, -0.07, 0, 0.07, 0.14];
let bad = 0;
for (const kind of ['capsule', 'box']) {
  console.log(`\n== ${kind} ==   爪の位置: ${AIMS.join(' / ')}`);
  for (const [name, spec] of Object.entries(LAYOUTS)) {
    const cells = AIMS.map((aim) => {
      const a = run(kind, spec, aim);
      const b = run(kind, spec, aim);
      if (JSON.stringify(a.pos) !== JSON.stringify(b.pos)) { bad++; return '不定'; }
      if (a.maxSpeed > 1.61) { bad++; return '暴走'; }
      if (a.chuted) return 'シュート';
      if (a.fell) return `落下y${a.pos[1].toFixed(2)}z${a.pos[2].toFixed(2)}`;
      return `x${a.pos[0].toFixed(2)}z${a.pos[2].toFixed(2)}${a.touched ? '' : '(未接触)'}`;
    });
    console.log(`  ${name.padEnd(6)} ${cells.map((c) => c.padEnd(15)).join('')}`);
  }
}
console.log(bad === 0 ? '\nOK' : `\nNG (${bad})`);
