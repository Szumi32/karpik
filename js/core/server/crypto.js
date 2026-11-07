// Zamiennik node:crypto w przeglądarce. Wersja statyczna nie tworzy rezerwacji, więc wystarczy losowanie bajtów.
export default { randomBytes: (n) => globalThis.crypto.getRandomValues(new Uint8Array(n)) };
