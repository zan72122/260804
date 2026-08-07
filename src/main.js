// Boot: title screen, audio unlock, and handing control to the game.

import { Game } from './game.js';
import { audio } from './core/audio.js';
import { bellSvg } from './stages.js';

const $ = (id) => document.getElementById(id);

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (_) { return false; }
}

function boot() {
  if (!hasWebGL()) {
    $('nogl').hidden = false;
    $('boot').classList.add('gone');
    return;
  }

  // title art: a real bell silhouette, so the first thing on screen is the goal
  $('titleSvg').innerHTML = `
    <g transform="translate(20,4) scale(1.65)">
      ${bellSvg('tulip').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}
    </g>`;

  let game;
  try {
    game = new Game($('gl')).init();
  } catch (err) {
    console.error(err);
    $('nogl').hidden = false;
    $('boot').classList.add('gone');
    return;
  }
  window.__game = game;          // handy for poking at it from the console

  // The workshop lives behind the title card, slowly drifting, so the first
  // thing a child sees is the place they are about to work in.
  game.idle();
  game.start();
  requestAnimationFrame(() => $('boot').classList.add('gone'));

  /* ---- start ---- */
  let begun = false;
  const begin = () => {
    if (begun) return;
    begun = true;
    audio.unlock();
    audio.ambient(1);
    audio.blip(1.2);
    $('title').classList.add('gone');
    setTimeout(() => { $('title').style.display = 'none'; }, 700);
    game.newRun();
  };
  $('startBtn').addEventListener('click', begin);
  $('title').addEventListener('click', begin);

  /* ---- sound toggle ---- */
  const snd = $('sndBtn');
  let on = true;
  const paint = () => { snd.classList.toggle('on', on); snd.classList.toggle('off', !on); };
  paint();
  snd.addEventListener('click', (e) => {
    e.stopPropagation();
    on = !on;
    audio.unlock();
    audio.setEnabled(on);
    paint();
  });

  /* ---- replay ---- */
  $('replayBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    audio.blip(1.3);
    game.hud.showReplay(false);
    game.newRun();
  });

  // iOS sometimes needs the context nudged on the very first touch anywhere
  const kick = () => audio.unlock();
  window.addEventListener('touchend', kick, { once: true, passive: true });
  window.addEventListener('mousedown', kick, { once: true, passive: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
