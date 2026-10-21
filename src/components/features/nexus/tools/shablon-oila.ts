// Oilaviy nizolar boʻyicha daʼvo arizalari: nikohdan ajratish, mol-mulkni boʻlish, aliment, bolalar tarbiyasi.
// Manba: Adliya vazirligi "Adolat" markazi Legal Tech namunalari — yurxizmat.uz/oz/document/2240, 2239, 2190, 2207, 1354, 2107, 2102.
// Moddalar lex.uz da 2026-10 holatiga tekshirilgan: Oila kodeksi 104720 (ORQ-1156, 01.07.2026 tahriri bilan),
// FPK 3517337, Konstitutsiya 6445145 (2023-yil tahriri).
import type { Field, Shablon } from './shablonlar-data';

const f = (key: string, label: string, placeholder?: string, multiline?: boolean): Field =>
  ({ key, label, placeholder, multiline });

const MANZIL = 'viloyat, tuman (shahar), mahalla, koʻcha nomi va uy raqami';

const TARAFLAR: Field[] = [
  f('sud', 'Sud nomi', 'Fuqarolik ishlari boʻyicha Toyloq tumanlararo sudi'),
  f('davogar', 'Daʼvogarning F.I.O.si'),
  f('davogarManzil', 'Daʼvogarning yashash manzili', MANZIL),
  f('davogarTel', 'Daʼvogarning telefon raqami', '+998 90 123 45 67'),
  f('davogarEmail', 'Daʼvogarning elektron pochta manzili', 'boʻlmasa: "yoʻq"'),
  f('javobgar', 'Javobgarning F.I.O.si'),
  f('javobgarManzil', 'Javobgarning yashash manzili', MANZIL),
  f('javobgarTel', 'Javobgarning telefon raqami', 'maʼlum boʻlmasa: "maʼlum emas"'),
  f('javobgarEmail', 'Javobgarning elektron pochta manzili', 'maʼlum boʻlmasa: "maʼlum emas"'),
];

const NIKOH: Field[] = [
  f('nikohFhdyo', 'Nikohni qayd etgan FHDYo boʻlimi', 'Toyloq tumani FHDYo boʻlimi'),
  f('nikohSana', 'Nikoh qayd etilgan sana', '10.05.2015'),
  f('nikohRaqam', 'Nikoh toʻgʻrisidagi dalolatnoma yozuvi raqami', '125'),
];

const BOLA: Field[] = [
  f('bolaTugilgan', 'Farzandning tugʻilgan sanasi', '12.03.2017'),
  f('bola', 'Farzandning F.I.O.si'),
  f('bolaGuvohnoma', 'Tugʻilganlik haqidagi guvohnomaning seriyasi va raqami', 'I-SM № 1234567'),
];

const ILOVALAR = f('ilovalar', 'Ilova qilinayotgan boshqa hujjatlar', 'masalan: mahalla fuqarolar yigʻini maʼlumotnomasi; ishonchnoma (ariza vakil orqali berilsa — FPK 189-m.)', true);
const SANA = f('sana', 'Ariza sanasi', '«___» __________ 20__ yil');

// "…da yashovchi" shaklidagi rekvizitlar (namunalar 2190, 2207, 1354, 2107, 2102)
const YASHOVCHI = `{{sud}}ga

Daʼvogar: {{davogarManzil}}da yashovchi
{{davogar}}
Telefon: {{davogarTel}}
Elektron pochta manzili: {{davogarEmail}}

Javobgar: {{javobgarManzil}}da yashovchi
{{javobgar}}
Telefon: {{javobgarTel}}
Elektron pochta manzili: {{javobgarEmail}}
`;

// Yorliqli rekvizitlar (namunalar 2240, 2239)
const YORLIQLI = `{{sud}}ga

Daʼvogar: {{davogar}}
Manzil: {{davogarManzil}}
Telefon: {{davogarTel}}
Pochta: {{davogarEmail}}

Javobgar: {{javobgar}}
Manzil: {{javobgarManzil}}
Telefon: {{javobgarTel}}
Pochta: {{javobgarEmail}}
`;

const nikohMatn = (qonuniy = '') =>
  `Men va javobgar oʻrtamizdagi ${qonuniy}nikoh {{nikohFhdyo}} tomonidan {{nikohSana}} kuni {{nikohRaqam}}-son bilan qayd etilgan.`;

const BOLA_MATN = 'Birgalikdagi turmushimizdan {{bolaTugilgan}}da tugʻilgan {{bola}} ismli (tugʻilganlik haqidagi guvohnoma seriyasi va raqami {{bolaGuvohnoma}}) farzandimiz bor.';

const KONST_77 = 'Oʻzbekiston Respublikasi Konstitutsiyasining 77-moddasiga muvofiq, ota-onalar va ularning oʻrnini bosuvchi shaxslar oʻz farzandlarini voyaga yetgunga qadar boqishi, ularning tarbiyasi, taʼlim olishi, sogʻlom, toʻlaqonli va har tomonlama kamol topishi xususida gʻamxoʻrlik qilishga majburdirlar.';

