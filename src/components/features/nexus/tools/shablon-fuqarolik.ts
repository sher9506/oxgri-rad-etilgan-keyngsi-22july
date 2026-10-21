// Fuqarolik ishlari bo'yicha da'vo arizalari: aliment va qarz.
// Moddalar lex.uz da tekshirilgan (2026-10): FPK 3517337, Oila kodeksi 104720, FK 111189 / 180552, O'RQ-600 -4680944.
import type { Field, Shablon } from './shablonlar-data';

const f = (key: string, label: string, placeholder?: string, multiline?: boolean): Field =>
  ({ key, label, placeholder, multiline });

const UMUMIY: Field[] = [
  f('sud', 'Sud nomi', 'Toshkent shahar Yunusobod tumanlararo fuqarolik ishlari bo\'yicha sudi'),
  f('davogar', "Da'vogar F.I.Sh."),
  f('davogarTugilgan', "Da'vogarning tug'ilgan sanasi", '01.01.1990'),
  f('davogarJshshir', "Da'vogarning JShShIR", '14 xonali raqam'),
  f('davogarPasport', "Da'vogarning pasporti (seriya, raqam, kim va qachon bergan)", 'AA 1234567, 01.01.2020 y., Yunusobod tumani IIB'),
  f('davogarManzil', "Da'vogarning yashash manzili"),
  f('davogarTel', "Da'vogarning telefoni / e-pochtasi", '+998 90 123-45-67'),
  f('javobgar', 'Javobgar F.I.Sh.'),
  f('javobgarTugilgan', "Javobgarning tug'ilgan sanasi"),
  f('javobgarManzil', 'Javobgarning yashash manzili'),
  f('javobgarIshJoyi', 'Javobgarning ish joyi (tashkilot, lavozim)', "noma'lum bo'lsa: \"ma'lum emas\""),
];

const SANA = f('sana', 'Ariza sanasi', '«___» __________ 20__ yil');

const HEADER = `{{sud}}ga

Da'vogar: {{davogar}}
Tug'ilgan sanasi: {{davogarTugilgan}}
JShShIR: {{davogarJshshir}}
Pasport: {{davogarPasport}}
Yashash manzili: {{davogarManzil}}
Tel./e-pochta: {{davogarTel}}

Javobgar: {{javobgar}}
Tug'ilgan sanasi: {{javobgarTugilgan}}
Yashash manzili: {{javobgarManzil}}
Ish joyi: {{javobgarIshJoyi}}
`;

const IMZO = `
Sana: {{sana}}

Da'vogar: __________ /{{davogar}}/`;

