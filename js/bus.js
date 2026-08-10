// OWNER: orchestrator — FROZEN. Tiny event bus (the hook mechanism between modules).
const map = new Map();
export default {
  on(name, fn) { (map.get(name) ?? map.set(name, []).get(name)).push(fn); return () => this.off(name, fn); },
  off(name, fn) { const a = map.get(name); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
  emit(name, payload) { const a = map.get(name); if (a) for (const fn of a.slice()) fn(payload); },
};
