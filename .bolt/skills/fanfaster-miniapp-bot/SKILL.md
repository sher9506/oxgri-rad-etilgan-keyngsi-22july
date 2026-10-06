---
name: fanfaster-miniapp-bot
description: FanFaster Telegram Mini App boti (alohida bot). Mini App ochilishi, /start va "Kirish" tugmasi, "Davom etish" oqimi, telegram_id/telefon orqali avtomatik kirish yoki yangi profil yaratish, initData imzo tekshiruvi, admin paneldan bot token/username almashtirish, Mini App ichida "Kompyuterda sayt qulayroq" bannerini yashirish haqidagi har qanday ish uchun ishlat. Bu qismlarga tegadigan har bir o'zgarishdan oldin shu skillni o'qi.
---

# FanFaster Mini App boti — to'liq qoidalar va joriy holat

## Maqsad
fanfaster.uz Telegram Mini App sifatida ham ishlaydi. Mini App ALOHIDA botda ochiladi (eski login botdan mustaqil). Foydalanuvchi botga /start bosadi, "Kirish" tugmasini bosadi, Mini App Telegram ichida ochiladi va u avtomatik kiradi yoki profil yaratiladi. Ism-familiya Telegramdan olinadi, foydalanuvchi hech narsa yozmaydi. Oqim sodda, tez va qulay bo'lsin.

## Qat'iy cheklovlar
- Eski login botlar va funksiyalar (`telegram-login`, `telegram-callback`, `telegram-bot`, `ustoz-bot`), ularning tokenlari, webhook'lari va admin paneldagi sozlamalariga TEGMA. Umumiy `telegram-api` funksiyasida faqat ruxsat ro'yxatiga metod qo'shish mumkin; mavjud yo'llar o'zgarmasin.
- Sayt dizayni, ranglari, shriftlari, pastki navigatsiya (Bosh/Kurslar/Materiallar/Sinov/Yana) o'zgarmasin.
- Mini App kodi FAQAT `isTelegramMiniApp()` (ya'ni `!!window.Telegram?.WebApp?.initData`) true bo'lganda ishlasin. Oddiy brauzerdagi sayt va kirish oqimi o'zgarmasin.
- Yangi edge function'larda `verify_jwt = false` (config.toml'da aniq yozilgan). Bolt versiya tiklasa yoki qayta deploy qilsa buni qayta tekshir.
- Token hech qachon anon'ga o'qilmasin, frontend kodiga yozilmasin, logga to'liq chiqmasin (faqat bot ID qismi, ":" gacha).
- Ishlayotgan qismni qayta yozma. O'zgartirish minimal bo'lsin, har safar faqat so'ralgan joyga tegil.