export const FUQAROLIK_SHABLONLAR: Shablon[] = [
  {
    id: 'aliment',
    title: "Voyaga yetmagan bolalar uchun aliment undirish to'g'risida da'vo arizasi",
    short: "Oila kodeksi 96, 99, 102, 136-m. Ulush yoki qat'iy summa. Davlat bojidan ozod. Nizo bo'lmasa — sud buyrug'i tartibi (FPK 171-m. 4-band).",
    fields: [
      ...UMUMIY,
      f('davoBahosi', "Da'vo bahosi — bir yillik to'lovlar yig'indisi (so'm)", 'FPK 129-m. 4-band: oylik aliment × 12'),
      f('nikoh', "Nikoh ma'lumotlari (FHDYo organi, sana, guvohnoma seriyasi va raqami)", "Yunusobod tumani FHDYo bo'limi, 10.05.2015 y., I-TN № 1234567"),
      f('nikohHolati', 'Nikohning hozirgi holati', "nikoh hozirda bekor qilinmagan / 20__ y. __ dagi sud hal qiluv qarori bilan bekor qilingan"),
      f('bolalar', "Bolalar: F.I.Sh., tug'ilgan sanasi, tug'ilganlik haqida guvohnoma seriyasi va raqami", "1) Aliyev Sardor Anvar o'g'li, 12.03.2017 y.t., I-TN № 7654321", true),
      f('birgaYashamaslik', 'Javobgar qachondan beri oila bilan yashamaydi va ta\'minot bermaydi', '2024-yil sentyabr oyidan'),
      f('javobgarDaromad', 'Javobgarning daromadi haqida ma\'lumot', "oylik ish haqi taxminan 5 000 000 so'm / doimiy daromadi yo'q"),
      f('alimentMiqdori', "So'ralayotgan aliment miqdori (ulush yoki qat'iy summa)", "barcha turdagi daromadlarining 1/4 (1 bola) · 1/3 (2 bola) · 1/2 (3+) qismi YOKI har oyda qat'iy ... so'm"),
      f('holat', "Qo'shimcha holatlar (ixtiyoriy)", "qat'iy summa so'ralsa — OK 102-m. 2-qismidagi asos (daromadi o'zgaruvchan, natura shaklida, rasmiy daromadi yo'q)", true),
      SANA,
    ],
    body: `${HEADER}
Da'vo bahosi: {{davoBahosi}} so'm
"Davlat boji to'g'risida"gi Qonunning 8-moddasi 2-bandiga asosan davlat boji to'lashdan ozod qilingan

DA'VO ARIZASI
(voyaga yetmagan bolalar uchun aliment undirish to'g'risida)

Men, {{davogar}}, javobgar {{javobgar}} bilan {{nikoh}} nikohdan o'tganmiz. Hozirgi vaqtda {{nikohHolati}}.

Nikohimizdan quyidagi farzandlar tug'ilgan:
{{bolalar}}

Bolalar men bilan birga yashaydi va to'liq mening qaramog'imda. Javobgar {{birgaYashamaslik}} oila bilan birga yashamaydi, bolalarni moddiy ta'minlashda ixtiyoriy ravishda ishtirok etmaydi, aliment to'lash to'g'risida o'zaro kelishuv tuzilmagan.

Javobgarning daromadi: {{javobgarDaromad}}.

{{holat}}

O'zbekiston Respublikasi Oila kodeksining 96-moddasiga ko'ra ota-ona voyaga yetmagan bolalariga ta'minot berishi shart, bu majburiyatni ixtiyoriy bajarmagan ota (ona)dan sudning hal qiluv qarori yoki sud buyrug'i asosida aliment undiriladi. Oila kodeksining 99-moddasiga muvofiq, kelishuv bo'lmaganda aliment ota-onaning har oydagi ish haqi va (yoki) boshqa daromadining bir bola uchun — to'rtdan bir qismi, ikki bola uchun — uchdan bir qismi, uch va undan ortiq bola uchun — yarmisi miqdorida undiriladi, bunda har bir bola uchun aliment miqdori mehnatga haq to'lash eng kam miqdorining 26,5 foizidan kam bo'lmasligi kerak. Oila kodeksining 102-moddasiga ko'ra aliment daromadga nisbatan ulushlarda yoki har oyda pul bilan to'lanadigan qat'iy summada belgilanishi mumkin. Oila kodeksining 104-moddasiga ko'ra aliment barcha turdagi daromadlardan ushlab qolinadi, 136-moddasiga ko'ra esa aliment sudga murojaat etilgan paytdan boshlab undiriladi.

Fuqarolik protsessual kodeksining 34-moddasiga muvofiq aliment undirish to'g'risidagi da'vo da'vogarning yashash joyidagi sudga taqdim etilmoqda. Fuqarolik protsessual kodeksining 266-moddasiga ko'ra aliment undirish to'g'risidagi hal qiluv qarori darhol ijro etilishi lozim.

Yuqoridagilarga asosan, Oila kodeksining 96, 99, 102, 104, 136-moddalari, Fuqarolik protsessual kodeksining 34, 129, 189–191-moddalariga amal qilib,

SO'RAYMAN:
1. Javobgar {{javobgar}}dan voyaga yetmagan farzandlarimiz ta'minoti uchun mening foydamga {{alimentMiqdori}} miqdorida, biroq har bir bola uchun mehnatga haq to'lash eng kam miqdorining 26,5 foizidan kam bo'lmagan miqdorda, da'vo arizasi sudga berilgan kundan boshlab bolalar voyaga yetgunga qadar har oyda aliment undirilsin.
2. Hal qiluv qarori Fuqarolik protsessual kodeksining 266-moddasiga asosan darhol ijroga qaratilsin.
3. Davlat boji javobgardan davlat daromadiga undirilsin.

Ilova:
1. Da'vo arizasining javobgar uchun nusxasi.
2. Nikoh to'g'risidagi guvohnoma (nikohni bekor qilish haqidagi guvohnoma yoki sud qarori) nusxasi.
3. Bolalarning tug'ilganlik haqidagi guvohnomalari nusxalari.
4. Bolalarning da'vogar bilan birga yashashi to'g'risida mahalla fuqarolar yig'ini ma'lumotnomasi.
5. Javobgarning ish joyi va daromadi to'g'risidagi ma'lumotnoma (mavjud bo'lsa).
6. Pochta xarajatlari to'langanligi to'g'risidagi kvitansiya.
7. Da'vogar pasportining nusxasi.
${IMZO}`,
  },
  {
    id: 'qarz',
    title: "Qarz shartnomasi bo'yicha qarz, foizlar va kechiktirish uchun foizlarni undirish to'g'risida da'vo arizasi",
    short: "FK 732–736, 327-m. Tilxat yoki qarz shartnomasi bo'yicha. Davlat boji — da'vo bahosining 4%. Qarzdor qarzni yozma tan olgan bo'lsa — sud buyrug'i (FPK 171-m. 2-band).",
    fields: [
      ...UMUMIY,
      f('hujjat', "Qarzni tasdiqlovchi hujjat (tilxat / qarz shartnomasi, sanasi, raqami, notarial tasdiqlanganmi)", "20__ y. __ dagi tilxat"),
      f('qarzSana', 'Qarz pul berilgan sana'),
      f('summa', "Berilgan qarz summasi (so'm)"),
      f('muddat', 'Qarzni qaytarish muddati', "20__ y. __ gacha / muddat belgilanmagan — talabnoma yuborilgan sana"),
      f('foizShart', "Shartnomadagi foiz sharti", "yillik 20 foiz / foizsiz qarz"),
      f('tolangan', "Javobgar qaytargan summa (so'm)", '0'),
      f('asosiyQarz', "Qaytarilmagan asosiy qarz (so'm)"),
      f('foizlar', "Shartnoma bo'yicha foizlar summasi, FK 734-m. (so'm)", "foizsiz qarzda: 0"),
      f('kechiktirishFoizi', "Kechiktirish uchun foizlar, FK 327, 736-m. (so'm)"),
      f('hisobDavr', "Kechiktirish foizlari hisoblangan davr va stavka", "01.02.2026 dan 20.10.2026 gacha, bank foizining hisob stavkasi yillik 14%"),
      f('talabnoma', "Qarzni qaytarish to'g'risidagi talabnoma (ixtiyoriy)", "20__ y. __ da yozma talabnoma yuborilgan, javobsiz qoldirilgan"),
      f('davoBahosi', "Da'vo bahosi — 1-3-bandlar yig'indisi (so'm)"),
      f('boj', "To'langan davlat boji (so'm)", "da'vo bahosining 4 foizi, kamida 1 BHM"),
      f('holat', "Qo'shimcha holatlar (ixtiyoriy)", '', true),
      SANA,
    ],
    body: `${HEADER}
Da'vo bahosi: {{davoBahosi}} so'm

DA'VO ARIZASI
(qarz shartnomasi bo'yicha qarz, foizlar va kechiktirish uchun foizlarni undirish to'g'risida)

{{qarzSana}} men, {{davogar}}, javobgar {{javobgar}}ga {{summa}} so'm miqdorida pul mablag'ini qarzga berdim. Qarz shartnomasi {{hujjat}} bilan tasdiqlanadi. Shartnoma shartlariga ko'ra javobgar qarzni {{muddat}} qaytarishi lozim edi. Foiz sharti: {{foizShart}}.

Javobgar shu kungacha qarzning faqat {{tolangan}} so'm qismini qaytargan, qaytarilmagan asosiy qarz {{asosiyQarz}} so'mni tashkil etadi. {{talabnoma}}.

{{holat}}

O'zbekiston Respublikasi Fuqarolik kodeksining 732-moddasiga ko'ra qarz shartnomasi bo'yicha qarz oluvchi qarz beruvchiga olingan pul summasini qaytarish majburiyatini oladi; 733-moddasiga ko'ra qarz oluvchining tilxati qarz shartnomasining yozma shaklda tuzilganligini tasdiqlaydi. FKning 735-moddasiga muvofiq qarz oluvchi qarz summasini shartnomada nazarda tutilgan muddatda va tartibda qaytarishi shart, muddat belgilanmagan bo'lsa — qarz beruvchi talab qo'ygan kundan boshlab o'ttiz kun ichida. FKning 734-moddasiga ko'ra qarz beruvchi shartnomada belgilangan miqdorda va tartibda foizlar olish huquqiga ega.

FKning 736-moddasiga ko'ra qarz summasi vaqtida qaytarilmaganda, 734-moddada nazarda tutilgan foizlar to'langan-to'lanmaganidan qat'i nazar, qarz qaytarilishi kerak bo'lgan kundan boshlab to qaytarilgan kungacha ushbu summaga FKning 327-moddasi birinchi va ikkinchi qismlarida nazarda tutilgan miqdorda foizlar to'lanishi kerak. FKning 327-moddasiga ko'ra foizlar miqdori kreditor yashaydigan joyda mavjud bo'lgan bank foizining hisob stavkasi bilan belgilanadi. Kechiktirish uchun foizlar {{hisobDavr}} uchun hisoblanib, {{kechiktirishFoizi}} so'mni tashkil etadi (hisob-kitob ilova qilinadi).

FKning 236, 237-moddalariga ko'ra majburiyatlar lozim darajada bajarilishi kerak, majburiyatni bajarishdan bir tomonlama bosh tortishga yo'l qo'yilmaydi.

Yuqoridagilarga asosan, Fuqarolik kodeksining 236, 237, 327, 732–736-moddalari, Fuqarolik protsessual kodeksining 129, 189–191-moddalariga amal qilib,

SO'RAYMAN:
1. Javobgar {{javobgar}}dan mening foydamga qaytarilmagan asosiy qarz {{asosiyQarz}} so'm undirilsin.
2. Javobgardan qarz shartnomasi bo'yicha foizlar {{foizlar}} so'm undirilsin.
3. Javobgardan qarzni qaytarishni kechiktirganlik uchun foizlar {{kechiktirishFoizi}} so'm undirilsin.
4. Javobgardan men to'lagan davlat boji {{boj}} so'm va pochta xarajatlari undirilsin.

Ilova:
1. Da'vo arizasining javobgar uchun nusxasi.
2. Tilxat (qarz shartnomasi) nusxasi.
3. Qarzning qisman qaytarilganligini tasdiqlovchi hujjatlar (mavjud bo'lsa).
4. Talabnoma va uning yuborilganligini tasdiqlovchi hujjat (mavjud bo'lsa).
5. Undiriladigan summalar (asosiy qarz, foizlar, kechiktirish foizlari) hisob-kitobi.
6. Davlat boji va pochta xarajatlari to'langanligi to'g'risidagi kvitansiyalar.
7. Da'vogar pasportining nusxasi.
${IMZO}`,
  },
];
