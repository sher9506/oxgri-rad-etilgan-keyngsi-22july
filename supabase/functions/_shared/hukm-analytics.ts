// hukm-analytics.ts — Hukm analitika hisob-kitoblari (AI'siz, sof funksiyalar)
// Bitta doimiylar bloki + savol/o'quvchi/guruh tahlili funksiyalari

// ─── DOIMIYLLAR (default) ────────────────────────────────────────────────────
export const ANALYTICS = {
  MIN_PLAYERS_DISCRIMINATION: 10,
  GROUP_FRACTION: 0.27,
  LOW_CORRECT_PCT: 20,
  HIGH_CORRECT_PCT: 95,
  WEAK_DISTRACTOR_PCT: 5,
  GUESS_MIN_MS: 2000,
  GUESS_MS_PER_CHAR: 30,
  MASTERY_RED: 50,
  MASTERY_GREEN: 75,
  MIN_ANSWERS_TAG: 3,
  HELP_DECLINE_SESSIONS: 3,
  HELP_GUESS_SHARE: 30,
};

// ─── YORDAMCHILAR ────────────────────────────────────────────────────────────

export function readingFloorMs(questionText: string, caseText: string): number {
  const chars = (questionText || '').length + (caseText || '').length;
  return Math.max(ANALYTICS.GUESS_MIN_MS, ANALYTICS.GUESS_MS_PER_CHAR * chars);
}

export function isGuess(wrong: boolean, elapsedMs: number | null, questionText: string, caseText: string): boolean {
  if (!wrong || elapsedMs == null) return false;
  return elapsedMs < readingFloorMs(questionText, caseText);
}

// ─── SAVOL TAHLILI ───────────────────────────────────────────────────────────

export interface QuestionAnalyticsInput {
  questionIndex: number;
  question: {
    text: string;
    case_text?: string;
    options: { text: string; is_correct?: boolean }[];
    time_limit_s?: number;
    kodeks_nomi?: string | null;
    mavzu?: string | null;
    modda_raqami?: string | null;
  };
  answers: {
    player_id: string;
    choice: number | null;
    correct: boolean;
    elapsed_ms?: number | null;
    points?: number;
    talaba_id?: string | null;
  }[];
  totalPlayers: number;
  // O'yinchining umumiy reytingi (to'g'ri javoblar soni, shu savol HISOBGA OLMASDAN)
  playerCorrectExcludingThis: Record<string, number>;
}

export interface QuestionAnalytics {
  question_index: number;
  text: string;
  tag: { kodeks: string | null; mavzu: string | null; modda: string | null };
  answered_count: number;
  no_answer_count: number;
  correct_pct: number;
  avg_elapsed_ms: number | null;
  avg_correct_elapsed_ms: number | null;
  option_counts: number[];
  option_pcts: number[];
  no_answer_pct: number;
  most_common_wrong_index: number | null;
  most_common_wrong_pct: number;
  discrimination_index: number | null;
  discrimination_note: string;
  flags: { label: string; chip: string }[];
  verdict: 'good' | 'review' | 'easy';
}

