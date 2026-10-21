// Mehnat nizolari: mehnat munosabatlarini tan olish, intizomiy jazo, taʼtil kompensatsiyasi, mehnat daftarchasi, mehnatda shikastlanish.
// Manba: Adliya vazirligi "Adolat" markazi Legal Tech namunalari — yurxizmat.uz/oz/document/2236, 2563, 2581, 2182, 2611.
// Moddalar lex.uz da 2026-10 holatiga tekshirilgan: Mehnat kodeksi — https://lex.uz/uz/acts/6257288,
// FPK — https://lex.uz/uz/acts/3517337 (namunadagi eskirgan raqamlar joriy moddalarga almashtirilgan).
import type { Field, Shablon } from './shablonlar-data';

const f = (key: string, label: string, placeholder?: string, multiline?: boolean): Field =>
  ({ key, label, placeholder, multiline });

const MANZIL = 'Viloyat, tuman (shahar), mahalla, koʻcha nomi va uy raqami';

const SUD = f('sud', 'Sud nomi', 'Fuqarolik ishlari boʻyicha Toyloq tumanlararo sudi');
const DAVOGAR: Field[] = [
  f('davogar', 'Daʼvogarning F.I.O.si'),
  f('davogarManzil', 'Daʼvogarning yashash manzili', MANZIL),
  f('davogarTel', 'Daʼvogarning telefon raqami', '+998 90 123 45 67'),
  f('davogarEmail', 'Daʼvogarning elektron manzili', 'ism@mail.uz'),
];
const JAVOBGAR: Field[] = [
  f('javobgar', 'Javobgar tashkilotning nomi', '«Namuna» masʼuliyati cheklangan jamiyati'),
  f('javobgarManzil', 'Javobgarning manzili', MANZIL),
  f('javobgarTel', 'Javobgarning telefon raqami'),
  f('javobgarEmail', 'Javobgarning elektron manzili'),
];
const STIR = f('javobgarStir', 'Javobgarning STIR raqami', '9 xonali raqam');
const ILOVA = f('ilova', 'Ilova qilinadigan boshqa hujjatlar roʻyxati', 'mehnat shartnomasi nusxasi; buyruq nusxasi; ish beruvchiga yozilgan ariza nusxasi', true);
const SANA = f('sana', 'Ariza sanasi', new Date().toLocaleDateString('uz-UZ'));

const DAVOGAR_BLOK = `Daʼvogar: {{davogar}}
{{davogarManzil}}
{{davogarTel}}
{{davogarEmail}}`;

const JAVOBGAR_BLOK = `Javobgar: {{javobgar}}
{{javobgarManzil}}`;

const IMZO = `
Daʼvogar {{davogar}} ___________ (imzo)
{{sana}} yil.`;

