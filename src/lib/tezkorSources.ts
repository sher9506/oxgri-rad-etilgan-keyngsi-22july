// Tezkor rejim: Lexion'siz, savoldagi so'z o'zaklari bo'yicha asosiy kodekslardan 1-4 tasi tanlanadi.
// Kalit so'zlar Lexion katalogidagi kodekslar ro'yxatidan (K-qatorlar) olingan va so'z o'zagiga qisqartirilgan.

interface Kodeks { name: string; url: string; keys: string[] }

const KODEKSLAR: Kodeks[] = [
  { name: 'Jinoyat kodeksi', url: 'http://lex.uz/docs/111453', keys: ['jinoyat', 'jazo', 'qasd', 'firibgar', "o'g'ir", "o'zlashtir", 'talon', 'rastrata', 'pora', 'qotil', "o'ldir", 'tan jarohat', 'urib', 'zo\'rlik', 'bezori', 'giyohvand', 'mast', 'tovlamachi', 'ozodlikdan'] },
  { name: 'Jinoyat-protsessual kodeksi', url: 'http://lex.uz/docs/111460', keys: ['tergov', 'surishtiruv', 'hibs', 'ayblanuvchi', 'gumonlanuvchi', 'jinoyat ishi', 'prokuror', 'qamoqqa'] },
  { name: 'Mehnat kodeksi', url: 'http://lex.uz/docs/6257288', keys: ['mehnat', 'ishdan', "bo'shat", 'ish haqi', 'maosh', 'ish beruvchi', 'xodim', 'ishchi', "ta'til", 'intizomiy', 'shtat', 'ish vaqti', 'homilador'] },
  { name: 'Fuqarolik kodeksi (birinchi qism)', url: 'http://lex.uz/docs/111189', keys: ['mulk', 'bitim', "da'vo muddat", 'yuridik shaxs', 'vakil', 'ishonchnoma', 'majburiyat', 'shartnoma', 'zarar', 'qarz'] },
  { name: 'Fuqarolik kodeksi (ikkinchi qism)', url: 'http://lex.uz/docs/180552', keys: ['shartnoma', 'oldi-sotdi', 'sotib ol', 'ijara', 'qarz', 'kafil', 'zarar', 'meros', 'vasiyat', 'penya', 'yetkazib ber', "to'lov", 'tilxat', 'kredit'] },
  { name: 'Oila kodeksi', url: 'http://lex.uz/docs/104720', keys: ['nikoh', 'ajrash', 'ajralish', 'aliment', 'er-xotin', 'eri ', 'xotini', 'farzand', 'bola', 'ota-ona', 'otalik', 'onalik', 'vasiylik'] },
  { name: "Ma'muriy javobgarlik to'g'risidagi kodeks", url: 'http://lex.uz/docs/97664', keys: ["ma'muriy huquqbuzar", 'jarima', 'protokol', "yo'l harakati", 'haydovchi', 'piyoda', 'avtomobil'] },
  { name: 'Fuqarolik protsessual kodeksi', url: 'http://lex.uz/docs/3517337', keys: ["da'vo ariza", 'sudga murojaat', 'apellyatsiya', 'kassatsiya', 'ijro', 'isbot', 'fuqarolik ishi'] },
  { name: 'Iqtisodiy protsessual kodeks', url: 'http://lex.uz/docs/3523891', keys: ['iqtisodiy sud', 'tadbirkor', "xo'jalik", 'firma', 'kompaniya', 'mchj'] },
  { name: "Ma'muriy sud ishlarini yuritish to'g'risidagi kodeks", url: 'http://lex.uz/docs/3527353', keys: ["ma'muriy sud", 'davlat organi', 'hokimiyat', 'hokim', 'shikoyat'] },
  { name: 'Uy-joy kodeksi', url: 'http://lex.uz/docs/106136', keys: ['uy-joy', 'kvartira', 'turar joy', 'ko\'chir', 'kommunal', 'xonadon'] },
  { name: 'Yer kodeksi', url: 'http://lex.uz/docs/152653', keys: ['yer uchastka', 'yerdan foydalan', 'yer ijara', 'tomorqa', 'dehqon', 'fermer'] },
  { name: 'Soliq kodeksi', url: 'http://lex.uz/docs/4674902', keys: ['soliq', 'qqs', 'daromad solig'] },
  { name: 'Jinoyat-ijroiya kodeksi', url: 'http://lex.uz/docs/163629', keys: ['mahkum', 'jazoni ijro', 'jazoni o\'ta', 'koloniya'] },
  { name: 'Bojxona kodeksi', url: 'http://lex.uz/docs/2876354', keys: ['bojxona', 'import', 'eksport', 'kontrabanda'] },
  { name: 'Shaharsozlik kodeksi', url: 'http://lex.uz/docs/5307951', keys: ['qurilish', 'shaharsozlik', 'buzish', 'ruxsatnoma'] },
  { name: 'Saylov kodeksi', url: 'http://lex.uz/docs/4386848', keys: ['saylov', 'ovoz berish', 'nomzod'] },
  { name: 'Byudjet kodeksi', url: 'http://lex.uz/docs/2304138', keys: ['byudjet', 'davlat moliya'] },
  { name: 'Suv kodeksi', url: 'http://lex.uz/docs/7655343', keys: ['suv resurs', "sug'orish", 'suvdan foydalan'] },
  { name: 'Havo kodeksi', url: 'http://lex.uz/docs/55594', keys: ['aviatsiya', 'aviakompaniya', 'parvoz', 'samolyot'] },
];

// Hech narsa topilmasa: eng ko'p so'raladigan uchta kodeks
const DEFAULT_URLS = ['http://lex.uz/docs/111189', 'http://lex.uz/docs/111453', 'http://lex.uz/docs/6257288'];
export const TEZKOR_MAX_SOURCES = 4;

const normalize = (s: string) => ` ${s.toLowerCase().replace(/[ʻʼ‘’`´]/g, "'")} `;

export function pickTezkorSources(text: string): { title: string; url: string }[] {
  const t = normalize(text);
  const urls = KODEKSLAR
    .map((k, i) => ({ k, i, score: k.keys.filter(key => t.includes(key)).length }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)   // teng ballda ro'yxatdagi tartib (asosiy kodekslar oldin)
    .slice(0, TEZKOR_MAX_SOURCES)
    .map(x => x.k.url);
  const chosen = urls.length > 0 ? urls : DEFAULT_URLS;
  return chosen.map(url => ({ title: KODEKSLAR.find(k => k.url === url)!.name, url }));
}
