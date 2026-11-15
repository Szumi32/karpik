import crypto from './crypto.js';
import { db, tx } from './db.js';
import { addDays, diffDays, isIsoDate, pluralNights, todayWarsaw, weekday } from './dates.js';
import { allCabins, cabinBySlug, minStayFor, nightInfo, quote } from './pricing.js';

const MAX_RANGE_DAYS = 400;

// Rezerwacje oczekujące blokują termin tylko do upływu czasu na wpłatę zaliczki.
export function expireStale() {
  db.prepare(`UPDATE bookings SET status = 'expired'
              WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= datetime('now')`).run();
}

export function occupiedRanges(cabin, from, to) {
  const bookings = db.prepare(`SELECT check_in AS start, check_out AS end FROM bookings
    WHERE cabin = ? AND status IN ('pending','confirmed') AND check_in < ? AND check_out > ?`).all(cabin, to, from);
  const blocks = db.prepare('SELECT start, end FROM blocks WHERE cabin = ? AND start < ? AND end > ?').all(cabin, to, from);
  return [...bookings, ...blocks];
}

export function occupiedNights(cabin, from, to) {
  const nights = new Set();
  for (const r of occupiedRanges(cabin, from, to)) {
    let d = r.start < from ? from : r.start;
    const end = r.end > to ? to : r.end;
    while (d < end) {
      nights.add(d);
      d = addDays(d, 1);
    }
  }
  return nights;
}

export const isFree = (cabin, checkIn, checkOut) => occupiedRanges(cabin, checkIn, checkOut).length === 0;

export function checkRange(from, to) {
  if (!isIsoDate(from) || !isIsoDate(to)) return 'Nieprawidłowy zakres dat.';
  if (to <= from) return 'Nieprawidłowy zakres dat.';
  if (diffDays(from, to) > MAX_RANGE_DAYS) return 'Zbyt długi zakres dat.';
  return null;
}

// Kalendarz jednego domku: dla każdej nocy czy jest wolna, cena i minimalny pobyt.
export function calendar(slug, from, to) {
  expireStale();
  const cabin = cabinBySlug(slug);
  const busy = occupiedNights(slug, from, to);
  const nights = {};
  for (let d = from; d < to; d = addDays(d, 1)) {
    const info = nightInfo(cabin, d);
    nights[d] = { free: !busy.has(d) && !info.inquiry, price: info.price, minStay: minStayFor(cabin, d), ask: info.inquiry || undefined };
  }
  return { cabin: slug, from, to, today: todayWarsaw(), nights };
}

// Dla widoku wszystkich domków.
export function overview(from, to) {
  expireStale();
  const cabins = allCabins().map((c) => ({
    slug: c.slug,
    name: c.name,
    guests: c.guests,
    busy: [...occupiedNights(c.slug, from, to)],
  }));
  return { from, to, today: todayWarsaw(), cabins };
}

// Sprawdza pełną poprawność pobytu. Zwraca błąd do pokazania gościowi albo null.
export function validateStay({ slug, checkIn, checkOut, guests }) {
  const cabin = cabinBySlug(slug);
  if (!cabin) return { code: 'cabin', message: 'Nie znamy takiego domku.' };
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) return { code: 'dates', message: 'Wybierz daty przyjazdu i wyjazdu.' };
  if (checkOut <= checkIn) return { code: 'dates', message: 'Data wyjazdu musi być po dacie przyjazdu.' };
  if (checkIn < todayWarsaw()) return { code: 'dates', message: 'Data przyjazdu już minęła.' };
  const nights = diffDays(checkIn, checkOut);
  if (nights > 60) return { code: 'dates', message: 'Pobyt dłuższy niż 60 nocy ustalamy indywidualnie.' };
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
    const info = nightInfo(cabin, d);
    if (info.inquiry) return { code: 'inquiry', message: `${info.period.name} wyceniamy indywidualnie. Zadzwoń lub napisz, a przygotujemy ofertę.` };
  }
  const min = minStayFor(cabin, checkIn);
  if (nights < min) return { code: 'minstay', message: `${cabin.name}: w tym terminie minimalny pobyt to ${pluralNights(min)}.`, minStay: min };
  if (!Number.isInteger(guests) || guests < 1) return { code: 'guests', message: 'Podaj liczbę osób.' };
  if (guests > cabin.guests) return { code: 'guests', message: `${cabin.name} mieści maksymalnie ${cabin.guests} os.` };
  return null;
}

