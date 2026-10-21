// shablonlar — "Ariza namunalari" uchun shablon ma'lumotlari va .docx yig'uvchi
import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

export interface Field {
  key: string;
  label: string;
  multiline?: boolean;
  placeholder?: string;
}

export interface Shablon {
  id: string;
  title: string;
  short: string;
  fields: Field[];
  body: string; // {{key}} o'rinbosarlar
}

const F = {
  sud: { key: 'sud', label: 'Sud nomi', placeholder: 'Toshkent shahar Yunusobod tumanlararo sudi' },
  davogar: { key: 'davogar', label: "Da'vogar F.I.Sh." },
  davogarManzil: { key: 'davogarManzil', label: "Da'vogar manzili" },
  davogarTel: { key: 'davogarTel', label: "Da'vogar telefoni" },
  javobgar: { key: 'javobgar', label: 'Javobgar (nomi / F.I.Sh.)' },
  javobgarManzil: { key: 'javobgarManzil', label: 'Javobgar manzili' },
  summa: { key: 'summa', label: "Da'vo summasi (so'm)" },
  sana: { key: 'sana', label: 'Ariza sanasi', placeholder: new Date().toLocaleDateString('uz-UZ') },
  holat: { key: 'holat', label: 'Vaziyat bayoni (qisqacha)', multiline: true },
};

const HEADER = `{{sud}}ga

Da'vogar: {{davogar}}
Manzil: {{davogarManzil}}
Tel.: {{davogarTel}}

Javobgar: {{javobgar}}
Manzil: {{javobgarManzil}}
`;

const SIGN = `
{{sana}}                                       ____________ {{davogar}}`;

