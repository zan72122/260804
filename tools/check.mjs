#!/usr/bin/env node
// Headless check harness for the plush-crane game. Node ESM, no build step,
// no repo-root dependency: playwright is imported by absolute path from the
// scratchpad so the repo itself never gains a dependency.
//
// Subcommands:
//   node tools/check.mjs drama [N]   -- run N grabs, verify the drama contract
//   node tools/check.mjs beats       -- screenshot every FSM state of one grab
//   node tools/check.mjs shots       -- screenshot four viewports + the room
//   node tools/check.mjs perf        -- report renderer stats vs. budgets
//   node tools/check.mjs settle [N]  -- N rounds: does the prize heap sleep sanely?
//
// See tools/README.md for the swiftshader / slow-motion caveat, and for the
// failure-handling contract: a timed-out wait never aborts a run before it
// prints a report. It downgrades to a WARN, the run keeps going on whatever
// state actually exists, and the process still exits non-zero at the end.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(HERE, '..');
const OUT_DIR = path.join(HERE, 'out');

const PLAYWRIGHT_ENTRY =
  '/tmp/claude-0/-home-user-260804/7e2b15c1-ad82-5199-8a17-40236560f217/scratchpad/node_modules/playwright/index.mjs';
const CHROME_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LAUNCH_ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'];
const BASE_URL = 'http://localhost:8099/';

const STORAGE_KEY = 'nuigurumi-crane.collection.v1';

/* ------------------------------------------------------------------ */
/* small utilities                                                     */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pad(s, n) { s = String(s); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); }
function padL(s, n) { s = String(s); return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s; }

function printTable(headers, rows, widths) {
  console.log(headers.map((h, i) => pad(h, widths[i])).join(' '));
  console.log(widths.map((w) => '-'.repeat(w)).join(' '));
  for (const row of rows) console.log(row.map((c, i) => pad(c, widths[i])).join(' '));
}

/** Read MIN_DRAMA / DRAMA straight out of src/contracts.js -- never hardcode them here. */
function readContract() {
  const text = fs.readFileSync(path.join(REPO_ROOT, 'src/contracts.js'), 'utf8');
  const num = (name, scope = text) => {
    const m = scope.match(new RegExp(`\\b${name}\\s*:?=?\\s*([\\d.]+)`));
    if (!m) throw new Error(`tools/check.mjs: could not parse ${name} out of src/contracts.js`);
    return Number(m[1]);
  };
  const minDramaMatch = text.match(/export const MIN_DRAMA\s*=\s*([\d.]+)/);
  if (!minDramaMatch) throw new Error('tools/check.mjs: could not find MIN_DRAMA in src/contracts.js');
  const MIN_DRAMA = Number(minDramaMatch[1]);

  const dramaBlock = text.match(/export const DRAMA\s*=\s*\{([\s\S]*?)\n\};/);
  if (!dramaBlock) throw new Error('tools/check.mjs: could not find DRAMA block in src/contracts.js');
  const block = dramaBlock[1];
  const field = (name) => num(name, block);
  const DRAMA = {
    ROT: field('ROT'),
    MOVE: field('MOVE'),
    NEIGHBOUR: field('NEIGHBOUR'),
    EXPOSE: field('EXPOSE'),
    LIFT: field('LIFT'),
  };
  return { MIN_DRAMA, DRAMA };
}

