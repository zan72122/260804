/**
 * Screenshot + console audit: plays a full round of the workshop with real
 * pointer events on four reference screens and fails loudly on any console
 * error, dead end, or missing signature moment.
 */
import { createRequire } from 'node:module'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
function loadPlaywright() {
  for (const spec of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return require(spec)
    } catch {
      /* try next */
    }
  }
  throw new Error('playwright not found (tried local and global installs)')
}
const { chromium } = loadPlaywright()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const outDir = path.join(root, 'audit')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

function serve(dir) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0])
    let file = path.join(dir, url === '/' ? 'index.html' : url)
    if (!file.startsWith(dir)) {
      res.writeHead(403).end()
      return
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html')
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(0, () => resolve(server)))
}

const ONLY = (process.env.AUDIT_SCREENS || '').split(',').filter(Boolean)
const SCREENS = [
  { name: 'iphone-portrait', width: 390, height: 844, dpr: 3 },
  { name: 'iphone-landscape', width: 844, height: 390, dpr: 3 },
  { name: 'ipad-portrait', width: 820, height: 1180, dpr: 2 },
  { name: 'ipad-landscape', width: 1180, height: 820, dpr: 2 },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function dbg(page) {
  return page.evaluate(() => window.__game.debug())
}

async function waitPhase(page, phase, timeout = 30000) {
  const t0 = Date.now()
  for (;;) {
    const d = await dbg(page)
    if (Array.isArray(phase) ? phase.includes(d.phase) : d.phase === phase) return d
    if (Date.now() - t0 > timeout) throw new Error(`timeout waiting for phase ${phase}, stuck in ${d.phase}`)
    await sleep(120)
  }
}

async function drag(page, from, to, steps = 22) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)
    await sleep(14)
  }
  await page.mouse.up()
}

async function playOnce(page, shot, notes) {
  // 1 — pick a mystery block.
  let d = await waitPhase(page, 'choose')
  await shot('01-choose')
  await page.mouse.click(d.cards[0].x, d.cards[0].y)

  // 2 — seat the block in the holder.
  d = await waitPhase(page, 'mount')
  await sleep(700)
  d = await dbg(page)
  await shot('02-mount')
  await drag(page, { x: d.block.x, y: d.block.y }, { x: d.seat.x, y: d.seat.y })

  // 3 — fill the knife boat drop by drop.
  d = await waitPhase(page, 'water')
  await shot('03-water-empty')
  for (let i = 0; i < 14; i++) {
    const cur = await dbg(page)
    if (cur.phase !== 'water') break
    await page.mouse.click(cur.dropper.x, cur.dropper.y)
    await sleep(180)
  }
  const filled = await dbg(page)
  notes.waterLevel = filled.waterLevel
  await shot('04-water-full')

  // 4 — cut the ribbon, sampling the peel so we can prove it is continuous.
  d = await waitPhase(page, 'cut')
  const peels = []
  for (let stroke = 0; stroke < 10; stroke++) {
    const cur = await dbg(page)
    if (cur.phase !== 'cut') break
    const lx = cur.lever.x
    await page.mouse.move(lx, cur.lever.top)
    await page.mouse.down()
    for (let i = 1; i <= 26; i++) {
      await page.mouse.move(lx, cur.lever.top + ((cur.lever.bottom - cur.lever.top) * i) / 26)
      const s = await dbg(page)
      if (s.activePeel >= 0) peels.push(s.activePeel)
      if (stroke === 0 && i === 13) await shot('05-peeling-midway')
    }
    await page.mouse.up()
    await sleep(700)
  }
  notes.peelSamples = peels.length
  notes.peelMid = peels.filter((p) => p > 0.15 && p < 0.85).length
  notes.maxPeelJump = peels.reduce((m, p, i) => (i === 0 ? 0 : Math.max(m, p - peels[i - 1])), 0)

  d = await waitPhase(page, ['tidy', 'pickup'], 40000)
  notes.ribbon = d.sectionInfo
  await shot('06-ribbon')

  // 5 — calm the static, then coax the ribbon straight with the eyelash.
  if (d.phase === 'tidy') {
    await drag(page, { x: d.ionizer.x, y: d.ionizer.y }, { x: d.ribbonCenter.x, y: d.ribbonCenter.y })
    await sleep(500)
    await shot('07-ionizer')
    const e = await dbg(page)
    await drag(
      page,
      { x: e.eyelash.x, y: e.eyelash.y },
      { x: e.ribbonCenter.x + 20, y: e.ribbonCenter.y + 10 },
    )
    await sleep(400)
    await shot('08-eyelash')
  }

  // 6 — dip the grid, then lift the ribbon out.
  d = await waitPhase(page, 'pickup', 40000)
  await shot('09-pickup-ready')
  await page.mouse.move(d.grid.x, d.grid.y)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(
      d.grid.x + ((d.ribbonCenter.x - d.grid.x) * i) / 20,
      d.grid.y + ((d.ribbonCenter.y + 10 - d.grid.y) * i) / 20,
    )
    await sleep(16)
  }
  await sleep(450)
  await shot('10-grid-submerged')
  const sub = await dbg(page)
  for (let i = 1; i <= 14; i++) {
    await page.mouse.move(sub.grid.x, sub.grid.y - i * 8)
    await sleep(18)
  }
  await page.mouse.up()
  await sleep(900)
  await shot('11-grid-lifted')

  // 7 — into the microscope.
  d = await waitPhase(page, ['tem', 'pickup'], 20000)
  if (d.phase === 'pickup') {
    const cur = await dbg(page)
    await drag(page, { x: cur.grid.x, y: cur.grid.y }, { x: cur.tem.x, y: cur.tem.y })
  }
  await waitPhase(page, 'tem', 20000)
  notes.temFps = (await dbg(page)).fps
  for (const [t, name] of [
    [1.8, '12-tem-low-mag'],
    [5.5, '13-tem-mid-mag'],
    [9.5, '14-tem-high-mag'],
  ]) {
    const t0 = Date.now()
    for (;;) {
      const d = await dbg(page)
      if (d.phase !== 'tem' || d.temT >= t || Date.now() - t0 > 25000) break
      await sleep(80)
    }
    // Freeze the dive so the capture itself cannot advance it.
    await page.evaluate(() => {
      window.__pause = true
    })
    notes[name] = (await dbg(page)).temT
    await shot(name)
    await page.evaluate(() => {
      window.__pause = false
    })
  }
  await waitPhase(page, 'replay', 40000)
  await shot('15-replay')

  // 8 — one tap puts the child straight back on the lever.
  const r = await dbg(page)
  await page.mouse.click(r.cards[0].x, r.cards[0].y)
  const back = await waitPhase(page, 'cut', 8000)
  notes.replayWater = back.waterLevel
  await shot('16-replay-back-to-cut')
  return notes
}

