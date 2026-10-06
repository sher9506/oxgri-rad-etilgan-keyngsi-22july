// Hukm ball hisoblash konstantalari — bitta manba

export const BASE_POINTS = 850;
export const MAX_SPEED_BONUS = 150;
export const STREAK_BONUS = [0, 0, 50, 100, 150, 200]; // index = ketma-ket to'g'ri javoblar soni
export const STREAK_BONUS_CAP = 200; // 5+ dan keyin

export function speedBonus(elapsedMs: number, timeLimitMs: number, speedBonusEnabled: boolean): number {
  if (!speedBonusEnabled) return 0;
  if (elapsedMs >= timeLimitMs) return 0;
  const fraction = 1 - elapsedMs / timeLimitMs;
  return Math.round(MAX_SPEED_BONUS * fraction);
}

export function streakBonus(consecutiveCorrect: number): number {
  if (consecutiveCorrect < 2) return 0;
  if (consecutiveCorrect >= STREAK_BONUS.length) return STREAK_BONUS_CAP;
  return STREAK_BONUS[consecutiveCorrect];
}

export function calculatePoints(
  correct: boolean,
  elapsedMs: number,
  timeLimitMs: number,
  consecutiveCorrect: number,
  speedBonusEnabled: boolean
): number {
  if (!correct) return 0;
  return BASE_POINTS + speedBonus(elapsedMs, timeLimitMs, speedBonusEnabled) + streakBonus(consecutiveCorrect);
}
