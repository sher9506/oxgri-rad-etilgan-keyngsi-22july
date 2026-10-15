/**
 * Yuk testi — baholash funksiyasi uchun.
 * Mock talaba javoblari bilan ishlaydi, haqiqiy talaba ma'lumotlari ISHLATILMAYDI.
 *
 * Ishlatish:
 *   node scripts/load-test-baholash.mjs
 *
 * Senariylar: 1, 5, 10, 20, 50, 100 talaba bir vaqtda.
 * Har senariy orasida 70 soniya kutish.
 *
 * Natija: jadval ko'rinishida konsolga chiqadi.
 */

import { readFileSync } from 'fs';

// .env faylni qo'lda o'qish (dotenv yo'qligi uchun)
const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2];
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY || envVars.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('SUPABASE_URL yoki ANON_KEY topilmadi. .env ni tekshering.');
  process.exit(1);
}

const BAHOLASH_URL = `${SUPABASE_URL}/functions/v1/baholash`;

// ─── MOCK KAZUS MA'LUMOTLARI ───────────────────────────────────────────────
// 5 ta kazus, har birida qisqa matn + to'g'ri javob

const MOCK_KAZUSLAR = [
  {
    kazus: "A shaxs B shaxsga 10 million so'm qarz berdi. Qarz shartnomasi yozma ravishda tuzilgan. Muddat o'tib B shaxs qarzni qaytarmadi. A shaxs qanday huquqiy choralar ko'rish mumkin?",
    javob: "A shaxs Fuqarolik kodeksining 161-moddasi asosida qarz shartnomasini bajarishni talab qilish huquqiga ega. Dastlab, yozma talab yuborishi kerak. Agar B shaxs ixtiyoriy ravishda qaytarmasa, sudga murojaat qilishi mumkin. Shartnoma yozma bo'lgani uchun dalil sifatida xizmat qiladi.",
  },
  {
    kazus: "C shaxs o'z mol-mulkini vasiyatnoma orqali D shaxsga o'tkazdi. Vasiyatnomada guvohlar imzosi bor. C shaxs vafot etgach, uning merosxo'rlari vasiyatnomani norasmiy deb hisoblashga harakat qilyapti. Qanday yechim?",
    javob: "Fuqarolik kodeksi 1195-moddasiga ko'ra, vasiyatnoma notarial tasdiqlangan bo'lishi shart. Agar vasiyatnoma notarial tasdiqlangan bo'lsa, u majburiy bajarilishi kerak. Guvohlar imzosi qo'shimcha dalil hisoblanadi. Merosxo'rlar uni norasmiy deb hisoblay olmaydi.",
  },
  {
    kazus: "X kompaniyasi Y kompaniyasi bilan yetkazib berish shartnomasi tuzdi. Y kompaniya mahsulotni 30 kunda yetkazib berishi kerak edi, lekin 60 kunda yetkazib berdi. X kompaniya qanday huquqlarga ega?",
    javob: "Fuqarolik kodeksi 374-moddasi asosida, Y kompaniya shartnoma shartlarini buzgan. X kompaniya yetkazib berish muddatini buzganlik uchun jarima talab qilish huquqiga ega. Shartnomada jarima miqdori ko'rsatilgan bo'lishi kerak. Agar ko'rsatilmagan bo'lsa, moddiy zararni undirish mumkin.",
  },
  {
    kazus: "Z shaxs internet-do'kondan telefondi sotib oldi, lekin telefoni ishlamadi. Z shaxs qaytarishni xohlaydi. Do'kon yetkazib beruvchi buning ustida ishlayotganini aytib vaqtni cho'zmoqda. Qanday yo'l tutish kerak?",
    javob: "Iste'molchining huquqlarini himoya qilish to'g'risidagi qonun 15-moddasiga ko'ra, Z shaxs sifatsiz mahsulotni qaytarish huquqiga ega. 14 kun ichida qaytarishi mumkin. Do'kon buni rad eta olmaydi. Agar rad etsa, Z shaxs Rospotrebnadzorga yoki sudga murojaat qilishi mumkin.",
  },
  {
    kazus: "M shaxs N shaxsga transport vositasini ijaraga berdi. Shartnomada 6 oy ko'rsatilgan. 3 oydai N shaxs transportni qaytarishni xohlamayapti. M shaxs nima qilishi mumkin?",
    javob: "Fuqarolik kodeksi 399-moddasi asosida, ijarachi shartnoma muddati tugaguncha buyumni qaytarishi shart. N shaxs shartnomani buzmoqda. M shaxs sudga murojaat qilib, transportni majburiy qaytarishni va ijaraning qolgan davri uchun to'lovni talab qilishi mumkin.",
  },
];

// Mock talaba javoblari — qisqa va sifati past
const MOCK_TALABA_JAVOBI = "Bu vaziyatda talaba fuqarolik huquqi normalarini qo'llash kerak. Shartnoma majburiy kuchga ega. Qonun bo'yicha zarar qoplanishi lozim. Moddalarga ko'ra talab qo'yish mumkin.";

