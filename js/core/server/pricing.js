import { cabins as baseCabins, extras as baseExtras, periods, site } from '../data/offer.js';
import { getSetting, setSetting } from './db.js';
import { addDays, diffDays, monthDay } from './dates.js';

// Pola domku, które właściciel może zmienić w panelu.
export const EDITABLE = ['price', 'guestsIncluded', 'extraGuestPrice', 'holidayPrice', 'oneNightPrice', 'minStay', 'summerMinStay'];

export function priceSettings() {
  const saved = getSetting('prices', {}) || {};
  return {
    cabins: Object.fromEntries(baseCabins.map((c) => [c.slug, Object.fromEntries(EDITABLE.map((k) => [k, saved.cabins?.[c.slug]?.[k] ?? c[k] ?? null]))])),
    extras: Object.fromEntries(baseExtras.map((e) => [e.id, { price: saved.extras?.[e.id]?.price ?? e.price }])),
  };
}
export const savePriceSettings = (value) => setSetting('prices', value);

export function cabinBySlug(slug) {
  const cabin = baseCabins.find((c) => c.slug === slug);
  if (!cabin) return null;
  return { ...cabin, ...priceSettings().cabins[slug] };
}
export const allCabins = () => baseCabins.map((c) => cabinBySlug(c.slug));
export const extrasList = () => {
  const s = priceSettings().extras;
  return baseExtras.map((e) => ({ ...e, price: s[e.id]?.price ?? e.price }));
};

// Wielkanoc według algorytmu Meeusa, Boże Ciało wypada 60 dni później (czwartek).
function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export const corpusChristi = (year) => addDays(easter(year), 60);

const inRange = (md, from, to) => (from <= to ? md >= from && md <= to : md >= from || md <= to);

// Okres, do którego należy noc rozpoczynająca się danego dnia. Pierwszy pasujący wygrywa.
export function periodFor(date) {
  const md = monthDay(date);
  for (const p of periods) {
    if (p.movable === 'corpus-christi') {
      const cc = corpusChristi(Number(date.slice(0, 4)));
      if (date >= addDays(cc, -1) && date <= addDays(cc, 2)) return p; // noce od środy do soboty
    } else if (inRange(md, p.from, p.to)) {
      return p;
    }
  }
  return null;
}

export function nightInfo(cabin, date) {
  const period = periodFor(date);
  if (period?.inquiry) return { inquiry: true, price: null, period };
  const price = period?.holiday && cabin.holidayPrice ? cabin.holidayPrice : cabin.price;
  return { inquiry: false, price, period };
}
export const nightPrice = (cabin, date) => nightInfo(cabin, date).price;

export const minStayFor = (cabin, date) => (periodFor(date)?.summer ? cabin.summerMinStay : cabin.minStay) || 1;

export const fromPrice = (cabin) => cabin.price;

export function quote({ cabin, checkIn, checkOut, guests, extras: chosen = [] }) {
  const nights = diffDays(checkIn, checkOut);
  const lines = [];
  let accommodation = 0;
  for (let i = 0; i < nights; i++) accommodation += nightPrice(cabin, addDays(checkIn, i)) || 0;
  // Pojedyncza noc ma osobną, wyższą cenę tam, gdzie właściciel ją podał.
  if (nights === 1 && cabin.oneNightPrice) accommodation = Math.max(accommodation, cabin.oneNightPrice);
  lines.push({ id: 'noclegi', label: 'Noclegi', qty: nights, amount: accommodation });

  const extraGuests = Math.max(0, guests - cabin.guestsIncluded);
  if (extraGuests > 0 && cabin.extraGuestPrice > 0) {
    lines.push({ id: 'dostawka', label: `Dodatkowe osoby (${extraGuests})`, qty: extraGuests, amount: extraGuests * nights * cabin.extraGuestPrice });
  }

  for (const id of new Set(chosen)) {
    const extra = extrasList().find((e) => e.id === id);
    if (!extra || (extra.onlyCabins && !extra.onlyCabins.includes(cabin.slug))) continue;
    lines.push({ id: extra.id, label: extra.name, qty: 1, amount: extra.price, extra: true });
  }
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  const deposit = Math.round((total * site.depositPercent) / 100 / 10) * 10;
  return { nights, lines, total, deposit, perNight: Math.round(accommodation / nights) };
}
