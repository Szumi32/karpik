// Daty jako napisy YYYY-MM-DD. Liczymy w UTC, żeby zmiana czasu nie przesuwała dni.
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

export const todayWarsaw = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());
export const isIsoDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
export const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const diffDays = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
export const weekday = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();
export const monthDay = (iso) => iso.slice(5);

export const formatDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_GEN[m - 1]} ${y}`;
};
export const formatDateShort = (iso) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_GEN[m - 1]}`;
};
export const formatRange = (a, b) => {
  const [, ma, da] = a.split('-').map(Number);
  const [, mb, db] = b.split('-').map(Number);
  return ma === mb ? `${da}–${db} ${MONTHS_GEN[mb - 1]}` : `${da} ${MONTHS_GEN[ma - 1]} – ${db} ${MONTHS_GEN[mb - 1]}`;
};
export const weekdayName = (iso) => WEEKDAYS[weekday(iso)];

const plural = (n, one, few, many) => {
  if (n === 1) return one;
  const t = n % 10, h = n % 100;
  return t >= 2 && t <= 4 && !(h >= 12 && h <= 14) ? few : many;
};
export const pluralNights = (n) => `${n} ${plural(n, 'noc', 'noce', 'nocy')}`;
export const pluralGuests = (n) => `${n} ${plural(n, 'osoba', 'osoby', 'osób')}`;
// „do 1 osoby”, „do 4 osób”: po przyimku „do” zawsze dopełniacz.
export const upToGuests = (n) => `do ${n} ${n === 1 ? 'osoby' : 'osób'}`;
export const pluralCabins = (n) => `${n} ${plural(n, 'domek', 'domki', 'domków')}`;
export const formatPrice = (n) => `${Math.round(n).toLocaleString('pl-PL').replace(/ /g, ' ')} zł`;
