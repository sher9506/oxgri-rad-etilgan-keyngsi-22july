// hukm-api — Hukm jonli viktorina server yadrosi (v3.3)
// Auth: ustoz_id ustoz jadvalidan tekshiriladi (quiz CRUD uchun).
// O'yin holati host/player token orqali (hash saqlanadi).
// Barcha DB operatsiyalari service role orqali (RLS yoqilgan, anon policy yo'q).
// v3: mehmon qo'shilish, rejoin, host_resume, server_now/ends_at, broadcast signallari.
// v3.1: rejoin tugagan o'yinga natija qaytaradi, FN_VERSION belgisi qo'shildi.
// v3.3: broadcast REST API orqali (WebSocket subscribe/send/remove poyga xavfi yo'q).

const FN_VERSION = 'hukm-api-v3.3';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { calculatePoints } from '../_shared/hukm-scoring.ts';
import { callAIWithFallback } from '../_shared/ai-provider.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const RATE_LIMIT_JOIN = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_PLAYERS = 100;
const STALE_GAME_MS = 3 * 60 * 60 * 1000; // 3 soat

// ─── YORDAMCHI FUNKSIYALAR ────────────────────────────────────────────────────

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

function nowIso(): string {
  return new Date().toISOString();
}

// Broadcast signal yuborish — Realtime REST API orqali
// REST endpoint WebSocket obunasini talab qilmaydi — poyga xavfi yo'q.
// POST /realtime/v1/api/broadcast { messages: [{ topic, event, payload }] }
async function broadcastSignal(gameId: string, status: string, currentIndex: number): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const topic = `hukm:${gameId}`;
    const restUrl = `${supabaseUrl}/realtime/v1/api/broadcast`;
    const resp = await fetch(restUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify({
        messages: [{
          topic,
          event: 'state',
          payload: { status, current_index: currentIndex },
        }],
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.log(`[hukm-api] broadcast REST ${resp.status} (${gameId}): ${body.slice(0, 200)}`);
    }
  } catch (e) {
    // Broadcast xatosi kritik emas — polling zaxira
    console.log(`[hukm-api] broadcast REST xatosi (${gameId}): ${e.message || e}`);
  }
}

// Ustoz vakolatini tekshirish — ustoz_id bo'yicha ustoz jadvalidan
async function verifyUstoz(ustozId: string): Promise<boolean> {
  if (!ustozId) return false;
  const { data } = await supabaseAdmin
    .from('ustoz')
    .select('id, status')
    .eq('id', ustozId)
    .maybeSingle();
  return !!data && data.status === 'approved';
}

// Quiz egasi tekshiruvi
async function verifyQuizOwner(quizId: string, ustozId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('hukm_quizzes')
    .select('owner')
    .eq('id', quizId)
    .maybeSingle();
  return !!data && data.owner === ustozId;
}

async function verifyHostToken(gameId: string, hostToken: string): Promise<boolean> {
  const hash = await sha256Hex(hostToken);
  const { data } = await supabaseAdmin
    .from('hukm_games')
    .select('id')
    .eq('id', gameId)
    .eq('host_token_hash', hash)
    .maybeSingle();
  return !!data;
}

async function verifyPlayerToken(playerId: string, playerToken: string): Promise<{ valid: boolean; kicked: boolean }> {
  const hash = await sha256Hex(playerToken);
  const { data } = await supabaseAdmin
    .from('hukm_players')
    .select('id, kicked')
    .eq('id', playerId)
    .eq('player_token_hash', hash)
    .maybeSingle();
  if (!data) return { valid: false, kicked: false };
  return { valid: true, kicked: data.kicked };
}

// Rate limit — FAQAT muvaffaqiyatsiz urinishlar sanaladi
async function checkRateLimit(key: string): Promise<boolean> {
  const now = Date.now();
  const windowStart = new Date(now - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await supabaseAdmin
    .from('hukm_join_log')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .eq('success', false)
    .gte('created_at', windowStart) as any;
  return (count || 0) < RATE_LIMIT_JOIN;
}

// Eski join_log yozuvlarini tasodifiy tozalash (cron'siz)
async function maybeCleanupJoinLog(): Promise<void> {
  if (Math.random() < 0.05) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin.from('hukm_join_log').delete().lt('created_at', cutoff);
  }
}

function sanitizeNickname(nick: string): string {
  const trimmed = nick.trim().slice(0, 20);
  return trimmed.length >= 2 ? trimmed : 'O\'yinchi';
}

async function uniqueNickname(gameId: string, nickname: string): Promise<{ name: string; taken: boolean }> {
  const { data } = await supabaseAdmin
    .from('hukm_players')
    .select('nickname')
    .eq('game_id', gameId);
  const existing = new Set((data || []).map(p => p.nickname.toLowerCase()));
  if (!existing.has(nickname.toLowerCase())) return { name: nickname, taken: false };
  // Avtomatik raqam qo'shish
  let suffix = 2;
  while (existing.has(`${nickname}${suffix}`.toLowerCase())) suffix++;
  return { name: `${nickname}${suffix}`, taken: true };
}

function sanitizeQuestionForPlayer(q: any, index: number, showText: boolean) {
  return {
    index,
    type: q.type,
    text: showText ? q.text : '',
    case_text: showText ? q.case_text : '',
    options: (q.options || []).map((o: any) => ({ text: o.text })),
    time_limit_s: q.time_limit_s,
    hint: q.hint || '',
  };
}

function revealQuestionForPlayer(q: any, index: number) {
  const correctIdx = (q.options || []).findIndex((o: any) => o.is_correct);
  return {
    index,
    type: q.type,
    text: q.text,
    case_text: q.case_text,
    options: q.options,
    correct_index: correctIdx,
    explanation: q.explanation || '',
    legal_basis: q.legal_basis || '',
  };
}

