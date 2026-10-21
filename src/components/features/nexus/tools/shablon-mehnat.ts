// Mehnat nizolari bo'yicha da'vo arizalari (ishga tiklash, ish haqi).
// Moddalar lex.uz da tekshirilgan: Mehnat kodeksi — https://lex.uz/uz/acts/6257288,
// FPK — https://lex.uz/uz/acts/3517337 (189 — mazmuni, 190 — nusxalar, 191 — ilovalar).
import type { Field, Shablon } from './shablonlar-data';

const f = (key: string, label: string, placeholder?: string, multiline?: boolean): Field =>
  ({ key, label, placeholder, multiline });

const TARAFLAR: Field[] = [
  f('sud', 'Sud nomi', 'Fuqarolik ishlari boʻyicha Yunusobod tumanlararo sudi'),
  f('davogar', 'Daʼvogar F.I.Sh.'),
  f('davogarTugilgan', 'Daʼvogarning tugʻilgan sanasi', '01.01.1990'),
  f('davogarJshshir', 'Daʼvogarning JShShIR', '14 xonali raqam'),
  f('davogarPasport', 'Pasport (ID-karta) seriyasi va raqami', 'AD 1234567'),
  f('davogarManzil', 'Daʼvogarning yashash manzili'),
  f('davogarTel', 'Daʼvogarning telefoni', '+998 90 123 45 67'),
  f('javobgar', 'Javobgar (ish beruvchi) nomi', '«Namuna» MChJ'),
  f('javobgarStir', 'Javobgarning STIR', '9 xonali raqam'),
  f('javobgarManzil', 'Javobgarning manzili'),
  f('javobgarRahbar', 'Javobgar rahbari F.I.Sh.'),
  f('davoBahosi', 'Daʼvo bahosi (pul talablari jami, soʻm)'),
];

const ISH: Field[] = [
  f('lavozim', 'Lavozim'),
  f('ishgaKirgan', 'Ishga qabul qilingan sana', '01.03.2022'),
  f('qabulBuyruq', 'Ishga qabul qilish buyrugʻi raqami va sanasi', '15-k, 01.03.2022'),
  f('oylik', 'Oʻrtacha oylik ish haqi (soʻm)'),
];

const SANA = f('sana', 'Ariza sanasi', new Date().toLocaleDateString('uz-UZ'));

const sarlavha = (nom: string) => `{{sud}}ga

Daʼvogar: {{davogar}}
Tugʻilgan sana: {{davogarTugilgan}}
JShShIR: {{davogarJshshir}}
Pasport: {{davogarPasport}}
Yashash manzili: {{davogarManzil}}
Telefon: {{davogarTel}}

Javobgar: {{javobgar}}
STIR: {{javobgarStir}}
Manzili: {{javobgarManzil}}
Rahbari: {{javobgarRahbar}}

Daʼvo bahosi: {{davoBahosi}} soʻm
Davlat bojidan ozod qilingan (Oʻzbekiston Respublikasi Mehnat kodeksining 562-moddasi)

DAʼVO ARIZASI
(${nom})
`;

const IMZO = `
Sana: {{sana}}

Daʼvogar: __________ /{{davogar}}/`;

