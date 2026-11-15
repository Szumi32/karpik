// Zapis i odczyt pliku z zajętymi terminami w repozytorium GitHub przez API (Contents). Token ma tylko właściciel.
// Plik: { "updated": "...", "blocks": { "stodola": [["2026-12-04", "2026-12-06"]], ... } }
import { normalize } from './blocks.js';

export class StoreError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

const toBase64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const fromBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

export function createStore({ repo, path, branch = 'main', apiBase = 'https://api.github.com', getToken, fetchImpl = (...a) => fetch(...a) }) {
  const url = `${apiBase}/repos/${repo}/contents/${path}`;

  async function call(method, query, body) {
    const token = getToken();
    if (!token) throw new StoreError('Brak tokenu GitHub.', 401);
    const res = await fetchImpl(`${url}${query}`, {
      method,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    if (res.status === 401) throw new StoreError('Token jest nieprawidłowy albo wygasł.', 401);
    if (res.status === 403) throw new StoreError('Token nie ma uprawnień do zapisu (potrzebne: Contents, odczyt i zapis) albo limit zapytań GitHuba został przekroczony.', 403);
    if (res.status === 404) throw new StoreError('Nie znaleziono pliku z terminami albo token nie ma dostępu do repozytorium.', 404);
    if (res.status === 409 || res.status === 422) throw new StoreError('Plik zmienił się w międzyczasie.', res.status);
    throw new StoreError(data.message || 'GitHub nie odpowiedział poprawnie.', res.status);
  }

  async function read() {
    const data = await call('GET', `?ref=${encodeURIComponent(branch)}`);
    let parsed;
    try { parsed = JSON.parse(fromBase64(data.content)); } catch { throw new StoreError('Plik z terminami jest uszkodzony.'); }
    const blocks = {};
    for (const [cabin, ranges] of Object.entries(parsed.blocks || {})) blocks[cabin] = normalize(ranges);
    return { sha: data.sha, blocks, updated: parsed.updated || null };
  }

  // Wczytuje plik, stosuje zmianę i zapisuje. Gdy ktoś zmienił plik w międzyczasie, próbuje jeszcze dwa razy.
  async function update(mutate, message = 'Zmiana terminów w panelu') {
    for (let attempt = 0; ; attempt++) {
      const current = await read();
      const blocks = mutate(structuredClone(current.blocks));
      const file = { updated: new Date().toISOString(), blocks };
      try {
        await call('PUT', '', { message, content: toBase64(`${JSON.stringify(file, null, 1)}\n`), sha: current.sha, branch });
        return blocks;
      } catch (err) {
        if (!(err instanceof StoreError) || ![409, 422].includes(err.status) || attempt >= 2) throw err;
      }
    }
  }

  return { read, update };
}
