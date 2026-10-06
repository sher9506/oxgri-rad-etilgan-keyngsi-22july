---
name: fanfaster-miniapp-bot
description: FanFaster Telegram Mini App boti (alohida bot). Mini App ochilishi, /start va "Kirish" tugmasi, yangi foydalanuvchi uchun "Davom etish" sahifasi (welcome sheet), telegram_id/telefon orqali avtomatik kirish yoki yangi profil yaratish, bir marta kirgandan keyin Telegram akkauntni eslab qolish, initData imzo tekshiruvi, admin paneldan bot token/username almashtirish va telefonlarda ko'rinadigan "Kompyuterda sayt qulayroq" banneri haqidagi har qanday ish uchun ishlat. Bu qismlarga tegadigan har bir o'zgartirishdan oldin shu skillni o'qi.
---

# FanFaster Mini App boti — to'liq qoidalar va joriy holat (v3)

## Maqsad
fanfaster.uz Telegram Mini App sifatida ham ishlaydi. Mini App ALOHIDA botda ochiladi (eski login botdan mustaqil). Foydalanuvchi botga /start bosadi, "Kirish" tugmasini bosadi, Mini App Telegram ichida ochiladi. Profili bor foydalanuvchi har safar darhol, hech narsa bosmasdan kiradi. Yangi foydalanuvchi bir marta chiroyli "Davom etish" sahifasidan o'tadi. Ism-familiya Telegramdan olinadi, foydalanuvchi hech narsa yozmaydi.

## Qat'iy cheklovlar
- Eski login botlar va funksiyalar (`telegram-login`, `telegram-callback`, `telegram-bot`, `ustoz-bot`), ularning tokenlari, webhook'lari va admin paneldagi sozlamalariga TEGMA. Umumiy `telegram-api`da faqat ruxsat ro'yxatiga metod qo'shish mumkin.
- Sayt dizayni, ranglari, shriftlari, pastki navigatsiya (Bosh/Kurslar/Materiallar/Sinov/Yana) o'zgarmasin.
- Mini App kodi FAQAT `isTelegramMiniApp()` (`!!window.Telegram?.WebApp?.initData`) true bo'lganda ishlasin. Oddiy brauzerdagi sayt va kirish oqimi o'zgarmasin.
- Telegram bilan bog'liq edge function'larda `verify_jwt = false`. Deploy yoki versiya tiklashdan keyin qayta tekshir.
- Token hech qachon anon'ga o'qilmasin, frontend kodiga yozilmasin, logga to'liq chiqmasin.
- Ishlayotgan qismni qayta yozma. Faqat so'ralgan joyga tegil.

