// Shikoyat va isteʼmolchi daʼvosi shablonlari — tuzilma “Adolat” markazi Legal Tech (yurxizmat.uz)
// namunalariga (2082, 2658, 2183, 2227, 2566) moslangan; moddalar lex.uz da 2026-10 holatiga tekshirilgan
import type { Shablon } from './shablonlar-data';

const ARIZACHI = [
  { key: 'arizachi', label: 'F.I.Sh. (toʻliq)' },
  { key: 'manzil', label: 'Yashash manzili (viloyat, tuman, mahalla, koʻcha, uy)' },
  { key: 'jshshir', label: 'JShShIR (14 xonali)' },
  { key: 'tel', label: 'Telefon' },
  { key: 'email', label: 'Elektron pochta manzili' },
];

const ALOQA_BLOK = `JShShIR: {{jshshir}}
Telefon: {{tel}}
Elektron pochta manzili: {{email}}`;

const SANA = { key: 'sana', label: 'Ariza sanasi', placeholder: '«___» __________ 20__-yil' };

export const SHIKOYAT_SHABLONLAR: Shablon[] = [
  {
    id: 'mehnat-inspeksiya',
    title: 'Davlat mehnat inspeksiyasiga shikoyat',
    short: 'Ish beruvchi mehnat qonunchiligini buzganda (MK 535–536-m.).',
    fields: [
      { key: 'organ', label: 'Inspeksiya (hududiy boʻlinma) nomi', placeholder: 'Kambagʻallikni qisqartirish va bandlik vazirligi Davlat mehnat inspeksiyasining Toshkent shahar boʻlinmasi' },
      { key: 'rahbar', label: 'Rahbar lavozimi va F.I.Sh.', placeholder: 'boshligʻi A.A. Aliyev' },
      { key: 'organManzil', label: 'Inspeksiya manzili' },
      ...ARIZACHI,
      { key: 'ishBeruvchi', label: 'Ish beruvchi (tashkilot) nomi va tashkiliy-huquqiy shakli', placeholder: '«Nur» MChJ' },
      { key: 'ishBeruvchiStir', label: 'Ish beruvchining STIR raqami' },
      { key: 'ishBeruvchiManzil', label: 'Ish beruvchi manzili' },
      { key: 'rahbarIshBeruvchi', label: 'Ish beruvchi rahbari F.I.Sh.' },
      { key: 'lavozim', label: 'Lavozimingiz' },
      { key: 'ishgaKirgan', label: 'Ishga qabul qilingan sana' },
      { key: 'shartnoma', label: 'Mehnat shartnomasi / buyruq raqami va sanasi', placeholder: '2024-yil 1-martdagi 15-son mehnat shartnomasi' },
      {
        key: 'buzilish', label: 'Qonunbuzarliklar roʻyxati (har biri yangi qatordan)', multiline: true,
        placeholder: '1) 2026-yil iyul–sentyabr oylari uchun ish haqi (jami ______ soʻm) toʻlanmagan;\n2) mehnat shartnomasi yozma shaklda rasmiylashtirilmagan;\n3) har yilgi mehnat taʼtili berilmagan.',
      },
      { key: 'buzilganModdalar', label: 'Buzilgan normalar', placeholder: 'Mehnat kodeksining 253, 333-moddalari' },
      { key: 'oldingiMurojaat', label: 'Ish beruvchiga oldin qilingan murojaat va natijasi', multiline: true, placeholder: '2026-yil 1-oktabrda ish beruvchiga yozma ariza berdim, javob olinmadi.' },
      SANA,
    ],
    body: `{{organ}}
{{rahbar}}ga
Manzil: {{organManzil}}

Fuqaro {{arizachi}}dan
Manzil: {{manzil}}
${ALOQA_BLOK}

Ish beruvchi: {{ishBeruvchi}}
STIR: {{ishBeruvchiStir}}
Manzil: {{ishBeruvchiManzil}}
Rahbar: {{rahbarIshBeruvchi}}

SHIKOYAT
(ish beruvchi tomonidan mehnat toʻgʻrisidagi qonunchilik buzilganligi toʻgʻrisida)

Men, {{arizachi}}, {{ishgaKirgan}}dan boshlab {{ishBeruvchi}}da (STIR {{ishBeruvchiStir}}) {{lavozim}} lavozimida ishlab kelaman (ishlaganman). Mehnat munosabatlarimiz {{shartnoma}} bilan rasmiylashtirilgan.

Biroq ish beruvchi tomonidan mening mehnat huquqlarim quyidagicha buzilgan:
{{buzilish}}

{{oldingiMurojaat}}

Oʻzbekiston Respublikasi Mehnat kodeksining 21-moddasiga koʻra xodim mehnat shartnomasida shartlashilgan ish bilan taʼminlanish, oʻz vaqtida hamda toʻliq hajmda ish haqi olish, mehnatni muhofaza qilish talablariga mos keladigan ish joyiga ega boʻlish huquqiga ega. Kodeksning 25-moddasiga koʻra ish beruvchi mehnat toʻgʻrisidagi qonunchilikka, mehnat haqidagi boshqa huquqiy hujjatlarga va mehnat shartnomasi shartlariga rioya etishi, xodimlarga ish haqini belgilangan muddatlarda toʻlashi shart. Yuqorida bayon etilgan harakatlar (harakatsizlik) bilan ish beruvchi {{buzilganModdalar}} talablarini buzgan.

Mehnat kodeksining 535-moddasiga muvofiq Kambagʻallikni qisqartirish va bandlik vazirligining Davlat mehnat inspeksiyasi ish beruvchilar tomonidan mehnat toʻgʻrisidagi qonunchilikka rioya etilishi ustidan davlat nazoratini amalga oshiradi. Kodeksning 536-moddasiga muvofiq davlat mehnat inspektorlari ish beruvchilarni rejali hamda rejadan tashqari tekshiruvlardan oʻtkazadi; aniqlangan qoidabuzarliklarni bartaraf etish toʻgʻrisidagi koʻrsatmalarning ish beruvchi tomonidan bajarilishi ham tekshirish predmeti hisoblanadi.

Yuqoridagilarga asoslanib, Oʻzbekiston Respublikasi Mehnat kodeksining 21, 25, 535, 536-moddalari hamda “Jismoniy va yuridik shaxslarning murojaatlari toʻgʻrisida”gi Oʻzbekiston Respublikasi Qonunining 6, 28, 32-moddalariga muvofiq,

SOʻRAYMAN:
1. {{ishBeruvchi}} (STIR {{ishBeruvchiStir}}) faoliyatida mehnat toʻgʻrisidagi qonunchilikka rioya etilishi yuzasidan rejadan tashqari tekshiruv oʻtkazilsin.
2. Aniqlangan qoidabuzarliklarni bartaraf etish, jumladan toʻlanmagan ish haqi va boshqa toʻlovlarni Mehnat kodeksining 333-moddasida nazarda tutilgan kechiktirilgan har bir kun uchun kompensatsiya bilan birga toʻlash toʻgʻrisida ish beruvchiga koʻrsatma berilsin.
3. Mehnat toʻgʻrisidagi qonunchilikni buzishda aybdor mansabdor shaxslar qonunda belgilangan javobgarlikka tortilsin.
4. Shikoyatni koʻrib chiqish natijalari toʻgʻrisida “Jismoniy va yuridik shaxslarning murojaatlari toʻgʻrisida”gi Qonunning 28-moddasida belgilangan muddatda menga yozma (elektron) javob berilsin.

Ilova:
1. Mehnat shartnomasi (ishga qabul qilish toʻgʻrisidagi buyruq) nusxasi.
2. Mehnat faoliyati toʻgʻrisidagi elektron maʼlumotnoma yoki mehnat daftarchasidan koʻchirma.
3. Ish haqi hisob-kitob varaqalari, bank kartasidan koʻchirma.
4. Ish beruvchiga yuborilgan ariza nusxasi va uning javobi (boʻlsa).
5. Qonunbuzarlikni tasdiqlovchi boshqa hujjatlar (yozishmalar, fotosuratlar, guvohlar roʻyxati).
6. Pasport (ID-karta) nusxasi.

Fuqaro {{arizachi}}
_____________
(imzo)
{{sana}}`,
  },
  {
    id: 'istemolchi',
    title: 'Sifatsiz tovar uchun pulni qaytarish, neustoyka va maʼnaviy zararni undirish toʻgʻrisida daʼvo arizasi',
    short: 'Isteʼmolchilar huquqlarini himoya qilish. Davlat bojidan ozod (Qonun 29-m.).',
    fields: [
      { key: 'sud', label: 'Sud nomi', placeholder: 'Yunusobod tumanlararo fuqarolik ishlari boʻyicha sudi' },
      { key: 'sudManzil', label: 'Sud manzili' },
      ...ARIZACHI,
      { key: 'javobgar', label: 'Javobgar (sotuvchi): YaTT F.I.Sh. yoki yuridik shaxs nomi va tashkiliy-huquqiy shakli', placeholder: '«Texnomart» MChJ' },
      { key: 'javobgarStir', label: 'Javobgarning STIR raqami' },
      { key: 'javobgarManzil', label: 'Javobgar manzili' },
      { key: 'javobgarTel', label: 'Javobgarning telefon raqami' },
      { key: 'tovar', label: 'Tovar nomi, rusumi (modeli), seriya raqami', placeholder: 'Samsung RT-38 muzlatkichi, s/r 0A1B2C3D' },
      { key: 'xaridSana', label: 'Xarid sanasi' },
      { key: 'chek', label: 'Chek / shartnoma raqami va sanasi', placeholder: '2026-yil 5-maydagi 001234-son kassa cheki' },
      { key: 'narx', label: "Toʻlangan summa (soʻm)" },
      { key: 'kafolat', label: 'Kafolat muddati', placeholder: '12 oy' },
      { key: 'nuqsonSana', label: 'Nuqson aniqlangan sana' },
      { key: 'nuqson', label: 'Aniqlangan nuqson tavsifi', multiline: true },
      { key: 'pretenziyaSana', label: 'Pretenziya topshirilgan sana' },
      { key: 'pretenziyaTalab', label: 'Pretenziyadagi talab', placeholder: 'tovarni ayni shunday markali (modelli) maqbul sifatli tovarga almashtirib berishni' },
      { key: 'pretenziyaJavob', label: 'Sotuvchining javobi', multiline: true, placeholder: 'Pretenziyaga javob berilmadi, talab qondirilmadi.' },
      { key: 'neustoykaKun', label: 'Almashtirish muddati oʻtkazib yuborilgan kunlar soni' },
      { key: 'neustoyka', label: "Neustoyka summasi (soʻm) = narx × 1% × kunlar" },
      { key: 'manaviy', label: "Maʼnaviy zarar summasi (soʻm, raqam va soʻz bilan)" },
      { key: 'davoBahosi', label: "Daʼvo bahosi (soʻm) = narx + neustoyka" },
      SANA,
    ],
    body: `{{sud}}ga
Manzil: {{sudManzil}}

Daʼvogar: {{manzil}}da yashovchi
{{arizachi}}
${ALOQA_BLOK}

Javobgar: {{javobgar}}
STIR: {{javobgarStir}}
Manzil: {{javobgarManzil}}
Telefon: {{javobgarTel}}

Daʼvo mazmuni: sifatsiz tovar uchun toʻlangan pulni qaytarish, neustoyka va maʼnaviy zararni undirish
Daʼvo bahosi: {{davoBahosi}} soʻm
Davlat bojidan ozod (“Isteʼmolchilarning huquqlarini himoya qilish toʻgʻrisida”gi Qonunning 29-moddasi)

DAʼVO ARIZASI
(sifatsiz tovar uchun toʻlangan pulni qaytarish, neustoyka va maʼnaviy zararni undirish toʻgʻrisida)

Men, {{arizachi}}, {{xaridSana}} kuni javobgar {{javobgar}}dan {{tovar}}ni {{narx}} soʻmga sotib oldim, bu {{chek}} bilan tasdiqlanadi. Javobgar tovarga {{kafolat}} kafolat muddati bergan va tovarning texnik pasportiga (kafolat taloniga) imzo qoʻyib, muhr bosib bergan.

Biroq kafolat muddati davomida, {{nuqsonSana}} kuni tovarda quyidagi nuqsonlar aniqlandi:
{{nuqson}}

Nuqsonlar tovar sotilgan paytda menga maʼlum qilinmagan, ular tovardan foydalanish qoidalari buzilishi natijasida yuzaga kelmagan.

{{pretenziyaSana}} kuni javobgarga yozma pretenziya topshirib, {{pretenziyaTalab}} talab qildim. {{pretenziyaJavob}}

“Isteʼmolchilarning huquqlarini himoya qilish toʻgʻrisida”gi Oʻzbekiston Respublikasi Qonuni (bundan buyon matnda — Qonun) 13-moddasiga koʻra nuqsonli tovar sotilganda isteʼmolchi, agar bu hol shartnoma tuzish paytida aytib oʻtilmagan boʻlsa va nuqson kafolat muddati mobaynida aniqlangan boʻlsa, oʻz xohishiga qarab tovarni ayni shunday markali (modelli, artikulli) maqbul sifatli tovarga almashtirib berishni, nuqsonlarni bepul bartaraf etishni, xarid narxini mutanosib ravishda kamaytirishni yoki shartnomani bekor qilib, koʻrilgan zararni qoplashni talab qilishga haqli. Bu talablar sotuvchiga qoʻyiladi. Oʻzbekiston Respublikasi Fuqarolik kodeksining 434-moddasi ham sifati tegishli darajada boʻlmagan tovar sotilganda sotib oluvchining shu huquqlarini nazarda tutadi.

Qonunning 14-moddasiga koʻra sotuvchi nuqsonli tovarni yetti kunlik muddatda, tovar sifatini qoʻshimcha tekshirish zarur boʻlganda esa isteʼmolchi talab qoʻygan paytdan eʼtiboran yigirma kun ichida almashtirib berishi shart; ushbu muddatlarning oʻtkazib yuborilgan har bir kuni uchun sotuvchi isteʼmolchiga tovar bahosining bir foizi miqdorida neustoyka (penya) toʻlaydi. Neustoyka hisob-kitobi: {{narx}} soʻm × 1% × {{neustoykaKun}} kun = {{neustoyka}} soʻm.

Qonunning 16-moddasiga koʻra sotuvchi tovarni almashtirib berish yoki nuqsonlarini bartaraf etish talabini bajarmagan boʻlsa, isteʼmolchi shartnomani bekor qilib, yetkazilgan ziyon va maʼnaviy zararni Qonunning 20 va 22-moddalariga muvofiq qoplashni talab qilishga haqli.

Javobgarning qonuniy talabimni bajarmaganligi sababli men uzoq vaqt sotib olgan tovarimdan foydalana olmadim, bir necha bor murojaat qilishga majbur boʻldim va maʼnaviy iztirob chekdim. Qonunning 4-moddasiga koʻra isteʼmolchi sotuvchining gʻayriqonuniy harakati (harakatsizligi) tufayli yetkazilgan maʼnaviy zararning toʻliq hajmda qoplanishini talab qilishga haqli. Qonunning 22-moddasiga koʻra isteʼmolchining huquqlari buzilishi tufayli yetkazilgan maʼnaviy zarar uchun aybdor shaxs mulkiy ziyon qoplanishidan qatʼi nazar haq toʻlaydi. Fuqarolik kodeksining 1021-moddasiga koʻra maʼnaviy zarar uni yetkazuvchining aybi boʻlgan taqdirda qoplanadi, 1022-moddasiga koʻra esa pul bilan qoplanadi. Yetkazilgan maʼnaviy zararni {{manaviy}} soʻm miqdorida baholayman.

Nizoni sudgacha hal qilish choralari koʻrilgan: javobgarga {{pretenziyaSana}} kuni pretenziya topshirilgan. Daʼvo Qonunning 29-moddasi birinchi qismiga muvofiq daʼvogarning tanloviga koʻra taqdim etilmoqda. Qonunning 29-moddasi ikkinchi qismiga koʻra isteʼmolchi oʻz huquqlarining buzilishi bilan bogʻliq daʼvolar boʻyicha davlat boji toʻlashdan ozod qilinadi.

Yuqoridagilarga asoslanib, “Isteʼmolchilarning huquqlarini himoya qilish toʻgʻrisida”gi Qonunning 4, 13, 14, 16, 22, 29-moddalari, Fuqarolik kodeksining 434, 1021, 1022-moddalari hamda Fuqarolik protsessual kodeksining 188–191-moddalariga asosan,

SOʻRAYMAN:
1. Daʼvogar {{arizachi}} va javobgar {{javobgar}} oʻrtasida {{xaridSana}} kuni tuzilgan {{tovar}} oldi-sotdi shartnomasi bekor qilinsin.
2. Javobgardan daʼvogar foydasiga tovar uchun toʻlangan {{narx}} soʻm undirilsin.
3. Javobgardan daʼvogar foydasiga tovarni almashtirish muddatini oʻtkazib yuborganlik uchun {{neustoyka}} soʻm neustoyka (penya) undirilsin.
4. Javobgardan daʼvogar foydasiga {{manaviy}} soʻm maʼnaviy zarar undirilsin.
5. Sud xarajatlari javobgar zimmasiga yuklatilsin.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Kassa (tovar) cheki yoki oldi-sotdi shartnomasi nusxasi.
3. Tovarning texnik pasporti (kafolat taloni) nusxasi.
4. Pretenziya nusxasi va uning javobgarga topshirilganini tasdiqlovchi hujjat.
5. Javobgarning javob xati (boʻlsa).
6. Servis markazi dalolatnomasi, mutaxassis yoki ekspertiza xulosasi (boʻlsa).
7. Neustoyka hisob-kitobi.
8. Pochta xarajatlari toʻlanganligini tasdiqlovchi kvitansiya.
9. Pasport (ID-karta) nusxasi.

Daʼvogar {{arizachi}}
_____________
(imzo)
{{sana}}`,
  },
];
