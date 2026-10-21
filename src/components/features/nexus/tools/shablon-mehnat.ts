// Mehnat nizolari bo'yicha da'vo arizalari (ishga tiklash, ish haqi).
// Tuzilma Adliya vazirligi "Adolat" markazi Legal Tech namunalariga mos (yurxizmat.uz/oz/document/24, 43, 2566, 2571).
// Moddalar lex.uz da tekshirilgan: Mehnat kodeksi — https://lex.uz/uz/acts/6257288,
// FPK — https://lex.uz/uz/acts/3517337 (189 — mazmuni, 190 — nusxalar, 191 — ilovalar, 266 — darhol ijro).
import type { Field, Shablon } from './shablonlar-data';

const f = (key: string, label: string, placeholder?: string, multiline?: boolean): Field =>
  ({ key, label, placeholder, multiline });

// FPK 189-modda: sud, taraflar, rekvizitlar; telefon va elektron manzil — ixtiyoriy, lekin namunalarda bor.
const TARAFLAR: Field[] = [
  f('sud', 'Sud nomi', 'Fuqarolik ishlari boʻyicha Yunusobod tumanlararo sudi'),
  f('davogar', 'Daʼvogar F.I.O.'),
  f('davogarManzil', 'Daʼvogarning yashash manzili'),
  f('davogarTel', 'Daʼvogarning telefon raqami', '+998 90 123 45 67'),
  f('davogarEmail', 'Daʼvogarning elektron manzili', 'ism@mail.uz'),
  f('javobgar', 'Javobgar (ish beruvchi) yuridik shaxsning toʻliq nomi', '«Namuna» masʼuliyati cheklangan jamiyati'),
  f('javobgarManzil', 'Javobgarning manzili'),
  f('javobgarHr', 'Javobgarning hisob raqami (h/r)', '20208000...'),
  f('javobgarStir', 'Javobgarning STIR', '9 xonali raqam'),
  f('javobgarMfo', 'Javobgar bankining kodi (MFO)', '5 xonali raqam'),
  f('javobgarOked', 'Javobgarning OKED', '5 xonali raqam'),
  f('javobgarTel', 'Javobgarning telefon raqami'),
  f('javobgarEmail', 'Javobgarning elektron manzili'),
  f('davoBahosi', 'Daʼvo bahosi (pul talablari jami, soʻm)'),
];

const ISH: Field[] = [
  f('lavozim', 'Lavozim'),
  f('ishgaKirgan', 'Ishga qabul qilingan sana', '01.03.2022'),
  f('qabulBuyruq', 'Ishga qabul qilish buyrugʻi raqami', '15-k'),
  f('oylik', 'Oʻrtacha oylik ish haqi (soʻm)'),
];

const SANA = f('sana', 'Ariza sanasi', new Date().toLocaleDateString('uz-UZ'));

// Sarlavhadan yuqoridagi hamma qator .docx da oʻng tomondagi blokka tushadi.
const sarlavha = (mazmun: string, nom: string) => `{{sud}}ga

Daʼvogar: {{davogar}}
Manzili: {{davogarManzil}}
Telefon: {{davogarTel}}
Elektron manzil: {{davogarEmail}}

Javobgar: {{javobgar}}
Manzili: {{javobgarManzil}}
H/r: {{javobgarHr}}
STIR: {{javobgarStir}}
MFO: {{javobgarMfo}}
OKED: {{javobgarOked}}
Telefon: {{javobgarTel}}
Elektron manzil: {{javobgarEmail}}

Daʼvo mazmuni: ${mazmun}
Daʼvo bahosi: {{davoBahosi}} soʻm
Davlat bojidan ozod (Mehnat kodeksining 562-moddasi)

DAʼVO ARIZASI
(${nom})
`;

