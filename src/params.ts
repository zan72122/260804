// Geometry parameters for the splayed-rail ("ハの字") capsule stage.
// All of the assisted physics derives from these numbers, so the fall
// position is exactly where the rails become wider than the capsule.

export const RAIL = {
  x0: -3.4,          // narrow end (start side)
  x1: 3.4,           // wide end
  h0: 0.18,          // half-gap between rail axes at x0
  h1: 0.62,          // half-gap at x1
  y: 2.0,            // rail axis height
  r: 0.055           // rail cylinder radius
};

export const CAPSULE_R = 0.34;
export const CONTACT_R = CAPSULE_R + RAIL.r; // center-to-rail-axis distance at contact

export const CAPSULE_START_X = -2.6;

// half-gap at position x (rails are straight, so linear)
export function halfGap(x: number): number {
  const t = (x - RAIL.x0) / (RAIL.x1 - RAIL.x0);
  return RAIL.h0 + (RAIL.h1 - RAIL.h0) * Math.min(1, Math.max(0, t));
}

// x where the capsule can no longer be supported (halfGap == CONTACT_R)
export const FALL_X = RAIL.x0 + ((CONTACT_R - RAIL.h0) / (RAIL.h1 - RAIL.h0)) * (RAIL.x1 - RAIL.x0);

// height of capsule center above rail axis while resting on both rails
export function restLift(x: number): number {
  const h = halfGap(x);
  const d2 = CONTACT_R * CONTACT_R - h * h;
  return d2 > 0 ? Math.sqrt(d2) : 0;
}

export function capsuleRestY(x: number): number {
  return RAIL.y + restLift(x);
}

// effective rolling radius about the line through the two contact points
export function rollRadius(x: number): number {
  const lift = restLift(x);
  return Math.max(0.06, lift * (CAPSULE_R / CONTACT_R));
}

// how close to falling (0 = safe start, 1 = at the fall point)
export function danger(x: number): number {
  return Math.min(1, Math.max(0, (halfGap(x) - RAIL.h0) / (CONTACT_R - RAIL.h0)));
}

export const CABINET = {
  halfW: 4.05,
  halfD: 2.35,
  glassBottom: 1.25,
  glassTop: 5.75,
  baseTop: 0.32,
  gantryY: 5.3
};

export const CLAW = {
  cruiseY: 4.35,          // hub height while aiming
  pushY: 3.0,             // hub height when fingers are beside the capsule
  tipReach: 1.05,         // hub-to-fingertip vertical distance when closed
  sideOffset: 0.58,       // ideal hub x is capsule x minus this
  minX: RAIL.x0 + 0.35,
  maxX: RAIL.x1 - 0.35
};

// chute / outlet
export const OUTLET = { x: 1.55, z: CABINET.halfD };

export const COLORS = {
  mint: 0x8fd8c7,
  coral: 0xf6a48b,
  cream: 0xf6efe6,
  metal: 0xd8d4ce,
  warm: 0xffc27a
};

export type CapsuleStyle = {
  bottom: number;   // bottom half color
  toy: 'star' | 'flower' | 'heart';
  toyColor: number;
};

export const CAPSULE_STYLES: CapsuleStyle[] = [
  { bottom: 0xf2a9c4, toy: 'star', toyColor: 0xffd45e },
  { bottom: 0x9ed9f0, toy: 'flower', toyColor: 0xf78fb3 },
  { bottom: 0xc9b8ef, toy: 'heart', toyColor: 0xff8f7a },
  { bottom: 0xb9e6a5, toy: 'star', toyColor: 0xff9fc0 }
];
