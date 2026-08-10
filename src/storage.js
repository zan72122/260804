// Collection persistence. Deliberately tiny and defensive: a corrupt or full
// localStorage must never stop a 4-year-old from playing.

const KEY = 'nuigurumi-crane.collection.v1';
const MAX = 60;

export function loadCollection() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((d) => d && typeof d.species === 'string')
      .map((d) => ({ species: d.species, variant: (d.variant | 0) || 0, t: d.t || 0 }))
      .slice(-MAX);
  } catch (e) {
    return [];
  }
}

export function saveCollection(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    return true;
  } catch (e) {
    return false;
  }
}

export function addToCollection(species, variant) {
  const list = loadCollection();
  list.push({ species, variant: variant | 0, t: Date.now() });
  const trimmed = list.slice(-MAX);
  saveCollection(trimmed);
  return trimmed;
}

export function clearCollection() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
