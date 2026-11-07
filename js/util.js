// Drobne narzędzia wspólne dla wszystkich stron.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
export const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
export const DOW = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];

export const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const diffDays = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
export const weekday = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();
export const monthStart = (iso) => iso.slice(0, 7) + '-01';
export const addMonths = (iso, n) => {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
};
export const isIso = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const todayLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());

export const fmtDate = (iso) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_GEN[m - 1]}`;
};
export const fmtDateShort = (iso) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_GEN[m - 1].slice(0, 3)}`;
};
export const fmtRange = (a, b) => {
  const [, ma, da] = a.split('-').map(Number);
  const [, mb, db] = b.split('-').map(Number);
  return ma === mb ? `${da}–${db} ${MONTHS_GEN[mb - 1]}` : `${da} ${MONTHS_GEN[ma - 1]} – ${db} ${MONTHS_GEN[mb - 1]}`;
};
export const price = (n) => `${Math.round(n).toLocaleString('pl-PL').replace(/ /g, ' ')} zł`;

const plural = (n, one, few, many) => {
  if (n === 1) return one;
  const t = n % 10, h = n % 100;
  return t >= 2 && t <= 4 && !(h >= 12 && h <= 14) ? few : many;
};
export const nightsLabel = (n) => `${n} ${plural(n, 'noc', 'noce', 'nocy')}`;
export const guestsLabel = (n) => `${n} ${plural(n, 'osoba', 'osoby', 'osób')}`;
export const cabinsLabel = (n) => `${n} ${plural(n, 'domek', 'domki', 'domków')}`;

// Wersja statyczna (GitHub Pages, <html data-static="1">) nie ma serwera: zapytania liczy wtedy przeglądarka.
export const STATIC = document.documentElement.dataset.static === '1';
export const request = (path, options) => (STATIC ? import('./static-api.js').then((m) => m.fetchLocal(path, options)) : fetch(path, options));

export async function api(path, options) {
  const res = await request(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Nie udało się połączyć z serwerem. Spróbuj ponownie.');
    Object.assign(err, { status: res.status, code: data.code, fields: data.fields, minStay: data.minStay });
    throw err;
  }
  return data;
}
export const post = (path, body) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function reveal(root = document) {
  const items = $$('.reveal:not(.is-in)', root);
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  // Rodzeństwo pojawia się z małym opóźnieniem, bez przeciągania.
  const groups = new Map();
  items.forEach((el) => {
    const i = groups.get(el.parentElement) || 0;
    groups.set(el.parentElement, i + 1);
    el.style.setProperty('--d', `${Math.min(i, 4) * 0.07}s`);
    io.observe(el);
  });
}

export function fieldErrors(form, fields = {}) {
  $$('[data-err]', form).forEach((el) => { el.textContent = fields[el.dataset.err] || ''; });
  $$('.field', form).forEach((f) => {
    const input = $('input, select, textarea', f);
    f.classList.toggle('has-error', Boolean(input && fields[input.name]));
  });
  const firstBad = Object.keys(fields)[0];
  if (firstBad) form.elements[firstBad]?.focus?.();
}
