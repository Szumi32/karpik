// Bot bez AI: rozpoznaje temat pytania i odpowiada z danych oferty oraz z kalendarza.
// Działa zawsze, także bez klucza API i po przekroczeniu dziennego limitu.
import { attractions, distances, faq, lakeFacts, site } from '../../data/offer.js';
import { formatPrice, formatRange, pluralNights, todayWarsaw } from '../dates.js';
import { allCabins } from '../pricing.js';
import { normalize, parseStay } from './parse-pl.js';
import { checkStay, freeInMonth, nextFree } from './tools.js';

const faqAnswer = (id) => faq.find((f) => f.id === id).a;
const fitting = (guests) => allCabins().filter((c) => c.guests >= guests);
const cabinLine = (c) => `**${c.name}**: do ${c.guests} os.${c.area ? `, ${c.area} m²` : ''}, ${formatPrice(c.price)} za dobę${c.extraGuestPrice ? ` (w cenie ${c.guestsIncluded} os.)` : ''}`;
const MONTH_LOC = ['styczniu', 'lutym', 'marcu', 'kwietniu', 'maju', 'czerwcu', 'lipcu', 'sierpniu', 'wrześniu', 'październiku', 'listopadzie', 'grudniu'];
const contact = () => `[${site.phone}](tel:${site.phoneHref})`;
const sms = () => `[wyślij SMS](${site.smsHref})`;

function availabilityAnswer(stay, today) {
  const guests = stay.guests || 2;
  if (stay.checkIn && stay.checkOut) {
    const res = checkStay({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests });
    if (res.error) return { text: `${res.error} Podaj proszę daty w przyszłości, na przykład „12-16 lipca”.` };
    const label = stay.label ? `${stay.label} (${formatRange(stay.checkIn, stay.checkOut)})` : formatRange(stay.checkIn, stay.checkOut);
    if (res.inquiry && !res.free.length) {
      return { text: `${res.inquiry} Zadzwoń: ${contact()} albo ${sms()}.` };
    }
    if (res.tooShort) {
      return {
        text: `W tym terminie minimalny pobyt to ${pluralNights(res.minStay)}. W lipcu i sierpniu w każdym domku obowiązują co najmniej 4 noce, poza sezonem możliwy jest krótszy pobyt. [Sprawdź terminy](/karpik/terminy).`,
        chips: ['Jaki jest najbliższy wolny termin?'],
      };
    }
    if (res.free.length) {
      return {
        text: `Na ${label} dla ${guests} os. wolne są: ${res.free.map((f) => `**${f.name}** (${formatPrice(f.total)} za ${pluralNights(res.nights)})`).join(', ')}.`,
        cards: res.cards,
      };
    }
    const alt = nextFree({ from: stay.checkIn, nights: res.nights, guests }).slice(0, 3);
    return {
      text: `Na ${label} dla ${guests} os. nie mamy niestety wolnego domku.${alt.length ? ` Najbliższe wolne terminy tej długości: ${alt.map((a) => `**${a.name}** ${a.label}`).join(', ')}.` : ''}`,
      cards: alt.map((a) => a.card).filter(Boolean),
    };
  }
  if (stay.checkIn) {
    return {
      text: `Na ile nocy chcesz przyjechać? Napisz na przykład „na 4 noce”. Możesz też [sprawdzić terminy](/karpik/terminy?od=${stay.checkIn}).`,
      chips: ['Na 4 noce', 'Na 5 nocy', 'Na tydzień'],
    };
  }
  if (stay.month !== undefined) {
    const now = Number(today.slice(5, 7)) - 1;
    const year = Number(today.slice(0, 4)) + (stay.month < now ? 1 : 0);
    const list = freeInMonth({ month: stay.month, year }).filter((c) => !stay.guests || c.guests >= stay.guests);
    const lines = list.filter((c) => c.wolne.length).map((c) => `**${c.name}**: ${c.wolne.slice(0, 3).map((r) => r.opis).join(', ')}${c.wolne.length > 3 ? ' i inne' : ''}`);
    if (!lines.length) return { text: `W ${MONTH_LOC[stay.month]} nie mamy już wolnych terminów. Sprawdź [terminy](/karpik/terminy) albo zapytaj o inny miesiąc.` };
    return { text: `Wolne w ${MONTH_LOC[stay.month]} ${year}:\n${lines.join('\n')}\n\nPodaj daty, a sprawdzę dokładną cenę. Wszystko widać też w [terminach](/karpik/terminy).` };
  }
  const soon = nextFree({ guests: stay.guests, nights: stay.nights }).slice(0, 3);
  return {
    text: `Najbliższe wolne terminy: ${soon.map((a) => `**${a.name}** ${a.label}`).join(', ')}. Podaj swoje daty, na przykład „12-16 lipca”, a sprawdzę je od razu.`,
    cards: soon.map((a) => a.card).filter(Boolean),
    chips: ['Co jest wolne w lipcu?', 'Wolne terminy w sierpniu'],
  };
}

