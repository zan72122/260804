// 見た目の確認用: 工程を直接動かして各段のスクリーンショットを撮る。
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/home/user/260804';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => {
  let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
srv.listen(8933);

const OUT = path.join(ROOT, 'tools', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const size = process.argv.includes('--land') ? { width: 844, height: 390 } : { width: 390, height: 844 };
const tag = process.argv.includes('--land') ? 'L' : 'P';

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
});
const ctx = await b.newContext({ viewport: size, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('[pageerror]', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text()); });
await p.goto('http://127.0.0.1:8933/index.html?hq');
await p.waitForFunction(() => window.__aizome, null, { timeout: 30000 });

// 何フレームか進める
const step = async (n = 24, dt = 1 / 30) => {
  await p.evaluate(({ n, dt }) => {
    const g = window.__aizome.game;
    for (let i = 0; i < n; i++) g.update(dt);
    g.render();
  }, { n, dt });
  await p.waitForTimeout(500);
};

const shot = async (name) => { await p.screenshot({ path: path.join(OUT, tag + '-' + name + '.png') }); console.log('shot', name); };

const family = process.argv.includes('--fam')
  ? process.argv[process.argv.indexOf('--fam') + 1] : 'accordion';

await p.click('#start-btn');
await step(10);
await shot('a-flat');

await p.evaluate((fam) => {
  const g = window.__aizome.game;
  g.pickFoldTool(fam);
}, family);
await step(90);
await shot('b-folded');

await p.evaluate(() => {
  const g = window.__aizome.game;
  const M = g;
  g.tryWrap(g.canvas.clientWidth * 0.5, g.canvas.clientHeight * 0.55);
  g.binding.ties.forEach(t => t.tighten = 1);
  g.bindMode = 'board'; g.boardShape = 'star';
  g.placeBoard(g.canvas.clientWidth * 0.45, g.canvas.clientHeight * 0.5);
  g.binding.boards.forEach(b => b.clamp = 1);
});
await step(40);
await shot('c-bound');

await p.evaluate(() => window.__aizome.game.setStage('carry'));
await step(120);
await shot('d-vat');
console.log('resist stats', await p.evaluate(() => {
  const g = window.__aizome.game;
  const d = g.resistData; let n=0, sum=0, hi=0, lo=0;
  for (let i=0;i<d.length;i+=4){ n++; sum+=d[i]; if(d[i]>200) hi++; if(d[i]<20) lo++; }
  return { avg:(sum/n).toFixed(1), whiteFrac:(hi/n).toFixed(3), dyedFrac:(lo/n).toFixed(3),
           ties: g.binding.ties.map(t=>({a:t.a.toFixed(3), w:t.width, tighten:t.tighten})),
           boards: g.binding.boards.map(b=>({a:b.a.toFixed(2),b:b.b.toFixed(2),shape:b.shape,size:b.size})),
           fold: g.fold.family, bundleSize: g.fold.bundleSize };
}));

// 沈める
await p.evaluate(() => {
  const g = window.__aizome.game;
  g.input.active = true;
  for (let i = 0; i < 180; i++) { g.input.vx = Math.sin(i * 0.3) * 12; g.update(1 / 30); }
  g.render();
});
await p.waitForTimeout(600);
await shot('e-submerged');

await p.evaluate(() => {
  const g = window.__aizome.game;
  g.input.active = false; g.input.vx = 0;
  for (let i = 0; i < 120; i++) g.update(1 / 30);
  g.render();
});
await p.waitForTimeout(600);
console.log('after lift', await p.evaluate(()=>window.__aizome.state()));
await shot('f-green');

await p.evaluate(() => {
  const g = window.__aizome.game;
  g.ox = 0.42; for (let i = 0; i < 4; i++) g.update(1 / 60); g.render();
});
await p.waitForTimeout(400);
await shot('g-teal');

await p.evaluate(() => {
  const g = window.__aizome.game;
  g.ox = 1; for (let i = 0; i < 30; i++) g.update(1 / 30); g.render();
});
await p.waitForTimeout(400);
await shot('h-indigo');

await p.evaluate(() => {
  const g = window.__aizome.game;
  g.setStage('unbind');
  g.binding.ties.forEach(t => { t.removed = true; });
  g.binding.boards.forEach(b => { b.removed = true; b.gone = true; });
  for (let i = 0; i < 60; i++) g.update(1 / 30);
  g.setStage('unfold');
  g.unfoldProgress = 0.45;
  for (let i = 0; i < 40; i++) g.update(1 / 30);
  g.render();
});
await p.waitForTimeout(600);
await shot('i-halfopen');

await p.evaluate(() => {
  const g = window.__aizome.game;
  g.unfoldProgress = 1;
  for (let i = 0; i < 80; i++) g.update(1 / 30);
  g.render();
});
await p.waitForTimeout(600);
await shot('j-open');

await p.evaluate(() => {
  const g = window.__aizome.game;
  g.setStage('rinse');
  for (let i = 0; i < 90; i++) g.update(1 / 30);
  g.rinse = 1;
  g.setStage('dry');
  for (let i = 0; i < 200; i++) g.update(1 / 30);
  g.render();
});
await p.waitForTimeout(800);
await shot('k-dry');

// 布のいちばん明るいところの画素を測る
const px = await p.evaluate(() => {
  const c = document.getElementById('gl');
  const g2 = document.createElement('canvas');
  g2.width = c.width; g2.height = c.height;
  return null;
});

await b.close(); srv.close();
