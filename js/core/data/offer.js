// Cała treść oferty w jednym miejscu. Dane pochodzą z ogłoszeń właściciela na OLX (listopad 2025)
// i z opisu obiektu na nocowanie.pl. Rzeczy niepewne są wypisane w DO-UZUPELNIENIA.md.

export const site = {
  name: 'Karpik',
  fullName: 'Gospodarstwo Agroturystyczne „Karpik”',
  short: 'Domki nad Jeziorem Białym',
  demo: true, // pokazuje w stopce notę o danych do potwierdzenia; po uzupełnieniu ustaw false
  address: 'Białe 22a, 09-500 Gostynin',
  addressShort: 'Białe 22a, gmina Gostynin',
  company: 'Gospodarstwo Agroturystyczne „Karpik”',
  nip: '[NIP]',
  bankAccount: '00 0000 0000 0000 0000 0000 0000',
  phone: '123 456 789', // numer przykładowy, do podmiany na prawdziwy
  phoneHref: '+48123456789',
  email: 'rezerwacje@example.com',
  ownerEmail: 'rezerwacje@example.com',
  coords: { lat: 52.4997, lon: 19.5102 },
  mapUrl: 'https://www.openstreetmap.org/?mlat=52.4997&mlon=19.5102#map=15/52.4997/19.5102',
  directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Bia%C5%82e+22a%2C+09-500+Gostynin',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Bia%C5%82e+22a%2C+09-500+Gostynin',
  checkIn: '14:00',
  checkOut: '10:00',
  depositPercent: 50,
  holdHours: 48,
  freeCancelDays: 14,
  payments: 'gotówką, przelewem lub kartą',
  beachDistance: '650 m',
};

// „48 godzin”, „24 godziny”: poprawna odmiana dla dowolnej wartości holdHours.
const hoursWord = (n) => {
  const t = n % 10, h = n % 100;
  if (n === 1) return 'godzinę';
  return t >= 2 && t <= 4 && !(h >= 12 && h <= 14) ? 'godziny' : 'godzin';
};
site.holdLabel = `${site.holdHours} ${hoursWord(site.holdHours)}`;

// Okresy specjalne. „holiday” to cena świąteczna (jeśli domek ją ma), „inquiry” to noce
// wyceniane indywidualnie, których nie da się zarezerwować online. Noce liczone od podanej daty.
export const periods = [
  { id: 'sylwester', name: 'Sylwester', from: '12-30', to: '01-01', inquiry: true },
  { id: 'swieta', name: 'Boże Narodzenie', from: '12-23', to: '12-26', holiday: true },
  { id: 'majowka', name: 'Majówka', from: '04-30', to: '05-02', holiday: true },
  { id: 'bozecialo', name: 'Boże Ciało', movable: 'corpus-christi', holiday: true },
  { id: 'lato', name: 'Lipiec i sierpień', from: '07-01', to: '08-31', summer: true },
];