const ISHGA_KIRISH = 'Men, {{davogar}}, javobgar — {{javobgar}}ning {{ishgaKirgan}}dagi {{qabulBuyruq}}-sonli buyrugʻi asosida {{lavozim}} lavozimiga ishga qabul qilinganman. Mening oʻrtacha oylik ish haqim {{oylik}} soʻmni tashkil etadi.';

const ILOVA_BOSH = `Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Daʼvogarning pasporti (ID-kartasi) nusxasi.
3. Mehnat shartnomasi nusxasi.
4. Ishga qabul qilish toʻgʻrisidagi {{qabulBuyruq}}-sonli buyruq nusxasi.`;

const IMZO = `
Daʼvogar {{davogar}} ___________ (imzo)
{{sana}} yil.

Izoh: Daʼvo arizasi vakil orqali berilgan hollarda vakil tomonidan imzolanadi. Vakilning vakolatini tasdiqlovchi ishonchnoma daʼvo arizasiga ilova qilinishi shart (Fuqarolik protsessual kodeksining 189 va 191-moddalari).`;

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
      f('asos', 'Buyruqda koʻrsatilgan boʻshatish asosi', 'Mehnat kodeksi 161-moddasi ikkinchi qismining 4-bandi'),
      f('holat', 'Boʻshatish nega gʻayriqonuniy (faktlar, buzilgan tartib)', undefined, true),
      f('progulKunlari', 'Majburiy progul ish kunlari soni (daʼvo kunigacha)'),
      f('progulSumma', 'Majburiy progul uchun hisoblangan summa (soʻm)'),
      f('manaviyZarar', 'Maʼnaviy zarar summasi (soʻm)'),
      f('manaviyHolat', 'Maʼnaviy zarar nimada ifodalangan', 'daromad manbaidan mahrum boʻlish, ruhiy iztirob, oila taʼminoti qiyinlashuvi', true),
      SANA],
    body: `${sarlavha(
      'ishga tiklash, majburiy progul vaqti uchun {{progulSumma}} soʻm miqdorida oʻrtacha ish haqini va {{manaviyZarar}} soʻm miqdorida maʼnaviy zararni undirish toʻgʻrisida',
      'ishga tiklash, majburiy progul vaqti uchun oʻrtacha ish haqini va maʼnaviy zararni undirish toʻgʻrisida',
    )}
${ISHGA_KIRISH}

Javobgarning {{buyruqSana}}dagi {{buyruqRaqam}}-sonli buyrugʻi bilan men bilan tuzilgan mehnat shartnomasi {{asos}} asosida {{boshatilganSana}}dan bekor qilingan. Buyruqning nusxasi menga {{buyruqTopshirilgan}}da topshirilgan.

Mehnat shartnomasining bekor qilinishini qonunga xilof deb hisoblayman, chunki: {{holat}}

Oʻzbekiston Respublikasi Mehnat kodeksining 561-moddasi birinchi qismiga koʻra mehnat shartnomasi qonuniy asossiz bekor qilingan hollarda yakka tartibdagi mehnat nizosini koʻrib chiquvchi organ xodimni avvalgi ishiga tiklaydi. Mazkur moddaning ikkinchi qismiga koʻra mehnat shartnomasini ish beruvchining tashabbusiga koʻra bekor qilishning qonuniyligi toʻgʻrisidagi masalani hal qilayotganda sud xodim bilan mehnat munosabatlarini tugatishning asosliligiga baho beradi; uchinchi qismiga koʻra esa sud xodimga majburiy progulning butun vaqti uchun oʻrtacha ish haqini toʻlash toʻgʻrisida qaror qabul qiladi. Oʻrtacha ish haqi Mehnat kodeksining 257-moddasida belgilangan tartibda hisoblanadi. Ishdan boʻshatilgan kundan daʼvo berilgan kungacha majburiy progul {{progulKunlari}} ish kunini tashkil etib, uning uchun {{progulSumma}} soʻm toʻlanishi lozim (hisob-kitob ilova qilinadi). Ushbu summa hal qiluv qarori chiqarilgan kunga qadar qayta hisoblanishi lozim.

Javobgarning gʻayriqonuniy harakatlari natijasida menga maʼnaviy zarar yetkazildi: {{manaviyHolat}}. Mehnat kodeksining 335-moddasiga koʻra ish beruvchining gʻayriqonuniy harakatlari yoki harakatsizligi tufayli xodimga yetkazilgan maʼnaviy zarar pul shaklida kompensatsiya qilinadi, nizo yuzaga kelgan taqdirda uning miqdori sud tomonidan belgilanadi; 565-moddasiga koʻra sud xodimning talabiga koʻra maʼnaviy zararni kompensatsiya qilish toʻgʻrisida qaror chiqarishga haqli. Yetkazilgan maʼnaviy zararni {{manaviyZarar}} soʻm miqdorida baholayman.

Mehnat kodeksining 558-moddasi birinchi qismi 2- va 4-bandlariga koʻra ishga tiklash, majburiy progul vaqti uchun haq toʻlash va maʼnaviy zararni kompensatsiya qilish toʻgʻrisidagi nizolar bevosita sudda koʻrib chiqiladi. Daʼvo Mehnat kodeksining 560-moddasida belgilangan, buyruq nusxasi topshirilgan kundan eʼtiboran uch oylik muddatda berilmoqda. Mehnat kodeksining 562-moddasiga koʻra xodim yakka tartibdagi mehnat munosabatlaridan kelib chiqadigan talablar boʻyicha sud xarajatlaridan ozod qilinadi.

Yuqorida qayd etilganlarga koʻra, Oʻzbekiston Respublikasi Mehnat kodeksining 257, 335, 558, 560, 561, 562, 565-moddalari, Fuqarolik protsessual kodeksining 188–191, 266-moddalariga asoslanib, suddan quyidagilarni

SOʻRAYMAN:
1. Javobgar {{javobgar}}ning {{buyruqSana}}dagi {{buyruqRaqam}}-sonli buyrugʻi gʻayriqonuniy deb topilsin va bekor qilinsin.
2. {{davogar}} {{javobgar}}dagi avvalgi {{lavozim}} lavozimiga {{boshatilganSana}}dan eʼtiboran ishga tiklansin.
3. Javobgardan {{davogar}} foydasiga majburiy progulning butun vaqti uchun oʻrtacha ish haqi (daʼvo berilgan kunga {{progulSumma}} soʻm, hal qiluv qarori chiqarilgan kunga qadar qayta hisoblangan holda) undirilsin.
4. Javobgardan {{davogar}} foydasiga maʼnaviy zarar uchun {{manaviyZarar}} soʻm kompensatsiya undirilsin.
5. Hal qiluv qarorining ishga tiklash va uch oylik ish haqidan ortiq boʻlmagan ish haqini undirish qismi Fuqarolik protsessual kodeksining 266-moddasi 2- va 4-bandlariga muvofiq darhol ijroga qaratilsin.

${ILOVA_BOSH}
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
    short: 'Mehnat kodeksi 244, 253, 333-moddalar. Ish haqi toʻlanmaganda (muddat — 6 oy).',
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
    body: `${sarlavha(
      '{{summa}} soʻm miqdorida toʻlanmagan ish haqini va {{kompensatsiya}} soʻm miqdorida pulli kompensatsiyani undirish toʻgʻrisida',
      'toʻlanmagan ish haqini va uni kechiktirganlik uchun pulli kompensatsiyani undirish toʻgʻrisida',
    )}
