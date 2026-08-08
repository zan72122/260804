// Fast targeted shots: node tools/frame.mjs <name> <state> [stop] [w] [h] [wet]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
mkdirSync(resolve(root, 'shots'), { recursive: true });

const jobs = JSON.parse(process.argv[2]);
const W = parseInt(process.argv[3] || '1100', 10);
const H = parseInt(process.argv[4] || '660', 10);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[error]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text().slice(0, 400)); });

await page.goto('file://' + resolve(root, 'index.html'));
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
const SHOW_HUD = process.env.HUD === '1';
await page.evaluate((showHud) => {
  window.__game.audio.setMuted?.(true);
  document.getElementById('title').classList.remove('on');
  if (!showHud) document.getElementById('hud').style.display = 'none';
}, SHOW_HUD);

for (const j of jobs) {
  await page.evaluate(([st, si, wet, paint, cam]) => {
    const g = window.__game;
    g.debugJump(st, si, wet);
    if (cam) {
      g.camLock = true;
      g.camPos.set(g.workerX + cam[0], g.workerY + cam[1], cam[2]);
      g.camLook.set(g.workerX + cam[3], g.workerY + cam[4], cam[5]);
      g.camera.fov = cam[6] || 40; g.camera.updateProjectionMatrix();
    } else { g.camLock = false; }
    if (paint) {
      // simulate a partly cleaned pane
      const S = 256, ctx = g.grimeCtx;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round'; ctx.lineWidth = 62; ctx.strokeStyle = '#000';
      for (let i = 0; i < paint; i++) {
        const y = 30 + i * 26;
        ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(238, y); ctx.stroke();
      }
      ctx.restore();
      g.grimeTex.needsUpdate = true;
    }
  }, [j.state, j.stop || 0, j.wet || 0, j.paint || 0, j.cam || null]);
  await page.waitForTimeout(j.wait || 900);
  await page.screenshot({ path: resolve(root, 'shots', j.name + '.png') });
  console.log('shot', j.name);
}
await browser.close();
