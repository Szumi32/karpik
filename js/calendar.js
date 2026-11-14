// Kalendarz wyboru pobytu. Noc to zakres [dzień, następny dzień), więc dzień wyjazdu
// jednych gości może być dniem przyjazdu kolejnych.
import { api, addDays, addMonths, diffDays, DOW, esc, fmtDate, fmtRange, monthStart, MONTHS, nightsLabel, price, todayLocal, weekday } from './util.js';

const CHEV_L = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m12.5 4-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHEV_R = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m7.5 4 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export class RangeCalendar {
  // cabin: slug domku albo null, gdy szukamy we wszystkich domkach
  constructor(host, { cabin = null, start = null, end = null, onChange = () => {}, showPrices = Boolean(cabin), months = null } = {}) {
    Object.assign(this, { host, cabin, start, end, onChange, showPrices });
    this.today = todayLocal();
    this.months = months;
    this.nights = {};
    this.loaded = new Set();
    this.hoverDay = null;
    this.message = '';
    this.first = monthStart(start || this.today);
    this.host.classList.add('cal');
    this.host.addEventListener('click', (e) => this.onClick(e));
    this.host.addEventListener('mouseover', (e) => {
      const d = e.target.closest('[data-day]')?.dataset.day;
      if (d && d !== this.hoverDay && this.start && !this.end) {
        this.hoverDay = d;
        this.paintRange();
      }
    });
    this.host.addEventListener('keydown', (e) => this.onKey(e));
    this.mql = window.matchMedia('(max-width: 760px)');
    this.mql.addEventListener('change', () => this.refresh());
    this.refresh();
  }

  monthCount() {
    return this.months || (this.mql.matches ? 1 : 2);
  }

  async refresh() {
    const count = this.monthCount();
    const from = this.first;
    const to = addMonths(from, count + 1); // z zapasem, żeby znać długość wolnych okresów
    this.render();
    await this.load(from, to);
    this.render();
  }

  async load(from, to) {
    const key = `${from}|${to}`;
    if (this.loaded.has(key)) return;
    this.host.classList.add('is-loading');
    try {
      if (this.cabin) {
        const data = await api(`/api/availability?cabin=${this.cabin}&from=${from}&to=${to}`);
        Object.assign(this.nights, data.nights);
      } else {
        const data = await api(`/api/overview?from=${from}&to=${to}`);
        // Noc jest niedostępna tylko wtedy, gdy zajęte są wszystkie domki.
        const counts = {};
        data.cabins.forEach((c) => c.busy.forEach((d) => { counts[d] = (counts[d] || 0) + 1; }));
        for (let d = from; d < to; d = addDays(d, 1)) {
          this.nights[d] = { free: (counts[d] || 0) < data.cabins.length, freeCount: data.cabins.length - (counts[d] || 0) };
        }
      }
      this.loaded.add(key);
      this.error = '';
    } catch (err) {
      this.error = err.message;
    }
    this.host.classList.remove('is-loading');
  }

  minStay(day) {
    return this.nights[day]?.minStay || 1;
  }

  // Ile kolejnych wolnych nocy zaczyna się od danego dnia.
  freeRun(day, limit = 62) {
    let n = 0;
    let d = day;
    while (n < limit && this.nights[d]?.free) { n++; d = addDays(d, 1); }
    return n;
  }

  // Ostatni dzień, w którym można wyjechać przy danym przyjeździe.
  lastCheckout(start) {
    return addDays(start, this.freeRun(start));
  }

  dayState(day) {
    const night = this.nights[day];
    const prev = this.nights[addDays(day, -1)];
    const past = day < this.today;
    const busy = night ? !night.free : false;
    const prevBusy = prev ? !prev.free : false;
    const state = { past, busy, classes: [], disabled: past, title: '', known: Boolean(night) };
    if (past) state.classes.push('is-past');
    else if (busy) state.classes.push('is-busy');
    if (!past && busy && !prevBusy && day > this.today) state.classes.push('is-busy-start');
    if (!past && !busy && prevBusy && day > this.today) state.classes.push('is-busy-end');
    if (day === this.today) state.classes.push('is-today');
    if (night?.ask) {
      state.classes.push('is-ask');
      state.ask = true;
      state.title = 'Sylwester wyceniamy indywidualnie, zadzwoń';
    }

    if (!past) {
      if (this.start && !this.end) {
        if (day <= this.start) {
          // Klik wcześniejszej daty zaczyna wybór od nowa.
          state.disabled = busy;
        } else {
          const last = this.lastCheckout(this.start);
          if (day > last) { state.disabled = busy; state.free = true; } else {
            const min = this.minStay(this.start);
            if (diffDays(this.start, day) < min) {
              state.classes.push('is-short');
              state.title = `Minimalny pobyt w tym terminie: ${nightsLabel(min)}`;
            }
            state.disabled = false;
          }
        }
      } else if (busy) {
        state.disabled = true;
        state.title = state.ask ? state.title : 'Termin zajęty';
      } else if (night && this.freeRun(day) < this.minStay(day)) {
        state.disabled = true;
        state.classes.push('is-gap');
        state.title = `Za krótka przerwa, minimalny pobyt to ${nightsLabel(this.minStay(day))}`;
      }
    }
    return state;
  }

  label(day, st) {
    const parts = [fmtDate(day)];
    if (st.past) parts.push('minęło');
    else if (st.ask) parts.push('na zapytanie');
    else if (st.busy && st.disabled) parts.push('zajęte');
    else if (this.nights[day]?.price) parts.push(`${this.nights[day].price} zł za noc`);
    if (st.title) parts.push(st.title);
    return parts.join(', ');
  }

  render() {
    const count = this.monthCount();
    const canPrev = this.first > monthStart(this.today);
    const focusDay = this.host.querySelector('.cal__day:focus')?.dataset.day;
    let html = `<div class="cal__top">
      <button type="button" class="icon-btn" data-nav="-1" aria-label="Poprzedni miesiąc" ${canPrev ? '' : 'disabled'}>${CHEV_L}</button>
      <button type="button" class="icon-btn" data-nav="1" aria-label="Następny miesiąc">${CHEV_R}</button>
    </div><div class="cal__months" style="--cal-months:${count}">`;
    for (let i = 0; i < count; i++) html += this.renderMonth(addMonths(this.first, i));
    html += `</div><div class="cal__foot"><p class="cal__msg" role="status">${esc(this.error || this.statusText())}</p>
      ${this.start ? '<button type="button" class="cal__clear" data-clear>Wyczyść daty</button>' : ''}</div>`;
    this.host.innerHTML = html;
    this.paintRange();
    if (focusDay) this.host.querySelector(`[data-day="${focusDay}"]`)?.focus();
  }

  renderMonth(first) {
    const [y, m] = first.split('-').map(Number);
    const offset = (weekday(first) + 6) % 7;
    const next = addMonths(first, 1);
    let cells = DOW.map((d) => `<div class="cal__dow" aria-hidden="true">${d}</div>`).join('');
    cells += '<div></div>'.repeat(offset);
    for (let d = first; d < next; d = addDays(d, 1)) {
      const st = this.dayState(d);
      const price = this.showPrices && !st.past && this.nights[d]?.price ? `<small>${this.nights[d].price}</small>` : (this.showPrices ? '<small>&nbsp;</small>' : '');
      cells += `<button type="button" class="cal__day ${st.classes.join(' ')}" data-day="${d}" ${st.disabled ? 'disabled' : ''} aria-label="${esc(this.label(d, st))}" ${st.title ? `title="${esc(st.title)}"` : ''} tabindex="-1">${Number(d.slice(8))}${price}</button>`;
    }
    return `<div class="cal__month"><h3>${MONTHS[m - 1]} ${y}</h3><div class="cal__grid">${cells}</div></div>`;
  }

  paintRange() {
    const end = this.end || (this.start && this.hoverDay > this.start && this.hoverDay <= this.lastCheckout(this.start) ? this.hoverDay : null);
    let firstFocusable = null;
    this.host.querySelectorAll('.cal__day').forEach((el) => {
      const d = el.dataset.day;
      el.classList.toggle('is-start', d === this.start);
      el.classList.toggle('is-only', d === this.start && !end);
      el.classList.toggle('is-end', Boolean(this.end) && d === this.end);
      el.classList.toggle('is-in', Boolean(this.start && end && d > this.start && d <= end && !(this.end && d === this.end)));
      if (!el.disabled && !firstFocusable) firstFocusable = el;
    });
    const anchor = this.host.querySelector(`.cal__day.is-start:not([disabled])`) || firstFocusable;
    if (anchor) anchor.tabIndex = 0;
  }

  statusText() {
    if (this.message) return this.message;
    if (this.start && this.end) return `${fmtRange(this.start, this.end)}, ${nightsLabel(diffDays(this.start, this.end))}`;
    if (this.start) return `Przyjazd ${fmtDate(this.start)}. Teraz wybierz datę wyjazdu.`;
    return 'Wybierz datę przyjazdu.';
  }

  onKey(e) {
    const el = e.target.closest('.cal__day');
    if (!el) return;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    let d = el.dataset.day;
    for (let i = 0; i < 31; i++) {
      d = addDays(d, moves[e.key]);
      const target = this.host.querySelector(`.cal__day[data-day="${d}"]`);
      if (!target) return;
      if (!target.disabled) {
        el.tabIndex = -1;
        target.tabIndex = 0;
        target.focus();
        return;
      }
    }
  }

  onClick(e) {
    if (e.target.closest('[data-clear]')) {
      this.clear();
      return;
    }
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      this.first = addMonths(this.first, Number(nav.dataset.nav));
      this.refresh();
      return;
    }
    const cell = e.target.closest('.cal__day');
    if (!cell || cell.disabled) return;
    this.pick(cell.dataset.day);
  }

  pick(day) {
    this.message = '';
    if (!this.start || this.end || day <= this.start || day > this.lastCheckout(this.start)) {
      if (!this.nights[day]?.free) return;
      this.start = day;
      this.end = null;
      this.hoverDay = null;
    } else {
      const min = this.minStay(this.start);
      if (diffDays(this.start, day) < min) {
        this.message = `W tym terminie minimalny pobyt to ${nightsLabel(min)}.`;
        this.render();
        return;
      }
      this.end = day;
    }
    this.render();
    this.onChange({ start: this.start, end: this.end });
  }

  clear() {
    this.start = null;
    this.end = null;
    this.hoverDay = null;
    this.message = '';
    this.render();
    this.onChange({ start: null, end: null });
  }

  set(start, end) {
    this.start = start;
    this.end = end;
    if (start) this.first = monthStart(start);
    this.refresh();
  }
}