const INTENTS = [
  { id: 'hello', re: /^(czesc|hej|witam|dzien dobry|dobry wieczor|siema|halo|elo)\b/, answer: () => ({
    text: `Dzień dobry! Chętnie pomogę w sprawie domków, cen, wolnych terminów i atrakcji w ${site.name}. O co chcesz zapytać?`,
    chips: ['Co jest wolne w lipcu?', 'Ile kosztuje domek dla 4 osób?', 'Czy jest balia?'],
  }) },
  { id: 'thanks', re: /\b(dzieki|dziekuje|dzienki|super|ok dzieki)\b/, answer: () => ({ text: 'Bardzo proszę. Jeśli coś jeszcze przyjdzie Ci do głowy, pisz śmiało.' }) },
  { id: 'human', re: /\b(telefon|numer|zadzwon|kontakt|mail|e-mail|email|czlowiek|obsluga|wlasciciel|konsultant|recepcj)\b/, answer: () => ({
    text: `Kontakt jest telefoniczny: zadzwoń ${contact()} albo ${sms()}.`,
  }) },
  { id: 'howbook', re: /\b(jak|gdzie)\b.*\b(zarezerw|rezerwac|zamowic)|chce zarezerwowac|chcialbym zarezerwowac|chcialabym zarezerwowac/, answer: () => ({
    text: `Rezerwację ustalasz telefonicznie: zadzwoń ${contact()} albo ${sms()}. Po ustaleniu terminu wpłacasz zaliczkę ${site.depositPercent}% w ciągu ${site.holdLabel}. Wolne dni sprawdzisz w [terminach](/karpik/terminy).`,
  }) },
  { id: 'dog', re: /\b(pies|psem|psa|psiak|zwierz|kot|kota)\w*/, answer: () => ({ text: `Tego nie mam w opisie obiektu, więc najlepiej zapytać telefonicznie: ${contact()}.` }) },
  { id: 'holiday', re: /sylwest|swiet|boze cialo|bozego ciala|majowk|wielkanoc/, answer: () => ({ text: faqAnswer('swieta') }) },
  { id: 'minimum', re: /minimal|minimum|najkrot|jedna noc|jedną noc|na jedna|na noc\b|na weekend|weekend/, answer: () => ({ text: faqAnswer('minimum') }) },
  { id: 'tub', re: /jacuzzi|balia|balii|bali\b|spa\b|wanna|hot tub|sauna/, answer: () => ({ text: faqAnswer('balia'), chips: ['Pokaż Stodołę'] }) },
  { id: 'kids', re: /\b(dzieci|dzieck|dzieckiem|lozeczk|krzeselk|rodzin|plac zabaw|trampolin)\w*/, answer: () => ({ text: `${faqAnswer('dzieci')} [Strefa dla dzieci](/karpik/dzieci).` }) },
  { id: 'birthday', re: /urodzin/, answer: () => ({ text: faqAnswer('urodziny') }) },
  { id: 'privacy', re: /prywatnos|cisza|spokoj|odleglosc\w* miedzy|blisko siebie|sasiad/, answer: () => ({ text: faqAnswer('prywatnosc') }) },
  { id: 'checkin', re: /zameldow|wymeldow|doba hotelowa|o ktorej|check.?in|check.?out|przyjazd.*godzin|godzin.*przyjazd/, answer: () => ({ text: faqAnswer('doba') }) },
  { id: 'cancel', re: /anulow|rezygn|odwolac|zwrot|przelozyc/, answer: () => ({ text: faqAnswer('anulowanie') }) },
  { id: 'payment', re: /zaliczk|platno|zaplac|przelew|blik|karta|kart[aą]|gotowk|kaucj/, answer: () => ({ text: faqAnswer('platnosc') }) },
  { id: 'fishing', re: /ryb|wedk|lowisk|staw|karp/, answer: () => ({ text: faqAnswer('wedkowanie') }) },
  { id: 'food', re: /\b(bar|baru|barze|sklep\w*|restaurac\w*|obiad\w*|kolacj\w*|sniadani\w*|jedzeni\w*|zjesc|posilk\w*|piwo|ogrodek)\b/, answer: () => ({
    text: faqAnswer('jedzenie'),
  }) },
  { id: 'parking', re: /parking|zaparkow|auto\b|samochod/, answer: () => ({ text: faqAnswer('parking') }) },
  { id: 'lake', re: /jezior|plaz|kapiel|kapac|woda|wody|pomost|kajak|rower wodn|sup\b/, answer: () => ({
    text: `${faqAnswer('jezioro')} Samo jezioro: ${lakeFacts.map((f) => `${f.v} (${f.l})`).join(', ')}. Więcej w zakładce [Okolica](/karpik/okolica).`,
  }) },
  { id: 'route', re: /dojazd|dojechac|jak trafic|adres|gdzie (jest|lezy|sa|to)|lokalizac|odleglos|daleko|mapa|pociag/, answer: () => ({
    text: `Adres: ${site.address}. ${distances.slice(0, 2).concat(distances.at(-1)).map((d) => `${d.to}: ${d.km} km, ${d.time}`).join('; ')}. [Wyznacz trasę](${site.directionsUrl}).`,
  }) },
  { id: 'around', re: /atrakcj|okolic|zwiedz|co robic|co mozna|plock|wycieczk|las\b|spacer/, answer: () => ({
    text: `Na miejscu: zieleń i łąki dookoła, staw do wędkowania, plac zabaw ([strefa dla dzieci](/karpik/dzieci)), ping-pong i ognisko ([więcej na miejscu](/karpik/na-miejscu)). W okolicy: ${attractions.slice(0, 4).map((a) => `**${a.name}** (${a.where})`).join(', ')}. Więcej w zakładce [Okolica](/karpik/okolica).`,
  }) },
  { id: 'equipment', re: /wifi|wi-fi|internet|klimatyzac|ogrzewan|kuchni|zmywark|pralk|lodowk|telewiz|tv\b|recznik|posciel/, answer: () => ({
    text: 'Wszystkie domki mają klimatyzację, ogrzewanie, telewizor, lodówkę, mikrofalówkę, czajnik, naczynia i pościel. Stodoła ma też zmywarkę i pralkę. Dokładne wyposażenie znajdziesz na stronie [każdego domku](/karpik/domki/).',
  }) },
  { id: 'event', re: /wesel|impreza|panieck|kawalersk|integrac|firmow|konferenc/, answer: () => ({
    text: `Większe spotkania ustalamy indywidualnie. Zadzwoń ${contact()} albo ${sms()} i podaj, ile osób i jaki termin.`,
  }) },
];