export function analyzeQuestion(input: QuestionAnalyticsInput): QuestionAnalytics {
  const { question, answers, totalPlayers, playerCorrectExcludingThis } = input;
  const q = question;
  const options = q.options || [];
  const correctIdx = options.findIndex(o => o.is_correct);
  const answered = answers;
  const answeredCount = answered.length;
  const noAnswerCount = totalPlayers - answeredCount;
  const correctCount = answered.filter(a => a.correct).length;
  const correctPct = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  const optionCounts = options.map((_, i) => answered.filter(a => a.choice === i).length);
  const optionPcts = options.map((_, i) => answeredCount > 0 ? Math.round((optionCounts[i] / answeredCount) * 100) : 0);
  const noAnswerPct = totalPlayers > 0 ? Math.round((noAnswerCount / totalPlayers) * 100) : 0;

  const wrongAnswers = answered.filter(a => !a.correct);
  const wrongByChoice: Record<number, number> = {};
  for (const a of wrongAnswers) { if (a.choice != null) wrongByChoice[a.choice] = (wrongByChoice[a.choice] || 0) + 1; }
  const sortedWrong = Object.entries(wrongByChoice).sort((a, b) => b[1] - a[1]);
  const mostCommonWrongIdx = sortedWrong.length > 0 ? parseInt(sortedWrong[0][0]) : null;
  const mostCommonWrongPct = sortedWrong.length > 0 && answeredCount > 0
    ? Math.round((sortedWrong[0][1] / answeredCount) * 100) : 0;

  // Farqlash indeksi D = p(yuqori 27%) − p(quyi 27%)
  let discriminationIndex: number | null = null;
  let discriminationNote = '';
  if (answeredCount < ANALYTICS.MIN_PLAYERS_DISCRIMINATION) {
    discriminationNote = 'ma\'lumot kam';
  } else {
    const playerScores = answered.map(a => ({
      playerId: a.player_id,
      correct: a.correct,
      scoreExcl: playerCorrectExcludingThis[a.player_id] ?? 0,
    }));
    playerScores.sort((a, b) => b.scoreExcl - a.scoreExcl);
    const groupSize = Math.max(1, Math.round(playerScores.length * ANALYTICS.GROUP_FRACTION));
    const topGroup = playerScores.slice(0, groupSize);
    const bottomGroup = playerScores.slice(-groupSize);
    const topCorrect = topGroup.filter(p => p.correct).length;
    const bottomCorrect = bottomGroup.filter(p => p.correct).length;
    discriminationIndex = Math.round(((topCorrect / topGroup.length) - (bottomCorrect / bottomGroup.length)) * 100) / 100;
    discriminationNote = '';
  }

  // Belgilar
  const flags: { label: string; chip: string }[] = [];
  let verdict: 'good' | 'review' | 'easy' = 'good';

  if (correctPct > ANALYTICS.HIGH_CORRECT_PCT) {
    verdict = 'easy';
    flags.push({ label: 'Juda oson', chip: 'oson' });
  }

  if (correctPct < ANALYTICS.LOW_CORRECT_PCT) {
    flags.push({ label: 'Kalit xato bo\'lishi mumkin', chip: 'kalit' });
    if (verdict !== 'easy') verdict = 'review';
  }

  if (discriminationIndex !== null && discriminationIndex <= 0.05) {
    flags.push({ label: 'Farqlash past', chip: 'farq' });
    if (verdict !== 'easy') verdict = 'review';
  }

  if (discriminationIndex !== null && discriminationIndex > 0.05) {
    // Yuqori guruhning yarmidan ko'pi xato qilganmi?
    const playerScores = answered.map(a => ({
      playerId: a.player_id,
      correct: a.correct,
      scoreExcl: playerCorrectExcludingThis[a.player_id] ?? 0,
    }));
    playerScores.sort((a, b) => b.scoreExcl - a.scoreExcl);
    const groupSize = Math.max(1, Math.round(playerScores.length * ANALYTICS.GROUP_FRACTION));
    const topGroup = playerScores.slice(0, groupSize);
    const topWrongCount = topGroup.filter(p => !p.correct).length;
    if (topWrongCount > topGroup.length / 2) {
      flags.push({ label: 'Yuqori guruh xato qildi', chip: 'yuqori' });
      if (verdict !== 'easy') verdict = 'review';
    }
  }

  // Zaif distraktor (ishlamaydigan variant)
  for (let i = 0; i < options.length; i++) {
    if (i === correctIdx) continue;
    if (answeredCount > 0 && (optionCounts[i] / answeredCount * 100) < ANALYTICS.WEAK_DISTRACTOR_PCT) {
      flags.push({ label: `${String.fromCharCode(65 + i)} variant ishlamaydi`, chip: 'zaif' });
      break;
    }
  }

  if (flags.length === 0 && verdict !== 'easy') {
    verdict = 'good';
  }

  // Vaqt hisobi
  const elapsedVals = answered.map(a => a.elapsed_ms).filter((v): v is number => v != null);
  const avgElapsedMs = elapsedVals.length > 0 ? Math.round(elapsedVals.reduce((s, v) => s + v, 0) / elapsedVals.length) : null;
  const correctElapsedVals = answered.filter(a => a.correct).map(a => a.elapsed_ms).filter((v): v is number => v != null);
  const avgCorrectElapsedMs = correctElapsedVals.length > 0 ? Math.round(correctElapsedVals.reduce((s, v) => s + v, 0) / correctElapsedVals.length) : null;

  return {
    question_index: input.questionIndex,
    text: q.text,
    tag: { kodeks: q.kodeks_nomi ?? null, mavzu: q.mavzu ?? null, modda: q.modda_raqami ?? null },
    answered_count: answeredCount,
    no_answer_count: noAnswerCount,
    correct_pct: correctPct,
    avg_elapsed_ms: avgElapsedMs,
    avg_correct_elapsed_ms: avgCorrectElapsedMs,
    option_counts: optionCounts,
    option_pcts: optionPcts,
    no_answer_pct: noAnswerPct,
    most_common_wrong_index: mostCommonWrongIdx,
    most_common_wrong_pct: mostCommonWrongPct,
    discrimination_index: discriminationIndex,
    discrimination_note: discriminationNote,
    flags,
    verdict,
  };
}

// ─── O'QUVCHI TAHLILI (bir o'yin ichida) ─────────────────────────────────────

export interface StudentGameAnalytics {
  player_id: string;
  nickname: string;
  talaba_id: string | null;
  rank: number;
  total_points: number;
  correct_count: number;
  total_questions: number;
  correct_pct: number;
  avg_elapsed_ms: number | null;
  guess_count: number;
  needs_help: boolean;
  help_reasons: string[];
  answers: {
    question_index: number;
    choice: number | null;
    correct: boolean;
    elapsed_ms: number | null;
    is_guess: boolean;
    points: number;
  }[];
}

