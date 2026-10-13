// Hukm ball hisoblash — barcha konstantalar va rejimlar shu yerda.
// 'aniqlik' (default): 850 base + 150 speed + streak bonus
// 'tezlik': 500 base + 500 speed linear + streak bonus
// 'ishonch': confidence-based, no speed bonus — aniq+to'g'ri=1000, taxmin+to'g'ri=500, taxmin+xato=0, aniq+xato=-600

export type ScoreMode = 'aniqlik' | 'tezlik' | 'ishonch';
export type Confidence = 'aniq' | 'taxmin';

// ── 'aniqlik' rejimi konstantalari ──
export const BASE_POINTS = 850;
export const MAX_SPEED_BONUS = 150;

// ── 'tezlik' rejimi konstantalari ──
export const TEZLIK_BASE = 500;
export const TEZLIK_MAX_SPEED = 500;

// ── 'ishonch' rejimi konstantalari ──
export const ISHONCH_ANIQ_TOGRI = 1000;
export const ISHONCH_TAXMIN_TOGRI = 500;
export const ISHONCH_TAXMIN_XATO = 0;
export const ISHONCH_ANIQ_XATO = -600;

// ── Ketma-ket to'g'ri javob bonusi (barcha rejimlar uchun) ──
export const STREAK_BONUS = [0, 0, 50, 100, 150, 200];
export const STREAK_BONUS_CAP = 200;

// ── Auto-time konstantalari (kazus uchun) ──
export const AUTO_TIME_BASE_S = 30;
export const AUTO_TIME_CHARS_PER_S = 12;
export const AUTO_TIME_MAX_S = 120;

export function autoTimeSeconds(caseText: string, questionText: string): number {
  const combined = (caseText || '') + (questionText || '');
  const extra = Math.ceil(combined.length / AUTO_TIME_CHARS_PER_S);
  return Math.min(AUTO_TIME_BASE_S + extra, AUTO_TIME_MAX_S);
}

// ── Speed bonus ──
export function speedBonus(
  elapsedMs: number,
  timeLimitMs: number,
  speedBonusEnabled: boolean,
  mode: ScoreMode = 'aniqlik'
): number {
  if (!speedBonusEnabled) return 0;
  if (elapsedMs >= timeLimitMs) return 0;
  const fraction = 1 - elapsedMs / timeLimitMs;
  const maxSpeed = mode === 'tezlik' ? TEZLIK_MAX_SPEED : MAX_SPEED_BONUS;
  return Math.round(maxSpeed * fraction);
}

// ── Streak bonus ──
export function streakBonus(consecutiveCorrect: number): number {
  if (consecutiveCorrect < 2) return 0;
  if (consecutiveCorrect >= STREAK_BONUS.length) return STREAK_BONUS_CAP;
  return STREAK_BONUS[consecutiveCorrect];
}

// ── Ishonch rejimida confidence'ga qarab ball ──
function ishonchPoints(correct: boolean, confidence: Confidence | null): number {
  const conf = confidence || 'taxmin';
  if (correct) {
    return conf === 'aniq' ? ISHONCH_ANIQ_TOGRI : ISHONCH_TAXMIN_TOGRI;
  }
  return conf === 'aniq' ? ISHONCH_ANIQ_XATO : ISHONCH_TAXMIN_XATO;
}

// ── Multi-answer: qisman to'g'ri uchun base ball ──
// base * max(0, (correct_selected - wrong_selected) / total_correct_options)
export function multiPartialBase(
  basePoints: number,
  correctSelected: number,
  wrongSelected: number,
  totalCorrectOptions: number
): number {
  if (totalCorrectOptions <= 0) return 0;
  const ratio = (correctSelected - wrongSelected) / totalCorrectOptions;
  return Math.round(basePoints * Math.max(0, ratio));
}

// ── Asosiy ball hisoblash (single-choice) ──
export function calculatePoints(
  correct: boolean,
  elapsedMs: number,
  timeLimitMs: number,
  consecutiveCorrect: number,
  speedBonusEnabled: boolean,
  mode: ScoreMode = 'aniqlik',
  confidence: Confidence | null = null
): number {
  if (mode === 'ishonch') {
    return ishonchPoints(correct, confidence);
  }

  if (!correct) return 0;

  const base = mode === 'tezlik' ? TEZLIK_BASE : BASE_POINTS;
  return base
    + speedBonus(elapsedMs, timeLimitMs, speedBonusEnabled, mode)
    + streakBonus(consecutiveCorrect);
}

// ── Multi-answer ball hisoblash ──
// Speed + streak bonus faqat to'liq to'g'ri bo'lganda.
export function calculateMultiPoints(
  fullyCorrect: boolean,
  correctSelected: number,
  wrongSelected: number,
  totalCorrectOptions: number,
  elapsedMs: number,
  timeLimitMs: number,
  consecutiveCorrect: number,
  speedBonusEnabled: boolean,
  mode: ScoreMode = 'aniqlik',
  confidence: Confidence | null = null
): number {
  if (mode === 'ishonch') {
    return ishonchPoints(fullyCorrect, confidence);
  }

  if (!speedBonusEnabled && mode === 'aniqlik') {
    // speed_bonus o'chiq bo'lsa, base * ratio, streak faqat to'liq to'g'ri
    const base = multiPartialBase(BASE_POINTS, correctSelected, wrongSelected, totalCorrectOptions);
    if (!fullyCorrect) return base;
    return base + streakBonus(consecutiveCorrect);
  }

  const base = mode === 'tezlik' ? TEZLIK_BASE : BASE_POINTS;
  const partialBase = multiPartialBase(base, correctSelected, wrongSelected, totalCorrectOptions);

  if (!fullyCorrect) return partialBase;

  return partialBase
    + speedBonus(elapsedMs, timeLimitMs, speedBonusEnabled, mode)
    + streakBonus(consecutiveCorrect);
}

// ── Total score floor: max(0, sum(points)) ──
// Bitta helper, hamma yerda shu ishlatiladi.
export function totalScore(points: number[]): number {
  const sum = points.reduce((s, p) => s + p, 0);
  return Math.max(0, sum);
}