## Joriy arxitektura (amalga oshirilgan)
- `supabase/functions/miniapp-bot/index.ts` — bot webhook: `secret_token` tekshiruvi, /start da salomlashuv + "Kirish" web_app tugmasi, `message.contact` qabul qilish.
- `supabase/functions/telegram-miniapp-auth/index.ts` — initData tekshiruvi, profil topish/yaratish, sessiya berish.
- `supabase/functions/telegram-api/index.ts` — umumiy funksiya; unga `setChatMenuButton` qo'shilgan.
- `src/components/features/MiniAppBanner.tsx` — Mini App ichidagi "Davom etish" kartochkasi, requestContact oqimi; eski "Kompyuterda sayt qulayroq" banneri Mini App ichida chiqmaydi (u faqat Mini App ichida chiqardi, oddiy brauzerda hech qachon).
- `src/components/features/MiniAppSozlamalari.tsx` — admin panelda "Mini App boti" kartochkasi (Sidebar'da "Mini App Bot" menyusi, `AdminPanel.tsx` orqali).
- `MiniAppLoginOverlay` — `App.tsx`da, faqat login bo'lmaganda va Mini App ichida.
- Migration `20261006120000_add_telegram_id_and_miniapp_contacts.sql`: `talabalar.telegram_id` (bigint) va `miniapp_contacts(telegram_id PK, phone, created_at)` (RLS yoqilgan, faqat service role).
- `settings` kalitlari: `MINIAPP_BOT_TOKEN`, `MINIAPP_BOT_USERNAME`, `MINIAPP_URL`, `MINIAPP_WELCOME_TEXT`, `MINIAPP_BUTTON_TEXT`, `MINIAPP_WEBHOOK_SECRET`.

## Admin panel: "Mini App boti"
- Maydonlar: Bot token, Bot username, Mini App URL (standart `https://fanfaster.uz`), Salomlashuv matni, Tugma matni (standart "Kirish").
- "Saqlash va ulash": `getMe` bilan token tekshiriladi → yangi tokenga `setWebhook` (`miniapp-bot`, `secret_token` bilan) → `setChatMenuButton` (Web App) → eski token bo'lsa `deleteWebhook`. Natija panelda ko'rinadi.
- Token maskalangan (••••) ko'rsatiladi. MASKALANGAN qiymat qayta saqlansa token buzilmasin: foydalanuvchi yangi token kiritmagan bo'lsa eski qiymat saqlanib qolsin. Kiritilgan tokenga `.trim()` qo'llansin.
- Maqsad: admin kodga tegmasdan token va username almashtirib botni boshqasiga o'tkaza olsin.
- Funksiyalar tokenni har safar `settings`dan o'qiydi (60s xotira keshi mumkin).

## /start oqimi (bot)
- `X-Telegram-Bot-Api-Secret-Token` noto'g'ri bo'lsa 401.
- Istalgan xabarga: matn = `MINIAPP_WELCOME_TEXT`, ostida bitta inline tugma `web_app:{url:MINIAPP_URL}`, tugma matni = `MINIAPP_BUTTON_TEXT`.
- Standart matn: "FanFaster botiga xush kelibsiz!\n\nPastdagi «Kirish» tugmasini bosing — kabinetingiz shu yerning o'zida, Telegram ichida ochiladi."
- Bot boshqa murakkab buyruqsiz, faqat shu vazifani bajaradi.

## Mini App ochilganda: uchta holat
Ochilishda `tg.ready()`, `tg.expand()`; header/background rangi sayt fonига mos; safe-area hisobga olinadi. Banner HECH QACHON ko'rsatilmaydi. Keyin `initData` `telegram-miniapp-auth`ga yuboriladi.

1. **Qaytib kelgan foydalanuvchi** (`telegram_id` bo'yicha profil bor): kartochka ko'rsatilmasdan to'g'ridan-to'g'ri kiriladi, faqat qisqa yuklanish holati bo'ladi. (Tasdiqlangan: mavjud profil telegram_id bilan telefonsiz kirdi, 2026-10-06.)
2. **Profil `telegram_id` bilan topilmadi, lekin kontakt bor**: `miniapp_contacts`dagi telefon +998XXXXXXXXX ga normallashtiriladi. Shu telefonli `talabalar` profili bo'lsa (sayt yoki eski botdan ro'yxatdan o'tgan), unga `telegram_id` bog'lanadi va kiriladi.
3. **Yangi foydalanuvchi** (na telegram_id, na telefon bo'yicha profil): "FanFaster'ga xush kelibsiz — Bir marta bosing, qolganini o'zimiz qilamiz" kartochkasi va "Davom etish". Bosilganda `status:"need_phone"` → `Telegram.WebApp.requestContact()` → foydalanuvchi tasdiqlaydi → `miniapp-bot` webhook `message.contact`ni (faqat `contact.user_id === message.from.id` bo'lsa) `miniapp_contacts`ga yozadi → frontend 1.5s oraliq bilan 5 martagacha auth'ni qayta chaqiradi → profil yaratiladi (ism-familiya Telegramdan, phone, telegram_id) → kiriladi. `cancelled` bo'lsa "Raqamsiz davom etib bo'lmaydi" xabari va qayta urinish tugmasi.
   - Fallback: `requestContact` qo'llab-quvvatlanmasa (`!tg.isVersionAtLeast('6.9')`) yoki desktop mijozda ishlamasa, foydalanuvchiga "Telefon raqamni yuborish" (`request_contact`) tugmali xabar botdan yuboriladi.

## initData imzo tekshiruvi (muhim saboq)
- `data_check_string`: initData'ni `URLSearchParams` bilan o'qi, FAQAT `hash` kalitini chiqarib tashla (`signature` QOLADI), qolganlarini kalit bo'yicha alifbo tartibida `kalit=qiymat` qilib `\n` bilan birlashtir (qiymatlar decode qilingan).
- `secret_key = HMAC_SHA256(key="WebAppData", message=token)`; `hash = HMAC_SHA256(key=secret_key, message=data_check_string)` (hex). Argumentlar tartibini almashtirma.
- Token `settings`dan o'qilganda `.trim()`. `auth_date` soniyada, farq ≤ 3600.
- Xato kodlari alohida: `no_token`, `no_hash`, `hash_mismatch`, `expired`. Umumiy "noto'g'ri yoki muddati o'tgan" xabari bilan aralashtirma.
- Tarixiy holat: 2026-10-06 da "initData noto'g'ri yoki muddati o'tgan" xatosi chiqqan; keyin kirish ishladi. Aniq sabab qayd etilmagan; qayta chiqsa yuqoridagi ro'yxat bo'yicha ALOHIDA kodlar bilan diagnostika qil, tokenni to'liq logga yozma.

## O'zgartirishdan keyingi majburiy tekshiruv (build o'tdi ≠ ishlayapti)
1. Botga /start → matn + "Kirish" tugmasi.
2. Qaytib kelgan foydalanuvchi: kartochkasiz, tez kiradi.
3. Yangi (boshqa Telegram akkaunt) foydalanuvchi: kartochka → telefon so'rovi → profil yaratiladi → kiradi.
4. Telefoni mavjud sayt profilida bor foydalanuvchi: yangi profil emas, mavjud profilga bog'lanadi.
5. Mini App ichida banner yo'q; oddiy brauzerda sayt o'zgarmagan.
6. Adminda token/username almashtirilsa webhook yangi botga o'tadi, yangi bot ishlaydi, mavjud profillar yangi botda ham topiladi (telegram_id botga bog'liq emas).
7. Eski login bot ishlashda davom etadi.
8. Ikkala yangi funksiyada `verify_jwt = false`.
9. Frontend o'zgarishlari haqiqatan fanfaster.uz'ga chiqdi (Bolt publish yoki GitHub → Cloudflare Pages; edge function'lar alohida, to'g'ridan-to'g'ri Supabase'ga deploy bo'ladi).
Oxirida o'zgargan/yaratilgan fayllar va migration'lar ro'yxatini ber. Tekshirilmagan narsani "tayyor" dema.

## Qo'lda qilinadigan qadamlar (kodga qo'shma)
BotFather'da `/newbot`; tokenni admin panelga kiritib "Saqlash va ulash"ni bosish.
