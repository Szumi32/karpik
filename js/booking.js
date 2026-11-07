// Kreator rezerwacji: termin, domek, dane.
import { $, $$, addDays, api, cabinsLabel, diffDays, esc, fieldErrors, fmtDate, fmtRange, isIso, nightsLabel, post, price, todayLocal } from './util.js';
import { RangeCalendar, Timeline } from './calendar.js';

const data = JSON.parse($('#booking-data').textContent);
const wizard = $('[data-wizard]');
const params = new URLSearchParams(location.search);

const state = {
  start: isIso(params.get('od')) ? params.get('od') : null,
  end: isIso(params.get('do')) ? params.get('do') : null,
  guests: Math.min(8, Math.max(1, Number(params.get('goscie')) || 2)),
  cabin: data.cabins.some((c) => c.slug === params.get('domek')) ? params.get('domek') : null,
  extras: new Set(),
  step: 1,
  reachable: 1,
};
if (state.start && state.start < todayLocal()) { state.start = null; state.end = null; }

const cabinOf = (slug) => data.cabins.find((c) => c.slug === slug);

function setStep(step, { push = true } = {}) {
  state.step = step;
  state.reachable = Math.max(state.reachable, step);
  $$('[data-step]', wizard).forEach((p) => { p.hidden = Number(p.dataset.step) !== step; });
  $$('[data-steps] li', wizard).forEach((li, i) => {
    li.classList.toggle('is-active', i + 1 === step);
    li.classList.toggle('is-done', i + 1 < step);
    $('button', li).disabled = i + 1 > state.reachable;
  });
  if (push) window.scrollTo({ top: 0, behavior: 'smooth' });
  syncUrl();
}

function syncUrl() {
  const q = new URLSearchParams();
  if (state.cabin) q.set('domek', state.cabin);
  if (state.start) q.set('od', state.start);
  if (state.end) q.set('do', state.end);
  q.set('goscie', state.guests);
  history.replaceState(null, '', `/karpik/rezerwacja?${q}`);
}

/* Krok 1: termin */
const rangeBox = $('[data-wz-range]');
const nextBtn = $('[data-wz-next]');
const stepError = $('[data-wz-error]');
function renderRange() {
  stepError.hidden = true;
  $('[data-wz-guests]').textContent = state.guests;
  if (state.start && state.end) {
    rangeBox.innerHTML = `<b>${esc(fmtRange(state.start, state.end))}</b><small>${esc(nightsLabel(diffDays(state.start, state.end)))}, ${state.guests} os.</small>`;
    nextBtn.disabled = false;
  } else if (state.start) {
    rangeBox.innerHTML = `<b>Przyjazd ${esc(fmtDate(state.start))}</b><small>Wybierz jeszcze datę wyjazdu.</small>`;
    nextBtn.disabled = true;
  } else {
    rangeBox.textContent = 'Wybierz datę przyjazdu i wyjazdu w kalendarzu.';
    nextBtn.disabled = true;
  }
  syncUrl();
}

const calendar = new RangeCalendar($('[data-calendar]', wizard), {
  start: state.start,
  end: state.end,
  showPrices: false,
  onChange: ({ start, end }) => {
    state.start = start;
    state.end = end;
    renderRange();
  },
});

$$('[data-wz-step]').forEach((b) => b.addEventListener('click', () => {
  state.guests = Math.min(8, Math.max(1, state.guests + Number(b.dataset.wzStep)));
  renderRange();
}));

