---
name: hukm-live-quiz
description: FanFaster'da "Hukm" — Kahoot'ga bepul muqobil jonli viktorina. Ustoz savollar tuzadi yoki NotebookLM/CSV'dan import qiladi, PIN bilan o'yin ochadi, talabalar telefondan qo'shiladi, har savoldan keyin izoh va asos modda ko'rsatiladi. Hukm, viktorina, PIN bilan o'yin, savol import, host ekrani, o'yinchi ekrani, Kahoot o'rnini bosuvchi har qanday vazifada ishlat.
---

# Hukm — jonli viktorina (v1)

## Maqsad
Akademiyada Kahoot har darsda ishlatiladi, lekin bepul rejada o'yinchi soni juda cheklangan, tezlik uchun ball beradi (taxmin qilgan yutadi) va xato javobdan keyin hech narsa o'rgatmaydi. Hukm shularni tuzatadi: bepul, aniqlik tezlikdan muhim, har savoldan keyin "nega" va asos modda, natijalar ustozga to'liq ko'rinadi. Foydalanuvchi: huquqni muhofaza qilish akademiyasi ustozlari va talabalari. Ohang: jiddiy, ishonchli, lekin o'yin energiyasi bor. Bolalarcha emas (multfilm, konfetti, kamalak yo'q).

