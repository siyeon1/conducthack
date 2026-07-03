// library.js — a tiny localStorage-backed library of saved change programmes. Each saved item is a
// full snapshot (plan + progress + audit trail) so loading restores it exactly. Reusable, inspectable
// programmes — and, since each is a different change request, the "multiple change types" story.
const KEY = "legacymove.library.v1";
const CAP = 20;

export function listLibrary() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveToLibrary(item) {
  const list = [item, ...listLibrary()].slice(0, CAP);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota / disabled storage — non-fatal */
  }
  return list;
}

export function deleteFromLibrary(savedAt) {
  const list = listLibrary().filter((x) => x.savedAt !== savedAt);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}
