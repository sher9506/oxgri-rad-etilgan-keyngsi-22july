---
name: xatoni
description: "FanFaster Telegram Mini App boti (alohida bot). Mini App ochilishi, /start va \"Kirish\" tugmasi, \"Davom etish\" oqimi, telegram_id/telefon orqali avtomatik kirish yoki yangi profil yaratish, initData imzo tekshiruvi, admin paneldan bot token/username almashtirish, Mini App ichida \"Kompyuterda sayt qulayroq\" bannerini yashirish haqidagi har qanday ish uchun ishlat. Bu qismlarga tegadigan har bir o'zgarishdan oldin shu skillni o'qi."
---

FanFaster Mini App boti — to'liq qoidalar va joriy holat
Maqsad

fanfaster.uz Telegram Mini App sifatida ham ishlaydi. Mini App ALOHIDA botda ochiladi (eski login botdan mustaqil). Foydalanuvchi botga /start bosadi, "Kirish" tugmasini bosadi, Mini App Telegram ichida ochiladi va u avtomatik kiradi yoki profil yaratiladi. Ism-familiya Telegramdan olinadi, foydalanuvchi hech narsa yozmaydi. Oqim sodda, tez va qulay bo'lsin.

Qat'iy cheklovlar
Eski login botlar va funksiyalar (telegram-login, telegram-callback, telegram-bot, ustoz-bot), ularning tokenlari, webhook'lari va admin paneldagi sozlamalariga TEGMA. Umumiy telegram-api funksiyasida faqat ruxsat ro'yxatiga metod qo'shish mumkin; mavjud yo'llar o'zgarmasin.
Sayt dizayni, ranglari, shriftlari, pastki navigatsiya (Bosh/Kurslar/Materiallar/Sinov/Yana) o'zgarmasin.
Mini App kodi FAQAT isTelegramMiniApp() (ya'ni !!window.Telegram?.WebApp?.initData) true bo'lganda ishlasin. Oddiy brauzerdagi sayt va kirish oqimi o'zgarmasin.
Yangi edge function'larda verify\_jwt = false (config.toml'da aniq yozilgan). Bolt versiya tiklasa yoki qayta deploy qilsa buni qayta tekshir.
Token hech qachon anon'ga o'qilmasin, frontend kodiga yozilmasin, logga to'liq chiqmasin (faqat bot ID qismi, ":" gacha).
Ishlayotgan qismni qayta yozma. O'zgartirish minimal bo'lsin, har safar faqat so'ralgan joyga tegil.
Joriy arxitektura (amalga oshirilgan)
supabase/functions/miniapp-bot/index.ts — bot webhook: secret\_token tekshiruvi, /start da salomlashuv + "Kirish" web\_app tugmasi, message.contact qabul qilish.
supabase/functions/telegram-miniapp-auth/index.ts — initData tekshiruvi, profil topish/yaratish, sessiya berish.
supabase/functions/telegram-api/index.ts — umumiy funksiya; unga setChatMenuButton qo'shilgan.
src/components/features/MiniAppBanner.tsx — Mini App ichidagi "Davom etish" kartochkasi, requestContact oqimi; eski "Kompyuterda sayt qulayroq" banneri Mini App ichida chiqmaydi (u faqat Mini App ichida chiqardi, oddiy brauzerda hech qachon).
src/components/features/MiniAppSozlamalari.tsx — admin panelda "Mini App boti" kartochkasi (Sidebar'da "Mini App Bot" menyusi, AdminPanel.tsx orqali).
MiniAppLoginOverlay — App.tsxda, faqat login bo'lmaganda va Mini App ichida.
Migration 20261006120000\_add\_telegram\_id\_and\_miniapp\_contacts.sql: talabalar.telegram\_id (bigint) va miniapp\_contacts(telegram\_id PK, phone, created\_at) (RLS yoqilgan, faqat service role).
settings kalitlari: MINIAPP\_BOT\_TOKEN, MINIAPP\_BOT\_USERNAME, MINIAPP\_URL, MINIAPP\_WELCOME\_TEXT, MINIAPP\_BUTTON\_TEXT, MINIAPP\_WEBHOOK\_SECRET.
Admin panel: "Mini App boti"
Maydonlar: Bot token, Bot username, Mini App URL (standart [https://fanfaster.uz](https://fanfaster.uz)), Salomlashuv matni, Tugma matni (standart "Kirish").
"Saqlash va ulash": getMe bilan token tekshiriladi → yangi tokenga setWebhook (miniapp-bot, secret\_token bilan) → setChatMenuButton (Web App) → eski token bo'lsa deleteWebhook. Natija panelda ko'rinadi.
Token maskalangan (••••) ko'rsatiladi. MASKALANGAN qiymat qayta saqlansa token buzilmasin: foydalanuvchi yangi token kiritmagan bo'lsa eski qiymat saqlanib qolsin. Kiritilgan tokenga .trim() qo'llansin.
Maqsad: admin kodga tegmasdan token va username almashtirib botni boshqasiga o'tkaza olsin.
Funksiyalar tokenni har safar settingsdan o'qiydi (60s xotira keshi mumkin).
/start oqimi (bot)
X-Telegram-Bot-Api-Secret-Token noto'g'ri bo'lsa 401.
Istalgan xabarga: matn = MINIAPP\_WELCOME\_TEXT, ostida bitta inline tugma web\_app:{url:MINIAPP\_URL}, tugma matni = MINIAPP\_BUTTON\_TEXT.
Standart matn: "FanFaster botiga xush kelibsiz!\\n\\nPastdagi «Kirish» tugmasini bosing — kabinetingiz shu yerning o'zida, Telegram ichida ochiladi."
Bot boshqa murakkab buyruqsiz, faqat shu vazifani bajaradi.
Mini App ochilganda: uchta holat

Ochilishda tg.ready(), tg.expand(); header/background rangi sayt fonига mos; safe-area hisobga olinadi. Banner HECH QACHON ko'rsatilmaydi. Keyin initData telegram-miniapp-authga yuboriladi.

Qaytib kelgan foydalanuvchi (telegram\_id bo'yicha profil bor): kartochka ko'rsatilmasdan to'g'ridan-to'g'ri kiriladi, faqat qisqa yuklanish holati bo'ladi. (Tasdiqlangan: mavjud profil telegram\_id bilan telefonsiz kirdi, 2026-10-06.)
Profil telegram\_id bilan topilmadi, lekin kontakt bor: miniapp\_contactsdagi telefon +998XXXXXXXXX ga normallashtiriladi. Shu telefonli talabalar profili bo'lsa (sayt yoki eski botdan ro'yxatdan o'tgan), unga telegram\_id bog'lanadi va kiriladi.
Yangi foydalanuvchi (na telegram\_id, na telefon bo'yicha profil): "FanFaster'ga xush kelibsiz — Bir marta bosing, qolganini o'zimiz qilamiz" kartochkasi va "Davom etish". Bosilganda status:"need\_phone" → Telegram.WebApp.requestContact() → foydalanuvchi tasdiqlaydi → miniapp-bot webhook message.contactni (faqat contact.user\_id === message.from.id bo'lsa) miniapp\_contactsga yozadi → frontend 1.5s oraliq bilan 5 martagacha auth'ni qayta chaqiradi → profil yaratiladi (ism-familiya Telegramdan, phone, telegram\_id) → kiriladi. cancelled bo'lsa "Raqamsiz davom etib bo'lmaydi" xabari va qayta urinish tugmasi.
Fallback: requestContact qo'llab-quvvatlanmasa (!tg.isVersionAtLeast('6.9')) yoki desktop mijozda ishlamasa, foydalanuvchiga "Telefon raqamni yuborish" (request\_contact) tugmali xabar botdan yuboriladi.
initData imzo tekshiruvi (muhim saboq)
data\_check\_string: initData'ni URLSearchParams bilan o'qi, FAQAT hash kalitini chiqarib tashla (signature QOLADI), qolganlarini kalit bo'yicha alifbo tartibida kalit=qiymat qilib \\n bilan birlashtir (qiymatlar decode qilingan).
secret\_key = HMAC\_SHA256(key="WebAppData", message=token); hash = HMAC\_SHA256(key=secret\_key, message=data\_check\_string) (hex). Argumentlar tartibini almashtirma.
Token settingsdan o'qilganda .trim(). auth\_date soniyada, farq ≤ 3600.
Xato kodlari alohida: no\_token, no\_hash, hash\_mismatch, expired. Umumiy "noto'g'ri yoki muddati o'tgan" xabari bilan aralashtirma.
Tarixiy holat: 2026-10-06 da "initData noto'g'ri yoki muddati o'tgan" xatosi chiqqan; keyin kirish ishladi. Aniq sabab qayd etilmagan; qayta chiqsa yuqoridagi ro'yxat bo'yicha ALOHIDA kodlar bilan diagnostika qil, tokenni to'liq logga yozma.
O'zgartirishdan keyingi majburiy tekshiruv (build o'tdi ≠ ishlayapti)
Botga /start → matn + "Kirish" tugmasi.
Qaytib kelgan foydalanuvchi: kartochkasiz, tez kiradi.
Yangi (boshqa Telegram akkaunt) foydalanuvchi: kartochka → telefon so'rovi → profil yaratiladi → kiradi.
Telefoni mavjud sayt profilida bor foydalanuvchi: yangi profil emas, mavjud profilga bog'lanadi.
Mini App ichida banner yo'q; oddiy brauzerda sayt o'zgarmagan.
Adminda token/username almashtirilsa webhook yangi botga o'tadi, yangi bot ishlaydi, mavjud profillar yangi botda ham topiladi (telegram\_id botga bog'liq emas).
Eski login bot ishlashda davom etadi.
Ikkala yangi funksiyada verify\_jwt = false.
Frontend o'zgarishlari haqiqatan fanfaster.uz'ga chiqdi (Bolt publish yoki GitHub → Cloudflare Pages; edge function'lar alohida, to'g'ridan-to'g'ri Supabase'ga deploy bo'ladi). Oxirida o'zgargan/yaratilgan fayllar va migration'lar ro'yxatini ber. Tekshirilmagan narsani "tayyor" dema.
Qo'lda qilinadigan qadamlar (kodga qo'shma)

BotFather'da /newbot; tokenni admin panelga kiritib "Saqlash va ulash"ni bosish.