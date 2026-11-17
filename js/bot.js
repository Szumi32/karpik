// Okno asystenta. Odpowiedź przychodzi strumieniem, a karty domków prowadzą do rezerwacji.
import { $, esc, fmtRange, nightsLabel, price, request } from './util.js';

const STORE = 'karpik-bot';
const START_CHIPS = ['Co jest wolne w lipcu?', 'Ile kosztuje domek dla 4 osób?', 'Czy jest balia?', 'Jaki jest minimalny pobyt?'];
const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const MARK = '<svg class="logo__mark" viewBox="0 0 32 32" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g stroke="currentColor" stroke-width="2.4"><path d="M4.5 14.6 16 3.4l11.5 11.2"/><path d="M7.7 11.9v6.4M24.3 11.9v6.4"/></g><g style="stroke:var(--accent)" stroke-width="2.2"><path d="M3.5 23.4q3.1-2.4 6.2 0t6.2 0 6.2 0 6.2 0"/><path d="M8 29.4q3.1-2.4 6.2 0t6.2 0 6.2 0"/></g></svg>';

// Bezpieczne formatowanie: najpierw uciekamy wszystko, potem dopuszczamy pogrubienie i bezpieczne linki.
function formatText(text) {
  const safeHref = (href) => (/^(\/[^\s]*|tel:[+\d]+|mailto:[^\s]+|https:\/\/[^\s]+)$/.test(href) ? href : null);
  const inline = (s) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
      const decoded = href.replace(/&amp;/g, '&');
      const ok = safeHref(decoded);
      if (!ok) return label;
      const external = ok.startsWith('https://') ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${esc(ok)}"${external}>${label}</a>`;
    });
  return text.trim().split(/\n{2,}/).map((p) => `<p>${p.split('\n').map(inline).join('<br>')}</p>`).join('');
}

