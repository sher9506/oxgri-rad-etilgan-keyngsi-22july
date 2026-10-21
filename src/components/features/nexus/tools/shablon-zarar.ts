// Zararni undirish va kredit qarzdorligi boʻyicha daʼvo arizalari.
// Manba: Adliya vazirligi "Adolat" markazi Legal Tech namunalari — yurxizmat.uz/oz/document/2211, 2223, 2177, 2226, 8, 2210.
// Moddalar lex.uz da 2026-10 holatiga tekshirilgan: FK 1-qism — https://lex.uz/uz/acts/111189 (236),
// FK 2-qism — https://lex.uz/uz/acts/180552 (744, 985, 999, 1006, 1021, 1022), FPK — https://lex.uz/uz/acts/3517337 (188–191),
// Konstitutsiya — https://lex.uz/uz/acts/6445145 (26, 47), Mehnat kodeksi — https://lex.uz/uz/acts/6257288 (321, 322, 562),
// MJtK — https://lex.uz/uz/acts/97664 (41, 245), Uy-joy kodeksi — https://lex.uz/uz/acts/106134 (24).
import type { Field, Shablon } from './shablonlar-data';

const f = (key: string, label: string, placeholder?: string, multiline?: boolean): Field =>
  ({ key, label, placeholder, multiline });

const SUD = f('sud', 'Sud nomi', 'Fuqarolik ishlari boʻyicha Yunusobod tumanlararo sudi');
const DAVOGAR: Field[] = [
  f('davogar', 'Daʼvogarning F.I.O.si'),
  f('davogarManzil', 'Daʼvogarning yashash manzili', 'viloyat, tuman (shahar), koʻcha, MFY, uy va xonadon raqami'),
  f('davogarTel', 'Daʼvogarning telefon raqami', '+998 90 123 45 67'),
  f('davogarEmail', 'Daʼvogarning elektron manzili', 'ism@mail.uz'),
];
const JAVOBGAR: Field[] = [
  f('javobgar', 'Javobgarning F.I.O.si'),
  f('javobgarManzil', 'Javobgarning yashash manzili', 'viloyat, tuman (shahar), koʻcha, MFY, uy va xonadon raqami'),
  f('javobgarTel', 'Javobgarning telefon raqami'),
  f('javobgarEmail', 'Javobgarning elektron manzili'),
];
const SANA = f('sana', 'Daʼvo arizasi berilgan sana', new Date().toLocaleDateString('uz-UZ'));
const ILOVALAR = f('ilovalar', 'Ilova qilinadigan hujjatlar roʻyxati (har birini yangi qatordan, raqamlab)',
  '1. Daʼvo arizasining javobgar uchun nusxasi.\n2. Pasport nusxasi.\n3. Davlat boji toʻlanganligi toʻgʻrisidagi kvitansiya.', true);

const TARAFLAR = `{{sud}}ga

Daʼvogar: {{davogar}}
Manzil: {{davogarManzil}}
Telefon: {{davogarTel}}
Elektron manzil: {{davogarEmail}}

Javobgar: {{javobgar}}
Manzil: {{javobgarManzil}}
Telefon: {{javobgarTel}}
Elektron manzil: {{javobgarEmail}}`;

const IMZO = `
Daʼvogar {{davogar}} ___________ (imzo)
{{sana}} yil.`;

const FK_1022 = 'Fuqarolik kodeksining 1022-moddasiga koʻra maʼnaviy zarar pul bilan qoplanadi. Maʼnaviy zararni qoplash miqdori jabrlanuvchiga yetkazilgan jismoniy va maʼnaviy azoblarning xususiyatiga, shuningdek ayb tovon toʻlashga asos boʻlgan hollarda zarar yetkazuvchining aybi darajasiga qarab sud tomonidan aniqlanadi. Zararni qoplash miqdorini aniqlashda oqilonalik va adolatlilik talablari eʼtiborga olinishi lozim. Jismoniy va maʼnaviy azoblarning xususiyati maʼnaviy zarar yetkazilgan haqiqiy holatlar va jabrlanuvchining shaxsiy xususiyatlari hisobga olingan holda sud tomonidan baholanadi. Maʼnaviy zarar toʻlanishi lozim boʻlgan mulkiy zarardan qatʼi nazar qoplanadi.';