async function getQuizQuestions(quizId: string) {
  const { data } = await supabaseAdmin
    .from('hukm_questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('position', { ascending: true });
  return data || [];
}

async function getGamePlayers(gameId: string) {
  const { data } = await supabaseAdmin
    .from('hukm_players')
    .select('id, nickname, talaba_id, kicked, joined_at')
    .eq('game_id', gameId)
    .eq('kicked', false)
    .order('joined_at', { ascending: true });
  return data || [];
}

async function getLeaderboard(gameId: string, limit = 0) {
  const { data } = await supabaseAdmin
    .from('hukm_answers')
    .select('player_id, points')
    .eq('game_id', gameId);
  const map = new Map<string, number>();
  for (const a of data || []) {
    map.set(a.player_id, (map.get(a.player_id) || 0) + a.points);
  }
  const players = await getGamePlayers(gameId);
  const board = players.map(p => ({
    player_id: p.id,
    nickname: p.nickname,
    talaba_id: p.talaba_id,
    total_points: map.get(p.id) || 0,
  })).sort((a, b) => b.total_points - a.total_points);
  return limit > 0 ? board.slice(0, limit) : board;
}

async function getConsecutiveCorrect(gameId: string, playerId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('hukm_answers')
    .select('question_index, correct')
    .eq('game_id', gameId)
    .eq('player_id', playerId)
    .order('question_index', { ascending: true });
  if (!data) return 0;
  let streak = 0;
  for (const a of data) {
    if (a.correct) streak++;
    else streak = 0;
  }
  return streak;
}

// Sessiya yaratish (o'yin tugaganda yoki report olinganda)
async function createSession(gameId: string): Promise<void> {
  const { data: game } = await supabaseAdmin
    .from('hukm_games')
    .select('quiz_id, pin, created_at, ended_at')
    .eq('id', gameId)
    .maybeSingle();
  if (!game) return;

  const { data: existing } = await supabaseAdmin
    .from('hukm_sessions')
    .select('id')
    .eq('game_id', gameId)
    .maybeSingle();
  if (existing) return;

  const players = await getGamePlayers(gameId);
  const { data: answers } = await supabaseAdmin
    .from('hukm_answers')
    .select('player_id, correct, points')
    .eq('game_id', gameId);

  const playerCount = players.length;
  const totalAnswers = (answers || []).length;
  const correctAnswers = (answers || []).filter(a => a.correct).length;
  const avgCorrectPct = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
  const avgPoints = playerCount > 0
    ? Math.round((answers || []).reduce((s, a) => s + a.points, 0) / playerCount)
    : 0;

  const questions = await getQuizQuestions(game.quiz_id);
  const totalQ = questions.length;
  const finisherCount = totalQ > 0
    ? players.filter(p => {
      const pAnswers = (answers || []).filter(a => a.player_id === p.id);
      return pAnswers.length >= totalQ;
    }).length
    : 0;
  const finishersPct = playerCount > 0 ? Math.round((finisherCount / playerCount) * 100) : 0;

  const { data: quiz } = await supabaseAdmin
    .from('hukm_quizzes')
    .select('owner')
    .eq('id', game.quiz_id)
    .maybeSingle();

  await supabaseAdmin.from('hukm_sessions').insert({
    quiz_id: game.quiz_id,
    game_id: gameId,
    ustoz_id: quiz?.owner || null,
    pin: game.pin,
    started_at: game.created_at,
    ended_at: game.ended_at || new Date().toISOString(),
    player_count: playerCount,
    avg_correct_pct: avgCorrectPct,
    avg_points: avgPoints,
    finishers_pct: finishersPct,
  });
}

// Matndan savol parser
function parseQuestionsFromText(raw: string): any[] {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const questions: any[] = [];
  let current: any = null;
  let currentOptions: any[] = [];

  for (const line of lines) {
    const qMatch = line.match(/^(\d+)[.)]\s*(.+)/);
    if (qMatch) {
      if (current && current.text) {
        questions.push(finalizeQuestion(current, currentOptions));
      }
      current = { text: qMatch[2], time_limit_s: 20, explanation: '', legal_basis: '', source: 'text' };
      currentOptions = [];
      continue;
    }

    const optMatch = line.match(/^([A-D])[.)]\s*(.+)/);
    if (optMatch && current) {
      const isCorrect = optMatch[2].startsWith('*') || optMatch[2].startsWith('✓');
      const text = isCorrect ? optMatch[2].slice(1).trim() : optMatch[2];
      currentOptions.push({ text, is_correct: isCorrect });
      continue;
    }

    const correctMatch = line.match(/^(?:To'g'ri(?:\s+javob)?\s*[:\s]\s*|✓\s*)([A-D])/i);
    if (correctMatch && currentOptions.length > 0) {
      const idx = correctMatch[1].toUpperCase().charCodeAt(0) - 65;
      currentOptions = currentOptions.map((o, i) => ({ ...o, is_correct: i === idx }));
      continue;
    }

    const explMatch = line.match(/^(?:Izoh|Tushuntirish)\s*[:\s]\s*(.+)/);
    if (explMatch && current) {
      current.explanation = explMatch[1];
      continue;
    }

    const basisMatch = line.match(/^(?:Asos|Modda)\s*[:\s]\s*(.+)/);
    if (basisMatch && current) {
      current.legal_basis = basisMatch[1];
      continue;
    }

    const timeMatch = line.match(/^(?:Vaqt|Taymer)\s*[:\s]\s*(\d+)/);
    if (timeMatch && current) {
      current.time_limit_s = parseInt(timeMatch[1]);
      continue;
    }

    if (current && currentOptions.length === 0 && !line.match(/^[A-D]/)) {
      current.text += ' ' + line;
    }
  }

  if (current && current.text) {
    questions.push(finalizeQuestion(current, currentOptions));
  }

  return questions;
}

function finalizeQuestion(q: any, options: any[]): any {
  return {
    type: 'variant4',
    text: q.text,
    case_text: '',
    options: options.length >= 2 ? options : [],
    time_limit_s: q.time_limit_s || 20,
    explanation: q.explanation || '',
    legal_basis: q.legal_basis || '',
    hint: '',
    source: q.source || 'text',
  };
}

// Stale o'yinlarni tugatirish (3 soatdan ortiq faol bo'lmagan)
async function cleanupStaleGames(ustozId?: string): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_GAME_MS).toISOString();
  let query = supabaseAdmin
    .from('hukm_games')
    .select('id')
    .neq('status', 'finished')
    .lt('created_at', cutoff);
  if (ustozId) {
    query = query.in('quiz_id',
      (await supabaseAdmin.from('hukm_quizzes').select('id').eq('owner', ustozId)).data?.map((q: any) => q.id) || []
    );
  }
  const { data: stale } = await query;
  if (stale && stale.length > 0) {
    for (const g of stale) {
      await supabaseAdmin
        .from('hukm_games')
        .update({ status: 'finished', ended_at: new Date().toISOString() })
        .eq('id', g.id);
    }
  }
}

// O'yin holatini to'liq olish (host yoki player uchun)
async function buildGameState(gameId: string, isHost: boolean, playerId?: string, playerToken?: string) {
  const { data: game } = await supabaseAdmin
    .from('hukm_games')
    .select('*')
    .eq('id', gameId)
    .maybeSingle();
  if (!game) return null;

  const players = await getGamePlayers(game.id);
  const questions = await getQuizQuestions(game.quiz_id);
  const serverNow = Date.now();

  const base: any = {
    id: game.id,
    pin: game.pin,
    status: game.status,
    current_index: game.current_index,
    settings: game.settings,
    players: players.map(p => ({ id: p.id, nickname: p.nickname, talaba_id: p.talaba_id })),
    total_questions: questions.length,
    is_host: isHost,
    server_now: serverNow,
  };

  if (game.status === 'question' && game.current_index >= 0) {
    const q = questions[game.current_index];
    if (q) {
      const showText = game.settings?.show_text_on_phone !== false;
      base.question = sanitizeQuestionForPlayer(q, game.current_index, showText);
      base.ends_at = game.opened_at ? new Date(game.opened_at).getTime() + (q.time_limit_s || 20) * 1000 : null;

      const { count } = await supabaseAdmin
        .from('hukm_answers')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .eq('question_index', game.current_index) as any;
      base.answered_count = count || 0;

      if (playerId && playerToken) {
        const { valid } = await verifyPlayerToken(playerId, playerToken);
        if (valid) {
          const { data: myAnswer } = await supabaseAdmin
            .from('hukm_answers')
            .select('choice')
            .eq('game_id', game.id)
            .eq('player_id', playerId)
            .eq('question_index', game.current_index)
            .maybeSingle();
          base.my_answer = myAnswer?.choice ?? null;
        }
      }

      if (isHost) {
        base.correct_index = (q.options || []).findIndex((o: any) => o.is_correct);
      }
    }
  }

  if (game.status === 'reveal' && game.current_index >= 0) {
    const q = questions[game.current_index];
    if (q) {
      base.reveal = revealQuestionForPlayer(q, game.current_index);
      const { data: answers } = await supabaseAdmin
        .from('hukm_answers')
        .select('choice')
        .eq('game_id', game.id)
        .eq('question_index', game.current_index);
      const distribution = (q.options || []).map((_: any, i: number) =>
        (answers || []).filter(a => a.choice === i).length
      );
      base.distribution = distribution;

      if (playerId && playerToken) {
        const { valid } = await verifyPlayerToken(playerId, playerToken);
        if (valid) {
          const { data: myAnswer } = await supabaseAdmin
            .from('hukm_answers')
            .select('choice, correct, points')
            .eq('game_id', game.id)
            .eq('player_id', playerId)
            .eq('question_index', game.current_index)
            .maybeSingle();
          base.my_result = myAnswer || null;
        }
      }
    }
    base.leaderboard = await getLeaderboard(game.id, 5);
  }

  if (game.status === 'leaderboard' || game.status === 'finished') {
    base.leaderboard = await getLeaderboard(game.id, game.status === 'finished' ? 0 : 5);
  }

  if (game.status === 'finished') {
    await createSession(game.id);
  }

  return base;
}