$$('[data-timeline]', wizard).forEach((host) => new Timeline(host, {
  days: Number(host.dataset.days) || 35,
  onPick: ({ cabin, day }) => {
    state.cabin = cabin;
    state.start = day;
    state.end = null;
    calendar.set(day, null);
    renderRange();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
}));

nextBtn.addEventListener('click', () => showResults());

/* Krok 2: domek */
const resultsBox = $('[data-wz-results]');
const resultsTitle = $('[data-wz-results-title]');
async function showResults() {
  setStep(2);
  resultsTitle.textContent = `${fmtRange(state.start, state.end)}, ${nightsLabel(diffDays(state.start, state.end))}, ${state.guests} os.`;
  resultsBox.innerHTML = '<div class="skeleton" style="height:200px"></div><div class="skeleton" style="height:200px"></div>';
  let res;
  try {
    res = await api(`/api/search?od=${state.start}&do=${state.end}&goscie=${state.guests}`);
  } catch (err) {
    resultsBox.innerHTML = `<p class="form-error">${esc(err.message)}</p>`;
    return;
  }
  const free = res.results.filter((r) => r.available);
  const sorted = [...free, ...res.results.filter((r) => !r.available)];
  // Jeśli wybrany domek jest wolny, trafia na górę.
  if (state.cabin) sorted.sort((a, b) => (b.slug === state.cabin && b.available) - (a.slug === state.cabin && a.available));
  const intro = free.length
    ? `<p class="lead">Wolne ${esc(cabinsLabel(free.length))}. Cena jest za cały domek, z pościelą i parkingiem.</p>`
    : `<div class="results__empty"><h3>W tym terminie nie mamy wolnego domku dla ${state.guests} os.</h3><p>Spróbuj innych dat albo sprawdź kalendarz wszystkich domków.</p><button type="button" class="btn btn--ghost-dark" data-goto="1">Zmień daty</button></div>`;
  resultsBox.innerHTML = intro + sorted.map((r, i) => {
    const c = cabinOf(r.slug);
    return `<article class="result ${r.available ? '' : 'is-off'}" style="animation-delay:${i * 0.05}s">
      <img src="${esc(c.photo)}" alt="" width="520" height="340" style="background:${esc(c.photoColor)}">
      <div>
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.kind)}. Do ${c.guests} os.${c.area ? `, ${c.area} m²` : ''}.</p>
        ${r.available ? `<p><a href="/karpik/domki/${c.slug}" target="_blank">Zobacz zdjęcia i szczegóły</a></p>` : `<p class="result__why">${esc(r.message)}</p>`}
      </div>
      <div class="result__price">
        ${r.available ? `<div><b>${price(r.total)}</b><small>razem za ${esc(nightsLabel(r.nights))}</small></div><button type="button" class="btn" data-choose="${c.slug}">Wybieram</button>` : ''}
      </div>
    </article>`;
  }).join('');
}
resultsBox.addEventListener('click', (e) => {
  const choose = e.target.closest('[data-choose]');
  if (choose) {
    state.cabin = choose.dataset.choose;
    showDetails();
  }
  const back = e.target.closest('[data-goto]');
  if (back) setStep(Number(back.dataset.goto));
});

/* Krok 3: dodatki i dane */
const extrasBox = $('[data-wz-extras]');
const summaryBox = $('[data-wz-summary]');
const form = $('[data-wz-form]');
const formError = $('[data-form-error]', form);

function showDetails() {
  const cabin = cabinOf(state.cabin);
  setStep(3);
  const list = data.extras.filter((e) => !e.onlyCabins || e.onlyCabins.includes(cabin.slug));
  [...state.extras].forEach((id) => { if (!list.some((e) => e.id === id)) state.extras.delete(id); });
  extrasBox.innerHTML = list.map((e) => `<label class="extra">
    <input type="checkbox" value="${e.id}" ${state.extras.has(e.id) ? 'checked' : ''}>
    <span>${esc(e.name)}<small>${esc(e.note)}</small></span>
    <b>${price(e.price)}<small>${esc(e.unitLabel)}</small></b>
  </label>`).join('');
  updateSummary();
}
extrasBox.addEventListener('change', (e) => {
  if (e.target.checked) state.extras.add(e.target.value);
  else state.extras.delete(e.target.value);
  updateSummary();
});

let summaryRequest = 0;
async function updateSummary() {
  const id = ++summaryRequest;
  const cabin = cabinOf(state.cabin);
  try {
    const q = await post('/api/quote', { cabin: state.cabin, checkIn: state.start, checkOut: state.end, guests: state.guests, extras: [...state.extras] });
    if (id !== summaryRequest) return;
    summaryBox.innerHTML = `<img src="${esc(cabin.photo)}" alt="" width="520" height="292">
      <h3>${esc(cabin.name)}</h3>
      <p class="summary__meta">${esc(fmtRange(state.start, state.end))}, ${esc(nightsLabel(q.nights))}, ${state.guests} os.<br>Przyjazd od ${esc(data.checkIn)}, wyjazd do ${esc(data.checkOut)}.</p>
      <div class="summary__lines">
        ${q.lines.map((l) => `<div class="quote-line"><span>${esc(l.id === 'noclegi' ? nightsLabel(l.qty) : l.label)}</span><span>${price(l.amount)}</span></div>`).join('')}
        <div class="quote-line is-total"><span>Razem</span><span>${price(q.total)}</span></div>
        <div class="quote-line is-deposit"><span>Zaliczka ${data.depositPercent}%, przelewem w ciągu ${esc(data.holdLabel)}</span><span>${price(q.deposit)}</span></div>
      </div>`;
  } catch (err) {
    if (id !== summaryRequest) return;
    summaryBox.innerHTML = `<p class="form-error">${esc(err.message)}</p><button type="button" class="btn btn--ghost-dark" data-back-dates>Zmień daty</button>`;
    $('[data-back-dates]', summaryBox).addEventListener('click', () => setStep(1));
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  fieldErrors(form);
  formError.hidden = true;
  const btn = $('[data-wz-submit]', form);
  btn.disabled = true;
  btn.textContent = 'Wysyłam';
  const f = form.elements;
  try {
    const made = await post('/api/bookings', {
      cabin: state.cabin, checkIn: state.start, checkOut: state.end, guests: state.guests, extras: [...state.extras],
      name: f.name.value, email: f.email.value, phone: f.phone.value, notes: f.notes.value, terms: f.terms.checked, firma: f.firma.value,
    });
    if (made.static) return showStaticDone(made);
    location.href = `/karpik/rezerwacja/${made.code}?t=${made.token}`;
  } catch (err) {
    fieldErrors(form, err.fields || {});
    if (!err.fields) {
      formError.textContent = err.message;
      formError.hidden = false;
    }
    btn.disabled = false;
    btn.textContent = 'Wyślij rezerwację';
    if (err.code === 'busy') {
      formError.innerHTML = `${esc(err.message)} <a href="#" data-to-dates>Wybierz inny termin</a>`;
      $('[data-to-dates]', formError).addEventListener('click', (ev) => {
        ev.preventDefault();
        calendar.loaded.clear();
        calendar.refresh();
        setStep(1);
      });
    }
  }
});

// Wersja pokazowa bez serwera: gotową rezerwację gość wysyła e-mailem albo dzwoni.
function showStaticDone(made) {
  form.innerHTML = `<h2 class="wizard__h">Prawie gotowe</h2>
    <p>${esc(made.message)}</p>
    <div class="btn-row">
      <a class="btn btn--large" href="${esc(made.mailto)}">Wyślij rezerwację e-mailem</a>
      <a class="btn btn--large btn--ghost-dark" href="tel:${esc(made.phoneHref)}">Zadzwoń: ${esc(made.phone)}</a>
    </div>`;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$$('[data-steps] button', wizard).forEach((b) => b.addEventListener('click', () => {
  const step = Number(b.dataset.goto);
  if (step === 2 && state.start && state.end) showResults();
  else if (step === 3 && state.cabin && state.start && state.end) showDetails();
  else if (step === 1) setStep(1);
}));

/* Start: wejście z linku z datami i domkiem przeskakuje od razu dalej */
renderRange();
if (state.start && state.end) {
  state.reachable = 3;
  if (state.cabin) {
    api(`/api/search?od=${state.start}&do=${state.end}&goscie=${state.guests}`).then((res) => {
      const hit = res.results.find((r) => r.slug === state.cabin);
      if (hit?.available) showDetails();
      else showResults();
    }).catch(() => showResults());
  } else {
    showResults();
  }
} else {
  setStep(1, { push: false });
}
export { addDays };
