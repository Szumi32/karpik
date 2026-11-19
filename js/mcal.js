// Kalendarz miesiąca z terminami: przełączanie miesięcy i domków bez przeładowania strony.
// Strona działa też bez JavaScriptu (jeden miesiąc z serwera i linki ?m=), a tu doprowadzamy go do pełnej wygody.
import { $, $$, MONTHS, DOW, addMonths, api, esc, monthStart, todayLocal, weekday } from './util.js';

const labelFor = (info, iso, today) => {
  if (iso < today) return ['past', ''];
  if (info?.ask) return ['ask', 'zapytaj'];
  if (info?.free) return ['free', `${Math.round(info.price)} zł`];
  return ['busy', 'zajęte'];
};

function gridHtml(month, nights, today) {
  const next = addMonths(month, 1);
  const days = Math.round((Date.parse(next) - Date.parse(month)) / 864e5);
  const offset = (weekday(month) + 6) % 7;
  let out = DOW.map((d) => `<li class="mc__dow" aria-hidden="true">${d}</li>`).join('');
  out += '<li class="mc__pad" aria-hidden="true"></li>'.repeat(offset);
  for (let d = 1; d <= days; d++) {
    const iso = `${month.slice(0, 7)}-${String(d).padStart(2, '0')}`;
    const info = nights?.[iso];
    const [state, label] = labelFor(info, iso, today);
    out += `<li><time class="mc__day is-${state}" datetime="${iso}" data-price="${info?.price ? Math.round(info.price) : ''}" data-ask="${info?.ask ? '1' : ''}"><span class="mc__num">${d}</span><span class="mc__state">${esc(label)}</span></time></li>`;
  }
  return out;
}

function init(host) {
  const today = todayLocal();
  const minMonth = monthStart(today);
  const maxMonth = addMonths(minMonth, Number(host.dataset.max) || 18);
  let slug = host.dataset.active;
  let month = `${host.dataset.month}-01`;
  if (month < minMonth) month = minMonth;
  if (month > maxMonth) month = maxMonth;
  const cache = new Map();
  const section = $('.mc', host);
  const title = $('.mc__head h3', host);
  const grid = $('.mc__grid', host);
  const prev = $('[data-mcal-nav="-1"]', host);
  const next = $('[data-mcal-nav="1"]', host);
  const tabs = $$('[data-mcal-tab]', host);
  let token = 0;
  let shown = { slug, month };

  async function nightsFor(cabin, m) {
    const key = `${cabin}|${m}`;
    if (!cache.has(key)) cache.set(key, api(`/api/availability?cabin=${cabin}&from=${m}&to=${addMonths(m, 1)}`).then((d) => d.nights).catch((e) => { cache.delete(key); throw e; }));
    return cache.get(key);
  }

  async function show() {
    const mine = ++token;
    const [y, mm] = month.split('-').map(Number);
    host.classList.add('is-loading');
    try {
      const nights = await nightsFor(slug, month);
      if (mine !== token) return;
      grid.innerHTML = gridHtml(month, nights, today);
    } catch {
      // Bez danych zostaje poprzedni widok (przy pierwszym wejściu to, co narysował serwer).
      if (mine !== token) return;
      ({ slug, month } = shown);
      tabs.forEach((t) => {
        t.classList.toggle('is-active', t.dataset.mcalTab === slug);
        t.setAttribute('aria-pressed', String(t.dataset.mcalTab === slug));
      });
      host.classList.remove('is-loading');
      return;
    }
    shown = { slug, month };
    host.classList.remove('is-loading');
    title.textContent = `${MONTHS[mm - 1]} ${y}`;
    section.dataset.cabinCalendar = slug;
    const atMin = month <= minMonth;
    const atMax = month >= maxMonth;
    prev.setAttribute('aria-disabled', String(atMin));
    next.setAttribute('aria-disabled', String(atMax));
    prev.tabIndex = atMin ? -1 : 0;
    next.tabIndex = atMax ? -1 : 0;
    // Następny miesiąc ładujemy z wyprzedzeniem, żeby przełączanie było natychmiastowe.
    if (!atMax) nightsFor(slug, addMonths(month, 1)).catch(() => {});
  }

  const go = (n) => {
    const target = addMonths(month, n);
    if (target < minMonth || target > maxMonth) return;
    month = target;
    show();
  };
  prev.addEventListener('click', (e) => { e.preventDefault(); go(-1); });
  next.addEventListener('click', (e) => { e.preventDefault(); go(1); });
  tabs.forEach((tab) => tab.addEventListener('click', (e) => {
    e.preventDefault();
    slug = tab.dataset.mcalTab;
    tabs.forEach((t) => {
      t.classList.toggle('is-active', t === tab);
      t.setAttribute('aria-pressed', String(t === tab));
    });
    show();
  }));
  show();
}

$$('[data-mcal]').forEach(init);