// ─── ASOSIY HANDLER ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/hukm-api/, '').replace(/^\/+/, '');
    const segments = path.split('/').filter(Boolean);
    const method = req.method;

    // Eski log tozalash (tasodifiy)
    maybeCleanupJoinLog();

    // Health/version check
    if (method === 'GET' && segments[0] === 'ping') {
      return jsonResponse({ ok: true, version: FN_VERSION, server_now: Date.now() });
    }

    // ── QUIZ CRUD (ustoz, vakolat bilan) ───────────────────────────────────

    if (method === 'POST' && segments[0] === 'quiz' && !segments[1]) {
      const body = await req.json();
      if (!body.ustoz_id) return errorResponse('Vakolat yo\'q', 401);
      if (!await verifyUstoz(body.ustoz_id)) return errorResponse('Vakolat yo\'q', 403);
      if (!body.title) return errorResponse('Sarlavha kerak', 400);
      const { data, error } = await supabaseAdmin
        .from('hukm_quizzes')
        .insert({ owner: body.ustoz_id, title: body.title, description: body.description || '' })
        .select()
        .single();
      if (error) return errorResponse('Viktorina yaratilmadi', 500);
      return jsonResponse({ quiz: data });
    }

    if (method === 'GET' && segments[0] === 'quiz' && !segments[1]) {
      const ustozId = url.searchParams.get('ustoz_id') || '';
      if (!ustozId) return errorResponse('Vakolat yo\'q', 401);
      if (!await verifyUstoz(ustozId)) return errorResponse('Vakolat yo\'q', 403);
      const { data } = await supabaseAdmin
        .from('hukm_quizzes')
        .select('*')
        .eq('owner', ustozId)
        .order('created_at', { ascending: false });
      return jsonResponse({ quizzes: data || [] });
    }

    if (method === 'GET' && segments[0] === 'quiz' && segments[1]) {
      const ustozId = url.searchParams.get('ustoz_id') || '';
      if (!ustozId) return errorResponse('Vakolat yo\'q', 401);
      if (!await verifyUstoz(ustozId)) return errorResponse('Vakolat yo\'q', 403);
      const { data } = await supabaseAdmin
        .from('hukm_quizzes')
        .select('*')
        .eq('id', segments[1])
        .maybeSingle();
      if (!data) return errorResponse('Viktorina topilmadi', 404);
      if (data.owner !== ustozId) return errorResponse('Vakolat yo\'q', 403);
      const questions = await getQuizQuestions(segments[1]);
      return jsonResponse({ quiz: data, questions });
    }

    if (method === 'PUT' && segments[0] === 'quiz' && segments[1]) {
      const body = await req.json();
      if (!body.ustoz_id) return errorResponse('Vakolat yo\'q', 401);
      if (!await verifyUstoz(body.ustoz_id)) return errorResponse('Vakolat yo\'q', 403);
      if (!await verifyQuizOwner(segments[1], body.ustoz_id)) return errorResponse('Vakolat yo\'q', 403);
      const { data, error } = await supabaseAdmin
        .from('hukm_quizzes')
        .update({ title: body.title, description: body.description || '', updated_at: new Date().toISOString() })
        .eq('id', segments[1])
        .select()
        .single();
      if (error) return errorResponse('Yangilanmadi', 500);
      return jsonResponse({ quiz: data });
    }

    if (method === 'DELETE' && segments[0] === 'quiz' && segments[1]) {
      const ustozId = url.searchParams.get('ustoz_id') || '';
      if (!ustozId) return errorResponse('Vakolat yo\'q', 401);
      if (!await verifyUstoz(ustozId)) return errorResponse('Vakolat yo\'q', 403);
      if (!await verifyQuizOwner(segments[1], ustozId)) return errorResponse('Vakolat yo\'q', 403);
      const { error } = await supabaseAdmin
        .from('hukm_quizzes')
        .delete()
        .eq('id', segments[1]);
      if (error) return errorResponse('O\'chirilmadi', 500);
      return jsonResponse({ success: true });
    }

    if (method === 'POST' && segments[0] === 'quiz' && segments[1] && segments[2] === 'questions') {
      const body = await req.json();
      if (!body.ustoz_id) return errorResponse('Vakolat yo\'q', 401);
      if (!await verifyUstoz(body.ustoz_id)) return errorResponse('Vakolat yo\'q', 403);
      if (!await verifyQuizOwner(segments[1], body.ustoz_id)) return errorResponse('Vakolat yo\'q', 403);
      const questions = body.questions || [];
      if (!Array.isArray(questions)) return errorResponse('questions massiv kerak', 400);

      await supabaseAdmin.from('hukm_questions').delete().eq('quiz_id', segments[1]);

      if (questions.length > 0) {
        const rows = questions.map((q: any, i: number) => ({
          quiz_id: segments[1],
          position: i,
          type: q.type || 'variant4',
          text: q.text || '',
          case_text: q.case_text || '',
          options: q.options || [],
          time_limit_s: q.time_limit_s || 20,
          explanation: q.explanation || '',
          legal_basis: q.legal_basis || '',
          hint: q.hint || '',
          basis_check: q.basis_check || null,
          source: q.source || 'manual',
        }));
        const { error } = await supabaseAdmin.from('hukm_questions').insert(rows);
        if (error) return errorResponse('Savollar saqlanmadi', 500);
      }
      return jsonResponse({ success: true, count: questions.length });
    }

    if (method === 'POST' && segments[0] === 'quiz' && segments[1] && segments[2] === 'parse-text') {
      const body = await req.json();
      if (!body.ustoz_id) return errorResponse('Vakolat yo\'q', 401);
      if (!await verifyUstoz(body.ustoz_id)) return errorResponse('Vakolat yo\'q', 403);
      if (!await verifyQuizOwner(segments[1], body.ustoz_id)) return errorResponse('Vakolat yo\'q', 403);
      if (!body.text) return errorResponse('Matn kerak', 400);
      const parsed = parseQuestionsFromText(body.text);
      return jsonResponse({ questions: parsed });
    }

    // ── AI SAVOL TIZISH ─────────────────────────────────────────────────────

    if (method === 'POST' && segments[0] === 'quiz-ai') {
      const body = await req.json();
      if (!body.ustoz_id) return errorResponse('Vakolat yo\'q', 401);
      if (!await verifyUstoz(body.ustoz_id)) return errorResponse('Vakolat yo\'q', 403);

      const sources = body.sources || [];
      if (!Array.isArray(sources) || sources.length === 0) {
        return errorResponse('Manba kerak', 400);
      }

      const settings = {
        count: Math.min(Math.max(body.settings?.count || 10, 1), 40),
        difficulty: body.settings?.difficulty || 'o\'rta',
        sections: body.settings?.sections || [],
        instruction: body.settings?.instruction || '',
      };

      const { data: job, error } = await supabaseAdmin
        .from('hukm_quiz_jobs')
        .insert({
          ustoz_id: body.ustoz_id,
          quiz_id: body.quiz_id || null,
          status: 'queued',
          sources: sources,
          settings,
        })
        .select()
        .single();
      if (error) return errorResponse('Job yaratilmadi', 500);

      EdgeRuntime.waitUntil(processAIJob(job.id, body.ustoz_id));

      return jsonResponse({ job_id: job.id, status: 'queued' });
    }

    if (method === 'GET' && segments[0] === 'quiz-ai' && segments[1]) {
      const ustozId = url.searchParams.get('ustoz_id') || '';
      if (!ustozId) return errorResponse('Vakolat yo\'q', 401);
      const { data: job } = await supabaseAdmin
        .from('hukm_quiz_jobs')
        .select('*')
        .eq('id', segments[1])
        .eq('ustoz_id', ustozId)
        .maybeSingle();
      if (!job) return errorResponse('Job topilmadi', 404);
      return jsonResponse({ job });
    }

    // ── SESSIYALAR (o'tkazilgan o'yinlar) ───────────────────────────────────

    if (method === 'GET' && segments[0] === 'sessions' && !segments[1]) {
      const ustozId = url.searchParams.get('ustoz_id') || '';
      if (!ustozId) return errorResponse('Vakolat yo\'q', 401);
      if (!await verifyUstoz(ustozId)) return errorResponse('Vakolat yo\'q', 403);
      const { data } = await supabaseAdmin
        .from('hukm_sessions')
        .select('*, hukm_quizzes!inner(title)')
        .eq('ustoz_id', ustozId)
        .order('started_at', { ascending: false });
      return jsonResponse({ sessions: data || [] });
    }

    if (method === 'GET' && segments[0] === 'sessions' && segments[1]) {
      const ustozId = url.searchParams.get('ustoz_id') || '';
      if (!ustozId) return errorResponse('Vakolat yo\'q', 401);
      const { data: session } = await supabaseAdmin
        .from('hukm_sessions')
        .select('*')
        .eq('id', segments[1])
        .maybeSingle();
      if (!session) return errorResponse('Sessiya topilmadi', 404);
      if (session.ustoz_id !== ustozId) return errorResponse('Vakolat yo\'q', 403);

      if (session.game_id) {
        const report = await getFullReport(session.game_id);
        return jsonResponse({ session, ...report });
      }
      return jsonResponse({ session });
    }

    // ── O'QUVCHI REYTING ─────────────────────────────────────────────────────

    if (method === 'GET' && segments[0] === 'reyting') {
      const talabaId = url.searchParams.get('talaba_id') || '';
      if (!talabaId) return errorResponse('talaba_id kerak', 400);

      const { data: players } = await supabaseAdmin
        .from('hukm_players')
        .select('id, game_id, nickname')
        .eq('talaba_id', talabaId);

      const playerIds = (players || []).map(p => p.id);
      if (playerIds.length === 0) return jsonResponse({ games: [], my_rank: 0, total_players: 0 });

      const gameResults: any[] = [];
      for (const p of players!) {
        const { data: answers } = await supabaseAdmin
          .from('hukm_answers')
          .select('correct, points')
          .eq('player_id', p.id);
        const totalPoints = (answers || []).reduce((s, a) => s + a.points, 0);
        const correctCount = (answers || []).filter(a => a.correct).length;
        const totalCount = (answers || []).length;
        gameResults.push({
          player_id: p.id,
          game_id: p.game_id,
          total_points: totalPoints,
          correct_count: correctCount,
          total_answers: totalCount,
          correct_pct: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
        });
      }

      const { data: allPlayers } = await supabaseAdmin
        .from('hukm_players')
        .select('id, talaba_id')
        .not('talaba_id', 'is', null);

      const talabaScores = new Map<string, number>();
      const talabaPlayerMap = new Map<string, string[]>();
      for (const ap of allPlayers || []) {
        if (!ap.talaba_id) continue;
        if (!talabaPlayerMap.has(ap.talaba_id)) talabaPlayerMap.set(ap.talaba_id, []);
        talabaPlayerMap.get(ap.talaba_id)!.push(ap.id);
      }

      for (const [tid, pids] of talabaPlayerMap) {
        const { data: ans } = await supabaseAdmin
          .from('hukm_answers')
          .select('points')
          .in('player_id', pids);
        talabaScores.set(tid, (ans || []).reduce((s, a) => s + a.points, 0));
      }

      const sortedScores = Array.from(talabaScores.entries())
        .sort((a, b) => b[1] - a[1]);
      const myRank = sortedScores.findIndex(([tid]) => tid === talabaId) + 1;

      return jsonResponse({
        games: gameResults.sort((a, b) => b.total_points - a.total_points),
        my_rank: myRank,
        total_players: sortedScores.length,
        my_total_points: talabaScores.get(talabaId) || 0,
      });
    }

    if (method === 'GET' && segments[0] === 'reyting-board') {
      const { data: allPlayers } = await supabaseAdmin
        .from('hukm_players')
        .select('id, talaba_id, nickname')
        .not('talaba_id', 'is', null);

      const talabaMap = new Map<string, { nickname: string; player_ids: string[] }>();
      for (const ap of allPlayers || []) {
        if (!ap.talaba_id) continue;
        if (!talabaMap.has(ap.talaba_id)) {
          talabaMap.set(ap.talaba_id, { nickname: ap.nickname, player_ids: [] });
        }
        talabaMap.get(ap.talaba_id)!.player_ids.push(ap.id);
      }

      const board: any[] = [];
      for (const [tid, info] of talabaMap) {
        const { data: ans } = await supabaseAdmin
          .from('hukm_answers')
          .select('points, correct')
          .in('player_id', info.player_ids);
        const totalPoints = (ans || []).reduce((s, a) => s + a.points, 0);
        const correctCount = (ans || []).filter(a => a.correct).length;
        const totalCount = (ans || []).length;
        board.push({
          talaba_id: tid,
          nickname: info.nickname,
          total_points: totalPoints,
          games_played: info.player_ids.length,
          correct_pct: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
        });
      }
      board.sort((a, b) => b.total_points - a.total_points);

      const talabaId = url.searchParams.get('talaba_id') || '';
      const myRank = talabaId ? board.findIndex(b => b.talaba_id === talabaId) + 1 : 0;

      const talabaIds = board.slice(0, 50).map(b => b.talaba_id);
      const { data: talabalar } = await supabaseAdmin
        .from('talabalar')
        .select('id, ism, familiya, avatar_url')
        .in('id', talabaIds);
      const talabaInfo = new Map((talabalar || []).map(t => [t.id, t]));

      const top50 = board.slice(0, 50).map((b, i) => ({
        rank: i + 1,
        ...b,
        ism: talabaInfo.get(b.talaba_id)?.ism || '',
        familiya: talabaInfo.get(b.talaba_id)?.familiya || '',
        avatar_url: talabaInfo.get(b.talaba_id)?.avatar_url || '',
      }));

      return jsonResponse({ board: top50, my_rank: myRank, total: board.length });
    }

    // ── GAME LIFECYCLE ─────────────────────────────────────────────────────

    // POST /hukm-api/game — o'yin yaratish
    if (method === 'POST' && segments[0] === 'game' && !segments[1]) {
      const body = await req.json();
      if (!body.ustoz_id) return errorResponse('Vakolat yo\'q', 401);
      if (!await verifyUstoz(body.ustoz_id)) return errorResponse('Vakolat yo\'q', 403);
      if (!body.quiz_id) return errorResponse('quiz_id kerak', 400);
      if (!await verifyQuizOwner(body.quiz_id, body.ustoz_id)) return errorResponse('Vakolat yo\'q', 403);

      // Eski tugamagan o'yinni tugatirish (stale cleanup)
      await cleanupStaleGames(body.ustoz_id);

      const settings = {
        speed_bonus: body.speed_bonus !== false,
        lobby_locked: false,
        show_text_on_phone: body.show_text_on_phone !== false,
      };
      const hostToken = randomToken(32);
      const hostTokenHash = await sha256Hex(hostToken);

      let pin = randomPin();
      for (let i = 0; i < 10; i++) {
        const { data: existing } = await supabaseAdmin
          .from('hukm_games')
          .select('id')
          .eq('pin', pin)
          .neq('status', 'finished')
          .maybeSingle();
        if (!existing) break;
        pin = randomPin();
      }

      const { data, error } = await supabaseAdmin
        .from('hukm_games')
        .insert({
          quiz_id: body.quiz_id,
          pin,
          status: 'lobby',
          host_token_hash: hostTokenHash,
          settings,
        })
        .select()
        .single();
      if (error) return errorResponse('O\'yin yaratilmadi', 500);

      return jsonResponse({ game: { id: data.id, pin: data.pin, status: data.status, settings }, host_token: hostToken });
    }

    // POST /hukm-api/game/join — o'yinchi qo'shilish (mehmon yoki tizimga kirgan)
    if (method === 'POST' && segments[0] === 'game' && segments[1] === 'join') {
      const body = await req.json();
      const pin = body.pin?.toString().trim();
      const nickname = sanitizeNickname(body.nickname || '');
      if (!pin || pin.length !== 6) return errorResponse('Noto\'g\'ri PIN', 400);

      // talaba_id ixtiyoriy — mehmon uchun null
      const talabaId = body.talaba_id || null;

      // Rate limit — faqat muvaffaqiyatsiz urinishlar sanaladi
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const rateKey = `${clientIp}:${pin}`;
      const allowed = await checkRateLimit(rateKey);
      if (!allowed) return errorResponse('Juda ko\'p urinish. Birozdan keyin urinib ko\'ring.', 429);

      const { data: game } = await supabaseAdmin
        .from('hukm_games')
        .select('id, status, settings')
        .eq('pin', pin)
        .neq('status', 'finished')
        .maybeSingle();
      if (!game) {
        // Muvaffaqiyatsiz urinishni logga yozish
        await supabaseAdmin.from('hukm_join_log').insert({ key: rateKey, success: false });
        return errorResponse('O\'yin topilmadi', 404);
      }
      if (game.status !== 'lobby') {
        await supabaseAdmin.from('hukm_join_log').insert({ key: rateKey, success: false });
        return errorResponse('O\'yin allaqachon boshlangan', 403);
      }
      if (game.settings?.lobby_locked) {
        await supabaseAdmin.from('hukm_join_log').insert({ key: rateKey, success: false });
        return errorResponse('Lobby qulflangan', 403);
      }

      // MAX_PLAYERS tekshiruvi
      const players = await getGamePlayers(game.id);
      if (players.length >= MAX_PLAYERS) {
        await supabaseAdmin.from('hukm_join_log').insert({ key: rateKey, success: false });
        return errorResponse('O\'yin to\'ldi', 403);
      }

      // Talaba_id bor bo'lsa — bitta talaba bitta o'yinga bir marta
      if (talabaId) {
        const { data: existingPlayer } = await supabaseAdmin
          .from('hukm_players')
          .select('id, kicked, player_token_hash')
          .eq('game_id', game.id)
          .eq('talaba_id', talabaId)
          .maybeSingle();

        if (existingPlayer) {
          if (existingPlayer.kicked) {
            await supabaseAdmin.from('hukm_join_log').insert({ key: rateKey, success: false });
            return errorResponse('Siz bu o\'yindan chiqarilgansiz', 403);
          }
          // Ikkinchi qurilmadan kirish — eski player'ni yangilash
          const newToken = randomToken(32);
          const newHash = await sha256Hex(newToken);
          await supabaseAdmin
            .from('hukm_players')
            .update({ player_token_hash: newHash, nickname })
            .eq('id', existingPlayer.id);
          // Muvaffaqiyatli — log yozilmaydi
          return jsonResponse({
            player: { id: existingPlayer.id, nickname },
            player_token: newToken,
            game_id: game.id,
          });
        }
      }

      // Taxallus noyobligi — katta-kichik harfga e'tiborsiz
      const { name: finalNick, taken } = await uniqueNickname(game.id, nickname);
      if (taken) {
        // Band taxallus — rate limit hisobiga kirmaydi (logga yozilmaydi)
        return errorResponse('Bu taxallus band. Boshqasini tanlang.', 409);
      }

      const playerToken = randomToken(32);
      const playerTokenHash = await sha256Hex(playerToken);

      const { data: player, error } = await supabaseAdmin
        .from('hukm_players')
        .insert({
          game_id: game.id,
          nickname: finalNick,
          player_token_hash: playerTokenHash,
          talaba_id: talabaId,
        })
        .select('id, nickname')
        .single();
      if (error) {
        await supabaseAdmin.from('hukm_join_log').insert({ key: rateKey, success: false });
        return errorResponse('Qo\'shilmadi', 500);
      }

      // Muvaffaqiyatli — logga yozilmaydi (faqat muvaffaqiyatsiz sanaladi)
      return jsonResponse({ player, player_token: playerToken, game_id: game.id });
    }

    // POST /hukm-api/game/rejoin — o'yinchini qayta ulash
    if (method === 'POST' && segments[0] === 'game' && segments[1] === 'rejoin') {
      const body = await req.json();
      const { player_id, player_token, game_id } = body;
      if (!player_id || !player_token || !game_id) {
        return errorResponse('player_id, player_token va game_id kerak', 400);
      }

      const { valid, kicked } = await verifyPlayerToken(player_id, player_token);
      if (!valid) return errorResponse('Sessiya yaroqsiz', 401);
      if (kicked) return errorResponse('Siz o\'yindan chiqarilgansiz', 403);

      const { data: game } = await supabaseAdmin
        .from('hukm_games')
        .select('id, status')
        .eq('id', game_id)
        .maybeSingle();
      if (!game) return errorResponse('O\'yin topilmadi', 404);

      if (game.status === 'finished') {
        // Tugagan o'yin — to'liq natija qaytaradi (leaderboard bilan)
        const state = await buildGameState(game_id, false, player_id, player_token);
        if (!state) return errorResponse('O\'yin holati olinmadi', 500);
        return jsonResponse({ ...state, finished: true });
      }

      const state = await buildGameState(game_id, false, player_id, player_token);
      if (!state) return errorResponse('O\'yin holati olinmadi', 500);

      return jsonResponse(state);
    }

    // POST /hukm-api/host-resume — ustozning tugamagan o'yinini davom ettirish
    if (method === 'POST' && segments[0] === 'host-resume') {
      const body = await req.json();
      if (!body.ustoz_id) return errorResponse('Vakolat yo\'q', 401);
      if (!await verifyUstoz(body.ustoz_id)) return errorResponse('Vakolat yo\'q', 403);

      // Stale cleanup
      await cleanupStaleGames(body.ustoz_id);

      // Shu ustozning tugamagan o'yinini topish
      const { data: quizzes } = await supabaseAdmin
        .from('hukm_quizzes')
        .select('id, title')
        .eq('owner', body.ustoz_id);
      if (!quizzes || quizzes.length === 0) return jsonResponse({ game: null });

      const quizIds = quizzes.map(q => q.id);
      const { data: activeGame } = await supabaseAdmin
        .from('hukm_games')
        .select('id, quiz_id, pin, status, current_index, settings, created_at')
        .in('quiz_id', quizIds)
        .neq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeGame) return jsonResponse({ game: null });

      // Yangi host token
      const newHostToken = randomToken(32);
      const newHostTokenHash = await sha256Hex(newHostToken);
      await supabaseAdmin
        .from('hukm_games')
        .update({ host_token_hash: newHostTokenHash })
        .eq('id', activeGame.id);

      const quizTitle = quizzes.find(q => q.id === activeGame.quiz_id)?.title || '';
      return jsonResponse({
        game: {
          id: activeGame.id,
          pin: activeGame.pin,
          status: activeGame.status,
          current_index: activeGame.current_index,
          settings: activeGame.settings,
          quiz_title: quizTitle,
        },
        host_token: newHostToken,
      });
    }

    // GET /hukm-api/game/:id — o'yin holati
    if (method === 'GET' && segments[0] === 'game' && segments[1] && !segments[2]) {
      const hostToken = url.searchParams.get('host_token') || '';
      const playerToken = url.searchParams.get('player_token') || '';
      const playerId = url.searchParams.get('player_id') || '';

      const isHost = hostToken ? await verifyHostToken(segments[1], hostToken) : false;
      const state = await buildGameState(segments[1], isHost, playerId || undefined, playerToken || undefined);
      if (!state) return errorResponse('O\'yin topilmadi', 404);
      return jsonResponse(state);
    }

    // ── HOST ACTIONS ───────────────────────────────────────────────────────

    if (method === 'POST' && segments[0] === 'game' && segments[1] && segments[2] === 'start') {
      const body = await req.json();
      if (!await verifyHostToken(segments[1], body.host_token)) return errorResponse('Vakolat yo\'q', 403);
      const { data: game } = await supabaseAdmin
        .from('hukm_games')
        .select('quiz_id')
        .eq('id', segments[1])
        .maybeSingle();
      if (!game) return errorResponse('O\'yin topilmadi', 404);
      const questions = await getQuizQuestions(game.quiz_id);
      if (questions.length === 0) return errorResponse('Savollar yo\'q', 400);
      const openedAt = nowIso();
      await supabaseAdmin
        .from('hukm_games')
        .update({ status: 'question', current_index: 0, opened_at: openedAt })
        .eq('id', segments[1]);
      await broadcastSignal(segments[1], 'question', 0);
      return jsonResponse({ success: true });
    }

    if (method === 'POST' && segments[0] === 'game' && segments[1] && segments[2] === 'next') {
      const body = await req.json();
      if (!await verifyHostToken(segments[1], body.host_token)) return errorResponse('Vakolat yo\'q', 403);
      const { data: game } = await supabaseAdmin
        .from('hukm_games')
        .select('quiz_id, current_index')
        .eq('id', segments[1])
        .maybeSingle();
      if (!game) return errorResponse('O\'yin topilmadi', 404);
      const questions = await getQuizQuestions(game.quiz_id);
      const nextIndex = game.current_index + 1;
      if (nextIndex >= questions.length) {
        await supabaseAdmin
          .from('hukm_games')
          .update({ status: 'finished', ended_at: nowIso() })
          .eq('id', segments[1]);
        await createSession(segments[1]);
        await broadcastSignal(segments[1], 'finished', -1);
        return jsonResponse({ success: true, finished: true });
      }
      const openedAt = nowIso();
      await supabaseAdmin
        .from('hukm_games')
        .update({ status: 'question', current_index: nextIndex, opened_at: openedAt })
        .eq('id', segments[1]);
      await broadcastSignal(segments[1], 'question', nextIndex);
      return jsonResponse({ success: true, current_index: nextIndex });
    }

    if (method === 'POST' && segments[0] === 'game' && segments[1] && segments[2] === 'reveal') {
      const body = await req.json();
      if (!await verifyHostToken(segments[1], body.host_token)) return errorResponse('Vakolat yo\'q', 403);
      await supabaseAdmin
        .from('hukm_games')
        .update({ status: 'reveal' })
        .eq('id', segments[1]);
      const { data: game } = await supabaseAdmin
        .from('hukm_games')
        .select('current_index')
        .eq('id', segments[1])
        .maybeSingle();
      await broadcastSignal(segments[1], 'reveal', game?.current_index ?? -1);
      return jsonResponse({ success: true });
    }

    if (method === 'POST' && segments[0] === 'game' && segments[1] && segments[2] === 'leaderboard') {
      const body = await req.json();
      if (!await verifyHostToken(segments[1], body.host_token)) return errorResponse('Vakolat yo\'q', 403);
      await supabaseAdmin
        .from('hukm_games')
        .update({ status: 'leaderboard' })
        .eq('id', segments[1]);
      await broadcastSignal(segments[1], 'leaderboard', -1);
      return jsonResponse({ success: true });
    }

    if (method === 'POST' && segments[0] === 'game' && segments[1] && segments[2] === 'finish') {
      const body = await req.json();
      if (!await verifyHostToken(segments[1], body.host_token)) return errorResponse('Vakolat yo\'q', 403);
      await supabaseAdmin
        .from('hukm_games')
        .update({ status: 'finished', ended_at: nowIso() })
        .eq('id', segments[1]);
      await createSession(segments[1]);
      await broadcastSignal(segments[1], 'finished', -1);
      return jsonResponse({ success: true });
    }

    if (method === 'POST' && segments[0] === 'game' && segments[1] && segments[2] === 'lock') {
      const body = await req.json();
      if (!await verifyHostToken(segments[1], body.host_token)) return errorResponse('Vakolat yo\'q', 403);
      const { data: game } = await supabaseAdmin
        .from('hukm_games')
        .select('settings')
        .eq('id', segments[1])
        .maybeSingle();
      const settings = { ...game?.settings, lobby_locked: body.locked !== false };
      await supabaseAdmin
        .from('hukm_games')
        .update({ settings })
        .eq('id', segments[1]);
      // Lobby lock — signal yubormaymiz (o'yinchilar polling bilan ko'radi)
      return jsonResponse({ success: true, lobby_locked: settings.lobby_locked });
    }

    if (method === 'POST' && segments[0] === 'game' && segments[1] && segments[2] === 'kick') {
      const body = await req.json();
      if (!await verifyHostToken(segments[1], body.host_token)) return errorResponse('Vakolat yo\'q', 403);
      if (!body.player_id) return errorResponse('player_id kerak', 400);
      await supabaseAdmin
        .from('hukm_players')
        .update({ kicked: true })
        .eq('id', body.player_id)
        .eq('game_id', segments[1]);
      return jsonResponse({ success: true });
    }

    // ── PLAYER ANSWER ──────────────────────────────────────────────────────

    if (method === 'POST' && segments[0] === 'game' && segments[1] && segments[2] === 'answer') {
      const body = await req.json();
      const { player_id, player_token, choice } = body;
      if (!player_id || !player_token) return errorResponse('player_id va player_token kerak', 400);

      const { valid, kicked } = await verifyPlayerToken(player_id, player_token);
      if (!valid) return errorResponse('Vakolat yo\'q', 403);
      if (kicked) return errorResponse('Siz o\'yindan chiqarilgansiz', 403);

      const { data: game } = await supabaseAdmin
        .from('hukm_games')
        .select('id, quiz_id, status, current_index, opened_at, settings')
        .eq('id', segments[1])
        .maybeSingle();
      if (!game) return errorResponse('O\'yin topilmadi', 404);
      if (game.status !== 'question') return errorResponse('Savol yopilgan', 403);
      if (game.current_index < 0) return errorResponse('Savol yo\'q', 400);

      const questions = await getQuizQuestions(game.quiz_id);
      const q = questions[game.current_index];
      if (!q) return errorResponse('Savol topilmadi', 404);

      const limitMs = (q.time_limit_s || 20) * 1000;
      const elapsed = Date.now() - new Date(game.opened_at).getTime();
      if (elapsed > limitMs + 1000) {
        return errorResponse('Vaqt tugagan', 408);
      }

      const correctIdx = (q.options || []).findIndex((o: any) => o.is_correct);
      const isCorrect = choice === correctIdx;
      const consecutive = await getConsecutiveCorrect(game.id, player_id);
      const newConsecutive = isCorrect ? consecutive + 1 : 0;
      const points = calculatePoints(
        isCorrect,
        elapsed,
        limitMs,
        newConsecutive,
        game.settings?.speed_bonus !== false
      );

      const { error } = await supabaseAdmin
        .from('hukm_answers')
        .insert({
          game_id: game.id,
          player_id,
          question_index: game.current_index,
          choice: choice ?? null,
          received_at: nowIso(),
          correct: isCorrect,
          points,
        });
      if (error) {
        if (error.code === '23505') return errorResponse('Allaqachon javob bergansiz', 409);
        return errorResponse('Javob saqlanmadi', 500);
      }

      // Javobda signal yuborilmaydi — host polling bilan ko'radi
      return jsonResponse({ received: true });
    }

    // ── PLAYER: o'z xatolari ────────────────────────────────────────────────

    if (method === 'GET' && segments[0] === 'game' && segments[1] && segments[2] === 'mistakes') {
      const playerId = url.searchParams.get('player_id') || '';
      const playerToken = url.searchParams.get('player_token') || '';
      if (!playerId || !playerToken) return errorResponse('player_id va player_token kerak', 400);
      const { valid } = await verifyPlayerToken(playerId, playerToken);
      if (!valid) return errorResponse('Vakolat yo\'q', 403);

      const { data: game } = await supabaseAdmin
        .from('hukm_games')
        .select('quiz_id')
        .eq('id', segments[1])
        .maybeSingle();
      if (!game) return errorResponse('O\'yin topilmadi', 404);

      const questions = await getQuizQuestions(game.quiz_id);
      const { data: answers } = await supabaseAdmin
        .from('hukm_answers')
        .select('question_index, choice, correct')
        .eq('game_id', segments[1])
        .eq('player_id', playerId);
      const mistakes = (answers || [])
        .filter(a => !a.correct)
        .map(a => {
          const q = questions[a.question_index];
          if (!q) return null;
          return {
            question_index: a.question_index,
            text: q.text,
            my_choice: a.choice,
            correct_index: (q.options || []).findIndex((o: any) => o.is_correct),
            options: q.options,
            explanation: q.explanation || '',
            legal_basis: q.legal_basis || '',
          };
        })
        .filter(Boolean);
      return jsonResponse({ mistakes });
    }

    // ── HOST: hisobot ──────────────────────────────────────────────────────

    if (method === 'GET' && segments[0] === 'game' && segments[1] && segments[2] === 'report') {
      const hostToken = url.searchParams.get('host_token') || '';
      if (!await verifyHostToken(segments[1], hostToken)) return errorResponse('Vakolat yo\'q', 403);
      const report = await getFullReport(segments[1]);
      return jsonResponse(report);
    }

    return errorResponse('Noto\'g\'ri yo\'l', 404);
  } catch (err) {
    console.error('[hukm-api] xato:', err);
    return errorResponse('Server xatosi', 500);
  }
});

