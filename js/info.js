// Okolica, kontakt: mapa na żądanie, formularz, rysowanie jeziora.
import { $, esc, fieldErrors, post } from './util.js';

const mapBtn = $('[data-load-map]');
if (mapBtn) {
  mapBtn.addEventListener('click', () => {
    const frame = $('[data-map-frame]');
    const { lat, lon } = frame.dataset;
    const d = 0.045;
    const bbox = [Number(lon) - d * 1.6, Number(lat) - d, Number(lon) + d * 1.6, Number(lat) + d].join(',');
    frame.innerHTML = `<iframe title="Mapa okolicy Jeziora Białego" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}"></iframe>`;
    frame.hidden = false;
    mapBtn.hidden = true;
    frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}


const form = $('[data-contact-form]');
if (form) {
  const error = $('[data-form-error]', form);
  const success = $('[data-form-success]', form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    fieldErrors(form);
    error.hidden = true;
    success.hidden = true;
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    const f = form.elements;
    try {
      const res = await post('/api/contact', { name: f.name.value, email: f.email.value, phone: f.phone.value, message: f.message.value, firma: f.firma.value });
      if (res.static) {
        // Wersja pokazowa bez serwera: wiadomość otwiera się w poczcie gościa.
        success.innerHTML = `To pokazowa wersja strony, więc wiadomość nie wysyła się sama. Otwieramy Twoją pocztę z gotową treścią. Jeśli się nie otworzyła, <a href="${esc(res.mailto)}">kliknij tutaj</a> albo zadzwoń: <a href="tel:${esc(res.phoneHref)}">${esc(res.phone)}</a>.`;
        location.href = res.mailto;
      }
      form.reset();
      success.hidden = false;
    } catch (err) {
      fieldErrors(form, err.fields || {});
      error.textContent = err.fields ? Object.values(err.fields).join(' ') : err.message;
      error.hidden = false;
    }
    btn.disabled = false;
  });
}
