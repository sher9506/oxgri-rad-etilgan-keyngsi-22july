// Mulk, ijara, shartnoma va meros nizolari boʻyicha daʼvo arizalari.
// Manba: Adliya vazirligi «Adolat» markazi Legal Tech namunalari — yurxizmat.uz/oz/document/36, 2188, 2244, 2702, 2242, 2228.
// Moddalar lex.uz da 2026-10 holatiga tekshirilgan: FK 1-qism https://lex.uz/uz/acts/111189 (11, 164, 228, 231, 237, 382, 384),
// FK 2-qism https://lex.uz/uz/acts/180552 (535, 544, 1134–1141, 1145, 1146, 1150), Konstitutsiya https://lex.uz/uz/acts/6445145 (41, 47),
// FPK https://lex.uz/uz/acts/3517337 (188 — ariza berish, 189 — mazmuni, 190 — nusxalar, 191 — ilovalar).
// Namunadan tuzatishlar: 36 — ijara haqi FKning 544-moddasida (namunada 543); 2702 — merosni qabul qilish muddati va uni tiklash
// joriy FKda yoʻq (1145-modda: meros ochilgan vaqtdan huquq vujudga keladi; namunadagi 1140¹-modda — meros transmissiyasi),
// shu sababli daʼvo merosga boʻlgan huquqni tan olishga aylantirilgan.
import type { Field, Shablon } from './shablonlar-data';

const f = (key: string, label: string, placeholder?: string, multiline?: boolean): Field =>
  ({ key, label, placeholder, multiline });

const MANZIL_IZOH = 'viloyat, tuman (shahar), mahalla, koʻcha, uy, xonadon raqami';

// FPK 189-modda: sud, daʼvogar va javobgarning F.I.O. va yashash joyi.
const TARAFLAR: Field[] = [
  f('sud', 'Sud nomi', 'Fuqarolik ishlari boʻyicha Yunusobod tumanlararo sudi'),
  f('davogar', 'Daʼvogar F.I.O.'),
  f('davogarManzil', 'Daʼvogarning yashash manzili', MANZIL_IZOH),
  f('davogarTel', 'Daʼvogarning telefon raqami', '+998 90 123 45 67'),
  f('davogarEmail', 'Daʼvogarning elektron manzili', 'ism@mail.uz'),
  f('javobgar', 'Javobgar F.I.O.'),
  f('javobgarManzil', 'Javobgarning yashash manzili', MANZIL_IZOH),
  f('javobgarTel', 'Javobgarning telefon raqami'),
  f('javobgarEmail', 'Javobgarning elektron manzili'),
];

const ILOVA = f('ilova', 'Boshqa ilova qilinayotgan hujjatlar', 'shartnoma, dalolatnoma, yozishmalar nusxalari', true);
const SANA = f('sana', 'Ariza sanasi', new Date().toLocaleDateString('uz-UZ'));

const sarlavha = (qoshimcha = '') => `{{sud}}ga

Daʼvogar: {{davogar}}
Manzili: {{davogarManzil}}
Telefon: {{davogarTel}}
Elektron manzil: {{davogarEmail}}

Javobgar: {{javobgar}}
Manzili: {{javobgarManzil}}
Telefon: {{javobgarTel}}
Elektron manzil: {{javobgarEmail}}
${qoshimcha}`;

const IMZO = `
Daʼvogar {{davogar}} ___________ (imzo)
{{sana}} yil.`;

