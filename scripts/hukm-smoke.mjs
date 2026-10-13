// hukm-smoke.mjs — Hukm analitika jonli sinov skripti
// anon key bilan edge function'larni sinaydi (verify_jwt=false)
// DB tekshiruvlari va tozalash MCP execute_sql orqali alohida qilinadi

import { readFileSync } from 'fs';

const env = readFileSync('.env', 'utf-8');
const envMap = {};
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) envMap[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const SUPA_URL = envMap.VITE_SUPABASE_URL;
const SUPA_KEY = envMap.VITE_SUPABASE_ANON_KEY;
const FN_URL = `${SUPA_URL}/functions/v1/hukm-api`;
const USTOZ_ID = process.argv[2] || '';

if (!SUPA_URL || !SUPA_KEY) { console.error('ENV topilmadi'); process.exit(1); }
if (!USTOZ_ID) { console.error('Ishlatish: node scripts/hukm-smoke.mjs <ustoz_id>'); process.exit(1); }

const failures = [];
const testIds = { quizzes: [], games: [], players: [] };

function assert(cond, label) {
  if (cond) { console.log(`  ✓ ${label}`); return true; }
  console.log(`  ✗ ${label}`); failures.push(label); return false;
}

async function fn(path, opts = {}) {
  const res = await fetch(`${FN_URL}${path}`, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPA_KEY}` },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: res.status, json };
}

const Q1 = { position: 0, type: 'variant4', text: 'test_Savol1 Jinoiy kodeks moddasi?', case_text: 'Case: shaxs o\'g\'rilik qildi', options: [{text:'A',is_correct:false},{text:'B',is_correct:true},{text:'C',is_correct:false},{text:'D',is_correct:false}], time_limit_s: 10, explanation: 'Izoh1', legal_basis: 'Modda 1', kodeks_nomi: 'JK', mavzu: 'Jinoyat' };
const Q2 = { position: 1, type: 'variant4', text: 'test_Savol2 Fuqarolik kodeksi?', case_text: '', options: [{text:'X',is_correct:true},{text:'Y',is_correct:false},{text:'Z',is_correct:false},{text:'W',is_correct:false}], time_limit_s: 10, explanation: 'Izoh2', legal_basis: 'Modda 2', kodeks_nomi: 'FK', mavzu: 'Shartnoma' };

// ─── a) MA'LUMOT YIG'ISH + b) HISOBLAR + c) XAVFSIZLIK + d) OLDINGI ────────

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Hukm Analytics Smoke Test — Jonli Sinov     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Ustoz: ${USTOZ_ID}`);

  // ── d) Ping ──
  console.log('\n══ d) OLDINGI BOSQICHLAR ══');
  const ping = await fn('/ping');
  assert(ping.status === 200 && ping.json.ok === true, 'Ping 200 ok=true');
  assert(!!ping.json.version, `Ping version=${ping.json.version}`);
  console.log(`  >> VERSION=${ping.json.version}`);

  // ── a) Viktorina yaratish ──
  console.log('\n══ a) MA\'LUMOT YIG\'ISH ══');
  const quizResp = await fn('/quiz', { method: 'POST', body: { ustoz_id: USTOZ_ID, title: 'test_Viktorina_Smoke', description: 'test desc' } });
  assert(quizResp.status === 200, 'Viktorina yaratildi');
  const quizId = quizResp.json.quiz?.id;
  testIds.quizzes.push(quizId);

  // default_kodeks/mavzu PUT orqali
  const putResp = await fn(`/quiz/${quizId}`, { method: 'PUT', body: { ustoz_id: USTOZ_ID, title: 'test_Viktorina_Smoke', description: 'test', default_kodeks: 'JK', default_mavzu: 'Test-Mavzu' } });
  // PUT endpoint faqat title/description yangilaydi — default_kodeks/mavzu yo'q
  // Bu nomalum, lekin snapshot yaratishda quiz'dan o'qiydi
  // Edge function PUT'ni qo'shish kerak — hozircha davom etamiz

  // Savollarni saqlash
  const qResp = await fn(`/quiz/${quizId}/questions`, { method: 'POST', body: { ustoz_id: USTOZ_ID, questions: [Q1, Q2] } });
  assert(qResp.status === 200, 'Savollar saqlandi (teg bilan)');

  // Savollarni qayta o'qish — teg tekshirish
  const getQuiz = await fn(`/quiz/${quizId}?ustoz_id=${USTOZ_ID}`);
  assert(getQuiz.json.questions?.[0]?.kodeks_nomi === 'JK', 'Savol1 teg JK saqlangan');
  assert(getQuiz.json.questions?.[1]?.kodeks_nomi === 'FK', 'Savol2 teg FK saqlangan');

  // O'yin yaratish (snapshot bilan)
  const gameResp = await fn('/game', { method: 'POST', body: { ustoz_id: USTOZ_ID, quiz_id: quizId, group_label: 'test_Guruh1' } });
  assert(gameResp.status === 200, 'O\'yin yaratildi');
  const gameId = gameResp.json.game?.id;
  const hostToken = gameResp.json.host_token;
  const pin = gameResp.json.game?.pin;
  testIds.games.push(gameId);
  console.log(`  >> GAME_ID=${gameId}`);

  // 4 mehmon qo'shish
  const guests = [];
  for (let i = 1; i <= 4; i++) {
    const j = await fn('/game/join', { method: 'POST', body: { pin, nickname: `test_Guest${i}` } });
    assert(j.status === 200, `Mehmon${i} qo'shildi`);
    guests.push({ id: j.json.player?.id, token: j.json.player_token, nick: `test_Guest${i}` });
    testIds.players.push(j.json.player?.id);
  }

  // Band taxallus
  const dup = await fn('/game/join', { method: 'POST', body: { pin, nickname: 'test_Guest1' } });
  assert(dup.status === 409, 'Band taxallus rad etiladi (409)');

  // Rejoin
  const rejoin = await fn('/game/rejoin', { method: 'POST', body: { player_id: guests[0].id, player_token: guests[0].token, game_id: gameId } });
  assert(rejoin.status === 200, 'Rejoin OK');

  // host-resume (yangi host_token beradi — eski bekor qilinadi)
  const resume = await fn('/host-resume', { method: 'POST', body: { ustoz_id: USTOZ_ID } });
  assert(resume.status === 200 && !!resume.json.game, 'host-resume o\'yin topdi');
  // Yangi host_token olish
  const newHostToken = resume.json.host_token || hostToken;

  // Start (yangi token bilan)
  await fn(`/game/${gameId}/start`, { method: 'POST', body: { host_token: newHostToken } });

  // To'g'ri javob reveal'gacha yashirin
  const playerState = await fn(`/game/${gameId}?player_id=${guests[0].id}&player_token=${guests[0].token}`);
  assert(playerState.json.question?.correct_index === undefined, 'To\'g\'ri javob o\'yinchiga yashirin');
  const hostState = await fn(`/game/${gameId}?host_token=${newHostToken}`);
  assert(hostState.json.correct_index !== undefined, 'Host to\'g\'ri javobni ko\'radi');

  // 1-savol: g1=B(T), g2=A(F), g3=C(F), g4=B(T) → 2/4=50%
  await fn(`/game/${gameId}/answer`, { method: 'POST', body: { player_id: guests[0].id, player_token: guests[0].token, choice: 1 } });
  await new Promise(r => setTimeout(r, 200));
  await fn(`/game/${gameId}/answer`, { method: 'POST', body: { player_id: guests[1].id, player_token: guests[1].token, choice: 0 } });
  await fn(`/game/${gameId}/answer`, { method: 'POST', body: { player_id: guests[2].id, player_token: guests[2].token, choice: 2 } });
  await fn(`/game/${gameId}/answer`, { method: 'POST', body: { player_id: guests[3].id, player_token: guests[3].token, choice: 1 } });

  // Reveal + next
  await fn(`/game/${gameId}/reveal`, { method: 'POST', body: { host_token: newHostToken } });
  await fn(`/game/${gameId}/next`, { method: 'POST', body: { host_token: newHostToken } });

  // 2-savol: g1=X(T), g2=X(T), g3=Y(F), g4=X(T) → 3/4=75%
  await fn(`/game/${gameId}/answer`, { method: 'POST', body: { player_id: guests[0].id, player_token: guests[0].token, choice: 0 } });
  await fn(`/game/${gameId}/answer`, { method: 'POST', body: { player_id: guests[1].id, player_token: guests[1].token, choice: 0 } });
  await fn(`/game/${gameId}/answer`, { method: 'POST', body: { player_id: guests[2].id, player_token: guests[2].token, choice: 1 } });
  await fn(`/game/${gameId}/answer`, { method: 'POST', body: { player_id: guests[3].id, player_token: guests[3].token, choice: 0 } });

  // Finish
  await fn(`/game/${gameId}/reveal`, { method: 'POST', body: { host_token: newHostToken } });
  const finishResp = await fn(`/game/${gameId}/next`, { method: 'POST', body: { host_token: newHostToken } });
  assert(finishResp.json.finished === true, 'O\'yin tugadi');

  // Session ID'ni olish — sessions endpoint'idan
  const sessList = await fn(`/sessions?ustoz_id=${USTOZ_ID}`);
  assert(sessList.status === 200, 'Sessions list 200');
  const testSession = sessList.json.sessions?.find(s => s.game_id === gameId);
  assert(!!testSession, 'Session yaratilgan');
  assert(testSession?.group_label === 'test_Guruh1', `Session group_label='test_Guruh1' (haqiqiy='${testSession?.group_label}')`);
  assert(!!testSession?.questions_snapshot, 'Session snapshot nusxalangan');
  const sessionId = testSession?.id;
  console.log(`  >> SESSION_ID=${sessionId}`);

  // Savol matnini tahrirlash
  await fn(`/quiz/${quizId}/questions`, { method: 'POST', body: { ustoz_id: USTOZ_ID, questions: [
    { ...Q1, text: 'test_EDITED_text' }, Q2
  ] }});

  // ── b) HISOBLAR ──
  console.log('\n══ b) HISOBLAR ══');
  const analytics = await fn(`/analytics_session/${sessionId}?ustoz_id=${USTOZ_ID}`);
  assert(analytics.status === 200, 'analytics_session 200');
  const d = analytics.json;

  assert(d.questions?.length === 2, `2 savol tahlili (${d.questions?.length})`);
  assert(d.students?.length === 4, `4 o'quvchi (${d.students?.length})`);

  const q0 = d.questions[0];
  assert(q0.correct_pct === 50, `S1 to'g'ri 50% (${q0.correct_pct}%)`);
  assert(q0.option_counts?.[1] === 2, `S1 variant B=2 (${q0.option_counts?.[1]})`);
  assert(q0.answered_count === 4, `S1 answered=4 (${q0.answered_count})`);
  assert(q0.no_answer_count === 0, `S1 no_answer=0 (${q0.no_answer_count})`);
  assert(q0.discrimination_index === null, `S1 D=null (<10)`);
  assert(q0.discrimination_note === 'ma\'lumot kam', `S1 D note`);
  assert(q0.most_common_wrong === 0 || q0.most_common_wrong === 2, `S1 most_common_wrong A/C`);
  // Snapshot'dan eski matn
  assert(q0.text === 'test_Savol1 Jinoiy kodeks moddasi?', `Snapshot eski matn ('${q0.text}')`);

  const q1 = d.questions[1];
  assert(q1.correct_pct === 75, `S2 to'g'ri 75% (${q1.correct_pct}%)`);

  // g1: ikkalada to'g'ri → 100%, baho 5
  const s1 = d.students.find(s => s.nickname === 'test_Guest1');
  assert(s1?.correct_pct === 100, `G1 100% (${s1?.correct_pct}%)`);
  assert(s1?.grade === '5', `G1 baho 5 (${s1?.grade})`);

  // g3: ikkalada xato → 0%, baho 2
  const s3 = d.students.find(s => s.nickname === 'test_Guest3');
  assert(s3?.correct_pct === 0, `G3 0% (${s3?.correct_pct}%)`);
  assert(s3?.grade === '2', `G3 baho 2 (${s3?.grade})`);

  assert(d.guest_count === 4, `4 mehmon (${d.guest_count})`);
  assert(d.grade_scale?.t5 === 86, `Default t5=86`);
  assert(d.grade_scale?.t4 === 71, `Default t4=71`);
  assert(d.grade_scale?.t3 === 55, `Default t3=55`);

  // ── Grade scale set + verify ──
  await fn('/grade_scale_set', { method: 'POST', body: { ustoz_id: USTOZ_ID, scale: '5', t5: 90, t4: 75, t3: 50 } });
  const gs2 = await fn(`/grade_scale_get?ustoz_id=${USTOZ_ID}`);
  assert(gs2.json.scale?.t5 === 90, `Yangi t5=90`);
  // Reset
  await fn('/grade_scale_set', { method: 'POST', body: { ustoz_id: USTOZ_ID, scale: '5', t5: 86, t4: 71, t3: 55 } });

  // ── Tag options ──
  const tagResp = await fn(`/tag-options?ustoz_id=${USTOZ_ID}`);
  assert(tagResp.status === 200, 'tag-options 200');
  assert(tagResp.json.mavzu?.includes('Jinoyat') || tagResp.json.mavzu?.includes('Shartnoma'), 'tag-options mavzu bor');

  // ── c) XAVFSIZLIK ──
  console.log('\n══ c) XAVFSIZLIK ══');
  const badResp = await fn(`/analytics_session/${sessionId}?ustoz_id=00000000-0000-0000-0000-000000000000`);
  assert(badResp.status === 403, 'Noto\'g\'ri ustoz 403');
  const emptyResp = await fn(`/analytics_session/${sessionId}?ustoz_id=`);
  assert(emptyResp.status === 401, 'Bo\'sh ustoz 401');
  const respStr = JSON.stringify(d);
  assert(!respStr.includes('token'), 'Javobda token yo\'q');
  assert(!respStr.includes('email'), 'Javobda email yo\'q');

  // Cleanup IDs
  console.log('\n══ TOZALASH MA\'LUMOTI ══');
  console.log(`  >> CLEANUP_QUIZZES=${testIds.quizzes.join(',')}`);
  console.log(`  >> CLEANUP_GAMES=${testIds.games.join(',')}`);
  console.log(`  >> CLEANUP_PLAYERS=${testIds.players.join(',')}`);
  console.log(`  >> CLEANUP_SESSION=${sessionId || 'N/A'}`);
  console.log(`  >> CLEANUP_USTOZ=${USTOZ_ID}`);

  console.log('\n══════════════════════════════════════');
  if (failures.length === 0) {
    console.log('  HAMMASI ISBOTLANDI — 0 xato');
  } else {
    console.log(`  ${failures.length} ta XATO:`);
    for (const f of failures) console.log(`    ✗ ${f}`);
  }
  console.log('══════════════════════════════════════\n');
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch(err => { console.error('Skript xatosi:', err); process.exit(2); });
