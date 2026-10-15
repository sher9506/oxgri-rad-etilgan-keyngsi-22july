/**
 * Yuk testi v2 — topshirish tezligi senariylari.
 * A) 10 talaba, har 30 soniyada 1 talaba (5 daqiqa ichida)
 * B) 20 talaba, har 15 soniyada 1 talaba (5 daqiqa ichida)
 * C) 30 talaba, har 10 soniyada 1 talaba (5 daqiqa ichida)
 * Har senariy orasida 3 daqiqa kutish.
 *
 * HAQIQIY muvaffaqiyat: hamma 5 kazusda izoh "xatolik"/"texnik" O'Z ICHIGA OLMASA
 * va ball fallback 1 bo'lmasa.
 */

import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2];
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL;
const ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY || envVars.SUPABASE_ANON_KEY;
const BAHOLASH_URL = `${SUPABASE_URL}/functions/v1/baholash`;

const MOCK_TALABA_JAVOBI = "Bu vaziyatda talaba fuqarolik huquqi normalarini qollash kerak. Shartnoma majburiy kuchga ega. Qonun boyicha zarar qoplanishi lozim. Moddalarga kora talab qoyish mumkin.";

// Baholash natijasini tekshirish: to'liq baholanganmi?
function isFullyGraded(baho) {
  if (!baho || !Array.isArray(baho) || baho.length === 0) return false;
  for (const k of baho) {
    const izoh = (k.izoh || '').toLowerCase();
    const xulosa = (k.batafsil_tahlil?.umumiy_xulosa || '').toLowerCase();
    // Fallback natija: "xatolik" yoki "texnik" so'zi bo'lsa yoki ball=1 va izoh xatolik haqida
    if (izoh.includes('xatolik') || izoh.includes('texnik') || izoh.includes('xatolik yuz berdi')) return false;
    if (xulosa.includes('xatolik') || xulosa.includes('texnik')) return false;
    // Fallback ball=1 va izoh xato haqida — qisman hisoblaymiz
  }
  return true;
}

function isPartiallyGraded(baho) {
  if (!baho || !Array.isArray(baho) || baho.length === 0) return false;
  let hasGood = false, hasBad = false;
  for (const k of baho) {
    const izoh = (k.izoh || '').toLowerCase();
    if (izoh.includes('xatolik') || izoh.includes('texnik') || izoh.includes('xatolik yuz berdi')) {
      hasBad = true;
    } else {
      hasGood = true;
    }
  }
  return hasGood && hasBad;
}

