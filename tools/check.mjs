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
//
// See tools/README.md for the swiftshader / slow-motion caveat.

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
  await waitFor(page, () => !!(window.__crane && window.__crane.game), { label: 'boot (__crane ready)', timeoutMs: 60000 });
  return { context, page };
}

/**
 * Polls `predicate` (a function evaluated in-page, no closures) until true.
 * Rendering here is software (swiftshader) and runs in slow motion in
 * wall-clock time, so timeouts are generous and we never sleep a fixed
 * duration hoping game state has moved on -- we poll it directly.
 */
async function waitFor(page, predicate, { timeoutMs = 60000, label = 'condition', polling = 50 } = {}) {
  try {
    await page.waitForFunction(predicate, null, { timeout: timeoutMs, polling });
  } catch (err) {
    let state = '?';
    try {
      state = await page.evaluate(() => (window.__crane && window.__crane.game ? window.__crane.game.state : '(no __crane)'));
    } catch { /* page may be gone */ }
    throw new Error(`waitFor(${label}) timed out after ${timeoutMs}ms -- game.state=${state}: ${err.message}`);
  }
}

function newErrors() { return { consoleErrors: [], pageErrors: [] }; }

function printErrors(errors) {
  const total = errors.consoleErrors.length + errors.pageErrors.length;
  console.log(`\nconsole/page errors: ${total}`);
  for (const e of errors.pageErrors) console.log(`  [pageerror] ${e}`);
  for (const e of errors.consoleErrors) console.log(`  [console]   ${e}`);
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

async function cmdDrama(n) {
  const { MIN_DRAMA, DRAMA } = readContract();
  const errors = newErrors();
  const browser = await launchBrowser();
  const { page } = await openPage(browser, { name: 'drama', width: 390, height: 844 }, errors);
  await waitFor(page, () => window.__crane.game.state === 'aim', { label: 'initial idle', timeoutMs: 120000 });

  const plan = buildPlan(n);
  const rows = [];
  let directorMissing = false;
  let guaranteeFailures = 0;

  for (let i = 0; i < n; i++) {
    await waitFor(page, () => window.__crane.game.state === 'aim', { label: `grab ${i} ready`, timeoutMs: 180000 });
    const before = await snapshotBodies(page);
    if (before.length === 0) throw new Error(`grab ${i}: pile is empty, cannot pick an aim point`);

    const cat = plan[i];
    const aim = await pickAim(page, cat, before);
    await page.evaluate(([x, z]) => window.__crane.game.setAim(x, z), [aim.x, aim.z]);
    const started = await page.evaluate(() => window.__crane.game.startGrab());
    if (!started) throw new Error(`grab ${i}: startGrab() returned false while state was 'aim'`);

    await waitFor(
      page,
      () => window.__crane.game.state === 'won' || window.__crane.game.state === 'aim',
      { label: `grab ${i} resolve`, timeoutMs: 240000 },
    );

    const won = await page.evaluate(() => window.__crane.game.state === 'won');
    if (won) {
      await page.click('#btn-again');
      await waitFor(page, () => window.__crane.game.state === 'aim', { label: `grab ${i} dismiss reveal`, timeoutMs: 60000 });
    }

    const after = await snapshotBodies(page);
    const diff = diffBodies(before, after, DRAMA.NEIGHBOUR);

    const logEntry = await page.evaluate(() => {
      const log = window.__crane.game.dramaLog;
      return Array.isArray(log) && log.length ? log[log.length - 1] : null;
    });

    let pass = null;
    if (!logEntry) {
      directorMissing = true;
      guaranteeFailures++;
    } else {
      pass = typeof logEntry.score === 'number' && logEntry.score >= MIN_DRAMA;
      if (!pass) guaranteeFailures++;
    }

    rows.push({ i, cat, aim, won, diff, logEntry, pass });
  }

  /* ---- table ---- */
  const headers = ['#', 'aim', 'outcome', 'chute', 'score', 'retry', 'events', 'dPos', 'dRot', 'others'];
  const widths = [3, 7, 8, 6, 6, 5, 22, 6, 6, 6];
  const tableRows = rows.map((r) => [
    String(r.i),
    r.cat,
    r.logEntry ? r.logEntry.outcome : '(none)',
    r.logEntry ? String(r.logEntry.chute) : '-',
    r.logEntry ? String(r.logEntry.score) : '-',
    r.logEntry ? (r.logEntry.retried ? 'yes' : 'no') : '-',
    r.logEntry ? (r.logEntry.events || []).join(',').slice(0, 22) : '-',
    r.diff.maxTrans.toFixed(2),
    r.diff.maxRotDeg.toFixed(0),
    String(r.diff.neighboursMoved),
  ]);
  printTable(headers, tableRows, widths);

  /* ---- summary ---- */
  const outcomeDist = {};
  const chuteDist = {};
  let retriedCount = 0;
  for (const r of rows) {
    if (r.logEntry) {
      outcomeDist[r.logEntry.outcome] = (outcomeDist[r.logEntry.outcome] || 0) + 1;
      const c = String(r.logEntry.chute);
      chuteDist[c] = (chuteDist[c] || 0) + 1;
      if (r.logEntry.retried) retriedCount++;
    }
  }
  const maxTransAll = Math.max(...rows.map((r) => r.diff.maxTrans));
  const maxRotAll = Math.max(...rows.map((r) => r.diff.maxRotDeg));
  const avgNeighbours = rows.reduce((a, r) => a + r.diff.neighboursMoved, 0) / rows.length;
  const wonCount = rows.filter((r) => r.won).length;

  console.log('');
  console.log(`grabs run: ${n}   MIN_DRAMA (src/contracts.js): ${MIN_DRAMA}`);
  console.log(`aim categories: ${plan.filter((c) => c === 'centre').length} centre, ${plan.filter((c) => c === 'offset').length} offset, ${plan.filter((c) => c === 'far').length} far`);
  console.log(`outcome distribution: ${JSON.stringify(outcomeDist)}`);
  console.log(`chute distribution:   ${JSON.stringify(chuteDist)}`);
  console.log(`retried: ${retriedCount}/${n}   won (reached reveal): ${wonCount}/${n}`);
  console.log(`independent measurement -- max dPos across all grabs: ${maxTransAll.toFixed(2)}m, max dRot: ${maxRotAll.toFixed(0)}deg, avg other-toys-moved: ${avgNeighbours.toFixed(2)}`);
  if (directorMissing) {
    console.log(`\nFAIL: game.dramaLog is missing or empty -- the drama director has not landed yet.`);
    console.log(`      (this harness targets the wave-2 contract; re-run once game.dramaLog exists.)`);
  } else if (guaranteeFailures > 0) {
    console.log(`\nFAIL: ${guaranteeFailures}/${n} grabs scored below MIN_DRAMA (${MIN_DRAMA}).`);
  } else {
    console.log(`\nPASS: every grab scored at least MIN_DRAMA (${MIN_DRAMA}).`);
  }

  printErrors(errors);
  await browser.close();
  if (guaranteeFailures > 0 || errors.consoleErrors.length || errors.pageErrors.length) process.exitCode = 1;
}

/* ------------------------------------------------------------------ */
/* beats subcommand                                                    */
/* ------------------------------------------------------------------ */

async function cmdBeats() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const errors = newErrors();
  const browser = await launchBrowser();
  const { page } = await openPage(browser, { name: 'beats', width: 390, height: 844 }, errors);
  await waitFor(page, () => window.__crane.game.state === 'aim', { label: 'initial idle', timeoutMs: 120000 });

  const before = await snapshotBodies(page);
  if (before.length === 0) throw new Error('pile is empty, cannot pick an aim point');
  const target = before[Math.floor(Math.random() * before.length)]; // dead-centre: run the full happy-path sequence
  await page.evaluate(([x, z]) => window.__crane.game.setAim(x, z), [target.x, target.z]);
  const started = await page.evaluate(() => window.__crane.game.startGrab());
  if (!started) throw new Error('startGrab() returned false while state was aim');

  const t0 = Date.now();
  const MAX_WALL = 5 * 60 * 1000; // generous: swiftshader runs the game in slow motion
  const seq = [];
  let n = 0;
  let last = null;
  for (;;) {
    const cur = await page.evaluate(() => window.__crane.game.state);
    if (cur !== last) {
      last = cur;
      const file = `beat-${String(n).padStart(2, '0')}-${cur}.png`;
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      seq.push({ state: cur, tMs: Date.now() - t0, file });
      n++;
      if (cur === 'won') break;
    }
    if (Date.now() - t0 > MAX_WALL) throw new Error(`beats: state stuck at '${last}' after ${MAX_WALL}ms of wall-clock time`);
    await sleep(40); // poll tick, not a game-time assumption
  }

  // dismiss the reveal so the page is left in a clean, playable state
  await page.click('#btn-again').catch(() => {});
  await waitFor(page, () => window.__crane.game.state === 'aim', { label: 'dismiss reveal', timeoutMs: 60000 }).catch(() => {});

  console.log(`beats: ${seq.length} FSM states captured, total wall-clock ${(Date.now() - t0) / 1000}s\n`);
  const headers = ['#', 'state', 't(ms)', 'file'];
  const widths = [3, 10, 8, 30];
  printTable(headers, seq.map((s, i) => [String(i), s.state, String(s.tMs), s.file]), widths);
  console.log(`\nscreenshots written to ${path.relative(process.cwd(), OUT_DIR) || 'tools/out'}/`);

  printErrors(errors);
  await browser.close();
  if (errors.consoleErrors.length || errors.pageErrors.length) process.exitCode = 1;
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
    const { context, page } = await openPage(browser, vp, errors);
    await waitFor(page, () => window.__crane.game.state === 'aim', { label: `${vp.name} idle`, timeoutMs: 120000 });
    const file = `shot-${vp.name}.png`;
    await page.screenshot({ path: path.join(OUT_DIR, file) });
    written.push(file);
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
  const { context, page } = await openPage(browser, roomVp, errors, {
    initScript: {
      fn: ([key, val]) => { try { window.localStorage.setItem(key, val); } catch { /* ignore */ } },
      arg: [STORAGE_KEY, JSON.stringify(seed)],
    },
  });
  await waitFor(page, () => window.__crane.game.state === 'aim', { label: 'room-portrait idle', timeoutMs: 120000 });
  await page.click('#btn-room');
  await waitFor(page, () => document.body.dataset.mode === 'room', { label: 'room mode switch', timeoutMs: 30000 });
  await sleep(300); // brief visual settle for the room camera/pose tween before the screenshot
  const roomFile = 'shot-room-portrait.png';
  await page.screenshot({ path: path.join(OUT_DIR, roomFile) });
  written.push(roomFile);
  await context.close();

  console.log(`shots written to ${path.relative(process.cwd(), OUT_DIR) || 'tools/out'}/:`);
  for (const f of written) console.log(`  ${f}`);

  printErrors(errors);
  await browser.close();
  if (errors.consoleErrors.length || errors.pageErrors.length) process.exitCode = 1;
}

/* ------------------------------------------------------------------ */
/* perf subcommand                                                     */
/* ------------------------------------------------------------------ */

const BUDGET = { drawCalls: 340, triangles: 120000 };

async function cmdPerf() {
  const errors = newErrors();
  const browser = await launchBrowser();
  const { page } = await openPage(browser, { name: 'perf', width: 390, height: 844 }, errors);
  await waitFor(page, () => window.__crane.game.state === 'aim', { label: 'boot', timeoutMs: 120000 });
  // let the pile finish settling so we measure the steady-state play scene
  await waitFor(page, () => window.__crane.game.pile.bodies.every((b) => b.sleeping), { label: 'pile settle', timeoutMs: 120000 });
  await sleep(200); // one more render or two, so renderer.info reflects the settled frame

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

  console.log('play scene, settled:');
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
  await browser.close();
  if (errors.consoleErrors.length || errors.pageErrors.length) process.exitCode = 1;
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
  } else {
    console.error('usage: node tools/check.mjs <drama [N]|beats|shots|perf>');
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(`\nFATAL: ${err && err.stack ? err.stack : err}`);
  process.exitCode = 1;
});
