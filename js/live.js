// Wersja na GitHub Pages: po wejściu na stronę pobiera data/blocks.json (zapisuje go właściciel w panelu)
// i oznacza zajęte dni jako niedostępne. Bez JavaScriptu widać stan z ostatniego budowania strony.
import { addDays, busyNights } from './blocks.js';

const SHORT = { free: 'wolne', busy: 'zajęte', ask: 'zapytaj' };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());

async function run() {
  let blocks;
  try {
    const res = await fetch(new URL('../data/blocks.json', import.meta.url), { cache: 'no-store' });
    if (!res.ok) return;
    blocks = (await res.json()).blocks || {};
  } catch {
    return;
  }
  const cache = new Map();
  const busyFor = (cabin) => {
    if (!cache.has(cabin)) cache.set(cabin, busyNights(blocks[cabin] || [], today, addDays(today, 900)));
    return cache.get(cabin);
  };
  const stateOf = (cabin, iso, ask) => (busyFor(cabin).has(iso) ? 'busy' : ask ? 'ask' : 'free');

  // Kalendarz miesiąca na stronie domku.
  for (const section of document.querySelectorAll('[data-cabin-calendar]')) {
    const cabin = section.dataset.cabinCalendar;
    for (const el of section.querySelectorAll('.mc__day[datetime]')) {
      const iso = el.getAttribute('datetime');
      if (iso < today) continue;
      const state = stateOf(cabin, iso, el.dataset.ask);
      el.className = `mc__day is-${state}`;
      const label = el.querySelector('.mc__state');
      if (label) label.textContent = state === 'free' && el.dataset.price ? `${el.dataset.price} zł` : SHORT[state];
    }
  }

  // Tabela wszystkich domków na stronie „Wolne terminy”.
  for (const td of document.querySelectorAll('td[data-cabin][data-date]')) {
    const iso = td.dataset.date;
    if (iso < today) continue;
    const state = stateOf(td.dataset.cabin, iso, td.dataset.ask);
    td.className = `av__${state}`;
    const span = td.querySelector('span');
    if (span) span.textContent = SHORT[state];
  }
}

run();