## Joriy arxitektura
- `supabase/functions/miniapp-bot/index.ts` — bot webhook (`secret_token` tekshiruvi, /start da salomlashuv + "Kirish" web_app tugmasi, `message.contact` qabul qilish).
- `supabase/functions/telegram-miniapp-auth/index.ts` — initData tekshiruvi, profil topish/yaratish, sessiya.
- `supabase/functions/telegram-api/index.ts` — umumiy funksiya (`setChatMenuButton` qo'shilgan).
- `src/components/features/MiniAppBanner.tsx` — Mini App ichidagi banner va "Davom etish" oqimi.
- `src/components/features/MiniAppSozlamalari.tsx` — admin panel "Mini App boti" kartochkasi (Sidebar: "Mini App Bot").
- `MiniAppLoginOverlay` — `App.tsx`da.
- Migration `20261006120000_add_telegram_id_and_miniapp_contacts.sql`: `talabalar.telegram_id` (bigint), `miniapp_contacts(telegram_id PK, phone, created_at)` (RLS, faqat service role).
- `settings` kalitlari: `MINIAPP_BOT_TOKEN`, `MINIAPP_BOT_USERNAME`, `MINIAPP_URL`, `MINIAPP_WELCOME_TEXT`, `MINIAPP_BUTTON_TEXT`, `MINIAPP_WEBHOOK_SECRET`.

## 1. "Kompyuterda sayt qulayroq" banneri (TIKLANSIN)
Bu banner eski Mini App'da bor edi va foydalanuvchi uni yana xohlaydi: tepada turadigan, ishni bezovta qilmaydigan, yopiladigan (X) ko'k gradient panel: monitor ikonkasi, "Kompyuterda sayt qulayroq" matni, "Saytda ochish" tugmasi, yopish (X). Avval noto'g'ri tushunilib u butunlay o'chirilgan edi; endi qaytariladi.
- Dizayn va matn ESKI komponentdagidek AYNAN bo'lsin. Avval git tarixidan/oldingi versiyadan `MiniAppBanner.tsx`ning banner qismini top va shuni qayta ishlat; yangi dizayn o'ylab topma.
- Qachon ko'rinadi: Mini App ichida, KOMPYUTER (desktop) Telegram mijozlarida (Mini App oynasi tor bo'lgani uchun to'liq sayt brauzerda qulayroq). Telefonda (`Telegram.WebApp.platform` ∈ `ios`, `android`, `android_x`) banner HECH QACHON ko'rinmaydi. Aniqlash teskarisidan: platforma yuqoridagi uch qiymatdan biri BO'LMASA — desktop deb hisobla (Novagram kabi uchinchi tomon mijozlarida platforma nomi nostandart bo'lishi mumkin). Platforma qiymatini faraz qilma: real `Telegram.WebApp.platform` qiymatini tekshir va hisobotda yoz.
- "Saytda ochish": `Telegram.WebApp.openLink(MINIAPP_URL yoki https://fanfaster.uz)` (tashqi brauzerda).
- X bosilsa banner yopiladi va tanlov eslab qolinadi (`localStorage`, try/catch bilan); bir necha kundan keyin yana ko'rinishi mumkin (eski komponent logikasidagidek, o'zgartirma).
- Banner pastki navigatsiya va sahifa maketini siljitmasin; yopilganda kontent silliq yuqoriga ko'tarilsin.
- Banner kirish (auth) holatiga bog'liq emas: profil bor yoki yo'q bo'lsa ham, Mini App ochilganda ko'rinadi.

## 2. Kirish: eslab qolish va "Davom etish" sahifasi
### Tamoyil
Bir marta kirgan foydalanuvchi uchun Telegram akkaunti eslab qolinadi. U Mini App'ni ochganda "Davom etish" sahifasi UMUMAN ko'rinmaydi, hatto 0.5 soniya ham.

### Eslab qolish mexanizmi
- Muvaffaqiyatli kirishdan keyin mavjud sessiya mexanizmi (JWT/token) saqlansin va qo'shimcha `ff_miniapp_linked=1` belgisi `localStorage`ga (try/catch) hamda `Telegram.WebApp.CloudStorage`ga (qo'llab-quvvatlansa, xato bo'lsa jim o'tkaz) yozilsin.
- Ochilganda BIRINCHI render sinxron qaror qiladi: saqlangan sessiya yoki `ff_miniapp_linked` bor bo'lsa, kartochka chizilmaydi. Sessiya bo'lsa ilova darhol kirgan holda ochiladi, `initData` esa fonda jim tasdiqlanadi. Agar tasdiqlangan `telegram_id` sessiya egasiga mos kelmasa (Telegramda akkaunt almashtirilgan), sessiya almashtiriladi.
- Belgi bor, lekin sessiya yo'q yoki eskirgan bo'lsa: kartochka o'rniga brend yuklanish ekrani (sayt fonida kichik logo + yengil spinner) va jim auth.
- Hech qanday sun'iy `setTimeout` kutish qolmasin.
- Foydalanuvchi ilovadan "Chiqish" bossa, `ff_miniapp_linked` va sessiya tozalansin; keyingi ochilishda avtomatik qayta kirib ketish tsikli bo'lmasin (shu Telegram akkaunt bilan qayta kirish uchun bitta "Davom etish" bosiladi).

