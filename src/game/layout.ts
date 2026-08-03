/**
 * Interactive target geometry in CSS pixels.
 * Every primary touch target is at least 64 px, main actions 72–120 px
 * (toddler fingers). Layout respects safe-area insets and is recomputed on
 * every resize/rotation, so touch coordinates always match the screen.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Layout {
  w: number;
  h: number;
  portrait: boolean;
  insets: Insets;
  gear: Rect;
  play: Rect;
  scan: Rect;
  lever: Rect;
  mist: Rect;
  tray0: Rect;
  tray1: Rect;
  replaySame: Rect;
  replayNew: Rect;
  toggleLight: Rect;
  toggleMotion: Rect;
  toggleSound: Rect;
  closeSettings: Rect;
}

export function inRect(r: Rect, x: number, y: number, slop = 0): boolean {
  return x >= r.x - slop && x <= r.x + r.w + slop && y >= r.y - slop && y <= r.y + r.h + slop;
}

export function rectCenter(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function computeLayout(w: number, h: number, insets: Insets): Layout {
  const portrait = h >= w;
  const short = Math.min(w, h);
  const big = clamp(short * 0.22, 84, 120); // main action buttons
  const mid = clamp(short * 0.2, 76, 100); // secondary buttons
  const gearSize = 64;
  const m = 14; // base margin

  const gear: Rect = {
    x: w - gearSize - m - insets.right,
    y: m + insets.top,
    w: gearSize,
    h: gearSize,
  };

  const play: Rect = centered(w, h, clamp(short * 0.4, 130, 200));

  let scan: Rect;
  let lever: Rect;
  let mist: Rect;
  let tray0: Rect;
  let tray1: Rect;
  let replaySame: Rect;
  let replayNew: Rect;

  if (portrait) {
    const bottom = h - insets.bottom;
    scan = { x: w / 2 - big / 2, y: bottom - big - 26, w: big, h: big };
    const leverW = clamp(short * 0.3, 96, 132);
    const leverH = clamp(h * 0.3, 220, 300);
    lever = { x: w / 2 - leverW / 2, y: bottom - leverH - 22, w: leverW, h: leverH };
    mist = { x: m + insets.left, y: bottom - mid - 26, w: mid, h: mid };
    tray0 = { x: m + insets.left, y: bottom - mid - 26, w: mid, h: mid };
    tray1 = { x: w - mid - m - insets.right, y: bottom - mid - 26, w: mid, h: mid };
    const cardW = w * 0.74;
    const cardH = clamp(h * 0.2, 130, 200);
    replaySame = { x: w / 2 - cardW / 2, y: h * 0.3, w: cardW, h: cardH };
    replayNew = { x: w / 2 - cardW / 2, y: h * 0.3 + cardH + 26, w: cardW, h: cardH };
  } else {
    const bottom = h - insets.bottom;
    scan = { x: m + insets.left + 6, y: bottom - big - 20, w: big, h: big };
    const leverW = clamp(short * 0.26, 92, 120);
    const leverH = clamp(h * 0.56, 200, 260);
    lever = { x: w - leverW - 18 - insets.right, y: bottom - leverH - 22, w: leverW, h: leverH };
    mist = { x: m + insets.left + 6, y: bottom - mid - 20, w: mid, h: mid };
    tray0 = { x: w * 0.3 - mid / 2, y: bottom - mid - 18, w: mid, h: mid };
    tray1 = { x: w * 0.46 - mid / 2, y: bottom - mid - 18, w: mid, h: mid };
    const cardW = clamp(w * 0.3, 220, 340);
    const cardH = clamp(h * 0.42, 150, 240);
    const gap = 30;
    replaySame = { x: w / 2 - cardW - gap / 2, y: h / 2 - cardH / 2 + 20, w: cardW, h: cardH };
    replayNew = { x: w / 2 + gap / 2, y: h / 2 - cardH / 2 + 20, w: cardW, h: cardH };
  }

  const tSize = clamp(short * 0.2, 88, 110);
  const totalT = tSize * 3 + 40;
  const tx = w / 2 - totalT / 2;
  const ty = h / 2 - tSize / 2;
  const toggleLight: Rect = { x: tx, y: ty, w: tSize, h: tSize };
  const toggleMotion: Rect = { x: tx + tSize + 20, y: ty, w: tSize, h: tSize };
  const toggleSound: Rect = { x: tx + (tSize + 20) * 2, y: ty, w: tSize, h: tSize };
  const closeSettings: Rect = {
    x: w / 2 - 40,
    y: Math.min(ty + tSize + 40, h - 100 - insets.bottom),
    w: 80,
    h: 80,
  };

  return {
    w,
    h,
    portrait,
    insets,
    gear,
    play,
    scan,
    lever,
    mist,
    tray0,
    tray1,
    replaySame,
    replayNew,
    toggleLight,
    toggleMotion,
    toggleSound,
    closeSettings,
  };
}

function centered(w: number, h: number, size: number): Rect {
  return { x: w / 2 - size / 2, y: h / 2 - size / 2 + h * 0.08, w: size, h: size };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
