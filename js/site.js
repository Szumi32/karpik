// Część wspólna: nagłówek, menu, odsłanianie, karty domków, asystent.
import { $, $$, reveal } from './util.js';
import { initBot } from './bot.js';

reveal();

/* Nagłówek chowa się przy przewijaniu w dół i wraca przy przewijaniu w górę. */
const header = $('[data-header]');
let lastY = window.scrollY;
function onScroll() {
  const y = window.scrollY;
  header.classList.toggle('is-solid', y > 40);
  if (!document.documentElement.classList.contains('nav-open')) {
    header.classList.toggle('is-hidden', y > lastY && y > 480);
  }
  lastY = y;
}
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

/* Menu na telefonie */
const toggle = $('[data-nav-toggle]');
const mobileNav = $('[data-mobile-nav]');
function setNav(open) {
  document.documentElement.classList.toggle('nav-open', open);
  mobileNav.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu');
}
toggle?.addEventListener('click', () => setNav(mobileNav.hidden));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });
$$('a', mobileNav).forEach((a) => a.addEventListener('click', () => setNav(false)));

/* Karty domków: zdjęcia zmieniają się same (bez najeżdżania), a po najechaniu myszą przewijają się szybciej. */
const photoSrc = (name) => `/karpik/img/${name}-800.webp`;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const AUTO_MS = 3600;
$$('.cabin-card[data-photos]').forEach((card, n) => {
  const media = $('.cabin-card__media', card);
  const dots = $$('.cabin-card__dots i', card);
  const names = card.dataset.photos.split(',');
  let imgs = null;
  let timer = null;
  let auto = null;
  let index = 0;
  let visible = false;
  let hovering = false;
  const show = (i) => {
    index = i;
    imgs.forEach((im, k) => im.classList.toggle('is-active', k === i));
    dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
  };
  const prepare = () => {
    if (imgs) return;
    imgs = [$('img', media)];
    names.forEach((name) => {
      const im = new Image();
      im.src = photoSrc(name);
      im.alt = '';
      im.loading = 'eager';
      media.insertBefore(im, $('.cabin-card__dots', media));
      imgs.push(im);
    });
  };
  const next = () => { prepare(); show((index + 1) % imgs.length); };
  // Karty przesuwają się z różnym rytmem, żeby wszystkie nie zmieniały zdjęć w jednej chwili.
  const startAuto = () => {
    if (reduceMotion || auto || hovering || !visible || document.hidden) return;
    auto = setInterval(next, AUTO_MS + n * 500);
  };
  const stopAuto = () => { clearInterval(auto); auto = null; };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) startAuto(); else stopAuto();
    }, { threshold: 0.35 }).observe(card);
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? stopAuto() : startAuto()));

  media.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    hovering = true;
    stopAuto();
    next();
    clearInterval(timer);
    timer = setInterval(next, 1500);
  });
  media.addEventListener('pointerleave', () => {
    if (!hovering) return;
    hovering = false;
    clearInterval(timer);
    startAuto();
  });
});
/* Asystent */
initBot($('[data-bot]'));
$$('[data-ask]').forEach((btn) => btn.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('bot:ask', { detail: btn.dataset.ask }));
}));

// Film z YouTube: odtwarzacz ładuje się dopiero po kliknięciu (bez śledzenia i bez spowalniania strony).
document.addEventListener('click', (e) => {
  const button = e.target.closest('.yt__play');
  if (!button) return;
  const frame = button.closest('[data-yt]');
  const iframe = document.createElement('iframe');
  const params = new URLSearchParams({ autoplay: '1', rel: '0', modestbranding: '1' });
  // Wycinek filmu: od sekundy start do sekundy end (strona głowna: 0:13 do 1:10).
  if (frame.dataset.start) params.set('start', frame.dataset.start);
  if (frame.dataset.end) params.set('end', frame.dataset.end);
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(frame.dataset.yt)}?${params}`;
  iframe.title = frame.dataset.title || 'Film';
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  frame.replaceChildren(iframe);
});
