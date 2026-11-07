// Wersja statyczna: zamiast bazy danych zajęte terminy i ceny zapisane przy budowaniu strony.
// Udaje tylko te zapytania, których używa kalendarz; nic się tu nie zapisuje.
const DATA = {"bookings":{"rodzinny":[["2026-11-09","2026-11-13"],["2026-11-27","2026-12-02"],["2026-12-18","2026-12-25"]],"stodola":[["2026-11-13","2026-11-15"],["2026-11-27","2026-11-28"],["2026-12-07","2026-12-10"],["2026-12-25","2026-12-27"]],"letniskowy":[["2026-11-13","2026-11-17"],["2026-12-05","2026-12-11"]],"drewniany":[["2026-11-22","2026-11-26"],["2026-12-11","2026-12-16"]]},"blocks":{},"settings":{}};

const overlapping = (ranges = [], to, from) => ranges.filter(([start, end]) => start < to && end > from).map(([start, end]) => ({ start, end }));

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