export const cabins = [
  {
    slug: 'stodola',
    name: 'Stodoła',
    kind: 'Całoroczny dom z antresolą i balią',
    guests: 9,
    guestsIncluded: 5,
    extraGuestPrice: 100,
    area: 50,
    bedrooms: 2,
    bedroomsLabel: 'sypialnia i antresola',
    baths: 1,
    beds: 'Sypialnia oraz antresola służąca jako druga sypialnia',
    price: 500,
    holidayPrice: 600,
    oneNightPrice: 600,
    minStay: 1,
    summerMinStay: 4,
    pets: false,
    photos: ['stodola-noc', 'stodola-salon', 'stodola-antresola', 'stodola-balia', 'stodola-kuchnia', 'stodola-widok', 'stodola-sypialnia', 'stodola-piec', 'stodola-lazienka', 'stodola-dzien'],
    lead: 'Nowoczesna stodoła z przeszkloną elewacją, dwoma tarasami i własną strefą balii. Pomieści nawet dziewięć osób.',
    text: [
      'Stodoła ma 50 m² i prostą, elegancką formę w odcieniach szarości. Na dole jest salon z w pełni wyposażonym aneksem kuchennym, łazienka i sypialnia, a pod dachem antresola, która służy jako druga sypialnia.',
      'Dom stoi na dużej, ogrodzonej działce z placem zabaw. Ma dwa tarasy, słoneczny i grillowy, a obok strefę balii z piecem opalanym drewnem. Jest ogrzewany i klimatyzowany, więc przyjedziesz o każdej porze roku.',
    ],
    tub: 'Balia z piecem na drewno stoi pod pergolą przy tarasie. Korzystanie z niej kosztuje 200 zł za dobę, zaznaczysz to przy rezerwacji.',
    features: ['Aneks kuchenny z salonem', 'Antresola', 'Zmywarka', 'Pralka', 'Lodówka z zamrażarką', 'Mikrofalówka', 'Klimatyzacja i ogrzewanie', 'Telewizor', 'Żelazko i suszarka', 'Dwa tarasy', 'Strefa balii', 'Miejsce na grilla'],
  },
  {
    slug: 'rodzinny',
    name: 'Domek Rodzinny',
    kind: 'Drewniany domek z piętrem dla 6–8 osób',
    guests: 8,
    guestsIncluded: 6,
    extraGuestPrice: 80,
    area: null,
    bedrooms: 2,
    bedroomsLabel: '2 pokoje na piętrze',
    baths: 1,
    beds: 'Dwa pokoje na piętrze i rozkładany narożnik w salonie',
    price: 480,
    minStay: 4,
    summerMinStay: 4,
    pets: true,
    photos: ['rodzinny-dzien', 'rodzinny-kuchnia', 'rodzinny-salon', 'rodzinny-sypialnia', 'rodzinny-lazienka'],
    lead: 'Największy z drewnianych domków. Na dole duża kuchnia z jadalnią i salon, na górze dwa pokoje do spania.',
    text: [
      'Domek Rodzinny to dobry wybór dla rodziny z dziećmi albo dwóch zaprzyjaźnionych par. Na parterze jest salon z narożnikiem, kuchnia z dużym stołem i łazienka z prysznicem, a na piętrze dwa pokoje pod drewnianym dachem.',
      'Przed domkiem jest zadaszony taras ze stołem. Plac zabaw, staw i miejsce na ognisko masz kilka kroków od drzwi.',
    ],
    tub: null,
    features: ['Salon z aneksem kuchennym', 'Duży stół jadalny', '2 pokoje na piętrze', 'Łazienka z prysznicem', 'Lodówka z zamrażarką', 'Mikrofalówka', 'Klimatyzacja i ogrzewanie', 'Telewizor', 'Zadaszony taras', 'Pies mile widziany'],
  },
  {
    slug: 'letniskowy',
    name: 'Domek Letniskowy',
    kind: 'Nowy domek dla 4–5 osób',
    guests: 5,
    guestsIncluded: 5,
    extraGuestPrice: 0,
    area: null,
    bedrooms: 1,
    bedroomsLabel: '1 sypialnia',
    baths: 1,
    beds: 'Sypialnia z łóżkiem piętrowym oraz rozkładana kanapa w salonie',
    price: 400,
    minStay: 4,
    summerMinStay: 4,
    pets: false,
    photos: ['letniskowy-dzien', 'letniskowy-salon', 'letniskowy-noc', 'letniskowy-kuchnia', 'letniskowy-sypialnia', 'letniskowy-jadalnia', 'letniskowy-lazienka', 'letniskowy-taras'],
    lead: 'Nowy, jasny domek z przeszklonym szczytem i podświetlonym tarasem. Salon z aneksem kuchennym, sypialnia i łazienka.',
    text: [
      'Domek Letniskowy jest nowy i wykończony w jasnym drewnie. Z salonu przez przeszklone drzwi wychodzisz prosto na trawnik, a wieczorem taras przed domkiem jest podświetlony.',
      'Sypialnia ma łóżko piętrowe, które dzieci lubią najbardziej, a w salonie stoi rozkładana kanapa. Kuchnia ma wszystko, czego potrzeba do przygotowania posiłków.',
    ],
    tub: null,
    features: ['Salon z aneksem kuchennym', 'Sypialnia', 'Łazienka z prysznicem', 'Lodówka', 'Klimatyzacja', 'Taras', 'Plac zabaw obok'],
  },
  {
    slug: 'drewniany',
    name: 'Domek Drewniany',
    kind: 'Kameralny domek dla 2–4 osób',
    guests: 4,
    guestsIncluded: 4,
    extraGuestPrice: 0,
    area: null,
    bedrooms: null,
    bedroomsLabel: 'salon z miejscami do spania',
    baths: 1,
    beds: 'Salon z rozkładaną kanapą i miejscami do spania',
    price: 330,
    minStay: 4,
    summerMinStay: 4,
    pets: false,
    photos: ['drewniany-dzien', 'drewniany-salon', 'drewniany-kuchnia', 'drewniany-bok'],
    lead: 'Najmniejszy i najtańszy domek. Drewniane wnętrze, salon z aneksem kuchennym i łazienka.',
    text: [
      'Domek Drewniany wybierają pary i małe rodziny, które większość dnia spędzają nad jeziorem. W środku jest w pełni wyposażony salon z aneksem kuchennym i łazienka.',
      'Domek ma klimatyzację i ogrzewanie, a przez przeszklone drzwi wychodzisz na taras i zieleń.',
    ],
    tub: null,
    features: ['Salon z aneksem kuchennym', 'Łazienka', 'Klimatyzacja', 'Ogrzewanie', 'Lodówka', 'Taras'],
  },
];

