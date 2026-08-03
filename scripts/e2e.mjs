/**
 * End-to-end playthrough of the whole inspection loop at four viewport
 * sizes (iPhone/iPad, portrait/landscape), driving only real pointer
 * gestures — no debug shortcuts. Saves stage screenshots and fails on
 * any console error or stuck phase.
 *
 * Usage: node scripts/e2e.mjs [--shots-dir DIR]
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const EXECUTABLE = "/opt/pw-browsers/chromium";
const PORT = 4173;
const BASE = `http://localhost:${PORT}/?seed=7`;

const argIdx = process.argv.indexOf("--shots-dir");
const SHOTS = argIdx > -1 ? process.argv[argIdx + 1] : "e2e-shots";

const VIEWPORTS = [
  { name: "iphone-portrait", width: 390, height: 844 },
  { name: "iphone-landscape", width: 844, height: 390 },
  { name: "ipad-portrait", width: 820, height: 1180 },
  { name: "ipad-landscape", width: 1180, height: 820 }
];

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function startServer() {
  const proc = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    cwd: process.cwd(), stdio: "pipe"
  });
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) return proc;
    } catch { /* not up yet */ }
    await wait(300);
  }
  proc.kill();
  throw new Error("preview server did not start");
}

async function snap(page) {
  return page.evaluate(() => window.__lab.snapshot());
}

async function waitPhase(page, phase, timeoutMs = 15000) {
  const t0 = Date.now();
  for (;;) {
    const s = await snap(page);
    if (s.phase === phase) return s;
    if (Date.now() - t0 > timeoutMs) {
      throw new Error(`timeout waiting for phase ${phase}, at ${s.phase} (accum=${s.meanAccumTarget?.toFixed?.(2)}, reveal=${s.meanRevealTarget?.toFixed?.(2)})`);
    }
    await wait(120);
  }
}

async function drag(page, from, to, steps = 14, holdMs = 0) {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const x = from[0] + ((to[0] - from[0]) * i) / steps;
    const y = from[1] + ((to[1] - from[1]) * i) / steps;
    await page.mouse.move(x, y);
    await wait(16);
  }
  if (holdMs) await wait(holdMs);
  await page.mouse.up();
}

async function tap(page, x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await wait(60);
  await page.mouse.up();
}

/** Hold the pointer down and wiggle around a point until check() passes. */
async function holdWiggle(page, cx, cy, radius, check, timeoutMs = 20000) {
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const t0 = Date.now();
  let i = 0;
  for (;;) {
    const a = (i / 7) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius * 0.6);
    await wait(50);
    i++;
    if (i % 4 === 0 && (await check())) break;
    if (Date.now() - t0 > timeoutMs) {
      await page.mouse.up();
      const s = await snap(page);
      throw new Error(`holdWiggle timeout at phase ${s.phase} accum=${s.meanAccumTarget} reveal=${s.meanRevealTarget}`);
    }
  }
  await page.mouse.up();
}

/** Sweep the UV lamp along the target crack until the reveal threshold trips. */
async function uvSweep(page, timeoutMs = 30000) {
  const t0 = Date.now();
  for (;;) {
    const s = await snap(page);
    if (!["uv", "uv2"].includes(s.phase)) return;
    const pts = s.targetPts;
    if (!pts.length) throw new Error("no target crack points");
    const [ox, oy] = s.lampOffset;
    await page.mouse.move(pts[0][0] - ox, pts[0][1] - oy);
    await page.mouse.down();
    for (const [px, py] of pts) {
      await page.mouse.move(px - ox, py - oy);
      await wait(60);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      await page.mouse.move(pts[i][0] - ox, pts[i][1] - oy);
      await wait(60);
    }
    await page.mouse.up();
    const s2 = await snap(page);
    if (!["uv", "uv2"].includes(s2.phase) || s2.meanRevealTarget > 0.78) return;
    if (Date.now() - t0 > timeoutMs) {
      throw new Error(`uv sweep timeout reveal=${s2.meanRevealTarget}`);
    }
  }
}

