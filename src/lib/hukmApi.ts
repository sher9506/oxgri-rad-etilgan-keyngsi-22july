// Hukm API yordamchisi — edge function bilan aloqa
import { supabaseUrl, supabaseAnonKey } from './supabase';

const HUKM_API = `${supabaseUrl}/functions/v1/hukm-api`;

async function hukmFetch(path: string, options?: RequestInit & { query?: Record<string, string> }) {
  const { query, ...fetchOpts } = options || {};
  const url = new URL(`${HUKM_API}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), {
    ...fetchOpts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
      ...(fetchOpts.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Tarmoq xatosi' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Quiz CRUD ──
export async function createQuiz(ustozId: string, title: string, description?: string) {
  return hukmFetch('/quiz', { method: 'POST', body: JSON.stringify({ ustoz_id: ustozId, title, description }) });
}

export async function listQuizzes(ustozId: string) {
  return hukmFetch('/quiz', { method: 'GET', query: { ustoz_id: ustozId } });
}

export async function getQuiz(quizId: string, ustozId: string) {
  return hukmFetch(`/quiz/${quizId}`, { method: 'GET', query: { ustoz_id: ustozId } });
}

export async function updateQuiz(quizId: string, ustozId: string, title: string, description?: string) {
  return hukmFetch(`/quiz/${quizId}`, { method: 'PUT', body: JSON.stringify({ ustoz_id: ustozId, title, description }) });
}

export async function deleteQuiz(quizId: string, ustozId: string) {
  return hukmFetch(`/quiz/${quizId}`, { method: 'DELETE', query: { ustoz_id: ustozId } });
}

export async function saveQuestions(quizId: string, ustozId: string, questions: any[]) {
  return hukmFetch(`/quiz/${quizId}/questions`, {
    method: 'POST',
    body: JSON.stringify({ ustoz_id: ustozId, questions }),
  });
}

export async function parseText(quizId: string, ustozId: string, text: string) {
  return hukmFetch(`/quiz/${quizId}/parse-text`, {
    method: 'POST',
    body: JSON.stringify({ ustoz_id: ustozId, text }),
  });
}

// ── AI savol tuzish ──
export async function startAIJob(ustozId: string, sources: any[], settings: any, quizId?: string) {
  return hukmFetch('/quiz-ai', {
    method: 'POST',
    body: JSON.stringify({ ustoz_id: ustozId, sources, settings, quiz_id: quizId }),
  });
}

export async function getAIJob(jobId: string, ustozId: string) {
  return hukmFetch(`/quiz-ai/${jobId}`, { method: 'GET', query: { ustoz_id: ustozId } });
}

// ── Game lifecycle ──
export async function createGame(ustozId: string, quizId: string, options?: any) {
  return hukmFetch('/game', {
    method: 'POST',
    body: JSON.stringify({ ustoz_id: ustozId, quiz_id: quizId, ...options }),
  });
}

export async function joinGame(pin: string, nickname: string, talabaId: string) {
  return hukmFetch('/game/join', {
    method: 'POST',
    body: JSON.stringify({ pin, nickname, talaba_id: talabaId }),
  });
}

export async function getGameState(gameId: string, tokens?: { host_token?: string; player_token?: string; player_id?: string }) {
  return hukmFetch(`/game/${gameId}`, { method: 'GET', query: tokens });
}

export async function hostAction(gameId: string, action: string, hostToken: string, body?: any) {
  return hukmFetch(`/game/${gameId}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ host_token: hostToken, ...body }),
  });
}

export async function submitAnswer(gameId: string, playerId: string, playerToken: string, choice: number | null) {
  return hukmFetch(`/game/${gameId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ player_id: playerId, player_token: playerToken, choice }),
  });
}

export async function getMistakes(gameId: string, playerId: string, playerToken: string) {
  return hukmFetch(`/game/${gameId}/mistakes`, {
    method: 'GET',
    query: { player_id: playerId, player_token: playerToken },
  });
}

export async function getReport(gameId: string, hostToken: string) {
  return hukmFetch(`/game/${gameId}/report`, { method: 'GET', query: { host_token: hostToken } });
}

// ── Sessions ──
export async function listSessions(ustozId: string) {
  return hukmFetch('/sessions', { method: 'GET', query: { ustoz_id: ustozId } });
}

export async function getSession(sessionId: string, ustozId: string) {
  return hukmFetch(`/sessions/${sessionId}`, { method: 'GET', query: { ustoz_id: ustozId } });
}

// ── Reyting ──
export async function getMyReyting(talabaId: string) {
  return hukmFetch('/reyting', { method: 'GET', query: { talaba_id: talabaId } });
}

export async function getReytingBoard(talabaId?: string) {
  return hukmFetch('/reyting-board', { method: 'GET', query: talabaId ? { talaba_id: talabaId } : {} });
}