${ISHGA_KIRISH} Mehnat munosabatlarining holati: {{mehnatHolati}}.

Shu vaqt mobaynida mehnat shartnomasida belgilangan vazifalarimni hamda ish beruvchining topshiriqlarini bajarib kelganman. Biroq javobgar {{davr}} davri uchun menga hisoblangan ish haqini toʻlamagan, uning qarzi jami {{summa}} soʻmni tashkil etadi. Ish haqi {{tolovMuddati}}dan buyon kechiktirilmoqda.

{{holat}}

Oʻzbekiston Respublikasi Mehnat kodeksining 244-moddasida ish beruvchining oʻz moliyaviy ahvolidan qatʼi nazar, xodimlar tomonidan bajarilgan ish uchun belgilangan mehnatga haq toʻlash shartlariga muvofiq haq toʻlash majburiyati asosiy kafolat sifatida mustahkamlangan. Kodeksning 253-moddasiga koʻra ish haqi jamoa shartnomasida, ichki hujjatda yoki mehnat shartnomasida belgilangan muddatlarda, har yarim oyda bir martadan kam boʻlmagan holda toʻlanadi; ish beruvchi ish haqini toʻlash kechiktirilganligi uchun xodim oldida Kodeksning 333-moddasida belgilangan miqdorda moddiy javobgar boʻladi. Mehnat shartnomasi bekor qilingan hollarda Kodeksning 172 va 254-moddalariga koʻra barcha summalar mehnat shartnomasi bekor qilingan kuni toʻlanishi lozim.