export function searchStay({ checkIn, checkOut, guests }) {
  expireStale();
  return allCabins().map((cabin) => {
    const invalid = validateStay({ slug: cabin.slug, checkIn, checkOut, guests });
    if (invalid) return { slug: cabin.slug, available: false, reason: invalid.code, message: invalid.message };
    if (!isFree(cabin.slug, checkIn, checkOut)) {
      return { slug: cabin.slug, available: false, reason: 'busy', message: 'Zajęty w tym terminie' };
    }
    const q = quote({ cabin, checkIn, checkOut, guests });
    return { slug: cabin.slug, available: true, total: q.total, nights: q.nights, perNight: q.perNight };
  });
}

// Najbliższy wolny pobyt o minimalnej długości, od piątku gdy preferWeekend.
export function nextFreeStay(slug, { from = todayWarsaw(), preferWeekend = false, nights = null, horizon = 240 } = {}) {
  expireStale();
  const cabin = cabinBySlug(slug);
  const to = addDays(from, horizon + 70);
  const busy = occupiedNights(slug, from, to);
  const blocked = (d) => busy.has(d) || nightInfo(cabin, d).inquiry;
  for (let i = 0; i < horizon; i++) {
    const start = addDays(from, i);
    if (preferWeekend && weekday(start) !== 5) continue;
    const need = Math.max(nights || 0, minStayFor(cabin, start));
    let ok = true;
    for (let k = 0; k < need; k++) {
      if (blocked(addDays(start, k))) { ok = false; break; }
    }
    if (ok) return { checkIn: start, checkOut: addDays(start, need), nights: need };
  }
  return null;
}

export function nextFreeWeekend() {
  expireStale();
  const today = todayWarsaw();
  const start = addDays(today, (5 - weekday(today) + 7) % 7);
  for (let w = 0; w < 26; w++) {
    const fri = addDays(start, w * 7);
    const sun = addDays(fri, 2);
    const free = allCabins().filter((c) => minStayFor(c, fri) <= 2 && !nightInfo(c, fri).inquiry && !nightInfo(c, addDays(fri, 1)).inquiry && isFree(c.slug, fri, sun));
    if (free.length) return { checkIn: fri, checkOut: sun, free: free.map((c) => c.slug), names: free.map((c) => c.name), total: allCabins().length };
  }
  return null;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => 'KP-' + Array.from(crypto.randomBytes(6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

export class StayError extends Error {
  constructor(info) {
    super(info.message);
    this.info = info;
  }
}

// Sprawdzenie i zapis w jednej transakcji, dzięki czemu nie da się podwójnie zająć terminu.
export function createBooking({ slug, checkIn, checkOut, guests, extras = [], name, email = '', phone = '', notes = '', source = 'web', status = 'pending', holdHours = 48 }) {
  expireStale();
  const invalid = source === 'web' ? validateStay({ slug, checkIn, checkOut, guests }) : null;
  if (invalid) throw new StayError(invalid);
  const cabin = cabinBySlug(slug);
  if (!cabin) throw new StayError({ code: 'cabin', message: 'Nie znamy takiego domku.' });
  return tx(() => {
    if (!isFree(slug, checkIn, checkOut)) {
      throw new StayError({ code: 'busy', message: 'Ten termin został właśnie zajęty. Wybierz inny.' });
    }
    const q = quote({ cabin, checkIn, checkOut, guests, extras });
    const code = newCode();
    const token = crypto.randomBytes(16).toString('hex');
    const row = db.prepare(`INSERT INTO bookings
      (code, token, cabin, check_in, check_out, guests, extras, total, deposit, status, source, name, email, phone, notes, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${status === 'pending' ? `datetime('now', '+${Number(holdHours)} hours')` : 'NULL'})`)
      .run(code, token, slug, checkIn, checkOut, guests, JSON.stringify(extras), q.total, q.deposit, status, source, name, email, phone, notes);
    return { id: Number(row.lastInsertRowid), code, token, quote: q };
  });
}

export const bookingByCode = (code) => db.prepare('SELECT * FROM bookings WHERE code = ?').get(code);

// Zwalnia noce [start, end) z blokad właściciela: blok jest skracany albo dzielony. Rezerwacji gości nie rusza.
export function releaseBlocks(cabin, start, end) {
  return tx(() => {
    const rows = db.prepare('SELECT id, start, end, reason FROM blocks WHERE cabin = ? AND start < ? AND end > ?').all(cabin, end, start);
    const insert = db.prepare('INSERT INTO blocks (cabin, start, end, reason) VALUES (?, ?, ?, ?)');
    for (const b of rows) {
      db.prepare('DELETE FROM blocks WHERE id = ?').run(b.id);
      if (b.start < start) insert.run(cabin, b.start, start, b.reason);
      if (b.end > end) insert.run(cabin, end, b.end, b.reason);
    }
    return rows.length;
  });
}
