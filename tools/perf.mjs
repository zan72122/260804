import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 896, height: 414 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const stats = await page.evaluate(() => {
  const g = window.__game;
  g.game.go('FLOW'); g.molten.setOpen(1); g.molten.setFill(1);
  for (let i=0;i<12;i++){ g.game.update(1/60); g.cam.update(1/60); g.molten.update(1/60, g.camera, 1); }
  g.renderer.render(g.scene, g.camera);
  const info = g.renderer.info;
  let meshes=0, mats=new Set(), tris=0;
  g.scene.traverse(o=>{ if(o.isMesh||o.isPoints||o.isSprite){meshes++; if(o.material)mats.add(o.material.uuid);} });
  return {
    drawCalls: info.render.calls, triangles: info.render.triangles, points: info.render.points,
    geometries: info.memory.geometries, textures: info.memory.textures,
    programs: info.programs.length, meshes, materials: mats.size,
    quality: g.renderer.getPixelRatio(),
    webgl2: g.renderer.getContext() instanceof WebGL2RenderingContext,
  };
});
console.log(JSON.stringify(stats, null, 2));
await browser.close();
