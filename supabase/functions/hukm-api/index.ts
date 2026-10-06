// hukm-api — Hukm jonli viktorina server yadrosi
// Barcha vakolat token orqali; anon/RLS policy yo'q, faqat service role.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { calculatePoints } from '../_shared/hukm-scoring.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const RATE_LIMIT_JOIN = 10; // IP+PIN bo'yicha daqiqada
const RATE_LIMIT_WINDOW_MS = 60_000;

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

async function checkRateLimit(key: string): Promise<boolean> {
  const now = Date.now();
  const windowStart = new Date(now - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await supabaseAdmin
    .from('hukm_join_log')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .gte('created_at', windowStart) as any;
  if (count >= RATE_LIMIT_JOIN) return false;
  await supabaseAdmin.from('hukm_join_log').insert({ key, created_at: new Date().toISOString() });
  return true;
}

function sanitizeNickname(nick: string): string {
  const trimmed = nick.trim().slice(0, 20);
  return trimmed.length >= 2 ? trimmed : 'O\'yinchi';
}

async function uniqueNickname(gameId: string, nickname: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('hukm_players')
    .select('nickname')
    .eq('game_id', gameId);
  const existing = new Set((data || []).map(p => p.nickname));
  if (!existing.has(nickname)) return nickname;
  let suffix = 2;
  while (existing.has(`${nickname}${suffix}`)) suffix++;
  return `${nickname}${suffix}`;
}

// O'yinchiga yuboriladigan savol payload'i — to'g'ri javob va izoh yo'q
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

// Reveal'dan keyin to'liq ma'lumot
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
    total_points: map.get(p.id) || 0,
  })).sort((a, b) => b.total_points - a.total_points);
  return limit > 0 ? board.slice(0, limit) : board;
}