export const extras = [
  { id: 'balia', name: 'Balia na jedną dobę', note: 'Balia z piecem na drewno przy Stodole. Kolejne doby dokupisz na miejscu, 200 zł każda.', price: 200, unit: 'stay', unitLabel: 'za dobę', onlyCabins: ['stodola'] },
];

// Wspólne dla wszystkich gości. Z ogłoszeń i opisu obiektu.
export const grounds = [
  { id: 'plaza', title: 'Plaża 650 m od domków', text: 'Plaża pod Lipami nad Jeziorem Białym. Piasek, pomosty i czysta, głęboka woda.', photo: 'teren-plaza' },
  { id: 'staw', title: 'Staw do wędkowania', text: 'Na terenie gospodarstwa, z pomostem i ścieżką wokół brzegu.', photo: 'teren-staw' },
  { id: 'plac', title: 'Plac zabaw', text: 'Zjeżdżalnie, huśtawki, trampolina i piaskownica na dużym, ogrodzonym trawniku.', photo: 'teren-plac' },
  { id: 'ognisko', title: 'Ognisko i grill', text: 'Miejsce na ognisko pod girlandą świateł, grill i stół do ping-ponga pod pergolą.', photo: 'teren-ognisko' },
];

export const barInfo = {
  // Godzin otwarcia nie ma w ogłoszeniach. Do uzupełnienia przez właściciela, null = nie pokazujemy.
  hours: null,
  meals: ['Śniadania', 'Domowe obiady', 'Kolacje', 'Napoje i piwo w ogródku'],
};

export const lakeFacts = [
  { v: '650 m', l: 'do plaży pod Lipami' },
  { v: 'ok. 150 ha', l: 'powierzchnia jeziora' },
  { v: 'ponad 30 m', l: 'głębokość, jedno z najgłębszych jezior w okolicy' },
];

export const distances = [
  { to: 'Gostynin', km: 11, time: 'ok. 20 min' },
  { to: 'Płock', km: 25, time: 'ok. 35 min' },
  { to: 'Włocławek', km: 44, time: 'ok. 50 min' },
  { to: 'Łódź', km: 109, time: 'ok. 1 h 35 min' },
  { to: 'Toruń', km: 110, time: 'ok. 1 h 40 min' },
  { to: 'Warszawa', km: 134, time: 'ok. 2 h 10 min' },
];

export const attractions = [
  { name: 'Wzgórze Tumskie w Płocku', where: 'Płock, 25 km', text: 'Miejsce, od którego zaczęło się miasto. Katedra, Zamek Książąt Mazowieckich i widok na Wisłę z wysokiej skarpy.' },
  { name: 'Płockie zoo i aquapark', where: 'Płock, 25 km', text: 'Dobry plan na dzień z dziećmi, zwłaszcza gdy pogoda nie sprzyja. Latem do tego rejsy po Wiśle.' },
  { name: 'Gostynińsko-Włocławski Park Krajobrazowy', where: 'w sąsiedztwie', text: 'Sosnowe lasy, wydmy i polodowcowe jeziora. Jeden z najstarszych parków krajobrazowych w Polsce, z trasami pieszymi i rowerowymi.' },
  { name: 'Zespół pałacowy w Nowym Duninowie', where: 'Nowy Duninów, 14 km', text: 'Dziewiętnastowieczny pałac, pawilon myśliwski i mały neogotycki zameczek, tuż przy Wiśle.' },
  { name: 'Pałac w Łącku', where: 'Łąck, 11 km', text: 'Dziewiętnastowieczny pałac w parku, dobry cel krótkiego spaceru albo przejażdżki rowerem.' },
  { name: 'Pałac w Sannikach', where: 'Sanniki, 32 km', text: 'Pałac z parkiem, w którym w 1828 roku gościł Fryderyk Chopin. Przypomina o tym tablica na wieży.' },
];

