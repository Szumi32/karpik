// Wersja statyczna strony (GitHub Pages) nie ma serwera. Ten moduł odpowiada na te same zapytania co serwer,
// korzystając z tych samych plików z cenami, kalendarzem i bazą wiedzy bota, tylko w przeglądarce.
// Rezerwacji i wiadomości nie da się tu zapisać, więc dostają gotową treść e-maila do właściciela.
import { extras as extraList, site } from './core/data/offer.js';
import { diffDays, formatPrice, formatRange, isIsoDate, pluralNights } from './core/server/dates.js';
import { allCabins, cabinBySlug, quote } from './core/server/pricing.js';
import {
  calendar, checkRange, isFree, nextFreeStay, nextFreeWeekend, overview, searchStay, validateStay,
} from './core/server/availability.js';
import { answerRules } from './core/server/bot/rules.js';

class ApiError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 160;
const isPhone = (s) => typeof s === 'string' && s.replace(/\D/g, '').length >= 7 && s.length <= 30;
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mailto = (subject, body) => `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
const contactInfo = { phone: site.phone, phoneHref: site.phoneHref, email: site.email };

function bookingRequest(b) {
  const name = text(b.name, 120);
  const email = text(b.email, 160);
  const phone = text(b.phone, 30);
  const errors = {};
  if (name.length < 3) errors.name = 'Podaj imię i nazwisko.';
  if (!isEmail(email)) errors.email = 'Podaj poprawny adres e-mail.';
  if (!isPhone(phone)) errors.phone = 'Podaj numer telefonu.';
  if (b.terms !== true) errors.terms = 'Zaakceptuj regulamin, aby wysłać rezerwację.';
  if (Object.keys(errors).length) throw new ApiError(400, 'Sprawdź formularz.', { fields: errors });

  const guests = Number(b.guests);
  const invalid = validateStay({ slug: b.cabin, checkIn: b.checkIn, checkOut: b.checkOut, guests });
  if (invalid) throw new ApiError(400, invalid.message, { code: invalid.code, minStay: invalid.minStay });
  if (!isFree(b.cabin, b.checkIn, b.checkOut)) throw new ApiError(409, 'Ten termin jest już zajęty. Wybierz inny.', { code: 'busy' });

  const cabin = cabinBySlug(b.cabin);
  const chosen = Array.isArray(b.extras) ? b.extras.filter((e) => extraList.some((x) => x.id === e)) : [];
  const q = quote({ cabin, checkIn: b.checkIn, checkOut: b.checkOut, guests, extras: chosen });
  const extrasLine = q.lines.filter((l) => l.extra).map((l) => l.label).join(', ');
  const stay = `${cabin.name}, ${formatRange(b.checkIn, b.checkOut)} ${b.checkIn.slice(0, 4)}`;
  const notes = text(b.notes, 1000);
  const body = [
    'Dzień dobry,',
    '',
    `chcę zarezerwować: ${stay} (${pluralNights(q.nights)}), liczba osób: ${guests}.`,
    extrasLine ? `Dodatki: ${extrasLine}.` : null,
    `Cena według strony: ${formatPrice(q.total)}, zaliczka ${formatPrice(q.deposit)}.`,
    '',
    `Imię i nazwisko: ${name}`,
    `Telefon: ${phone}`,
    `E-mail: ${email}`,
    notes ? `Uwagi: ${notes}` : null,
  ].filter((l) => l !== null).join('\n');
  return {
    ok: true,
    static: true,
    ...contactInfo,
    mailto: mailto(`Rezerwacja: ${stay}`, body),
    message: 'To pokazowa wersja strony, więc rezerwacja nie trafia jeszcze do systemu. Wyślij ją e-mailem z gotową treścią albo zadzwoń, a termin zostanie zablokowany.',
  };
}

function contactRequest(b) {
  const name = text(b.name, 120);
  const email = text(b.email, 160);
  const phone = text(b.phone, 30);
  const message = text(b.message, 4000);
  const errors = {};
  if (name.length < 2) errors.name = 'Podaj imię.';
  if (!isEmail(email)) errors.email = 'Podaj poprawny adres e-mail.';
  if (message.length < 5) errors.message = 'Napisz, w czym możemy pomóc.';
  if (Object.keys(errors).length) throw new ApiError(400, 'Sprawdź formularz.', { fields: errors });
  const body = [message, '', name, phone, email].filter(Boolean).join('\n');
  return { ok: true, static: true, ...contactInfo, mailto: mailto(`Pytanie ze strony: ${name}`, body) };
}

function route(method, pathname, q, body) {
  if (method === 'POST' && /^\/api\/(quote|bookings)$/.test(pathname) && !site.onlineBooking) throw new ApiError(404, 'Rezerwacje online są wyłączone.');
  if (method === 'GET' && pathname === '/api/availability') {
    if (!cabinBySlug(q.cabin)) throw new ApiError(404, 'Nie znamy takiego domku.');
    const err = checkRange(q.from, q.to);
    if (err) throw new ApiError(400, err);
    return calendar(q.cabin, q.from, q.to);
  }
  if (method === 'GET' && pathname === '/api/overview') {
    const err = checkRange(q.from, q.to);
    if (err) throw new ApiError(400, err);
    return overview(q.from, q.to);
  }
  if (method === 'GET' && pathname === '/api/search') {
    const guests = Number(q.goscie) || 2;
    if (!isIsoDate(q.od) || !isIsoDate(q.do) || q.do <= q.od) throw new ApiError(400, 'Wybierz daty przyjazdu i wyjazdu.');
    return { checkIn: q.od, checkOut: q.do, guests, nights: diffDays(q.od, q.do), results: searchStay({ checkIn: q.od, checkOut: q.do, guests }) };
  }
  if (method === 'GET' && pathname === '/api/next-free') {
    return {
      weekend: nextFreeWeekend(),
      cabins: Object.fromEntries(allCabins().map((c) => [c.slug, nextFreeStay(c.slug)])),
    };
  }
  if (method === 'POST' && pathname === '/api/quote') {
    const { cabin: slug, checkIn, checkOut, guests, extras = [] } = body;
    const invalid = validateStay({ slug, checkIn, checkOut, guests: Number(guests) });
    if (invalid) throw new ApiError(400, invalid.message, { code: invalid.code, minStay: invalid.minStay });
    return quote({ cabin: cabinBySlug(slug), checkIn, checkOut, guests: Number(guests), extras: Array.isArray(extras) ? extras : [] });
  }
  if (method === 'POST' && pathname === '/api/bookings') return bookingRequest(body);
  if (method === 'POST' && pathname === '/api/contact') return contactRequest(body);
  throw new ApiError(404, 'Nie znaleziono.');
}

// Tak samo jak na serwerze: tylko tekst, naprzemienne role, ostatnia wiadomość od gościa.
function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const m of raw.slice(-14)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') continue;
    const content = m.content.trim().slice(0, 700);
    if (!content) continue;
    if (out.length && out.at(-1).role === m.role) out[out.length - 1] = { role: m.role, content };
    else out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out.at(-1)?.role === 'user' ? out : [];
}

// Bot odpowiada z bazy wiedzy, w tym samym strumieniu zdarzeń co na serwerze.
function chat(body) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      const history = cleanHistory(body.messages);
      let reply;
      try {
        reply = history.length ? answerRules(history.at(-1).content, history.slice(0, -1)) : { text: 'Napisz proszę swoje pytanie.' };
      } catch (err) {
        console.error(err);
        reply = { text: `Nie mam teraz odpowiedzi. Zadzwoń: [${site.phone}](tel:${site.phoneHref}).` };
      }
      await sleep(350);
      const words = reply.text.match(/\S+\s*/g) || [];
      for (let i = 0; i < words.length; i += 3) {
        emit({ type: 'text', text: words.slice(i, i + 3).join('') });
        await sleep(18);
      }
      if (reply.cards?.length) emit({ type: 'cards', cards: reply.cards.slice(0, 3) });
      if (reply.chips?.length) emit({ type: 'chips', chips: reply.chips });
      emit({ type: 'done', mode: 'rules' });
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
}

const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export async function fetchLocal(path, options = {}) {
  const url = new URL(path, location.href);
  const at = url.pathname.indexOf('/api/');
  const pathname = at >= 0 ? url.pathname.slice(at) : url.pathname;
  const method = (options.method || 'GET').toUpperCase();
  let body = {};
  try {
    body = options.body ? JSON.parse(options.body) : {};
  } catch {
    body = {};
  }
  if (pathname === '/api/chat') return chat(body);
  try {
    return reply(route(method, pathname, Object.fromEntries(url.searchParams), body));
  } catch (err) {
    if (err instanceof ApiError) return reply({ error: err.message, ...err.extra }, err.status);
    console.error(err);
    return reply({ error: 'Coś poszło nie tak. Spróbuj ponownie.' }, 500);
  }
}