export const ZARAR_SHABLONLAR: Shablon[] = [
  {
    id: 'manaviy-zarar',
    title: 'Maʼnaviy zararni undirish toʻgʻrisida daʼvo arizasi',
    short: 'FK 1021, 1022-moddalar. Haqorat (MJtK 41-modda) uchun maʼnaviy zarar.',
    fields: [SUD, ...DAVOGAR, ...JAVOBGAR,
      f('voqeaSana', 'Voqea sodir boʻlgan sana', '15.08.2026'),
      f('voqeaVaqt', 'Voqea sodir boʻlgan vaqt (soat)', '18:00'),
      f('mamuriySud', 'Maʼmuriy huquqbuzarlik toʻgʻrisidagi ishni koʻrib chiqqan sud nomi', 'Jinoyat ishlari boʻyicha Chilonzor tuman sudi'),
      f('qarorSana', 'Sud qarori qabul qilingan sana', '10.09.2026'),
      f('oqibat', 'Huquqbuzarlik oqibatlari (sogʻliq, ruhiy holat)', 'bu hodisadan soʻng sogʻligʻim yomonlashib, kasalxonada davolandim', true),
      f('manaviyZarar', 'Undirilishi soʻralayotgan maʼnaviy zarar summasi (soʻm)'),
      SANA],
    body: `${TARAFLAR}

DAʼVO ARIZASI
(Maʼnaviy zararni undirish toʻgʻrisida)

Oʻzbekiston Respublikasi Fuqarolik kodeksining 1021-moddasiga koʻra maʼnaviy zarar uni yetkazuvchining aybi boʻlgan taqdirda zarar yetkazuvchi tomonidan qoplanadi. Maʼnaviy zarar uni yetkazuvchining aybidan qatʼi nazar quyidagi hollarda qoplanadi: zarar fuqaroning hayoti va sogʻligʻiga oshiqcha xavf manbai tomonidan yetkazilgan boʻlsa; zarar fuqaroga uni qonunga xilof tarzda hukm qilish, qonunga xilof tarzda jinoiy javobgarlikka tortish, ehtiyot chorasi sifatida qamoqqa olishni yoki munosib xulq-atvorda boʻlish haqida tilxat olishni qonunga xilof tarzda qoʻllanish, qonunga xilof tarzda maʼmuriy jazo qoʻllanish va qonunga xilof tarzda ushlab turish, shuningdek har qanday qiynoqqa solish va boshqa shafqatsiz, gʻayriinsoniy yoki qadr-qimmatni kamsituvchi muomala hamda jazo turlarini qoʻllash natijasida yetkazilgan boʻlsa; zarar or-nomus, qadr-qimmat va ishchanlik obroʻ-eʼtiborini haqoratlovchi maʼlumotlarni tarqatish tufayli yetkazilgan boʻlsa; qonunda nazarda tutilgan boshqa hollarda.

${FK_1022}

{{voqeaSana}} kuni soat {{voqeaVaqt}} chamasida javobgar {{javobgar}} meni haqorat qildi. {{mamuriySud}}ning {{qarorSana}}dagi qaroriga koʻra javobgar Oʻzbekiston Respublikasi Maʼmuriy javobgarlik toʻgʻrisidagi kodeksining 41-moddasida nazarda tutilgan huquqbuzarlikni sodir qilganlikda aybli deb topilib, maʼmuriy javobgarlikka tortildi. Men javobgar {{javobgar}}ning bu maʼmuriy huquqbuzarligi oqibatida katta maʼnaviy zarar koʻrdim: {{oqibat}}. Natijada javobgar {{javobgar}}ning aybi bilan sodir boʻlgan bu hodisadan soʻng men juda katta ruhiy, maʼnaviy qiyinchiliklarni boshdan oʻtkazdim.

Shu sababli yuqorida bayon etilganlarga hamda Oʻzbekiston Respublikasi Fuqarolik kodeksining 1021, 1022-moddalariga, Fuqarolik protsessual kodeksining 188, 189 va 191-moddalariga asosan suddan

SOʻRAYMAN:
Javobgar {{javobgar}}dan mening foydamga {{manaviyZarar}} soʻm maʼnaviy zararni undirib berishingizni.

Ilova:
1. Pasport nusxasi.
2. Sud qarori nusxasi.
3. Davlat boji toʻlanganligi toʻgʻrisidagi kvitansiya.
4. Daʼvo arizasining javobgar uchun nusxasi.
${IMZO}`,
  },
  {
    id: 'mol-mulk-zarari',
    title: 'Mol-mulkka yetkazilgan zararni undirish toʻgʻrisida daʼvo arizasi',
    short: 'FK 985-modda, Uy-joy kodeksi 24-modda. Qoʻshnining qurilishi tufayli uyga zarar.',
    fields: [SUD, ...DAVOGAR, ...JAVOBGAR,
      f('uyManzil', 'Daʼvogarning uy-joyi joylashgan manzil'),
      f('javobgarUyManzil', 'Javobgarning uy-joyi joylashgan manzil'),
      f('holat', 'Zarar qanday yetkazilgani (faktlar)',
        'Javobgar qayta qurilish ishlarini amalga oshirganidan keyin uyim xonalari shoʻrlab, suvoqlari toʻkildi. Javobgar qurilishdan oldin suv oqava, qor va yomgʻir suvlarini chiqarib yuborish yoʻllarini oʻylamasdan hovlisini tuproq bilan toʻldirib, suv yoʻlini mening hovlimga yoʻnaltirgan. Natijada uyim avariya holatiga kelib qoldi.', true),
      f('zararSumma', 'Mutaxassis xulosasiga koʻra yetkazilgan zarar miqdori (soʻm)'),
      SANA],
    body: `${TARAFLAR}

DAʼVO ARIZASI
(Mol-mulkka yetkazilgan zararni undirish toʻgʻrisida)

Men {{uyManzil}}dagi uyda yashab kelaman. Javobgar — qoʻshnim {{javobgar}} esa {{javobgarUyManzil}}dagi uyda yashab keladi. Javobgar qurilish ishlarini bajarishda barcha texnik talablarga rioya qilishini, mening uyimga zarar yetkazmasligini bildirgan.

{{holat}}

Mutaxassislarning xulosasiga koʻra javobgarning gʻayriqonuniy xatti-harakatlari natijasida mening mol-mulkimga, yaʼni uyimga {{zararSumma}} soʻmlik zarar yetkazilgan.

Oʻzbekiston Respublikasi Konstitutsiyasining 47-moddasiga koʻra har kim uy-joyli boʻlish huquqiga ega va hech kim sudning qarorisiz va qonunga zid tarzda uy-joyidan mahrum etilishi mumkin emas. Uy-joyidan mahrum etilgan mulkdorga uy-joyning qiymati hamda u koʻrgan zararlarning oʻrni qonunda nazarda tutilgan hollarda va tartibda oldindan hamda teng qiymatda qoplanishi taʼminlanadi.

Oʻzbekiston Respublikasi Uy-joy kodeksining 24-moddasiga koʻra uy, kvartira mulkdori uy, kvartiraning asralishini, tegishli texnik va sanitariya holatini taʼminlashi, ularni oʻz hisobidan joriy va kapital taʼmirlash ishlarini amalga oshirishi shart.

Fuqarolik kodeksining 985-moddasi birinchi qismida gʻayriqonuniy harakat (harakatsizlik) tufayli fuqaroning shaxsiga yoki mol-mulkiga yetkazilgan zarar, shuningdek yuridik shaxsga yetkazilgan zarar, shu jumladan boy berilgan foyda zararni yetkazgan shaxs tomonidan toʻliq hajmda qoplanishi lozimligi nazarda tutilgan.

Yuqoridagilarga koʻra, Oʻzbekiston Respublikasi Uy-joy kodeksining 24-moddasi, Fuqarolik kodeksining 985-moddasi hamda Fuqarolik protsessual kodeksining 188, 189 va 191-moddalariga asosan

SOʻRAYMAN:
Javobgardan mening foydamga uyimga yetkazilgan {{zararSumma}} soʻm moddiy zararni undirib berishingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Davlat boji toʻlanganligi toʻgʻrisidagi kvitansiya.
3. Pasport nusxasi.
4. Uy-joyga oid hujjatlar.
5. Mutaxassis xulosasi nusxasi.
6. Daʼvo talablarini tasdiqlovchi boshqa hujjatlar.
${IMZO}`,
  },
  {
    id: 'yth-zarari',
    title: 'YTH natijasida mol-mulkka yetkazilgan zararni undirish toʻgʻrisida daʼvo arizasi',
    short: 'FK 985, 999, 1021-moddalar. Avtomashinaga zarar, jarima maydonchasi, daromad.',
    fields: [SUD, ...DAVOGAR, ...JAVOBGAR,
      f('ythSana', 'Yoʻl-transport hodisasi sodir boʻlgan sana', '15.08.2026'),
      f('javobgarAvto', 'Javobgar avtomashinasining rusumi', 'Chevrolet Cobalt'),
      f('javobgarRaqam', 'Javobgar avtomashinasining davlat raqam belgisi', '01 A 123 BC'),
      f('ythManzil', 'YTH sodir boʻlgan joy (koʻchalar kesishmasi)', 'Amir Temur va Abdulla Qodiriy'),
      f('ythSabab', 'Javobgar yoʻl harakati qoidalarining aynan qaysi talabini buzgan', 'svetoforning taqiqlovchi ishorasida chorrahaga kirib'),
      f('davogarAvto', 'Daʼvogar avtomashinasining rusumi'),
      f('davogarRaqam', 'Daʼvogar avtomashinasining davlat raqam belgisi'),
      f('avtoZarar', 'Daʼvogarning avtomashinasiga yetkazilgan zarar (soʻm)'),
      f('maydonchaKun', 'Avtomashina jarima maydonchasida turgan muddat (kun)'),
      f('maydonchaXarajat', 'Jarima maydonchasidan chiqarish uchun sarflangan mablagʻ (soʻm)'),
      f('ishsizKun', 'Avtomashina maydonchada boʻlgani sababli daromadsiz qolgan kunlar soni'),
      f('moddiyZarar', 'Jami moddiy zarar (soʻm)'),
      f('manaviyZarar', 'Maʼnaviy zarar (soʻm)'),
      f('davlatBoji', 'Toʻlangan davlat boji (soʻm)'),
      ILOVALAR, SANA],
    body: `${TARAFLAR}

Daʼvo mazmuni: Yoʻl-transport hodisasi natijasida yetkazilgan {{avtoZarar}} soʻm zararni undirish toʻgʻrisida

DAʼVO ARIZASI
(Yoʻl-transport hodisasi natijasida mol-mulkka yetkazilgan zararni undirish toʻgʻrisida)

{{ythSana}} kuni javobgar {{javobgar}} oʻz boshqaruvida boʻlgan {{javobgarAvto}} rusumli, {{javobgarRaqam}} davlat raqam belgili avtomashinasi bilan {{ythManzil}} koʻchalari kesishmasiga boshqarib kelib, amaldagi yoʻl harakati qoidalari talablarini buzib, {{ythSabab}} natijasida mening boshqaruvimda boʻlgan {{davogarAvto}} rusumli, {{davogarRaqam}} davlat raqam belgili avtomashinaga urilib, yoʻl-transport hodisasini sodir qildi. Natijada mening avtomashinamga {{avtoZarar}} soʻm zarar yetkazildi. Shundan soʻng mening avtomashinam {{maydonchaKun}} kun mobaynida jarima maydonchasida turdi. Men avtomashinamni jarima maydonchasidan chiqarish uchun {{maydonchaXarajat}} soʻm xarajat qildim. Bundan tashqari, mening asosiy daromad manbaim avtomashinam bilan bogʻliqligi va javobgarning gʻayriqonuniy harakatlari oqibatida avtomashinam jarima maydonchasiga qoʻyilganligi sababli {{ishsizKun}} kun ishsiz qolib, jami {{moddiyZarar}} soʻm miqdorida moddiy zarar koʻrdim. Shuningdek, men {{manaviyZarar}} soʻm miqdorida maʼnaviy zarar koʻrdim.

Oʻzbekiston Respublikasi Fuqarolik kodeksining 985-moddasi talablariga koʻra gʻayriqonuniy harakat tufayli fuqaroning shaxsiga yoki mol-mulkiga yetkazilgan zarar zararni yetkazgan shaxs tomonidan toʻliq hajmda qoplanishi lozim.

Fuqarolik kodeksining 999-moddasiga koʻra oshiqcha xavf manbalarining oʻzaro taʼsiri natijasida ularning egalariga yetkazilgan zarar umumiy asoslarda qoplanadi. Bunda bir tarafning aybi bilan yetkazilgan zarar shu taraf tomonidan toʻliq hajmda qoplanadi.

Fuqarolik kodeksining 1021-moddasiga koʻra maʼnaviy zarar uni yetkazuvchining aybi boʻlgan taqdirda zarar yetkazuvchi tomonidan qoplanadi.

Qayd qilingan holatlar va qonun talablaridan kelib chiqib, Oʻzbekiston Respublikasi Fuqarolik kodeksining 985, 999, 1021-moddalari, Fuqarolik protsessual kodeksining 188, 189–191-moddalari, Oʻzbekiston Respublikasi Oliy sudi Plenumining 2000-yil 28-apreldagi 7-sonli «Maʼnaviy zararni qoplash haqidagi qonunlarni qoʻllashning ayrim masalalari toʻgʻrisida»gi qaroriga asosan

SOʻRAYMAN:
Javobgar {{javobgar}}dan mening foydamga {{moddiyZarar}} soʻm moddiy zarar, {{manaviyZarar}} soʻm maʼnaviy zarar va men tomonimdan oldindan toʻlangan {{davlatBoji}} soʻm miqdoridagi davlat bojini undirib berishingizni.

Ilova:
{{ilovalar}}
${IMZO}`,
  },
  {
    id: 'soglikka-zarar',
    title: 'Fuqaroning sogʻligʻiga yetkazilgan zararni undirish toʻgʻrisida daʼvo arizasi',
    short: 'Mehnat kodeksi 321, 322-moddalar. Ishlab chiqarishdagi baxtsiz hodisa.',
    fields: [SUD, ...DAVOGAR,
      f('javobgar', 'Javobgar yuridik shaxsning toʻliq nomi', '«Namuna» masʼuliyati cheklangan jamiyati'),
      f('javobgarManzil', 'Javobgarning joylashgan manzili', 'viloyat, tuman (shahar), koʻcha, uy raqami'),
      f('javobgarHr', 'Javobgarning hisob raqami (h/r)'),
      f('javobgarStir', 'Javobgarning STIR', '9 xonali raqam'),
      f('javobgarMfo', 'Javobgar bankining kodi (MFO)', '5 xonali raqam'),
      f('javobgarOked', 'Javobgarning OKED', '5 xonali raqam'),
      f('javobgarTel', 'Javobgarning telefon raqami'),
      f('javobgarEmail', 'Javobgarning elektron manzili'),
      f('davoSumma', 'Daʼvo summasi (soʻm)'),
      f('ishgaKirgan', 'Lavozimda ishlay boshlagan sana (ishga qabul qilingan sana)', '01.03.2020'),
      f('lavozim', 'Lavozim (vazifa) nomi'),
      f('hodisaSana', 'Baxtsiz hodisa sodir boʻlgan sana', '15.08.2026'),
      f('hodisaMazmun', 'Baxtsiz hodisaning qisqacha mazmuni', 'uskunaning himoya toʻsigʻi yoʻqligi sababli qoʻlim jarohatlangan holat', true),
      f('foiz', 'Yoʻqotilgan mehnat qobiliyati (foiz)'),
      f('hodisaHujjatlar', 'Baxtsiz hodisa yuzasidan rasmiylashtirilgan hujjatlar', 'N-1 shakldagi dalolatnoma, tibbiy-mehnat ekspert komissiyasi xulosasi'),
      f('sabab', 'Zarar toʻlanmasligi sabablari'),
      f('xarajat', 'Sogʻliqni tiklashga ketgan xarajatlar (raqam va soʻz bilan)'),
      f('asosHujjatlar', 'Daʼvo talabiga asos boʻlgan hujjatlar va boshqa holatlar', undefined, true),
      f('undirishSumma', 'Undirilishi soʻralayotgan summa (raqam va soʻz bilan)'),
      ILOVALAR, SANA],
    body: `{{sud}}ga

Daʼvogar: {{davogar}}
Manzil: {{davogarManzil}}
Telefon: {{davogarTel}}
Elektron manzil: {{davogarEmail}}

Javobgar: {{javobgar}}
Manzil: {{javobgarManzil}}
H/r: {{javobgarHr}}
STIR: {{javobgarStir}}
MFO: {{javobgarMfo}}
OKED: {{javobgarOked}}
Telefon: {{javobgarTel}}
Elektron manzil: {{javobgarEmail}}

Daʼvo mazmuni: Ishlab chiqarish jarayonida sogʻliqqa yetkazilgan {{davoSumma}} soʻm zararni undirish toʻgʻrisida
Davlat bojidan ozod (Mehnat kodeksining 562-moddasi)

DAʼVO ARIZASI
(Fuqaroning sogʻligʻiga yetkazilgan zararni undirish toʻgʻrisida)

Men {{ishgaKirgan}}dan buyon {{javobgar}}da {{lavozim}} vazifasida ishlab kelaman.

{{hodisaSana}}da korxonada {{hodisaMazmun}} sodir boʻlganligi tufayli sogʻligʻimga zarar yetdi. Natijada men mehnat qobiliyatimning {{foiz}} foizini yoʻqotdim.

Mazkur holat boʻyicha {{hodisaHujjatlar}} kabi hujjatlar rasmiylashtirilgan.

Shunday boʻlsa-da, korxona tomonidan mening sogʻligʻimga yetkazilgan zararni toʻlash {{sabab}} kabi sabablarga koʻra kechiktirilib, ijro qilinmasdan kelinmoqda.

Oʻzbekiston Respublikasi Mehnat kodeksining 321-moddasiga koʻra ish beruvchi xodimning mehnatda mayib boʻlishi va (yoki) kasb kasalligi tufayli hayotiga yoki sogʻligʻiga yetkazilgan ziyonning oʻrnini qoplashi shart. Kodeksning 322-moddasiga koʻra xodimning sogʻligʻiga yetkazilgan ziyonning oʻrnini ish beruvchi tomonidan qoplash xodimga bir martalik nafaqa toʻlashni, yoʻqotilgan ish haqi uchun har oylik toʻlovlarni hamda xodimning qoʻshimcha xarajatlarini kompensatsiya qilishni oʻz ichiga oladi.

Bugungi kungacha mening sogʻligʻimni tiklashga ketgan xarajatlar {{xarajat}} soʻmni tashkil qiladi. Daʼvo talabimga {{asosHujjatlar}} kabi hujjatlarni asos sifatida keltiraman.

Mehnat kodeksining 562-moddasiga koʻra xodim yakka tartibdagi mehnat munosabatlaridan kelib chiqadigan talablar boʻyicha sud xarajatlaridan ozod qilinadi.

Yuqoridagilarni inobatga olib, Mehnat kodeksining 321, 322, 562-moddalari, Fuqarolik protsessual kodeksining 188, 189 va 191-moddalariga asosan

SOʻRAYMAN:
1. Javobgardan mening foydamga {{undirishSumma}} soʻm miqdorida yetkazilgan zararni undirishingizni.

Ilova:
{{ilovalar}}
${IMZO}`,
  },
  {
    id: 'jinoyat-zarari',
    title: 'Jinoyat natijasida yetkazilgan zararni undirish toʻgʻrisida daʼvo arizasi',
    short: 'FK 985, 1006, 1021, 1022-moddalar. Davolanish xarajati va maʼnaviy zarar.',
    fields: [SUD, ...DAVOGAR, ...JAVOBGAR,
      f('zararJami', 'Undirilishi soʻralayotgan jami zarar (raqam va soʻz bilan)'),
      f('jinoyatSana', 'Jinoyat sodir etilgan sana', '15.08.2026'),
      f('jinoyatSoat', 'Jinoyat sodir etilgan vaqt (soat)', '18:00'),
      f('jinoyatManzil', 'Jinoyat sodir etilgan joy', 'viloyat, tuman (shahar), koʻcha, MFY, uy va xonadon raqami'),
      f('kelishmovchilik', 'Jinoyatga sabab boʻlgan kelishmovchilik'),
      f('hukmSud', 'Javobgarga nisbatan hukm chiqargan sud nomi', 'Jinoyat ishlari boʻyicha Chilonzor tuman sudi'),
      f('hukmSana', 'Hukm chiqarilgan sana'),
      f('jkModda', 'Jinoyat kodeksining moddasi', '105'),
      f('jkQism', 'Moddaning qismi', '1'),
      f('davolanishSumma', 'Davolanish uchun sarflangan summa (raqam va soʻz bilan)'),
      f('manaviyZarar', 'Undirilishi soʻralayotgan maʼnaviy zarar (soʻm)'),
      ILOVALAR, SANA],
    body: `${TARAFLAR}

Daʼvo mazmuni: Jinoyat natijasida yetkazilgan {{zararJami}} soʻm zararni undirish toʻgʻrisida

DAʼVO ARIZASI
(Jinoyat natijasida yetkazilgan zararni undirish toʻgʻrisida)

Mening javobgar bilan ilgaridan oʻzaro kelishmovchiliklarimiz mavjud edi. {{jinoyatSana}} kuni soat {{jinoyatSoat}} chamasida {{jinoyatManzil}} hududida {{kelishmovchilik}} yuzasidan oʻzaro kelishmovchilik sababli javobgar tomonidan jinoyat sodir etildi. Javobgar shu kuni sodir etgan harakati uchun {{hukmSud}}ning {{hukmSana}}dagi hukmiga asosan Oʻzbekiston Respublikasi Jinoyat kodeksining {{jkModda}}-moddasi {{jkQism}}-qismi bilan jinoiy javobgarlikka tortilgan. Javobgar menga yetkazgan tan jarohati boʻyicha men oʻz hisobimdan davolandim. Tergov hamda sudga qatnab moddiy zarar koʻrdim. Bundan tashqari, javobgarning xatti-harakatlari natijasida maʼnaviy azob chekdim.

Men davolanishim uchun jami {{davolanishSumma}} soʻm sarfladim.

Oʻzbekiston Respublikasi Konstitutsiyasining 26-moddasi ikkinchi qismiga binoan hech kim qiynoqqa solinishi, zoʻravonlikka, boshqa shafqatsiz, gʻayriinsoniy yoki inson qadr-qimmatini kamsituvchi muomalaga yoxud jazoga duchor etilishi mumkin emas.

Oʻzbekiston Respublikasi Fuqarolik kodeksining 985-moddasiga koʻra gʻayriqonuniy harakat (harakatsizlik) tufayli fuqaroning shaxsiga yetkazilgan zarar zararni yetkazgan shaxs tomonidan toʻliq hajmda qoplanishi lozim. Kodeksning 1006-moddasiga koʻra fuqaroning sogʻligʻiga shikast yetkazilganda jabrlanuvchining yoʻqotilgan ish haqi (daromadlari), shuningdek davolanish, dori-darmonlar sotib olish va boshqa qoʻshimcha xarajatlari qoplanadi.

Oʻzbekiston Respublikasi Oliy sudi Plenumining 2000-yil 28-apreldagi 7-sonli «Maʼnaviy zararni qoplash haqidagi qonunlarni qoʻllashning ayrim masalalari toʻgʻrisida»gi qarorining 2-bandiga muvofiq maʼnaviy zarar deganda jabrlanuvchiga qarshi sodir etilgan huquqbuzarlik harakati (harakatsizlik) oqibatida u boshidan kechirgan (oʻtkazgan) maʼnaviy va jismoniy (kamsitish, jismoniy ogʻriq, zarar koʻrish, noqulaylik va boshqa) azoblar tushuniladi.

Gʻayriqonuniy harakatlar (harakatsizlik)ning obyekti boʻlib fuqaroga tugʻilgan vaqtidan buyon va qonunga muvofiq tegishli boʻlgan nomoddiy manfaatlari (hayoti, sogʻligʻi, shaxsning qadr-qimmati, ishchanlik obroʻ-eʼtibori, shaxsiy hayotning daxlsizligi, shaxsiy va oilaviy siri), shaxsiy nomulkiy huquqlari (oʻz nomidan foydalanish huquqi, mualliflik huquqi va intellektual faoliyat natijalariga boʻlgan boshqa nomulkiy huquqlar) va mulkiy huquqlari (uy-joy daxlsizligi, mulk huquqi va boshqalar)ning buzilishi boʻlishi mumkin.

Fuqarolik kodeksining 1021-moddasiga koʻra maʼnaviy zarar uni yetkazuvchining aybi boʻlgan taqdirda zarar yetkazuvchi tomonidan qoplanadi.

${FK_1022}

Yuqoridagilarga koʻra, Oʻzbekiston Respublikasi Fuqarolik kodeksining 985, 1006, 1021, 1022-moddalari hamda Fuqarolik protsessual kodeksining 188, 189 va 191-moddalariga asosan

SOʻRAYMAN:
Javobgar {{javobgar}}dan mening foydamga jinoyat natijasida yetkazilgan {{davolanishSumma}} soʻm moddiy zarar va {{manaviyZarar}} soʻm maʼnaviy zararni undirib berishingizni.

Ilova:
{{ilovalar}}
${IMZO}`,
  },
  {
    id: 'kredit-qarzdorlik',
    title: 'Kredit shartnomasi boʻyicha qarzdorlikni undirish toʻgʻrisida daʼvo arizasi',
    short: 'FK 236, 744-moddalar. Bank fuqarodan kredit va foizni undiradi.',
    fields: [
      f('sud', 'Sud nomi', 'Fuqarolik ishlari boʻyicha Toyloq tumanlararo sudi'),
      f('davogar', 'Daʼvogar tashkilotning nomi va tashkiliy-huquqiy shakli', '«Xalq banki» AT'),
      f('davogarManzil', 'Daʼvogarning manzili'),
      f('davogarTel', 'Daʼvogarning telefon raqami'),
      f('davogarEmail', 'Daʼvogarning elektron manzili'),
      f('vakil', 'Daʼvo arizasini imzolagan vakolatli vakilning F.I.O.si'),
      ...JAVOBGAR,
      f('shartnomaSana', 'Kredit shartnomasi tuzilgan sana', '15.03.2024'),
      f('shartnomaRaqam', 'Kredit shartnomasi raqami'),
      f('kreditSumma', 'Ajratilgan kredit summasi (soʻm)'),
      f('kreditMaqsad', 'Kredit maqsadi', 'qarz oluvchining injiniring kompaniyasi ishtirokida yakka tartibdagi namunaviy uy-joyni qurish loyihasini moliyalashtirish'),
      f('kreditMuddat', 'Kreditdan foydalanish muddati (oy va yillar bilan)', '20 yil'),
      f('garovShartnoma', 'Taʼminot shartnomasining turi, sanasi va raqami', '2024-yil 15-martdagi 123-sonli ipoteka shartnomasi'),
      f('garovManzil', 'Garovga qoʻyilgan koʻchmas mulk manzili', 'viloyat, tuman (shahar), mahalla, koʻcha, uy raqami'),
      f('garovQiymat', 'Garov mulkining qiymati (soʻm)'),
      f('shartnomaBandi', 'Toʻlov majburiyati belgilangan shartnoma bandi', '3.2'),
      f('tolanmaganDavr', 'Kredit toʻlovlari toʻlanmagan davr', '2026-yil yanvardan buyon (9 oy)'),
      f('jamiQarz', 'Jami toʻlanmagan qarzdorlik (soʻm)'),
      f('muddatiOtganFoiz', 'Muddati oʻtgan kredit foizi qarzdorligi (soʻm)'),
      f('hisoblanganFoiz', 'Hisoblangan foiz qarzdorligi (soʻm)'),
      f('asosiyQarz', 'Muddatli asosiy qarzdorlik (soʻm)'),
      SANA],
    body: `{{sud}}ga

Daʼvogar: {{davogar}}
Manzil: {{davogarManzil}}
Telefon: {{davogarTel}}
Elektron manzil: {{davogarEmail}}

Javobgar: {{javobgar}}
Manzil: {{javobgarManzil}}
Telefon: {{javobgarTel}}
Elektron manzil: {{javobgarEmail}}

DAʼVO ARIZASI
(Kredit shartnomasi boʻyicha qarzdorlikni undirish toʻgʻrisida)

{{davogar}} hamda fuqaro {{javobgar}} oʻrtasida {{shartnomaSana}}da {{shartnomaRaqam}}-sonli kredit shartnomasi tuzilgan. Shartnoma shartlariga koʻra bank {{kreditMaqsad}} uchun {{kreditSumma}} soʻm miqdorida kredit mablagʻi ajratgan.

Kreditdan foydalanish muddati — {{kreditMuddat}}.

{{garovShartnoma}}ga asosan fuqaro {{javobgar}}ga tegishli boʻlgan, {{garovManzil}}da joylashgan koʻchmas mulk {{garovQiymat}} soʻm miqdoridagi bahoda kredit shartnomasidagi majburiyatlar bajarilishining taʼminoti sifatida garovga qoʻyilgan.

Qarzdor tomonidan kredit shartnomasining shartlari buzilib, muddati oʻtgan asosiy kredit qarzdorligi hamda muddati oʻtgan kredit foizi qarzdorligi yuzaga kelgan.

Kredit shartnomasining {{shartnomaBandi}}-bandiga koʻra qarz oluvchi shartnomaga ilova qilingan toʻlovlar jadvaliga muvofiq har oylik toʻlovlarni amalga oshirish yoʻli bilan kredit asosiy qarzi va unga hisoblangan foizlarni toʻlab borish majburiyatini olgan. Lekin qarz oluvchi tomonidan kredit shartnomasining ushbu bandi talablari muntazam ravishda buzib kelingan.

Javobgar {{tolanmaganDavr}} davomida kreditning asosiy summasi va foizlarini toʻlamaganligi natijasida uning jami qarzdorligi {{jamiQarz}} soʻmni tashkil qiladi, jumladan:
– muddati oʻtgan kredit foizi qarzdorligi — {{muddatiOtganFoiz}} soʻm;
– hisoblangan foiz qarzdorligi — {{hisoblanganFoiz}} soʻm;
– muddatli asosiy qarzdorlik — {{asosiyQarz}} soʻm.

Qarz oluvchiga kredit asosiy qarzi va unga hisoblangan foizlarni toʻlash yuzasidan berilgan talabnomalar ijrosiz qoldirilib, qarz oluvchi tomonidan ushbu talablar bajarilmasdan kelinmoqda.

Oʻzbekiston Respublikasi Fuqarolik kodeksining 236-moddasiga koʻra majburiyatlar majburiyat shartlariga va qonunchilik talablariga muvofiq lozim darajada bajarilishi kerak. Kodeksning 744-moddasiga koʻra kredit shartnomasi boʻyicha qarz oluvchi olingan pul summasini qaytarish va uning uchun foizlar toʻlash majburiyatini oladi.

Yuqoridagilarga koʻra, Oʻzbekiston Respublikasi Fuqarolik kodeksining 236, 744-moddalari, Fuqarolik protsessual kodeksining 188, 189 va 191-moddalariga asosan

SOʻRAYMAN:
Javobgar {{javobgar}}dan {{davogar}} foydasiga jami {{jamiQarz}} soʻm kredit qarzdorligi va foiz qarzdorligini undirib berishingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Kredit shartnomasi nusxasi.
3. Ipoteka (garov) shartnomasi nusxasi.
4. Javobgarning pasporti nusxasi.
5. Qarzdorlik toʻgʻrisida maʼlumotnoma.
6. Ogohlantirish xatlari (talabnomalar) nusxalari.
7. Kafillik shartnomasi nusxasi (mavjud boʻlsa).
8. Davlat boji toʻlanganligi toʻgʻrisidagi kvitansiya.
9. Vakilning vakolatini tasdiqlovchi ishonchnoma.

Daʼvogar vakili {{vakil}} ___________ (imzo)
{{sana}} yil.`,
  },
];
