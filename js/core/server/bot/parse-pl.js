// Rozumienie dat i liczby osób w polskich pytaniach, bez zewnętrznych zależności.
import { addDays, isIsoDate, weekday } from '../dates.js';

export const normalize = (s) => s.toLowerCase()
  .replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[?!,;:]/g, ' ').replace(/\s+/g, ' ').trim();

const MONTHS = [
  ['stycz', 'styczen'], ['lut'], ['marz', 'marc'], ['kwie'], ['maj'], ['czerw'],
  ['lip'], ['sierp'], ['wrze'], ['pazdz'], ['listop'], ['grud'],
];
const MONTH_RE = '(stycz\\w*|lut\\w*|marz\\w*|marc\\w*|kwie\\w*|maj\\w*|czerw\\w*|lip\\w*|sierp\\w*|wrze\\w*|pazdz\\w*|listop\\w*|grud\\w*)';
const monthIndex = (word) => MONTHS.findIndex((stems) => stems.some((st) => word.startsWith(st)));
const pad = (n) => String(n).padStart(2, '0');

// Data bez roku: jeśli w tym roku już minęła, chodzi o przyszły rok.
function resolve(day, month, year, today) {
  let y = year ?? Number(today.slice(0, 4));
  if (y < 100) y += 2000;
  let iso = `${y}-${pad(month + 1)}-${pad(day)}`;
  if (!isIsoDate(iso)) return null;
  if (year === undefined && iso < today) iso = `${y + 1}-${pad(month + 1)}-${pad(day)}`;
  return iso;
}

const SEP = '(?:-|–|—|do|i|\\.\\.)';

function parseDates(t, today) {
  let m;
  // 12 grudnia - 3 stycznia
  m = t.match(new RegExp(`(\\d{1,2})\\s+${MONTH_RE}\\s*${SEP}\\s*(\\d{1,2})\\s+${MONTH_RE}`));
  if (m) {
    const a = resolve(+m[1], monthIndex(m[2]), undefined, today);
    let b = a && resolve(+m[3], monthIndex(m[4]), Number(a.slice(0, 4)), today);
    if (a && b && b <= a) b = resolve(+m[3], monthIndex(m[4]), Number(a.slice(0, 4)) + 1, today);
    if (a && b) return { checkIn: a, checkOut: b };
  }
  // 12-14 grudnia, od 12 do 14 grudnia
  m = t.match(new RegExp(`(\\d{1,2})\\s*${SEP}\\s*(\\d{1,2})\\s+${MONTH_RE}`));
  if (m) {
    const month = monthIndex(m[3]);
    const a = resolve(+m[1], month, undefined, today);
    const b = a && resolve(+m[2], month, Number(a.slice(0, 4)), today);
    if (a && b && b > a) return { checkIn: a, checkOut: b };
  }
  // 12.12-14.12 oraz 12.12.2026 - 14.12.2026
  m = t.match(new RegExp(`(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?\\s*${SEP}\\s*(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?`));
  if (m) {
    const a = resolve(+m[1], +m[2] - 1, m[3] ? +m[3] : undefined, today);
    let b = a && resolve(+m[4], +m[5] - 1, m[6] ? +m[6] : Number(a.slice(0, 4)), today);
    if (a && b && b <= a && !m[6]) b = resolve(+m[4], +m[5] - 1, Number(a.slice(0, 4)) + 1, today);
    if (a && b) return { checkIn: a, checkOut: b };
  }
  // 12-14.12
  m = t.match(/(\d{1,2})\s*(?:-|–)\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (m) {
    const a = resolve(+m[1], +m[3] - 1, m[4] ? +m[4] : undefined, today);
    const b = a && resolve(+m[2], +m[3] - 1, Number(a.slice(0, 4)), today);
    if (a && b && b > a) return { checkIn: a, checkOut: b };
  }
  // Pojedyncza data
  m = t.match(new RegExp(`(\\d{1,2})\\s+${MONTH_RE}`));
  if (m) {
    const a = resolve(+m[1], monthIndex(m[2]), undefined, today);
    if (a) return { checkIn: a };
  }
  m = t.match(/(?<![\d.])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?![\d])/);
  if (m) {
    const a = resolve(+m[1], +m[2] - 1, m[3] ? +m[3] : undefined, today);
    if (a) return { checkIn: a };
  }
  return null;
}