async function main() {
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    throw new Error('dist/index.html missing — run `npm run build` first')
  }
  fs.rmSync(outDir, { recursive: true, force: true })
  const server = await serve(dist)
  const port = server.address().port
  const browser = await chromium.launch()
  const report = []
  let failed = false

  for (const s of SCREENS.filter((x) => ONLY.length === 0 || ONLY.includes(x.name))) {
    const dir = path.join(outDir, s.name)
    fs.mkdirSync(dir, { recursive: true })
    const context = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      deviceScaleFactor: s.dpr,
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()
    const errors = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`)
    })
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

    let n = 0
    const shot = async (name) => {
      n++
      await page.screenshot({ path: path.join(dir, `${String(n).padStart(2, '0')}-${name}.png`) })
    }

    const notes = { screen: s.name, size: `${s.width}x${s.height}` }
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
    await page.waitForFunction(() => !!window.__game)

    try {
      await playOnce(page, shot, notes)
      // Rotation must not lose the round in progress.
      const before = await dbg(page)
      await page.setViewportSize({ width: s.height, height: s.width })
      await sleep(700)
      const after = await dbg(page)
      notes.rotationKeptPhase = before.phase === after.phase
      notes.rotationKeptWater = Math.abs(before.waterLevel - after.waterLevel) < 0.02
      notes.rotationOrientationChanged = before.orientation !== after.orientation
      await shot('16-rotated')
      await page.setViewportSize({ width: s.width, height: s.height })
    } catch (e) {
      notes.error = String(e.message || e)
      failed = true
      await shot('99-failure')
    }

    notes.consoleErrors = errors
    if (errors.length) failed = true
    report.push(notes)
    await context.close()
  }

  await browser.close()
  server.close()

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  for (const r of report) {
    const silverOrGold = (r.ribbon || []).filter((s) => s.band === 'silver' || s.band === 'gold').length
    console.log(
      [
        `\n=== ${r.screen} (${r.size}) ===`,
        `  console errors : ${r.consoleErrors.length}`,
        `  water level    : ${r.waterLevel?.toFixed(3)}`,
        `  peel samples   : ${r.peelSamples} (mid-peel frames: ${r.peelMid}, max jump: ${r.maxPeelJump?.toFixed(3)})`,
        `  ribbon slices  : ${(r.ribbon || []).length} (silver/gold: ${silverOrGold})`,
        `  fps during TEM : ${r.temFps}`,
        `  rotation kept  : phase=${r.rotationKeptPhase} water=${r.rotationKeptWater} flipped=${r.rotationOrientationChanged}`,
        `  replay water   : ${r.replayWater}`,
        r.error ? `  ERROR          : ${r.error}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    if (r.consoleErrors.length) for (const e of r.consoleErrors) console.log(`    ! ${e}`)
    if (!r.error) {
      if (!r.peelMid || r.peelMid < 3) {
        console.log('    ! slices did not visibly grow out of the edge')
        failed = true
      }
      if (silverOrGold < 4) {
        console.log('    ! ribbon did not show silver / pale gold interference')
        failed = true
      }
      if (!r.rotationKeptPhase || !r.rotationKeptWater) {
        console.log('    ! rotation lost state')
        failed = true
      }
    }
  }
  console.log(`\nScreenshots: ${outDir}`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
