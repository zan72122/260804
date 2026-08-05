/**
 * すいすい すいぞくかん おそうじ ── 起動と毎フレームの進行。
 */
import * as THREE from 'three';
import { Stage } from './core/stage.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { createSharedUniforms } from './world/shaders.js';
import { Environment } from './world/environment.js';
import { Decor } from './world/decor.js';
import { Bubbles } from './world/bubbles.js';
import { Diver } from './world/diver.js';
import { Equipment } from './world/equipment.js';
import { GlassDirt } from './world/glassDirt.js';
import { Leaves } from './world/leaves.js';
import { School } from './world/fish.js';
import { Sparkles } from './world/sparkles.js';
import { Hud } from './ui/hud.js';
import { Game } from './game/game.js';

const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');

const stage = new Stage(canvas);
const input = new Input(canvas);
const audio = new Audio();
const shared = createSharedUniforms();

const env = new Environment(stage.scene, shared);
const decor = new Decor(stage.scene, shared);
const bubbles = new Bubbles(stage.scene, shared);
const sparkles = new Sparkles(stage.scene);
const equipment = new Equipment(stage.scene, shared, bubbles);
const diver = new Diver(stage.scene, shared, bubbles);
const glassDirt = new GlassDirt(stage.scene, shared);
const leaves = new Leaves(stage.scene, shared, equipment, bubbles, sparkles);
const school = new School(stage.scene, shared, 11);
const hud = new Hud();

const game = new Game({
  stage, input, audio, shared, env, decor, diver, bubbles,
  equipment, glassDirt, leaves, school, sparkles, hud,
});

// ---------------------------------------------------------------- サイズ

function resize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  stage.setSize(w, h);
  game.layout(w, h);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 260));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- ボタン

const startBtn = document.getElementById('start');
const againBtn = document.getElementById('again');
const soundBtn = document.getElementById('sound');

startBtn.addEventListener('click', () => {
  audio.start();
  audio.resume();
  hud.hideTitle();
  hud.showHud();
  game.start();
});

againBtn.addEventListener('click', () => {
  audio.resume();
  hud.hideClear();
  game.restart();
});

soundBtn.addEventListener('click', () => {
  const on = soundBtn.classList.toggle('muted');
  audio.setEnabled(!on);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.suction(false);
  } else {
    audio.resume();
  }
});

// コンテキストが落ちたときも、真っ黒のまま放置しない
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  loading.classList.remove('gone');
  loading.querySelector('p').textContent = 'もういちど ひらいてね';
});

// ---------------------------------------------------------------- ループ

const clock = new THREE.Clock();
let started = false;

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  const time = clock.elapsedTime;
  shared.time.value = time;

  env.update(dt, time);
  game.update(dt, time);
  diver.update(dt, time);
  equipment.update(dt, time);
  bubbles.update(dt, time);
  sparkles.update(dt);
  school.update(dt, time);

  stage.render(time);
  stage.adapt(dt, time);
  input.endFrame();

  if (!started) {
    started = true;
    loading.classList.add('gone');
  }
  requestAnimationFrame(frame);
}

// 先にシェーダを全部用意しておく。
// とくにおさかなは「ごほうび」の瞬間に出てくるので、そこでコンパイルが走ると
// いちばん見せたい場面がカクつく。最初に一度だけ表示して焼いておく。
school.group.visible = true;
stage.renderer.compile(stage.scene, stage.camera);
school.group.visible = false;
requestAnimationFrame(frame);

// デバッグ用（試遊のときだけ使う）
window.__game = game;
window.__stage = stage;