export const MULK_SHABLONLAR: Shablon[] = [
  {
    id: 'ijara-qarzi',
    title: 'Ijara toʻlovlari boʻyicha qarzdorlikni undirish toʻgʻrisida daʼvo ariza',
    short: 'FK 535, 544-moddalar. Ijara haqi va shartnomaviy penyani undirish.',
    fields: [...TARAFLAR,
      f('shartnomaSana', 'Ijara shartnomasi tuzilgan sana', '01.02.2026'),
      f('shartnomaRaqam', 'Ijara shartnomasining raqami', '12'),
      f('birinchiTolovMuddati', 'Birinchi toʻlov muddati (shartnoma roʻyxatga olingandan keyin necha kun)', '10'),
      f('tolovJadvali', 'Keyingi toʻlovlar muddati (shartnoma jadvali boʻyicha)', 'har chorakning birinchi oyining yigirmanchi kunidan kechiktirmasdan'),
      f('qarz', 'Ijara toʻlovlari boʻyicha qarzdorlik miqdori (soʻm, raqam va soʻz bilan)'),
      f('penyaFoiz', 'Kechiktirilgan har bir kun uchun penya (foizda)', '0,1'),
      f('penyaChegara', 'Penyaning eng yuqori chegarasi (kechiktirilgan summaga nisbatan foizda)', '50'),
      f('penya', 'Hisoblangan jami penya miqdori (soʻm, raqam va soʻz bilan)'),
      f('jamiSumma', 'Undirilishi soʻralayotgan ijara haqi va penyaning umumiy summasi (soʻm)'),
      ILOVA, SANA],
    body: `${sarlavha(`
Daʼvo mazmuni: Ijara toʻlovlari boʻyicha {{jamiSumma}} soʻm qarzdorlikni undirish toʻgʻrisida
`)}
DAʼVO ARIZASI
(Ijara toʻlovlari boʻyicha qarzdorlikni undirish toʻgʻrisida)

Men va {{javobgar}} oʻrtamizda {{shartnomaSana}}da {{shartnomaRaqam}}-sonli ijara shartnomasi tuzilgan. Ushbu shartnomaga koʻra ijaraga oluvchi belgilangan ijara toʻlovini oʻz vaqtida, belgilangan muddatda va miqdorda mening hisob raqamimga toʻlashi, birinchi toʻlovni shartnoma roʻyxatga olingan sanadan boshlab {{birinchiTolovMuddati}} kun ichida amalga oshirishi va kelgusi toʻlovlarni shartnomada koʻrsatilgan jadvalga asosan {{tolovJadvali}} toʻlashi belgilangan. Ijaraga oluvchi shartnoma majburiyatini buzib, {{qarz}} soʻm qarzdorlikni toʻlamasdan kelgan.

Shartnomada ijaraga oluvchi belgilangan ijara toʻlovini oʻz vaqtida va miqdorda toʻlamaganligi uchun ijaraga beruvchiga kechiktirilgan har bir kun uchun toʻlov summasining {{penyaFoiz}} foizi miqdorida, ammo kechiktirilgan toʻlov summasining {{penyaChegara}} foizidan ortiq boʻlmagan miqdorda penya toʻlashi belgilangan. Shartnoma shartlaridan kelib chiqqan holda belgilangan muddatda toʻlanmagan ijara toʻlovlari uchun jami {{penya}} soʻm penya hisoblandi. Qarzdorga bu haqda xabarnoma yuborilgan boʻlsa-da, u tomonidan eʼtiborsiz qoldirilgan.

Oʻzbekiston Respublikasi Fuqarolik kodeksining 535-moddasiga binoan mulk ijarasi shartnomasi boʻyicha ijaraga beruvchi ijaraga oluvchiga haq evaziga mol-mulkni vaqtincha egalik qilish va foydalanish yoki foydalanish uchun topshirish majburiyatini oladi.

Shuningdek, Fuqarolik kodeksining 544-moddasiga koʻra ijaraga oluvchi mol-mulkdan foydalanganlik uchun haqni oʻz vaqtida toʻlab turishi shart.

Mol-mulkdan foydalanganlik uchun haq toʻlash tartibi, shartlari va muddatlari mulk ijarasi shartnomasi bilan belgilanadi. Bular shartnomada belgilanmagan hollarda odatda xuddi shunday mol-mulkni oʻxshash holatlarda ijaraga berishda qoʻllaniladigan tartib, shartlar va muddatlar belgilangan deb hisoblanadi.

Agar shartnomada boshqacha tartib nazarda tutilgan boʻlmasa, mol-mulkdan foydalanganlik uchun ijara haqini toʻlash muddatlari ijaraga oluvchi tomonidan jiddiy buzilgan taqdirda, ijaraga beruvchi undan ijara haqini muddatidan oldin, ijaraga beruvchi belgilagan muddatda toʻlashni talab qilishga haqli. Bunda ijaraga beruvchi mol-mulkdan foydalanganlik uchun koʻpi bilan ikki muddatning haqini muddatidan oldin toʻlashni talab qilishga haqli.

«Ijara toʻgʻrisida»gi Oʻzbekiston Respublikasi Qonuniga muvofiq ijara haqi ijara shartnomasida tomonlarning oʻzaro kelishuviga binoan belgilanadi. Ijara haqini toʻlash shartlari va muddatlari shartnomada belgilab qoʻyiladi.

Oʻzbekiston Respublikasi Oliy xoʻjalik sudi Plenumining «Mulk ijarasi shartnomasiga oid fuqarolik qonun hujjatlari normalarini iqtisodiy sudlar tomonidan qoʻllashning ayrim masalalari toʻgʻrisida»gi 2011-yil 1-dekabrdagi 234-sonli qarorining 9-bandiga koʻra mulk ijarasi shartnomasi haq evaziga tuziladigan shartnoma hisoblanadi, shu sababli ijaraga oluvchining asosiy majburiyatlaridan biri mulkdan foydalanganlik uchun haqni, yaʼni ijara haqini oʻz vaqtida toʻlashdir. Ijara shartnomasida ijara haqini toʻlash muddati koʻrsatilmagan hollarda FK 544-moddasining ikkinchi qismi qoidalari qoʻllaniladi. Ijaraga oluvchining ijara haqini toʻlash majburiyati ijaraga berilgan mulk unga topshirilgan paytdan boshlab vujudga keladi. Ijara shartnomasi muddati tugaganidan keyin ham ijaraga oluvchi ijaraga olingan mulkdan amalda foydalanishni davom ettirsa, u butun foydalangan davr uchun ijara haqini toʻlashga majbur.

Fuqarolik kodeksining 237-moddasiga koʻra majburiyatni bajarishdan bir tomonlama bosh tortish va shartnoma shartlarini bir tomonlama oʻzgartirishga yoʻl qoʻyilmaydi, qonunchilikda yoki shartnomada nazarda tutilgan hollar bundan mustasno.

Yuqoridagilarga asosan, Oʻzbekiston Respublikasi Fuqarolik kodeksining 237, 544-moddalari hamda Fuqarolik protsessual kodeksining 188–191-moddalariga asoslanib, suddan

SOʻRAYMAN:
Javobgar {{javobgar}}dan mening foydamga {{qarz}} soʻm miqdoridagi ijara toʻlovlari boʻyicha qarzdorlikni hamda unga hisoblangan {{penya}} soʻm penyani, jami {{jamiSumma}} soʻmni undirib berishingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Ijara shartnomasi nusxasi.
3. Qarzdorlik va penya hisob-kitobi.
4. Javobgarga yuborilgan xabarnoma nusxasi.
5. Davlat boji toʻlanganligini tasdiqlovchi hujjat.
6. {{ilova}}
${IMZO}`,
  },
  {
    id: 'shartnomani-bekor-qilish',
    title: 'Shartnomani bekor qilish toʻgʻrisida daʼvo ariza',
    short: 'FK 382, 384-moddalar. Shartnoma jiddiy buzilganda uni sud orqali bekor qilish.',
    fields: [...TARAFLAR,
      f('shartnomaSana', 'Taraflar oʻrtasida shartnoma tuzilgan sana', '15.03.2025'),
      f('shartnomaMazmuni', 'Shartnomaning mazmuni (predmeti)', 'turar joyni oldi-sotdi qilish', true),
      f('majburiyatlar', 'Shartnoma boʻyicha javobgar bajarishi lozim boʻlgan majburiyatlar', undefined, true),
      f('bajarilmagan', 'Javobgar bajarmagan majburiyatlar', undefined, true),
      f('taklifSana', 'Javobgarga shartnomani bekor qilish taklifi yuborilgan sana', '01.08.2026'),
      f('vajlar', 'Javobgar rad etishda keltirgan vajlar', undefined, true),
      f('davlatBoji', 'Toʻlangan davlat boji miqdori (soʻm)'),
      ILOVA, SANA],
    body: `${sarlavha(`
Daʼvo mazmuni: {{shartnomaSana}}da tuzilgan shartnomani bekor qilish toʻgʻrisida
`)}
DAʼVO ARIZASI
(Shartnomani bekor qilish toʻgʻrisida)

{{shartnomaSana}}da men va javobgar oʻrtamizda shartnoma tuzilgan boʻlib, ushbu shartnoma mazmuni {{shartnomaMazmuni}}dan iborat edi.

Mazkur shartnoma boʻyicha javobgar quyidagi majburiyatlarni bajarishi lozim boʻlgan: {{majburiyatlar}}.

Shartnomada koʻrsatilgan {{bajarilmagan}} kabi majburiyatlar javobgar tomonidan bajarilmay kelinmoqda. Shu sababli men javobgarga {{shartnomaSana}}da tuzilgan shartnomani bekor qilishni {{taklifSana}}da taklif qildim. Biroq javobgar majburiyatlarini bajarishni ham, shartnomani bekor qilishni ham xohlamadi.

Javobgar men tomonimdan bildirilgan takliflarni {{vajlar}} kabi vajlar bilan rad qilib kelmoqda.

Oʻzbekiston Respublikasi Fuqarolik kodeksi 382-moddasi ikkinchi qismining 1-bandiga koʻra taraflardan birining talabi bilan shartnoma ikkinchi taraf shartnomani jiddiy ravishda buzganda sud tomonidan bekor qilinishi mumkin.

Tarafladan birining shartnomani buzishi ikkinchi tarafga u shartnoma tuzishda umid qilishga haqli boʻlgan narsadan koʻp darajada mahrum boʻladigan qilib zarar yetkazishi shartnomani jiddiy buzish hisoblanadi.

Bir taraf shartnomani bajarishdan toʻla yoki qisman bosh tortib, qonun yohud taraflarning kelishuvida bunga yoʻl qoʻyilsa, shartnoma tegishlicha bekor qilingan yoki oʻzgartirilgan hisoblanadi.

Fuqarolik kodeksining 384-moddasi ikkinchi qismiga koʻra bir taraf shartnomani bekor qilish haqidagi taklifga ikkinchi tarafdan rad javobi olganidan keyingina yoki taklifda koʻrsatilgan yohud qonunda yoinki shartnomada belgilangan muddatda, bunday muddat boʻlmaganida esa — oʻttiz kunlik muddatda javob olmaganidan keyin shartnomani bekor qilish haqidagi talabni sudga taqdim etishi mumkin.

Qayd qilingan holatlar va qonun talabidan kelib chiqib, Oʻzbekiston Respublikasi Fuqarolik protsessual kodeksining 188–191-moddalari, Oʻzbekiston Respublikasi Fuqarolik kodeksining 382, 384-moddalariga asosan

SOʻRAYMAN:
1. Men va javobgar oʻrtamizda {{shartnomaSana}}da tuzilgan shartnomani bekor qilishingizni;
2. Daʼvo arizasi berilishida men tomonimdan toʻlangan {{davlatBoji}} soʻm davlat bojini javobgardan undirib berishingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Shartnoma nusxasi.
3. Javobgarga yuborilgan shartnomani bekor qilish taklifi va uning javobi (pochta kvitansiyasi) nusxasi.
4. Davlat boji toʻlanganligini tasdiqlovchi hujjat.
5. {{ilova}}
${IMZO}`,
  },
  {
    id: 'meros-ulushini-belgilash',
    title: 'Meros boʻyicha ulushlarni belgilash toʻgʻrisida daʼvo ariza',
    short: 'FK 1134, 1135, 1145, 1150-moddalar. Notarius nizo sababli rad etganda.',
    fields: [...TARAFLAR,
      f('davogarTugilgan', 'Daʼvogar tugʻilgan sana'),
      f('ota', 'Daʼvogarning otasi F.I.O.'),
      f('otaTugilgan', 'Otasining tugʻilgan sanasi'),
      f('otaVafot', 'Otasining vafot etgan sanasi'),
      f('ona', 'Daʼvogarning onasi F.I.O.'),
      f('onaTugilgan', 'Onasining tugʻilgan sanasi'),
      f('onaVafot', 'Onasining vafot etgan sanasi'),
      f('nikohSana', 'Ota-onaning nikohdan oʻtgan sanasi'),
      f('farzandlarSoni', 'Ota-onaning farzandlari soni', '4'),
      f('farzandlar', 'Barcha farzandlarning F.I.Sh.lari', 'A.A. Aliyev, B.A. Aliyeva, ...', true),
      f('uyManzil', 'Meros qolgan uy-joy manzili', MANZIL_IZOH),
      f('notariusSana', 'Notarial idoraga murojaat qilingan sana'),
      f('notarius', 'Murojaat qilingan notarial idora (xususiy notarius) nomi'),
      ILOVA, SANA],
    body: `${sarlavha()}
DAʼVO ARIZASI
(Meros boʻyicha ulushlarni belgilash toʻgʻrisida)

Men, daʼvogar {{davogar}}, {{davogarTugilgan}}da tugʻilganman. Otam {{ota}} {{otaTugilgan}}da tugʻilib, {{otaVafot}}da vafot etgan, onam {{ona}} {{onaTugilgan}}da tugʻilib, {{onaVafot}}da vafot etgan. Ota-onam {{nikohSana}}da qonuniy nikohdan oʻtishib, ular birgalikdagi turmushlaridan {{farzandlarSoni}} nafar, yaʼni {{farzandlar}} farzandli boʻlishgan.

Ota-onamizdan {{uyManzil}} manzilida joylashgan uy-joy biz farzandlarga meros boʻlib qolgan.

Ota-onamning vafotidan soʻng {{notariusSana}}da {{notarius}} notarial idorasiga meros boʻyicha ulushlarimizni belgilab berishni soʻrab murojaat qilganman. Biroq notarial idora merosxoʻrlarni chaqirib, ularning fikrini soʻraganida, merosxoʻrlardan biri, yaʼni javobgar {{javobgar}} norozilik bildirganligi sababli notarius meros boʻyicha ulushlarni belgilab bera olmasligini, merosxoʻrlar oʻrtasida nizo borligini aytib, notarial harakatni amalga oshirishni rad etish toʻgʻrisida qaror chiqarib berdi.

Javobgar {{javobgar}}dan boshqa barcha merosxoʻrlar meros mulki boʻyicha oʻz ulushlariga rozi.

Oʻzbekiston Respublikasi Konstitutsiyasining 41-moddasiga koʻra meros huquqi qonun bilan kafolatlanadi.

Shu bilan birga Fuqarolik kodeksining 1134-moddasiga koʻra qonun boʻyicha merosxoʻrlar vorislikka ushbu Kodeksning 1135–1141-moddalarida nazarda tutilgan navbat tartibida chaqiriladilar.

Shu Kodeksning 1135-moddasiga koʻra meros qoldiruvchining bolalari (shu jumladan farzandlikka olingan bolalari), eri (xotini) va ota-onasi (farzandlikka oluvchilar) teng ulushlarda qonun boʻyicha birinchi navbatdagi vorislik huquqiga ega boʻladilar. Meros qoldiruvchining vafotidan keyin tugʻilgan bolalari ham birinchi navbatdagi vorislar jumlasiga kiradilar.

Shuningdek, ushbu Kodeksning 1145-moddasiga koʻra merosxoʻr oʻziga tegishi lozim boʻlgan merosni yoki uning bir qismini (ulushini) olish huquqiga, agar u keyinchalik merosdan voz kechmasa, vorislik huquqidan mahrum etilmasa va uni merosxoʻr etib tayinlash toʻgʻrisidagi vasiyat farmoyishi haqiqiy emas deb topilishi natijasida meros olish huquqini yoʻqotmasa, meros ochilgan vaqtdan eʼtiboran ega boʻladi.

Bundan tashqari, mazkur Kodeksning 1150-moddasiga koʻra merosni qabul qilib olgan qonun boʻyicha merosxoʻrlardan istalgan biri merosning taqsimlanishini talab qilishga haqli. Merosni taqsimlash merosxoʻrlarning kelishuviga koʻra oʻzlariga tegishli ulushlarga muvofiq, kelishuvga erishilmagan taqdirda esa sud tartibida amalga oshiriladi.

Yuqoridagilarga koʻra, Oʻzbekiston Respublikasi Fuqarolik protsessual kodeksining 188–191-moddalariga, Fuqarolik kodeksining 1134, 1135, 1145 hamda 1150-moddalariga asosan

SOʻRAYMAN:
Marhum ota-onamning {{uyManzil}} manzilida joylashgan uy-joyiga nisbatan {{farzandlar}}ni teng ulushlarda merosxoʻr deb topib, meros boʻyicha ulushlarimizni belgilab berishingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Meros qoldiruvchilarning oʻlim haqidagi guvohnomalari nusxalari.
3. Qarindoshlikni tasdiqlovchi hujjatlar (tugʻilganlik, nikoh haqidagi guvohnomalar) nusxalari.
4. Uy-joyga boʻlgan huquqni tasdiqlovchi hujjatlar nusxalari.
5. Notariusning notarial harakatni amalga oshirishni rad etish toʻgʻrisidagi qarori.
6. Davlat boji toʻlanganligini tasdiqlovchi hujjat.
7. {{ilova}}
${IMZO}`,
  },
  {
    id: 'merosga-huquqni-tan-olish',
    title: 'Merosga boʻlgan huquqni tan olish toʻgʻrisida daʼvo ariza (merosni qabul qilish muddatini tiklash oʻrniga)',
    short: 'FK 11, 1145, 1146-moddalar. Vasiyat boʻyicha merosxoʻr huquqi nizolashilganda.',
    fields: [...TARAFLAR,
      f('notariusTuri', 'Notarial idora turi', 'davlat notarial idorasi / xususiy notarial idora'),
      f('notariusRaqam', 'Notarial idora raqami', '1'),
      f('notarius', 'Notariusning F.I.O.'),
      f('notariusManzil', 'Notarial idora manzili', MANZIL_IZOH),
      f('notariusTel', 'Notarial idoraning telefon raqami'),
      f('notariusEmail', 'Notarial idoraning pochta (elektron) manzili'),
      f('merosQoldiruvchi', 'Meros qoldiruvchining F.I.O. va daʼvogarga qarindoshligi', 'otam A.A. Aliyev'),
      f('tugilgan', 'Meros qoldiruvchining tugʻilgan sanasi'),
      f('vafot', 'Meros qoldiruvchining vafot etgan sanasi'),
      f('mulk', 'Meros qolgan mol-mulk nomi va manzili', 'uy-joy, ' + MANZIL_IZOH),
      f('vasiyatSana', 'Vasiyatnoma tasdiqlangan sana'),
      f('reyestrRaqam', 'Vasiyatnoma qayd etilgan reyestr raqami'),
      f('holat', 'Javobgarning qarshiligi va notariusning javobi', 'javobgar vasiyatnomaga eʼtiroz bildirib, notariusga ariza bergan; notarius nizo borligi sababli meros huquqi toʻgʻrisida guvohnoma berishni rad etgan', true),
      ILOVA, SANA],
    body: `${sarlavha(`
Mustaqil talab bilan arz qilmaydigan uchinchi shaxs: {{notariusRaqam}}-sonli {{notariusTuri}} notariusi {{notarius}}
Manzili: {{notariusManzil}}
Telefon: {{notariusTel}}
Elektron manzil: {{notariusEmail}}
`)}
DAʼVO ARIZASI
(Merosga boʻlgan huquqni tan olish toʻgʻrisida)

Marhum {{merosQoldiruvchi}} {{tugilgan}}da tugʻilgan boʻlib, {{vafot}}da vafot etgan. U hayoti davomida orttirgan, {{mulk}} manzilida joylashgan oʻziga tegishli mulkni menga vasiyat qilib qoldirgan.

Vasiyatnoma {{notariusRaqam}}-sonli {{notariusTuri}} notariusi {{notarius}} tomonidan {{vasiyatSana}}da rasmiylashtirilib, reyestr kitobiga {{reyestrRaqam}}-son bilan qayd etilgan.

{{merosQoldiruvchi}} vafotidan soʻng merosni rasmiylashtirmoqchi boʻlganimda {{javobgar}} bunga qarshilik koʻrsatmoqda: {{holat}}

Oʻzbekiston Respublikasi Konstitutsiyasining 41-moddasiga koʻra meros huquqi qonun bilan kafolatlanadi.

Fuqarolik kodeksining 1145-moddasiga koʻra merosxoʻr oʻziga tegishi lozim boʻlgan merosni yoki uning bir qismini (ulushini) olish huquqiga, agar u keyinchalik merosdan voz kechmasa, vorislik huquqidan mahrum etilmasa va uni merosxoʻr etib tayinlash toʻgʻrisidagi vasiyat farmoyishi haqiqiy emas deb topilishi natijasida meros olish huquqini yoʻqotmasa, meros ochilgan vaqtdan eʼtiboran ega boʻladi. Men merosdan voz kechmaganman va vorislik huquqidan mahrum etilmaganman.

Fuqarolik kodeksining 1146-moddasiga koʻra meros ochilgan joydagi notarius merosxoʻrning iltimosiga koʻra unga merosga boʻlgan huquqi toʻgʻrisida guvohnoma berishi shart. Biroq merosxoʻrlar oʻrtasida nizo mavjudligi sababli mening huquqim notarial tartibda rasmiylashtirilmayapti.

Fuqarolik kodeksining 11-moddasiga koʻra fuqarolik huquqlari huquqni tan olish yoʻli bilan himoya qilinadi.

Yuqoridagilarga koʻra, Oʻzbekiston Respublikasi Fuqarolik kodeksining 11, 1145, 1146-moddalari hamda Fuqarolik protsessual kodeksining 188–191-moddalari talablariga muvofiq

SOʻRAYMAN:
{{merosQoldiruvchi}}dan qolgan, {{mulk}} manzilida joylashgan mol-mulkka nisbatan mening, {{davogar}}ning, vasiyatnoma boʻyicha merosga boʻlgan huquqimni tan olishingizni.

Ilova:
1. Daʼvo arizasining javobgar va uchinchi shaxs uchun nusxalari.
2. Meros qoldiruvchining oʻlim haqidagi guvohnomasi nusxasi.
3. Vasiyatnoma nusxasi.
4. Meros mol-mulkka boʻlgan huquqni tasdiqlovchi hujjatlar nusxalari.
5. Notariusning javobi (rad etish toʻgʻrisidagi qarori) nusxasi.
6. Davlat boji toʻlanganligini tasdiqlovchi hujjat.
7. {{ilova}}
${IMZO}`,
  },
  {
    id: 'mulkni-talab-qilish',
    title: 'Mol-mulkni boshqa shaxsning noqonuniy egaligidan talab qilish toʻgʻrisida daʼvo ariza',
    short: 'FK 164, 228-moddalar (vindikatsiya). Egallab olingan mulkni qaytarish.',
    fields: [...TARAFLAR,
      f('mulkManzil', 'Javobgar noqonuniy egallab olgan koʻchmas mulk manzili', MANZIL_IZOH),
      f('mulkTuri', 'Koʻchmas mulk turi', 'yashash uyi, savdo doʻkoni yoki boshqa'),
      f('huquqSana', 'Daʼvogarning mulk huquqi vujudga kelgan sana'),
      f('huquqHujjat', 'Mulk huquqi vujudga kelishiga asos boʻlgan hujjat', 'oldi-sotdi shartnomasi, meros guvohnomasi, hokim qarori va hokazo'),
      ILOVA, SANA],
    body: `${sarlavha()}
DAʼVO ARIZASI
(Mol-mulkni boshqa shaxsning noqonuniy egaligidan talab qilib olish toʻgʻrisida)

Javobgar {{javobgar}} menga tegishli boʻlgan, {{mulkManzil}} manzilida joylashgan {{mulkTuri}}ga noqonuniy ravishda kirib olib, undan va uning ichidagi ashyolardan foydalanib kelmoqda. Javobgarga {{mulkTuri}}ni boʻshatib berishini, u mening mulkim ekanligini aytdim. Biroq u mening qonuniy talabimni bajarishdan bosh tortib, mening qonun bilan qoʻriqlanadigan huquq va manfaatlarimni buzib kelmoqda.

Mazkur {{mulkTuri}} {{huquqSana}}dagi {{huquqHujjat}}ga asosan menga mulk huquqi asosida tegishlidir.

Oʻzbekiston Respublikasi Konstitutsiyasining 41-moddasiga koʻra har bir shaxs mulkdor boʻlishga haqli. Konstitutsiyaning 47-moddasiga koʻra esa hech kim sudning qarorisiz va qonunga zid tarzda uy-joyidan mahrum etilishi mumkin emas.

Oʻzbekiston Respublikasi Fuqarolik kodeksining 164-moddasiga koʻra mulk huquqi shaxsning oʻziga qarashli mol-mulkka oʻz xohishi bilan va oʻz manfaatlarini koʻzlab egalik qilish, undan foydalanish va uni tasarruf etish, shuningdek oʻzining mulk huquqini, kim tomonidan boʻlmasin, har qanday buzishni bartaraf etishni talab qilish huquqidan iboratdir. Mulk huquqi muddatsizdir.

Fuqarolik kodeksining 228-moddasiga asosan mulkdor oʻz mol-mulkini boshqa shaxsning qonunsiz egaligidan talab qilib olishga haqli (vindikatsiya).

Oʻzbekiston Respublikasining «Xususiy mulkni himoya qilish va mulkdorlar huquqlarining kafolatlari toʻgʻrisida»gi Qonuni 2-moddasiga koʻra xususiy mulk huquqi shaxsning qonunchilikka muvofiq qoʻlga kiritgan mol-mulkka egalik qilish, undan foydalanish va uni tasarruf etish huquqidir.

Yuqoridagilarga asosan, Oʻzbekiston Respublikasi Fuqarolik kodeksining 164, 228-moddalari hamda Fuqarolik protsessual kodeksining 188–191-moddalariga asoslanib, suddan

SOʻRAYMAN:
Javobgar {{javobgar}}ning noqonuniy egaligida boʻlgan, menga tegishli {{mulkManzil}} manzilida joylashgan {{mulkTuri}}ni va undagi mol-mulklarimni olib berishingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Pasport nusxasi.
3. Mulk huquqini tasdiqlovchi hujjatlar.
4. Davlat boji toʻlanganligi toʻgʻrisida kvitansiya.
5. {{ilova}}
${IMZO}`,
  },
  {
    id: 'tosqinlikni-bartaraf-etish',
    title: 'Mol-mulkdan foydalanish boʻyicha toʻsqinliklarni bartaraf etish haqida daʼvo ariza',
    short: 'FK 231-modda (negator daʼvo). Mulkdan foydalanishga toʻsqinlikni bartaraf etish.',
    fields: [...TARAFLAR,
      f('nikohSana', 'Daʼvogar bilan javobgar nikohdan oʻtgan sana'),
      f('uyManzil', 'Uy-joy manzili', MANZIL_IZOH),
      f('huquqHujjat', 'Uy-joyga mulk huquqi vujudga kelishiga asos boʻlgan hujjat', 'oldi-sotdi shartnomasi, meros guvohnomasi yoki boshqa'),
      f('huquqSana', 'Shu hujjat sanasi'),
      f('ajrimSud', 'Nikohni bekor qilish toʻgʻrisida hal qiluv qarori qabul qilgan sud'),
      f('ajrimSana', 'Hal qiluv qarori sanasi'),
      f('chiqibKetganSana', 'Javobgar uydan chiqib ketgan sana'),
      f('holat', 'Toʻsqinlik nimada ifodalanmoqda', 'javobgar oʻz narsalarini xonada qoldirib, xonani qulflab ketgan; shu sababli men uyning bu qismidan foydalana olmayapman', true),
      ILOVA, SANA],
    body: `${sarlavha()}
DAʼVO ARIZASI
(Mol-mulkdan foydalanish boʻyicha toʻsqinliklarni bartaraf etish haqida)

Men {{nikohSana}}da javobgar {{javobgar}} bilan qonuniy nikohdan oʻtib, turmush qurganmiz.

Biz yashab kelgan, {{uyManzil}} manzilida joylashgan uy-joy {{huquqSana}}dagi {{huquqHujjat}}ga asosan menga tegishli. Javobgar ushbu xonadonga kelin boʻlib tushib, oʻziga tegishli boʻlgan mol-mulklarini ushbu xonadonga olib kelgan. Keyinchalik oʻzaro kelishmovchilik sababli javobgar bilan ajrashishga qaror qildik. {{ajrimSud}}ning {{ajrimSana}}dagi hal qiluv qaroriga asosan oʻrtamizda tuzilgan nikoh bekor qilingan. Javobgar {{chiqibKetganSana}}da uydan chiqib ketgan boʻlib, hozirda boshqa joyda yashaydi.

{{holat}}

Oʻzbekiston Respublikasi Fuqarolik kodeksining 231-moddasiga koʻra mulkdor oʻz huquqlarining har qanday buzilishini, garchi bu buzish egalik qilishdan mahrum etish bilan bogʻliq boʻlmasa ham, bartaraf etishni talab qilishi mumkin (negator daʼvo).

Yuqoridagilarga koʻra, Oʻzbekiston Respublikasi Fuqarolik kodeksining 231-moddasi hamda Fuqarolik protsessual kodeksining 188, 189 va 191-moddalariga asosan

SOʻRAYMAN:
Javobgar {{javobgar}} zimmasiga {{uyManzil}} manzilida turgan mol-mulklarini olib ketish va menga tegishli boʻlgan mulkdan foydalanishimga toʻsqinlik qilmaslik majburiyatini yuklashingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Davlat boji toʻlanganligini tasdiqlovchi hujjat.
3. Pasport nusxasi.
4. Uy-joyga boʻlgan huquqni tasdiqlovchi hujjatlar.
5. Nikohni bekor qilish toʻgʻrisidagi hal qiluv qarori nusxasi.
6. {{ilova}}
${IMZO}`,
  },
];