export const SHABLONLAR: Shablon[] = [
  {
    id: 'ishga-tiklash',
    title: "Ishga tiklash va majburiy progul uchun ish haqini undirish to'g'risida da'vo arizasi",
    short: "Mehnat kodeksi. Noqonuniy ishdan bo'shatilganda.",
    fields: [F.sud, F.davogar, F.davogarManzil, F.davogarTel, F.javobgar, F.javobgarManzil,
      { key: 'lavozim', label: 'Lavozim' }, { key: 'ishgaKirgan', label: 'Ishga qabul qilingan sana' },
      { key: 'boshatilgan', label: "Bo'shatilgan sana va buyruq raqami" }, { key: 'oylik', label: "O'rtacha oylik ish haqi (so'm)" },
      F.holat, F.sana],
    body: `${HEADER}
DA'VO ARIZASI
(ishga tiklash va majburiy progul vaqti uchun ish haqini undirish to'g'risida)

Men, {{davogar}}, {{ishgaKirgan}} dan boshlab javobgar {{javobgar}}da {{lavozim}} lavozimida mehnat shartnomasi asosida ishlab kelganman. {{boshatilgan}} buyruq bilan mehnat shartnomam bekor qilindi.

{{holat}}

Mehnat shartnomasi qonuniy asossiz bekor qilingan deb hisoblayman, chunki ishdan bo'shatish uchun qonunda nazarda tutilgan asos va tartibga rioya etilmagan.

O'zbekiston Respublikasi Mehnat kodeksining 558-moddasiga ko'ra ishga tiklash to'g'risidagi nizolar bevosita sudda ko'rib chiqiladi; 560-moddasiga muvofiq sudga murojaat muddati saqlanadi. Mehnat kodeksining 561-moddasiga ko'ra mehnat shartnomasi qonuniy asossiz bekor qilingan xodim avvalgi ishiga tiklanadi va unga majburiy progul vaqti uchun o'rtacha ish haqi to'lanadi. O'rtacha oylik ish haqim {{oylik}} so'mni tashkil etadi.

Yuqoridagilarga asoslanib, Mehnat kodeksining 558, 560, 561-moddalari va Fuqarolik protsessual kodeksining 189–191-moddalariga muvofiq,

SO'RAYMAN:
1. Javobgar {{javobgar}}ning {{boshatilgan}} buyrug'i noqonuniy deb topilsin.
2. Men {{davogar}} avvalgi {{lavozim}} lavozimiga ishga tiklanishim.
3. Javobgardan majburiy progul vaqti uchun o'rtacha ish haqi undirilsin.

Ilovalar:
1. Da'vo arizasining javobgar uchun nusxasi.
2. Mehnat shartnomasi (mehnat daftarchasi) nusxasi.
3. Ishga qabul qilish va bo'shatish to'g'risidagi buyruqlar nusxasi.
4. Ish haqi to'g'risida ma'lumotnoma.
5. Pasport nusxasi.
${SIGN}`,
  },
  {
    id: 'aliment',
    title: "Aliment undirish to'g'risida da'vo arizasi",
    short: 'Oila kodeksi. Voyaga yetmagan bola uchun.',
    fields: [F.sud, F.davogar, F.davogarManzil, F.davogarTel, F.javobgar, F.javobgarManzil,
      { key: 'bola', label: "Bola(lar) F.I.Sh. va tug'ilgan sanasi", multiline: true },
      { key: 'ulush', label: 'Undiriladigan ulush', placeholder: '1/4 (bir bola), 1/3 (ikki), 1/2 (uch va undan ko\'p)' },
      F.holat, F.sana],
    body: `${HEADER}
DA'VO ARIZASI
(voyaga yetmagan bola uchun aliment undirish to'g'risida)

Javobgar {{javobgar}} bilan birgalikda quyidagi voyaga yetmagan farzand(lar)imiz bor:
{{bola}}

{{holat}}

Bola(lar) mening qaramog'imda, javobgar ularni moddiy ta'minlashda ixtiyoriy ravishda ishtirok etmayapti.

O'zbekiston Respublikasi Oila kodeksining 96-moddasiga ko'ra ota-ona voyaga yetmagan bolalarini ta'minlashga majburdir. Oila kodeksining 99-moddasiga muvofiq aliment ota-onaning ish haqi va boshqa daromadlaridan bir bola uchun to'rtdan bir, ikki bola uchun uchdan bir, uch va undan ko'p bola uchun yarmi miqdorida undiriladi.

Yuqoridagilarga asoslanib, Oila kodeksining 96, 99-moddalari va Fuqarolik protsessual kodeksining 189–191-moddalariga muvofiq,

SO'RAYMAN:
Javobgar {{javobgar}}dan voyaga yetmagan farzand(lar)imiz foydasiga barcha turdagi daromadlarining {{ulush}} qismi miqdorida, da'vo berilgan kundan boshlab bola(lar) voyaga yetguniga qadar har oyda aliment undirilsin.

Ilovalar:
1. Da'vo arizasining javobgar uchun nusxasi.
2. Bola(lar)ning tug'ilganlik guvohnomasi nusxasi.
3. Nikoh (ajralish) guvohnomasi nusxasi.
4. Bola(lar) da'vogar qaramog'ida ekanligi to'g'risida ma'lumotnoma.
5. Pasport nusxasi.
${SIGN}`,
  },
  {
    id: 'ish-haqi',
    title: "Ish haqini undirish to'g'risida da'vo arizasi",
    short: "Mehnat kodeksi. To'lanmagan ish haqi uchun.",
    fields: [F.sud, F.davogar, F.davogarManzil, F.davogarTel, F.javobgar, F.javobgarManzil,
      { key: 'lavozim', label: 'Lavozim' }, { key: 'davr', label: "To'lanmagan davr", placeholder: '2026-yil mart – iyun' },
      F.summa, F.holat, F.sana],
    body: `${HEADER}
DA'VO ARIZASI
(ish haqini undirish to'g'risida)

Men, {{davogar}}, javobgar {{javobgar}}da {{lavozim}} lavozimida mehnat shartnomasi asosida ishlaganman. {{davr}} davri uchun menga jami {{summa}} so'm ish haqi to'lanmagan.

{{holat}}

O'zbekiston Respublikasi Mehnat kodeksining 253-moddasiga ko'ra ish haqi belgilangan muddatlarda to'lanishi shart. Mehnat kodeksining 333-moddasiga muvofiq ish beruvchi ish haqi va boshqa to'lovlarni kechiktirganlik uchun moddiy javobgar bo'ladi. Mehnat kodeksining 558-moddasiga ko'ra ushbu nizo bevosita sudda ko'rib chiqiladi.

Yuqoridagilarga asoslanib, Mehnat kodeksining 253, 333, 558-moddalari va Fuqarolik protsessual kodeksining 189–191-moddalariga muvofiq,

SO'RAYMAN:
1. Javobgar {{javobgar}}dan mening foydamga {{davr}} davri uchun to'lanmagan ish haqi {{summa}} so'm undirilsin.
2. Ish haqini kechiktirganlik uchun qonunda nazarda tutilgan kompensatsiya undirilsin.

Ilovalar:
1. Da'vo arizasining javobgar uchun nusxasi.
2. Mehnat shartnomasi nusxasi.
3. Ish haqi hisob-kitobi (ma'lumotnoma, hisob varaqalari).
4. Pasport nusxasi.
${SIGN}`,
  },
  {
    id: 'mehnat-inspeksiya',
    title: 'Davlat mehnat inspeksiyasiga shikoyat',
    short: 'Ish beruvchi mehnat qonunchiligini buzganda.',
    fields: [
      { key: 'organ', label: 'Inspeksiya nomi', placeholder: 'Toshkent shahar Davlat mehnat inspeksiyasi' },
      F.davogar, F.davogarManzil, F.davogarTel,
      { key: 'ishBeruvchi', label: 'Ish beruvchi nomi va manzili' }, { key: 'lavozim', label: 'Lavozim' },
      { key: 'buzilish', label: 'Qaysi huquqlar buzilgan', multiline: true, placeholder: "Ish haqi kechiktirilgan, mehnat shartnomasi rasmiylashtirilmagan..." },
      F.sana],
    body: `{{organ}}ga

Shikoyat beruvchi: {{davogar}}
Manzil: {{davogarManzil}}
Tel.: {{davogarTel}}

SHIKOYAT

Men, {{davogar}}, {{ishBeruvchi}}da {{lavozim}} lavozimida ishlayman (ishlaganman).

Ish beruvchi tomonidan mening mehnat huquqlarim quyidagicha buzilmoqda:
{{buzilish}}

Ish beruvchiga og'zaki va yozma murojaat qilganimga qaramay, buzilish bartaraf etilmadi.

O'zbekiston Respublikasi Mehnat kodeksi va "Jismoniy va yuridik shaxslarning murojaatlari to'g'risida"gi Qonunga asoslanib,

SO'RAYMAN:
1. Ish beruvchi {{ishBeruvchi}} faoliyatida mehnat qonunchiligiga rioya etilishi tekshirilsin.
2. Aniqlangan buzilishlarni bartaraf etish yuzasidan ish beruvchiga majburiy ko'rsatma berilsin va aybdor shaxslar javobgarlikka tortilsin.
3. Ko'rilgan choralar haqida menga yozma javob yuborilsin.

Ilovalar:
1. Mehnat shartnomasi (buyruq) nusxasi.
2. Buzilishni tasdiqlovchi hujjatlar.
3. Pasport nusxasi.
${SIGN}`,
  },
  {
    id: 'istemolchi',
    title: "Sifatsiz tovar uchun pulni qaytarish to'g'risida da'vo arizasi",
    short: "Iste'molchilar huquqlarini himoya qilish.",
    fields: [F.sud, F.davogar, F.davogarManzil, F.davogarTel, F.javobgar, F.javobgarManzil,
      { key: 'tovar', label: 'Tovar nomi' }, { key: 'xaridSana', label: 'Xarid sanasi va chek raqami' },
      { key: 'narx', label: "Tovar narxi (so'm)" }, { key: 'nuqson', label: 'Aniqlangan nuqson', multiline: true },
      F.sana],
    body: `${HEADER}
DA'VO ARIZASI
(sifatsiz tovarni qaytarib, to'langan pulni undirish to'g'risida)

Men, {{davogar}}, {{xaridSana}} javobgar {{javobgar}}dan {{narx}} so'mga {{tovar}} xarid qildim.

Foydalanish jarayonida tovarda quyidagi nuqson aniqlandi:
{{nuqson}}

Javobgarga tovarni qaytarib, pulni qaytarish talabi bilan murojaat qildim, biroq talabim qondirilmadi.

O'zbekiston Respublikasining "Iste'molchilarning huquqlarini himoya qilish to'g'risida"gi Qonuniga ko'ra sifatsiz tovar sotilganda iste'molchi shartnomani bekor qilib, to'langan pulni qaytarishni talab qilishga haqli, sotuvchi esa talabni qonunda belgilangan muddatda qondirishi shart. Fuqarolik kodeksiga muvofiq sotuvchi tovarning sifati uchun javob beradi. Iste'molchilar huquqlarini himoya qilish to'g'risidagi da'volar bo'yicha da'vogar davlat bojini to'lashdan ozod.

Yuqoridagilarga asoslanib, Fuqarolik protsessual kodeksining 189–191-moddalariga muvofiq,

SO'RAYMAN:
1. {{tovar}} oldi-sotdi shartnomasi bekor qilinsin.
2. Javobgar {{javobgar}}dan mening foydamga tovar uchun to'langan {{narx}} so'm undirilsin.
3. Talabni ixtiyoriy qondirmaganlik uchun qonunda nazarda tutilgan neustoyka va ma'naviy zarar undirilsin.

Ilovalar:
1. Da'vo arizasining javobgar uchun nusxasi.
2. Chek (to'lov hujjati) nusxasi.
3. Kafolat taloni, tovar pasporti nusxasi.
4. Javobgarga yuborilgan talabnoma va javob (bo'lsa).
5. Pasport nusxasi.
${SIGN}`,
  },
  {
    id: 'qarz',
    title: "Qarzni undirish to'g'risida da'vo arizasi",
    short: 'Fuqarolik kodeksi. Qarz shartnomasi / tilxat bo\'yicha.',
    fields: [F.sud, F.davogar, F.davogarManzil, F.davogarTel, F.javobgar, F.javobgarManzil,
      { key: 'qarzSana', label: 'Qarz berilgan sana' }, F.summa,
      { key: 'muddat', label: 'Qaytarish muddati' }, F.holat, F.sana],
    body: `${HEADER}
DA'VO ARIZASI
(qarz shartnomasi bo'yicha qarzni undirish to'g'risida)

{{qarzSana}} men, {{davogar}}, javobgar {{javobgar}}ga {{summa}} so'm qarz berdim, bu tilxat (qarz shartnomasi) bilan tasdiqlanadi. Javobgar qarzni {{muddat}} gacha qaytarishi lozim edi.

{{holat}}

Belgilangan muddat o'tganiga qaramay javobgar qarzni qaytarmadi.

O'zbekiston Respublikasi Fuqarolik kodeksining 732-moddasiga ko'ra qarz shartnomasi bo'yicha qarz oluvchi olingan summani qaytarishi shart. Fuqarolik kodeksining 734-moddasi qarz shartnomasi bo'yicha foizlarni, 736-moddasi qarz oluvchi shartnomani buzganlik oqibatlarini, 327-moddasi esa pul majburiyatini bajarmaganlik uchun javobgarlikni nazarda tutadi.

Yuqoridagilarga asoslanib, Fuqarolik kodeksining 327, 732, 734, 736-moddalari va Fuqarolik protsessual kodeksining 189–191-moddalariga muvofiq,

SO'RAYMAN:
1. Javobgar {{javobgar}}dan mening foydamga asosiy qarz {{summa}} so'm undirilsin.
2. Javobgardan pul majburiyatini bajarmaganlik uchun qonunda belgilangan foizlar undirilsin.
3. Javobgardan to'langan davlat boji undirilsin.

Ilovalar:
1. Da'vo arizasining javobgar uchun nusxasi.
2. Tilxat (qarz shartnomasi) nusxasi.
3. Davlat boji to'langanligi to'g'risida kvitansiya.
4. Pasport nusxasi.
${SIGN}`,
  },
];

export function renderMatn(sh: Shablon, values: Record<string, string>): string {
  return sh.body.replace(/\{\{(\w+)\}\}/g, (_, k) => values[k]?.trim() || '________');
}

export async function yuklabOlDocx(sh: Shablon, values: Record<string, string>) {
  const lines = renderMatn(sh, values).split('\n');
  const children = lines.map((line) => {
    const t = line.trim();
    const center = t === "DA'VO ARIZASI" || t === 'SHIKOYAT' || t === "SO'RAYMAN:" || (t.startsWith('(') && t.endsWith(')'));
    return new Paragraph({
      children: [new TextRun({ text: line.replace(/'/g, '’'), font: 'Times New Roman', size: 24, bold: center })],
      alignment: center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
      spacing: { after: 80 },
    });
  });
  const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
  saveAs(blob, `${sh.id}.docx`);
}
