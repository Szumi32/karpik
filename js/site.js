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

/* Karty domków: po najechaniu zdjęcia zmieniają się same, palcem przełącza się dotknięciem kropek */
const photoSrc = (name) => `/karpik/img/${name}-800.webp`;
$$('.cabin-card[data-photos]').forEach((card) => {
  const media = $('.cabin-card__media', card);
  const dots = $$('.cabin-card__dots i', card);
  const names = card.dataset.photos.split(',');
  let imgs = null;
  let timer = null;
  let index = 0;
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
  media.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    prepare();
    show((index + 1) % imgs.length);
    clearInterval(timer);
    timer = setInterval(() => show((index + 1) % imgs.length), 1500);
  });
  media.addEventListener('pointerleave', () => {
    clearInterval(timer);
    if (imgs) show(0);
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
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(frame.dataset.yt)}?autoplay=1&rel=0&modestbranding=1`;
  iframe.title = frame.dataset.title || 'Film';
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  frame.replaceChildren(iframe);
});
