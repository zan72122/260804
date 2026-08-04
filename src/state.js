import { Paper } from './paper.js';
import { FiberSim } from './fibers.js';

export const G = {
  scene: 'book',
  paper: null,
  sim: null,
  seed: 11,
  kind: 'A',
  flags: null,
  time: 0,
  go: null, // set by main.js
};

export function newGame(mode) {
  if (mode === 'first') { G.seed = 11; G.kind = 'A'; }
  else if (mode === 'new') { G.seed = (Math.random() * 1e9) | 0; G.kind = 'R'; }
  // 'same' keeps seed & kind → identical damage, play again
  G.paper = new Paper(G.kind, G.seed);
  G.sim = new FiberSim(G.paper);
  G.flags = {
    found: 0,
    placed: false, waterIn: 0,
    dispersed: false, latched: false, cast: false,
    clothOn: false, lift: 0, lifted: false,
    clothPos: null,
    feltOn: false, press: 0, pressed: false,
    wet: 0.55, dried: false, flip: 0, flipped: false,
    returned: false,
  };
}