export const faq = [
  { id: 'ceny', q: 'Ile kosztuje pobyt?', a: 'Ceny są za dobę za cały domek: Domek Drewniany 330 zł (do 4 osób), Domek Letniskowy 400 zł (do 5 osób), Domek Rodzinny 480 zł (do 6 osób, każda kolejna 80 zł) i Stodoła 500 zł (do 5 osób, każda kolejna 100 zł).' },
  { id: 'minimum', q: 'Jaki jest minimalny pobyt?', a: 'W domkach drewnianych minimum to 4 noce. Stodołę poza lipcem i sierpniem możesz wynająć nawet na jedną noc (wtedy 600 zł), a latem także na co najmniej 4 noce.' },
  { id: 'balia', q: 'Czy jest balia albo jacuzzi?', a: 'Tak, przy Stodole jest balia z piecem opalanym drewnem. Korzystanie z niej kosztuje 200 zł za dobę. Pozostałe domki nie mają balii.' },
  { id: 'swieta', q: 'Ile kosztuje pobyt w święta i Sylwestra?', a: 'W majówkę, Boże Ciało i Boże Narodzenie doba w Stodole kosztuje 600 zł. Sylwestra wyceniamy indywidualnie, dlatego te noce rezerwujesz telefonicznie.' },
  { id: 'doba', q: 'O której jest zameldowanie i wymeldowanie?', a: `Zameldowanie od ${site.checkIn}, wymeldowanie do ${site.checkOut}.` },
  { id: 'platnosc', q: 'Jak wygląda płatność?', a: `Po wysłaniu rezerwacji termin jest zablokowany przez ${site.holdLabel}. W tym czasie wpłacasz zaliczkę ${site.depositPercent}% przelewem, a my potwierdzamy rezerwację. Resztę płacisz na miejscu ${site.payments}.` },
  { id: 'anulowanie', q: 'Czy mogę anulować rezerwację?', a: `Tak. Do ${site.freeCancelDays} dni przed przyjazdem zwracamy zaliczkę w całości. Przy późniejszej rezygnacji zadzwoń, a postaramy się znaleźć rozwiązanie.` },
  { id: 'dzieci', q: 'Czy to dobre miejsce dla dzieci?', a: 'Bardzo. Teren jest ogrodzony, jest duży plac zabaw, trampolina, piaskownica, boisko do siatkówki i stół do ping-ponga, a w barze cymbergaj i automaty. Na miejscu jest łóżeczko i krzesełko do karmienia.' },
  { id: 'pies', q: 'Czy można przyjechać z psem?', a: 'Psa przyjmujemy w Domku Rodzinnym, po wcześniejszym uzgodnieniu. W pozostałych domkach zwierzęta nie mogą przebywać.' },
  { id: 'jedzenie', q: 'Czy na miejscu można zjeść?', a: 'Tak. Na terenie gospodarstwa jest sklep z barem, gdzie zjesz śniadanie, domowy obiad albo kolację i zrobisz podstawowe zakupy. Jest też ogródek piwny z parasolami.' },
  { id: 'wedkowanie', q: 'Czy można łowić ryby?', a: 'Tak, na terenie gospodarstwa jest staw do wędkowania. Na jeziorze obowiązują zasady i zezwolenia właściwego gospodarza wód.' },
  { id: 'jezioro', q: 'Jak daleko jest do jeziora?', a: `Do plaży pod Lipami nad Jeziorem Białym jest ${site.beachDistance}, kilka minut spacerem.` },
  { id: 'parking', q: 'Czy jest parking?', a: 'Tak, parking dla gości jest bezpłatny.' },
  { id: 'dojazd', q: 'Jak dojechać?', a: `Adres to ${site.address}. Autem z Płocka to około 35 minut, z Gostynina około 20 minut, z Warszawy około 2 godzin i 10 minut.` },
];

export const botStarters = [
  'Co jest wolne w lipcu?',
  'Ile kosztuje domek dla 4 osób?',
  'Czy jest balia?',
  'Czy mogę przyjechać z psem?',
];
