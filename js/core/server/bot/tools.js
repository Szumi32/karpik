// Operacje wspólne dla bota opartego na regułach i bota na AI. Wszystkie tylko czytają dane.
import { addDays, diffDays, formatDate, formatRange, isIsoDate, pluralNights, todayWarsaw } from '../dates.js';
import { allCabins, cabinBySlug, minStayFor, nightInfo } from '../pricing.js';
import { isFree, nextFreeStay, occupiedNights, searchStay } from '../availability.js';

export const bookingLink = ({ slug, checkIn, checkOut, guests }) => {
  const q = new URLSearchParams();
  if (slug) q.set('domek', slug);
  if (checkIn) q.set('od', checkIn);
  if (checkOut) q.set('do', checkOut);
  if (guests) q.set('goscie', guests);
  return `/karpik/rezerwacja?${q}`;
};

const card = (cabin, { checkIn, checkOut, guests, total, nights }) => ({
  slug: cabin.slug,
  name: cabin.name,
  photo: `/karpik/img/${cabin.photos[0]}-800.webp`,
  guests: cabin.guests,
  area: cabin.area,
  total,
  nights,
  checkIn,
  checkOut,
  href: bookingLink({ slug: cabin.slug, checkIn, checkOut, guests }),
});

// Sprawdza konkretny termin we wszystkich domkach.
export function checkStay({ checkIn, checkOut, guests = 2 }) {
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut) || checkOut <= checkIn) {
    return { error: 'Nieprawidłowe daty.' };
  }
  if (checkIn < todayWarsaw()) return { error: 'Data przyjazdu już minęła.' };
  const results = searchStay({ checkIn, checkOut, guests });
  const free = results.filter((r) => r.available);
  const minStay = Math.min(...allCabins().map((c) => minStayFor(c, checkIn)));
  const tooShort = diffDays(checkIn, checkOut) < minStay;
  const inquiry = results.find((r) => r.reason === 'inquiry')?.message || null;
  return {
    checkIn, checkOut, guests, nights: diffDays(checkIn, checkOut), minStay, tooShort, inquiry,
    free: free.map((r) => ({ slug: r.slug, name: cabinBySlug(r.slug).name, total: r.total, link: bookingLink({ slug: r.slug, checkIn, checkOut, guests }) })),
    unavailable: results.filter((r) => !r.available).map((r) => ({ name: cabinBySlug(r.slug).name, why: r.message })),
    cards: free.map((r) => card(cabinBySlug(r.slug), { checkIn, checkOut, guests, total: r.total, nights: r.nights })),
  };
}

// Pierwsze wolne terminy, ewentualnie dla konkretnego domku lub liczby osób.
export function nextFree({ slug = null, nights = null, weekendOnly = false, guests = null, from = null }) {
  const start = from && isIsoDate(from) && from >= todayWarsaw() ? from : todayWarsaw();
  const list = allCabins().filter((c) => (slug ? c.slug === slug : true) && (guests ? c.guests >= guests : true));
  const out = [];
  for (const c of list) {
    const stay = nextFreeStay(c.slug, { from: start, preferWeekend: weekendOnly, nights });
    if (!stay) continue;
    const result = searchStay({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: Math.min(guests || c.guestsIncluded, c.guests) })
      .find((r) => r.slug === c.slug);
    out.push({
      slug: c.slug, name: c.name, checkIn: stay.checkIn, checkOut: stay.checkOut, nights: stay.nights,
      label: `${formatRange(stay.checkIn, stay.checkOut)} (${pluralNights(stay.nights)})`,
      total: result?.total ?? null,
      link: bookingLink({ slug: c.slug, checkIn: stay.checkIn, checkOut: stay.checkOut, guests }),
      card: result?.available ? card(c, { checkIn: stay.checkIn, checkOut: stay.checkOut, guests, total: result.total, nights: stay.nights }) : null,
    });
  }
  out.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return out;
}

// Wolne okresy w miesiącu dla każdego domku.
export function freeInMonth({ month, year }) {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const next = month === 11 ? `${year + 1}-01-01` : `${year}-${String(month + 2).padStart(2, '0')}-01`;
  const start = first < todayWarsaw() ? todayWarsaw() : first;
  return allCabins().map((c) => {
    const occupied = occupiedNights(c.slug, start, next);
    const busy = { has: (d) => occupied.has(d) || nightInfo(c, d).inquiry };
    const ranges = [];
    let open = null;
    for (let d = start; d <= next; d = addDays(d, 1)) {
      const free = d < next && !busy.has(d);
      if (free && !open) open = d;
      if (!free && open) {
        if (diffDays(open, d) >= minStayFor(c, open)) ranges.push({ od: open, do: d, opis: formatRange(open, d) });
        open = null;
      }
    }
    return { slug: c.slug, name: c.name, guests: c.guests, wolne: ranges };
  });
}

export const stayLabel = (a, b) => `${formatDate(a)} – ${formatDate(b)}`;
export { isFree };
