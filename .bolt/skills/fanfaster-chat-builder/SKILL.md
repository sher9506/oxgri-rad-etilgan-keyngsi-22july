---
name: fanfaster-chat-builder
description: Moot Court'ni o'zgartirmasdan, uning dublikati asosida "FanFaster Chat" modulini xatosiz qurish. FanFaster Chat, /chat, navbat, Manbali/Lexion modellari haqida so'ralganda ishlat.
---

# Maqsad
Moot Court'ning nusxasidan alohida "FanFaster Chat" moduli yaratish: foydalanuvchi istalgan kazus yoki huquqiy savol yozadi, tizim chuqur tahlil (lex.uz, amaliy qonunchilik) qilib javob beradi. Moot Court 100% o'zgarishsiz qoladi.

# Qoidalar (buzilmaydi)
1. Moot Court fayllari, jadvallari, funksiyalari, marshrutlari va uslublarini TAHRIRLAMA. Faqat o'qi. Umumiy fayl o'zgartirish kerak bo'lsa (masalan router, navigatsiya) — faqat yangi satr qo'sh, mavjudini o'zgartirma.
2. Dizayn tili saqlanadi: shrift, ranglar (qorong'i fon, oltin urg'u), radius, serif sarlavhalar. Yangi shrift/palitra/og'ir kutubxona yo'q.
3. Boshqa bo'limlarga (blog, reyting, admin, ustoz paneli) tegilmaydi.
4. Qattiq kodlangan domen/URL yozma; `window.location.origin` yoki env ishlat.
5. Mavjud jadval ustun nomlarini taxmin qilma: yozishdan oldin haqiqiy sxemani o'qi (migratsiyalar / Supabase). Yangi jadval uchun alohida migratsiya yoz, mavjud jadvallarni o'zgartirma.
6. Yangi edge function yaratilsa, `verify_jwt` sozlamasini mavjud funksiyalar bilan solishtirib to'g'ri qo'y va hisobotda yoz.
7. Versiya tiklash (restore) qilma — u keyingi barcha tuzatishlarni yo'qotadi. Xato bo'lsa, oldinga qarab tuzat.
8. Bu qoidalardan birini buzish kerak bo'lib qolsa, to'xta va sabab bilan so'ra.

# Ish tartibi
## 1. O'rganish (kod yozishdan oldin)
Moot Court'ning komponentlari, hooks, edge function'lari, AI chaqiruvlari, jadvallari va Qonunlar bazasi (pgvector/RAG) hamda Lex.uz qidiruvchisi pipeline'ini topib o'qi. Qaysi biri qayta ishlatiladi, qaysi biri nusxalanadi — qisqa ro'yxat tuz.

## 2. Modul
- Marshrut: /chat; navigatsiyada "FanFaster Chat".
- Interfeys NotebookLM uslubida: markazda keng sokin chat, pastda katta yozish maydoni, yuborish tugmasi va model tanlagich. Bo'sh holatda 3 ta namunaviy savol kartochkasi. Javoblar markdown (sarlavha, ro'yxat, modda havolalari). Enter = yuborish, Shift+Enter = yangi qator.
- Model tanlagich (yozish maydoni ostida), 2 ta variant:
  - "Manbali": Qonunlar bazasi (RAG) asosida, har fikr aniq modda/manba havolasi bilan.
  - "Lexion": Lex.uz qidiruvchisi pipeline'i asosida, amaliy qonunchilik bo'yicha chuqurroq tahlil.
  Agar ikkalasiga mos mavjud funksiya aniq topilmasa, taxmin qilma, oxirgi hisobotda aniq yoz.
- Hozircha foydalanish limiti yo'q; lekin jurnal yoz (kim, qachon, qaysi model).
- Kutish ogohlantirishi (doimiy yumshoq banner): "Javob o'rtacha 3 daqiqa ichida tayyor bo'ladi. Bu uzoq kutish sababi — tizim lex.uz va amaliy qonunchilikni chuqur tahlil qilmoqda." Kutishda bosqichlar ko'rsatilsin: Moddalar qidirilmoqda → Tasdiqlanmoqda → Javob yozilmoqda.
- Javob tuzilmasi: IRAC (Issue-Rule-Application-Conclusion), o'zbek tilida, kitobiy-professional, ortiqcha cho'zmasdan batafsil. Topilgan modda raqami va mazmuni mos kelishini tekshir; mos kelmasa raqam yozma.

## 3. Navbat (2 ta Render instansiyasi)
- Navbat ma'lumotlar bazasida (chat_jobs: id, user_id, model, savol, status [queued/running/done/failed], javob, xato, created_at, started_at, finished_at). Xotiradagi navbat yo'q, chunki instansiyalar ikkita.
- Ishchi vazifani atomik oladi (FOR UPDATE SKIP LOCKED yoki unga teng) — bir vazifani ikki instansiya olmasin.
- Bir vaqtdagi ishlov soni bitta o'zgaruvchida: CHAT_MAX_CONCURRENCY, boshlang'ich qiymati har instansiyada 3. Katta javob buferlarini xotirada saqlama, tugagach bazaga yoz.
- Limitdan ortgani "navbatda" holatida, foydalanuvchiga "Navbatdagi o'rningiz: N" ko'rinadi.
- Asinxron sxema: yuborish → job_id darhol qaytadi → frontend Realtime yoki 3-5 soniyalik polling bilan kuzatadi. Brauzer yopilib ochilsa, javob yo'qolmaydi.
- Xatoda 1 marta avtomatik qayta urinish, keyin aniq xabar. Ikki marta bosish ikkita vazifa yaratmasin.
- Navbat Moot Court'ga ta'sir qilmaydi.

## 4. Tekshiruv (har biri majburiy)
1. Build o'tdi.
2. Haqiqiy brauzerda /chat oqimi boshidan oxirigacha: yuborish → navbat → bosqichlar → javob. Ikkala model uchun alohida.
3. 7 ta bir vaqtdagi so'rov yuborib navbat ishlashini ko'r (6 tasi ishlaydi, 1 tasi navbatda).
4. Brauzerni yopib qayta och: javob saqlanib qolganmi.
5. Moot Court asosiy oqimini qayta sinab, o'zgarmaganini ko'rsat.
6. Desktop va mobil skrinshot. Konsolda yangi xato bo'lmasin.
"Build o'tdi" yetarli emas — 2-6 qadamlar o'tmaguncha tayyor dema.

# Yakuniy hisobot
Nimalar qayta ishlatildi va nimalar nusxalandi; "Manbali"/"Lexion" nimaga ulandi; CHAT_MAX_CONCURRENCY qayerda; tekshiruv natijalari; hal bo'lmay qolgan narsalar.
