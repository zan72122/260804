#!/usr/bin/env node
// index.html + game.js + vendor/three を1ファイルに束ねて standalone.html を作る
// （CDNもファイル分割も使えない場所＝ホームスクリーン追加やアップローダ向け）
const fs = require('fs');
const path = require('path');
const root = __dirname;

const three = fs.readFileSync(path.join(root, 'vendor/three.module.min.js'), 'utf8');
const m = three.match(/export\s*\{([^}]*)\}\s*;?\s*$/);
if (!m) throw new Error('three: export文が見つからない');
const pairs = m[1].split(',').map((e) => {
  const t = e.trim().split(/\s+as\s+/);
  return t.length === 2 ? `${t[1]}:${t[0]}` : `${t[0]}:${t[0]}`;
}).join(',');
const threeClassic = `(()=>{${three.slice(0, m.index)}\nwindow.THREE={${pairs}};})();`;

let game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
game = game.replace(/import \* as THREE from '\.\/vendor\/three\.module\.min\.js';/,
  'const THREE = window.THREE;');
const gameClassic = `(()=>{\n${game}\n})();`;

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace('<script type="module" src="./game.js"></script>',
  `<script>${threeClassic}</script>\n<script>${gameClassic}</script>`);
fs.writeFileSync(path.join(root, 'standalone.html'), html);
console.log('standalone.html:', (fs.statSync(path.join(root, 'standalone.html')).size / 1024).toFixed(0), 'KB');