const PLENUM_23 = 'Oʻzbekiston Respublikasi Oliy sudi Plenumining 1998-yil 11-sentyabrdagi 23-sonli “Bolalar tarbiyasi bilan bogʻliq boʻlgan nizolarni hal qilishda sudlar tomonidan qonunlarni qoʻllash amaliyoti toʻgʻrisida”gi qarori';

const BOJ_POCHTA = 'Davlat boji (toʻlanishi lozim boʻlsa) va pochta xarajatlari toʻlanganligini tasdiqlovchi hujjat;';

const IMZO = `
Daʼvogar {{davogar}} ___________ (imzo)
{{sana}}`;

export const OILA_SHABLONLAR: Shablon[] = [
  {
    id: 'nikohdan-ajratish',
    title: 'Nikohdan ajratish haqida daʼvo arizasi',
    short: 'OK 38, 41-m. Voyaga yetmagan bolasi bor yoki rozilik yoʻq — faqat sudda.',
    fields: [...TARAFLAR, ...NIKOH, ...BOLA,
      f('bolaGuvohnomaBergan', 'Tugʻilganlik haqidagi guvohnomani bergan FHDYo boʻlimi'),
      f('sabablar', 'Nikohni bekor qilish uchun sabab boʻlgan holatlar', 'Eslatma (OK 39-m.): xotin homiladorligida va bola tugʻilganidan keyin bir yil mobaynida er uning roziligisiz daʼvo qoʻzgʻata olmaydi', true),
      f('alohidaMuddat', 'Taraflar amalda birga yashamayotgan muddat', '1 yil 3 oy (yillar, oylar yoki kunlar bilan)'),
      ILOVALAR, SANA],
    body: `${YORLIQLI}
DAʼVO ARIZASI
(nikohdan ajratish haqida)

${nikohMatn('qonuniy ')}

Birgalikdagi turmushimizdan {{bolaTugilgan}}da tugʻilgan {{bola}} ismli farzandimiz bor. Uning tugʻilganligi toʻgʻrisida {{bolaGuvohnomaBergan}} tomonidan {{bolaGuvohnoma}} seriya raqamli guvohnoma berilgan.

Men {{sabablar}} sababli oilani saqlab qolishning va javobgar bilan oilaviy hayotni davom ettirishning imkoni yoʻq deb hisoblayman.

Men {{alohidaMuddat}}dan buyon javobgar bilan bir oila sifatida yashamayman.

Oʻzbekiston Respublikasi Oila kodeksining 41-moddasiga binoan, agar sud er va xotinning bundan buyon birgalikda yashashiga va oilani saqlab qolishga imkoniyat yoʻq deb topsa, ularni nikohdan ajratadi.

Oʻzbekiston Respublikasi Oliy sudi Plenumining 2011-yil 20-iyuldagi 06-sonli “Sudlar tomonidan nikohdan ajratishga oid ishlar boʻyicha qonunchilikni qoʻllash amaliyoti toʻgʻrisida”gi qarorining 16-bandiga muvofiq, nikohdan ajratish toʻgʻrisidagi talab faqat er-xotin bundan buyon birga hayot kechirishlarining va oila batamom buzilganligi sababli uni saqlab qolishning iloji yoʻqligi aniqlangan holdagina qanoatlantirilishi lozim. Turmushda kechadigan vaqtinchalik kelishmovchiliklar va tasodifiy sabablarga koʻra er-xotin oʻrtasida kelib chiqqan ixtiloflar, shuningdek er-xotindan birining yoki har ikkalasining jiddiy vajlar keltirmagan holda nikoh munosabatlarini davom ettirishni xohlamasligi nikohdan ajratish uchun yetarli asos boʻla olmaydi. Nikohdan ajratishga asoslar boʻlmaganda, sud daʼvoni rad etadi.

Yuqoridagilarga koʻra, Oʻzbekiston Respublikasi Oila kodeksining 41-moddasiga, Oʻzbekiston Respublikasi Fuqarolik protsessual kodeksining 188–191-moddalariga asosan

SOʻRAYMAN:
Javobgar bilan oʻrtamizdagi {{nikohFhdyo}} tomonidan {{nikohSana}} kuni {{nikohRaqam}}-son bilan qayd etilgan nikohdan ajratishingizni.

Ilova qilinayotgan hujjatlar:
1. Daʼvo arizasining nusxasi;
2. Nikoh qayd etilganligi haqida guvohnoma;
3. Tugʻilganlik haqida guvohnoma nusxasi;
4. ${BOJ_POCHTA}
5. {{ilovalar}}
${IMZO}`,
  },
  {
    id: 'mol-mulkni-bolish',
    title: 'Er-xotinning umumiy mol-mulkini boʻlish haqida daʼvo arizasi',
    short: 'OK 23, 27, 28-m. Ulushlar teng. Ajrashganlar uchun daʼvo muddati — 3 yil.',
    fields: [...TARAFLAR,
      f('davoBahosi', 'Daʼvo bahosi — boʻlinadigan mol-mulk qiymati (soʻm)', 'FPK 189-m. 5-band'),
      ...NIKOH,
      f('mulklar', 'Boʻlinishi soʻralayotgan umumiy mol-mulklar', 'aniq nomi, manzili, rusumi, soni, qiymati va boshqa muhim xususiyatlari', true),
      f('bolishTartibi', 'Mol-mulkni boʻlish tartibi', 'menga: … ; javobgarga: … ajratib berilishini (ulushlar teng — OK 28-m.)', true),
      ILOVALAR, SANA],
    body: `${YORLIQLI}
Daʼvo bahosi: {{davoBahosi}} soʻm

DAʼVO ARIZASI
(mol-mulkni boʻlish haqida)

${nikohMatn('qonuniy ')}

Oʻrtamizda nikoh shartnomasi tuzilmagan. Javobgar bilan oilaviy hayotimiz davomida quyidagi mol-mulklarni sotib olganmiz:
{{mulklar}}

Oʻzbekiston Respublikasi Oila kodeksining 23-moddasiga asosan er va xotinning nikoh davomida orttirgan mol-mulklari, shuningdek nikoh qayd etilgunga qadar boʻlajak er-xotinning umumiy mablagʻlari hisobiga olingan mol-mulklari, agar qonun yoki nikoh shartnomasida boshqacha hol koʻrsatilmagan boʻlsa, ularning birgalikdagi umumiy mulki hisoblanadi.

Er va xotindan biri uy-roʻzgʻor ishlarini yuritish, bolalarni parvarish qilish bilan band boʻlgan yoki boshqa uzrli sabablarga koʻra mustaqil ish haqi va boshqa daromadga ega boʻlmagan taqdirda ham er va xotin umumiy mol-mulkka nisbatan teng huquqqa ega boʻladi.

Oila kodeksining 27-moddasiga koʻra, er va xotinning umumiy mol-mulkini boʻlish er va xotindan birining talabiga koʻra, ular nikohda boʻlgan davrda ham, nikohdan ajralishgandan keyin ham, shuningdek kreditor er va xotindan birining umumiy mol-mulkdagi ulushiga undiruvni qaratish uchun umumiy mol-mulkni boʻlish talabi bilan arz qilgan hollarda amalga oshirilishi mumkin.

Er va xotinning umumiy mol-mulki er va xotin oʻrtasida oʻzaro kelishuv asosida boʻlib olinishi mumkin. Er va xotinning xohishi bilan ularning umumiy mol-mulkni boʻlish toʻgʻrisidagi oʻzaro kelishuvi notarial tartibda tasdiqlanishi mumkin.

Nizo tugʻilgan hollarda er va xotinning umumiy mol-mulkini boʻlish, shuningdek er va xotinning bu mol-mulkdagi ulushini aniqlash sud tartibida amalga oshiriladi.

Umumiy mol-mulkni boʻlishda sud er va xotinning har biriga mulkning qaysi qismi berilishi lozimligini aniqlaydi. Er (xotin)ga unga qarashli ulushdan oshiq qiymatga ega boʻlgan mol-mulk beriladigan hollarda, xotin (er)ga tegishli pul yoki oʻzga kompensatsiya belgilanishi mumkin.

Oila kodeksining 28-moddasiga koʻra, er va xotinning umumiy mol-mulkini boʻlishda hamda ularning shu mol-mulkdagi ulushlarini aniqlashda, agar er va xotin oʻrtasidagi nikoh shartnomasida boshqacha hol nazarda tutilmagan boʻlsa, er va xotinning ulushlari teng deb hisoblanadi.

Javobgar bilan birgalikdagi mulkni boʻlish haqida kelishuv mavjud emas.

Yuqoridagilarga koʻra hamda Oʻzbekiston Respublikasi Oila kodeksining 23, 27, 28-moddalariga, Fuqarolik protsessual kodeksining 188–191-moddalariga asosan

SOʻRAYMAN:
1. Men va javobgar oʻrtamizdagi umumiy mol-mulklarimizni boʻlishingizni, bunda {{bolishTartibi}}.

Ilova qilinadigan hujjatlar:
1. Daʼvo arizasining nusxasi;
2. Nikoh qayd etilganligi haqida guvohnoma (nikoh bekor qilingan boʻlsa — nikohdan ajratish toʻgʻrisidagi guvohnoma yoki sud qarori);
3. Davlat boji va pochta xarajatlari toʻlanganligini tasdiqlovchi hujjat;
4. Mol-mulkka mulk huquqini tasdiqlovchi hujjatlar nusxalari;
5. Mol-mulk qiymatini tasdiqlovchi hujjat (baholash hisoboti);
6. {{ilovalar}}
${IMZO}`,
  },
  {
    id: 'aliment-qatiy-summa',
    title: 'Alimentning belgilangan miqdorini oʻzgartirish va alimentni qatʼiy summada undirish toʻgʻrisida daʼvo arizasi',
    short: 'OK 96, 102, 146-m. Ulushdagi alimentni har oylik qatʼiy summaga oʻzgartirish.',
    fields: [...TARAFLAR, ...NIKOH, ...BOLA,
      f('alimentSud', 'Aliment undirish toʻgʻrisida qaror qabul qilgan sud', 'Fuqarolik ishlari boʻyicha Toyloq tumanlararo sudi'),
      f('alimentSana', 'Aliment undirish toʻgʻrisidagi sud hujjati sanasi', '15.02.2024'),
      f('alimentHujjat', 'Sud hujjatining turi', 'sud buyrugʻi / ajrimi / hal qiluv qarori'),
      f('alimentUlush', 'Belgilangan aliment ulushi', '1/4'),
      f('qatiySumma', 'Qatʼiy summada undirilishi soʻralayotgan aliment (soʻm, har oyda)', 'har bir bola uchun mehnatga haq toʻlash eng kam miqdorining 26,5 foizidan kam emas (OK 99-m.)'),
      ILOVALAR, SANA],
    body: `${YASHOVCHI}
Daʼvo mazmuni: alimentning belgilangan miqdorini oʻzgartirish va alimentni qatʼiy summada undirish toʻgʻrisida

DAʼVO ARIZASI
(alimentning belgilangan miqdorini oʻzgartirish va alimentni qatʼiy summada undirish toʻgʻrisida)

${nikohMatn()}

${BOLA_MATN}

{{alimentSud}}ning {{alimentSana}}dagi {{alimentHujjat}}ga asosan javobgardan voyaga yetmagan, {{bolaTugilgan}}da tugʻilgan {{bola}} ismli farzandimning moddiy taʼminoti uchun javobgarning oylik ish haqi va (yoki) boshqa daromadlarining {{alimentUlush}} qismi miqdorida aliment undirish belgilangan.

Biroq javobgar ish haqi va boshqa daromadlarini kamaytirib koʻrsatish, buning natijasida aliment toʻlovlarini kamroq toʻlash maqsadida turli bahonalar bilan daromadining koʻp qismini rasmiy hujjatlarda koʻrsatmasdan kelmoqda. Buning natijasida esa men farzandimni moddiy taʼminlashda qiynalib kelmoqdaman.

${KONST_77}

Oʻzbekiston Respublikasi Oila kodeksining 96-moddasiga koʻra, ota-ona voyaga yetmagan bolalariga taʼminot berishi shart. Voyaga yetmagan bolalariga taʼminot berish majburiyatini ixtiyoriy ravishda bajarmagan ota (ona)dan sudning hal qiluv qaroriga yoki sud buyrugʻiga asosan aliment undiriladi.

Oila kodeksining 102-moddasida ota-onadan bolalarga undiriladigan aliment miqdori aliment toʻlovchining oylik ish haqiga va (yoki) boshqa daromadiga nisbatan ulushlar hisobida yoki pul bilan toʻlanadigan qatʼiy summada belgilanishi mumkinligi nazarda tutilgan. Aliment toʻlashi shart boʻlgan ota-onaning ish haqi va (yoki) boshqa daromadi doimo bir xilda boʻlmay, oʻzgarib tursa yoxud daromadining bir qismini natura tarzida oladigan boʻlsa, shuningdek daromaddan ulush tarzida aliment undirish imkoniyati boʻlmasa yoinki ota-ona rasman belgilangan ish haqi yoki daromadga ega boʻlmasa, voyaga yetmagan bolalarning taʼminoti uchun toʻlanishi lozim boʻlgan aliment miqdori har oyda pul bilan toʻlanadigan qatʼiy summada belgilanishi mumkin.

Oila kodeksining 146-moddasiga koʻra, aliment miqdori sud tartibida belgilanganidan keyin taraflardan birining moddiy yoki oilaviy ahvoli oʻzgarsa, sud ulardan har birining talabiga koʻra alimentning belgilangan miqdorini oʻzgartirishga haqli.

Mazkur qonunchilik talabidan kelib chiqqan holda voyaga yetmagan farzandimni doimiy ravishda moddiy tomondan yaxshi taʼminlashim uchun javobgardan har oyda {{qatiySumma}} soʻm miqdorida aliment undirish maqsadga muvofiq boʻladi deb hisoblayman.

Yuqoridagilarga koʻra, Oʻzbekiston Respublikasi Oila kodeksining 96, 102, 146-moddalariga hamda Oʻzbekiston Respublikasi Fuqarolik protsessual kodeksining 188, 189 va 191-moddalariga asosan

SOʻRAYMAN:
Javobgar {{javobgar}}dan {{bolaTugilgan}}da tugʻilgan farzandim {{bola}}ning moddiy taʼminoti uchun {{alimentSud}}ning {{alimentSana}}dagi {{alimentHujjat}}ga asosan undirilishi belgilangan aliment miqdorini oʻzgartirib, undan har oyda qatʼiy summada {{qatiySumma}} soʻm miqdorida aliment undirish haqida hal qiluv qarori qabul qilishingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi;
2. Nikoh qayd etilganligi (bekor qilinganligi) haqida guvohnoma nusxasi;
3. Farzandning tugʻilganlik haqidagi guvohnomasi nusxasi;
4. Aliment undirish toʻgʻrisidagi sud hujjati nusxasi;
5. Pochta xarajatlari toʻlanganligi toʻgʻrisidagi kvitansiya;
6. {{ilovalar}}
${IMZO}`,
  },
  {
    id: 'ota-onaga-aliment',
    title: 'Ota-onani taʼminlash uchun aliment undirish toʻgʻrisida daʼvo arizasi',
    short: 'Konstitutsiya 80-m., OK 109, 110-m. Mehnatga layoqatsiz, muhtoj ota-onaga.',
    fields: [...TARAFLAR,
      f('turmushOrtogi', 'Daʼvogarning turmush oʻrtogʻi F.I.O.si', 'u ham aliment soʻrasa — arizani birga imzolaydi yoki ishonchnoma beradi'),
      f('turmushSana', 'Turmush qurilgan sana', '20.08.1975'),
      f('farzandlarSoni', 'Farzandlar soni', '3'),
      f('layoqatsizlik', 'Mehnatga layoqatsizlik asosi', 'pensiya yoshidamiz / I guruh nogironi'),
      ILOVALAR, SANA],
    body: `${YASHOVCHI}
Daʼvo mazmuni: mening taʼminotim uchun farzandim {{javobgar}}dan aliment toʻlovlarini undirish toʻgʻrisida

DAʼVO ARIZASI
(ota-onani taʼminlash uchun aliment undirish toʻgʻrisida)

Men va turmush oʻrtogʻim {{turmushOrtogi}} {{turmushSana}} kuni turmush qurganmiz. Birgalikdagi turmushimizdan {{farzandlarSoni}} nafar farzandimiz bor. Biz farzandlarimizni moddiy tomondan toʻliq taʼminlab, voyaga yetkazganmiz. Farzandlarimiz mehnatga layoqatli boʻlib, mehnat faoliyati bilan shugʻullanib kelishadi.

Hozirgi kunda men va turmush oʻrtogʻim {{turmushOrtogi}} mehnatga layoqatsizmiz ({{layoqatsizlik}}). Shu sababli moddiy taʼminotga muhtojmiz.

Farzandimiz {{javobgar}}dan ixtiyoriy ravishda bizni moddiy jihatdan taʼminlashini soʻragan boʻlsak-da, u bizni moddiy jihatdan taʼminlamasdan, oʻzining farzandlik burchini bajarmasdan kelmoqda.

Oʻzbekiston Respublikasi Konstitutsiyasining 80-moddasiga koʻra, voyaga yetgan mehnatga layoqatli farzandlar oʻz ota-onalari haqida gʻamxoʻrlik qilishga majburdirlar.

Oʻzbekiston Respublikasi Oila kodeksining 109-moddasida voyaga yetgan, mehnatga layoqatli bolalar mehnatga layoqatsiz, yordamga muhtoj oʻz ota-onasiga taʼminot berishlari va ular toʻgʻrisida gʻamxoʻrlik qilishlari shartligi belgilangan.

Shuningdek, mazkur Kodeksning 110-moddasiga koʻra, voyaga yetgan, mehnatga layoqatli bolalar oʻz ota-onasiga ixtiyoriy ravishda moddiy yordam berishdan boʻyin tovlasalar, taʼminot miqdori bolalarning oilaviy va moddiy ahvolini hisobga olgan holda sudning hal qiluv qaroriga asosan belgilanadi.

Voyaga yetgan, mehnatga layoqatli bolalardan aliment undirish nizosi uzil-kesil hal boʻlgunga qadar sudya shu nizo boʻyicha vaqtincha toʻlab turilishi lozim boʻlgan summani koʻrsatib, ajrim chiqarishi mumkin (Oila kodeksi 110-moddasining uchinchi qismi, Fuqarolik protsessual kodeksining 187-moddasi).

Yuqoridagilarga koʻra, Oʻzbekiston Respublikasi Oila kodeksining 109, 110-moddalari hamda Oʻzbekiston Respublikasi Fuqarolik protsessual kodeksining 187, 188, 189 va 191-moddalariga asosan

SOʻRAYMAN:
1. Farzandimiz {{javobgar}}dan men va turmush oʻrtogʻimning taʼminoti uchun qonunchilikda belgilangan miqdorda aliment undirish toʻgʻrisida hal qiluv qarori qabul qilishingizni;
2. Aliment undirish nizosi uzil-kesil hal boʻlguniga qadar javobgardan bizning taʼminotimiz uchun vaqtincha toʻlab turilishi lozim boʻlgan summa toʻgʻrisida ajrim chiqarishingizni;
3. Mazkur ish koʻriladigan vaqt va joy haqida mening yashash manzilimga xabar berishingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi;
2. Javobgar bilan qarindoshlikni tasdiqlovchi hujjat (javobgarning tugʻilganlik haqidagi guvohnomasi nusxasi);
3. Mehnatga layoqatsizlikni tasdiqlovchi hujjat (pensiya guvohnomasi, nogironlik toʻgʻrisidagi maʼlumotnoma);
4. Pochta xarajatlari toʻlanganligi toʻgʻrisidagi kvitansiya;
5. {{ilovalar}}
${IMZO}`,
  },
  {
    id: 'bola-yashash-joyi',
    title: 'Bolaning yashash joyini belgilash toʻgʻrisida daʼvo arizasi',
    short: 'OK 71, 73, 75, 78-m. Ota-ona alohida yashaganda bolaning yashash joyi.',
    fields: [...TARAFLAR, ...NIKOH, ...BOLA,
      f('ajrashishSababi', 'Er-xotinlik munosabatlari tugatilishining sabablari', 'oʻzaro kelishmovchiliklar'),
      f('ajrashishVaqti', 'Er-xotinlik munosabatlari tugatilgan vaqt', '2025-yil mart'),
      f('salbiyFaktlar', 'Farzandning taʼlim-tarbiyasiga salbiy taʼsirni tasdiqlovchi faktlar', undefined, true),
      f('javobgarHarakatlari', 'Javobgarning bolaga salbiy taʼsir koʻrsatayotgan xatti-harakatlari', undefined, true),
      ILOVALAR, SANA],
    body: `${YASHOVCHI}
Daʼvo mazmuni: farzandim {{bola}}ning yashash joyini belgilash toʻgʻrisida

DAʼVO ARIZASI
(bolaning yashash joyini belgilash toʻgʻrisida)

${nikohMatn()}

${BOLA_MATN}

Men va javobgar {{javobgar}} oʻrtasidagi er-xotinlik munosabatlarimiz {{ajrashishSababi}} sababli {{ajrashishVaqti}}dan buyon tugagan va biz birga yashamaymiz.

Farzandimning tarbiyasi, taʼlim olishi, moddiy taʼminoti va bolaning doimiy yashash joyi yuzasidan javobgar {{javobgar}} bilan kelishuvga erisha olmadik.

Javobgar {{javobgar}}ning doimiy yashash joyi yoʻq. Shu sababli hozirda farzandim {{bola}} javobgar bilan birga turli joylarda yashab kelmoqda. Bu holat voyaga yetmagan farzandim {{bola}}ning taʼlim va tarbiya olishiga salbiy taʼsir koʻrsatadi. Mazkur holatlarni quyidagi faktlar ham tasdiqlaydi: {{salbiyFaktlar}}

Mening uy-joyimda farzandim uchun barcha imkoniyatlar mavjud. Hozirda javobgar {{javobgar}} farzandim {{bola}} bilan birga yashashimga qarshilik koʻrsatib, bolaga boʻlgan huquqlarimni buzmoqda.

Ota-ona oʻz bolalarining tarbiyasi va kamoloti uchun javobgardir. Ular oʻz bolalarining sogʻligʻi, jismoniy, ruhiy, maʼnaviy va axloqiy kamoloti haqida gʻamxoʻrlik qilishlari shart.

Javobgarning {{javobgarHarakatlari}} kabi xatti-harakatlari farzandimning jismoniy va ruhiy holatiga, axloqiy kamolotiga salbiy taʼsir koʻrsatib kelmoqda.

${KONST_77}

Oila kodeksining 71-moddasiga koʻra, ota-ona oʻz bolalariga nisbatan teng huquq va majburiyatlarga egadirlar, 73-moddasiga muvofiq esa ota-ona oʻz bolalarini tarbiyalash huquqiga ega va tarbiyalashi shart. Ota-ona oʻz bolalarining tarbiyasi va kamoloti uchun javobgardir. Ular oʻz bolalarining sogʻligʻi, jismoniy, ruhiy, maʼnaviy va axloqiy kamoloti haqida gʻamxoʻrlik qilishlari shart.

Oila kodeksi 75-moddasining beshinchi qismiga koʻra, ota-ona alohida yashaganda bolalarning qayerda yashashi ota-onaning kelishuviga binoan belgilanadi. Ota-ona oʻrtasida kelishuv boʻlmasa, nizo sud tomonidan bolalarning eng ustun manfaatlaridan kelib chiqqan, ularning fikrini hisobga olgan holda hal etiladi. Bunda sud bolaning ota-onadan, aka-uka, opa-singillaridan qaysi biriga bogʻlanib qolganligini, bolaning yoshini, ota-onasining axloqiy va boshqa shaxsiy fazilatlarini, ota-onaning har biri bilan bola oʻrtasidagi munosabatlarni, bolani tarbiyalash va uning kamoloti uchun shart-sharoitlar (ota-onasining mashgʻulot turi, ish tartibi, moddiy hamda oilaviy ahvoli va boshqalar) yaratish imkoniyatini hisobga oladi.

Mazkur Kodeksning 78-moddasiga koʻra, nizo chiqqan taqdirda ota-ona oʻz huquqlarini himoya qilish uchun sudga murojaat qilishga haqli. Bu talablarni koʻrishda sud bolani ota-onasiga qaytarish uning eng ustun manfaatlariga zid degan xulosaga kelsa, bolaning fikrini hisobga olgan holda ota-onaning daʼvosini rad qilishga haqli.

Qayd qilingan holatlar va qonun talabidan kelib chiqib, Oʻzbekiston Respublikasi Fuqarolik protsessual kodeksining 188–191-moddalari, Oʻzbekiston Respublikasi Oila kodeksining 71, 73, 75, 78-moddalari, ${PLENUM_23}ga asosan,

SOʻRAYMAN:
{{bolaTugilgan}}da tugʻilgan {{bola}} ismli farzandimning yashash joyi sifatida men yashab kelayotgan {{davogarManzil}} manzilda joylashgan uy-joyni belgilab berishingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi;
2. Nikoh qayd etilganligi (bekor qilinganligi) haqida guvohnoma nusxasi;
3. Farzandning tugʻilganlik haqidagi guvohnomasi nusxasi;
4. Daʼvogarning uy-joy sharoitini tasdiqlovchi hujjatlar;
5. ${BOJ_POCHTA}
6. {{ilovalar}}
${IMZO}`,
  },
  {
    id: 'bola-bilan-korishish',
    title: 'Bola bilan koʻrishib turish tartibini belgilash toʻgʻrisida daʼvo arizasi',
    short: 'OK 66, 71, 76-m. Alohida yashayotgan ota (ona) uchun koʻrishish tartibi.',
    fields: [...TARAFLAR, ...NIKOH, ...BOLA,
      f('birgaYashagan', 'Er-xotin sifatida qachongacha birga yashagansiz', '2024-yil sentyabr'),
      f('nikohBekorSud', 'Nikohni bekor qilgan sud', 'Fuqarolik ishlari boʻyicha Toyloq tumanlararo sudi'),
      f('nikohBekorSana', 'Nikohni bekor qilish haqidagi hal qiluv qarori sanasi', '15.01.2025'),
      f('kunBoshlanish', 'Koʻrishish boshlanadigan hafta kuni', 'shanba'),
      f('soatBoshlanish', 'Koʻrishish boshlanadigan soat', '10:00'),
      f('kunTugash', 'Koʻrishish tugaydigan hafta kuni', 'yakshanba'),
      f('soatTugash', 'Koʻrishish tugaydigan soat', '18:00'),
      ILOVALAR, SANA],
    body: `${YASHOVCHI}
Daʼvo mazmuni: farzandim {{bola}} bilan koʻrishib turish tartibini belgilash toʻgʻrisida

DAʼVO ARIZASI
(bola bilan koʻrishib turish tartibini belgilash toʻgʻrisida)

${nikohMatn()}

${BOLA_MATN}

Men va javobgar {{birgaYashagan}}ga qadar birgalikda yashab, keyinchalik oʻzaro kelishmovchiliklar tufayli {{nikohBekorSud}}ning {{nikohBekorSana}} kunidagi hal qiluv qarori bilan qonuniy nikohimiz bekor qilingan. Ayni paytda voyaga yetmagan farzandim {{bola}} javobgarning tarbiyasida va u bilan birga yashab kelmoqda.

Men voyaga yetmagan farzandim {{bola}}ni sogʻinib, u bilan koʻrishish istagida boʻlsam-da, javobgar {{javobgar}} bola bilan koʻrishib, uni oʻz uyimga olib kelgan holda tarbiyasida ishtirok etishimga ixtiyoriy ravishda imkoniyat yaratib bermayapti.

Oila kodeksining 66-moddasiga koʻra, ota va ona alohida yashagan holda bola ularning har biri bilan koʻrishish huquqiga ega. Kodeksning 71-moddasiga koʻra esa ota-ona oʻz bolalariga nisbatan teng huquq va majburiyatlarga egadirlar.

Aslida, yuqoridagi qonun talabiga koʻra bolani tarbiyalashda teng huquqqa ega boʻlsam-da, ayni paytda bolaning bevosita javobgar {{javobgar}} tarbiyasida boʻlishi va bolani muayyan vaqtdagina oʻz uyimga olib kelgan taqdirda ham ushbu tenglikdan chekinilgan boʻladi.

Oʻzbekiston Respublikasi Oila kodeksining 76-moddasiga koʻra, boladan alohida yashayotgan ota (ona) bola bilan koʻrishish, uning tarbiyasida ishtirok etish va taʼlim olishi masalasini hal etishda qatnashish huquqiga ega.

Bola bilan birga yashayotgan ota (ona) bolaning ona (ota)si bilan koʻrishishiga, agar bunday koʻrishish bolaning jismoniy va ruhiy sogʻligʻiga, axloqiy kamolotiga zarar keltirmasa, qarshilik qilmasligi kerak.

Ota-ona boladan alohida yashaydigan otaning (onaning) ota-onalik huquqlarini amalga oshirish tartibi toʻgʻrisida yozma ravishda kelishuv tuzishga haqlidir.

Agar ota-ona kelisha olmasa, nizo ota-onaning (yoki ulardan birining) talabiga binoan sud tomonidan vasiylik va homiylik organi ishtirokida hal qilinadi.

Binobarin, yuqoridagi qonun talabiga koʻra men ham javobgar bilan bir qatorda bolaga nisbatan teng huquqqa ega boʻlib hisoblanaman. Javobgarning toʻsqinligi tufayli oʻz huquqlarimdan sud orqali foydalanishga qaror qilib, ushbu mazmundagi daʼvo arizasi bilan sudga murojaat qilishga majbur boʻlmoqdaman.

Qayd qilingan holatlar va qonun talabidan kelib chiqib, Oʻzbekiston Respublikasi Oila kodeksining 66, 71, 76-moddalari, Fuqarolik protsessual kodeksining 188–191-moddalari, ${PLENUM_23}ga asoslanib,

SOʻRAYMAN:
Javobgar {{javobgar}}ning tarbiyasida boʻlgan voyaga yetmagan farzandim {{bola}} bilan koʻrishib, uning tarbiyasida ishtirok etish tartibi (vaqti)ni har haftaning {{kunBoshlanish}} kuni soat {{soatBoshlanish}}dan {{kunTugash}} kuni soat {{soatTugash}}ga qadar oʻzimning yashash uyim, yaʼni {{davogarManzil}}ga olib ketish sharti bilan belgilab berishingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi;
2. Nikohni bekor qilish toʻgʻrisidagi hal qiluv qarori nusxasi;
3. Farzandning tugʻilganlik haqidagi guvohnomasi nusxasi;
4. ${BOJ_POCHTA}
5. {{ilovalar}}
${IMZO}`,
  },
  {
    id: 'ota-onalik-huquqidan-mahrum-qilish',
    title: 'Ota (ona)lik huquqidan mahrum etish toʻgʻrisida daʼvo arizasi',
    short: 'OK 79, 80-m. Prokuror va vasiylik organi ishtirokida koʻriladi.',
    fields: [...TARAFLAR,
      f('javobgarTugilgan', 'Javobgarning tugʻilgan sanasi', '01.01.1990'),
      ...NIKOH, ...BOLA,
      f('bolaGuvohnomaBergan', 'Tugʻilganlik haqidagi guvohnomani bergan FHDYo boʻlimi'),
      f('asoslar', 'Ota-onalik huquqidan mahrum qilish asoslari (faktlar bilan)', 'OK 79-m.: ota-onalik majburiyatlarini bajarishdan, jumladan aliment toʻlashdan boʻyin tovlash; bolani tugʻruqxona yoki boshqa muassasadan olishdan uzrsiz bosh tortish; ota-onalik huquqini suiisteʼmol qilish, shafqatsiz muomala; muttasil ichkilikbozlik yoki giyohvandlik; bola yoki er (xotin)ning hayoti yoki sogʻligʻiga qarshi qasddan jinoyat', true),
      ILOVALAR, SANA],
    body: `${YASHOVCHI}
DAʼVO ARIZASI
(ota (ona)lik huquqidan mahrum etish toʻgʻrisida)

${nikohMatn('qonuniy ')}

Birgalikdagi turmushimizdan {{bolaTugilgan}}da tugʻilgan {{bola}} ismli (tugʻilganlik haqidagi guvohnoma seriyasi va raqami {{bolaGuvohnoma}}, {{bolaGuvohnomaBergan}} tomonidan berilgan) farzandim (farzandlarim) bor.

Bugungi kunda {{asoslar}}

Oʻzbekiston Respublikasi Oila kodeksining 79-moddasiga koʻra, ota-ona (ulardan biri) ota-onalik majburiyatlarini bajarishdan bosh tortsa, shu jumladan aliment toʻlashdan boʻyin tovlasa; uzrsiz sabablarga koʻra oʻz bolasini tugʻuruqxona yoki boshqa davolash muassasasidan, tarbiya, aholini ijtimoiy himoyalash muassasasi va shunga oʻxshash boshqa muassasalardan olishdan bosh tortsa; ota-onalik huquqini suiisteʼmol qilsa, bolalarga nisbatan shafqatsiz muomalada boʻlsa, jumladan jismoniy kuch ishlatsa yoki ruhiy taʼsir koʻrsatsa; muttasil ichkilikbozlik yoki giyohvandlikka mubtalo boʻlgan boʻlsa; oʻz bolalarining hayoti yoki sogʻligʻiga yoxud eri (xotini)ning hayoti yoki sogʻligʻiga qarshi qasddan jinoyat sodir qilgan boʻlsa, ota-onalik huquqidan mahrum qilinishi mumkin.

Oila kodeksining 80-moddasiga koʻra, ota-onalik huquqidan mahrum qilish sud tartibida amalga oshiriladi va bunday ishlar prokuror hamda vasiylik va homiylik organi ishtirokida koʻrib chiqiladi. Sud ota-onalik huquqidan mahrum qilish toʻgʻrisidagi ishlarni koʻrib chiqishda bolaning taʼminoti uchun ota-onalik huquqidan mahrum qilingan ota-onadan (ularning biridan) aliment undirish masalasini hal qiladi.

Yuqoridagilarga koʻra, Oʻzbekiston Respublikasi Oila kodeksining 79, 80-moddalariga, Fuqarolik protsessual kodeksining 188–191-moddalariga asosan

SOʻRAYMAN:
1. {{javobgarTugilgan}}da tugʻilgan javobgar {{javobgar}}ni {{bolaTugilgan}}da tugʻilgan {{bola}} ismli farzandim (farzandlarim)ga nisbatan ota (ona)lik huquqidan mahrum qilishingizni;
2. Oila kodeksining 80-moddasiga muvofiq farzandim (farzandlarim) taʼminoti uchun javobgardan aliment undirish masalasini hal qilishingizni.

Ilova qilinayotgan hujjatlar:
1. Daʼvo arizasining javobgar uchun nusxasi;
2. Nikoh qayd etilganligi (bekor qilinganligi) haqida guvohnoma nusxasi;
3. Farzandning tugʻilganlik haqidagi guvohnomasi nusxasi;
4. Ota-onalik huquqidan mahrum qilish asoslarini tasdiqlovchi hujjatlar;
5. ${BOJ_POCHTA}
6. {{ilovalar}}
${IMZO}`,
  },
];
