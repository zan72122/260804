// What a collision makes.
//
// The whole point of the table is that two ingredients hitting each other is
// not one event but several, and which one you get is decided by how you hit:
//
//   same pair, gently   → they stick together and climb a tier
//   same pair, hard     → they burst and become something processed
//   processed + partner → a finished dish
//
// The speeds are the interface. A ball rolling into another ball is gentle; a
// ball off a flipper is not. So "I want sauce, not a bigger tomato" becomes a
// question of aim and timing rather than of picking a menu item.

import { ITEMS } from '../game/items.js';

/** Closing speed, m/s. Between the two, the balls simply bounce. */
export const GENTLE = 0.70;
export const HARD = 1.55;

/** Hitting these together hard breaks them into something new. */
const CRUSH = {
  veg2: 'x_sauce',      // two tomatoes burst into sauce
  bread2: 'x_flat',     // two doughs get flattened into one round
  sea2: 'x_mince',      // two fish are pressed into a paste
  drink1: 'x_juice',    // two lemons are squeezed
};

/** Unordered pairs that combine into a dish. Keys are sorted "a+b". */
const PAIRS = {
  'x_flat+x_sauce': 'x_pizza',
  'x_mince+x_sauce': 'x_stew',
  'drink1+x_juice': 'drink2',      // juice back onto a lemon: lemonade
};

const key = (a, b) => (a < b ? `${a}+${b}` : `${b}+${a}`);

/** Ingredients the crates can feed into the lane. */
export const LOADABLE = ['veg2', 'bread2', 'sea2', 'drink1'];

/**
 * Resolve a ball-on-ball hit.
 * @returns {{kind:string, result:string|null}} kind is
 *          'merge' | 'crush' | 'dish' | 'bounce'
 */
export function resolve(idA, idB, speed) {
  if (idA === idB) {
    if (speed >= HARD && CRUSH[idA]) return { kind: 'crush', result: CRUSH[idA] };
    if (speed <= GENTLE) {
      const next = ITEMS[idA]?.next;
      if (next) return { kind: 'merge', result: next };
    }
    return { kind: 'bounce', result: null };
  }
  const pair = PAIRS[key(idA, idB)];
  // A dish needs a real meeting, not a graze — but not a demolition either.
  if (pair && speed <= HARD) return { kind: 'dish', result: pair };
  return { kind: 'bounce', result: null };
}

/** True if this pair could ever make something, at some speed. */
export function pairable(idA, idB) {
  if (idA === idB) return !!(CRUSH[idA] || ITEMS[idA]?.next);
  return !!PAIRS[key(idA, idB)];
}

/** Everything the player can currently discover, for the recipe hint UI. */
export function recipeBook() {
  const out = [];
  for (const [id, result] of Object.entries(CRUSH)) {
    out.push({ kind: 'crush', a: id, b: id, result });
  }
  for (const [k, result] of Object.entries(PAIRS)) {
    const [a, b] = k.split('+');
    out.push({ kind: 'dish', a, b, result });
  }
  return out;
}