// ─── TEST TOPLAM YARATISH ──────────────────────────────────────────────────

async function createTestToplam() {
  const kod = 'TEST' + Math.floor(1000 + Math.random() * 9000);
  const body = {
    kod,
    ustoz_id: '00000000-0000-0000-0000-000000000000',
    ustoz_ismi: 'Test Ustoz',
    mavzu: 'YUK TESTI - Mock Kazus',
    kazuslar: MOCK_KAZUSLAR.map(k => ({
      ...k,
      mezon_sozlamalar: [
        { id: 'mazmun', nom: 'Mazmuniy moslik', faol: true, ball: 25, asl_ball: 25 },
        { id: 'tizimli', nom: 'Tizimli bilim', faol: true, ball: 1, asl_ball: 1 },
        { id: 'terminologiya', nom: 'Terminologiya', faol: true, ball: 1, asl_ball: 1 },
        { id: 'muammo', nom: 'Muammoni aniqlash', faol: true, ball: 1, asl_ball: 1 },
        { id: 'tayanch', nom: 'Tayanch tushunchalar', faol: true, ball: 1, asl_ball: 1 },
        { id: 'mantiq', nom: 'Mantiqiylik', faol: true, ball: 1, asl_ball: 1 },
      ],
      qoshimcha_mezonlar: [],
    })),
    vaqt_daqiqa: 60,
    copy_paste_ruxsat: true,
    allow_retake: true,
    model_tur: 'oddiy',
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/toplamlar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Test toplam yaratish xatosi [${res.status}]: ${txt}`);
  }
  console.log(`Test toplam yaratildi: kod=${kod}`);
  return kod;
}

// ─── BAHOLASH CHAQIRUVI ────────────────────────────────────────────────────

async function callBaholash(toplamKod, talabaIsmi) {
  const startTime = Date.now();
  const javoblar = MOCK_KAZUSLAR.map((_, i) => ({
    kazus_index: i,
    javob: MOCK_TALABA_JAVOBI,
    aflotun_guruh: false,
  }));

  try {
    const res = await fetch(BAHOLASH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({
        toplam_kod: toplamKod,
        oquvchi_ismi: talabaIsmi,
        javoblar,
        save_to_db: false,
        is_test: true,
      }),
    });

    const elapsed = Date.now() - startTime;
    const status = res.status;
    let body = null;
    try { body = await res.json(); } catch { body = { raw: await res.text() }; }

    return {
      success: status === 200 && body?.success === true,
      status,
      elapsed,
      error: body?.error || (status !== 200 ? `HTTP ${status}` : null),
      baho: body?.baho || null,
    };
  } catch (err) {
    return {
      success: false,
      status: 0,
      elapsed: Date.now() - startTime,
      error: err.message,
      baho: null,
    };
  }
}

// ─── SENARIY ISHGA TUSHIRISH ───────────────────────────────────────────────

async function runScenario(talabaSoni, toplamKod) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`SENARIY: ${talabaSoni} talaba bir vaqtda (${talabaSoni * 5} ta AI so'rov)`);
  console.log(`${'='.repeat(70)}`);

  const talabalar = Array.from({ length: talabaSoni }, (_, i) => `TestTalaba_${talabaSoni}_${i + 1}_${Date.now()}`);

  const t0 = Date.now();
  const results = await Promise.allSettled(
    talabalar.map(name => callBaholash(toplamKod, name))
  );
  const totalElapsed = Date.now() - t0;

  const fulfilled = results.map(r => r.status === 'fulfilled' ? r.value : { success: false, status: 0, elapsed: 0, error: String(r.reason) });

  const muvaffaqiyatli = fulfilled.filter(r => r.success).length;
  const xato429 = fulfilled.filter(r => r.status === 429 || (r.error && r.error.includes('429'))).length;
  const boshqaXato = fulfilled.filter(r => !r.success && r.status !== 429 && !(r.error && r.error.includes('429'))).length;
  const elapsedlar = fulfilled.map(r => r.elapsed).filter(e => e > 0);
  const ortachaVaqt = elapsedlar.length > 0 ? Math.round(elapsedlar.reduce((s, e) => s + e, 0) / elapsedlar.length) : 0;
  const maxVaqt = elapsedlar.length > 0 ? Math.max(...elapsedlar) : 0;

  // Birinchi 429 qaysi so'rovda
  let birinchi429 = '-';
  const sortedByElapsed = [...fulfilled].sort((a, b) => a.elapsed - b.elapsed);
  const first429 = sortedByElapsed.find(r => r.status === 429 || (r.error && r.error.includes('429')));
  if (first429) {
    const idx = fulfilled.indexOf(first429);
    birinchi429 = `${idx + 1}-talaba`;
  }

  // Xato turlarini to'plash
  const xatoTurlari = {};
  fulfilled.filter(r => !r.success).forEach(r => {
    const key = r.status ? `HTTP ${r.status}` : (r.error || 'Unknown');
    const shortKey = key.slice(0, 80);
    xatoTurlari[shortKey] = (xatoTurlari[shortKey] || 0) + 1;
  });

  console.log(`  Muvaffaqiyatli: ${muvaffaqiyatli}/${talabaSoni}`);
  console.log(`  429 xato: ${xato429}`);
  console.log(`  Boshqa xato: ${boshqaXato}`);
  console.log(`  O'rtacha vaqt: ${ortachaVaqt}ms`);
  console.log(`  Maksimal vaqt: ${maxVaqt}ms`);
  console.log(`  Jami vaqt: ${totalElapsed}ms (${(totalElapsed / 1000).toFixed(1)}s)`);
  console.log(`  Birinchi 429: ${birinchi429}`);
  if (Object.keys(xatoTurlari).length > 0) {
    console.log(`  Xato turlari:`);
    Object.entries(xatoTurlari).forEach(([k, v]) => console.log(`    ${k}: ${v} ta`));
  }

  return {
    senariy: talabaSoni,
    muvaffaqiyatli,
    xato429,
    boshqaXato,
    ortachaVaqt,
    maxVaqt,
    jamiVaqt: totalElapsed,
    birinchi429,
    xatoTurlari,
  };
}

// ─── ASOSIY FUNKSIYA ───────────────────────────────────────────────────────

async function main() {
  console.log('================================================================');
  console.log("   BAHOLASH YUK TESTI - AI RATE LIMIT O'LCHASH");
  console.log("   Mock ma'lumotlar, productionga ta'sir qilmaydi");
  console.log('================================================================');
  console.log(`\nSupabase URL: ${SUPABASE_URL}`);
  console.log(`Baholash URL: ${BAHOLASH_URL}`);
  console.log(`Vaqt: ${new Date().toISOString()}`);

  // Test toplam allaqachon SQL orqali yaratilgan (kod: TESTLOAD)
  const toplamKod = 'TESTLOAD';
  console.log(`Test toplam ishlatilmoqda: kod=${toplamKod}`);

  const senariylar = [1, 5, 10, 20, 50, 100];
  const natijalar = [];

  for (let i = 0; i < senariylar.length; i++) {
    const s = senariylar[i];
    const result = await runScenario(s, toplamKod);
    natijalar.push(result);

    // Senariylar orasida 70 soniya kutish (limit tiklanishi uchun)
    if (i < senariylar.length - 1) {
      console.log(`\n  70 soniya kutilmoqda (rate limit tiklanishi uchun)...`);
      await new Promise(r => setTimeout(r, 70000));
    }
  }

  // ─── YAKUNIY HISOBOT ─────────────────────────────────────────────────────
  console.log('\n\n');
  console.log('================================================================');
  console.log('              YAKUNIY HISOBOT');
  console.log('================================================================');
  console.log('');
  console.log('| Senariy | Muvaffaqiyat | 429 | Boshqa | O\'rtacha | Maks | Jami | 1-429 |');
  console.log('|---------|-------------|-----|--------|----------|------|------|-------|');
  natijalar.forEach(n => {
    console.log(`| ${String(n.senariy).padStart(7)} | ${String(n.muvaffaqiyatli).padStart(11)} | ${String(n.xato429).padStart(3)} | ${String(n.boshqaXato).padStart(6)} | ${String(n.ortachaVaqt + 'ms').padStart(8)} | ${String(n.maxVaqt + 'ms').padStart(4)} | ${String(n.jamiVaqt + 'ms').padStart(5)} | ${String(n.birinchi429).padStart(5)} |`);
  });

  // Jami so'rov soni
  const jamiSorov = natijalar.reduce((s, n) => s + n.muvaffaqiyatli + n.xato429 + n.boshqaXato, 0);
  const jamiMuvaffaqiyatli = natijalar.reduce((s, n) => s + n.muvaffaqiyatli, 0);
  const jami429 = natijalar.reduce((s, n) => s + n.xato429, 0);
  console.log(`\nJami so'rov: ${jamiSorov} (muvaffaqiyatli: ${jamiMuvaffaqiyatli}, 429: ${jami429})`);
  console.log(`Jami AI chaqiruv (har so'rov = 5 kazus): ${jamiSorov * 5}`);

  console.log('\n--- Xato turlari detalizatsiyasi ---');
  natijalar.forEach(n => {
    if (Object.keys(n.xatoTurlari).length > 0) {
      console.log(`\nSenariy ${n.senariy}:`);
      Object.entries(n.xatoTurlari).forEach(([k, v]) => console.log(`  ${k}: ${v} ta`));
    }
  });

  console.log(`\nTest yakunlandi: ${new Date().toISOString()}`);
  console.log(`\nEslatma: ai_usage_log jadvalida is_test=true bo'lgan qatorlar shu testdan.`);
  console.log(`Jami test AI chaqiruvlari soni = ${jamiSorov * 5} ta (Gemini + Groq).`);
}

main().catch(err => {
  console.error('Test xatosi:', err);
  process.exit(1);
});