async function callBaholash(toplamKod, talabaIsmi) {
  const startTime = Date.now();
  const javoblar = Array.from({ length: 5 }, (_, i) => ({
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

    const elapsed = (Date.now() - startTime) / 1000;
    const status = res.status;
    let body = null;
    try { body = await res.json(); } catch { body = { raw: await res.text() }; }

    const baho = body?.baho || null;
    const toliq = isFullyGraded(baho);
    const qisman = isPartiallyGraded(baho);

    return {
      status,
      elapsed,
      success: status === 200,
      toliq,
      qisman,
      umuman: status !== 200 || (!toliq && !qisman),
      baho,
      error: body?.error || null,
    };
  } catch (err) {
    return {
      status: 0,
      elapsed: (Date.now() - startTime) / 1000,
      success: false,
      toliq: false,
      qisman: false,
      umuman: true,
      baho: null,
      error: err.message,
    };
  }
}

async function runScenario(name, talabaSoni, intervalSec, toplamKod) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`SENARIY ${name}: ${talabaSoni} talaba, har ${intervalSec}s da 1 ta (jami ~${(talabaSoni * intervalSec / 60).toFixed(1)} daqiqa)`);
  console.log(`${'='.repeat(70)}`);

  const results = [];
  const sendTimes = [];
  let lastSendTime = 0;
  let lastResultTime = 0;

  for (let i = 0; i < talabaSoni; i++) {
    const talabaIsmi = `TestT_${name}_${i + 1}_${Date.now()}`;
    const sendTime = Date.now();
    sendTimes.push(sendTime);

    // Non-blocking: chaqiruvni boshlab qo'yamiz, keyin interval kutamiz
    const promise = callBaholash(toplamKod, talabaIsmi).then(r => {
      const resultTime = Date.now();
      if (resultTime > lastResultTime) lastResultTime = resultTime;
      return r;
    });
    results.push(promise);

    if (i < talabaSoni - 1) {
      await new Promise(r => setTimeout(r, intervalSec * 1000));
    }
  }

  // Hammasi tugashini kutamiz
  const allResults = await Promise.allSettled(results);
  const fulfilled = allResults.map(r => r.status === 'fulfilled' ? r.value : { status: 0, elapsed: 0, success: false, toliq: false, qisman: false, umuman: true, error: String(r.reason) });

  const toliqBaholandi = fulfilled.filter(r => r.toliq).length;
  const qismanBaholandi = fulfilled.filter(r => r.qisman).length;
  const umumanBaholanmadi = fulfilled.filter(r => r.umuman).length;
  const elapsedlar = fulfilled.map(r => r.elapsed).filter(e => e > 0);
  const ortachaKutish = elapsedlar.length > 0 ? (elapsedlar.reduce((s, e) => s + e, 0) / elapsedlar.length).toFixed(1) : '-';
  const engUzoqKutish = elapsedlar.length > 0 ? Math.max(...elapsedlar).toFixed(1) : '-';

  // Oxirgi talaba natijasi necha daqiqa keyin keldi
  const firstSend = sendTimes[0];
  const totalDurationSec = (lastResultTime - firstSend) / 1000;
  const lastSend = sendTimes[sendTimes.length - 1];
  const lastWaitAfterSend = ((lastResultTime - lastSend) / 1000 / 60).toFixed(1);

  console.log(`  To'liq baholandi: ${toliqBaholandi}/${talabaSoni}`);
  console.log(`  Qisman (1+ kazus xato): ${qismanBaholandi}`);
  console.log(`  Umuman baholanmadi: ${umumanBaholanmadi}`);
  console.log(`  O'rtacha kutish: ${ortachaKutish}s`);
  console.log(`  Eng uzoq kutish: ${engUzoqKutish}s`);
  console.log(`  Jami vaqt (birinchi yuborishdan oxirgi natijagacha): ${(totalDurationSec / 60).toFixed(1)} daqiqa`);
  console.log(`  Oxirgi talaba natijasi yuborilgandan ${lastWaitAfterSend} daqiqa keyin keldi`);

  // Xato tafsilotlari
  const xatoTurlari = {};
  fulfilled.filter(r => !r.toliq).forEach(r => {
    const key = r.status ? `HTTP ${r.status}` : (r.error || 'Unknown');
    const shortKey = key.slice(0, 60);
    xatoTurlari[shortKey] = (xatoTurlari[shortKey] || 0) + 1;
  });
  if (Object.keys(xatoTurlari).length > 0) {
    console.log(`  Xato turlari:`);
    Object.entries(xatoTurlari).forEach(([k, v]) => console.log(`    ${k}: ${v} ta`));
  }

  // Fallback tahlil
  const fallbacklar = fulfilled.filter(r => r.baho && Array.isArray(r.baho));
  let fallbackKazuslar = 0;
  fallbacklar.forEach(r => {
    r.baho.forEach(k => {
      const izoh = (k.izoh || '').toLowerCase();
      if (izoh.includes('xatolik') || izoh.includes('texnik')) fallbackKazuslar++;
    });
  });
  if (fallbackKazuslar > 0) {
    console.log(`  Fallback kazuslar (xatolik izohi bilan): ${fallbackKazuslar} ta`);
  }

  return {
    senariy: name,
    yuborildi: talabaSoni,
    toliqBaholandi,
    qismanBaholandi,
    umumanBaholanmadi,
    ortachaKutish,
    engUzoqKutish,
    totalDurationMin: (totalDurationSec / 60).toFixed(1),
    lastWaitAfterSend,
    fallbackKazuslar,
  };
}