// ─── TO'LIQ HISOBOT ──────────────────────────────────────────────────────────

async function getFullReport(gameId: string) {
  const { data: game } = await supabaseAdmin
    .from('hukm_games')
    .select('quiz_id')
    .eq('id', gameId)
    .maybeSingle();
  if (!game) return { per_question: [], players: [] };

  const questions = await getQuizQuestions(game.quiz_id);
  const players = await getGamePlayers(gameId);
  const { data: answers } = await supabaseAdmin
    .from('hukm_answers')
    .select('player_id, question_index, choice, correct, points, received_at')
    .eq('game_id', gameId);

  const perQuestion = questions.map((q, i) => {
    const qAnswers = (answers || []).filter(a => a.question_index === i);
    const total = qAnswers.length;
    const correctCount = qAnswers.filter(a => a.correct).length;
    const correctPct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const optionCounts = (q.options || []).map((_: any, oi: number) =>
      qAnswers.filter(a => a.choice === oi).length
    );
    const noAnswer = players.length - total;
    const wrongAnswers = qAnswers.filter(a => !a.correct);
    const mostCommonWrong = wrongAnswers.length > 0
      ? wrongAnswers.reduce((acc, a) => { acc[a.choice] = (acc[a.choice] || 0) + 1; return acc; }, {} as Record<number, number>)
      : {};
    const mostCommonWrongIdx = Object.entries(mostCommonWrong).sort((a, b) => b[1] - a[1])[0]?.[0];
    const mostCommonWrongPct = wrongAnswers.length > 0 && total > 0
      ? Math.round((parseInt(Object.entries(mostCommonWrong).sort((a, b) => b[1] - a[1])[0][1]) / total) * 100)
      : 0;
    return {
      question_index: i,
      text: q.text,
      total_answers: total,
      correct_pct: correctPct,
      wrong_pct: total > 0 ? 100 - correctPct : 0,
      difficult: correctPct < 50,
      option_counts: optionCounts,
      no_answer_count: noAnswer,
      most_common_wrong: mostCommonWrongIdx ? parseInt(mostCommonWrongIdx) : null,
      most_common_wrong_pct: mostCommonWrongPct,
      explanation: q.explanation || '',
      legal_basis: q.legal_basis || '',
      correct_index: (q.options || []).findIndex((o: any) => o.is_correct),
      options: q.options,
    };
  });

  const playerResults = players.map(p => {
    const pAnswers = (answers || []).filter(a => a.player_id === p.id);
    const totalPoints = pAnswers.reduce((s, a) => s + a.points, 0);
    const correctCount = pAnswers.filter(a => a.correct).length;
    const totalCount = pAnswers.length;
    const avgTime = totalCount > 0
      ? Math.round(pAnswers.reduce((s, a) => {
          const q = questions[a.question_index];
          return s + (q ? (q.time_limit_s || 20) : 0);
        }, 0) / totalCount)
      : 0;
    return {
      player_id: p.id,
      nickname: p.nickname,
      talaba_id: p.talaba_id,
      total_points: totalPoints,
      correct_answers: correctCount,
      total_answers: totalCount,
      correct_pct: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
      avg_time_s: avgTime,
      answers: pAnswers.map(a => ({
        question_index: a.question_index,
        choice: a.choice,
        correct: a.correct,
        points: a.points,
      })),
    };
  }).sort((a, b) => b.total_points - a.total_points);

  const summary = generateSummary(questions, perQuestion, playerResults);

  return { per_question: perQuestion, players: playerResults, summary };
}

