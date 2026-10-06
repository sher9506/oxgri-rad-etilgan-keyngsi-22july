---
name: fanfaster-miniapp-bot
description: FanFaster Telegram Mini App boti. Telegram Mini App, yangi bot, /start "Kirish" tugmasi, initData orqali avtomatik login/ro'yxatdan o'tish, admin paneldan bot token va username almashtirish, "Kompyuterda sayt qulayroq" bannerini Mini App ichida yashirish haqidagi har qanday ish uchun ishlat.
---

# FanFaster Mini App boti — qoidalar va arxitektura

## Maqsad
fanfaster.uz Telegram Mini App sifatida ham ishlaydi. Mini App YANGI, alohida bot orqali ochiladi. Foydalanuvchi botga /start bosadi, "Kirish" tugmasini bosadi, Mini App Telegram ichida ochiladi, "Davom etish" bosilganda avtomatik kiradi yoki profil yaratiladi. Ism-familiya Telegramdan olinadi, foydalanuvchi hech narsa yozmaydi. Oqim sodda, tez va qulay bo'lishi shart.

## Qat'iy cheklovlar (hech qachon buzma)
- Eski login botlar va funksiyalar (`telegram-login`, `telegram-callback`, `telegram-bot`, `ustoz-bot`), ularning tokenlari, mantig'i, webhook'lari va admin paneldagi sozlamalariga TEGMA.
- Saytning dizayni, ranglari, shriftlari va pastki navigatsiyasi (Bosh/Kurslar/Materiallar/Sinov/Yana) o'zgarmasin.
- Oddiy brauzerda sayt avvalgidek ishlasin, "Kompyuterda sayt qulayroq" banneri avvalgidek chiqsin.
- Yangi edge function'larda `verify_jwt = false` (config.toml'da aniq yoz). Versiya tiklangandan keyin buni qayta tekshir.
- Yangi jadvallarda RLS yoq. Token anon'ga o'qilmasin, frontend kodiga yozilmasin.
- Bot tokeni Deno secret emas, `settings` jadvalida saqlanadi (eski login bot kabi). Eski bot tokeni qanday saqlanishi va admin panelda qanday o'zgartirilishini AVVAL o'qi va xuddi shu uslubni ishlat.

## 1. Admin panel: "Mini App boti" kartochkasi
Login bot sozlamalari yonida alohida kartochka.
- Maydonlar: Bot token, Bot username, Mini App URL (standart `https://fanfaster.uz`), Salomlashuv matni, Tugma matni (standart "Kirish").
- `settings` kalitlari: `MINIAPP_BOT_TOKEN`, `MINIAPP_BOT_USERNAME`, `MINIAPP_URL`, `MINIAPP_WELCOME_TEXT`, `MINIAPP_BUTTON_TEXT`, `MINIAPP_WEBHOOK_SECRET`.
- "Saqlash va ulash" bosilganda edge function: (a) `getMe` bilan tokenni tekshiradi, (b) yangi tokenga `setWebhook` (`miniapp-bot` funksiyasiga, `secret_token` bilan) o'rnatadi, (c) `setChatMenuButton` bilan menyu tugmasini Web App qiladi, (d) eski token bo'lsa unga `deleteWebhook` yuboradi. Natija panelda ko'rinsin. Token maskalangan (••••) ko'rsatilsin.
- Maqsad: admin faqat token va username almashtirib, kodga tegmasdan botni boshqasiga o'tkaza olsin.
- Funksiyalar tokenni har safar `settings`dan o'qiydi (60s xotira keshi mumkin), qattiq kodlanmaydi.