export const MEHNAT_SHABLONLAR: Shablon[] = [
  {
    id: 'ishga-tiklash',
    title: 'Ishga tiklash, majburiy progul uchun oʻrtacha ish haqi va maʼnaviy zararni undirish toʻgʻrisida daʼvo arizasi',
    short: 'Mehnat kodeksi 561, 565-moddalar. Noqonuniy ishdan boʻshatilganda (muddat — 3 oy).',
    fields: [...TARAFLAR, ...ISH,
      f('buyruqRaqam', 'Boʻshatish buyrugʻi raqami', '27-k'),
      f('buyruqSana', 'Boʻshatish buyrugʻi sanasi', '10.09.2026'),
      f('boshatilganSana', 'Ishdan boʻshatilgan sana (oxirgi ish kuni)', '10.09.2026'),
      f('buyruqTopshirilgan', 'Buyruq nusxasi qoʻlga olingan sana', '10.09.2026'),
      f('asos', 'Buyruqda koʻrsatilgan boʻshatish asosi', 'Mehnat kodeksi 161-moddasi birinchi qismi 2-bandi'),
      f('holat', 'Boʻshatish nega gʻayriqonuniy (faktlar, buzilgan tartib)', undefined, true),
      f('progulKunlari', 'Majburiy progul ish kunlari soni (daʼvo kunigacha)'),
      f('progulSumma', 'Majburiy progul uchun hisoblangan summa (soʻm)'),
      f('manaviyZarar', 'Maʼnaviy zarar summasi (soʻm)'),
      f('manaviyHolat', 'Maʼnaviy zarar nimada ifodalangan', 'daromad manbaidan mahrum boʻlish, ruhiy iztirob, oila taʼminoti qiyinlashuvi', true),
      SANA],
    body: `${sarlavha('ishga tiklash, majburiy progul vaqti uchun oʻrtacha ish haqini va maʼnaviy zararni undirish toʻgʻrisida')}
Men, {{davogar}}, javobgar — {{javobgar}}ning {{qabulBuyruq}}-sonli buyrugʻiga asosan {{ishgaKirgan}}dan eʼtiboran {{lavozim}} lavozimida mehnat shartnomasi asosida ishlab kelganman. Mening oʻrtacha oylik ish haqim {{oylik}} soʻmni tashkil etgan.

Javobgarning {{buyruqSana}}dagi {{buyruqRaqam}}-sonli buyrugʻi bilan men bilan tuzilgan mehnat shartnomasi {{asos}} asosida {{boshatilganSana}}dan bekor qilingan. Buyruqning nusxasi menga {{buyruqTopshirilgan}}da topshirilgan.

Mehnat shartnomasining bekor qilinishini qonunga xilof deb hisoblayman, chunki: {{holat}}

Oʻzbekiston Respublikasi Mehnat kodeksining 561-moddasi birinchi qismiga koʻra mehnat shartnomasi qonuniy asossiz bekor qilingan hollarda yakka tartibdagi mehnat nizosini koʻrib chiquvchi organ xodimni avvalgi ishiga tiklaydi; mazkur moddaning uchinchi qismiga koʻra sud xodimga majburiy progulning butun vaqti uchun oʻrtacha ish haqini toʻlash toʻgʻrisida qaror qabul qiladi. Oʻrtacha ish haqi Mehnat kodeksining 257-moddasida belgilangan tartibda hisoblanadi. Ishdan boʻshatilgan kundan daʼvo berilgan kungacha majburiy progul {{progulKunlari}} ish kunini tashkil etib, uning uchun {{progulSumma}} soʻm toʻlanishi lozim (hisob-kitob ilova qilinadi). Ushbu summa hal qiluv qarori chiqarilgan kunga qadar qayta hisoblanishi lozim.

Javobgarning gʻayriqonuniy harakatlari natijasida menga maʼnaviy zarar yetkazildi: {{manaviyHolat}}. Mehnat kodeksining 335 va 565-moddalariga koʻra ish beruvchining gʻayriqonuniy harakatlari tufayli xodimga yetkazilgan maʼnaviy zarar pul shaklida kompensatsiya qilinadi, uning miqdori sud tomonidan belgilanadi. Yetkazilgan maʼnaviy zararni {{manaviyZarar}} soʻm miqdorida baholayman.

Mehnat kodeksining 558-moddasi birinchi qismi 2- va 4-bandlariga koʻra ishga tiklash, majburiy progul vaqti uchun haq toʻlash va maʼnaviy zararni kompensatsiya qilish toʻgʻrisidagi nizolar bevosita sudda koʻrib chiqiladi. Daʼvo Mehnat kodeksining 560-moddasida belgilangan, buyruq nusxasi topshirilgan kundan eʼtiboran uch oylik muddatda berilmoqda. Fuqarolik protsessual kodeksining 34-moddasiga muvofiq mehnat huquqlarini tiklash toʻgʻrisidagi daʼvo daʼvogarning yashash joyidagi sudga ham berilishi mumkin. Mehnat kodeksining 562-moddasiga koʻra xodim yakka tartibdagi mehnat munosabatlaridan kelib chiqadigan talablar boʻyicha sud xarajatlaridan ozod qilinadi.

Yuqoridagilarga asosan, Oʻzbekiston Respublikasi Mehnat kodeksining 257, 335, 558, 560, 561, 562, 565-moddalari, Fuqarolik protsessual kodeksining 188–191, 266-moddalariga amal qilib,

SOʻRAYMAN:
1. Javobgar {{javobgar}}ning {{buyruqSana}}dagi {{buyruqRaqam}}-sonli buyrugʻi gʻayriqonuniy deb topilsin va bekor qilinsin.
2. {{davogar}} {{javobgar}}dagi avvalgi {{lavozim}} lavozimiga {{boshatilganSana}}dan eʼtiboran ishga tiklansin.
3. Javobgardan {{davogar}} foydasiga majburiy progulning butun vaqti uchun oʻrtacha ish haqi (daʼvo berilgan kunga {{progulSumma}} soʻm, hal qiluv qarori chiqarilgan kunga qadar qayta hisoblangan holda) undirilsin.
4. Javobgardan {{davogar}} foydasiga maʼnaviy zarar uchun {{manaviyZarar}} soʻm kompensatsiya undirilsin.
5. Hal qiluv qarorining ishga tiklash va uch oylik ish haqidan ortiq boʻlmagan ish haqini undirish qismi Fuqarolik protsessual kodeksining 266-moddasi 2- va 4-bandlariga muvofiq darhol ijroga qaratilsin.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Daʼvogarning pasporti (ID-kartasi) nusxasi.
3. Mehnat shartnomasi nusxasi.
4. Ishga qabul qilish toʻgʻrisidagi {{qabulBuyruq}}-sonli buyruq nusxasi.
5. Mehnat shartnomasini bekor qilish toʻgʻrisidagi {{buyruqRaqam}}-sonli buyruq nusxasi.
6. Elektron mehnat daftarchasidan koʻchirma (mehnat daftarchasi nusxasi).
7. Oʻrtacha ish haqi toʻgʻrisida maʼlumotnoma.
8. Majburiy progul uchun undiriladigan summaning hisob-kitobi.
9. Maʼnaviy zararni tasdiqlovchi hujjatlar (mavjud boʻlsa).
${IMZO}`,
  },
  {
    id: 'ish-haqi',
    title: 'Toʻlanmagan ish haqini va kechiktirilgan har bir kun uchun kompensatsiyani undirish toʻgʻrisida daʼvo arizasi',
    short: 'Mehnat kodeksi 253, 333-moddalar. Ish haqi toʻlanmaganda (muddat — 6 oy).',
    fields: [...TARAFLAR, ...ISH,
      f('mehnatHolati', 'Mehnat munosabatlari holati', 'hozirda ham ishlayman / 10.09.2026 dan ishdan boʻshatilganman'),
      f('davr', 'Ish haqi toʻlanmagan davr', '2026-yil mart – iyun'),
      f('summa', 'Toʻlanmagan ish haqi summasi (soʻm)'),
      f('tolovMuddati', 'Ish haqi toʻlanishi lozim boʻlgan sana (birinchi kechikish)', '10.04.2026'),
      f('kechikishKunlari', 'Kechiktirilgan kunlar soni (daʼvo kunigacha)'),
      f('stavka', 'Markaziy bank qayta moliyalash stavkasi (%)'),
      f('kompensatsiya', 'Kechiktirish uchun kompensatsiya summasi (soʻm)'),
      f('holat', 'Qoʻshimcha holatlar (ish beruvchiga murojaatlar va h.k.)', undefined, true),
      SANA],
    body: `${sarlavha('toʻlanmagan ish haqini va uni kechiktirganlik uchun pulli kompensatsiyani undirish toʻgʻrisida')}
Men, {{davogar}}, javobgar — {{javobgar}}ning {{qabulBuyruq}}-sonli buyrugʻiga asosan {{ishgaKirgan}}dan eʼtiboran {{lavozim}} lavozimida mehnat shartnomasi asosida ishlab kelganman ({{mehnatHolati}}). Mening oʻrtacha oylik ish haqim {{oylik}} soʻmni tashkil etadi.

Javobgar {{davr}} davri uchun menga hisoblangan ish haqini toʻlamagan, uning qarzi jami {{summa}} soʻmni tashkil etadi. Ish haqi {{tolovMuddati}}dan buyon kechiktirilmoqda.

{{holat}}

Oʻzbekiston Respublikasi Mehnat kodeksining 253-moddasiga koʻra ish haqi belgilangan muddatlarda, har yarim oyda bir martadan kam boʻlmagan holda toʻlanishi shart, ish beruvchi ish haqini toʻlash kechiktirilganligi uchun xodim oldida Kodeksning 333-moddasida belgilangan miqdorda moddiy javobgar boʻladi. Mehnat shartnomasi bekor qilingan hollarda Mehnat kodeksining 254-moddasiga koʻra barcha summalar mehnat shartnomasi bekor qilingan kuni toʻlanishi lozim.

Mehnat kodeksining 333-moddasiga koʻra ish beruvchi ish haqini toʻlash muddatini buzgan taqdirda uni toʻlov muddatidan keyingi kundan eʼtiboran haqiqatda hisob-kitob qilingan kunni oʻz ichiga olgan muddatgacha har bir kechiktirilgan kun uchun foizlar (pulli kompensatsiya) bilan birga toʻlashi shart; kompensatsiya miqdori Markaziy bank qayta moliyalash stavkasining oʻn foizi miqdorida belgilanadi. Qayta moliyalash stavkasi {{stavka}} foiz, kechiktirilgan kunlar soni {{kechikishKunlari}} kun boʻlib, kompensatsiya daʼvo berilgan kunga {{kompensatsiya}} soʻmni tashkil etadi (hisob-kitob ilova qilinadi).

Mehnat kodeksining 558-moddasiga koʻra mazkur nizo bevosita sudda koʻrib chiqiladi. Daʼvo Mehnat kodeksining 560-moddasida belgilangan olti oylik muddatda berilmoqda. Mehnat kodeksining 562-moddasiga koʻra xodim yakka tartibdagi mehnat munosabatlaridan kelib chiqadigan talablar boʻyicha sud xarajatlaridan ozod qilinadi.

Yuqoridagilarga asosan, Oʻzbekiston Respublikasi Mehnat kodeksining 253, 254, 333, 558, 560, 562-moddalari, Fuqarolik protsessual kodeksining 188–191, 266-moddalariga amal qilib,

SOʻRAYMAN:
1. Javobgar {{javobgar}}dan {{davogar}} foydasiga {{davr}} davri uchun toʻlanmagan ish haqi {{summa}} soʻm undirilsin.
2. Javobgardan {{davogar}} foydasiga ish haqini kechiktirganlik uchun Mehnat kodeksining 333-moddasiga muvofiq pulli kompensatsiya {{kompensatsiya}} soʻm (haqiqiy hisob-kitob kunigacha qayta hisoblangan holda) undirilsin.
3. Hal qiluv qarorining uch oylik ish haqidan ortiq boʻlmagan ish haqini undirish qismi Fuqarolik protsessual kodeksining 266-moddasi 2-bandiga muvofiq darhol ijroga qaratilsin.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Daʼvogarning pasporti (ID-kartasi) nusxasi.
3. Mehnat shartnomasi nusxasi.
4. Ishga qabul qilish toʻgʻrisidagi {{qabulBuyruq}}-sonli buyruq nusxasi.
5. Ish haqi qarzdorligi toʻgʻrisida maʼlumotnoma (hisob varaqalari, bank koʻchirmasi).
6. Toʻlanmagan ish haqi va kompensatsiya hisob-kitobi.
7. Ish beruvchiga yozilgan murojaatlar nusxalari (mavjud boʻlsa).
${IMZO}`,
  },
];
