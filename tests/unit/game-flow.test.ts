import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../../src/game/game';
import { AudioEngine } from '../../src/game/audio';
import { rectCenter } from '../../src/game/layout';

/**
 * Headless full-loop drive of the real Game class: proves the whole toy can
 * be played start → replay with nothing but single-pointer gestures, and
 * that sparks/state can never appear out of order.
 */

const DT = 1 / 60;

function makeGame(): Game {
  const g = new Game(new AudioEngine(), 42);
  g.setViewport(844, 390, { top: 0, right: 0, bottom: 0, left: 0 });
  return g;
}

function run(g: Game, seconds: number, perFrame?: () => void): void {
  const frames = Math.ceil(seconds / DT);
  for (let i = 0; i < frames; i++) {
    g.update(DT);
    perFrame?.();
  }
}

function runUntil(g: Game, cond: () => boolean, maxSeconds: number, perFrame?: () => void): void {
  const frames = Math.ceil(maxSeconds / DT);
  for (let i = 0; i < frames; i++) {
    if (cond()) return;
    g.update(DT);
    perFrame?.();
  }
  if (!cond()) throw new Error(`condition not reached within ${maxSeconds}s (phase=${g.phase})`);
}

function tap(g: Game, x: number, y: number): void {
  g.pointerDown(x, y);
  g.pointerUp(x, y);
}

function playToPhase(g: Game, target: string): void {
  const order = ['title', 'arrive', 'scanBefore', 'prepUnits', 'lower', 'grind', 'scanAfter', 'testRun', 'replay'];
  const want = order.indexOf(target);
  const idx = (): number => order.indexOf(g.phase);

  // title → arrive
  if (idx() < 1 && want >= 1) tap(g, ...c(rectCenter(g.layout().play)));
  // arrive → scanBefore (auto)
  if (want >= 2) runUntil(g, () => g.phase !== 'arrive', 12);
  // scanBefore → prepUnits
  if (idx() === 2 && want >= 3) {
    tap(g, ...c(rectCenter(g.layout().scan)));
    runUntil(g, () => g.phase === 'prepUnits', 12);
  }
  // prepUnits → lower: drag both units into their sockets
  if (idx() === 3 && want >= 4) {
    for (const i of [0, 1] as const) {
      const tray = i === 0 ? g.layout().tray0 : g.layout().tray1;
      const from = rectCenter(tray);
      const to = rectCenter(g.socketRect(i));
      g.pointerDown(from.x, from.y);
      for (let k = 1; k <= 10; k++) {
        g.pointerMove(from.x + ((to.x - from.x) * k) / 10, from.y + ((to.y - from.y) * k) / 10);
        g.update(DT);
      }
      g.pointerUp(to.x, to.y);
    }
    runUntil(g, () => g.phase === 'lower', 6);
  }
  // lower → grind: swipe the big lever down
  if (idx() === 4 && want >= 5) {
    const lever = g.layout().lever;
    const cx = lever.x + lever.w / 2;
    g.pointerDown(cx, lever.y + 30);
    for (let k = 0; k < 30; k++) {
      g.pointerMove(cx, lever.y + 30 + k * (lever.h / 28));
      g.update(DT);
    }
    g.pointerUp(cx, lever.y + lever.h);
    runUntil(g, () => g.phase === 'grind', 8);
  }
  // grind → scanAfter: keep dragging forward
  if (idx() === 5 && want >= 6) {
    let x = 200;
    g.pointerDown(x, 200);
    runUntil(
      g,
      () => g.phase === 'scanAfter',
      120,
      () => {
        x += 4;
        if (x > 800) {
          g.pointerUp(x, 200);
          x = 200;
          g.pointerDown(x, 200);
        }
        g.pointerMove(x, 200);
      }
    );
  }
  // scanAfter → testRun
  if (idx() === 6 && want >= 7) {
    tap(g, ...c(rectCenter(g.layout().scan)));
    runUntil(g, () => g.phase === 'testRun', 12);
  }
  // testRun → replay: one forward swipe launches the train
  if (idx() === 7 && want >= 8) {
    g.pointerDown(300, 200);
    for (let k = 0; k < 10; k++) {
      g.pointerMove(300 + k * 10, 200);
      g.update(DT);
    }
    g.pointerUp(400, 200);
    runUntil(g, () => g.phase === 'replay', 30);
  }
}

function c(p: { x: number; y: number }): [number, number] {
  return [p.x, p.y];
}

