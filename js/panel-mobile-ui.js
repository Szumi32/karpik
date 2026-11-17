// Panel na telefon: dotknięcie dnia zaznacza noc jako zajętą (albo zwalnia już zajętą). Można zaznaczyć dowolnie wiele
// nocy naraz, także w różnych miesiącach, i zapisać jednym przyciskiem. Interfejs jest wspólny, a dane dostarcza „backend”:
// panel-mobile.js (serwer Node) albo panel-static.js (GitHub Pages i plik w repozytorium).
import { groupDays } from './blocks.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const WEEK = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];

const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
const weekday = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();
const shiftMonth = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
const longDate = (iso) => `${Number(iso.slice(8))} ${GEN[Number(iso.slice(5, 7)) - 1]}`;
const nights = (n) => `${n} ${n === 1 ? 'noc' : n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'noce' : 'nocy'}`;

export function startPanel(backend) {
  const loginBox = $('[data-login]');
  const setupBox = $('[data-setup]');
  const app = $('[data-app]');
  const grid = $('[data-grid]');
  const sheet = $('[data-sheet]');
  const toastBox = $('[data-toast]');
  const notes = backend.supportsNotes !== false;
  let toastTimer = 0;
  // pending: dzień -> 'add' (zajmij) albo 'remove' (zwolnij). info: otwarte okno z rezerwacją gościa.
  const state = { cabins: [], cabin: null, month: null, today: null, byNight: new Map(), pending: new Map(), info: null, note: '' };

  function toast(text) {
    toastBox.textContent = text;
    toastBox.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastBox.hidden = true; }, 4500);
  }
  function show(which) {
    loginBox.hidden = which !== 'login';
    if (setupBox) setupBox.hidden = which !== 'setup';
    app.hidden = which !== 'app';
    if (which === 'login') $('input', loginBox)?.focus();
    if (which === 'setup') $('input', setupBox)?.focus();
  }
  const fail = (err) => {
    if (err.unauthorized) { show('login'); return; }
    if (err.setupNeeded) { show('setup'); toast(err.message); return; }
    toast(err.message);
  };

  const remember = (slug) => { try { localStorage.setItem('karpik-panel-domek', slug); } catch { /* bez pamięci przeglądarki też działa */ } };
  const restore = () => { try { return localStorage.getItem('karpik-panel-domek'); } catch { return null; } };

  async function load() {
    const first = `${state.month}-01`;
    const next = `${shiftMonth(state.month, 1)}-01`;
    const res = await backend.load({ from: first, to: next });
    state.today = res.today;
    state.cabins = res.cabins.map((c) => ({ slug: c.slug, name: c.name }));
    if (!state.cabin || !state.cabins.some((c) => c.slug === state.cabin)) state.cabin = state.cabins[0]?.slug;
    const cabin = res.cabins.find((c) => c.slug === state.cabin);
    state.byNight = new Map();
    for (const b of cabin.blocks) {
      for (let d = b.start; d < b.end; d = addDays(d, 1)) state.byNight.set(d, { type: 'block', block: b });
    }
    for (const b of cabin.bookings || []) {
      for (let d = b.checkIn; d < b.checkOut; d = addDays(d, 1)) state.byNight.set(d, { type: 'booked', booking: b });
    }
    render();
  }
  const reload = () => load().catch(fail);

  function render() {
    $('[data-title]').textContent = `${MONTHS[Number(state.month.slice(5)) - 1]} ${state.month.slice(0, 4)}`;
    $('[data-cabins]').innerHTML = state.cabins.map((c) => `<button type="button" class="pm-chip${c.slug === state.cabin ? ' is-active' : ''}" data-cabin="${esc(c.slug)}" aria-pressed="${c.slug === state.cabin}">${esc(c.name)}</button>`).join('');

    const first = `${state.month}-01`;
    const days = diffDays(first, `${shiftMonth(state.month, 1)}-01`);
    const offset = (weekday(first) + 6) % 7;
    const cells = WEEK.map((d) => `<li class="pm-dow" aria-hidden="true">${d}</li>`);
    for (let i = 0; i < offset; i++) cells.push('<li class="pm-pad" aria-hidden="true"></li>');
    for (let d = 1; d <= days; d++) {
      const iso = `${state.month}-${String(d).padStart(2, '0')}`;
      const info = state.byNight.get(iso);
      const pend = state.pending.get(iso);
      let cls = 'is-free';
      let label = 'wolne';
      let spoken = 'wolne';
      if (pend === 'add') { cls = 'is-pend-add'; label = 'zajmij'; spoken = 'do zajęcia'; }
      else if (pend === 'remove') { cls = 'is-pend-free'; label = 'zwolnij'; spoken = 'do zwolnienia'; }
      else if (info?.type === 'block') { cls = 'is-block'; label = 'zajęte'; spoken = label; }
      else if (info?.type === 'booked') { cls = 'is-booked'; label = 'rez.'; spoken = 'rezerwacja'; }
      else if (iso < state.today) { cls = 'is-past'; label = ''; spoken = ''; }
      cells.push(`<li><button type="button" class="pm-day ${cls}" data-date="${iso}" aria-label="${longDate(iso)}${spoken ? ', ' + spoken : ''}"><b>${d}</b><small>${label}</small></button></li>`);
    }
    grid.innerHTML = cells.join('');
    renderSheet();
  }

  const counts = () => {
    let add = 0;
    let remove = 0;
    for (const v of state.pending.values()) if (v === 'add') add++; else remove++;
    return { add, remove };
  };

  // Dolny panel: podsumowanie niezapisanych zmian albo informacja o rezerwacji gościa.
  function renderSheet() {
    if (state.pending.size) {
      const { add, remove } = counts();
      state.note = $('[data-note]', sheet)?.value ?? state.note;
      const parts = [add ? `Zajmij: ${nights(add)}` : '', remove ? `Zwolnij: ${nights(remove)}` : ''].filter(Boolean).join('. ');
      sheet.hidden = false;
      sheet.innerHTML = `<p class="pm-sheet__title">Niezapisane zmiany</p>
        <p class="pm-sheet__text">${parts}. Dotknij dnia jeszcze raz, żeby cofnąć.</p>
        ${notes && add ? `<label class="pm-note"><span>Notatka (opcjonalnie)</span><input type="text" data-note maxlength="200" placeholder="np. Kowalscy, telefon" value="${esc(state.note)}"></label>` : ''}
        <div class="pm-actions"><button type="button" class="pm-btn" data-act="save">Zapisz</button><button type="button" class="pm-btn pm-btn--ghost" data-act="cancel">Anuluj</button></div>`;
      return;
    }
    if (state.info) {
      const b = state.info;
      sheet.hidden = false;
      sheet.innerHTML = `<p class="pm-sheet__title">Rezerwacja ${esc(b.code)}</p>
        <p class="pm-sheet__text">${esc(b.name)}, ${longDate(b.checkIn)} – ${longDate(b.checkOut)} (${nights(b.nights)}).<br>${b.phone ? `<a href="tel:${esc(b.phone)}">${esc(b.phone)}</a>` : ''}</p>
        <p class="pm-sheet__text">Rezerwacją zajmujesz się w pełnym panelu.</p>
        <div class="pm-actions"><a class="pm-btn" href="/panel">Pełny panel</a><button type="button" class="pm-btn pm-btn--ghost" data-act="cancel">Zamknij</button></div>`;
      return;
    }
    sheet.hidden = true;
    sheet.innerHTML = '';
  }

  function clearSelection() {
    state.pending.clear();
    state.info = null;
    state.note = '';
    render();
  }

  function onDay(iso) {
    const info = state.byNight.get(iso);
    if (info?.type === 'booked') {
      if (state.pending.size) { toast('To rezerwacja ze strony. Zmienisz ją w pełnym panelu.'); return; }
      state.info = info.booking;
      render();
      return;
    }
    if (iso < state.today) { toast('Ten dzień już minął.'); return; }
    state.info = null;
    if (state.pending.has(iso)) state.pending.delete(iso);
    else state.pending.set(iso, info?.type === 'block' ? 'remove' : 'add');
    render();
  }

  async function save() {
    const cabin = state.cabin;
    const pick = (kind) => groupDays([...state.pending].filter(([, v]) => v === kind).map(([d]) => d));
    const args = { cabin, add: pick('add'), remove: pick('remove'), reason: $('[data-note]', sheet)?.value.trim() || '' };
    sheet.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      if (backend.apply) {
        await backend.apply(args);
      } else {
        for (const [start, end] of args.remove) await backend.release({ cabin, start, end });
        for (const [start, end] of args.add) await backend.block({ cabin, start, end, reason: args.reason });
      }
      state.pending.clear();
      state.note = '';
      await load();
      toast(backend.afterSave || 'Zapisane.');
    } catch (err) {
      sheet.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      fail(err);
    }
  }

  sheet.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'cancel') clearSelection();
    if (btn.dataset.act === 'save') save();
  });
  grid.addEventListener('click', (e) => {
    const day = e.target.closest('[data-date]');
    if (day) onDay(day.dataset.date);
  });
  $('[data-cabins]').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cabin]');
    if (!chip || chip.dataset.cabin === state.cabin) return;
    if (state.pending.size) toast('Niezapisane zmiany poprzedniego domku zostały odrzucone.');
    state.cabin = chip.dataset.cabin;
    remember(state.cabin);
    state.pending.clear();
    state.info = null;
    state.note = '';
    reload();
  });
  $('[data-prev]').addEventListener('click', () => { state.month = shiftMonth(state.month, -1); state.info = null; reload(); });
  $('[data-next]').addEventListener('click', () => { state.month = shiftMonth(state.month, 1); state.info = null; reload(); });
  $('[data-logout]').addEventListener('click', async () => {
    await backend.logout().catch(() => {});
    show('login');
  });
  $('[data-forget]')?.addEventListener('click', () => {
    backend.setup?.forget();
    show('setup');
    toast('Token usunięty z tego telefonu.');
  });

  $('[data-login-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = $('[data-login-error]');
    error.hidden = true;
    try {
      await backend.login(Object.fromEntries(new FormData(e.target)));
      e.target.reset();
      start();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  });
  $('[data-setup-form]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = $('[data-setup-error]');
    const button = $('button[type="submit"]', e.target);
    error.hidden = true;
    button.disabled = true;
    try {
      await backend.setup.submit(Object.fromEntries(new FormData(e.target)));
      e.target.reset();
      start();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
    button.disabled = false;
  });

  async function start() {
    if (!(await backend.isLoggedIn().catch(() => false))) { show('login'); return; }
    if (backend.setup?.isNeeded()) { show('setup'); return; }
    show('app');
    state.month = state.month || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date()).slice(0, 7);
    state.cabin = state.cabin || restore();
    await reload();
  }
  start();
}