export function analyzeStudentInGame(
  player: { id: string; nickname: string; talaba_id: string | null },
  answers: { question_index: number; choice: number | null; correct: boolean; elapsed_ms?: number | null; points: number }[],
  totalQuestions: number,
  questions: { text: string; case_text?: string }[],
  rank: number,
): StudentGameAnalytics {
  const correctCount = answers.filter(a => a.correct).length;
  const correctPct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const elapsedVals = answers.map(a => a.elapsed_ms).filter((v): v is number => v != null);
  const avgElapsedMs = elapsedVals.length > 0 ? Math.round(elapsedVals.reduce((s, v) => s + v, 0) / elapsedVals.length) : null;

  let guessCount = 0;
  for (const a of answers) {
    const q = questions[a.question_index];
    if (q && isGuess(!a.correct, a.elapsed_ms ?? null, q.text, q.case_text || '')) {
      guessCount++;
    }
  }

  return {
    player_id: player.id,
    nickname: player.nickname,
    talaba_id: player.talaba_id,
    rank,
    total_points: answers.reduce((s, a) => s + a.points, 0),
    correct_count: correctCount,
    total_questions: totalQuestions,
    correct_pct: correctPct,
    avg_elapsed_ms: avgElapsedMs,
    guess_count: guessCount,
    needs_help: false,
    help_reasons: [],
    answers: answers.map(a => {
      const q = questions[a.question_index];
      return {
        question_index: a.question_index,
        choice: a.choice,
        correct: a.correct,
        elapsed_ms: a.elapsed_ms ?? null,
        is_guess: q ? isGuess(!a.correct, a.elapsed_ms ?? null, q.text, q.case_text || '') : false,
        points: a.points,
      };
    }),
  };
}

// ─── O'QUVCHI O'YINLARARO TAHLIL ─────────────────────────────────────────────

export interface StudentCrossGameAnalytics {
  talaba_id: string;
  games: { session_id: string; correct_pct: number; date: string }[];
  tag_stats: {
    tag: string;
    correct_pct: number;
    answer_count: number;
    note: string;
  }[];
  needs_help: boolean;
  help_reasons: string[];
}

export function analyzeStudentCrossGame(
  talabaId: string,
  gameResults: { session_id: string; correct_pct: number; date: string; guess_share?: number }[],
  tagResults: { tag: string; correct_count: number; total_count: number }[],
): StudentCrossGameAnalytics {
  const needsHelpReasons: string[] = [];

  // Teg bo'yicha o'zlashtirish
  const tagStats = tagResults.map(t => {
    const pct = t.total_count > 0 ? Math.round((t.correct_count / t.total_count) * 100) : 0;
    const note = t.total_count < ANALYTICS.MIN_ANSWERS_TAG ? 'ma\'lumot kam' : '';
    return { tag: t.tag, correct_pct: pct, answer_count: t.total_count, note };
  });

  // ≥2 xil tegda o'zlashtirish < MASTERY_RED
  const weakTags = tagStats.filter(t => t.answer_count >= ANALYTICS.MIN_ANSWERS_TAG && t.correct_pct < ANALYTICS.MASTERY_RED);
  if (weakTags.length >= 2) {
    needsHelpReasons.push(`${weakTags.length} ta mavzuda o'zlashtirish past (<${ANALYTICS.MASTERY_RED}%)`);
  }

  // Oxirgi HELP_DECLINE_SESSIONS o'yinda to'g'ri % ketma-ket pasaygan
  const sortedGames = [...gameResults].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sortedGames.slice(-ANALYTICS.HELP_DECLINE_SESSIONS);
  if (recent.length >= ANALYTICS.HELP_DECLINE_SESSIONS) {
    let declining = true;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].correct_pct >= recent[i - 1].correct_pct) { declining = false; break; }
    }
    if (declining) {
      needsHelpReasons.push(`Oxirgi ${ANALYTICS.HELP_DECLINE_SESSIONS} o'yinda natija pasaymoqda`);
    }
  }

  // Oxirgi o'yinda taxmin ulushi ≥ HELP_GUESS_SHARE
  const lastGame = sortedGames[sortedGames.length - 1];
  if (lastGame?.guess_share != null && lastGame.guess_share >= ANALYTICS.HELP_GUESS_SHARE) {
    needsHelpReasons.push(`Oxirgi o'yinda taxmin ulushi ${lastGame.guess_share}% (≥${ANALYTICS.HELP_GUESS_SHARE}%)`);
  }

  return {
    talaba_id: talabaId,
    games: sortedGames,
    tag_stats: tagStats,
    needs_help: needsHelpReasons.length > 0,
    help_reasons: needsHelpReasons,
  };
}

// ─── BAHO HISOBlash ──────────────────────────────────────────────────────────

export function computeGrade(correctPct: number, scale: { scale: string; t5: number; t4: number; t3: number }): string {
  if (scale.scale === '100') return String(correctPct);
  if (correctPct >= scale.t5) return '5';
  if (correctPct >= scale.t4) return '4';
  if (correctPct >= scale.t3) return '3';
  return '2';
}

// ─── GURUH ISSIQLIK XARITASI ─────────────────────────────────────────────────

export function heatColor(pct: number): string {
  if (pct < ANALYTICS.MASTERY_RED) return '#fee2e2';
  if (pct < ANALYTICS.MASTERY_GREEN) return '#fef9c3';
  return '#dcfce7';
}