## Kahoot'dan nimani yaxshilaymiz (3 asosiy nuqson)
1. **Pulli devor.** Kahoot bepul rejasida o'yinchi soni juda kam va ilg'or savol turlari pulli. Hukm: o'yinchi soniga sun'iy chek yo'q, hamma savol turi bepul. Texnik chekni (Realtime/edge limiti) Bolt o'lchab hisobotda ochiq yozadi, o'ylab topmaydi.
2. **Tezlik taxminga mukofat beradi, xatodan keyin o'rganish yo'q.** Hukm: asosiy ball to'g'ri javobga, tezlik bonusi kichik va cheklangan (ustoz o'chirishi mumkin); har savoldan keyin "Nega?" izohi va asos modda; o'yin oxirida shaxsiy "Xatolar daftari".
3. **Anonimlik, botlar, natija kursga bog'lanmagan.** Kahoot'da PIN'ni bilgan istalgan kishi qo'shila oladi va botlar o'yinni buzadi. Hukm: to'g'ri javob o'yinchi qurilmasiga reveal'gacha HECH QACHON yuborilmaydi; vaqtni server o'lchaydi; ixtiyoriy "faqat FanFaster hisobi bilan" rejimi; ustoz haqiqiy ismlarni ko'radi.

Qo'shimcha ustunliklar: telefonda savol matni va variantlar to'liq ko'rinadi (faqat rangli shakl emas); NotebookLM'da tayyorlangan savollar tez import qilinadi; huquqiy savol turlari (Kazus, asos modda).

## Boshlashdan oldin (o'zgartirmasdan)
Mavjud kodni o'qi, taxmin qilma: routing (App/router), ustoz va talaba login mexanizmi (ustoz paneli qanday aniqlanadi), mavjud edge function'lar shabloni (`verify_jwt=false` qandag sozlangan), `ai-provider.ts` va `settings` o'qish mexanizmi, mavjud QR/audio/animatsiya kutubxonalari, dizayn tokenlari (ranglar, shrift, radius), Mini App'da ochilish holati. `hukm_` prefiksli jadval/route allaqachon bormi, tekshir. Ko'rmaganingni "noma'lum" de.

## Vakolat va xavfsizlik (ajralmas)
- Klientdan kelgan `talaba_id`, `ustoz_id`, `player_id` hech qachon vakolat emas.
- **Ustoz (host)**: o'yin yaratilganda server tasodifiy `host_token` (>= 32 bayt, CSPRNG) yaratadi, bazada FAQAT hash; token yaratgan brauzerga bir marta qaytadi. Host amallari (boshlash, keyingisi, tugatish, chiqarib yuborish) shu token bilan. Ustoz sifatida o'yin yaratish uchun mavjud ustoz login mexanizmi ishlatiladi (uni o'zgartirma; uning zaifligi alohida xavfsizlik bosqichiga tegishli, hisobotda bir qator bilan eslat).
- **O'yinchi**: qo'shilganda server `player_token` beradi (hash saqlanadi), javoblar shu token bilan. Nik 2-20 belgi; takror bo'lsa avtomatik raqam qo'shiladi.
- **Registered rejim**: o'yinchi mavjud FanFaster login'idan `talaba_id` yuboradi. Hozircha serverda tekshiriladigan sessiya yo'q, shuning uchun bu "da'vo" hisoblanadi (tasdiqlanmagan). Shuning uchun v1'da Hukm natijalari XP, bonus, Reyting yoki bahoga HECH QANDAY ta'sir qilmaydi; faqat `hukm_*` jadvallariga yoziladi.
- Server vaqtni o'lchaydi: savol ochilgan vaqt (`opened_at`) serverda; javob qabul qilinadi agar `now <= opened_at + time_limit + 1s`. Klient yuborgan vaqt ishlatilmaydi.
- Bitta o'yinchi bitta savolga bitta javob (unique constraint). Kechikkan va takroriy javob rad etiladi.
- To'g'ri javob va izoh o'yinchi javobida faqat savol `revealed` holatiga o'tgandan keyin bo'ladi. Network'da tekshir.
- PIN: 6 raqam, faqat faol o'yinlar orasida noyob; qo'shilish urinishi IP va PIN bo'yicha rate limit (masalan 10/daqiqa); noto'g'ri PIN'da bir xil umumiy xato.
- Ustoz lobbini qulflay oladi va o'yinchini chiqara oladi (kicked o'yinchi qayda qo'shila olmaydi).
- Barcha `hukm_*` jadvallarda RLS yoqilgan, `anon` ga HECH QANDA policy yo'q; faqat edge function (service role) kiradi. Loyiha qoidasi bo'yicha edge function'lar `verify_jwt = false` (config.toml'da aniq), vakolat token orqali.
- Token, initData, PIN+token juftligi loglarga yozilmaydi. Yangi maxfiy qiymat kerak bo'lsa o'ylab topma, menga ayt.

## Ma'lumotlar modeli (nomlarni real sxema bilan solishtir)
- `hukm_quizzes`: id, owner (mavjud ustoz identifikatori, da'vo sifatida), title, description, created_at, updated_at.
- `hukm_questions`: quiz_id, position, type (`variant4` | `togri_notogri` | `kazus`), text, case_text (kazus uchun, ixtiyoriy), options (jsonb, 2-4 ta, har birida matn va is_correct), time_limit_s (default 20; kazus 45), explanation (ixtiyoriy), legal_basis (ixtiyoriy, masalan "JK 97-modda"), hint (ixtiyoriy).
- `hukm_games`: id, quiz_id, pin, status (`lobby|question|reveal|leaderboard|finished`), current_index, opened_at, host_token_hash, settings (jsonb: speed_bonus on/off, registered_only, lobby_locked, show_text_on_phone), created_at, ended_at.
- `hukm_players`: game_id, nickname, player_token_hash, talaba_id (nullable, tasdiqlanmagan), joined_at, kicked.
- `hukm_answers`: game_id, player_id, question_index, choice, received_at (server), correct, points; unique (game_id, player_id, question_index).
Migration'dan keyin barcha jadvalda RLS yoqilganini va `anon` kalit bilan SELECT/INSERT/UPDATE/DELETE rad etilishini sinab ko'r.

## O'yin oqimi
Lobby (PIN, QR, o'yinchilar ro'yxati) → Savol (taymer, javoblar soni) → Reveal (to'g'ri javob, taqsimot, izoh, asos modda) → Leaderboard (top 5) → keyingi savol … → Yakun (podium, to'liq reyting).
Holat serverda saqlanadi; klientlar holatni Realtime Broadcast yoki 1 soniyalik polling bilan oladi (Bolt o'lchab tanlaydi, qaroriga sababni yozadi). Sahifa yangilansa o'yinchi/host token orqali holatga qaytadi.
Kech qo'shilish: faqat lobby'da (default). Host aloqasi uzilsa o'yin pauza holatida qoladi, o'yinchilarga "Ustoz kutilmoqda" ko'rsatiladi.

## Ball hisoblash (konstantalar bitta faylda)
To'g'ri javob: 850 asosiy + tezlik bonusi (0 dan 150 gacha, taymer bo'yicha chiziqli; ustoz o'chirsa 0) + ketma-ket to'g'ri javob bonusi (2-chisi +50, 3-chisi +100, 4-chisi +150, 5+ +200). Noto'g'ri yoki javobsiz: 0. Manfiy ball yo'q.

## Savol import (NotebookLM va boshqalar)
Muhim: NotebookLM'ning rasmiy API'si yoki viktorina eksporti yo'q (Google yordam markazida hujjatlashtirilmagan). Jonli "ulash" qurilmaydi, norasmiy API ishlatilmaydi (login cookie talab qiladi, xavfli). Buning o'rniga:
1. **CSV import**: ustunlar Question, Options, Correct answer, Rationale, Hint (uchinchi tomon eksport vositalari shunday beradi). Parser bardoshli bo'lsin: sarlavhalar katta-kichik harfga e'tiborsiz, Options bitta katakda yoki alohida ustunlarda, to'g'ri javob matn yoki harf (A/B/C/D) bo'lishi mumkin. Rationale → izoh, Hint → ishora.
2. **Matn yopishtirish**: `Savol?` keyin `A) B) C) D)` va `✓` yoki "To'g'ri: B" belgisi.
3. **JSON** (xuddi shu maydonlar).
Import har doim **ko'rib chiqish ekrani**dan o'tadi: ustoz har savolni ko'radi, tuzatadi, o'chiradi, keyin saqlaydi. Aniq 1 ta to'g'ri variant bo'lmagan savol belgilanadi va saqlashga yo'l qo'yilmaydi. Haqiqiy NotebookLM CSV namunasi yo'q: parser faraziy ustunlarga qurilgan, buni hisobotda TEKSHIRILMADI deb yoz; keyin ustoz haqiqiy fayl beradi.
Ixtiyoriy zaxira: "Matndan savol yaratish" — mavjud `ai-provider.ts` va `settings` AI sozlamalari orqali (yangi AI mexanizmi yo'q, yangi kalit yo'q). Natija ham ko'rib chiqish ekranidan o'tadi.

## Ekranlar
**Ustoz — savol quruvchi** (mavjud ustoz paneli uslubida): viktorina ro'yxati, yaratish/tahrirlash, savol turi tanlash, variantlarni kiritish, to'g'ri javob belgisi, izoh va asos modda maydoni, taymer tanlash (10/20/30/45/60), import tugmasi, "O'yin boshlash".
**Host ekrani** (proyektor/katta ekran, 16:9, matn clamp bilan masshtablanadi): lobby'da juda katta PIN (serif, oltin, 3+3 guruhlangan) + QR + qo'shilish manzili (`url.origin` + `/hukm`), o'yinchi chiplari paydo bo'ladi, ustoz boshqaruvi (Boshlash, Qulflash, Chiqarish, Tugatish). Savolda: katta savol matni, taymer halqasi, javob berganlar soni, 2x2 variant kartalari. Reveal'da: taqsimot ustunlari, to'g'ri variant ajratiladi, izoh paneli.
**O'yinchi ekrani** (mobil-birinchi, Telegram Mini App ichida ham ishlaydi): PIN va nik kiritish; kutish; savol matni to'liq + 4 ta katta tugma (>= 64px balandlik); "Javob qabul qilindi"; natija (✓/✗, ball, o'rin o'zgarishi, izoh, asos modda); yakunda o'rin va "Xatolar daftari" (faqat o'zining xato savollari, to'g'ri javob va izoh bilan).
**Ustoz — hisobot**: har savol bo'yicha to'g'ri javob foizi, eng ko'p tanlangan xato variant (ko'p tarqalgan adashish), qiyin savollar (< 50%) belgisi, o'yinchilar jadvali, CSV eksport.
Mini App sahifasi alohida `initData` talab qilmaydi: PIN bilan hamma joyda ishlaydi.

## Dizayn
Asos: mavjud FanFaster tokenlari (qorong'i fon, oltin urg'u, serif sarlavha, shishasimon kartochka, radius). Yangi shrift yo'q, og'ir kutubxona yo'q. Faqat 4 ta javob rangi yangi, shakl va harf bilan birga (rang yolg'iz ma'no tashimaydi):
- A: qalqon shakli, rubin `#C2303D`
- B: olmos shakli, safir `#2F6BE0`
- C: doira, zumrad `#12805C`
- D: kvadrat, kahrabo `#F2A93B` (matni to'q `#1A1205`)
Boshqalarda matn oq. Bolt kontrastni hisoblab AA (4.5:1) ni tasdiqlaydi; yetmasa rangni minimal darajada to'g'rilaydi va hisobotga yozadi. Oltin faqat xrom/PIN/g'olib uchun, javob kartalarida emas.
Podium: 3 ustun pastdan o'sadi, 1-o'rin oltin, 2-3 sokin. Ovoz: ixtiyoriy, WebAudio bilan sintez (fayl va kutubxona yo'q), default o'chiq, host yoqadi.

## Harakat va mobil
Faqat transform/opacity. Taymer halqasi (stroke-dashoffset yoki scale), leaderboard qayta tartiblanishi FLIP (translateY), podium scaleY, o'yinchi chiplari kirishda stagger. Easing `cubic-bezier(0.22,1,0.36,1)` 300-700ms. `prefers-reduced-motion`da statik. Mobil: past quvvatli telefonlarda yengillashtirilgan, tugmalar >= 44px (o'yinchida 64px), WCAG AA, klaviatura fokusi, aria-label.

## Tegilmaydi
Boshqa sahifalar, Moot Court, bonus/XP/Reyting mantiqi, mavjud login oqimlari, ulash/birlashtirish va 1:1 qoidasi, mavjud `verify_jwt` sozlamalari, mavjud jadvallar RLS (global xavfsizlik alohida bosqich). Backup/restore ustunlarni jim o'chirishi mumkin: migration'dan keyin ustunlarni sxema bilan solishtir.

## v1 doirasi va keyingi
v1: jonli o'yin, 3 savol turi (variant4, to'g'ri/noto'g'ri, kazus), import, reveal izohi, Xatolar daftari, hisobot. Keyingi: mustaqil (uy vazifasi) rejimi, jamoaviy "Ayblov/Himoya" rejimi, ko'p tanlovli savol, Reyting bilan integratsiya (server sessiyasi paydo bo'lgandan keyin).

## Tugatish mezoni
"Build o'tdi" yetarli emas. TEKSHIRILDI / TEKSHIRILMADI jadvali, dalil bilan:
1. `anon` kalit bilan har `hukm_*` jadvalga SELECT/INSERT/UPDATE/DELETE rad etiladi.
2. O'yinchiga boradigan javobda reveal'gacha to'g'ri variant va izoh yo'q (network payload).
3. Kechikkan javob va ikkinchi javob rad etiladi; vaqt serverda o'lchanadi.
4. Noto'g'ri PIN, kicked o'yinchi, qulflangan lobby, rate limit.
5. Host token bo'lmasa host amallari 401/403.
6. Ball hisobi namunaviy stsenariylarda qo'lda hisoblangan natija bilan mos.
7. Import: CSV, matn, JSON namunalari; xato savol saqlanmaydi.
8. 30+ simulyatsiya o'yinchi bilan to'liq o'yin (skript); haqiqiy telefonlar bilan sinov TEKSHIRILMADI deb yoz.
9. Kontrast AA natijalari; reduced-motion; mobil/desktop skrinshot.
10. Realtime yoki polling tanlovi va o'lchangan chek; boshqa sahifalar o'zgarmagani; edge function va verify_jwt jadvali.
Hisobot qisqa: nima o'zgardi (fayl, migration), nima tekshirildi, nima qoldi.
