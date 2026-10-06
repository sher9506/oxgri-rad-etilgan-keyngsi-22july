---
name: account-linking
description: FanFaster'da Telegram va Google akkauntlarini bitta talaba profiliga birlashtirish (sayt, bot, Mini App), kanal a'zoligi tekshiruvi va kompyuter/telefon orasida bir martalik kirish havolalari bilan. Akkaunt ulash, birlashtirish, Mini App tasdiqlash ekrani yoki shu oqimdagi xatolar bilan bog'liq har qanday vazifada ishlat.
---

# Account Linking (mavjud tizimni to'ldirish)

## Maqsad
Bir odam = bitta talaba profili. Saytdan boshlangan ulash botda davom etadi, Mini App ichida tasdiqlanadi (Birlashtirish / Rad etish), keyin avtomatik shu profilga olib boradi. Kompyuterda sayt qulayroq bo'lsa, Mini App ichidan o'sha profilga bir martalik kirish havolasi beriladi. Telefonda ham, kompyuterda ham ikkala yo'nalish ruxsat: hech narsa taqiqlanmaydi.

## Boshlashdan oldin (har safar, o'zgartirmasdan)
Mavjud kodni o'qi va real nomlarni tekshir; taxmin qilma. Asosiy joylar (auditda ko'rilgan, qayta tekshir): BirlashtirishKartasi.tsx, ProfilSahifa.tsx, MiniAppBanner.tsx, TelegramCallback.tsx, GoogleCallback.tsx, googleAuth.ts; edge function'lar link-telegram-start, link-telegram-status, telegram-login (handleLinkToken, handleMergeCallback, checkChannel), telegram-login-callback, telegram-miniapp-auth, google-auth, talaba-birlashtirish; jadvallar telegram_link_tokens, merge_attempts, akkaunt_birlashtirish_log, telegram_login_sessions; RPC birlashtirish_talabalari, berilish_birlashtirish_bonusi; talabalar.merged_into va telegram_chat_id qulf trigger'i. Yangi tizim qurma: mavjudini kengaytir. Qaysi bot (login yoki Mini App) qaysi tokenni ishlatishini koddan aniqla.

## Asosiy qoida: vakolat isbotdan keladi
Klient yuborgan talaba_id hech qachon vakolat emas (u faqat qidirish uchun ishora). Shaxs faqat server tomonida isbotlangan manbadan olinadi:
- Telegram: Mini App initData (HMAC-SHA256, auth_date ≤ 10 daqiqa). Bot webhook update'iga shaxs manbai sifatida ishonilmaydi (webhook secret hali tekshirilmaydi).
- Google: OAuth code oqimi, state server tomonida yaratilib hash bilan saqlanadi, faqat email_verified=true, google_user_id = sub.
- So'rovga egalik: bir martalik ulash tokeni (faqat hash saqlanadi).
Birlashtirish faqat IKKALA tomon isbotlangandan keyin va foydalanuvchi Mini App'da aniq "Birlashtirish" bosganda bajariladi. Email/telefon mosligi bo'yicha avtomatik birlashtirish YO'Q.

