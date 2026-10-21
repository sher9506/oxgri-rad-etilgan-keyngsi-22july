// Fuqarolik ishlari boʻyicha daʼvo arizalari: aliment va qarz.
// Tuzilma Adliya vazirligi "Legal Tech" (yurxizmat.uz) rasmiy namunalariga mos: hujjat 2172 (qarz), 2190 / 2246 (aliment).
// Moddalar lex.uz da tekshirilgan (2026-10): FPK 3517337, Oila kodeksi 104720, FK 111189 / 180552, OʻRQ-600 -4680944.
import type { Field, Shablon } from './shablonlar-data';

const f = (key: string, label: string, placeholder?: string, multiline?: boolean): Field =>
  ({ key, label, placeholder, multiline });

const UMUMIY: Field[] = [
  f('sud', 'Sud nomi', 'Fuqarolik ishlari boʻyicha Yunusobod tumanlararo sudi'),
  f('davogar', 'Daʼvogar F.I.Sh.'),
  f('davogarTugilgan', 'Daʼvogarning tugʻilgan sanasi', '01.01.1990'),
  f('davogarJshshir', 'Daʼvogarning JShShIR', '14 xonali raqam'),
  f('davogarPasport', 'Daʼvogarning pasporti (seriya, raqam, kim va qachon bergan)', 'AA 1234567, 01.01.2020 y., Yunusobod tumani IIB'),
  f('davogarManzil', 'Daʼvogarning yashash manzili'),
  f('davogarTel', 'Daʼvogarning telefoni', '+998 90 123 45 67'),
  f('davogarEmail', 'Daʼvogarning elektron pochtasi', 'boʻlmasa: "yoʻq"'),
  f('javobgar', 'Javobgar F.I.Sh.'),
  f('javobgarTugilgan', 'Javobgarning tugʻilgan sanasi'),
  f('javobgarManzil', 'Javobgarning yashash manzili'),
  f('javobgarTel', 'Javobgarning telefoni', 'maʼlum boʻlmasa: "maʼlum emas"'),
  f('javobgarIshJoyi', 'Javobgarning ish joyi (tashkilot, lavozim)', 'maʼlum boʻlmasa: "maʼlum emas"'),
];

const SANA = f('sana', 'Ariza sanasi', '«___» __________ 20__ yil');

// FPK 189-modda: sud, taraflar (F.I.Sh., yashash joyi), telefon va elektron manzil (ixtiyoriy)
const TARAFLAR = `{{sud}}ga

Daʼvogar: {{davogarManzil}}da yashovchi
{{davogar}}
Tugʻilgan sanasi: {{davogarTugilgan}}
JShShIR: {{davogarJshshir}}
Pasport: {{davogarPasport}}
Telefon: {{davogarTel}}
Elektron pochta manzili: {{davogarEmail}}

Javobgar: {{javobgarManzil}}da yashovchi
{{javobgar}}
Tugʻilgan sanasi: {{javobgarTugilgan}}
Ish joyi: {{javobgarIshJoyi}}
Telefon: {{javobgarTel}}
`;

const IMZO = `
Daʼvogar: __________ (imzo) /{{davogar}}/

{{sana}}`;

