// ちょきちょき！カタカタ！おようふく工房
// Boot, main loop, orientation handling.

import * as THREE from 'three';
import { World, pickTier } from './world.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { Hud, paintVeil } from './hud.js';
import { Game } from './game.js';

const canvas = document.getElementById('stage');
const veil = document.getElementById('veil');

const tier = pickTier();
const world = new World(canvas, tier);
const audio = new Audio();
const input = new Input(canvas);

let game = null;
const hud = new Hud(
  (on) => audio.setEnabled(on),
  (kind, i) => game && game.onDecoPicked(kind, i)
);

paintVeil();
world.resize();

function onResize() {
  world.resize();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 220));
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && audio.ready) audio.motor(false);
});

let started = false;
function begin() {
  if (started) return;
  started = true;
  audio.start();
  audio.setEnabled(hud.soundOn);
  veil.classList.add('gone');
  game = new Game(world, audio, hud, input);
  game.startRound(0);
}
veil.addEventListener('pointerdown', begin);
veil.addEventListener('click', begin);
canvas.addEventListener('pointerdown', () => { if (!started) begin(); });

const clock = new THREE.Clock();
let t = 0;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 1 / 20);
  t += dt;
  input.beginFrame(dt);
  if (game) game.update(dt, t);
  world.update(dt, t);
  world.render();
}
loop();

// helpful when poking at the game from a console
window.__workshop = { world, game: () => game, audio, tier };
