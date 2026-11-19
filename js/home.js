// Strona główna i lista domków: wyszukiwarka, wolne terminy na żywo, kalendarz miesiąca, jezioro.
import { $, $$, api, fmtDateShort, fmtRange, nightsLabel } from './util.js';
import { RangeCalendar, Timeline } from './calendar.js';
import './mcal.js';

/* Wyszukiwarka z kalendarzem w wyskakującym oknie */
$$('[data-search]').forEach((form) => {
  const pop = $('[data-pop]', form);
  const labels = { in: $('[data-label="in"]', form), out: $('[data-label="out"]', form) };
  const fields = { in: $('[data-open="in"]', form), out: $('[data-open="out"]', form) };
  let calendar = null;
  const close = () => {
    pop.hidden = true;
    Object.values(fields).forEach((f) => f.classList.remove('is-open'));
  };
  const open = (which) => {
    pop.hidden = false;
    Object.values(fields).forEach((f) => f.classList.remove('is-open'));
    fields[which].classList.add('is-open');
    if (!calendar) {
      calendar = new RangeCalendar(pop, {
        onChange: ({ start, end }) => {
          form.elements.od.value = start || '';
          form.elements.do.value = end || '';
          labels.in.textContent = start ? fmtDateShort(start) : 'Wybierz datę';
          labels.out.textContent = end ? fmtDateShort(end) : 'Wybierz datę';
          if (start && end) setTimeout(close, 220);
        },
      });
    }
  };
  $$('[data-open]', form).forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!pop.hidden && btn.classList.contains('is-open')) close();
    else open(btn.dataset.open);
  }));
  pop.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  const output = $('[data-guests]', form);
  $$('[data-step]', form).forEach((btn) => btn.addEventListener('click', () => {
    const value = Math.min(8, Math.max(1, Number(form.elements.goscie.value) + Number(btn.dataset.step)));
    form.elements.goscie.value = value;
    output.textContent = value;
  }));
  form.addEventListener('submit', (e) => {
    // Bez dat też przechodzimy dalej, kreator poprosi o wybranie terminu.
    if (!form.elements.od.value) form.elements.od.disabled = true;
    if (!form.elements.do.value) form.elements.do.disabled = true;
    e.target.dataset.sent = '1';
    setTimeout(() => { form.elements.od.disabled = false; form.elements.do.disabled = false; }, 0);
  });
});

/* Wideo w tle wejścia: film z YouTube (bez dźwięku, bez kontrolek, zapętlony wycinek). Zdjęcie zostaje jako zapasowe. */
const hero = $('[data-hero][data-bg-video]');
const saveData = navigator.connection?.saveData;
if (hero && !saveData && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const { bgVideo: id, start, end } = hero.dataset;
  const from = Number(start) || 0;
  const to = Number(end) || 0;
  const startVideo = () => {
    const frame = document.createElement('iframe');
    const params = new URLSearchParams({
      autoplay: '1', mute: '1', controls: '0', loop: '1', playlist: id, start: String(from), end: String(to),
      modestbranding: '1', rel: '0', playsinline: '1', disablekb: '1', fs: '0', iv_load_policy: '3', enablejsapi: '1',
    });
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params}`;
    frame.className = 'hero__video';
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.allow = 'autoplay; encrypted-media';
    const post = (msg) => frame.contentWindow?.postMessage(JSON.stringify(msg), '*');
    const onMessage = (e) => {
      if (e.source !== frame.contentWindow) return;
      let data;
      try { data = JSON.parse(e.data); } catch { return; }
      const playing = (data.event === 'onStateChange' && data.info === 1) || (data.event === 'infoDelivery' && data.info?.playerState === 1);
      if (playing) frame.classList.add('is-playing');
      // Zapętlenie wycinka: na końcu wracamy do początku.
      const t = data.event === 'infoDelivery' ? data.info?.currentTime : undefined;
      if (to && typeof t === 'number' && t >= to - 0.4) post({ event: 'command', func: 'seekTo', args: [from, true] });
    };
    window.addEventListener('message', onMessage);
    frame.addEventListener('load', () => post({ event: 'listening', id: 1, channel: 'widget' }));
    $('.hero__img', hero.querySelector('.hero__media')).after(frame);
    // Gdyby film się nie uruchomił, zostaje zdjęcie.
    setTimeout(() => {
      if (!frame.classList.contains('is-playing')) { frame.remove(); window.removeEventListener('message', onMessage); }
    }, 9000);
  };
  if (document.readyState === 'complete') setTimeout(startVideo, 400);
  else window.addEventListener('load', () => setTimeout(startVideo, 400), { once: true });
}

/* Najbliższe wolne terminy */
const freeHolders = $$('[data-next-free]');
const weekendLive = $('[data-weekend-live]');
if (freeHolders.length || weekendLive) {
  api('/api/next-free').then((data) => {
    freeHolders.forEach((el) => {
      const stay = data.cabins[el.dataset.nextFree];
      const text = $('.next-free__text', el);
      if (!stay) {
        text.textContent = 'Brak wolnych terminów w najbliższych miesiącach';
        return;
      }
      el.classList.add('is-ready');
      text.textContent = `Najbliższy wolny termin: ${fmtRange(stay.checkIn, stay.checkOut)}`;
    });
    if (weekendLive && data.weekend) {
      const { checkIn, checkOut, names } = data.weekend;
      $('[data-weekend-text]', weekendLive).textContent = `Najbliższy wolny weekend: ${fmtRange(checkIn, checkOut)} (${names.join(', ')})`;
      weekendLive.hidden = false;
    }
  }).catch(() => {
    freeHolders.forEach((el) => { $('.next-free__text', el).textContent = 'Sprawdź kalendarz domku'; });
  });
}

/* Oś czasu wszystkich domków */
$$('[data-timeline]').forEach((host) => new Timeline(host, { days: Number(host.dataset.days) || 35 }));

/* Przełącznik zdjęć Stodoły */
const swap = $('[data-season-swap]');
if (swap) {
  const imgs = $$('img', swap);
  const btns = $$('[data-season]', swap);
  btns.forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.season);
    imgs.forEach((im, k) => im.classList.toggle('is-active', k === i));
    btns.forEach((x, k) => {
      x.classList.toggle('is-active', k === i);
      x.setAttribute('aria-pressed', String(k === i));
    });
  }));
}

export { nightsLabel };