/** Read CAB.inX / CAB.inZ straight out of src/cabinet.js -- never hardcode them here. */
function readCAB() {
  const text = fs.readFileSync(path.join(REPO_ROOT, 'src/cabinet.js'), 'utf8');
  const block = text.match(/export const CAB\s*=\s*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error('tools/check.mjs: could not find CAB block in src/cabinet.js');
  const body = block[1];
  const num = (name) => {
    const m = body.match(new RegExp(`\\b${name}\\s*:\\s*(-?[\\d.]+)`));
    if (!m) throw new Error(`tools/check.mjs: could not parse CAB.${name} out of src/cabinet.js`);
    return Number(m[1]);
  };
  return { inX: num('inX'), inZ: num('inZ') };
}

/* ------------------------------------------------------------------ */
/* browser plumbing                                                    */
/* ------------------------------------------------------------------ */

async function loadPlaywright() {
  const mod = await import(PLAYWRIGHT_ENTRY);
  return mod.chromium ?? mod.default.chromium;
}

async function launchBrowser() {
  const chromium = await loadPlaywright();
  return chromium.launch({ executablePath: CHROME_PATH, args: LAUNCH_ARGS });
}

/**
 * Opens a fresh page at the given viewport, wires up console/pageerror
 * capture, and waits for window.__crane to exist. `initScript` (optional)
 * runs before any page script -- used to seed localStorage for the room shot.
 *
 * Returns { context, page, boot } where `boot` is the (never-throwing)
 * waitFor result for the __crane-ready check -- callers must check
 * `boot.ok` before touching window.__crane.
 */
async function openPage(browser, viewport, errors, { initScript } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  if (initScript) await context.addInitScript(initScript.fn, initScript.arg);
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.consoleErrors.push(`[${viewport.name ?? 'page'}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    errors.pageErrors.push(`[${viewport.name ?? 'page'}] ${err}`);
  });
  await page.goto(BASE_URL, { waitUntil: 'load' });
  const boot = await waitFor(page, () => !!(window.__crane && window.__crane.game), {
    label: 'boot (__crane ready)', timeoutMs: 60000, errors,
  });
  return { context, page, boot };
}

/**
 * Polls `predicate` (a function evaluated in-page, no closures) until true.
 * Rendering here is software (swiftshader) and runs in slow motion in
 * wall-clock time, so timeouts are generous and we never sleep a fixed
 * duration hoping game state has moved on -- we poll it directly.
 *
 * NEVER THROWS. A timed-out wait is exactly the kind of precondition failure
 * this harness exists to surface -- so instead of aborting the whole run
 * (and destroying whatever report the caller was about to print), it prints
 * a WARN line immediately, records it on `errors.warnings` when an `errors`
 * object is supplied, and returns `{ ok: false, state }` so the caller can
 * carry on with whatever state actually exists. Callers still see a clear
 * signal, and the process still exits non-zero at the end (see printErrors /
 * each subcommand's exit-code check) -- it just doesn't happen by throwing.
 */
async function waitFor(page, predicate, { timeoutMs = 60000, label = 'condition', polling = 50, errors } = {}) {
  try {
    await page.waitForFunction(predicate, null, { timeout: timeoutMs, polling });
    return { ok: true, timedOut: false };
  } catch (err) {
    let state = '?';
    try {
      state = await page.evaluate(() => (window.__crane && window.__crane.game ? window.__crane.game.state : '(no __crane)'));
    } catch { /* page may be gone */ }
    const msg = `waitFor(${label}) timed out after ${timeoutMs}ms -- game.state=${state}`;
    console.log(`WARN: ${msg}`);
    if (errors) errors.warnings.push(msg);
    return { ok: false, timedOut: true, state };
  }
}

function newErrors() { return { consoleErrors: [], pageErrors: [], warnings: [] }; }

function printErrors(errors) {
  const total = errors.consoleErrors.length + errors.pageErrors.length;
  console.log(`\nconsole/page errors: ${total}`);
  for (const e of errors.pageErrors) console.log(`  [pageerror] ${e}`);
  for (const e of errors.consoleErrors) console.log(`  [console]   ${e}`);
  if (errors.warnings.length) {
    console.log(`\ntimeout/precondition warnings: ${errors.warnings.length}`);
    for (const w of errors.warnings) console.log(`  [warn] ${w}`);
  }
}

/** Any console/page error, or any timeout/precondition warning, fails the run. */
function hasFailure(errors) {
  return errors.consoleErrors.length > 0 || errors.pageErrors.length > 0 || errors.warnings.length > 0;
}

/* ------------------------------------------------------------------ */
/* pile diagnostics -- what a stuck pile looks like                    */
/* ------------------------------------------------------------------ */

/**
 * Reads exactly the numbers that explain a pile which won't sleep: how many
 * bodies are asleep, the fastest body in the pile (pile.js's own sleep-speed
 * formula: |vel| + |angVel|*0.25), the highest body centre (a collapsed
 * single-layer heap never gets tall), and how many bodies are overlapping an
 * interior wall (|pos.x|+radius > CAB.inX or |pos.z|+radius > CAB.inZ).
 * `coverage` additionally calls pile.refreshCoverage() and counts bodies
 * with covered > 0 (used by `settle`).
 */
async function pileDiag(page, CAB, { coverage = false } = {}) {
  return page.evaluate(([inX, inZ, wantCoverage]) => {
    const pile = window.__crane.game.pile;
    const bodies = pile.bodies;
    if (wantCoverage && typeof pile.refreshCoverage === 'function') pile.refreshCoverage();
    let asleep = 0, maxSpeed = 0, maxY = -Infinity, wallOverlaps = 0, covered = 0, singleRestY = 0;
    for (const b of bodies) {
      if (b.sleeping) asleep++;
      const speed = b.vel.length() + b.angVel.length() * 0.25;
      if (speed > maxSpeed) maxSpeed = speed;
      if (b.pos.y > maxY) maxY = b.pos.y;
      if (Math.abs(b.pos.x) + b.radius > inX || Math.abs(b.pos.z) + b.radius > inZ) wallOverlaps++;
      if (wantCoverage && b.covered > 0) covered++;
      singleRestY = Math.max(singleRestY, b.radius * 0.93); // Body.floorY, mirrored
    }
    return {
      total: bodies.length, asleep, maxSpeed,
      maxY: maxY === -Infinity ? 0 : maxY,
      wallOverlaps, covered, singleRestY,
    };
  }, [CAB.inX, CAB.inZ, coverage]);
}

/* ------------------------------------------------------------------ */
/* body snapshot / independent measurement                             */
/* ------------------------------------------------------------------ */

/**
 * Snapshots every body in the pile. Tags each body object with a stable
 * `__ckid` on first sight so before/after snapshots can be matched by
 * identity even if the array is spliced (a toy winning removes it).
 */
async function snapshotBodies(page) {
  return page.evaluate(() => {
    const bodies = window.__crane.game.pile.bodies;
    return bodies.map((b, idx) => {
      if (b.__ckid == null) b.__ckid = `${idx}:${Math.random().toString(36).slice(2, 9)}`;
      return {
        id: b.__ckid,
        x: b.pos.x, y: b.pos.y, z: b.pos.z,
        qx: b.quat.x, qy: b.quat.y, qz: b.quat.z, qw: b.quat.w,
        radius: b.radius,
        species: b.plush ? b.plush.species : '?',
        variant: b.plush ? b.plush.variant : 0,
      };
    });
  });
}

/**
 * Independent measurement: diff two body snapshots by identity, with no
 * reference to anything the game itself claims happened. This is what
 * catches a director that logs a score it did not actually earn.
 *
 * Shape: { removed, maxTrans, maxTransSpecies, maxRotDeg, neighboursMoved, matchedCount }
 *   removed          -- bodies present before and gone after (won -> left the pile)
 *   maxTrans         -- largest 3D position delta among matched bodies (metres)
 *   maxRotDeg        -- largest quaternion-angle delta among matched bodies (degrees)
 *   neighboursMoved  -- matched bodies OTHER than the max-translation one that
 *                        moved more than DRAMA.NEIGHBOUR metres (an independent
 *                        "something else in the pile visibly moved" count)
 */
function diffBodies(before, after, neighbourThreshold) {
  const afterById = new Map(after.map((b) => [b.id, b]));
  let removed = 0;
  let maxTrans = 0, maxTransId = null, maxTransSpecies = '';
  let maxRotDeg = 0;
  const matched = [];
  for (const b0 of before) {
    const b1 = afterById.get(b0.id);
    if (!b1) { removed++; continue; }
    const dx = b1.x - b0.x, dy = b1.y - b0.y, dz = b1.z - b0.z;
    const trans = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const dot = Math.min(1, Math.abs(b0.qx * b1.qx + b0.qy * b1.qy + b0.qz * b1.qz + b0.qw * b1.qw));
    const rotDeg = (2 * Math.acos(dot)) * 180 / Math.PI;
    matched.push({ id: b0.id, species: b0.species, trans, rotDeg });
    if (trans > maxTrans) { maxTrans = trans; maxTransId = b0.id; maxTransSpecies = b0.species; }
    if (rotDeg > maxRotDeg) maxRotDeg = rotDeg;
  }
  const neighboursMoved = matched.filter((m) => m.id !== maxTransId && m.trans > neighbourThreshold).length;
  return { removed, maxTrans, maxTransSpecies, maxRotDeg, neighboursMoved, matchedCount: matched.length };
}

/* ------------------------------------------------------------------ */
/* aim point selection                                                 */
/* ------------------------------------------------------------------ */

/** Build a plan of N shot categories: mostly centre/offset, with ~2 far shots spread out. */
function buildPlan(n) {
  const plan = new Array(n);
  for (let i = 0; i < n; i++) plan[i] = i % 2 === 0 ? 'centre' : 'offset';
  const farCount = Math.min(2, n);
  for (let k = 0; k < farCount; k++) {
    const idx = Math.min(n - 1, Math.floor(((k + 1) * n) / (farCount + 1)));
    plan[idx] = 'far';
  }
  return plan;
}

/**
 * Finds the corner of the aim plane that is farthest from every current toy.
 * We never hardcode the cabinet's aim bounds: game.setAim() clamps internally,
 * so we probe with out-of-range coordinates and read back the clamped result.
 */
async function pickFarAim(page) {
  const candidates = [[-10, -10], [10, -10], [-10, 10], [10, 10]];
  let best = null;
  for (const [rx, rz] of candidates) {
    const res = await page.evaluate(([x, z]) => {
      const g = window.__crane.game;
      g.setAim(x, z);
      let minD = Infinity;
      for (const b of g.pile.bodies) {
        const d = Math.hypot(b.pos.x - g.aim.x, b.pos.z - g.aim.y);
        if (d < minD) minD = d;
      }
      return { x: g.aim.x, z: g.aim.y, minD };
    }, [rx, rz]);
    if (!best || res.minD > best.minD) best = res;
  }
  return best;
}

async function pickAim(page, category, before) {
  if (category === 'far') return pickFarAim(page);
  const b = before[Math.floor(Math.random() * before.length)];
  if (category === 'centre') return { x: b.x, z: b.z, minD: 0 };
  const dist = 0.55 + Math.random() * 0.40; // README: 0.50-0.74 slip, 0.74-1.25 push
  const ang = Math.random() * Math.PI * 2;
  return { x: b.x + Math.cos(ang) * dist, z: b.z + Math.sin(ang) * dist, minD: dist };
}

/* ------------------------------------------------------------------ */
/* drama subcommand                                                    */
/* ------------------------------------------------------------------ */

// Generous per-beat stall detector. Every named beat in BEAT (src/contracts.js)
// is comfortably under 1s of game time; the file's own "full grab" timeouts
// (240000ms for a ~6.3s sequence) imply a swiftshader slow-motion factor
// around 38x, so even the longest single beat at that factor lands well
// under a minute. If game.state hasn't changed in this long, the FSM is
// genuinely stuck, not just rendering slowly.
const BEAT_STALL_MS = 60000;

/**
 * Polls game.state until it reaches a resting point ('won' or 'aim'), or
 * until it hasn't changed for BEAT_STALL_MS -- never sleeps a fixed
 * wall-clock duration, and never throws (a stall is reported, not thrown).
 */
async function pollGrab(page) {
  const t0 = Date.now();
  let last = null;
  let lastChangeT = t0;
  const seq = [];
  for (;;) {
    let cur;
    try {
      cur = await page.evaluate(() => window.__crane.game.state);
    } catch (err) {
      return {
        finalState: null, timedOut: true, crashed: true,
        stalledAt: last, stalledMs: Date.now() - lastChangeT, seq,
        error: String((err && err.message) || err),
      };
    }
    const now = Date.now();
    if (cur !== last) {
      last = cur;
      lastChangeT = now;
      seq.push({ state: cur, tMs: now - t0 });
      if (cur === 'won' || cur === 'aim') return { finalState: cur, timedOut: false, seq };
    }
    if (now - lastChangeT > BEAT_STALL_MS) {
      return { finalState: cur, timedOut: true, stalledAt: cur, stalledMs: now - lastChangeT, seq };
    }
    await sleep(40);
  }
}

/** Recovery from a stalled/broken grab: close the current page and open a
 *  fresh one, so the remaining grabs in the run get a clean shot. */
async function recoverPage(browser, errors) {
  const msg = 'recovering: closing the stalled/broken page and opening a fresh one';
  console.log(`WARN: ${msg}`);
  errors.warnings.push(msg);
  return openPage(browser, { name: 'drama', width: 390, height: 844 }, errors);
}

function failRow(i, cat, reason, detail) {
  return {
    i, cat, aim: null, won: false,
    diff: { maxTrans: 0, maxRotDeg: 0, neighboursMoved: 0, removed: 0 },
    logEntry: null, pass: null, mismatch: false, stalled: true, reason, detail,
  };
}

async function cmdDrama(n) {
  const { MIN_DRAMA, DRAMA } = readContract();
  const errors = newErrors();
  const browser = await launchBrowser();
  let opened = await openPage(browser, { name: 'drama', width: 390, height: 844 }, errors);

  if (opened.boot.ok) {
    await waitFor(opened.page, () => window.__crane.game.state === 'aim', {
      label: 'initial idle', timeoutMs: 60000, errors,
    });
  } else {
    console.log('WARN: page never booted (window.__crane never appeared); every grab will be recorded as a stall.');
  }

  const plan = buildPlan(n);
  const rows = [];
  let directorMissing = false;
  let guaranteeFailures = 0;

  for (let i = 0; i < n; i++) {
    const ready = await waitFor(opened.page, () => window.__crane.game.state === 'aim', {
      label: `grab ${i} ready`, timeoutMs: 30000, errors,
    });
    if (!ready.ok) {
      rows.push(failRow(i, plan[i], 'not ready', `game.state stuck at '${ready.state}'`));
      opened = await recoverPage(browser, errors);
      continue;
    }

    let before;
    try {
      before = await snapshotBodies(opened.page);
    } catch (err) {
      rows.push(failRow(i, plan[i], 'snapshot failed', String((err && err.message) || err)));
      opened = await recoverPage(browser, errors);
      continue;
    }
    if (before.length === 0) {
      rows.push(failRow(i, plan[i], 'pile empty', 'cannot pick an aim point'));
      opened = await recoverPage(browser, errors);
      continue;
    }

    const cat = plan[i];
    let aim, started = false;
    try {
      aim = await pickAim(opened.page, cat, before);
      await opened.page.evaluate(([x, z]) => window.__crane.game.setAim(x, z), [aim.x, aim.z]);
      started = await opened.page.evaluate(() => window.__crane.game.startGrab());
    } catch (err) {
      rows.push(failRow(i, cat, 'aim/startGrab failed', String((err && err.message) || err)));
      opened = await recoverPage(browser, errors);
      continue;
    }
    if (!started) {
      rows.push(failRow(i, cat, 'startGrab false', "game.state was not 'aim'"));
      opened = await recoverPage(browser, errors);
      continue;
    }

    const poll = await pollGrab(opened.page);
    if (poll.timedOut) {
      const reason = poll.crashed ? 'page crashed' : `stalled in beat '${poll.stalledAt}'`;
      const msg = `grab ${i}: ${reason} for ${poll.stalledMs}ms`;
      console.log(`WARN: ${msg}`);
      errors.warnings.push(msg);
      rows.push(failRow(i, cat, reason, `${poll.stalledMs}ms`));
      opened = await recoverPage(browser, errors);
      continue;
    }

    const won = poll.finalState === 'won';
    if (won) {
      try {
        await opened.page.click('#btn-again');
        await waitFor(opened.page, () => window.__crane.game.state === 'aim', {
          label: `grab ${i} dismiss reveal`, timeoutMs: 30000, errors,
        });
      } catch (err) {
        errors.warnings.push(`grab ${i}: dismissing the reveal failed: ${String((err && err.message) || err)}`);
      }
    }

    let after;
    try {
      after = await snapshotBodies(opened.page);
    } catch {
      after = before; // best effort -- diff will read as "nothing moved", which is honest
    }
    const diff = diffBodies(before, after, DRAMA.NEIGHBOUR);

    let logEntry = null;
    try {
      logEntry = await opened.page.evaluate(() => {
        const log = window.__crane.game.dramaLog;
        return Array.isArray(log) && log.length ? log[log.length - 1] : null;
      });
    } catch { /* leave logEntry null, reported below */ }

    let pass = null;
    let mismatch = false;
    if (!logEntry) {
      directorMissing = true;
      guaranteeFailures++;
    } else {
      pass = typeof logEntry.score === 'number' && logEntry.score >= MIN_DRAMA;
      if (!pass) guaranteeFailures++;
      // The one bug this tool exists to catch: the game claims a score but
      // our own, independent before/after measurement saw nothing move.
      const nothingMoved = diff.maxTrans < 0.01 && diff.maxRotDeg < 1 && diff.removed === 0;
      if (nothingMoved && typeof logEntry.score === 'number' && logEntry.score > 0) mismatch = true;
    }

    rows.push({ i, cat, aim, won, diff, logEntry, pass, mismatch, stalled: false });
  }

  /* ---- table ---- */
  const headers = ['#', 'aim', 'type', 'outcome', 'chute', 'score', 'retry', 'dPos', 'dRot', 'other', 'flag'];
  const widths = [3, 7, 6, 9, 6, 6, 5, 6, 6, 6, 34];
  const tableRows = rows.map((r) => {
    if (r.stalled) {
      return [String(r.i), r.cat || '-', '-', 'STALL', '-', '-', '-', '-', '-', '-', `${r.reason}: ${r.detail}`];
    }
    return [
      String(r.i),
      r.cat,
      r.logEntry ? String(r.logEntry.grabType ?? '-') : '-',
      r.logEntry ? r.logEntry.outcome : '(none)',
      r.logEntry ? String(r.logEntry.chute) : '-',
      r.logEntry ? String(r.logEntry.score) : '-',
      r.logEntry ? (r.logEntry.retried ? 'yes' : 'no') : '-',
      r.diff.maxTrans.toFixed(2),
      r.diff.maxRotDeg.toFixed(0),
      String(r.diff.neighboursMoved),
      r.mismatch ? 'MISMATCH' : '',
    ];
  });
  printTable(headers, tableRows, widths);

  /* ---- summary ---- */
  const outcomeDist = {};
  const chuteDist = {};
  const grabTypeDist = {};
  let retriedCount = 0;
  for (const r of rows) {
    if (r.logEntry) {
      outcomeDist[r.logEntry.outcome] = (outcomeDist[r.logEntry.outcome] || 0) + 1;
      const c = String(r.logEntry.chute);
      chuteDist[c] = (chuteDist[c] || 0) + 1;
      if (r.logEntry.grabType) grabTypeDist[r.logEntry.grabType] = (grabTypeDist[r.logEntry.grabType] || 0) + 1;
      if (r.logEntry.retried) retriedCount++;
    }
  }
  const completed = rows.filter((r) => !r.stalled);
  const maxTransAll = completed.length ? Math.max(...completed.map((r) => r.diff.maxTrans)) : 0;
  const maxRotAll = completed.length ? Math.max(...completed.map((r) => r.diff.maxRotDeg)) : 0;
  const avgNeighbours = completed.length ? completed.reduce((a, r) => a + r.diff.neighboursMoved, 0) / completed.length : 0;
  const wonCount = rows.filter((r) => r.won).length;
  const stalls = rows.filter((r) => r.stalled);
  const mismatches = rows.filter((r) => r.mismatch);

  console.log('');
  console.log(`grabs run: ${n}   MIN_DRAMA (src/contracts.js): ${MIN_DRAMA}`);
  console.log(`aim categories: ${plan.filter((c) => c === 'centre').length} centre, ${plan.filter((c) => c === 'offset').length} offset, ${plan.filter((c) => c === 'far').length} far`);
  console.log(`outcome distribution:  ${JSON.stringify(outcomeDist)}`);
  console.log(`chute distribution:    ${JSON.stringify(chuteDist)}`);
  console.log(`grabType distribution: ${JSON.stringify(grabTypeDist)}`);
  console.log(`retried: ${retriedCount}/${n}   won (reached reveal): ${wonCount}/${n}   stalled/skipped: ${stalls.length}/${n}`);
  console.log(`independent measurement -- max dPos across completed grabs: ${maxTransAll.toFixed(2)}m, max dRot: ${maxRotAll.toFixed(0)}deg, avg other-toys-moved: ${avgNeighbours.toFixed(2)}`);

  const scoredRows = rows.filter((r) => r.logEntry);
  const grabTypeKeys = Object.keys(grabTypeDist);
  if (scoredRows.length >= 2 && grabTypeKeys.length === 1) {
    const msg = `every scored grab returned grabType='${grabTypeKeys[0]}' -- the grab-point mechanic does not appear to vary by aim.`;
    console.log(`\n*** WARNING: ${msg} ***`);
    errors.warnings.push(msg);
  }

  if (mismatches.length) {
    console.log(`\nMISMATCH: ${mismatches.length} grab(s) claimed a score but the independent measurement saw nothing move:`);
    for (const r of mismatches) {
      console.log(`  grab ${r.i}: game says outcome=${r.logEntry.outcome} score=${r.logEntry.score}, but measured maxDPos=${r.diff.maxTrans.toFixed(3)}m maxDRot=${r.diff.maxRotDeg.toFixed(1)}deg removed=${r.diff.removed}`);
    }
  }

  if (stalls.length) {
    console.log(`\nSTALL: ${stalls.length}/${n} grab(s) did not complete and were skipped (page recovered afterward):`);
    for (const r of stalls) console.log(`  grab ${r.i}: ${r.reason} (${r.detail})`);
  }

  if (directorMissing) {
    console.log(`\nFAIL: game.dramaLog is missing or empty -- the drama director has not landed yet.`);
    console.log(`      (this harness targets the wave-2 contract; re-run once game.dramaLog exists.)`);
  } else if (guaranteeFailures > 0) {
    console.log(`\nFAIL: ${guaranteeFailures}/${n} grabs scored below MIN_DRAMA (${MIN_DRAMA}).`);
  } else if (stalls.length > 0) {
    console.log(`\nFAIL: ${stalls.length}/${n} grabs stalled and never completed.`);
  } else if (mismatches.length > 0) {
    console.log(`\nFAIL: ${mismatches.length}/${n} grabs claimed a score with no measured movement.`);
  } else {
    console.log(`\nPASS: every grab scored at least MIN_DRAMA (${MIN_DRAMA}), completed, and matched its own claim.`);
  }

  printErrors(errors);
  try { await opened.context.close(); } catch { /* already gone */ }
  await browser.close();
  if (guaranteeFailures > 0 || stalls.length > 0 || mismatches.length > 0 || hasFailure(errors)) process.exitCode = 1;
}

/* ------------------------------------------------------------------ */
/* beats subcommand                                                    */
/* ------------------------------------------------------------------ */

async function cmdBeats() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const errors = newErrors();
  const browser = await launchBrowser();
  const opened = await openPage(browser, { name: 'beats', width: 390, height: 844 }, errors);
  const { context, page } = opened;

  if (!opened.boot.ok) {
    console.log('\nFAIL: page never booted (window.__crane never appeared) -- no beats to report.');
    printErrors(errors);
    await context.close();
    await browser.close();
    process.exitCode = 1;
    return;
  }

  await waitFor(page, () => window.__crane.game.state === 'aim', { label: 'initial idle', timeoutMs: 60000, errors });

  let before = [];
  try { before = await snapshotBodies(page); } catch (err) { errors.warnings.push(`snapshot failed: ${String((err && err.message) || err)}`); }

  let started = false;
  if (before.length) {
    const target = before[Math.floor(Math.random() * before.length)]; // dead-centre: run the full happy-path sequence
    try {
      await page.evaluate(([x, z]) => window.__crane.game.setAim(x, z), [target.x, target.z]);
      started = await page.evaluate(() => window.__crane.game.startGrab());
    } catch (err) { errors.warnings.push(`startGrab failed: ${String((err && err.message) || err)}`); }
  } else {
    console.log('WARN: pile is empty or unreadable -- cannot pick an aim point.');
  }
  if (!started) errors.warnings.push("startGrab() did not start (game.state was not 'aim', or the pile was empty)");

  const t0 = Date.now();
  const MAX_WALL = 5 * 60 * 1000; // generous: swiftshader runs the game in slow motion
  const seq = [];
  let n = 0;
  let last = null;
  let stalled = false;

  if (started) {
    for (;;) {
      let cur;
      try {
        cur = await page.evaluate(() => window.__crane.game.state);
      } catch (err) {
        errors.warnings.push(`beats: page went away mid-sequence: ${String((err && err.message) || err)}`);
        break;
      }
      if (cur !== last) {
        last = cur;
        const file = `beat-${String(n).padStart(2, '0')}-${cur}.png`;
        try { await page.screenshot({ path: path.join(OUT_DIR, file) }); } catch { /* keep going */ }
        seq.push({ state: cur, tMs: Date.now() - t0, file });
        n++;
        if (cur === 'won') break;
      }
      if (Date.now() - t0 > MAX_WALL) {
        const msg = `beats: state stuck at '${last}' after ${MAX_WALL}ms of wall-clock time`;
        console.log(`WARN: ${msg}`);
        errors.warnings.push(msg);
        stalled = true;
        break;
      }
      await sleep(40); // poll tick, not a game-time assumption
    }
  }

  // dismiss the reveal so the page is left in a clean, playable state (best effort)
  try {
    await page.click('#btn-again');
    await waitFor(page, () => window.__crane.game.state === 'aim', { label: 'dismiss reveal', timeoutMs: 30000, errors });
  } catch { /* not fatal to the report */ }

  console.log(`beats: ${seq.length} FSM states captured, total wall-clock ${(Date.now() - t0) / 1000}s${stalled ? ' (STALLED, incomplete)' : ''}\n`);
  const headers = ['#', 'state', 't(ms)', 'file'];
  const widths = [3, 10, 8, 30];
  printTable(headers, seq.map((s, i) => [String(i), s.state, String(s.tMs), s.file]), widths);
  console.log(`\nscreenshots written to ${path.relative(process.cwd(), OUT_DIR) || 'tools/out'}/`);

  printErrors(errors);
  await context.close();
  await browser.close();
  if (hasFailure(errors)) process.exitCode = 1;
}

/* ------------------------------------------------------------------ */
/* shots subcommand                                                    */
/* ------------------------------------------------------------------ */

async function cmdShots() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const errors = newErrors();
  const browser = await launchBrowser();

  const viewports = [
    { name: 'iphone-portrait', width: 390, height: 844 },
    { name: 'iphone-landscape', width: 844, height: 390 },
    { name: 'ipad-portrait', width: 820, height: 1180 },
    { name: 'ipad-landscape', width: 1180, height: 820 },
  ];

  const written = [];
  for (const vp of viewports) {
    const opened = await openPage(browser, vp, errors);
    const { context, page } = opened;
    if (!opened.boot.ok) {
      console.log(`WARN: ${vp.name}: page never booted -- screenshot skipped.`);
      await context.close();
      continue;
    }
    await waitFor(page, () => window.__crane.game.state === 'aim', { label: `${vp.name} idle`, timeoutMs: 60000, errors });
    const file = `shot-${vp.name}.png`;
    try {
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      written.push(file);
    } catch (err) {
      errors.warnings.push(`${vp.name}: screenshot failed: ${String((err && err.message) || err)}`);
    }
    await context.close();
  }

  // Collection room: seed localStorage before the game boots, then open the room.
  const seed = [
    { species: 'rabbit', variant: 0, t: Date.now() - 50000 },
    { species: 'bear', variant: 1, t: Date.now() - 40000 },
    { species: 'unicorn', variant: 2, t: Date.now() - 30000 },
    { species: 'cat', variant: 0, t: Date.now() - 20000 },
    { species: 'chick', variant: 1, t: Date.now() - 10000 },
  ];
  const roomVp = { name: 'room-portrait', width: 390, height: 844 };
  const roomOpened = await openPage(browser, roomVp, errors, {
    initScript: {
      fn: ([key, val]) => { try { window.localStorage.setItem(key, val); } catch { /* ignore */ } },
      arg: [STORAGE_KEY, JSON.stringify(seed)],
    },
  });
  const { context: roomContext, page: roomPage } = roomOpened;
  if (!roomOpened.boot.ok) {
    console.log('WARN: room-portrait: page never booted -- room screenshot skipped.');
  } else {
    await waitFor(roomPage, () => window.__crane.game.state === 'aim', { label: 'room-portrait idle', timeoutMs: 60000, errors });
    try {
      await roomPage.click('#btn-room');
      await waitFor(roomPage, () => document.body.dataset.mode === 'room', { label: 'room mode switch', timeoutMs: 30000, errors });
      await sleep(300); // brief visual settle for the room camera/pose tween before the screenshot
      const roomFile = 'shot-room-portrait.png';
      await roomPage.screenshot({ path: path.join(OUT_DIR, roomFile) });
      written.push(roomFile);
    } catch (err) {
      errors.warnings.push(`room-portrait: ${String((err && err.message) || err)}`);
    }
  }
  await roomContext.close();

  console.log(`shots written to ${path.relative(process.cwd(), OUT_DIR) || 'tools/out'}/:`);
  for (const f of written) console.log(`  ${f}`);

  printErrors(errors);
  await browser.close();
  if (hasFailure(errors)) process.exitCode = 1;
}

/* ------------------------------------------------------------------ */
/* perf subcommand                                                     */
/* ------------------------------------------------------------------ */

const BUDGET = { drawCalls: 340, triangles: 120000 };

// Cut way down from the old 120000ms: sleep kicks in SLEEP_TIME (0.30s of
// game time) after a body's speed drops below SLEEP_SPEED (pile.js), and
// layout() has already pre-settled + zeroed velocities before the game even
// reaches 'aim'. So a healthy pile sleeps within about a game-second. Even
// generously converted for swiftshader slow motion (the file's other timeouts
// imply up to a ~38x wall/game ratio), that is nowhere near two minutes -- if
// it hasn't slept by here, it is genuinely stuck, and waiting longer only
// delays the diagnostic that actually explains why.
const SETTLE_TIMEOUT_MS = 15000;

async function cmdPerf() {
  const errors = newErrors();
  const CAB = readCAB();
  const browser = await launchBrowser();
  const opened = await openPage(browser, { name: 'perf', width: 390, height: 844 }, errors);
  const { context, page } = opened;

  if (!opened.boot.ok) {
    console.log('\nFAIL: page never booted (window.__crane never appeared) -- no perf numbers to report.');
    printErrors(errors);
    await context.close();
    await browser.close();
    process.exitCode = 1;
    return;
  }

  await waitFor(page, () => window.__crane.game.state === 'aim', { label: 'boot', timeoutMs: 60000, errors });
  // let the pile finish settling so we measure the steady-state play scene
  const settleWait = await waitFor(page, () => window.__crane.game.pile.bodies.every((b) => b.sleeping), {
    label: 'pile settle', timeoutMs: SETTLE_TIMEOUT_MS, errors,
  });
  if (!settleWait.ok) {
    const diag = await pileDiag(page, CAB);
    console.log(`WARN: pile never fully settled before the ${SETTLE_TIMEOUT_MS}ms deadline -- measuring renderer stats anyway, with a still-moving pile:`);
    console.log(`  bodies asleep       : ${diag.asleep}/${diag.total}`);
    console.log(`  max speed in pile   : ${diag.maxSpeed.toFixed(3)} (m/s + 0.25*rad/s, pile.js's own sleep metric)`);
    console.log(`  highest body centre : ${diag.maxY.toFixed(3)} m`);
    console.log(`  bodies over a wall  : ${diag.wallOverlaps}`);
    console.log('');
  }
  await sleep(200); // one more render or two, so renderer.info reflects the current frame

  const data = await page.evaluate(() => {
    const r = window.__crane.renderer;
    const g = window.__crane.game;
    let meshCount = 0;
    g.scene.traverse((o) => { if (o.isMesh) meshCount++; });
    return {
      calls: r.info.render.calls,
      triangles: r.info.render.triangles,
      programs: r.info.programs ? r.info.programs.length : null,
      textures: r.info.memory.textures,
      geometries: r.info.memory.geometries,
      meshCount,
      pixelRatio: r.getPixelRatio(),
    };
  });

  console.log(`play scene${settleWait.ok ? ', settled' : ', NOT settled (see WARN above)'}:`);
  console.log(`  draw calls   : ${data.calls}`);
  console.log(`  triangles    : ${data.triangles}`);
  console.log(`  programs     : ${data.programs}`);
  console.log(`  textures     : ${data.textures}`);
  console.log(`  geometries   : ${data.geometries}`);
  console.log(`  scene meshes : ${data.meshCount}`);
  console.log(`  pixel ratio  : ${data.pixelRatio}`);
  console.log('');
  const callsVerdict = data.calls <= BUDGET.drawCalls ? 'PASS' : 'WARN';
  const triVerdict = data.triangles <= BUDGET.triangles ? 'PASS' : 'WARN';
  console.log(`${callsVerdict} draw calls  ${data.calls} / budget ${BUDGET.drawCalls}`);
  console.log(`${triVerdict} triangles   ${data.triangles} / budget ${BUDGET.triangles}`);

  printErrors(errors);
  await context.close();
  await browser.close();
  if (hasFailure(errors)) process.exitCode = 1;
}

/* ------------------------------------------------------------------ */
/* settle subcommand                                                   */
/* ------------------------------------------------------------------ */

// The heap must reach at least this multiple of a single toy's own resting
// centre height (radius*0.93, alone on the floor) to count as more than one
// layer. layout()'s own targets put layer 1 near ~2.5x that and layer 2
// higher still, so 1.4x safely separates "collapsed to one layer" (~1.0-1.1x)
// from a real heap without depending on any specific species' radius.
const MIN_LAYER_MARGIN = 1.4;

async function cmdSettle(runs) {
  const errors = newErrors();
  const CAB = readCAB();
  const browser = await launchBrowser();
  const opened = await openPage(browser, { name: 'settle', width: 390, height: 844 }, errors);
  const { context, page } = opened;

  if (!opened.boot.ok) {
    console.log('\nFAIL: page never booted (window.__crane never appeared) -- no settle data to report.');
    printErrors(errors);
    await context.close();
    await browser.close();
    process.exitCode = 1;
    return;
  }

  await waitFor(page, () => window.__crane.game.state === 'aim', { label: 'boot', timeoutMs: 60000, errors });

  const rows = [];
  for (let i = 0; i < runs; i++) {
    if (i > 0) {
      // a fresh seed every run, so a lucky layout cannot carry the check
      try {
        await page.evaluate(() => window.__crane.game.newRound(true));
      } catch (err) {
        rows.push({ i, diag: null, note: `newRound(true) failed: ${String((err && err.message) || err)}` });
        continue;
      }
    }

    const settleWait = await waitFor(page, () => window.__crane.game.pile.bodies.every((b) => b.sleeping), {
      label: `settle run ${i}`, timeoutMs: SETTLE_TIMEOUT_MS, errors,
    });
    let diag;
    try {
      diag = await pileDiag(page, CAB, { coverage: true });
    } catch (err) {
      rows.push({ i, diag: null, note: `diagnostic read failed: ${String((err && err.message) || err)}` });
      continue;
    }

    const asleepPass = diag.total > 0 && diag.asleep === diag.total;
    const wallPass = diag.wallOverlaps === 0;
    const heightPass = diag.maxY > diag.singleRestY * MIN_LAYER_MARGIN;
    const coveredPass = diag.covered >= 1;
    const pass = asleepPass && wallPass && heightPass && coveredPass;

    rows.push({ i, settled: settleWait.ok, diag, asleepPass, wallPass, heightPass, coveredPass, pass });
  }

  const headers = ['run', 'settled', 'asleep', 'maxSpd', 'maxY(m)', 'wallOvlp', 'covered', 'verdict'];
  const widths = [4, 9, 9, 8, 9, 9, 9, 8];
  const tableRows = rows.map((r) => {
    if (!r.diag) return [String(r.i), '-', '-', '-', '-', '-', '-', 'FAIL'];
    return [
      String(r.i),
      r.settled ? 'yes' : 'NO(warn)',
      `${r.diag.asleep}/${r.diag.total}`,
      r.diag.maxSpeed.toFixed(3),
      r.diag.maxY.toFixed(3),
      String(r.diag.wallOverlaps),
      String(r.diag.covered),
      r.pass ? 'PASS' : 'FAIL',
    ];
  });
  printTable(headers, tableRows, widths);

  console.log('');
  console.log(`pass criteria per run: all bodies asleep; zero wall overlaps; highest centre > ${MIN_LAYER_MARGIN}x a single toy's own resting height; >=1 body has covered>0 after refreshCoverage().`);
  console.log(`(CAB.inX=${CAB.inX}, CAB.inZ=${CAB.inZ}, read live from src/cabinet.js)`);

  const failedRuns = rows.filter((r) => !r.pass);
  if (failedRuns.length) {
    console.log('');
    for (const r of failedRuns) {
      if (!r.diag) { console.log(`  run ${r.i}: FAIL -- ${r.note}`); continue; }
      const reasons = [];
      if (!r.asleepPass) reasons.push(`only ${r.diag.asleep}/${r.diag.total} asleep`);
      if (!r.wallPass) reasons.push(`${r.diag.wallOverlaps} bodies crossing an interior wall`);
      if (!r.heightPass) reasons.push(`highest centre ${r.diag.maxY.toFixed(3)}m <= ${(r.diag.singleRestY * MIN_LAYER_MARGIN).toFixed(3)}m -- heap looks collapsed to one layer`);
      if (!r.coveredPass) reasons.push('no body has covered>0 -- nothing is buried');
      console.log(`  run ${r.i}: FAIL -- ${reasons.join('; ')}`);
    }
  }

  const allPass = rows.length > 0 && rows.every((r) => r.pass);
  console.log('');
  console.log(allPass
    ? `PASS: all ${runs} run(s) settled into a plausible heap.`
    : `FAIL: ${failedRuns.length}/${runs} run(s) failed the settle check.`);

  printErrors(errors);
  await context.close();
  await browser.close();
  if (!allPass || hasFailure(errors)) process.exitCode = 1;
}

/* ------------------------------------------------------------------ */
/* entry point                                                         */
/* ------------------------------------------------------------------ */

async function main() {
  const [, , cmd, arg] = process.argv;
  if (cmd === 'drama') {
    const n = arg ? Number(arg) : 24;
    if (!Number.isFinite(n) || n <= 0) throw new Error(`bad N: ${arg}`);
    await cmdDrama(n);
  } else if (cmd === 'beats') {
    await cmdBeats();
  } else if (cmd === 'shots') {
    await cmdShots();
  } else if (cmd === 'perf') {
    await cmdPerf();
  } else if (cmd === 'settle') {
    const n = arg ? Number(arg) : 3;
    if (!Number.isFinite(n) || n <= 0) throw new Error(`bad N: ${arg}`);
    await cmdSettle(n);
  } else {
    console.error('usage: node tools/check.mjs <drama [N]|beats|shots|perf|settle [N]>');
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(`\nFATAL: ${err && err.stack ? err.stack : err}`);
  process.exitCode = 1;
});