export const FUQAROLIK_SHABLONLAR: Shablon[] = [
  {
    id: 'aliment',
    title: 'Voyaga yetmagan bolalar uchun aliment undirish toʻgʻrisida daʼvo arizasi',
    short: 'Oila kodeksi 96, 99, 102, 104, 136-m. Ulush yoki qatʼiy summa. Davlat bojidan ozod. Nizo boʻlmasa — sud buyrugʻi tartibi (FPK 171-m. 4-band, OK 136-m. 2-qism).',
    fields: [
      ...UMUMIY,
      f('davoBahosi', 'Daʼvo bahosi — bir yillik toʻlovlar yigʻindisi (soʻm)', 'FPK 129-m. 4-band: oylik aliment × 12'),
      f('nikoh', 'Nikoh maʼlumotlari (FHDYo organi, sana, guvohnoma seriyasi va raqami)', 'Yunusobod tumani FHDYo boʻlimi, 10.05.2015 y., I-TN № 1234567'),
      f('nikohHolati', 'Nikohning hozirgi holati', 'nikoh hozirda bekor qilinmagan / 20__ y. __ dagi sud hal qiluv qarori bilan bekor qilingan'),
      f('bolalar', 'Bolalar: F.I.Sh., tugʻilgan sanasi, tugʻilganlik haqida guvohnoma seriyasi va raqami', '1) Aliyev Sardor Anvar oʻgʻli, 12.03.2017 y.t., I-TN № 7654321', true),
      f('birgaYashamaslik', 'Javobgar qachondan beri oila bilan yashamaydi va taʼminot bermaydi', '2024-yil sentyabr oyidan'),
      f('javobgarDaromad', 'Javobgarning daromadi haqida maʼlumot', 'oylik ish haqi taxminan 5 000 000 soʻm / doimiy daromadi yoʻq'),
      f('alimentMiqdori', 'Soʻralayotgan aliment miqdori (ulush yoki qatʼiy summa)', 'har oydagi ish haqi va boshqa barcha daromadlarining 1/4 (1 bola) · 1/3 (2 bola) · 1/2 (3+) qismi YOKI har oyda qatʼiy ... soʻm'),
      f('holat', 'Qoʻshimcha holatlar (ixtiyoriy)', 'qatʼiy summa soʻralsa — OK 102-m. 2-qismidagi asos (daromadi oʻzgaruvchan, natura shaklida, rasmiy daromadi yoʻq)', true),
      SANA,
    ],
    body: `${TARAFLAR}
Daʼvo bahosi: {{davoBahosi}} soʻm
"Davlat boji toʻgʻrisida"gi Qonun 8-moddasi birinchi qismining 2-bandiga asosan davlat boji toʻlashdan ozod

Daʼvo mazmuni: voyaga yetmagan bolalar taʼminoti uchun aliment undirish toʻgʻrisida

DAʼVO ARIZASI
(voyaga yetmagan bolalar uchun aliment undirish toʻgʻrisida)

Men, {{davogar}}, javobgar {{javobgar}} bilan {{nikoh}} nikohdan oʻtganmiz. Hozirgi vaqtda {{nikohHolati}}.

Birgalikdagi turmushimizdan quyidagi farzandlarimiz tugʻilgan:
{{bolalar}}

Farzandlarimiz men bilan birga yashaydi va toʻliq mening qaramogʻimda. Javobgar {{birgaYashamaslik}} oila bilan birga yashamaydi, bolalarni moddiy taʼminlashda ixtiyoriy ravishda ishtirok etmaydi, aliment toʻlash toʻgʻrisida oʻzaro kelishuv tuzilmagan.

Javobgarning daromadi: {{javobgarDaromad}}.

{{holat}}

Oʻzbekiston Respublikasi Oila kodeksining 96-moddasiga koʻra, ota-ona voyaga yetmagan bolalariga taʼminot berishi shart. Voyaga yetmagan bolalariga taʼminot berish majburiyatini ixtiyoriy ravishda bajarmagan ota (ona)dan sudning hal qiluv qaroriga yoki sud buyrugʻiga asosan aliment undiriladi.

Oila kodeksining 99-moddasiga muvofiq, kelishuv boʻlmaganda aliment sud tomonidan ota-onaning har oydagi ish haqi va (yoki) boshqa daromadining bir bola uchun — toʻrtdan bir qismi, ikki bola uchun — uchdan bir qismi, uch va undan ortiq bola uchun — yarmi miqdorida undiriladi, bunda har bir bola uchun undiriladigan aliment miqdori mehnatga haq toʻlash eng kam miqdorining 26,5 foizidan kam boʻlmasligi kerak. Oila kodeksining 102-moddasiga koʻra aliment miqdori aliment toʻlovchining oylik ish haqiga va (yoki) boshqa daromadiga nisbatan ulushlar hisobida yoki pul bilan toʻlanadigan qatʼiy summada belgilanishi mumkin. Oila kodeksining 104-moddasiga koʻra aliment pul yoki natura tarzida olingan barcha turdagi daromadlardan ushlab qolinadi, 136-moddasiga koʻra esa aliment sudga murojaat etilgan paytdan boshlab undiriladi.

Fuqarolik protsessual kodeksining 34-moddasi uchinchi qismiga muvofiq aliment undirish toʻgʻrisidagi daʼvo daʼvogarning yashash joyidagi sudga taqdim etilmoqda. Fuqarolik protsessual kodeksining 266-moddasiga koʻra aliment undirish toʻgʻrisidagi hal qiluv qarori darhol ijro etilishi lozim.

Yuqoridagilarga koʻra, Oʻzbekiston Respublikasi Oila kodeksining 96, 99, 102, 104, 136-moddalari, Fuqarolik protsessual kodeksining 34, 129, 188–191, 266-moddalariga asoslanib, suddan

SOʻRAYMAN:
1. Javobgar {{javobgar}}dan mening foydamga voyaga yetmagan farzandlarimiz taʼminoti uchun {{alimentMiqdori}} miqdorida, biroq har bir bola uchun mehnatga haq toʻlash eng kam miqdorining 26,5 foizidan kam boʻlmagan miqdorda, daʼvo arizasi sudga berilgan kundan boshlab bolalar voyaga yetgunga qadar har oyda aliment undirish toʻgʻrisida hal qiluv qarori qabul qilishingizni;
2. Hal qiluv qarorini Fuqarolik protsessual kodeksining 266-moddasiga asosan darhol ijroga qaratishingizni;
3. Davlat bojini javobgardan davlat daromadiga undirishingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Nikoh toʻgʻrisidagi guvohnoma (nikohni bekor qilish haqidagi guvohnoma yoki sud qarori) nusxasi.
3. Bolalarning tugʻilganlik haqidagi guvohnomalari nusxalari.
4. Bolalarning daʼvogar bilan birga yashashi toʻgʻrisida mahalla fuqarolar yigʻini maʼlumotnomasi.
5. Javobgarning ish joyi va daromadi toʻgʻrisidagi maʼlumotnoma (mavjud boʻlsa).
6. Pochta xarajatlari toʻlanganligi toʻgʻrisidagi kvitansiya.
7. Daʼvogar pasportining nusxasi.
8. Ishonchnoma (ariza vakil orqali berilsa — FPK 189-moddasi).
${IMZO}`,
  },
  {
    id: 'qarz',
    title: 'Qarz shartnomasi boʻyicha qarzdorlik, foizlar va kechiktirish uchun foizlarni undirish toʻgʻrisida daʼvo arizasi',
    short: 'FK 236, 237, 327, 732–736-m. Tilxat yoki qarz shartnomasi boʻyicha. Davlat boji — daʼvo bahosining 4%, kamida 1 BHM. Shartnoma notarial tasdiqlangan yoki qarzdor yozma tan olgan boʻlsa — sud buyrugʻi (FPK 171-m. 1, 2-bandlar).',
    fields: [
      ...UMUMIY,
      f('hujjat', 'Qarzni tasdiqlovchi hujjat (tilxat / qarz shartnomasi, sanasi, raqami, notarial tasdiqlanganmi)', '20__ y. __ dagi tilxat'),
      f('qarzSana', 'Qarz pul berilgan sana'),
      f('summa', 'Berilgan qarz summasi (soʻm, raqam va soʻz bilan)', '10 000 000 (oʻn million)'),
      f('muddat', 'Qarzni qaytarish muddati', '20__ y. __ gacha / muddat belgilanmagan — talab qoʻyilgan kundan 30 kun ichida'),
      f('foizShart', 'Shartnomadagi foiz sharti', 'yillik 20 foiz / foizsiz qarz'),
      f('tolangan', 'Javobgar qaytargan summa (soʻm)', '0'),
      f('asosiyQarz', 'Qaytarilmagan asosiy qarz (soʻm)'),
      f('foizlar', 'Shartnoma boʻyicha foizlar summasi, FK 734-m. (soʻm)', 'foizsiz qarzda: 0'),
      f('kechiktirishFoizi', 'Kechiktirish uchun foizlar, FK 327, 736-m. (soʻm)'),
      f('hisobDavr', 'Kechiktirish foizlari hisoblangan davr va stavka', '01.02.2026 dan 20.10.2026 gacha, bank foizining hisob stavkasi yillik 14%'),
      f('talabnoma', 'Qarzni qaytarish toʻgʻrisidagi talab (ixtiyoriy)', '20__ y. __ da yozma talabnoma yuborilgan, javobsiz qoldirilgan'),
      f('davoBahosi', 'Daʼvo bahosi — 1–3-bandlar yigʻindisi (soʻm)'),
      f('boj', 'Toʻlangan davlat boji (soʻm)', 'daʼvo bahosining 4 foizi, kamida 1 BHM'),
      f('holat', 'Qoʻshimcha holatlar (ixtiyoriy)', '', true),
      SANA,
    ],
    body: `${TARAFLAR}
Daʼvo bahosi: {{davoBahosi}} soʻm

Daʼvo mazmuni: javobgardan {{davoBahosi}} soʻm miqdorida qarzdorlikni undirish toʻgʻrisida

DAʼVO ARIZASI
(qarz shartnomasi boʻyicha qarzdorlikni undirish toʻgʻrisida)

{{qarzSana}} men, {{davogar}}, javobgar {{javobgar}}ga {{summa}} soʻm miqdorida pul mablagʻini qarzga berdim. Qarz shartnomasi {{hujjat}} bilan tasdiqlanadi. Shartnoma shartlariga koʻra javobgar qarzni {{muddat}} qaytarishi lozim edi. Foiz sharti: {{foizShart}}.

Javobgar shu kungacha qarzning faqat {{tolangan}} soʻm qismini qaytargan, qaytarilmagan asosiy qarz {{asosiyQarz}} soʻmni tashkil etadi. Javobgarga qarzni qaytarishni soʻrab bir necha bor murojaat qildim, biroq u turli bahonalar bilan qarzni qaytarmasdan kelmoqda. {{talabnoma}}.

{{holat}}

Oʻzbekiston Respublikasi Fuqarolik kodeksining 732-moddasiga koʻra qarz shartnomasi boʻyicha qarz oluvchi qarz beruvchidan olgan pul summasini qaytarish majburiyatini oladi. FKning 733-moddasiga koʻra qarz oluvchining tilxati yoki qarz beruvchi tomonidan muayyan summa topshirilganligini tasdiqlaydigan boshqa hujjat mavjud boʻlsa, qarz shartnomasi yozma shaklda tuzilgan hisoblanadi. FKning 735-moddasiga muvofiq qarz oluvchi olingan qarz summasini qarz shartnomasida nazarda tutilgan muddatda va tartibda qarz beruvchiga qaytarishi shart, muddat belgilanmagan boʻlsa — qarz beruvchi talab qoʻygan kundan boshlab oʻttiz kun mobaynida. FKning 734-moddasiga koʻra, agar qonunda yoki shartnomada boshqacha tartib nazarda tutilmagan boʻlsa, qarz beruvchi qarz summasiga shartnomada belgilangan miqdorda va tartibda foizlar olish huquqiga ega.

FKning 736-moddasiga koʻra qarz summasi vaqtida qaytarilmagan hollarda, 734-moddaning birinchi qismida nazarda tutilgan foizlar toʻlangan-toʻlanmaganidan qatʼi nazar, qarz qaytarilishi kerak boʻlgan kundan boshlab to qaytarilgan kungacha ushbu summaga FKning 327-moddasida nazarda tutilgan miqdorda foizlar toʻlanishi kerak. FKning 327-moddasiga koʻra foizlar miqdori kreditor yashaydigan joyda mavjud boʻlgan bank foizining hisob stavkasi bilan belgilanadi. Kechiktirish uchun foizlar {{hisobDavr}} uchun hisoblanib, {{kechiktirishFoizi}} soʻmni tashkil etadi (hisob-kitob ilova qilinadi).

FKning 236, 237-moddalariga koʻra majburiyatlar lozim darajada bajarilishi kerak, majburiyatni bajarishdan bir tomonlama bosh tortishga yoʻl qoʻyilmaydi.

Yuqoridagilarga koʻra, Oʻzbekiston Respublikasi Fuqarolik kodeksining 236, 237, 327, 732–736-moddalari, Fuqarolik protsessual kodeksining 129, 188–191-moddalariga asoslanib, suddan

SOʻRAYMAN:
1. Javobgar {{javobgar}}dan mening foydamga qaytarilmagan asosiy qarz {{asosiyQarz}} soʻmni undirishingizni;
2. Javobgardan qarz shartnomasi boʻyicha foizlar {{foizlar}} soʻmni undirishingizni;
3. Javobgardan qarzni qaytarishni kechiktirganlik uchun foizlar {{kechiktirishFoizi}} soʻmni undirishingizni;
4. Javobgardan men toʻlagan davlat boji {{boj}} soʻm va pochta xarajatlarini undirishingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Tilxat (qarz shartnomasi) nusxasi.
3. Qarzning qisman qaytarilganligini tasdiqlovchi hujjatlar (mavjud boʻlsa).
4. Talabnoma va uning yuborilganligini tasdiqlovchi hujjat (mavjud boʻlsa).
5. Undiriladigan summalar (asosiy qarz, foizlar, kechiktirish foizlari) hisob-kitobi.
6. Davlat boji va pochta xarajatlari toʻlanganligi toʻgʻrisidagi kvitansiyalar.
7. Daʼvogar pasportining nusxasi.
8. Ishonchnoma (ariza vakil orqali berilsa — FPK 189-moddasi).
${IMZO}`,
  },
];