// Nazwy domków w pytaniach: odmiana po początku słowa.
const CABIN_RE = [['stodola', /\bstodol\w*/], ['rodzinny', /\brodzinn\w*|\bdrewnian\w*\s+duz\w*|\bduz\w*\s+drewnian\w*|\bnajwieksz\w*\s+domek/], ['letniskowy', /\bletniskow\w*|\bgrafit\w*/], ['drewniany', /\bdrewnian\w*|\bnajmniejsz\w*|\bnajtansz\w*/]];
const AVAIL_RE = /wolne|wolny|wolna|wolnych|dostepn|termin|zajet|czy jest|macie cos|miejsc|rezerw|wynajac|wynajem|przyjechac|przyjazd|sprawdz/;
const PRICE_RE = /\b(cen\w*|cennik\w*|ile kosztuj\w*|ile to kosztuje|kosztuje|koszt\w*|za noc|za dobe|ile za|drogo|tanio|tani\w*|promocj\w*|znizk\w*|rabat\w*)\b/;

export function answerRules(raw, history = []) {
  const today = todayWarsaw();
  const t = normalize(raw);
  let stay = parseStay(raw, today);

  // Odpowiedź w stylu „na 4 noce” po pytaniu o długość pobytu.
  const last = [...history].reverse().find((m) => m.role === 'assistant')?.content || '';
  if (!stay.checkIn && stay.nights) {
    const earlier = [...history].reverse().filter((m) => m.role === 'user').map((m) => parseStay(m.content, today)).find((s) => s.checkIn);
    if (earlier && /na ile nocy/i.test(last)) {
      stay = { ...stay, checkIn: earlier.checkIn, guests: stay.guests || earlier.guests };
      const d = new Date(stay.checkIn + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + stay.nights);
      stay.checkOut = d.toISOString().slice(0, 10);
    }
  }

  const named = CABIN_RE.find(([, re]) => re.test(t));
  const hasDates = Boolean(stay.checkIn || stay.month !== undefined);
  const wantsAvail = AVAIL_RE.test(t);

  if (named && stay.checkIn && stay.checkOut) {
    const res = checkStay({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: stay.guests || 2 });
    const hit = res.free?.find((f) => f.slug === named[0]);
    const cab = allCabins().find((c) => c.slug === named[0]);
    if (hit) {
      return { text: `**${cab.name}**: termin ${formatRange(stay.checkIn, stay.checkOut)} jest wolny. Pobyt kosztuje ${formatPrice(hit.total)}.`, cards: res.cards.filter((c) => c.slug === named[0]) };
    }
    if (res.free?.length) {
      return { text: `**${cab.name}**: ten termin jest niedostępny. Wolne są: ${res.free.map((f) => `**${f.name}** (${formatPrice(f.total)})`).join(', ')}.`, cards: res.cards };
    }
    return availabilityAnswer(stay, today);
  }
  if (named && !hasDates) {
    const cab = allCabins().find((c) => c.slug === named[0]);
    const soon = nextFree({ slug: cab.slug })[0];
    return {
      text: `**${cab.name}**: ${cab.lead} ${cabinLine(cab).replace(/^\*\*[^*]+\*\*: /, 'Do ').replace(/^Do do/, 'Do')}.${soon ? ` Najbliższy wolny termin: ${soon.label}.` : ''} [Zobacz domek](/karpik/domki/${cab.slug}).`,
      cards: soon?.card ? [soon.card] : [],
    };
  }

  if (hasDates && (wantsAvail || PRICE_RE.test(t) || stay.guests || !INTENTS.some((i) => i.re.test(t)))) {
    return availabilityAnswer(stay, today);
  }

  if (PRICE_RE.test(t)) {
    const guests = stay.guests;
    const list = guests ? fitting(guests) : allCabins();
    if (!list.length) return { text: 'Największy dom mieści 9 osób. Dla większej grupy możesz wynająć kilka domków, zadzwoń, a doradzimy.' };
    return {
      text: `${guests ? `Dla ${guests} os. pasują:` : 'Ceny za dobę za cały domek:'}\n${list.map(cabinLine).join('\n')}\n\nBalia przy Stodole to dodatkowe 200 zł za dobę. Podaj daty, a policzę dokładną kwotę.`,
      chips: ['Co jest wolne w lipcu?', 'Jaki jest minimalny pobyt?'],
    };
  }

  for (const intent of INTENTS) {
    if (intent.re.test(t)) return intent.answer();
  }

  if (wantsAvail) return availabilityAnswer(stay, today);

  if (stay.guests) {
    const list = fitting(stay.guests);
    if (!list.length) return { text: 'Największy dom mieści 9 osób. Dla większej grupy możesz wynająć kilka domków, zadzwoń, a doradzimy.' };
    return { text: `Dla ${stay.guests} os. pasują:\n${list.map(cabinLine).join('\n')}\n\nPodaj daty, a sprawdzę dostępność.` };
  }

  if (/domk|domek|dom\b|oferta|ile osob|zmiesci|miesci/.test(t)) {
    return { text: `Mamy cztery domki:\n${allCabins().map(cabinLine).join('\n')}\n\nZobacz [wszystkie domki](/karpik/domki/).` };
  }

  return {
    text: `Nie jestem pewien, czy dobrze rozumiem. Mogę sprawdzić wolne terminy, podać ceny albo opowiedzieć o domkach, balii, terenie i okolicy. Możesz też zadzwonić: ${contact()}.`,
    chips: ['Co jest wolne w lipcu?', 'Jakie macie domki?', 'Czy jest balia?'],
  };
}
