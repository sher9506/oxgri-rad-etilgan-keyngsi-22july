// Protsessual hujjatlar: apellyatsiya, kassatsiya, daʼvoni taʼminlash, muddatni tiklash, sud buyrugʻini bekor qilish,
// davlat ijrochisi ustidan shikoyat.
// Tuzilma Adliya vazirligi "Adolat" markazi Legal Tech namunalariga mos (yurxizmat.uz/oz/document/275, 2029, 2298, 2349, 2607, 2082).
// Moddalar lex.uz da 2026-10 holatiga tekshirilgan: FPK — https://lex.uz/uz/acts/3517337,
// "Sud hujjatlari va boshqa organlar hujjatlarini ijro etish toʻgʻrisida"gi Qonun — https://lex.uz/uz/acts/26477.
import type { Field, Shablon } from './shablonlar-data';

const f = (key: string, label: string, placeholder?: string, multiline?: boolean): Field =>
  ({ key, label, placeholder, multiline });

const SANA = f('sana', 'Hujjat sanasi', new Date().toLocaleDateString('uz-UZ'));

// FPK 386, 406-moddalar: shikoyat yuqori instansiya nomiga yoʻllanadi, lekin qarorni qabul qilgan sud orqali beriladi (385, 405-moddalar).
const SHIKOYAT_SUD: Field[] = [
  f('yuqoriSud', 'Shikoyat yoʻllanayotgan sud (sudlov hayʼati)', 'Toshkent shahar sudining fuqarolik ishlari boʻyicha sudlov hayʼati'),
  f('sud', 'Hal qiluv qarorini qabul qilgan sud', 'Yunusobod tumanlararo sudi'),
  f('ishRaqami', 'Ish raqami', '2-1001-2601/1234'),
  f('qarorSana', 'Hal qiluv qarori qabul qilingan sana', '15.09.2026'),
];