describe('full play loop (headless, real gestures)', () => {
  let g: Game;
  beforeEach(() => {
    g = makeGame();
  });

  it('arrival over corrugation shakes the car (gata gata)', () => {
    tap(g, ...c(rectCenter(g.layout().play)));
    let maxShake = 0;
    runUntil(
      g,
      () => g.phase === 'scanBefore',
      15,
      () => {
        maxShake = Math.max(maxShake, g.shake);
      }
    );
    expect(maxShake).toBeGreaterThan(0.5);
  });

  it('plays from title to replay and loops back', () => {
    playToPhase(g, 'replay');
    expect(g.phase).toBe('replay');
    // one tap restarts the same track
    tap(g, ...c(rectCenter(g.layout().replaySame)));
    expect(g.phase).toBe('arrive');
    expect(g.rail.rmsInZone()).toBeGreaterThan(0.3); // rail is rough again
  });

  it('never emits sparks before the units are locked down', () => {
    playToPhase(g, 'lower');
    expect(g.sparkCount()).toBe(0);
    // even while lowering, before lock: no sparks
    const lever = g.layout().lever;
    const cx = lever.x + lever.w / 2;
    g.pointerDown(cx, lever.y + 30);
    for (let k = 0; k < 15; k++) {
      g.pointerMove(cx, lever.y + 30 + k * 4);
      g.update(DT);
      expect(g.sparkCount()).toBe(0);
    }
    g.pointerUp(cx, lever.y + 90);
    run(g, 1);
    expect(g.sparkCount()).toBe(0);
  });

  it('sparks flow while grinding and rail smooths only where the car passed', () => {
    playToPhase(g, 'grind');
    const zone = g.rail.zone;
    const aheadBefore = g.rail.rmsInSpan(zone.end - 2, zone.end);
    let sawSparks = false;
    let minIntensity = Infinity;
    let maxIntensity = 0;
    let x = 200;
    g.pointerDown(x, 200);
    runUntil(
      g,
      () => g.carPos - 4.9 > zone.start + 3,
      60,
      () => {
        x += 4;
        if (x > 800) {
          g.pointerUp(x, 200);
          x = 200;
          g.pointerDown(x, 200);
        }
        g.pointerMove(x, 200);
        if (g.sparkCount() > 0) sawSparks = true;
        if (g.carSpeed > 1) {
          minIntensity = Math.min(minIntensity, g.audio.grindIntensity);
          maxIntensity = Math.max(maxIntensity, g.audio.grindIntensity);
        }
      }
    );
    g.pointerUp(x, 200);
    expect(sawSparks).toBe(true);
    // sparks answer the rail: intensity bursts on bumps vs smooth stretches
    expect(maxIntensity - minIntensity).toBeGreaterThan(0.15);
    // ground start of zone is smoother, un-reached end of zone unchanged
    expect(g.rail.rmsInSpan(zone.start, zone.start + 2)).toBeLessThan(0.3);
    expect(g.rail.rmsInSpan(zone.end - 2, zone.end)).toBeCloseTo(aheadBefore, 4);
  });

  it('reverse swipes never move the car backwards', () => {
    playToPhase(g, 'grind');
    const start = g.carPos;
    g.pointerDown(500, 200);
    for (let k = 0; k < 30; k++) {
      g.pointerMove(500 - k * 8, 200); // backwards swipe
      g.update(DT);
    }
    g.pointerUp(260, 200);
    run(g, 1);
    expect(g.carPos).toBeGreaterThanOrEqual(start - 1e-9);
  });

  it('lever released past the stage-2 clunk completes via intent inference; below springs back', () => {
    playToPhase(g, 'lower');
    const lever = g.layout().lever;
    const cx = lever.x + lever.w / 2;
    const top = lever.y + 30;
    const travel = lever.h * 0.72;
    // release early at ~40% → springs back, no lock
    g.pointerDown(cx, top);
    g.pointerMove(cx, top + travel * 0.4);
    g.pointerUp(cx, top + travel * 0.4);
    run(g, 2);
    expect(g.locked).toBe(false);
    expect(g.leverProgress).toBeLessThan(0.1);
    // release at ~70% (just past the heavy clunk) → auto-completes with the GAKON
    g.pointerDown(cx, top);
    for (let k = 0; k <= 20; k++) {
      g.pointerMove(cx, top + (travel * 0.7 * k) / 20);
      g.update(DT);
    }
    g.pointerUp(cx, top + travel * 0.7);
    run(g, 2);
    expect(g.locked).toBe(true);
  });

  it('mashed taps and out-of-phase input never corrupt the state machine', () => {
    playToPhase(g, 'scanBefore');
    const scan = rectCenter(g.layout().scan);
    for (let i = 0; i < 25; i++) tap(g, scan.x, scan.y); // mash the scan button
    tap(g, 10, 10);
    tap(g, 843, 389);
    tap(g, -20, -20);
    runUntil(g, () => g.phase === 'prepUnits', 12);
    expect(g.phase).toBe('prepUnits');
    // scan button mash must have produced exactly one sweep → one snapshot
    expect(g.revealedBefore).toBe(true);
  });

  it('rotation mid-grind preserves work state', () => {
    playToPhase(g, 'grind');
    // grind a little
    let x = 200;
    g.pointerDown(x, 200);
    for (let k = 0; k < 120; k++) {
      x += 4;
      g.pointerMove(x, 200);
      g.update(DT);
    }
    g.pointerUp(x, 200);
    runUntil(g, () => g.carSpeed === 0, 5); // let the car coast to a stop first
    const rms = g.rail.rmsInZone();
    const pos = g.carPos;
    const phase = g.phase;
    g.setViewport(390, 844, { top: 47, right: 0, bottom: 34, left: 0 }); // rotate to portrait
    g.update(DT);
    expect(g.phase).toBe(phase);
    expect(g.carPos).toBeCloseTo(pos, 6);
    expect(g.rail.rmsInZone()).toBeCloseTo(rms, 6);
    // and the game continues in portrait (vertical drag = forward)
    g.pointerDown(200, 600);
    for (let k = 0; k < 60; k++) {
      g.pointerMove(200, 600 - k * 4);
      g.update(DT);
    }
    expect(g.carPos).toBeGreaterThan(pos);
  });

  it('replay with a new wiggle produces a different corrugation', () => {
    playToPhase(g, 'replay');
    const oldSeed = g.seed;
    tap(g, ...c(rectCenter(g.layout().replayNew)));
    expect(g.phase).toBe('arrive');
    expect(g.seed).not.toBe(oldSeed);
    expect(g.rail.rmsInZone()).toBeGreaterThan(0.3);
  });
});
