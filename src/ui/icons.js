// 文字を読めなくても分かるよう、すべての操作を絵で表す。
const wrap = (inner, vb = '0 0 64 64') =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

export const ICONS = {
  tape: wrap(`
    <rect x="8" y="26" width="30" height="26" rx="8" fill="#ffd23f" stroke="#8a5a1e" stroke-width="3"/>
    <rect x="16" y="33" width="14" height="12" rx="4" fill="#ff8a3d" stroke="#8a5a1e" stroke-width="2.5"/>
    <path d="M38 40 H58" stroke="#ffe08a" stroke-width="9" stroke-linecap="round"/>
    <path d="M38 40 H58" stroke="#8a5a1e" stroke-width="2.5" stroke-linecap="round" fill="none" stroke-dasharray="3 5"/>
    <rect x="54" y="33" width="5" height="14" rx="2" fill="#c9ced6" stroke="#5a6470" stroke-width="2"/>`),
  pencil: wrap(`
    <path d="M18 46 L44 20 L52 28 L26 54 L14 58 Z" fill="#ffb23f" stroke="#8a5a1e" stroke-width="3" stroke-linejoin="round"/>
    <path d="M14 58 L26 54 L18 46 Z" fill="#f0d9a8" stroke="#8a5a1e" stroke-width="3" stroke-linejoin="round"/>
    <path d="M14 58 L20 52" stroke="#3a3026" stroke-width="4" stroke-linecap="round"/>
    <path d="M44 20 L52 28" stroke="#c9ced6" stroke-width="6"/>
    <path d="M8 60 Q22 58 34 46" stroke="#6b5847" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="2 6"/>`),
  clamp: wrap(`
    <path d="M14 16 V52 H50" stroke="#3d8ef0" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="22" y="34" width="34" height="10" rx="3" fill="#e8c48c" stroke="#8a5a1e" stroke-width="2.5"/>
    <rect x="30" y="20" width="20" height="10" rx="4" fill="#ff7043" stroke="#8a3a1e" stroke-width="2.5"/>
    <path d="M40 20 V12" stroke="#c9ced6" stroke-width="5" stroke-linecap="round"/>
    <circle cx="40" cy="9" r="8" fill="#ff5f6d" stroke="#8a2a35" stroke-width="2.5"/>`),
  saw: wrap(`
    <rect x="6" y="22" width="38" height="10" rx="3" fill="#e3e9f0" stroke="#5a6470" stroke-width="2.5"/>
    <path d="M6 32 l5 7 l5 -7 l5 7 l5 -7 l5 7 l5 -7 l5 7 l3 -7" fill="#f2f6fa" stroke="#5a6470" stroke-width="2" stroke-linejoin="round"/>
    <rect x="44" y="16" width="16" height="22" rx="7" fill="#ff5f6d" stroke="#8a2a35" stroke-width="2.5"/>
    <path d="M8 50 h48" stroke="#c9a271" stroke-width="8" stroke-linecap="round"/>`),
  sand: wrap(`
    <rect x="12" y="24" width="40" height="18" rx="6" fill="#7ac7a5" stroke="#2f6b52" stroke-width="3"/>
    <rect x="10" y="40" width="44" height="8" rx="3" fill="#8a5c3a" stroke="#4a2f1c" stroke-width="2.5"/>
    <circle cx="20" cy="44" r="1.4" fill="#f0dcb4"/><circle cx="30" cy="45" r="1.4" fill="#f0dcb4"/>
    <circle cx="40" cy="43" r="1.4" fill="#f0dcb4"/><circle cx="47" cy="45" r="1.4" fill="#f0dcb4"/>
    <path d="M18 18 q6 -6 12 0 M34 18 q6 -6 12 0" stroke="#ffd166" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  hammer: wrap(`
    <rect x="14" y="14" width="26" height="16" rx="5" fill="#b9c1cb" stroke="#5a6470" stroke-width="3"/>
    <path d="M40 16 q10 6 0 14" fill="#aab2bd" stroke="#5a6470" stroke-width="3"/>
    <rect x="24" y="28" width="9" height="28" rx="4" fill="#c9822f" stroke="#7a4a12" stroke-width="3"/>
    <path d="M46 44 v10 M52 40 v8" stroke="#ffd166" stroke-width="4" stroke-linecap="round"/>`),
  assemble: wrap(`
    <rect x="8" y="34" width="22" height="20" rx="4" fill="#e8c48c" stroke="#8a5a1e" stroke-width="3"/>
    <rect x="34" y="34" width="22" height="20" rx="4" fill="#d9ab74" stroke="#8a5a1e" stroke-width="3"/>
    <rect x="20" y="10" width="24" height="18" rx="4" fill="#f3ddb6" stroke="#8a5a1e" stroke-width="3" stroke-dasharray="5 4"/>
    <path d="M32 30 v-4 M28 22 l4 -6 l4 6" stroke="#4aa3e0" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  paint: wrap(`
    <rect x="26" y="8" width="12" height="24" rx="5" fill="#f0a04b" stroke="#8a5a1e" stroke-width="3"/>
    <rect x="22" y="30" width="20" height="10" rx="3" fill="#cfd6de" stroke="#5a6470" stroke-width="2.5"/>
    <path d="M22 40 h20 v10 q-10 6 -20 0 z" fill="#ff9ec4" stroke="#a34a72" stroke-width="2.5"/>
    <path d="M10 58 q14 -8 44 0" stroke="#ff9ec4" stroke-width="6" fill="none" stroke-linecap="round"/>`),
  sticker: wrap(`
    <path d="M32 8 l7 15 l16 2 l-12 11 l3 16 l-14 -8 l-14 8 l3 -16 l-12 -11 l16 -2 z" fill="#ffd84d" stroke="#a37a12" stroke-width="3" stroke-linejoin="round"/>`),
  done: wrap(`
    <circle cx="32" cy="32" r="22" fill="#8ff0c0" stroke="#2f8a62" stroke-width="3"/>
    <path d="M22 33 l7 8 l14 -16" stroke="#1f6b4a" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  again: wrap(`
    <path d="M14 32 a18 18 0 1 1 6 13" stroke="#4aa3e0" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M8 22 l8 10 l-12 3 z" fill="#4aa3e0"/>`),
  other: wrap(`
    <rect x="8" y="12" width="20" height="18" rx="4" fill="#ff9ec4" stroke="#a34a72" stroke-width="3"/>
    <rect x="34" y="12" width="20" height="18" rx="4" fill="#7fc6f5" stroke="#3a6f9c" stroke-width="3"/>
    <rect x="8" y="36" width="20" height="18" rx="4" fill="#ffdc6b" stroke="#a3861f" stroke-width="3"/>
    <rect x="34" y="36" width="20" height="18" rx="4" fill="#93d69a" stroke="#3f7a48" stroke-width="3"/>`),
  free: wrap(`
    <rect x="6" y="30" width="34" height="12" rx="3" fill="#e8c48c" stroke="#8a5a1e" stroke-width="3"/>
    <rect x="30" y="14" width="12" height="34" rx="3" fill="#d9ab74" stroke="#8a5a1e" stroke-width="3"/>
    <path d="M46 12 l4 8 l8 1 l-6 6 l2 9 l-8 -5 l-8 5 l2 -9 l-6 -6 l8 -1 z" fill="#ffd84d" stroke="#a37a12" stroke-width="2.5" stroke-linejoin="round"/>`),
  hand: wrap(`
    <path d="M24 52 v-8 l-8 -8 a4 4 0 0 1 6 -6 l6 6 V16 a4 4 0 0 1 8 0 v14 a4 4 0 0 1 8 0 v4 a4 4 0 0 1 8 0 v10 q0 10 -10 12 h-10 q-6 -1 -8 -4 z"
      fill="#ffd9b0" stroke="#a3703f" stroke-width="3" stroke-linejoin="round"/>`),
  wood: wrap(`
    <rect x="6" y="20" width="52" height="12" rx="4" fill="#e8c48c" stroke="#8a5a1e" stroke-width="3"/>
    <rect x="6" y="36" width="52" height="12" rx="4" fill="#c9a271" stroke="#8a5a1e" stroke-width="3"/>
    <path d="M14 26 h20 M30 42 h18" stroke="#a9743d" stroke-width="2.5" stroke-linecap="round"/>`),
  home: wrap(`
    <path d="M32 10 L58 32 H50 V54 H38 V40 H26 V54 H14 V32 H6 Z" fill="#ffd166" stroke="#8a5a1e" stroke-width="3" stroke-linejoin="round"/>`),
  sound: wrap(`
    <path d="M14 26 h10 l12 -10 v32 l-12 -10 h-10 z" fill="#4aa3e0" stroke="#1f5a8a" stroke-width="3" stroke-linejoin="round"/>
    <path d="M42 24 q6 8 0 16 M50 18 q10 14 0 28" stroke="#4aa3e0" stroke-width="4" fill="none" stroke-linecap="round"/>`),
  mute: wrap(`
    <path d="M14 26 h10 l12 -10 v32 l-12 -10 h-10 z" fill="#b9c1cb" stroke="#5a6470" stroke-width="3" stroke-linejoin="round"/>
    <path d="M44 24 l14 16 M58 24 l-14 16" stroke="#e05a52" stroke-width="4" stroke-linecap="round"/>`),
};

export function iconEl(name, cls = '') {
  const d = document.createElement('div');
  d.className = `icon ${cls}`;
  d.innerHTML = ICONS[name] || '';
  return d;
}
