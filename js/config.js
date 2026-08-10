// OWNER: orchestrator — FROZEN. Cross-module constants only (module-private tuning stays in each module).
export default {
  MAX_DPR: 2,
  MAX_DT: 0.05,
  // Shared amber palette so all modules agree on the material.
  AMBER_CORE: '#ffd98a',   // brightest thread highlight
  AMBER_MID: '#e8a94e',    // typical thread body
  AMBER_DEEP: '#a05c1a',   // caramel liquid deep tone
  BG_TOP: '#241b16',       // dark, low-saturation warm background
  BG_BOTTOM: '#15100d',
  SWIPE_MIN_TRAVEL: 40,    // px, A2 swipe reversal threshold
  THREAD_MIN_SPEED: 120,   // px/s, A5 spawn threshold
  PASSES_TO_FULL: 10,      // ~passes until nest.fullness reaches 1
  CARAMEL_PASSES: 2.5,     // ~passes per full tool load
};