## Oqim (ikki isbotli holat mashinasi)
Ulash so'rovi (telegram_link_tokens kengaytiriladi: google_sub, telegram_id, state_hash, status) isbotlarni istalgan tartibda yig'adi.
A) Google bilan kirgan, Telegramni ulaydi: "Telegramni ulash" → server so'rov yaratadi va Google OAuth'ga yuboradi (akkaunt tanlash, bir marta bosish; bu isbot, olib tashlab bo'lmaydi) → callback google_sub'ni tekshiradi (da'vo qilingan profilning google_user_id si bilan mos bo'lishi shart) → sayt "Telegramga o'tish" tugmasi (+QR) beradi: t.me/<bot>?start=link_<token> (token ≤ 32 belgi).
B) Telegram bilan kirgan, Googleni ulaydi: Mini App ichida (yoki saytdan bot orqali) boshlanadi; Telegram isboti initData'dan; keyin Google OAuth (Mini App'da tashqi brauzerda ochiladi) → qaytish t.me/<bot>/<app>?startapp=<token>.
Bot: /start link_<token> faqat tokenni tekshiradi va web_app tugmasi yuboradi ("Tasdiqlash uchun ochish"). Bot hech qanday shaxsni yozmaydi va birlashtirmaydi. Eski bot ichidagi "✅ Ha / ❌ Bekor" tasdiqlash olib tashlanadi (yoki tugma Mini App'ga yo'naltiradi).
Mini App tasdiqlash (faqat initData bo'lganda): server telegram_id'ni isbotlaydi → kanal tekshiruvi → stsenariyni aniqlaydi: (1) Telegram bo'sh: oddiy ulash; (2) ikkala tomon bir profil: allaqachon ulangan; (3) ikki xil profil: birlashtirish, created_at bo'yicha eskisi ASOSIY, ikkinchisi merged_into bilan belgilanadi, o'chirilmaydi; mavjud RPC ishlatiladi. Ekranda ikkala akkaunt (Google: ism va niqoblangan email; Telegram: @username va ism), nima birlashishi (natijalar, XP, nishonlar) va [Birlashtirish] [Rad etish].
Birlashtirish bosilsa: atomik (used_at IS NULL AND expires_at>now()), 3/soat limit (merge_attempts), RPC, audit log, bot "Akkaunt ulandi" xabari. Mini App ichida login() va avtomatik profilga o'tish. Rad etilsa: so'rov bekor, token yaroqsiz, sayt polling "Rad etildi" ko'rsatadi.
Kompyuterda ochish: Mini App'da tugma; server initData bilan talabani aniqlaydi va 5 daqiqalik bir martalik kirish havolasi yaratadi (telegram_login_sessions, hash); sahifa ochilganda emas, POST bilan sarflanadi (link preview tokenni yemasligi uchun). Mobil foydalanuvchiga saytga majburiy havola berilmaydi. Kompyuterdagi Telegram Mini App'da tepada "Saytda ochish" banneri bor (taqiq yo'q).
Sayt tomoni: link-telegram-status orqali polling (xom token emak, server javobi); natija linked / merged / rejected / expired / waiting; merged bo'lsa asosiy profilga o'tadi.

## Kanalga majburiy a'zolik
Bot kanalda admin. Kanal admin panelda Mini App sozlamalarida (MiniAppSozlamalari.tsx) kiritiladi: bitta maydon (@kanal yoki -100...), yangi kalit MINIAPP_LINK_CHANNEL (settings). Saqlashda server getChat va botning o'zi shu kanalda adminligini tekshiradi; xato bo'lsa maydon ostida aniq sabab. Maydon bo'sh = tekshiruv o'chiq. Birlashtirishdan oldin va tasdiqlash vaqtida getChatMember(kanal, telegram_id): member/administrator/creator o'tadi. Aks holda Mini App'da "Kanalga a'zo bo'ling" va "Tekshirish" tugmalari, [Birlashtirish] faol emas. Telegram API xato bersa "Keyinroq urinib ko'ring"; o'tkazib yuborilmaydi. Faqat serverda.

## Oqim ichidagi himoya (global xavfsizlik rejasidan alohida, shu ishning ajralmas qismi)
Xom token saqlanmaydi (yangi yozuvlarda token ustuni bo'sh; eski ustunni o'chirishdan oldin tasdiq so'ra); hamma tekshiruvlar atomik; sarflash POST'da; rate limit (ulash so'rovi soatiga 5/profil va IP bo'yicha cheklov); loglarda token, initData, kirish tokeni yo'q; link jadvallariga anon policy yo'q (faqat edge function); ochiq redirect yo'q (return yo'llari ro'yxatdan); Telegram bir marta bog'lanadi (mavjud trigger saqlansin); Google tomonida state tekshiruvi; muvaffaqiyatsiz urinishlar audit'ga.

## Mini App ekranlari va dizayn
Yangi sahifa faqat window.Telegram?.WebApp?.initData bo'sh bo'lmaganda ishlaydi; oddiy brauzerda neytral "Bu sahifa Telegram ichida ochiladi" va saytga havola. Holatlar: yuklanmoqda, kanalga a'zo bo'ling, tasdiqlash, muvaffaqiyat, xato (muddati o'tgan / ishlatilgan / sizga tegishli emas / limit). Mavjud dizayn tili: qorong'i fon, oltin urg'u, serif sarlavha, shishasimon kartochka. Matnlar o'zbekcha va qisqa. Harakat: transform/opacity, prefers-reduced-motion, mobil-birinchi, tugmalar ≥ 44px.

## Tegilmaydi
Boshqa sahifalar, Moot Court, bonus mantiqi (LINK_BONUS_ATTEMPTS), mavjud login oqimlari (parol, Telegram, Google), verify_jwt=false sozlamalari, settings/ustoz/talabalar RLS (alohida xavfsizlik bosqichi, hozir emas).

## Tugatish mezoni
"Build o'tdi" yetarli emas. TEKSHIRILDI/TEKSHIRILMADI jadvali. Sinovlar: A va B oqimlari; muddati o'tgan va ikkinchi marta ishlatilgan token; boshqa talaba profili uchun so'rov (da'vo qilingan talaba_id Google isboti bilan mos kelmasa rad); soxta initData 401; kanalga a'zo bo'lmagan bloklanadi; konflikt (eski profil asosiy, natijalar ko'chadi, hech narsa o'chmaydi); rad etish; "Kompyuterda ochish" havolasi ikkinchi marta va 5 daqiqadan keyin ishlamaydi; kanal maydoni noto'g'ri username'da xato beradi; Mini App brauzer ichida ochilsa buzilmaydi. Edge function'lar deploy holati va verify_jwt jadvali. Google/Telegram bilan haqiqiy sinovni Bolt o'tkaza olmaydi: buni TEKSHIRILMADI deb yoz.
