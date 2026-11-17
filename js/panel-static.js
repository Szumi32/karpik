// Panel właściciela na GitHub Pages. Bez serwera: terminy leżą w pliku data/blocks.json w repozytorium,
// a zapis idzie przez API GitHuba z tokenem, który właściciel wkleja raz na swoim telefonie.
// Login i hasło to tylko bramka przed ekranem panelu. Prawdziwą ochroną zapisu jest token (bez niego GitHub nic nie zapisze).
import { startPanel } from './panel-mobile-ui.js';
import { addBlock, releaseRange } from './blocks.js';
import { createStore, StoreError } from './github-store.js';

const cfg = JSON.parse(document.getElementById('panel-config').textContent);
const TOKEN_KEY = 'karpik-panel-token';
const GATE_KEY = 'karpik-panel-ok';
const GATE_HOURS = 12;

const local = ['localhost', '127.0.0.1'].includes(location.hostname);
// Do prób na własnym komputerze można podać adres atrapy API: ?api=http://localhost:5591. Na prawdziwej stronie ten parametr jest ignorowany.
const apiBase = (local && new URLSearchParams(location.search).get('api')) || 'https://api.github.com';

const safe = (fn) => { try { return fn(); } catch { return null; } };
const getToken = () => safe(() => localStorage.getItem(TOKEN_KEY)) || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());

const store = createStore({ repo: cfg.repo, path: cfg.path, branch: cfg.branch, apiBase, getToken });

const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => Uint8Array.from(s.match(/../g) || [], (h) => parseInt(h, 16));
async function derive(password) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unhex(cfg.salt), iterations: cfg.iterations, hash: 'SHA-256' }, key, 256));
}

// Błędy GitHuba, po których trzeba wkleić token jeszcze raz, wracają do ekranu tokenu.
function mapError(err) {
  if (err instanceof StoreError && err.status === 401) {
    safe(() => localStorage.removeItem(TOKEN_KEY));
    return Object.assign(err, { setupNeeded: true });
  }
  return err;
}
const guard = (fn) => async (...args) => {
  try { return await fn(...args); } catch (err) { throw mapError(err); }
};

startPanel({
  supportsNotes: false, // repozytorium jest publiczne, więc nie zapisujemy w nim nazwisk gości
  afterSave: 'Zapisane. Na stronie zmiana pojawi się za około minutę.',

  async isLoggedIn() {
    const at = Number(safe(() => sessionStorage.getItem(GATE_KEY)));
    return Boolean(at) && Date.now() - at < GATE_HOURS * 3600e3;
  },
  async login({ login, password }) {
    const ok = String(login || '').trim().toLowerCase() === cfg.login && (await derive(String(password || ''))) === cfg.hash;
    if (!ok) { await sleep(900); throw new Error('Nieprawidłowy login lub hasło.'); }
    safe(() => sessionStorage.setItem(GATE_KEY, String(Date.now())));
  },
  async logout() { safe(() => sessionStorage.removeItem(GATE_KEY)); },

  setup: {
    isNeeded: () => !getToken(),
    async submit({ token }) {
      const value = String(token || '').trim();
      if (value.length < 20) throw new Error('To nie wygląda na token GitHub. Skopiuj go w całości.');
      safe(() => localStorage.setItem(TOKEN_KEY, value));
      try {
        await store.read();
      } catch (err) {
        safe(() => localStorage.removeItem(TOKEN_KEY));
        throw err;
      }
    },
    forget: () => safe(() => localStorage.removeItem(TOKEN_KEY)),
  },

  load: guard(async ({ from, to }) => {
    const { blocks } = await store.read();
    return {
      today: today(),
      cabins: cfg.cabins.map((c) => ({
        slug: c.slug,
        name: c.name,
        bookings: [],
        blocks: (blocks[c.slug] || []).filter(([s, e]) => s < to && e > from).map(([start, end]) => ({ start, end, reason: '' })),
      })),
    };
  }),
  // Wszystkie zaznaczone noce zapisują się jedną zmianą pliku, czyli jednym commitem.
  apply: guard(({ cabin, add, remove }) => store.update((blocks) => {
    let list = blocks[cabin] || [];
    for (const [start, end] of remove) list = releaseRange(list, start, end);
    for (const [start, end] of add) list = addBlock(list, start, end);
    return { ...blocks, [cabin]: list };
  }, `Terminy: ${cabin}, zajęte ${add.length}, zwolnione ${remove.length}`)),
  block: guard(({ cabin, start, end }) => store.update((blocks) => ({ ...blocks, [cabin]: addBlock(blocks[cabin] || [], start, end) }), `Zajęte: ${cabin} ${start} – ${end}`)),
  release: guard(({ cabin, start, end }) => store.update((blocks) => ({ ...blocks, [cabin]: releaseRange(blocks[cabin] || [], start, end) }), `Zwolnione: ${cabin} ${start} – ${end}`)),
});