Mehnat kodeksining 333-moddasiga koʻra ish beruvchi ish haqini toʻlash muddatini buzgan taqdirda uni toʻlov muddatidan keyingi kundan eʼtiboran haqiqatda hisob-kitob qilingan kunni oʻz ichiga olgan muddatgacha har bir kechiktirilgan kun uchun foizlar (pulli kompensatsiya) bilan birga toʻlashi shart; kompensatsiya miqdori Markaziy bank qayta moliyalash stavkasining oʻn foizi miqdorida belgilanadi va ish beruvchining aybi bor-yoʻqligidan qatʼi nazar toʻlanadi. Qayta moliyalash stavkasi {{stavka}} foiz, kechiktirilgan kunlar soni {{kechikishKunlari}} kun boʻlib, kompensatsiya daʼvo berilgan kunga {{kompensatsiya}} soʻmni tashkil etadi (hisob-kitob ilova qilinadi).

Mehnat kodeksining 558-moddasi ikkinchi qismiga koʻra yakka tartibdagi mehnat nizolari xodimning xohishiga koʻra bevosita sudda ham koʻrib chiqiladi. Daʼvo Mehnat kodeksining 560-moddasida belgilangan olti oylik muddatda berilmoqda. Mehnat kodeksining 562-moddasiga koʻra xodim yakka tartibdagi mehnat munosabatlaridan kelib chiqadigan talablar boʻyicha sud xarajatlaridan ozod qilinadi.

Yuqorida qayd etilganlarga koʻra, Oʻzbekiston Respublikasi Mehnat kodeksining 172, 244, 253, 254, 333, 558, 560, 562-moddalari, Fuqarolik protsessual kodeksining 188–191, 266-moddalariga asoslanib, suddan quyidagilarni

SOʻRAYMAN:
1. Javobgar {{javobgar}}dan {{davogar}} foydasiga {{davr}} davri uchun toʻlanmagan ish haqi {{summa}} soʻm undirilsin.
2. Javobgardan {{davogar}} foydasiga ish haqini kechiktirganlik uchun Mehnat kodeksining 333-moddasiga muvofiq pulli kompensatsiya {{kompensatsiya}} soʻm (haqiqiy hisob-kitob kunigacha qayta hisoblangan holda) undirilsin.
3. Hal qiluv qarorining uch oylik ish haqidan ortiq boʻlmagan ish haqini undirish qismi Fuqarolik protsessual kodeksining 266-moddasi 2-bandiga muvofiq darhol ijroga qaratilsin.

${ILOVA_BOSH}
5. Ish haqi qarzdorligi toʻgʻrisida maʼlumotnoma (hisob varaqalari, bank koʻchirmasi).
6. Toʻlanmagan ish haqi va kompensatsiya hisob-kitobi.
7. Ish beruvchiga yozilgan murojaatlar nusxalari (mavjud boʻlsa).
${IMZO}`,
  },
];