async function shoot(page, dir, name) {
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

async function playThrough(page, dir, { rotateMidGame = false } = {}) {
  // title -> tap start
  await waitPhase(page, "title", 8000);
  let s = await snap(page);
  const [w, h] = s.size;
  await tap(page, w * 0.62, h * 0.72);
  await waitPhase(page, "clean", 8000);
  await shoot(page, dir, "01-clean-bright");

  // clean: scrub across the face several times
  s = await snap(page);
  const [px, py] = s.partC;
  const R = s.partR;
  for (let round = 0; round < 6; round++) {
    const y = py - R * 0.5 + round * R * 0.22 + 34;
    await drag(page, [px - R * 0.6, y], [px + R * 0.6, y], 12);
    const st = await snap(page);
    if (st.phase !== "clean") break;
  }
  await waitPhase(page, "yoke");
  await shoot(page, dir, "02-clean-done");

  // yoke: drag from home to part center
  s = await snap(page);
  await drag(page, s.yokeHome, [s.partC[0], s.partC[1] + 46], 18);
  await waitPhase(page, "magnetize");
  s = await snap(page);
  await tap(page, s.magnetBtn[0], s.magnetBtn[1]);
  await waitPhase(page, "fluid");
  await shoot(page, dir, "03-magnetized");

  // fluid: pour over the face
  s = await snap(page);
  await holdWiggle(page, s.partC[0], s.partC[1], R * 0.45, async () => {
    const st = await snap(page);
    return st.meanAccumTarget > 0.5 || st.phase !== "fluid";
  });
  await waitPhase(page, "curtain");
  await shoot(page, dir, "04-fluid-applied");

  // curtain: swipe down from the tab
  s = await snap(page);
  await drag(page, s.curtainTab, [s.curtainTab[0], h * 0.85], 16, 120);
  await waitPhase(page, "uv", 12000);
  await shoot(page, dir, "05-curtain-closed");

  if (rotateMidGame) {
    // orientation change mid-UV must preserve the phase
    const vp = page.viewportSize();
    await page.setViewportSize({ width: vp.height, height: vp.width });
    await wait(400);
    const st = await snap(page);
    if (st.phase !== "uv") throw new Error(`phase lost on rotation: ${st.phase}`);
    await page.setViewportSize(vp);
    await wait(400);
  }

  // uv sweep pass 1 (screenshot mid-sweep)
  const sweepP = uvSweep(page);
  await wait(650);
  await shoot(page, dir, "06-uv-scanning");
  await sweepP;
  await waitPhase(page, "record", 20000);
  await shoot(page, dir, "07-found-first");

  // record: tap near the glowing crack
  s = await snap(page);
  const c1 = s.targetPts[Math.floor(s.targetPts.length / 2)];
  await tap(page, c1[0], c1[1] + 20);
  await waitPhase(page, "rotate", 10000);

  // rotate the yoke ~90deg with an arc drag around the part
  s = await snap(page);
  for (let tries = 0; tries < 4; tries++) {
    const [cx, cy] = s.partC;
    const r = s.partR * 1.3;
    await page.mouse.move(cx, cy - r);
    await page.mouse.down();
    for (let i = 0; i <= 16; i++) {
      const a = -Math.PI / 2 + (i / 16) * (Math.PI * 0.75);
      await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      await wait(24);
    }
    await page.mouse.up();
    const st = await snap(page);
    if (st.phase !== "rotate") break;
  }
  await waitPhase(page, "magnetize2", 8000);
  await shoot(page, dir, "08-rotated");

  s = await snap(page);
  await tap(page, s.magnetBtn[0], s.magnetBtn[1]);
  await waitPhase(page, "fluid2");
  s = await snap(page);
  await holdWiggle(page, s.partC[0], s.partC[1], R * 0.45, async () => {
    const st = await snap(page);
    return st.meanAccumTarget > 0.5 || st.phase !== "fluid2";
  });
  await waitPhase(page, "curtain2");
  s = await snap(page);
  await drag(page, s.curtainTab, [s.curtainTab[0], h * 0.85], 16, 120);
  await waitPhase(page, "uv2", 12000);
  await uvSweep(page);
  await waitPhase(page, "record2", 20000);
  await shoot(page, dir, "09-found-second");

  s = await snap(page);
  const c2 = s.targetPts[Math.floor(s.targetPts.length / 2)];
  await tap(page, c2[0], c2[1] + 20);
  await waitPhase(page, "demag", 10000);
  await wait(1200); // intro animation

  // demag: drag the part left, pause halfway through the ring for a shot
  s = await snap(page);
  const midX = (s.demag.ringX + s.demag.startX) / 2 - 10;
  await drag(page, [s.demag.partX, s.demag.y], [midX, s.demag.y], 12, 100);
  await shoot(page, dir, "10-demag");
  s = await snap(page);
  for (let tries = 0; tries < 3; tries++) {
    await drag(page, [s.demag.partX, s.demag.y], [s.demag.endX, s.demag.y], 24, 200);
    const st = await snap(page);
    if (st.phase !== "demag") break;
    s = st;
  }
  await waitPhase(page, "complete", 12000);
  await wait(600);
  await shoot(page, dir, "11-complete");
  return snap(page);
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const failures = [];
  try {
    for (const vp of VIEWPORTS) {
      const dir = path.join(SHOTS, vp.name);
      mkdirSync(dir, { recursive: true });
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: true
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`console: ${m.text()}`);
      });
      try {
        await page.goto(BASE);
        const final = await playThrough(page, dir, {
          rotateMidGame: vp.name === "iphone-portrait"
        });
        if (final.photos !== 2) throw new Error(`expected 2 photos, got ${final.photos}`);

        // replay: tap "again", confirm the loop restarts within 2 inputs
        const s = await snap(page);
        await tap(page, s.buttons.again[0], s.buttons.again[1]);
        await waitPhase(page, "clean", 12000);
        const s2 = await snap(page);
        if (s2.photos !== 0) throw new Error("replay did not reset photos");
        await shoot(page, dir, "12-replay-started");

        if (errors.length) throw new Error(`browser errors:\n${errors.join("\n")}`);
        console.log(`PASS ${vp.name}`);
      } catch (e) {
        failures.push(`${vp.name}: ${e.message}`);
        await shoot(page, dir, "99-failure").catch(() => {});
        console.log(`FAIL ${vp.name}: ${e.message}`);
      }
      await ctx.close();
    }

    // free-scan mode check on one viewport
    {
      const ctx = await browser.newContext({
        viewport: { width: 844, height: 390 }, hasTouch: true
      });
      const page = await ctx.newPage();
      try {
        await page.goto(BASE);
        const dir = path.join(SHOTS, "free-scan");
        mkdirSync(dir, { recursive: true });
        await playThrough(page, dir);
        const s = await snap(page);
        await tap(page, s.buttons.free[0], s.buttons.free[1]);
        await waitPhase(page, "free", 8000);
        await wait(800);
        await shoot(page, dir, "13-free-scan");
        const s2 = await snap(page);
        await tap(page, s2.freeHome[0], s2.freeHome[1]);
        await waitPhase(page, "complete", 8000);
        console.log("PASS free-scan");
      } catch (e) {
        failures.push(`free-scan: ${e.message}`);
        console.log(`FAIL free-scan: ${e.message}`);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
  if (failures.length) {
    console.error(`\n${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll e2e playthroughs passed.");
}

main().catch((e) => { console.error(e); process.exit(1); });
