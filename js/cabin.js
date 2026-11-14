// Strona domku: podgląd zdjęć. Kalendarz jest zwykłym HTML-em z serwera.
import { $, $$ } from './util.js';

const data = JSON.parse($('#cabin-data').textContent);

/* Podgląd zdjęć */
let lb = null;
let lbIndex = 0;
let lastFocus = null;
function showPhoto(i) {
  lbIndex = (i + data.gallery.length) % data.gallery.length;
  const p = data.gallery[lbIndex];
  $('.lightbox__stage img', lb).replaceWith(Object.assign(new Image(), { src: p.src, alt: p.alt }));
  $('[data-lb-cap]', lb).textContent = `${p.alt}. Zdjęcie poglądowe.`;
  $('[data-lb-count]', lb).textContent = `${lbIndex + 1} / ${data.gallery.length}`;
}
function openLightbox(i) {
  if (!lb) {
    lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', `Zdjęcia domku ${data.name}`);
    lb.innerHTML = `<div class="lightbox__top"><span data-lb-count></span><button type="button" class="icon-btn" data-lb-close aria-label="Zamknij"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></div>
      <div class="lightbox__stage"><img alt="">
        <button type="button" class="icon-btn lightbox__prev" data-lb-move="-1" aria-label="Poprzednie zdjęcie"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m12.5 4-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button type="button" class="icon-btn lightbox__next" data-lb-move="1" aria-label="Następne zdjęcie"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m7.5 4 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div><p class="lightbox__cap" data-lb-cap></p>`;
    document.body.append(lb);
    lb.addEventListener('click', (e) => {
      if (e.target.closest('[data-lb-close]')) closeLightbox();
      const move = e.target.closest('[data-lb-move]');
      if (move) showPhoto(lbIndex + Number(move.dataset.lbMove));
    });
    let touchX = null;
    lb.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) showPhoto(lbIndex + (dx < 0 ? 1 : -1));
      touchX = null;
    });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') showPhoto(lbIndex + 1);
      if (e.key === 'ArrowLeft') showPhoto(lbIndex - 1);
    });
  }
  lastFocus = document.activeElement;
  lb.hidden = false;
  document.documentElement.classList.add('nav-open');
  showPhoto(i);
  $('[data-lb-close]', lb).focus();
}
function closeLightbox() {
  lb.hidden = true;
  document.documentElement.classList.remove('nav-open');
  lastFocus?.focus();
}
$$('[data-open-photo]').forEach((b) => b.addEventListener('click', () => openLightbox(Number(b.dataset.openPhoto))));