export function initBot(root) {
  if (!root) return;
  let history = [];
  let cardsLog = [];
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) || 'null');
    if (saved) ({ history, cardsLog = [] } = saved);
  } catch { /* przeglądarka bez dostępu do pamięci */ }

  root.innerHTML = `
    <button type="button" class="bot-fab" data-fab aria-haspopup="dialog">${ICON}<span>Zapytaj asystenta</span></button>
    <section class="bot" data-panel role="dialog" aria-label="Asystent Domków nad Białym" hidden>
      <header class="bot__head">${MARK}<div><b>Asystent</b><small><span class="dot"></span>Odpowiada od razu</small></div>
        <button type="button" class="bot__close" data-close aria-label="Zamknij asystenta"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
      </header>
      <div class="bot__log" data-log aria-live="polite"></div>
      <div>
        <form class="bot__form" data-form>
          <textarea rows="1" name="q" placeholder="Napisz pytanie" aria-label="Twoje pytanie" maxlength="700"></textarea>
          <button class="bot__send" type="submit" aria-label="Wyślij" disabled><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 16V4m-5 5 5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </form>
        <p class="bot__foot">Asystent może się pomylić. Cena i dostępność w formularzu rezerwacji są wiążące.</p>
      </div>
    </section>`;

  const fab = $('[data-fab]', root);
  const panel = $('[data-panel]', root);
  const log = $('[data-log]', root);
  const form = $('[data-form]', root);
  const input = form.elements.q;
  const send = $('.bot__send', form);
  let busy = false;

  const save = () => {
    try { sessionStorage.setItem(STORE, JSON.stringify({ history: history.slice(-14), cardsLog: cardsLog.slice(-6) })); } catch { /* bez pamięci też działa */ }
  };
  const toBottom = () => { log.scrollTop = log.scrollHeight; };

  function bubble(role, text) {
    const el = document.createElement('div');
    el.className = `msg msg--${role === 'user' ? 'me' : 'bot'}`;
    if (role === 'user') el.textContent = text;
    else el.innerHTML = formatText(text);
    log.append(el);
    toBottom();
    return el;
  }

  function addChips(chips) {
    log.querySelector('.bot__chips')?.remove();
    if (!chips?.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'bot__chips';
    chips.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = c;
      b.addEventListener('click', () => ask(c));
      wrap.append(b);
    });
    log.append(wrap);
    toBottom();
  }

  function addCards(cards) {
    if (!cards?.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'bot__cards';
    wrap.innerHTML = cards.map((c, i) => `<a class="bot-card" href="${esc(c.href)}" style="animation-delay:${i * 0.06}s">
      <img src="${esc(c.photo)}" alt="" loading="lazy" width="84" height="66">
      <div><b>${esc(c.name)}</b><small>${esc(fmtRange(c.checkIn, c.checkOut))}, ${esc(nightsLabel(c.nights))}<br>do ${esc(c.guests)} os.${c.area ? `, ${esc(c.area)} m²` : ''}</small></div>
      <span>${esc(price(c.total))}</span></a>`).join('');
    log.append(wrap);
    toBottom();
  }

  function renderAll() {
    log.innerHTML = '';
    bubble('assistant', 'Dzień dobry! Jestem asystentem Domków nad Białym. Sprawdzę wolne terminy, policzę cenę pobytu i odpowiem na pytania o domki, balię, urodziny i okolicę.');
    let assistantIndex = 0;
    history.forEach((m) => {
      bubble(m.role, m.content);
      if (m.role === 'assistant') {
        const entry = cardsLog.find((c) => c.at === assistantIndex);
        if (entry) addCards(entry.cards);
        assistantIndex += 1;
      }
    });
    if (!history.length) addChips(START_CHIPS);
  }

  function open() {
    if (!log.childElementCount) renderAll();
    panel.hidden = false;
    fab.classList.add('is-hidden');
    toBottom();
    if (window.matchMedia('(min-width: 761px)').matches) input.focus();
    document.documentElement.classList.toggle('nav-open', window.matchMedia('(max-width: 760px)').matches);
  }
  function close() {
    panel.hidden = true;
    fab.classList.remove('is-hidden');
    document.documentElement.classList.remove('nav-open');
    fab.focus();
  }

  async function ask(question) {
    const text = question.trim();
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    log.querySelector('.bot__chips')?.remove();
    bubble('user', text);
    history.push({ role: 'user', content: text });
    save();

    const status = document.createElement('div');
    status.className = 'bot__status';
    status.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    log.append(status);
    toBottom();

    let answer = '';
    let el = null;
    let receivedCards = [];
    let chips = [];
    try {
      const res = await request('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-14) }),
      });
      if (!res.ok || !res.body) throw new Error('bad response');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          const ev = JSON.parse(part.slice(6));
          if (ev.type === 'text') {
            answer += ev.text;
            status.remove();
            if (!el) el = bubble('assistant', answer);
            else el.innerHTML = formatText(answer);
            toBottom();
          } else if (ev.type === 'status') {
            status.innerHTML = `<span class="typing"><i></i><i></i><i></i></span>${esc(ev.text)}`;
          } else if (ev.type === 'cards') {
            receivedCards = ev.cards;
          } else if (ev.type === 'chips') {
            chips = ev.chips;
          }
        }
      }
    } catch {
      answer = answer || 'Nie mogę się teraz połączyć. Spróbuj ponownie za chwilę albo zadzwoń do nas.';
      if (!el) el = bubble('assistant', answer);
    }
    status.remove();
    if (!answer) {
      answer = 'Nie mam teraz odpowiedzi. Spróbuj zapytać inaczej albo napisz do nas przez formularz kontaktowy.';
      bubble('assistant', answer);
    }
    addCards(receivedCards);
    addChips(chips);
    history.push({ role: 'assistant', content: answer });
    if (receivedCards.length) {
      cardsLog.push({ at: history.filter((m) => m.role === 'assistant').length - 1, cards: receivedCards });
    }
    save();
    busy = false;
    send.disabled = !input.value.trim();
  }

  fab.addEventListener('click', open);
  $('[data-close]', root).addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  input.addEventListener('input', () => {
    send.disabled = busy || !input.value.trim();
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value;
    input.value = '';
    input.style.height = 'auto';
    send.disabled = true;
    ask(q);
  });
  window.addEventListener('bot:ask', (e) => {
    open();
    ask(e.detail);
  });
}