// Widok wszystkich domków na jednej osi.
export class Timeline {
  constructor(host, { days = 35, onPick = null } = {}) {
    Object.assign(this, { host, days, onPick });
    this.today = todayLocal();
    this.from = this.today;
    this.host.addEventListener('click', (e) => this.onClick(e));
    this.load();
  }

  async load() {
    const to = addDays(this.from, this.days);
    if (!this.data) this.host.innerHTML = '<div class="skeleton" style="height:340px"></div>';
    try {
      this.data = await api(`/api/overview?from=${this.from}&to=${to}`);
      this.render();
    } catch (err) {
      this.host.innerHTML = `<p class="form-error">${esc(err.message)}</p>`;
    }
  }

  monthLabel(day) {
    const [y, m] = day.split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }

  render() {
    const { cabins } = this.data;
    const dates = Array.from({ length: this.days }, (_, i) => addDays(this.from, i));
    const months = [];
    dates.forEach((d) => {
      const label = this.monthLabel(d);
      if (months.at(-1)?.label === label) months.at(-1).span += 1;
      else months.push({ label, span: 1 });
    });
    const isWe = (d) => [5, 6].includes(weekday(d));
    const dowShort = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
    const head1 = months.map((m) => `<th class="tl__month" colspan="${m.span}" scope="colgroup"><span>${m.label}</span></th>`).join('');
    const head2 = dates.map((d) => `<th class="tl__day ${isWe(d) ? 'is-we' : ''} ${d === this.today ? 'is-today' : ''}" scope="col"><b>${Number(d.slice(8))}</b>${dowShort[weekday(d)]}</th>`).join('');
    const rows = cabins.map((c) => {
      const busy = new Set(c.busy);
      const cells = dates.map((d) => {
        const b = busy.has(d);
        const cls = [isWe(d) ? 'is-we' : ''];
        if (b) {
          cls.push('is-busy');
          if (!busy.has(addDays(d, -1))) cls.push('is-busy-start');
          if (!busy.has(addDays(d, 1))) cls.push('is-busy-end');
          return `<td class="tl__cell ${cls.join(' ')}" aria-label="${c.name}, ${fmtDate(d)}: zajęte"></td>`;
        }
        return `<td class="tl__cell ${cls.join(' ')}"><button type="button" data-tl-day="${d}" data-tl-cabin="${c.slug}" aria-label="${c.name}, ${fmtDate(d)}: wolne, wybierz" title="${c.name}, ${fmtDate(d)}: wolne"></button></td>`;
      }).join('');
      return `<tr class="tl__row"><th class="tl__name" scope="row"><a href="/karpik/domki/${c.slug}">${c.name}</a><small>do ${c.guests} os.</small></th>${cells}</tr>`;
    }).join('');
    const canPrev = this.from > this.today;
    this.host.innerHTML = `<div class="tl__bar">
        <ul class="legend"><li><i></i>Wolne</li><li><i class="is-busy"></i>Zajęte</li></ul>
        <div class="tl__nav">
          <button type="button" class="icon-btn" data-tl-nav="-1" aria-label="Wcześniej" ${canPrev ? '' : 'disabled'}>${CHEV_L}</button>
          <b>${fmtRange(dates[0], dates.at(-1))}</b>
          <button type="button" class="icon-btn" data-tl-nav="1" aria-label="Później">${CHEV_R}</button>
        </div>
      </div>
      <div class="tl__scroll" tabindex="0" role="region" aria-label="Dostępność domków w kolejnych dniach">
        <table class="tl__table"><thead><tr><th class="tl__corner" rowspan="2"><span class="sr-only">Domek</span></th>${head1}</tr><tr>${head2}</tr></thead><tbody>${rows}</tbody></table>
      </div>
      <p class="tl__foot">Wolne i zajęte dni wszystkich domków. Rezerwację ustalasz telefonicznie.</p>`;
  }

  onClick(e) {
    const nav = e.target.closest('[data-tl-nav]');
    if (nav) {
      const next = addDays(this.from, Number(nav.dataset.tlNav) * 28);
      this.from = next < this.today ? this.today : next;
      this.load();
      return;
    }
    const cell = e.target.closest('[data-tl-day]');
    if (!cell) return;
    if (this.onPick) this.onPick({ cabin: cell.dataset.tlCabin, day: cell.dataset.tlDay });
  }
}

export { price };
