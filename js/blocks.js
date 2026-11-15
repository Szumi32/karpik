// Zajęte noce jako lista przedziałów [przyjazd, wyjazd) w formacie RRRR-MM-DD. Wspólne dla panelu właściciela i strony.
export const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const diffDays = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
export const isIso = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;

const clean = (ranges) => (Array.isArray(ranges) ? ranges : [])
  .filter((r) => Array.isArray(r) && isIso(r[0]) && isIso(r[1]) && r[1] > r[0])
  .map((r) => [r[0], r[1]]);

// Sortuje i skleja przedziały, które się stykają albo nachodzą na siebie.
export function normalize(ranges) {
  const sorted = clean(ranges).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const out = [];
  for (const [start, end] of sorted) {
    const last = out.at(-1);
    if (last && start <= last[1]) last[1] = end > last[1] ? end : last[1];
    else out.push([start, end]);
  }
  return out;
}

export const overlaps = (ranges, start, end) => clean(ranges).some(([s, e]) => s < end && e > start);

// Dodaje zajęte noce. Gdy którakolwiek z nich jest już zajęta, rzuca błąd, żeby nic się nie nałożyło.
export function addBlock(ranges, start, end) {
  if (!isIso(start) || !isIso(end) || end <= start) throw new Error('Sprawdź daty.');
  if (overlaps(ranges, start, end)) throw new Error('W tym okresie jest już zajęty dzień.');
  return normalize([...clean(ranges), [start, end]]);
}

// Zwalnia noce [start, end): przedział jest skracany albo dzielony na dwa.
export function releaseRange(ranges, start, end) {
  if (!isIso(start) || !isIso(end) || end <= start) throw new Error('Sprawdź daty.');
  const out = [];
  for (const [s, e] of clean(ranges)) {
    if (e <= start || s >= end) { out.push([s, e]); continue; }
    if (s < start) out.push([s, start]);
    if (e > end) out.push([end, e]);
  }
  return normalize(out);
}

// Zbiór zajętych nocy w przedziale [from, to).
export function busyNights(ranges, from, to) {
  const set = new Set();
  for (const [s, e] of clean(ranges)) {
    for (let d = s < from ? from : s; d < e && d < to; d = addDays(d, 1)) set.add(d);
  }
  return set;
}