async function getConsecutiveCorrect(gameId: string, playerId: string, questionIndex: number): Promise<number> {
  if (questionIndex === 0) return 0;
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

    // ── QUIZ CRUD (ustoz) ──────────────────────────────────────────────────

    // POST /hukm-api/quiz — viktorina yaratish
    if (method === 'POST' && segments[0] === 'quiz') {
      const body = await req.json();
      if (!body.title) return errorResponse('Sarlavha kerak', 400);
      const owner = body.ustoz_id || null; // da'vo sifatida
      const { data, error } = await supabaseAdmin
        .from('hukm_quizzes')
        .insert({ owner, title: body.title, description: body.description || '' })
        .select()
        .single();
      if (error) return errorResponse('Viktorina yaratilmadi', 500);
      return jsonResponse({ quiz: data });
    }

    // GET /hukm-api/quiz?ustoz_id=... — ustoz viktorinalari
    if (method === 'GET' && segments[0] === 'quiz' && !segments[1]) {
      const ustozId = url.searchParams.get('ustoz_id');
      if (!ustozId) return errorResponse('ustoz_id kerak', 400);
      const { data } = await supabaseAdmin
        .from('hukm_quizzes')
        .select('*')
        .eq('owner', ustozId)
        .order('created_at', { ascending: false });
      return jsonResponse({ quizzes: data || [] });
    }

    // GET /hukm-api/quiz/:id — bitta viktorina savollari bilan
    if (method === 'GET' && segments[0] === 'quiz' && segments[1]) {
      const { data } = await supabaseAdmin
        .from('hukm_quizzes')
        .select('*')
        .eq('id', segments[1])
        .maybeSingle();
      if (!data) return errorResponse('Viktorina topilmadi', 404);
      const questions = await getQuizQuestions(segments[1]);
      return jsonResponse({ quiz: data, questions });
    }

    // PUT /hukm-api/quiz/:id — viktorina yangilash
    if (method === 'PUT' && segments[0] === 'quiz' && segments[1]) {
      const body = await req.json();
      const { data, error } = await supabaseAdmin
        .from('hukm_quizzes')
        .update({ title: body.title, description: body.description || '', updated_at: new Date().toISOString() })
        .eq('id', segments[1])
        .select()
        .single();
      if (error) return errorResponse('Yangilanmadi', 500);
      return jsonResponse({ quiz: data });
    }

    // DELETE /hukm-api/quiz/:id — viktorina o'chirish
    if (method === 'DELETE' && segments[0] === 'quiz' && segments[1]) {
      const { error } = await supabaseAdmin
        .from('hukm_quizzes')
        .delete()
        .eq('id', segments[1]);
      if (error) return errorResponse('O\'chirilmadi', 500);
      return jsonResponse({ success: true });
    }

    // POST /hukm-api/quiz/:id/questions — savol qo'shish/yangilash (bulk)
    if (method === 'POST' && segments[0] === 'quiz' && segments[1] && segments[2] === 'questions') {
      const body = await req.json();
      const questions = body.questions || [];
      if (!Array.isArray(questions)) return errorResponse('questions massiv kerak', 400);

      // Eski savollarni o'chirish
      await supabaseAdmin.from('hukm_questions').delete().eq('quiz_id', segments[1]);

      // Yangilarini qo'shish
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
        }));
        const { error } = await supabaseAdmin.from('hukm_questions').insert(rows);
        if (error) return errorResponse('Savollar saqlanmadi', 500);
      }
      return jsonResponse({ success: true, count: questions.length });
    }

    // ── GAME LIFECYCLE ─────────────────────────────────────────────────────

    // POST /hukm-api/game — o'yin yaratish (host_token qaytaradi)
    if (method === 'POST' && segments[0] === 'game' && !segments[1]) {
      const body = await req.json();
      if (!body.quiz_id) return errorResponse('quiz_id kerak', 400);
      const settings = {
        speed_bonus: body.speed_bonus !== false,
        registered_only: !!body.registered_only,
        lobby_locked: false,
        show_text_on_phone: body.show_text_on_phone !== false,
      };
      const hostToken = randomToken(32);
      const hostTokenHash = await sha256Hex(hostToken);

      // Noyob PIN (faqat faol o'yinlar orasida)
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

      // host_token FAQAT bir marta qaytariladi
      return jsonResponse({ game: { id: data.id, pin: data.pin, status: data.status, settings }, host_token: hostToken });
    }

    // POST /hukm-api/game/join — o'yinchi qo'shilish
    if (method === 'POST' && segments[0] === 'game' && segments[1] === 'join') {
      const body = await req.json();
      const pin = body.pin?.toString().trim();
      const nickname = sanitizeNickname(body.nickname || '');
      if (!pin || pin.length !== 6) return errorResponse('Noto\'g\'ri PIN', 400);

      // Rate limit
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const rateKey = `${clientIp}:${pin}`;
      const allowed = await checkRateLimit(rateKey);
      if (!allowed) return errorResponse('Juda ko\'p urinish. Birozdan keyin urinib ko\'ring.', 429);

      // Faol o'yinni topish
      const { data: game } = await supabaseAdmin
        .from('hukm_games')
        .select('id, status, settings')
        .eq('pin', pin)
        .neq('status', 'finished')
        .maybeSingle();
      if (!game) return errorResponse('O\'yin topilmadi', 404);

      // Faqat lobby'da qo'shilish mumkin
      if (game.status !== 'lobby') return errorResponse('O\'yin allaqachon boshlangan', 403);

      // Lobby qulflanganmi?
      if (game.settings?.lobby_locked) return errorResponse('Lobby qulflangan', 403);

      // Registered only?
      if (game.settings?.registered_only && !body.talaba_id) {
        return errorResponse('Faqat ro\'yxatdan o\'tgan o\'quvchilar uchun', 403);
      }

      // Kicked o'yinchi tekshiruvi
      if (body.talaba_id) {
        const { data: kicked } = await supabaseAdmin
          .from('hukm_players')
          .select('id')
          .eq('game_id', game.id)
          .eq('kicked', true)
          .eq('talaba_id', body.talaba_id)
          .maybeSingle();
        if (kicked) return errorResponse('Siz bu o\'yindan chiqarilgansiz', 403);
      }

      const finalNick = await uniqueNickname(game.id, nickname);
      const playerToken = randomToken(32);
      const playerTokenHash = await sha256Hex(playerToken);

      const { data: player, error } = await supabaseAdmin
        .from('hukm_players')
        .insert({
          game_id: game.id,
          nickname: finalNick,
          player_token_hash: playerTokenHash,
          talaba_id: body.talaba_id || null,
        })
        .select('id, nickname')
        .single();
      if (error) return errorResponse('Qo\'shilmadi', 500);

      return jsonResponse({ player, player_token: playerToken, game_id: game.id });
    }

    // GET /hukm-api/game/:id — o'yin holati (host yoki player token bilan)
    if (method === 'GET' && segments[0] === 'game' && segments[1] && !segments[2]) {
      const hostToken = url.searchParams.get('host_token') || '';
      const playerToken = url.searchParams.get('player_token') || '';
      const playerId = url.searchParams.get('player_id') || '';

      const { data: game } = await supabaseAdmin
        .from('hukm_games')
        .select('*')
        .eq('id', segments[1])
        .maybeSingle();
      if (!game) return errorResponse('O\'yin topilmadi', 404);

      const players = await getGamePlayers(game.id);
      const questions = await getQuizQuestions(game.quiz_id);
      const isHost = hostToken ? await verifyHostToken(game.id, hostToken) : false;

      const base: any = {
        id: game.id,
        pin: game.pin,
        status: game.status,
        current_index: game.current_index,
        settings: game.settings,
        players: players.map(p => ({ id: p.id, nickname: p.nickname, talaba_id: p.talaba_id })),
        total_questions: questions.length,
        is_host: isHost,
      };

      if (game.status === 'question' && game.current_index >= 0) {
        const q = questions[game.current_index];
        if (q) {
          const showText = game.settings?.show_text_on_phone !== false;
          base.question = sanitizeQuestionForPlayer(q, game.current_index, showText);
          // Javob berganlar soni
          const { count } = await supabaseAdmin
            .from('hukm_answers')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id)
            .eq('question_index', game.current_index) as any;
          base.answered_count = count || 0;

          // O'yinchi o'z javobini ko'rsin
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

          // Host to'g'ri javobni ko'radi
          if (isHost) {
            base.correct_index = (q.options || []).findIndex((o: any) => o.is_correct);
          }
        }
      }

      if (game.status === 'reveal' && game.current_index >= 0) {
        const q = questions[game.current_index];
        if (q) {
          base.reveal = revealQuestionForPlayer(q, game.current_index);
          // Taqsimot
          const { data: answers } = await supabaseAdmin
            .from('hukm_answers')
            .select('choice')
            .eq('game_id', game.id)
            .eq('question_index', game.current_index);
          const distribution = (q.options || []).map((_: any, i: number) =>
            (answers || []).filter(a => a.choice === i).length
          );
          base.distribution = distribution;

          // O'yinchi natijasi
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

      return jsonResponse(base);
    }

    // ── HOST ACTIONS ───────────────────────────────────────────────────────

    // POST /hukm-api/game/:id/start — o'yinni boshlash (birinchi savol)
    if (method === 'POST' && segments[0] === 'game' && segments[1] && segments[2] === 'start') {
      const body = await req.json();
      if (!await verifyHostToken(segments[1], body.host_token)) return errorResponse('Vakolat yo\'q', 403);
      const questions = await getQuizQuestionsByGame(segments[1]);
      if (questions.length === 0) return errorResponse('Savollar yo\'q', 400);
      const { error } = await supabaseAdmin
        .from('hukm_games')
        .update({ status: 'question', current_index: 0, opened_at: new Date().toISOString() })
        .eq('id', segments[1]);
      if (error) return errorResponse('Boshlanmadi', 500);
      return jsonResponse({ success: true });
    }

    // POST /hukm-api/game/:id/next — keyingi savol
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
        // O'yin tugadi
        await supabaseAdmin
          .from('hukm_games')
          .update({ status: 'finished', ended_at: new Date().toISOString() })
          .eq('id', segments[1]);
        return jsonResponse({ success: true, finished: true });
      }
      await supabaseAdmin
        .from('hukm_games')
        .update({ status: 'question', current_index: nextIndex, opened_at: new Date().toISOString() })
        .eq('id', segments[1]);
      return jsonResponse({ success: true, current_index: nextIndex });
    }

    // POST /hukm-api/game/:id/reveal — javoblarni ochish
    if (method === 'POST' && segments[0] === 'game' && segments[1] && segments[2] === 'reveal') {
      const body = await req.json();
      if (!await verifyHostToken(segments[1], body.host_token)) return errorResponse('Vakolat yo\'q', 403);
      const { error } = await supabaseAdmin
        .from('hukm_games')
        .update({ status: 'reveal' })
        .eq('id', segments[1]);
      if (error) return errorResponse('Reveal amalga oshmadi', 500);
      return jsonResponse({ success: true });
    }

    // POST /hukm-api/game/:id/leaderboard — leaderboard ko'rsatish
    if (method === 'POST' && segments[0] === 'game' && segments[1] && segments[2] === 'leaderboard') {
      const body = await req.json();
      if (!await verifyHostToken(segments[1], body.host_token)) return errorResponse('Vakolat yo\'q', 403);
      await supabaseAdmin
        .from('hukm_games')
        .update({ status: 'leaderboard' })
        .eq('id', segments[1]);
      return jsonResponse({ success: true });
    }

    // POST /hukm-api/game/:id/finish — o'yinni tugatish
    if (method === 'POST' && segments[0] === 'game' && segments[1] && segments[2] === 'finish') {
      const body = await req.json();
      if (!await verifyHostToken(segments[1], body.host_token)) return errorResponse('Vakolat yo\'q', 403);
      await supabaseAdmin
        .from('hukm_games')
        .update({ status: 'finished', ended_at: new Date().toISOString() })
        .eq('id', segments[1]);
      return jsonResponse({ success: true });
    }

    // POST /hukm-api/game/:id/lock — lobby qulflash
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
      return jsonResponse({ success: true, lobby_locked: settings.lobby_locked });
    }

    // POST /hukm-api/game/:id/kick — o'yinchini chiqarib yuborish
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

    // POST /hukm-api/game/:id/answer — javob yuborish
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

      // Vaqt tekshiruvi (server vaqti)
      const questions = await getQuizQuestions(game.quiz_id);
      const q = questions[game.current_index];
      if (!q) return errorResponse('Savol topilmadi', 404);

      const limitMs = (q.time_limit_s || 20) * 1000;
      const elapsed = Date.now() - new Date(game.opened_at).getTime();
      if (elapsed > limitMs + 1000) {
        return errorResponse('Vaqt tugagan', 408);
      }

      // Takroriy javob tekshiruvi (unique constraint orqali)
      const correctIdx = (q.options || []).findIndex((o: any) => o.is_correct);
      const isCorrect = choice === correctIdx;
      const consecutive = await getConsecutiveCorrect(game.id, player_id, game.current_index);
      // getConsecutiveCorrect returns count BEFORE this answer
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
          received_at: new Date().toISOString(),
          correct: isCorrect,
          points,
        });
      if (error) {
        if (error.code === '23505') return errorResponse('Allaqachon javob bergansiz', 409);
        return errorResponse('Javob saqlanmadi', 500);
      }

      // Javobda to'g'ri/noto'g'ri va ball QAYTARILMAYDI — reveal'da ko'rsatiladi
      return jsonResponse({ received: true });
    }

    // ── PLAYER: o'z xatolari (Xatolar daftari) ─────────────────────────────

    // GET /hukm-api/game/:id/mistakes?player_id=...&player_token=...
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

    // GET /hukm-api/game/:id/report?host_token=...
    if (method === 'GET' && segments[0] === 'game' && segments[1] && segments[2] === 'report') {
      const hostToken = url.searchParams.get('host_token') || '';
      if (!await verifyHostToken(segments[1], hostToken)) return errorResponse('Vakolat yo\'q', 403);

      const { data: game } = await supabaseAdmin
        .from('hukm_games')
        .select('quiz_id')
        .eq('id', segments[1])
        .maybeSingle();
      if (!game) return errorResponse('O\'yin topilmadi', 404);

      const questions = await getQuizQuestions(game.quiz_id);
      const players = await getGamePlayers(segments[1]);
      const { data: answers } = await supabaseAdmin
        .from('hukm_answers')
        .select('player_id, question_index, choice, correct, points')
        .eq('game_id', segments[1]);

      const perQuestion = questions.map((q, i) => {
        const qAnswers = (answers || []).filter(a => a.question_index === i);
        const total = qAnswers.length;
        const correctCount = qAnswers.filter(a => a.correct).length;
        const correctPct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
        const optionCounts = (q.options || []).map((_: any, oi: number) =>
          qAnswers.filter(a => a.choice === oi).length
        );
        const wrongAnswers = qAnswers.filter(a => !a.correct);
        const mostCommonWrong = wrongAnswers.length > 0
          ? wrongAnswers.reduce((acc, a) => { acc[a.choice] = (acc[a.choice] || 0) + 1; return acc; }, {} as Record<number, number>)
          : {};
        const mostCommonWrongIdx = Object.entries(mostCommonWrong).sort((a, b) => b[1] - a[1])[0]?.[0];
        return {
          question_index: i,
          text: q.text,
          total_answers: total,
          correct_pct: correctPct,
          difficult: correctPct < 50,
          option_counts: optionCounts,
          most_common_wrong: mostCommonWrongIdx ? parseInt(mostCommonWrongIdx) : null,
        };
      });

      const playerResults = players.map(p => {
        const pAnswers = (answers || []).filter(a => a.player_id === p.id);
        const totalPoints = pAnswers.reduce((s, a) => s + a.points, 0);
        const correctCount = pAnswers.filter(a => a.correct).length;
        return {
          player_id: p.id,
          nickname: p.nickname,
          talaba_id: p.talaba_id,
          total_points: totalPoints,
          correct_answers: correctCount,
          total_answers: pAnswers.length,
        };
      }).sort((a, b) => b.total_points - a.total_points);

      return jsonResponse({ per_question: perQuestion, players: playerResults });
    }

    return errorResponse('Noto\'g\'ri yo\'l', 404);
  } catch (err) {
    console.error('[hukm-api] xato:', err);
    return errorResponse('Server xatosi', 500);
  }
});

// Yordamchi — game ID orqali questions olish
async function getQuizQuestionsByGame(gameId: string) {
  const { data: game } = await supabaseAdmin
    .from('hukm_games')
    .select('quiz_id')
    .eq('id', gameId)
    .maybeSingle();
  if (!game) return [];
  return getQuizQuestions(game.quiz_id);
}