function generateSummary(questions: any[], perQuestion: any[], players: any[]): string[] {
  const summary: string[] = [];
  const totalQ = questions.length;
  const totalP = players.length;
  if (totalQ === 0 || totalP === 0) return ['O\'yinda ma\'lumot yo\'q.'];

  const hardest = perQuestion
    .filter(q => q.total_answers > 0)
    .sort((a, b) => a.correct_pct - b.correct_pct)[0];
  if (hardest) {
    summary.push(`Eng qiyin savol: ${hardest.question_index + 1}-savol, ${100 - hardest.correct_pct}% xato.`);
  }

  const lowScorers = players.filter(p => p.correct_pct < 50);
  if (lowScorers.length > 0) {
    summary.push(`${lowScorers.length} ta o'quvchi 50% dan past natija ko'rsatdi.`);
  }

  const avgCorrect = Math.round(players.reduce((s, p) => s + p.correct_pct, 0) / totalP);
  summary.push(`O'rtacha to'g'ri javob: ${avgCorrect}%.`);

  const finishers = players.filter(p => p.total_answers >= totalQ);
  summary.push(`${finishers.length}/${totalP} o'quvchi barcha savollarga javob berdi.`);

  return summary;
}

// ─── AI JOB PROCESSING ────────────────────────────────────────────────────────

