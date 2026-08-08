/** Compose PNGs into one labelled contact sheet (via a headless page). */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const out = process.argv[2];
const files = process.argv.slice(3);
const cols = Math.min(files.length, 4);

const imgs = await Promise.all(
  files.map(async (f) => ({
    label: path.basename(path.dirname(f)) + '/' + path.basename(f, '.png'),
    data: 'data:image/png;base64,' + (await readFile(f)).toString('base64'),
  })),
);

const html = `<html><body style="margin:0;background:#111;display:grid;
  grid-template-columns:repeat(${cols},1fr);gap:4px;font:11px monospace;color:#8f8">
  ${imgs
    .map(
      (i) =>
        `<figure style="margin:0"><img src="${i.data}" style="width:100%;display:block">
         <figcaption style="padding:2px 4px">${i.label}</figcaption></figure>`,
    )
    .join('')}
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 380 * cols, height: 400 } });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