export const MEHNAT2_SHABLONLAR: Shablon[] = [
  {
    id: 'mehnat-munosabatini-tan-olish',
    title: 'Mehnat munosabatlari deb tan olish va ish beruvchiga mehnat shartnomasi tuzish majburiyatini yuklash toʻgʻrisida daʼvo arizasi',
    short: 'Mehnat kodeksi 128-modda. Haqiqatda ishga qoʻyilgan, shartnomasiz xodim uchun.',
    fields: [SUD, ...DAVOGAR, ...JAVOBGAR,
      f('uchinchiShaxs', 'Uchinchi shaxsning F.I.O.si'),
      f('uchinchiManzil', 'Uchinchi shaxsning yashash manzili', MANZIL),
      f('uchinchiTel', 'Uchinchi shaxsning telefon raqami'),
      f('uchinchiEmail', 'Uchinchi shaxsning elektron manzili'),
      f('tashkilot', 'Daʼvogar ishlab kelayotgan tashkilot nomi', 'bank filiali boʻlsa, uning nomi koʻrsatiladi'),
      f('boshlaganSana', 'Amalda mehnat munosabatlariga kirishgan sana', 'tashkilotda amalda ishlay boshlagan kun, masalan 01.03.2026'),
      f('lavozim', 'Ishlab kelgan lavozim yoki vazifa nomi'),
      ILOVA, SANA],
    body: `{{sud}}ga

${DAVOGAR_BLOK}

${JAVOBGAR_BLOK}
{{javobgarTel}}
{{javobgarEmail}}

Uchinchi shaxs: {{uchinchiShaxs}}
{{uchinchiManzil}}
{{uchinchiTel}}
{{uchinchiEmail}}

DAʼVO ARIZASI
(Mehnat munosabatlari deb tan olish va ish beruvchiga mehnat shartnomasi tuzish majburiyatini yuklash toʻgʻrisida)

Men ish beruvchining roziligi bilan «{{tashkilot}}» tashkilotida {{boshlaganSana}} kunidan buyon {{lavozim}} vazifasida ishlab kelmoqdaman.

Ish beruvchining ruxsati bilan mehnat vazifalarimni boshlab, hozirga qadar ishlab kelayotganligimga qaramasdan ish beruvchi men bilan mehnat shartnomasini tuzishni paysalga solib kelmoqda.

Bu holat korxonada menga yuklatilgan vazifani bajarish chogʻida tushunmovchiliklarga hamda ishlagan kunlarim uchun ish haqi hisoblanishi boʻyicha kelishmovchiliklarga sabab boʻlmoqda.

Amaldagi qonunchilikka koʻra, xodim bilan mehnat shartnomasi tuzilmas ekan, bu holat uning huquqlari buzilishiga, oqibatda unga ish haqi toʻlanmasligiga olib keladi.

Oʻzbekiston Respublikasi Mehnat kodeksining 128-moddasiga muvofiq, ishga qabul qilish huquqiga ega boʻlgan mansabdor shaxs tomonidan yoxud uning ruxsati bilan xodimni haqiqatda ishga qoʻyish, ishga qabul qilish lozim darajada rasmiylashtirilganligidan yoki rasmiylashtirilmaganligidan qatʼi nazar, mehnat shartnomasini ish boshlangan kundan eʼtiboran tuzish deb hisoblanadi.

Biroq korxona rahbari tomonidan men mehnat munosabatlariga kirishgan boʻlsam-da, men bilan mehnat shartnomasi tuzish asossiz ravishda paysalga solinmoqda.

Shu sababli huquqlarimni tiklashni soʻrab, sudga murojaat qilishga majbur boʻldim.

Yuqorida qayd etilganlarga koʻra quyidagilarni

SOʻRAYMAN:
1. Men bilan «{{tashkilot}}» tashkiloti oʻrtasidagi munosabatlarni mehnat munosabatlari deb topib, ish beruvchiga men bilan mehnat shartnomasi tuzish majburiyatini yuklashni.

Ilova qilinadigan hujjatlar:
1. Mutaxassisligim boʻyicha diplom nusxasi.
2. Fuqarolik pasportim (ID-kartam) nusxasi.
3. {{ilova}}
${IMZO}`,
  },
  {
    id: 'intizomiy-jazoni-bekor-qilish',
    title: 'Intizomiy jazoni bekor qilish yuzasidan daʼvo arizasi',
    short: 'Mehnat kodeksi 301, 313-moddalar. Asossiz hayfsan yoki jarimani bekor qilish.',
    fields: [SUD, ...DAVOGAR, ...JAVOBGAR.slice(0, 2), STIR, ...JAVOBGAR.slice(2),
      f('ishgaKirgan', 'Javobgar tashkilotda ishlay boshlagan sana', '01.03.2022'),
      f('lavozim', 'Daʼvogarning lavozimi'),
      f('topshiriqSana', 'Alohida topshiriq berilgan sana', '15.09.2026'),
      f('arizaSana', 'Ish beruvchiga yozma ariza kiritilgan sana', '20.09.2026'),
      f('jazoTuri', 'Qoʻllanilgan intizomiy jazo turi', 'hayfsan / jarima'),
      f('jazoSana', 'Intizomiy jazo qoʻllash toʻgʻrisidagi buyruq sanasi', '17.09.2026'),
      ILOVA, SANA],
    body: `{{sud}}ga

${DAVOGAR_BLOK}

${JAVOBGAR_BLOK}
{{javobgarStir}}
{{javobgarTel}}
{{javobgarEmail}}

DAʼVO ARIZASI
(Ish beruvchining intizomiy jazo qoʻllashga oid harakatlari yuzasidan)

Men, {{davogar}}, {{ishgaKirgan}} kunidan {{javobgar}} (keyingi oʻrinlarda – javobgar)da {{lavozim}} lavozimida ishlab kelyapman.

Shu vaqtga qadar javobgar bilan tuzilgan mehnat shartnomasi va lavozim yoʻriqnomamda koʻrsatilgan vazifa va funksiyalarni oʻz vaqtida hamda toʻliq bajarib kelganman.

Tashkilot rahbari oʻrinbosarining alohida topshirigʻi bilan {{topshiriqSana}}da ish vaqtim tugaganiga qaramasdan qoʻshimcha ishlab berdim. Buning natijasida ertasi kuni ishga kech keldim. Shu kuni HR boʻlimi boshligʻi meni chaqirib, ishga kech qolib kelganligim yuzasidan tushuntirish xati yozib berishimni talab qildi. Men nima sababdan kech qolganligimni atroflicha keltirib, tushuntirish xati yozdim. Biroq HR boʻlimi boshligʻi menga nisbatan intizomiy jazo chorasini qoʻlladi.

Oʻzbekiston Respublikasi Mehnat kodeksining 301-moddasi ikkinchi qismida «intizomiy qilmish deganda xodim tomonidan oʻz mehnat majburiyatlarini aybli tarzda, gʻayriqonuniy ravishda bajarmaganligi yoki lozim darajada bajarmaganligi (mehnat (lavozim) majburiyatlarining buzilishi) tushuniladi» deyilgan. Shuningdek, ushbu moddaning uchinchi qismida «agar xodimning oʻz mehnat (lavozim) majburiyatlarini bajarmaganligi yoki lozim darajada bajarmaganligi xodimga bogʻliq boʻlmagan sabablarga koʻra yuz bergan boʻlsa (xodimning oʻz mehnat vazifalarini bajarish uchun ish beruvchi tomonidan zarur shart-sharoitlar taʼminlanmaganligi, fors-major holatlari va hokazolarda), xodimni intizomiy javobgarlikka tortishga yoʻl qoʻyilmaydi» deb koʻrsatilgan.

Mazkur Kodeksning 313-moddasi uchinchi qismiga koʻra intizomiy jazo chorasini qoʻllashda sodir etilgan qilmishning ogʻir-yengilligi, uning sodir etilishi holatlari, xodimning avvalgi ishi va xulq-atvori hisobga olinadi.

Mening ishga kechikib kelishim avvalo ish beruvchi tomonining xatti-harakatlari, yaʼni bir kun oldin meni gʻayriqonuniy ravishda ishlatganligi va shundan kelib chiqqan kuchli charchoq va toliqish sabab ertalab dam olganligimdan kelib chiqqan. Yaʼni, ishga kechikib kelganligim uzrli sabablarga koʻra yuz bergan, qolaversa, bu holatda menda hech qanday ayb mavjud emas. Bundan tashqari, men shu vaqtga qadar zimmamdagi vazifa va majburiyatlarni oʻz vaqtida bajarib kelganman va mening faoliyatimga nisbatan ish beruvchida shu kunga qadar hech qanday eʼtirozlar bildirilmagan. Xulq-atvorim borasida ham jamoa yoki rahbariyat tomonidan biron-bir eʼtirozlar bildirilmagan.

Men ish beruvchiga {{arizaSana}} kuni alohida ariza kiritdim va menga nisbatan chiqarilgan intizomiy jazo qoʻllash haqidagi buyruq gʻayriqonuniy boʻlganligi sababli, uni bekor qilishni talab qildim. Lekin ish beruvchi buyruqni bekor qilmadi. Shu sababli sudga murojaat qilishdan boshqa choram qolmadi, chunki bu buyruq agar bekor qilinmasa, men turli ragʻbat va bayram mukofoti pullaridan mahrum boʻlaman. Bundan tashqari, men intizomiy jazoga loyiq boʻlgan biror ish qilmadim.

Yuqoridagilarga va Mehnat kodeksining 301, 313, 558-moddalariga asoslanib, suddan:
– javobgar {{javobgar}} direktorining menga nisbatan intizomiy jazo qoʻllashga doir xatti-harakatlarini qonunga xilof deb topishni;
– javobgarning menga nisbatan intizomiy jazo ({{jazoTuri}}) qoʻllash haqidagi {{jazoSana}}dagi buyrugʻini bekor qilish (haqiqiy emas deb topish)ni soʻrayman.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Intizomiy jazo qoʻllash toʻgʻrisidagi buyruq nusxasi.
3. {{ilova}}
${IMZO}`,
  },
  {
    id: 'tatil-kompensatsiyasi',
    title: 'Foydalanilmagan mehnat taʼtillari uchun pulli kompensatsiya, kechiktirilgan kunlarga foizlar va maʼnaviy zarar uchun pul undirish toʻgʻrisida daʼvo arizasi',
    short: 'Mehnat kodeksi 172, 234, 333-moddalar. Boʻshatilganda taʼtil puli toʻlanmasa.',
    fields: [SUD, ...DAVOGAR, ...JAVOBGAR.slice(0, 2), STIR, ...JAVOBGAR.slice(2),
      f('ishgaKirgan', 'Javobgar tashkilotda ishlay boshlagan sana', '01.03.2019'),
      f('boshashSababi', 'Ishdan boʻshash sababi', 'oilaviy sharoitim'),
      f('bekorSana', 'Mehnat shartnomasi bekor qilingan sana', '10.09.2026'),
      f('yillar', 'Yillik mehnat taʼtili berilmagan ish yillari soni', '3'),
      f('shartnomaBandi', 'Mehnat shartnomasining taʼtilga oid bandi', '5'),
      f('tatilKunlari', 'Har bir ish yili uchun berilishi lozim boʻlgan taʼtil kunlari', '21'),
      f('murojaatSana', 'Javobgarga yozma ariza bilan murojaat qilingan sana', '20.09.2026'),
      f('manaviyZarar', 'Maʼnaviy zarar miqdori (soʻm)'),
      ILOVA, SANA],
    body: `{{sud}}ga

${DAVOGAR_BLOK}

${JAVOBGAR_BLOK}
{{javobgarStir}}
{{javobgarTel}}
{{javobgarEmail}}

DAʼVO ARIZASI
(Foydalanilmagan mehnat taʼtillari uchun pulli kompensatsiya, kechiktirilgan kunlarga foizlar va maʼnaviy zarar uchun pul undirish toʻgʻrisida)

Men, {{davogar}}, {{ishgaKirgan}} kunidan {{javobgar}} (keyingi oʻrinlarda – javobgar)da turli lavozimlarda mehnat qilib kelganman.

Men {{boshashSababi}} sababli ishdan boʻshashga ariza yozdim va {{bekorSana}} kuni men bilan tuzilgan mehnat shartnomasi oʻz tashabbusimga koʻra bekor qilindi.

Biroq mehnat shartnomasi bekor qilingandan keyingi hisob-kitob davrida menga foydalanilmagan mehnat taʼtilimning faqat bir yili uchun pulli kompensatsiya toʻlovlari toʻlandi, xolos.

Vaholanki, undan tashqari menga jami {{yillar}} yillik ish yillarim uchun ham har yilgi mehnat taʼtillari berilmagan.

Oʻzbekiston Respublikasi Mehnat kodeksining 172-moddasiga koʻra xodim bilan tuzilgan mehnat shartnomasi bekor qilinganda xodim bilan hisob-kitob qilinishi kerak va bunda ish beruvchi xodim tomonidan foydalanilmagan barcha asosiy va qoʻshimcha taʼtillar uchun kompensatsiyalarni toʻlab berishi lozim.

Ushbu Kodeksning 216-moddasiga muvofiq «har yilgi mehnat taʼtili dam olish va ishlash qobiliyatini tiklash uchun ish oʻrni (lavozimi) hamda oʻrtacha ish haqi saqlab qolingan holda xodim ishdan ozod etiladigan, xodimga har yili ish yili davomida beriladigan vaqt davridir».

Kodeksning 230-moddasi birinchi qismida «har yilgi mehnat taʼtili har yili, ushbu taʼtil berilayotgan ish yili tugagunga qadar berilishi kerak» deyilgan.

Shuningdek, Kodeksning 234-moddasi birinchi qismiga asosan mehnat shartnomasi bekor qilinganda xodimga barcha foydalanilmagan har yilgi asosiy va qoʻshimcha mehnat taʼtillari uchun pulli kompensatsiya toʻlanadi.

Yuqorida keltirib oʻtilgan qoidalarga koʻra, men bilan mehnat shartnomasi bekor qilingandan keyin javobgar menga barcha foydalanilmagan mehnat taʼtillarim uchun kompensatsiya toʻlovlarini toʻlab berishi shart edi.

Taraflar oʻrtasida tuzilgan mehnat shartnomasining {{shartnomaBandi}}-bandiga asosan har bir ish yili uchun {{tatilKunlari}} kundan iborat mehnat taʼtili berilishi lozim boʻlsa-da, javobgar tomonidan {{yillar}} yillik ish yilining har bir yili uchun mehnat taʼtillari berilmagan.

Men javobgarga {{murojaatSana}} kuni yozma ariza bilan murojaat qilib, yuqoridagi {{yillar}} yillik davrdagi foydalanilmagan mehnat taʼtillarim uchun kompensatsiya toʻlovlarini ixtiyoriy ravishda toʻlashni talab qildim. Lekin javobgar shu vaqtga qadar ushbu toʻlovlarni oʻz ixtiyori bilan toʻlamadi.

Mehnat kodeksining 333-moddasiga asosan ish beruvchi ish haqini, taʼtil toʻlovlarini, mehnat shartnomasi bekor qilingandagi toʻlovlarni va (yoki) xodimga toʻlanishi lozim boʻlgan boshqa toʻlovlarni toʻlash muddatini buzgan taqdirda, ularni toʻlov muddatidan keyingi kundan eʼtiboran to haqiqatda hisob-kitob qilingan kunni oʻz ichiga olgan muddatgacha har bir kechiktirilgan kun uchun Oʻzbekiston Respublikasi Markaziy bankining oʻsha vaqtda amalda boʻlgan qayta moliyalashtirish stavkasidan kelib chiqqan holda foizlar (pulli kompensatsiya) bilan birga toʻlashi shart. Xodimga toʻlanishi lozim boʻlgan pulli kompensatsiyaning miqdori Oʻzbekiston Respublikasi Markaziy banki qayta moliyalash stavkasining oʻn foizi miqdorida belgilanadi.

Mazkur qoidaga binoan javobgar menga {{yillar}} yillik davrdagi foydalanilmagan mehnat taʼtilim uchun oʻz vaqtida toʻlanmagan kompensatsiya toʻlovlari boʻyicha kechiktirilgan har bir kunga ham foizlar toʻlashi lozim.

Bundan tashqari, javobgarning yuqoridagi harakatsizligi va qonunlarni mensimasligi natijasida men jiddiy ruhiy azob chekdim va oʻzimni kamsitilgan, xoʻrlangan his qildim. Shunga koʻra men javobgar tomonidan menga maʼnaviy zarar yetkazilgan deb hisoblayman va uning miqdorini {{manaviyZarar}} soʻm sifatida baholayman (Mehnat kodeksining 335 va 565-moddalari).

Yuqoridagilarga asoslanib, suddan javobgar – {{javobgar}} hisobidan mening foydamga:
– {{yillar}} yillik ish yili mobaynida foydalanilmagan mehnat taʼtillari uchun pulli kompensatsiya, ushbu kompensatsiya toʻlovlari kechiktirilganligi uchun {{bekorSana}}dan keyingi kundan eʼtiboran haqiqatda hisob-kitob qilingan kunga qadar har bir kechiktirilgan kun uchun Mehnat kodeksining 333-moddasiga asosan foizlar hamda yetkazilgan maʼnaviy zarar uchun {{manaviyZarar}} soʻm miqdoridagi pul mablagʻlarini undirib berilishini soʻrayman.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. Mehnat shartnomasi nusxasi.
3. Javobgarga {{murojaatSana}}da yozilgan ariza nusxasi.
4. {{ilova}}
${IMZO}`,
  },
  {
    id: 'mehnat-daftarchasini-talab-qilish',
    title: 'Ishdan boʻshagandan soʻng berilmagan mehnat daftarchasi va boshqa hujjatlarni talab qilib olish toʻgʻrisida daʼvo arizasi',
    short: 'Mehnat kodeksi 125, 171-moddalar. Ish beruvchi mehnat daftarchasini bermasa.',
    fields: [SUD, ...DAVOGAR,
      { ...JAVOBGAR[0], label: 'Javobgar tashkilotning nomi va tashkiliy-huquqiy shakli' }, ...JAVOBGAR.slice(1),
      f('tashkilot', 'Daʼvogar ishlagan tashkilot nomi'),
      f('rahbar', 'Ishga qabul qilish buyrugʻini chiqargan mansabdor shaxsning F.I.O.si'),
      f('qabulSana', 'Ishga qabul qilish toʻgʻrisidagi buyruq sanasi', '01.03.2022'),
      f('qabulRaqam', 'Ishga qabul qilish toʻgʻrisidagi buyruq raqami', '15-k'),
      f('lavozim', 'Ishga qabul qilingan vazifa (lavozim)'),
      f('boshatishSana', 'Ishdan boʻshatish toʻgʻrisidagi buyruq sanasi', '10.09.2026'),
      f('boshatishRaqam', 'Ishdan boʻshatish toʻgʻrisidagi buyruq raqami', '27-k'),
      f('hujjatlar', 'Mehnat daftarchasidan tashqari qaytarilmagan hujjatlar', 'buyruq nusxasi, harbiy guvohnoma'),
      { ...ILOVA, placeholder: 'daʼvoni asoslovchi hujjatlar; ish beruvchiga yozilgan murojaatlar nusxalari' },
      SANA],
    body: `{{sud}}ga

Daʼvogar: {{davogarManzil}}da yashovchi
{{davogar}}dan
Telefon: {{davogarTel}}
E-mail: {{davogarEmail}}

Javobgar: {{javobgar}}
Manzil: {{javobgarManzil}}
Telefon: {{javobgarTel}}
E-mail: {{javobgarEmail}}

Daʼvo mazmuni: Ishdan boʻshagandan soʻng berilmagan mehnat daftarchasi va {{hujjatlar}} hujjatlarini talab qilib olish boʻyicha

DAʼVO ARIZASI
(Ishdan boʻshagandan soʻng berilmagan hujjatlarni talab qilib olish boʻyicha)

Men {{tashkilot}} rahbari {{rahbar}}ning {{qabulSana}} kungi {{qabulRaqam}}-sonli buyrugʻi asosida {{lavozim}} vazifasiga ishga qabul qilinganman.

Ish beruvchining {{boshatishSana}} kunidagi {{boshatishRaqam}}-sonli buyrugʻi asosida men bilan tuzilgan mehnat shartnomasi bekor qilingan.

Biroq bir necha marotaba murojaat qilganimga qaramasdan, ish beruvchi tomonidan menga tegishli boʻlgan mehnat daftarchasi hamda {{hujjatlar}} kabi hujjatlarim berilmadi. Natijada men boshqa joyga ishga joylasha olmayapman.

Oʻzbekiston Respublikasi Mehnat kodeksining 125-moddasiga koʻra, lozim darajada tasdiqlangan qogʻoz yoki elektron shaklidagi mehnat daftarchasi xodimning mehnat stajini tasdiqlovchi asosiy hujjatdir. Ish beruvchi (bundan jismoniy shaxslar boʻlgan ish beruvchilar mustasno) tashkilotda besh kundan ortiq ishlagan barcha xodimlar uchun mehnat daftarchalarini yuritishi shart.

Mehnat kodeksining 160-moddasiga muvofiq, xodim nomuayyan muddatga tuzilgan mehnat shartnomasini, shuningdek muddati tugagunga qadar muddatli mehnat shartnomasini oʻn toʻrt kalendar kun oldin bu haqda ish beruvchini yozma shaklda ogohlantirgan holda bekor qilishga haqli. Ogohlantirish muddati tugaganidan keyin xodim ishni tugatishga haqli, ish beruvchi esa xodimga mehnat shartnomasini bekor qilish haqidagi buyruqning koʻchirma nusxasini, mehnat daftarchasini yoki elektron mehnat daftarchasidan koʻchirmani berishi hamda u bilan hisob-kitobni amalga oshirishi shart.

Mehnat kodeksining 171-moddasiga koʻra, ish beruvchi mehnat shartnomasi bekor qilingan kuni xodimga uning mehnat daftarchasini yoxud elektron mehnat daftarchasidan koʻchirmani, shuningdek mehnat shartnomasini bekor qilish toʻgʻrisidagi buyruqning koʻchirma nusxasini berishi shart. Ish beruvchi xodimning yozma arizasiga koʻra unga ish bilan bogʻliq hujjatlarning tegishli ravishda tasdiqlangan koʻchirma nusxalarini ham berishi shart.

Ish beruvchiga mehnat daftarchasini va buyruq nusxasini berish haqida bir necha marotaba murojaat qilsam-da, ish beruvchi hujjatlarimni bermasdan kelyapti. Mehnat daftarchamni olib berishni soʻrab huquqni muhofaza qiluvchi organlarga qilgan murojaatlarimga sudga murojaat qilish huquqim tushuntirilib, javob berildi. Natijada ovora boʻlib, sudga murojaat qilishga majbur boʻldim.

Yuqorida qayd etilganlarga koʻra quyidagilarni

SOʻRAYMAN:
1. Javobgar {{javobgar}}dan menga tegishli boʻlgan mehnat daftarcham hamda {{hujjatlar}} kabi hujjatlarimni olib berishingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. {{ilova}}
${IMZO}`,
  },
  {
    id: 'mehnatda-shikastlanish',
    title: 'Mehnatda shikastlanganlik uchun toʻlov undirish toʻgʻrisida daʼvo arizasi',
    short: 'Mehnat kodeksi 322–325-moddalar. Ishlab chiqarishda sogʻliqqa zarar yetganda.',
    fields: [SUD, ...DAVOGAR,
      { ...JAVOBGAR[0], label: 'Javobgar yuridik shaxsning toʻliq nomi' }, JAVOBGAR[1],
      f('javobgarHr', 'Javobgarning hisob raqami', '20208000...'),
      STIR,
      f('javobgarMfo', 'Javobgarning MFO raqami', '5 xonali raqam'),
      f('javobgarOked', 'Javobgarning OKED raqami', '5 xonali raqam'),
      ...JAVOBGAR.slice(2),
      f('davoSumma', 'Undirilishi soʻralayotgan summa miqdori (soʻm)'),
      f('qachondan', 'Shu lavozimda qaysi yildan buyon ishlab kelgan', '2018'),
      f('korxona', 'Javobgar korxona nomi'),
      f('lavozim', 'Ishlab kelgan vazifa (lavozim) nomi'),
      f('hodisaVaqti', 'Baxtsiz hodisa sodir boʻlgan vaqt (yil)', '2025'),
      f('hodisaMazmuni', 'Baxtsiz hodisaning qisqacha mazmuni', 'uskunaga qoʻl tushishi natijasida jarohatlanish', true),
      f('foiz', 'Yoʻqotilgan mehnat qobiliyati (foiz)', '30'),
      f('rasmiyHujjatlar', 'Baxtsiz hodisa yuzasidan rasmiylashtirilgan hujjatlar', 'N-1 shakldagi dalolatnoma, TMEK xulosasi'),
      f('sabablar', 'Zarar toʻlanmasligi sabablari', 'mablagʻ yoʻqligi', true),
      f('xarajat', 'Sogʻliqni tiklashga ketgan xarajatlar summasi (soʻm)'),
      f('asosHujjatlar', 'Daʼvo talabiga asos boʻlgan hujjatlar va boshqa holatlar', 'dori-darmon cheklari, shifoxona maʼlumotnomalari', true),
      f('undirSumma', 'Javobgardan undirilishi soʻralayotgan summa (soʻm)'),
      { ...ILOVA, placeholder: 'baxtsiz hodisa dalolatnomasi; TMEK xulosasi; xarajatlarni tasdiqlovchi hujjatlar; hisob-kitob' },
      SANA],
    body: `{{sud}}ga

Daʼvogar:
{{davogar}}
{{davogarManzil}}
{{davogarTel}}
{{davogarEmail}}

Javobgar:
{{javobgar}}
{{javobgarManzil}}
{{javobgarHr}}
{{javobgarStir}}
{{javobgarMfo}}
{{javobgarOked}}
{{javobgarTel}}
{{javobgarEmail}}

Daʼvo mazmuni: Ishlab chiqarish jarayonida mehnatda shikastlanganlik uchun {{davoSumma}} soʻm toʻlov undirish toʻgʻrisida

DAʼVO ARIZASI
(Mehnatda shikastlanganlik uchun toʻlov undirish toʻgʻrisida)

Men {{qachondan}}-yildan buyon {{korxona}} korxonasida {{lavozim}} vazifasida ishlab kelganman.

{{hodisaVaqti}}-yilda korxonada {{hodisaMazmuni}} sodir boʻlganligi tufayli sogʻligʻimga shikast yetdi. Natijada men mehnat qobiliyatimning {{foiz}} foizini yoʻqotdim.

Mazkur holat boʻyicha {{rasmiyHujjatlar}} kabi hujjatlar rasmiylashtirilgan.

Shunday boʻlsa-da, korxona tomonidan mening sogʻligʻimga yetkazilgan zararni toʻlash {{sabablar}} kabi sabablarga asosan kechiktirilib, ijro qilinmasdan kelinmoqda.

Oʻzbekiston Respublikasi Mehnat kodeksining 322-moddasiga koʻra, xodimning sogʻligʻiga yetkazilgan ziyonning oʻrnini ish beruvchi tomonidan qoplash quyidagilarni oʻz ichiga oladi: xodimga bir martalik nafaqa toʻlash; xodimga yoʻqotilgan ish haqi uchun yetkazilgan ziyonning oʻrnini qoplash tarzida amalga oshiriladigan har oylik toʻlovlar; xodimning qoʻshimcha xarajatlarini kompensatsiya qilish.

Shuningdek, mazkur Kodeksning 323-moddasiga koʻra, xodimning sogʻligʻiga ziyon yetkazilganligi munosabati bilan ish beruvchi tomonidan bir yoʻla toʻlanadigan nafaqa miqdori jamoa shartnomasida, agar u tuzilmagan boʻlsa, ish beruvchi va kasaba uyushmasi qoʻmitasi oʻrtasidagi kelishuvga binoan belgilanadi. Bunda xodimning sogʻligʻiga ziyon yetkazilganligi munosabati bilan bir yoʻla toʻlanadigan nafaqa miqdori jabrlangan xodimning oʻrtacha oylik ish haqi asosida hisoblangan yillik ish haqidan kam boʻlmasligi kerak.

Mazkur Kodeksning 324-moddasiga koʻra, xodimning sogʻligʻiga ziyon yetkazilganligi munosabati bilan yoʻqotilgan ish haqining oʻrnini qoplash uchun amalga oshiriladigan oylik toʻlovlar miqdori jabrlanuvchi mehnatda mayib boʻlgunga qadar olgan oʻrtacha oylik ish haqiga nisbatan uning kasbiy mehnat qobiliyatining yoʻqotilishi darajasiga muvofiq boʻlgan foizli nisbatda belgilanadi. Kasbiy mehnat qobiliyatini yoʻqotish darajasi tibbiy-ijtimoiy ekspert komissiyasi tomonidan belgilanadi.

Ziyonning oʻrnini qoplashga oid toʻlovni tayinlashda jabrlanuvchi oladigan ish haqi, stipendiya, pensiya va boshqa daromadlar hisobga olinmaydi. Bunda mehnatda mayib boʻlgan jabrlanganlarga — nogironligi boʻlgan shaxslarga yetkazilgan ziyonning oʻrnini qoplash summasi qonunchilikda belgilangan mehnatga haq toʻlash eng kam miqdorining ellik foizidan kam boʻlmasligi kerak.

Bugungi kungacha mening sogʻligʻimni tiklashga ketgan xarajatlar {{xarajat}} soʻmni tashkil qiladi. Daʼvo talabimga {{asosHujjatlar}} kabi hujjatlarni asos sifatida keltiraman.

Yuqoridagilarni inobatga olib, Mehnat kodeksining 322–325, 558-moddalariga asosan

SOʻRAYMAN:
1. Ishlab chiqarish jarayonida mehnatda shikastlanganligim uchun javobgardan mening foydamga {{undirSumma}} soʻm miqdorida yetkazilgan zararni undirish toʻgʻrisida hal qiluv qarori chiqarishingizni.

Ilova:
1. Daʼvo arizasining javobgar uchun nusxasi.
2. {{ilova}}
${IMZO}`,
  },
];
