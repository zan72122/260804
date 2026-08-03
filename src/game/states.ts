/**
 * Explicit game state machine for the vertical slice.
 * The play loop: title → arrive → scanBefore → prepUnits → lower → grind
 *                → scanAfter → testRun → replay → arrive (again)
 * Invalid transitions are refused (never thrown) so mashed input can't
 * break the loop.
 */
export type Phase =
  | 'title'
  | 'arrive'
  | 'scanBefore'
  | 'prepUnits'
  | 'lower'
  | 'grind'
  | 'scanAfter'
  | 'testRun'
  | 'replay';

export const TRANSITIONS: Record<Phase, Phase[]> = {
  title: ['arrive'],
  arrive: ['scanBefore'],
  scanBefore: ['prepUnits'],
  prepUnits: ['lower'],
  lower: ['grind'],
  grind: ['scanAfter'],
  scanAfter: ['testRun'],
  testRun: ['replay'],
  replay: ['arrive'],
};

export const PHASES: Phase[] = Object.keys(TRANSITIONS) as Phase[];

export function canGo(from: Phase, to: Phase): boolean {
  return TRANSITIONS[from].includes(to);
}
