// Shikoyat va isteʼmolchi daʼvosi shablonlari — moddalar lex.uz da 2026-10 holatiga tekshirilgan
import type { Shablon } from './shablonlar-data';

const ARIZACHI = [
  { key: 'arizachi', label: 'F.I.Sh. (toʻliq)' },
  { key: 'jshshir', label: 'JShShIR (14 xonali)' },
  { key: 'pasport', label: 'Pasport (ID-karta) seriyasi va raqami' },
  { key: 'manzil', label: 'Yashash manzili' },
  { key: 'tel', label: 'Telefon' },
  { key: 'email', label: 'E-mail' },
];

const ARIZACHI_BLOK = `JShShIR: {{jshshir}}
Pasport: {{pasport}}
Manzil: {{manzil}}
Tel.: {{tel}}
E-mail: {{email}}`;

const SANA = { key: 'sana', label: 'Ariza sanasi', placeholder: '«___» __________ 20__-yil' };

export const SHIKOYAT_SHABLONLAR: Shablon[] = [
  {
    id: 'mehnat-inspeksiya',
    title: 'Davlat mehnat inspeksiyasiga shikoyat',
    short: 'Ish beruvchi mehnat qonunchiligini buzganda (MK 535–536-m.).',
    fields: [
      { key: 'organ', label: 'Inspeksiya (hududiy boʻlinma) nomi', placeholder: 'Davlat mehnat inspeksiyasining Toshkent shahar boshqarmasi' },
      { key: 'rahbar', label: 'Rahbar lavozimi va F.I.Sh.', placeholder: 'boshligʻi A.A. Aliyev' },
      { key: 'organManzil', label: 'Inspeksiya manzili' },
      ...ARIZACHI,
      { key: 'ishBeruvchi', label: 'Ish beruvchi (tashkilot) nomi' },
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
      { key: 'buzilganModdalar', label: 'Buzilgan normalar', placeholder: 'Mehnat kodeksining 106, 217, 253-moddalari' },
      { key: 'oldingiMurojaat', label: 'Ish beruvchiga oldin qilingan murojaat va natijasi', multiline: true, placeholder: '2026-yil 1-oktabrda ish beruvchiga yozma ariza berdim, javob olinmadi.' },
      SANA,
    ],
    body: `{{organ}}
{{rahbar}}ga
Manzil: {{organManzil}}

Arizachi: {{arizachi}}
${ARIZACHI_BLOK}

Ish beruvchi: {{ishBeruvchi}}
Ish beruvchining STIR raqami: {{ishBeruvchiStir}}
Manzil: {{ishBeruvchiManzil}}
Rahbar: {{rahbarIshBeruvchi}}

SHIKOYAT
(ish beruvchi tomonidan mehnat toʻgʻrisidagi qonunchilik buzilganligi toʻgʻrisida)

Men, {{arizachi}}, {{ishgaKirgan}}dan boshlab {{ishBeruvchi}}da (STIR {{ishBeruvchiStir}}) {{lavozim}} lavozimida ishlab kelaman (ishlaganman). Mehnat munosabatlarimiz {{shartnoma}} bilan rasmiylashtirilgan.

Ish beruvchi tomonidan mening mehnat huquqlarim quyidagicha buzilgan:
{{buzilish}}

{{oldingiMurojaat}}

Oʻzbekiston Respublikasi Mehnat kodeksining 21-moddasiga koʻra xodim oʻz vaqtida va toʻliq hajmda ish haqi olish, mehnat shartnomasida shartlashilgan ish bilan taʼminlanish, mehnatni muhofaza qilish talablariga mos ish joyiga ega boʻlish huquqiga ega, 25-moddasiga koʻra esa ish beruvchi mehnat toʻgʻrisidagi qonunchilikka, mehnat shartnomasi shartlariga rioya etishi shart. Yuqorida bayon etilgan harakatlar (harakatsizlik) bilan ish beruvchi {{buzilganModdalar}} talablarini buzgan.

Mehnat kodeksining 535-moddasiga muvofiq Davlat mehnat inspeksiyasi ish beruvchilar tomonidan mehnat toʻgʻrisidagi qonunchilik talablariga rioya etilishi ustidan davlat nazoratini va tekshiruvini amalga oshiradi, 536-moddasiga muvofiq davlat mehnat inspektorlari ish beruvchilarni rejadan tashqari tekshiruvlardan oʻtkazadi va aniqlangan qoidabuzarliklarni bartaraf etish toʻgʻrisida koʻrsatmalar beradi.

Yuqoridagilarga asoslanib, Mehnat kodeksining 21, 25, 535, 536-moddalari hamda “Jismoniy va yuridik shaxslarning murojaatlari toʻgʻrisida”gi Oʻzbekiston Respublikasi Qonunining 6, 28, 32-moddalariga muvofiq,

SOʻRAYMAN:
1. {{ishBeruvchi}} (STIR {{ishBeruvchiStir}}) faoliyatida mehnat toʻgʻrisidagi qonunchilikka rioya etilishi yuzasidan rejadan tashqari tekshiruv oʻtkazilsin.
2. Aniqlangan qoidabuzarliklarni bartaraf etish, jumladan toʻlanmagan ish haqi va boshqa toʻlovlarni Mehnat kodeksining 333-moddasida nazarda tutilgan kompensatsiya bilan birga toʻlash toʻgʻrisida ish beruvchiga koʻrsatma berilsin.
3. Mehnat toʻgʻrisidagi qonunchilikni buzishda aybdor mansabdor shaxslar qonunda belgilangan javobgarlikka tortilsin.
4. Shikoyatni koʻrib chiqish natijalari toʻgʻrisida Qonunning 28-moddasida belgilangan muddatda menga yozma (elektron) javob berilsin.

Ilova:
1. Mehnat shartnomasi (ishga qabul qilish toʻgʻrisidagi buyruq) nusxasi.
2. Mehnat daftarchasidan koʻchirma yoki mehnat faoliyati toʻgʻrisidagi elektron maʼlumotnoma.
3. Ish haqi hisob-kitob varaqalari, bank kartasidan koʻchirma.
4. Ish beruvchiga yuborilgan ariza nusxasi va uning javobi (boʻlsa).
5. Qonunbuzarlikni tasdiqlovchi boshqa hujjatlar (yozishmalar, fotosuratlar, guvohlar roʻyxati).
6. Pasport (ID-karta) nusxasi.

{{sana}}

Arizachi: __________ /{{arizachi}}/`,
  },
  {
    id: 'istemolchi',
    title: 'Sifatsiz tovar uchun pulni qaytarish, neustoyka va maʼnaviy zararni undirish toʻgʻrisida daʼvo arizasi',
    short: 'Isteʼmolchilar huquqlarini himoya qilish. Davlat bojidan ozod (Qonun 29-m.).',
    fields: [
      { key: 'sud', label: 'Sud nomi', placeholder: 'Yunusobod tumanlararo fuqarolik ishlari boʻyicha sudi' },
      { key: 'sudManzil', label: 'Sud manzili' },
      ...ARIZACHI,
      { key: 'javobgar', label: 'Javobgar (sotuvchi) nomi', placeholder: '«Texnomart» MChJ' },
      { key: 'javobgarStir', label: 'Javobgarning STIR raqami' },
      { key: 'javobgarManzil', label: 'Javobgar manzili' },
      { key: 'tovar', label: 'Tovar nomi, modeli, seriya raqami', placeholder: 'Samsung RT-38 muzlatkichi, s/r 0A1B2C3D' },
      { key: 'xaridSana', label: 'Xarid sanasi' },
      { key: 'chek', label: 'Chek / shartnoma raqami va sanasi', placeholder: '2026-yil 5-maydagi 001234-son kassa cheki' },
      { key: 'narx', label: "Toʻlangan summa (soʻm)" },
      { key: 'kafolat', label: 'Kafolat muddati', placeholder: '12 oy' },
      { key: 'nuqsonSana', label: 'Nuqson aniqlangan sana' },
      { key: 'nuqson', label: 'Aniqlangan nuqson tavsifi', multiline: true },
      { key: 'pretenziyaSana', label: 'Pretenziya topshirilgan sana' },
      { key: 'pretenziyaTalab', label: 'Pretenziyadagi talab', placeholder: 'tovarni ayni shunday markali maqbul sifatli tovarga almashtirib berishni' },
      { key: 'pretenziyaJavob', label: 'Sotuvchining javobi', multiline: true, placeholder: 'Pretenziyaga javob berilmadi, talab qondirilmadi.' },
      { key: 'neustoykaKun', label: 'Kechiktirilgan kunlar soni' },
      { key: 'neustoyka', label: "Neustoyka summasi (soʻm) = narx × 1% × kunlar" },
      { key: 'manaviy', label: "Maʼnaviy zarar summasi (soʻm)" },
      { key: 'davoBahosi', label: "Daʼvo bahosi (soʻm) = narx + neustoyka" },
      SANA,
    ],
    body: `{{sud}}ga
Manzil: {{sudManzil}}

Daʼvogar: {{arizachi}}
${ARIZACHI_BLOK}

Javobgar: {{javobgar}}
Javobgarning STIR raqami: {{javobgarStir}}
Manzil: {{javobgarManzil}}

Daʼvo bahosi: {{davoBahosi}} soʻm
Davlat bojidan ozod qilingan (“Isteʼmolchilarning huquqlarini himoya qilish toʻgʻrisida”gi Qonunning 29-moddasi)

DAʼVO ARIZASI
(sifatsiz tovar uchun toʻlangan pulni qaytarish, neustoyka va maʼnaviy zararni undirish toʻgʻrisida)

Men, {{arizachi}}, {{xaridSana}}da javobgar {{javobgar}}dan {{tovar}}ni {{narx}} soʻmga sotib oldim, bu {{chek}} bilan tasdiqlanadi. Tovarga {{kafolat}} kafolat muddati belgilangan.

Kafolat muddati davomida, {{nuqsonSana}}da tovarda quyidagi nuqson aniqlandi:
{{nuqson}}

Nuqson tovar sotilgan paytda menga maʼlum qilinmagan, u tovardan foydalanish qoidalari buzilishi natijasida yuzaga kelmagan.

{{pretenziyaSana}}da javobgarga yozma pretenziya topshirib, {{pretenziyaTalab}} talab qildim. {{pretenziyaJavob}}

“Isteʼmolchilarning huquqlarini himoya qilish toʻgʻrisida”gi Oʻzbekiston Respublikasi Qonuni (bundan buyon matnda — Qonun) 13-moddasining birinchi va ikkinchi qismlariga koʻra nuqsonli tovar sotilganda isteʼmolchi, agar nuqson kafolat muddati mobaynida aniqlangan boʻlsa, oʻz xohishiga qarab tovarni almashtirib berishni, nuqsonlarni bepul bartaraf etishni, narxni kamaytirishni yoki shartnomani bekor qilib, koʻrilgan zararni qoplashni talab qilishga haqli. Bu talablar sotuvchiga qoʻyiladi.

Qonunning 14-moddasiga koʻra sotuvchi nuqsonli tovarni yetti kunlik muddatda, qoʻshimcha tekshirish zarur boʻlganda esa talab qoʻyilgan paytdan eʼtiboran yigirma kun ichida almashtirib berishi shart; ushbu muddatlarning oʻtkazib yuborilgan har bir kuni uchun sotuvchi isteʼmolchiga tovar bahosining bir foizi miqdorida neustoyka (penya) toʻlaydi. Neustoyka hisob-kitobi: {{narx}} soʻm × 1% × {{neustoykaKun}} kun = {{neustoyka}} soʻm.

Qonunning 16-moddasiga koʻra sotuvchi tovarni almashtirib berish yoki nuqsonlarini bartaraf etish talabini bajarmagan boʻlsa, isteʼmolchi shartnomani bekor qilib, yetkazilgan ziyon va maʼnaviy zararni Qonunning 20 va 22-moddalariga muvofiq qoplashni talab qilishga haqli. Fuqarolik kodeksining 434-moddasi ham sifati tegishli darajada boʻlmagan tovar sotilganda sotib oluvchining shu huquqlarini nazarda tutadi.

Javobgarning qonuniy talabimni bajarmaganligi sababli men uzoq vaqt sotib olgan tovarimdan foydalana olmadim, sotuvchiga bir necha bor murojaat qilishga majbur boʻldim va maʼnaviy iztirob chekdim. Qonunning 22-moddasi hamda Fuqarolik kodeksining 1021, 1022-moddalariga muvofiq yetkazilgan maʼnaviy zararni {{manaviy}} soʻm miqdorida baholayman.

Nizoni sudgacha hal qilish choralari koʻrilgan: javobgarga {{pretenziyaSana}}da pretenziya topshirilgan. Daʼvo Qonunning 29-moddasi birinchi qismiga muvofiq daʼvogarning tanloviga koʻra taqdim etilmoqda. Qonunning 29-moddasiga koʻra isteʼmolchi oʻz huquqlarining buzilishi bilan bogʻliq daʼvolar boʻyicha davlat boji toʻlashdan ozod qilinadi.

Yuqoridagilarga asoslanib, “Isteʼmolchilarning huquqlarini himoya qilish toʻgʻrisida”gi Qonunning 13, 14, 16, 22, 29-moddalari, Fuqarolik kodeksining 434, 1021, 1022-moddalari hamda Fuqarolik protsessual kodeksining 189–191-moddalariga muvofiq,

SOʻRAYMAN:
1. Daʼvogar {{arizachi}} va javobgar {{javobgar}} oʻrtasida {{xaridSana}}da tuzilgan {{tovar}} oldi-sotdi shartnomasi bekor qilinsin.
2. Javobgardan daʼvogar foydasiga tovar uchun toʻlangan {{narx}} soʻm undirilsin.
3. Javobgardan daʼvogar foydasiga talabni oʻz vaqtida bajarmaganlik uchun {{neustoyka}} soʻm neustoyka (penya) undirilsin.
4. Javobgardan daʼvogar foydasiga {{manaviy}} soʻm maʼnaviy zarar undirilsin.
5. Sud xarajatlari javobgar zimmasiga yuklatilsin.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Kassa (tovar) cheki yoki oldi-sotdi shartnomasi nusxasi.
3. Kafolat taloni (texnik pasport) nusxasi.
4. Pretenziya nusxasi va uning javobgarga topshirilganini tasdiqlovchi hujjat.
5. Javobgarning javob xati (boʻlsa).
6. Servis markazi dalolatnomasi yoki ekspertiza xulosasi (boʻlsa).
7. Neustoyka hisob-kitobi.
8. Pochta xarajatlari toʻlanganligini tasdiqlovchi kvitansiya.
9. Daʼvogarning pasporti (ID-kartasi) nusxasi.

{{sana}}

Daʼvogar: __________ /{{arizachi}}/`,
  },
];