### Uchta holat
1. **Qaytgan foydalanuvchi** (sessiya yoki `telegram_id` bo'yicha profil bor): darhol kiradi, kartochka yo'q. (Tasdiqlangan: mavjud profil telegram_id bilan telefonsiz kirdi.)
2. **Profil `telegram_id` bilan topilmadi, lekin kontakt/telefon mos**: `miniapp_contacts`dagi telefon +998XXXXXXXXX ga normallashtiriladi; shu telefonli mavjud `talabalar` profiliga `telegram_id` bog'lanadi va kiriladi.
3. **Yangi foydalanuvchi** (na telegram_id, na telefon bo'yicha profil): faqat shu holatda "Davom etish" sahifasi ko'rsatiladi (pastda). "Davom etish" bosilganda `Telegram.WebApp.requestContact()` → foydalanuvchi tasdiqlaydi → `miniapp-bot` webhook `message.contact`ni (faqat `contact.user_id === message.from.id`) `miniapp_contacts`ga yozadi → frontend 1.5s oraliq bilan 5 martagacha auth'ni qayta chaqiradi → profil yaratiladi (ism-familiya Telegramdan, phone, telegram_id) → kiriladi. `cancelled` bo'lsa "Raqamsiz davom etib bo'lmaydi" va qayta urinish. Fallback: `requestContact` qo'llab-quvvatlanmasa (`!tg.isVersionAtLeast('6.9')`) botdan `request_contact` tugmali xabar yuboriladi.

### "Davom etish" sahifasi dizayni (faqat yangi foydalanuvchi)
Maqsad: Advokat Kerak'dagi welcome sheet'dan ancha professional va kuchli, lekin FanFaster dizayn tilida (mavjud shrift, ranglar, radius; yangi shrift/palitra yo'q; og'ir kutubxona yo'q; lotin yozuvi).
- **Asosiy g'oya**: butun ekran brend fon + pastdan ko'tariladigan shishasimon (glass) sheet. Fonda saytning adolat tarozisi logotipi (headerdagi ko'k kvadrat belgi) katta (ekranning ~40%i), xira (blur) va juda sekin suzib turadi; pointer/gyro bilan yengil parallaks (±6-8°). Fon sayt rangida (och moviy gradient), ko'k va oltin aksentlar.
- **Sheet**: tepada tutqich (handle), yuqori burchaklari katta radiusli. Ichida: (1) yuqorida kichik chip "SIZ KUTGAN FORMATDAGI TA'LIM" (saytdagi kabi, oltin nuqta bilan); (2) serif sarlavha "FanFaster'ga xush kelibsiz" (saytdagi serif sarlavha uslubi, "xush kelibsiz" qismi kursiv ko'k va tagida oltin chiziq); (3) bitta qisqa matn: "Bir marta bosing, qolganini o'zimiz qilamiz."; (4) uchta ixcham ishonch qatori (ikonka + matn): "Ism-familiya Telegramdan olinadi", "Parol va uzun forma yo'q", "Profilingiz bor bo'lsa, o'sha ochiladi"; (5) katta asosiy tugma "Davom etish" (saytdagi ko'k tugma uslubi, o'ng tomonda strelka); (6) pastda mayda matn: "Telefon raqamingiz faqat profilingizni bog'lash uchun ishlatiladi."
- **Holatlar**: tugma bosilganda spinner va nofaol; telefon so'ralayotganda sheet ichidagi matn silliq almashadi ("Profilingizni topish uchun Telegram'dagi raqamingizni tasdiqlang"); muvaffaqiyatda belgi (check) animatsiyasi ~500ms, so'ng sheet pastga tushib ilova ochiladi. Xatoda qizil bo'lmagan, xotirjam xabar va "Qayta urinish".
- **Harakat**: kirishda sheet translateY 100%→0 (≈700ms, `cubic-bezier(0.22,1,0.36,1)`), ichki elementlar 60ms oraliq (stagger) bilan paydo bo'ladi, fon logotipi sekin float (6-8s). Faqat `transform`/`opacity`, `prefers-reduced-motion`da statik, mobilda yengillashtirilgan. Bolalarcha element (konfetti, multfilm) yo'q; ohang ishonchli, sokin, ta'limga mos.
- **Kuchli ijro**: bitta aniq g'oya, fon logotipi va sheet vizual maydonning kattaroq qismini egallasin, harakat dam holatida ham ko'zga tashlansin. Mayda, ko'zga ko'rinmas bezaklar (juda past opacity) taqiqlanadi. Telegram safe-area va `tg.expand()` hisobga olinsin.
- **Sifat**: WCAG AA kontrast, klaviatura fokusi, `aria-label`lar, kichik komponentlarga ajratilgan kod. `tg.setHeaderColor/BackgroundColor` sheet fon rangiga mos.

## 3. Bot /start oqimi
- `X-Telegram-Bot-Api-Secret-Token` noto'g'ri bo'lsa 401.
- Istalgan xabarga: matn = `MINIAPP_WELCOME_TEXT`, ostida bitta inline tugma `web_app:{url:MINIAPP_URL}`, tugma matni = `MINIAPP_BUTTON_TEXT`.
- Standart matn: "FanFaster botiga xush kelibsiz!\n\nPastdagi «Kirish» tugmasini bosing — kabinetingiz shu yerning o'zida, Telegram ichida ochiladi."
- Bot boshqa murakkab buyruqsiz, faqat shu vazifani bajaradi.

## 4. Admin panel: "Mini App boti"
- Maydonlar: Bot token, Bot username, Mini App URL (standart `https://fanfaster.uz`), Salomlashuv matni, Tugma matni (standart "Kirish").
- "Saqlash va ulash": `getMe` → `setWebhook` (`miniapp-bot`, `secret_token` bilan) → `setChatMenuButton` (Web App) → eski token bo'lsa `deleteWebhook`. Natija panelda ko'rinadi.
- Token maskalangan (••••) ko'rsatiladi; maskalangan qiymat qayta saqlansa token buzilmasin (yangi token kiritilmasa eskisi qoladi). Kiritilgan tokenga `.trim()`.
- Funksiyalar tokenni har safar `settings`dan o'qiydi (60s keshi mumkin). Admin kodga tegmasdan botni boshqasiga o'tkaza olsin. Bot almashganda `telegram_id` o'zgarmaydi, mavjud profillar yangi botda ham topiladi.

## 5. initData imzo tekshiruvi (saboq)
- `data_check_string`: initData'ni `URLSearchParams` bilan o'qi, FAQAT `hash` kalitini chiqarib tashla (`signature` QOLADI), qolganlarini kalit bo'yicha alifbo tartibida `kalit=qiymat`, `\n` bilan birlashtir (decode qilingan).
- `secret_key = HMAC_SHA256(key="WebAppData", message=token)`; `hash = HMAC_SHA256(key=secret_key, message=data_check_string)` (hex). Argumentlar tartibini almashtirma.
- Token `.trim()`; `auth_date` soniyada, farq ≤ 3600.
- Xato kodlari alohida: `no_token`, `no_hash`, `hash_mismatch`, `expired`.
- Tarix: 2026-10-06 da "initData noto'g'ri yoki muddati o'tgan" xatosi chiqqan, keyin ishlagan; aniq sabab qayd etilmagan. Qayta chiqsa alohida kodlar bilan diagnostika qil, tokenni to'liq logga yozma.

## O'zgartirishdan keyingi majburiy tekshiruv (build o'tdi ≠ ishlayapti)
1. Botga /start → matn + "Kirish" tugmasi.
2. Qaytgan foydalanuvchi (telefon va desktop): "Davom etish" HECH QACHON ko'rinmaydi, ilova darhol ochiladi.
3. Telefonda Mini App ochilganda banner chiqadi (eski dizaynda), X bosilsa yopiladi; kompyuter platformasida chiqmaydi. `Telegram.WebApp.platform` real qiymatini hisobotga yoz.
4. Yangi (boshqa Telegram akkaunt) foydalanuvchi: yangi sheet → telefon so'rovi → profil yaratiladi → kiradi.
5. Telefoni mavjud sayt profilida bor foydalanuvchi mavjud profilga bog'lanadi (dublikat yaratilmaydi).
6. Mini App'dan "Chiqish" qilgandan keyin tsikl yo'q.
7. Adminda token/username almashtirilsa webhook yangi botga o'tadi, yangi bot ishlaydi.
8. Eski login bot ishlashda davom etadi; oddiy brauzerdagi sayt o'zgarmagan.
9. Ikkala yangi funksiyada `verify_jwt = false`.
10. Frontend o'zgarishlari fanfaster.uz'ga haqiqatan chiqdi (Bolt publish yoki GitHub → Cloudflare Pages).
Tekshirilmaganini "TEKSHIRILMADI" deb yoz. Oxirida o'zgargan/yaratilgan fayllar va migration'lar ro'yxatini ber.

## Qo'lda qilinadigan qadamlar (kodga qo'shma)
BotFather'da `/newbot`; tokenni admin panelga kiritib "Saqlash va ulash"ni bosish.
