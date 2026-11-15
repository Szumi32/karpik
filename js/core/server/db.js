// Wersja statyczna: zamiast bazy danych zajęte terminy i ceny zapisane przy budowaniu strony.
// Udaje tylko te zapytania, których używa kalendarz; nic się tu nie zapisuje.
let DATA = {"bookings":{},"blocks":{"stodola":[["2026-11-20","2026-11-22"],["2026-12-04","2026-12-05"],["2026-12-14","2026-12-17"],["2027-01-01","2027-01-03"]],"rodzinny":[["2026-11-17","2026-11-21"],["2026-12-04","2026-12-09"],["2026-12-25","2027-01-01"]],"letniskowy":[["2026-11-20","2026-11-24"],["2026-12-12","2026-12-18"]],"drewniany":[["2026-11-29","2026-12-03"],["2026-12-18","2026-12-23"]]},"settings":{}};

const overlapping = (ranges = [], to, from) => ranges.filter(([start, end]) => start < to && end > from).map(([start, end]) => ({ start, end }));

// Plik data/blocks.json zapisuje właściciel w panelu. Po jego wczytaniu kalendarze liczą się z aktualnych zajętych nocy.
export const setLive = (blocks) => { DATA = { ...DATA, bookings: {}, blocks }; };

export const dataDir = '';
export const db = {
  exec() {},
  prepare(sql) {
    const table = /FROM blocks/.test(sql) ? DATA.blocks : /FROM bookings/.test(sql) ? DATA.bookings : null;
    return {
      all: (cabin, to, from) => (table ? overlapping(table[cabin], to, from) : []),
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  },
};
export const tx = (fn) => fn();
export const getSetting = (key, fallback = null) => (key in DATA.settings ? DATA.settings[key] : fallback);
export const setSetting = () => {};