async function main() {
  console.log('================================================================');
  console.log("   BAHOLASH YUK TESTI v2 - TOPSHIRISH TEZLIGI");
  console.log("   Mock ma'lumotlar, productionga ta'sir qilmaydi");
  console.log('================================================================');
  console.log(`Vaqt: ${new Date().toISOString()}`);
  console.log(`Toplam: TESTLOAD`);

  const toplamKod = 'TESTLOAD';

  // TEST BOSQICH: bitta talaba bilan tekshirish
  console.log('\n--- BOSQICH 0: Bitta talaba bilan tekshirish ---');
  const testResult = await callBaholash(toplamKod, `TestCheck_${Date.now()}`);
  console.log(`  Status: ${testResult.status}, to'liq: ${testResult.toliq}, vaqt: ${testResult.elapsed}s`);
  if (testResult.baho) {
    testResult.baho.forEach((k, i) => {
      console.log(`  Kazus ${i + 1}: ball=${k.ball}, izoh="${(k.izoh || '').slice(0, 60)}"`);
    });
  }

  const natijalar = [];

  // A) 10 talaba, har 30 soniyada
  const rA = await runScenario('A', 10, 30, toplamKod);
  natijalar.push(rA);
  console.log('\n  3 daqiqa kutilmoqda (kvota tiklanishi uchun)...');
  await new Promise(r => setTimeout(r, 180000));

  // B) 20 talaba, har 15 soniyada
  const rB = await runScenario('B', 20, 15, toplamKod);
  natijalar.push(rB);
  console.log('\n  3 daqiqa kutilmoqda (kvota tiklanishi uchun)...');
  await new Promise(r => setTimeout(r, 180000));

  // C) 30 talaba, har 10 soniyada
  const rC = await runScenario('C', 30, 10, toplamKod);
  natijalar.push(rC);

  // YAKUNIY HISOBOT
  console.log('\n\n');
  console.log('================================================================');
  console.log('              YAKUNIY HISOBOT');
  console.log('================================================================');
  console.log('');
  console.log("| Senariy | Yuborildi | Toliq baholandi | Qisman | Umuman baholanmadi | Ortacha kutish | Eng uzoq kutish | Gemini 429 | Groq 429 |");
  console.log("|---------|-----------|-----------------|--------|---------------------|----------------|----------------|------------|----------|");

  // 429 larni log dan olish uchun keyin SQL bilan olamiz, avval jadvalni chiqaramiz
  natijalar.forEach(n => {
    console.log(`| ${n.senariy.padStart(7)} | ${String(n.yuborildi).padStart(9)} | ${String(n.toliqBaholandi).padStart(15)} | ${String(n.qismanBaholandi).padStart(6)} | ${String(n.umumanBaholanmadi).padStart(19)} | ${String(n.ortachaKutish + 's').padStart(14)} | ${String(n.engUzoqKutish + 's').padStart(14)} |     ?      |    ?     |`);
  });

  console.log('\n--- Tafsilotlar ---');
  natijalar.forEach(n => {
    console.log(`\nSenariy ${n.senariy}:`);
    console.log(`  Toliq baholandi: ${n.toliqBaholandi}/${n.yuborildi}`);
    console.log(`  Qisman: ${n.qismanBaholandi}`);
    console.log(`  Umuman baholanmadi: ${n.umumanBaholanmadi}`);
    console.log(`  Ortacha kutish: ${n.ortachaKutish}s`);
    console.log(`  Eng uzoq kutish: ${n.engUzoqKutish}s`);
    console.log(`  Jami vaqt: ${n.totalDurationMin} daqiqa`);
    console.log(`  Oxirgi talaba natijasi yuborilgandan ${n.lastWaitAfterSend} daqiqa keyin keldi`);
    if (n.fallbackKazuslar > 0) {
      console.log(`  Fallback kazuslar: ${n.fallbackKazuslar}`);
    }
  });

  console.log(`\nTest yakunlandi: ${new Date().toISOString()}`);
  console.log(`\nEslatma: ai_usage_log jadvalida is_test=true qatorlar shu testdan.`);
  console.log(`Gemini/Groq 429 va muvaffaqiyatli chaqiruvlarni log dan SQL bilan oling.`);
  console.log(`\nSQL so'rov:`);
  console.log(`SELECT provider, http_status, success, COUNT(*) FROM ai_usage_log`);
  console.log(`WHERE is_test=true AND created_at >= '<test_boshlanish_vaqti>'`);
  console.log(`GROUP BY provider, http_status, success ORDER BY provider, http_status;`);
}

main().catch(err => {
  console.error('Test xatosi:', err);
  process.exit(1);
});