## 2. Bot /start oqimi (`miniapp-bot` webhook)
- `X-Telegram-Bot-Api-Secret-Token` ni `MINIAPP_WEBHOOK_SECRET` bilan tekshir, mos kelmasa 401.
- /start (yoki istalgan xabar) uchun bitta xabar: matn = `MINIAPP_WELCOME_TEXT`, ostida bitta inline tugma `web_app: {url: MINIAPP_URL}`, tugma matni = `MINIAPP_BUTTON_TEXT`.
- Standart matn: "FanFaster botiga xush kelibsiz!\n\nPastdagi «Kirish» tugmasini bosing — kabinetingiz shu yerning o'zida, Telegram ichida ochiladi."
- Bot boshqa murakkab buyruqlarsiz, faqat shu vazifani bajaradi.
- `message.contact` kelsa saqla (5-bo'lim).

## 3. Mini App rejimini aniqlash (frontend)
- `index.html`ga `<script src="https://telegram.org/js/telegram-web-app.js"></script>`.
- `const isMiniApp = !!window.Telegram?.WebApp?.initData`. Mini App ichida "Kompyuterda sayt qulayroq / Saytda ochish" bannerini render qilma.
- Boshida `tg.ready()`, `tg.expand()`; header/background rangini sayt foniga moslab o'rnat; iPhone safe-area hisobga olinsin.

## 4. "Davom etish" oqimi
Login qilinmagan bo'lsa pastdan chiquvchi kartochka: "FanFaster'ga xush kelibsiz", "Bir marta bosing, qolganini o'zimiz qilamiz", katta "Davom etish" tugmasi (saytning mavjud ko'k tugma uslubida).
1. `initData` ni `telegram-miniapp-auth` ga POST qil.
2. `status:"ok"` bo'lsa sessiyani saqla va bosh sahifaga o't.
3. `status:"need_phone"` bo'lsa `Telegram.WebApp.requestContact()`. `contactRequested` event'ida `sent` bo'lsa, 1.5s oraliq bilan 5 martagacha funksiyani qayta chaqir. `cancelled` bo'lsa "Raqamsiz davom etib bo'lmaydi" xabari va qayta urinish tugmasi.

## 5. `telegram-miniapp-auth` edge function
- initData imzosi: `secret_key = HMAC_SHA256(key="WebAppData", data=MINIAPP_BOT_TOKEN)`; hash solishtir. Imzo noto'g'ri yoki `auth_date` 1 soatdan eski bo'lsa 401.
- `user`dan: id, first_name, last_name, username.
- `talabalar` bo'yicha qidiruv tartibi:
  1. `telegram_id` bo'yicha. Ustun yo'q bo'lsa AVVAL sxemani tekshir va migration bilan qo'sh; `telegram_chat_id` bilan aralashtirma.
  2. Topilmasa `miniapp_contacts`dan shu telegram_id telefonini ol (+998XXXXXXXXX ga normallashtir), `talabalar.phone` bo'yicha qidir; topilsa unga telegram_id yoz.
  3. Telefon yo'q bo'lsa `{status:"need_phone"}`.
  4. Telefon bor, profil yo'q bo'lsa yangi `talabalar` yozuvi yarat (ism-familiya Telegramdan, phone, telegram_id).
- Saytning mavjud sessiya mexanizmini (JWT/token) qayta ishlat, yangisini o'ylab topma.
- `miniapp_contacts(telegram_id bigint PK, phone text, created_at timestamptz)`: faqat service role. Webhook `contact.user_id === message.from.id` bo'lsagina yozadi.
- Bot almashtirilsa telegram_id o'zgarmaydi (u foydalanuvchiga tegishli, botga emas), shuning uchun mavjud profillar yangi botda ham topiladi.

## Yakuniy tekshiruv (build o'tdi ≠ ishlayapti)
1. Botga /start → matn + "Kirish" tugmasi.
2. Tugma Mini App'ni Telegram ichida ochadi, banner yo'q.
3. Mavjud profil telefonsiz kiradi.
4. Yangi foydalanuvchi telefon bilan profil yaratadi.
5. Adminda token/username almashtirilsa webhook yangi botga o'tadi va yangi bot ishlaydi.
6. Eski login bot ishlashda davom etadi.
7. Oddiy brauzerda banner avvalgidek chiqadi.
8. Ikkala yangi funksiyada `verify_jwt = false` saqlanganini tasdiqla.
Oxirida o'zgargan/yaratilgan fayllar va migration'lar ro'yxatini ber.

## Qo'lda qilinadigan qadamlar (kodga qo'shma)
BotFather'da `/newbot` bilan bot yaratish. Tokenni admin panelga kiritish va "Saqlash va ulash"ni bosish.