function parseKeywords(t, today) {
  const year = Number(today.slice(0, 4));
  const next = (mmdd) => { const iso = `${year}-${mmdd}`; return iso >= today ? iso : `${year + 1}-${mmdd}`; };
  if (/sylwest|nowy rok|nowego roku/.test(t)) { const a = next('12-29'); return { checkIn: a, checkOut: addDays(a, 4), label: 'Sylwester' }; }
  if (/swiet|boze narodzenie|bozego narodzenia|wigili/.test(t) && !/wielkanoc/.test(t)) { const a = next('12-23'); return { checkIn: a, checkOut: addDays(a, 4), label: 'święta' }; }
  if (/majowk/.test(t)) { const a = next('04-30'); return { checkIn: a, checkOut: addDays(a, 3), label: 'majówkę' }; }
  if (/walentynk/.test(t)) { const a = next('02-13'); return { checkIn: a, checkOut: addDays(a, 2), label: 'walentynki' }; }
  const fri = addDays(today, (5 - weekday(today) + 7) % 7);
  if (/(przyszl|nastepn|kolejn)\w* weekend/.test(t)) return { checkIn: addDays(fri, 7), checkOut: addDays(fri, 9), label: 'przyszły weekend' };
  if (/weekend/.test(t)) return { checkIn: fri, checkOut: addDays(fri, 2), label: 'najbliższy weekend' };
  if (/pojutrze/.test(t)) return { checkIn: addDays(today, 2) };
  if (/jutr/.test(t)) return { checkIn: addDays(today, 1) };
  if (/dzis|dzisiaj|dzisiejsz/.test(t)) return { checkIn: today };
  if (/za tydzien/.test(t)) return { checkIn: addDays(today, 7) };
  return null;
}

function parseNights(t) {
  let m = t.match(/(\d{1,2})\s*(?:noc|noce|nocy|nocki|nocek)\b/);
  if (m) return +m[1];
  m = t.match(/(\d{1,2})\s*(?:dni|doby|dob)\b/);
  if (m) return +m[1];
  if (/dwie noce|dwa dni|dwie doby/.test(t)) return 2;
  if (/trzy noce|trzy dni|trzy doby/.test(t)) return 3;
  if (/cztery noce|cztery dni/.test(t)) return 4;
  if (/(na )?tydzien\b/.test(t) && !/za tydzien/.test(t)) return 7;
  return null;
}

function parseGuests(t) {
  let m = t.match(/(\d{1,2})\s*(?:os\b|os\.|osob|osoby|osoba|dorosl|ludzi|gosci)/);
  if (m) return +m[1];
  m = t.match(/dla\s+(\d{1,2})\b/);
  if (m) return +m[1];
  if (/we dwoje|dwojga|dla pary|dla dwoch|dwie osoby|dwoch osob|z zona|z mezem|z dziewczyna|z chlopakiem|z partner/.test(t)) return 2;
  if (/we troje|trojga|trzy osoby|trzech osob/.test(t)) return 3;
  if (/we czworo|czworga|cztery osoby|czterech osob/.test(t)) return 4;
  if (/piec osob|pieciu osob|pieciorg/.test(t)) return 5;
  if (/szesc osob|szesciu osob|szesciorg/.test(t)) return 6;
  if (/osiem osob|osmiu osob|osmiorg/.test(t)) return 8;
  return null;
}

function parseMonth(t) {
  const m = t.match(new RegExp(`(?:^|\\s)(?:w|na|od|w calym)\\s+${MONTH_RE}`)) || t.match(new RegExp(`(?:^|\\s)${MONTH_RE}(?:\\s|$)`));
  if (!m) return null;
  const idx = monthIndex(m[1]);
  return idx >= 0 ? idx : null;
}

export function parseStay(raw, today) {
  const t = normalize(raw);
  // Numery bez kontekstu daty nie powinny psuć wyniku, np. „dla 4 osób 12-14 grudnia”.
  const stripped = t.replace(/\b\d{1,2}\s*(?:os\b|os\.|osob\w*|dorosl\w*|ludzi|gosci)/g, ' ').replace(/\bdla\s+\d{1,2}\b/g, ' ');
  const dates = parseDates(stripped, today) || parseKeywords(t, today);
  const nights = parseNights(stripped);
  const guests = parseGuests(t);
  const out = { guests, nights };
  if (dates) {
    out.checkIn = dates.checkIn;
    out.checkOut = dates.checkOut || (nights ? addDays(dates.checkIn, nights) : null);
    out.label = dates.label;
  } else {
    const month = parseMonth(t);
    if (month !== null) out.month = month;
  }
  return out;
}