async function processAIJob(jobId: string, ustozId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('hukm_quiz_jobs')
      .update({ status: 'processing', updated_at: nowIso() })
      .eq('id', jobId);

    const { data: job } = await supabaseAdmin
      .from('hukm_quiz_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) return;

    const settings = job.settings || {};
    const sources = job.sources || [];
    const count = settings.count || 10;
    const difficulty = settings.difficulty || 'o\'rta';
    const sections = settings.sections || [];
    const instruction = settings.instruction || '';

    const sourceTexts = sources
      .filter((s: any) => s.type === 'text' && s.content)
      .map((s: any) => s.content)
      .join('\n\n');

    if (!sourceTexts || sourceTexts.length < 20) {
      await supabaseAdmin
        .from('hukm_quiz_jobs')
        .update({ status: 'error', error: 'Manba matni yetarli emas', updated_at: nowIso() })
        .eq('id', jobId);
      return;
    }

    const sectionsText = sections.length > 0
      ? `\nBo'limlar: ${sections.map((s: any) => `${s.name} (${s.count} ta savol)`).join(', ')}`
      : '';

    const systemPrompt = `Sen huquq ta'limi uchun viktorina savollari tuzuvchi yordamchisan.
Berilgan manbadan ${count} ta 4 variantli savol tuz.
Qiyinlik: ${difficulty}.
Har savol uchun:
1. Savol matni aniq va tushunarli
2. 4 ta variant (bittasi to'g'ri)
3. Qisqa izoh (nima uchun to'g'ri javob)
4. Asos modda (manbada bo'lsa, masalan "JK 97-modda"; yo'q bo'lsa bo'sh qoldir)
5. Taymer: 20 soniya (standart)

Javob JSON formatida:
{"questions": [{"text": "...", "options": [{"text": "...", "is_correct": true}, {"text": "...", "is_correct": false}, {"text": "...", "is_correct": false}, {"text": "...", "is_correct": false}], "explanation": "...", "legal_basis": "...", "time_limit_s": 20}]}

Muhim:
- Manbada yo'q ma'lumotni to'qib chiqarma
- Asos modda manbada aniq ko'rsatilgan bo'lsa yoz, aks holda bo'sh
- Har savolda aniq 1 ta to'g'ri variant
- O'zbek tilida yoz (lotin alifbosi)${sectionsText}${instruction ? `\nQo'shimcha izoh: ${instruction}` : ''}`;

    const { text, provider } = await callAIWithFallback({
      systemPrompt,
      messages: [{ role: 'user', text: `Manba:\n${sourceTexts.slice(0, 30000)}` }],
      maxTokens: 4000,
      temperature: 0.7,
      jsonMode: true,
      functionName: 'hukm-quiz-generate',
    });

    let parsed: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      await supabaseAdmin
        .from('hukm_quiz_jobs')
        .update({ status: 'error', error: 'AI javobini tahlil qilib bo\'lmadi', updated_at: nowIso() })
        .eq('id', jobId);
      return;
    }

    const aiQuestions = (parsed.questions || []).map((q: any) => ({
      type: 'variant4',
      text: q.text || '',
      case_text: '',
      options: (q.options || []).map((o: any) => ({
        text: o.text || '',
        is_correct: !!o.is_correct,
      })),
      time_limit_s: q.time_limit_s || 20,
      explanation: q.explanation || '',
      legal_basis: q.legal_basis || '',
      hint: '',
      source: 'ai',
      basis_check: q.legal_basis ? 'unverified' : null,
    }));

    await supabaseAdmin
      .from('hukm_quiz_jobs')
      .update({
        status: 'done',
        result: { questions: aiQuestions },
        updated_at: nowIso(),
      })
      .eq('id', jobId);

    console.log(`[hukm-api] AI job ${jobId} done, ${aiQuestions.length} savol, provider: ${provider}`);
  } catch (err: any) {
    console.error(`[hukm-api] AI job ${jobId} xato:`, err);
    const errorMsg = err.message || 'AI xatosi';
    const neutralMsg = errorMsg.includes('sozlanmagan') || errorMsg.includes('provayder')
      ? 'AI limiti hozircha tugagan, birozdan keyin urinib ko\'ring'
      : errorMsg.includes('429') || errorMsg.includes('quota')
      ? 'AI limiti hozircha tugagan, birozdan keyin urinib ko\'ring'
      : 'AI so\'rovda xato yuz berdi';
    await supabaseAdmin
      .from('hukm_quiz_jobs')
      .update({ status: 'error', error: neutralMsg, updated_at: nowIso() })
      .eq('id', jobId);
  }
}

// ─── YORDAMCHI ────────────────────────────────────────────────────────────────

async function getQuizQuestionsByGame(gameId: string) {
  const { data: game } = await supabaseAdmin
    .from('hukm_games')
    .select('quiz_id')
    .eq('id', gameId)
    .maybeSingle();
  if (!game) return [];
  return getQuizQuestions(game.quiz_id);
}