export const PROTSESS_SHABLONLAR: Shablon[] = [
  {
    id: 'apellyatsiya-shikoyati',
    title: 'Apellyatsiya shikoyati',
    short: 'FPK 383, 372², 399-moddalar. Kuchga kirmagan qaror ustidan (muddat — 1 oy).',
    fields: [...SHIKOYAT_SUD,
      f('shikoyatchi', 'Shikoyat beruvchining F.I.O.si'),
      f('manzil', 'Shikoyat beruvchining manzili', 'viloyat, tuman (shahar), MFY, koʻcha nomi va uy raqami'),
      f('telefon', 'Shikoyat beruvchining telefon raqami', '+998 90 123 45 67'),
      f('ishHolatlari', 'Daʼvo arizasida bayon qilingan ish holatlari', 'daʼvo arizasining qisqacha mazmuni', true),
      f('davoTalabi', 'Daʼvogarning daʼvo talabi'),
      f('davoAsoslari', 'Daʼvo arizasiga asos sifatida koʻrsatilgan holatlar', 'asos sifatida koʻrsatilgan holatlar batafsil bayon qilinadi', true),
      f('dalillar', 'Daʼvogarning vajlarini sud majlisida isbotlagan dalillar', undefined, true),
      f('inobatgaOlinmagan', 'Sud inobatga olmagan holatlar', undefined, true),
      f('buzilganNormalar', 'Sud tomonidan buzilgan yoki notoʻgʻri qoʻllanilgan normalar', 'qaysi normalarning qanday talablari buzilganligi batafsil yoziladi', true),
      f('qoshimchaTalab', 'Hal qiluv qarorini bekor qilishdan tashqari talab', 'yangi hal qiluv qarori chiqarishni / arizani koʻrmasdan qoldirishni / ish yuritishni tugatishni'),
      f('ilova', 'Ilova qilinayotgan boshqa hujjatlar', 'ilovada koʻrsatilganlardan boshqa hujjatlar nomi', true),
      SANA],
    body: `{{yuqoriSud}}ga
({{sud}} orqali)

Shikoyat beruvchi: {{shikoyatchi}}
Manzil: {{manzil}}
Telefon: {{telefon}}

APELLYATSIYA SHIKOYATI
(Fuqarolik ishlari boʻyicha {{sud}}ning {{qarorSana}}dagi {{ishRaqami}}-sonli ish boʻyicha hal qiluv qarori ustidan)

Quyidagilarga koʻra, fuqarolik ishlari boʻyicha {{sud}}ning {{qarorSana}}dagi hal qiluv qarorini qonun talablari buzilgan holda qabul qilingan deb hisoblayman.

Men daʼvo arizamda {{ishHolatlari}} ekanligini koʻrsatib, suddan {{davoTalabi}}ni soʻraganman va daʼvo talablarimning asosi sifatida {{davoAsoslari}}ni keltirganman.

Shuningdek, vajlarimning asosli ekanligi sud majlisida {{dalillar}} kabi dalillar bilan ham oʻz tasdigʻini topdi.

Biroq sud {{inobatgaOlinmagan}}ni inobatga olmasdan, notoʻgʻri xulosaga kelgan.

Ishni koʻrishda sud tomonidan quyidagi normalar buzilib, notoʻgʻri qoʻllanilgan. Jumladan, {{buzilganNormalar}}.

Fuqarolik protsessual kodeksining 383-moddasiga koʻra, taraflar va ishda ishtirok etishga jalb qilingan boshqa shaxslar, shuningdek ishda ishtirok etishga jalb qilinmagan, ammo huquq va majburiyatlari haqidagi masala sud tomonidan hal etilgan shaxslar, shuningdek Oʻzbekiston Respublikasi Prezidenti huzuridagi Tadbirkorlik subyektlarining huquqlari va qonuniy manfaatlarini himoya qilish boʻyicha vakil sudning qonuniy kuchga kirmagan hal qiluv qarori, ajrimi, qarori ustidan apellyatsiya tartibida shikoyat qilishi mumkin, bundan tadbirkorlik faoliyati bilan bogʻliq boʻlmagan nizolar mustasno.

Fuqarolik protsessual kodeksining 372²-moddasiga koʻra, sud hujjatini apellyatsiya tartibida bekor qilish yoki oʻzgartirish uchun quyidagilar asos boʻlishi mumkin:
1) ish uchun ahamiyatga ega boʻlgan holatlarning toʻliq aniqlanmaganligi;
2) sud aniqlangan deb hisoblagan, ish uchun ahamiyatga ega boʻlgan holatlarning isbotlanmaganligi;
3) sud hujjatida bayon etilgan sud xulosalarining ish holatlariga muvofiq emasligi;
4) bildirilgan talab boʻyicha sud tomonidan sud hujjatining qabul qilinmaganligi;
5) moddiy va protsessual huquq normalarining buzilganligi yoki notoʻgʻri qoʻllanilganligi.

Mazkur holatda sud tomonidan ish uchun ahamiyatga ega boʻlgan holatlarning toʻliq aniqlanmaganligi, sud aniqlangan deb hisoblagan, ish uchun ahamiyatga ega boʻlgan holatlarning isbotlanmaganligi, sud hujjatida bayon etilgan sud xulosalarining ish holatlariga muvofiq emasligi, moddiy va protsessual huquq normalarining buzilganligi yoki notoʻgʻri qoʻllanilganligi sababli hal qiluv qarorini bekor qilish (oʻzgartirish) lozim boʻladi.

Bayon etilganlardan kelib chiqib, Fuqarolik protsessual kodeksining 372², 383, 386, 399-moddalariga asoslanib, apellyatsiya instansiyasi sudidan

SOʻRAYMAN:
Fuqarolik ishlari boʻyicha {{sud}}ning {{qarorSana}}dagi {{ishRaqami}}-sonli ish boʻyicha hal qiluv qarorini bekor qilishingizni va {{qoshimchaTalab}}.

Ilova:
1. Davlat boji va pochta xarajatlari toʻlanganligini tasdiqlovchi hujjat.
2. Apellyatsiya shikoyatining ishda ishtirok etuvchi shaxslar soniga qarab koʻchirma nusxalari.
3. Apellyatsiya shikoyati vakil tomonidan imzolangan taqdirda — uni imzolashga vakilning vakolatlarini tasdiqlovchi hujjat.
4. Apellyatsiya shikoyatidagi vajlarni tasdiqlovchi, ilgari sudga taqdim qilinmagan boshqa hujjatlar.
5. {{ilova}}

Daʼvogar {{shikoyatchi}} ___________ (imzo)
{{sana}} yil.`,
  },
  {
    id: 'kassatsiya-shikoyati',
    title: 'Kassatsiya shikoyati (fuqarolik sudiga)',
    short: 'FPK 403, 405, 419-moddalar. Apellyatsiyada koʻrilmagan qaror ustidan (6 oy).',
    fields: [...SHIKOYAT_SUD,
      f('shikoyatchi', 'Shikoyat beruvchining F.I.O.si'),
      f('manzil', 'Shikoyat beruvchining manzili'),
      f('davogar', 'Ish boʻyicha daʼvogar'),
      f('javobgar', 'Ish boʻyicha javobgar'),
      f('davoTalabi', 'Daʼvo talabi mazmuni', 'qarz summasini undirish'),
      f('qarorMazmuni', 'Sudning hal qiluv qarori mazmuni', 'daʼvoni qanoatlantirishni rad etish'),
      f('noqonuniyAsos', 'Hal qiluv qarori qaysi asoslarga koʻra noqonuniy', 'sud qarori nima sababdan noqonuniy deb hisoblanayotgani yoziladi', true),
      f('yangiQaror', 'Soʻralayotgan yangi hal qiluv qarorining qisqacha mazmuni', 'daʼvoni toʻliq qanoatlantirish'),
      f('ilova', 'Ilova qilinayotgan boshqa hujjatlar', undefined, true),
      SANA],
    body: `{{yuqoriSud}}ga
({{sud}} orqali)

{{manzil}}da yashovchi
{{shikoyatchi}} tomonidan

KASSATSIYA SHIKOYATI
({{sud}}ning {{qarorSana}}dagi {{ishRaqami}}-sonli ish boʻyicha hal qiluv qarori yuzasidan)

Daʼvogar {{davogar}} javobgar {{javobgar}}ga nisbatan {{davoTalabi}} toʻgʻrisidagi daʼvo arizasi bilan {{sud}}ga murojaat qilgan. Sud {{qarorSana}} kuni {{qarorMazmuni}} toʻgʻrisida hal qiluv qarori qabul qilgan.

Men quyidagilarga asosan ushbu qarordan noroziman: {{noqonuniyAsos}}

Oʻzbekiston Respublikasi Fuqarolik protsessual kodeksining 403-moddasiga koʻra, taraflar va ishda ishtirok etuvchi boshqa shaxslar, ishda ishtirok etishga jalb qilinmagan, ammo huquq va majburiyatlari haqidagi masala sud tomonidan hal etilgan shaxslar, shuningdek Oʻzbekiston Respublikasi Prezidenti huzuridagi Tadbirkorlik subyektlarining huquqlari va qonuniy manfaatlarini himoya qilish boʻyicha vakil, bundan tadbirkorlik faoliyati bilan bogʻliq boʻlmagan nizolar mustasno, sudning qonuniy kuchga kirgan va apellyatsiya tartibida koʻrilmagan hal qiluv qarori, ajrimi, qarori ustidan kassatsiya shikoyati berishi mumkin.

Mazkur Kodeksning 405-moddasiga koʻra, kassatsiya shikoyati (protesti) kassatsiya instansiyasi sudining nomiga yoʻllanadi, lekin hal qiluv qarorini, ajrimni, qarorni qabul qilgan sudga beriladi. Sud hujjatini qabul qilgan sud kassatsiya shikoyati (protesti) kelib tushgan kundan eʼtiboran besh kunlik muddatda uni kassatsiya instansiyasi sudiga ish bilan birga yuborishi shart.

Ushbu Kodeksning 419-moddasiga koʻra, kassatsiya instansiyasining sudi kassatsiya shikoyatini (protestini) koʻrish natijalari boʻyicha hal qiluv qarorini, ajrimni, qarorni toʻliq yoki qisman bekor qilishga va yangi hal qiluv qarori, ajrim yoki qaror qabul qilishga, hal qiluv qarorini, ajrimni, qarorni toʻliq yoki qisman oʻzgartirishga, hal qiluv qarorini toʻliq yoki qisman bekor qilishga va arizani koʻrmasdan qoldirishga yoxud ish yuritishni toʻliq yoki qisman tugatishga haqli.

Biroq birinchi instansiya sudi yuqoridagi qonun talablariga rioya qilmagan. Chunki sud ish holatlarini toʻliq oʻrganmadi.

Shuningdek, Fuqarolik protsessual kodeksining 72-moddasiga koʻra, har bir taraf oʻzining talablari va eʼtirozlariga asos qilib koʻrsatgan holatlarni isbotlashi shart. Biroq sud ushbu qonun talabiga rioya qilmadi.

Fuqarolik protsessual kodeksining 372²-moddasiga koʻra, ish uchun ahamiyatga ega boʻlgan holatlarning toʻliq aniqlanmaganligi, sud aniqlangan deb hisoblagan, ish uchun ahamiyatga ega boʻlgan holatlarning isbotlanmaganligi, sud hujjatida bayon etilgan sud xulosalarining ish holatlariga muvofiq emasligi, moddiy va protsessual huquq normalarining buzilganligi yoki notoʻgʻri qoʻllanilganligi sud hujjatini bekor qilish yoki oʻzgartirish uchun asos boʻladi.

Yuqoridagilardan hamda Fuqarolik protsessual kodeksining 72, 372², 403, 419-moddalaridan kelib chiqqan holda

SOʻRAYMAN:
1. {{sud}}ning {{qarorSana}}dagi {{ishRaqami}}-sonli ish boʻyicha hal qiluv qarorini bekor qilishingizni;
2. {{yangiQaror}} haqida yangi hal qiluv qarori qabul qilishingizni.

Ilova:
1. Davlat boji va pochta xarajatlari toʻlanganligini tasdiqlovchi hujjat.
2. Kassatsiya shikoyatining ishda ishtirok etuvchi shaxslar soniga qarab koʻchirma nusxalari.
3. Kassatsiya shikoyati vakil tomonidan imzolangan hollarda — uni imzolashga vakilning vakolatlarini tasdiqlovchi hujjat.
4. {{ilova}}

{{shikoyatchi}} ___________ (imzo)
{{sana}} yil.`,
  },
  {
    id: 'davoni-taminlash',
    title: 'Daʼvoni taʼminlash choralarini koʻrish toʻgʻrisida ariza',
    short: 'FPK 105–107-moddalar. Mol-mulkni xatlash, harakatlarni taqiqlash va boshqalar.',
    fields: [
      f('sud', 'Ariza berilgan sud', 'Yunusobod tumanlararo sudi'),
      f('arizachi', 'Ariza beruvchining F.I.O.si'),
      f('manzil', 'Ariza beruvchining yashash manzili'),
      f('javobgar', 'Javobgar (tashkiliy-huquqiy shakli va nomi yoki F.I.O.)', '«Namuna» MCHJ'),
      f('davoMazmuni', 'Daʼvo arizasining mazmuni', 'qarz summasini undirish'),
      f('chora', 'Soʻralayotgan daʼvoni taʼminlash chorasi', 'javobgarga tegishli mol-mulkni (pul mablagʻlarini) daʼvo bahosi doirasida xatlash'),
      f('zarurat', 'Chora koʻrilmasa qaror ijrosi nega qiyinlashadi', 'javobgar mol-mulkini begonalashtirishga harakat qilmoqda', true),
      SANA],
    body: `Fuqarolik ishlari boʻyicha {{sud}}ga

{{manzil}}da yashovchi
{{arizachi}}dan

ARIZA
(daʼvoni taʼminlash choralarini koʻrish toʻgʻrisida)

Fuqarolik ishlari boʻyicha {{sud}}ning ish yurituvida mening javobgar {{javobgar}}ga nisbatan {{davoMazmuni}} haqidagi daʼvo arizam yuzasidan yuritilayotgan fuqarolik ishi mavjud.

Oʻzbekiston Respublikasi Fuqarolik protsessual kodeksining 105-moddasiga koʻra, agar daʼvoni taʼminlash choralarini koʻrmaslik sud hujjati ijrosini qiyinlashtirsa yoki uni bajarib boʻlmaydigan qilib qoʻysa, sud (sudya) ishda ishtirok etuvchi shaxslarning arizasi boʻyicha daʼvoni taʼminlash choralarini koʻrishi mumkin. Daʼvoni taʼminlash choralari koʻrilmasa, hal qiluv qarorining ijrosi qiyinlashadi, chunki {{zarurat}}.

Fuqarolik protsessual kodeksining 106-moddasiga koʻra, javobgarga tegishli boʻlgan va uning oʻzida yoki boshqa shaxsda turgan mol-mulkni yoxud pul mablagʻlarini xatlash, javobgar muayyan harakatlarni amalga oshirishini taqiqlash, boshqa shaxslarning javobgarga mol-mulk berishini yoki unga nisbatan boshqa majburiyatlarni bajarishini taqiqlash, mol-mulkni xatlashdan chiqarish toʻgʻrisida daʼvo arz qilingan taqdirda uni realizatsiya qilishni toʻxtatish, qarzdor ijro hujjati yuzasidan sud tartibida nizolashayotgan boʻlsa va agar bunday nizolashishga qonunchilikda yoʻl qoʻyilsa, bu hujjat boʻyicha undiruvni toʻxtatish, nizoli mol-mulk buzilishi, holati yomonlashishining oldini olish maqsadida javobgarga muayyan harakatlarni amalga oshirish majburiyatini yuklatish, nizoli mol-mulkni saqlash uchun uchinchi shaxsga (saqlovchiga) topshirish daʼvoni taʼminlash choralari boʻlishi mumkin; zarur hollarda sud (sudya) daʼvoni taʼminlash boʻyicha boshqa choralar ham koʻrishi mumkin.

Yuqoridagi qonunchilik hujjatlari talablaridan kelib chiqqan holda ish boʻyicha daʼvoni taʼminlash chorasi sifatida {{chora}}ni qoʻllash maqsadga muvofiq deb hisoblayman.

Javobgarning nomida boʻlgan mol-mulklarning hujjatlari va daʼvoni taʼminlashga asos boʻlgan dalillarni sudga taqdim etaman.

Yuqoridagilardan kelib chiqib, Oʻzbekiston Respublikasi Fuqarolik protsessual kodeksining 105, 106 va 107-moddalariga asoslanib,

SOʻRAYMAN:
Daʼvoni taʼminlash chorasi sifatida {{chora}}ni qoʻllashingizni.

Ilova:
1. Arizani asoslovchi hujjatlar.

{{arizachi}} ___________ (imzo)
{{sana}} yil.`,
  },
  {
    id: 'apellyatsiya-muddatini-tiklash',
    title: 'Apellyatsiya shikoyati berish muddatini tiklash toʻgʻrisida iltimosnoma',
    short: 'FPK 155, 385¹-moddalar. Uzrli sabab bilan oʻtkazilgan muddat (3 oygacha).',
    fields: [...SHIKOYAT_SUD,
      f('arizachi', 'Iltimosnoma beruvchining F.I.O.si'),
      f('manzil', 'Iltimosnoma beruvchining yashash manzili'),
      f('davogar', 'Ish boʻyicha daʼvogarning F.I.O.si'),
      f('javobgar', 'Ish boʻyicha javobgarning F.I.O.si'),
      f('davoMazmuni', 'Daʼvo arizasining mazmuni', 'qarz summasini undirish'),
      f('uzrliSabab', 'Muddat oʻtkazib yuborilishiga sabab boʻlgan uzrli holatlar', 'kasallik yoki boshqa holat', true),
      f('dalillar', 'Uzrli sababni isbotlovchi hujjatlar nomi', 'shifoxonadan maʼlumotnoma'),
      SANA],
    body: `{{yuqoriSud}}ga
({{sud}} orqali)

{{manzil}}da yashovchi
{{arizachi}}dan

ILTIMOSNOMA
(sudning hal qiluv qarori ustidan apellyatsiya shikoyati berish muddatini tiklash toʻgʻrisida)

Fuqarolik ishlari boʻyicha {{sud}}ning ish yurituvida boʻlgan daʼvogar {{davogar}}ning javobgar {{javobgar}}ga nisbatan {{davoMazmuni}} toʻgʻrisidagi daʼvo arizasi yuzasidan {{ishRaqami}}-sonli ish boʻyicha {{qarorSana}} kuni chiqarilgan hal qiluv qarori ustidan {{uzrliSabab}} sababli belgilangan muddatda apellyatsiya shikoyati bera olmadim.

Mening ushbu sabablarimning uzrli ekanligini {{dalillar}} kabi dalillar tasdiqlaydi.

Fuqarolik protsessual kodeksining 385¹-moddasiga koʻra, oʻtkazib yuborilgan muddat, agar iltimosnoma hal qiluv qarori qabul qilingan kundan eʼtiboran uch oydan kechiktirmay berilgan va muddatni oʻtkazib yuborish sabablari uzrli deb topilgan boʻlsa, apellyatsiya shikoyati berayotgan shaxsning iltimosnomasiga koʻra apellyatsiya instansiyasi sudining sudyasi tomonidan tiklanishi mumkin. Kodeksning 155-moddasiga muvofiq apellyatsiya shikoyati ushbu iltimosnoma bilan bir vaqtda berilmoqda.

Yuqoridagilardan kelib chiqib, Oʻzbekiston Respublikasi Fuqarolik protsessual kodeksining 155 va 385¹-moddalariga asoslanib,

SOʻRAYMAN:
{{sud}}ning {{qarorSana}}dagi {{ishRaqami}}-sonli ish boʻyicha hal qiluv qarori ustidan apellyatsiya shikoyati berishning oʻtkazib yuborilgan muddatini tiklashingizni.

Ilova:
1. Apellyatsiya shikoyati.
2. Iltimosnoma nusxasi.
3. Apellyatsiya shikoyati berish muddatini oʻtkazib yuborganlik sabablarini tasdiqlovchi hujjatlar.

{{arizachi}} ___________ (imzo)
{{sana}} yil.`,
  },
  {
    id: 'sud-buyrugini-bekor-qilish',
    title: 'Sud buyrugʻini bekor qilish toʻgʻrisida ariza (aliment)',
    short: 'FPK 170, 171, 181-moddalar. Aliment buyrugʻiga eʼtiroz (nusxadan 10 kun).',
    fields: [
      f('sud', 'Sud buyrugʻini bergan sud', 'Yunusobod tumanlararo sudi'),
      f('arizachi', 'Arizachining (qarzdorning) F.I.O.si'),
      f('manzil', 'Arizachining yashash manzili'),
      f('telefon', 'Arizachining telefon raqami', '+998 90 123 45 67'),
      f('email', 'Arizachining elektron manzili', 'ism@mail.uz'),
      f('buyruqSana', 'Sud buyrugʻi berilgan sana', '01.10.2026'),
      f('buyruqRaqam', 'Sud buyrugʻining (ishning) raqami'),
      f('nusxaSana', 'Sud buyrugʻi nusxasi olingan sana', '05.10.2026'),
      f('bolaSana', 'Bolaning tugʻilgan sanasi', '12.03.2020'),
      f('bola', 'Bolaning F.I.Sh.si'),
      f('undiruvchi', 'Sud buyrugʻi chiqarilishi toʻgʻrisida ariza bergan shaxsning (undiruvchining) F.I.Sh.si'),
      SANA],
    body: `Fuqarolik ishlari boʻyicha {{sud}}ga

{{manzil}}da yashovchi
{{arizachi}} tomonidan
Telefon: {{telefon}}
Elektron manzil: {{email}}

ARIZA
(sud buyrugʻini bekor qilish toʻgʻrisida)

Fuqarolik ishlari boʻyicha {{sud}}ning {{buyruqSana}}dagi {{buyruqRaqam}}-sonli sud buyrugʻiga asosan mendan {{bolaSana}}da tugʻilgan voyaga yetmagan {{bola}} ismli bolaning moddiy taʼminoti uchun aliment undirish belgilanib, {{undiruvchi}}ning arizasi qanoatlantirilgan. Men ushbu sud buyrugʻi qabul qilingan sud jarayonida qatnashmaganman. Sud buyrugʻining koʻchirma nusxasini {{nusxaSana}}da olganman.

Oʻzbekiston Respublikasi Fuqarolik protsessual kodeksining 170-moddasiga koʻra, sud buyrugʻi nizosiz talablar boʻyicha sud muhokamasi oʻtkazmasdan berilgan sud hujjatidir. Kodeksning 171-moddasi 4-bandiga koʻra, voyaga yetmagan bolalar uchun aliment undirish toʻgʻrisidagi talab boʻyicha sud buyrugʻi faqat ushbu talab otalikni belgilash bilan bogʻliq boʻlmagan hollarda beriladi.

Men va sud buyrugʻi qabul qilinishida arizachi sifatida qatnashgan {{undiruvchi}} oʻrtamizda {{bolaSana}}da tugʻilgan voyaga yetmagan {{bola}}ga nisbatan otalikni belgilash masalasida nizo mavjud. Men {{bola}}ni oʻz farzandim deb bilmayman.

Fuqarolik protsessual kodeksining 181-moddasiga koʻra, qarzdor arz qilingan talabga qarshi eʼtirozlarini buyruqni bergan sudga sud buyrugʻining koʻchirma nusxasini olgan kundan eʼtiboran oʻn kunlik muddatda yuborishga haqli. Bunday holda sudya sud buyrugʻini bekor qilib, bu haqda ajrim chiqaradi.

Yuqoridagilarga koʻra, Oʻzbekiston Respublikasi Fuqarolik protsessual kodeksining 3, 4, 170, 171, 181-moddalariga asosan

SOʻRAYMAN:
Fuqarolik ishlari boʻyicha {{sud}}ning {{buyruqSana}}dagi {{undiruvchi}} foydasiga {{bolaSana}}da tugʻilgan {{bola}} ismli bolaning moddiy taʼminoti uchun aliment undirish haqidagi {{buyruqRaqam}}-sonli sud buyrugʻini bekor qilishingizni.

Ilova:
1. Sud buyrugʻi nusxasi.
2. Arizani asoslovchi hujjatlar.

Arizachi {{arizachi}} ___________ (imzo)
{{sana}} yil.`,
  },
  {
    id: 'davlat-ijrochisi-ustidan-shikoyat',
    title: 'Davlat ijrochisining xatti-harakatlari (harakatsizligi) ustidan ariza-shikoyat',
    short: 'Ijro toʻgʻrisidagi Qonun 5, 7, 23, 30-moddalar. Ijro varaqasi bajarilmaganda.',
    fields: [
      f('hudud', 'Prokuratura joylashgan hudud', 'Toshkent shahar'),
      f('viloyat', 'Daʼvogar joylashgan viloyat nomi'),
      f('tuman', 'Daʼvogar joylashgan tuman (shahar) nomi'),
      f('kocha', 'Daʼvogar joylashgan koʻcha nomi'),
      f('uy', 'Daʼvogar joylashgan uy raqami'),
      f('sudIxtisosligi', 'Sud ixtisosligi', 'Iqtisodiy / Fuqarolik ishlari boʻyicha'),
      f('sudJoyi', 'Sud joylashgan tuman (shahar)', 'Yunusobod tumanlararo'),
      f('qarorSana', 'Hal qiluv qarori chiqarilgan sana', '15.06.2026'),
      f('davogarNomi', 'Daʼvogar tashkilotning nomi', 'Namuna'),
      f('davogarShakl', 'Daʼvogar tashkilotning tashkiliy-huquqiy shakli', 'MCHJ, XK, OK'),
      f('javobgarNomi', 'Javobgar tashkilotning nomi'),
      f('javobgarShakl', 'Javobgar tashkilotning tashkiliy-huquqiy shakli', 'MCHJ'),
      f('asosiyQarz', 'Asosiy qarz miqdori (soʻm)'),
      f('penya', 'Penya miqdori (soʻm)'),
      f('davlatBoji', 'Davlat boji miqdori (soʻm)'),
      f('pochta', 'Pochta xarajatlari miqdori (soʻm)'),
      f('ijroSana', 'Ijro varaqasi berilgan sana', '10.07.2026'),
      f('ijroRaqam', 'Ijro varaqasi raqami'),
      f('yuborilganSana', 'Ijro varaqasi majburiy ijro boʻlimiga yuborilgan sana', '15.07.2026'),
      f('mibBolim', 'Majburiy ijro boʻlimi (tuman (shahar) boʻlimi)', 'Yunusobod tuman boʻlimi'),
      f('rahbarLavozim', 'Daʼvogar tashkilot rahbarining lavozimi', 'direktor'),
      f('rahbar', 'Daʼvogar tashkilot rahbarining F.I.O.si'),
      SANA],
    body: `{{hudud}} prokuraturasiga

Manzili: {{viloyat}}, {{tuman}}, {{kocha}} koʻchasi, {{uy}}-uy

SHIKOYAT
(davlat ijrochisining xatti-harakatlari (harakatsizligi) ustidan)

{{sudIxtisosligi}} {{sudJoyi}} sudi tomonidan {{qarorSana}}da daʼvogar «{{davogarNomi}}» {{davogarShakl}}ning javobgar «{{javobgarNomi}}» {{javobgarShakl}} hisobidan {{asosiyQarz}} soʻm asosiy qarz, {{penya}} soʻm penya, {{davlatBoji}} soʻm davlat boji hamda {{pochta}} soʻm pochta xarajatlarini undirish toʻgʻrisidagi hal qiluv qarori qabul qilingan.

Mazkur hal qiluv qaroriga asosan {{ijroSana}}da {{ijroRaqam}}-sonli ijro varaqasi berilgan.

Oʻzbekiston Respublikasining “Sud hujjatlari va boshqa organlar hujjatlarini ijro etish toʻgʻrisida”gi Qonunining 5-moddasiga koʻra, fuqarolik ishlari boʻyicha sudlarning, iqtisodiy va maʼmuriy sudlarning hal qiluv qarorlari, ajrimlari va qarorlari ijro etilishi lozim. Shuningdek, ushbu Qonunning 7-moddasiga binoan sudlar oʻzlari qabul qiladigan sud hujjatlari asosida beradigan ijro varaqalari ijro hujjatlari hisoblanadi.

Xususan, Qonunning 23-moddasiga koʻra, davlat ijrochisi ijro hujjatini suddan yoki uni bergan boshqa organdan yoxud undiruvchidan ijro uchun qabul qilib olishi va ijro ishi yuritishni qoʻzgʻatishi shart.

Yuqoridagi ijro varaqasi {{yuborilganSana}}da Oʻzbekiston Respublikasi Bosh prokuraturasi huzuridagi Majburiy ijro byurosi {{mibBolim}}ga pochta orqali yuborilgan.

Oʻzbekiston Respublikasining “Sud hujjatlari va boshqa organlar hujjatlarini ijro etish toʻgʻrisida”gi Qonunining 23-moddasiga asosan, davlat ijrochisi ijro hujjatini olgan paytdan eʼtiboran bir ish kuni ichida ijro ishi yuritishni qoʻzgʻatish toʻgʻrisida qaror chiqaradi. Shuningdek, ushbu Qonunning 30-moddasiga koʻra, ijro harakatlari va ijro hujjatining talablari ijro hujjatining ixtiyoriy ijro etilishi uchun ijro ishi yuritishni qoʻzgʻatish toʻgʻrisidagi qarorda belgilangan muddat tugagan kundan eʼtiboran koʻpi bilan ikki oy muddat ichida davlat ijrochisi tomonidan amalga oshirilishi va ijro etilishi kerak.

Ammo {{ijroRaqam}}-sonli ijro varaqasi bugungi kunga qadar ijro etilmasdan kelmoqda.

Yuqoridagilarga hamda Oʻzbekiston Respublikasining “Sud hujjatlari va boshqa organlar hujjatlarini ijro etish toʻgʻrisida”gi Qonunining 5, 7, 23, 30-moddalariga asosan,

SOʻRAYMAN:
1. {{ijroSana}}dagi {{ijroRaqam}}-sonli ijro varaqasini ijro etishda amaliy yordam berishingizni;
2. Ushbu ijro ishi yuzasidan qabul qilinadigan barcha hujjatlarni quyidagi manzilga, yaʼni {{viloyat}}, {{tuman}}, {{kocha}} koʻchasi, {{uy}}-uyga yuborishingizni.

Ilova:
1. {{yuborilganSana}}da Oʻzbekiston Respublikasi Bosh prokuraturasi huzuridagi Majburiy ijro byurosi {{mibBolim}}ga yuborilgan xat nusxasi.

«{{davogarNomi}}» {{davogarShakl}}
{{rahbarLavozim}} {{rahbar}} ___________ (imzo)
{{sana}} yil.`,
  },
];
