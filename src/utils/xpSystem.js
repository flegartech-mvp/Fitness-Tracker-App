// XP, Leveling, and Streak System
// All pure functions; no Firestore calls here.

// Set XP
/**
 * XP earned per set: reps * weight * 0.1 * intensityMultiplier
 *
 * Intensity is relative to the user's PR for that exercise:
 *   < 50% of PR -> 0.8x (warm-up / light work)
 *   50-80% of PR -> 1.0x (normal working sets)
 *   > 80% of PR -> 1.2x (heavy sets; rewards pushing limits)
 *
 * prWeight = 0 (no history) defaults to 1.0x so new users are not penalized.
 * Minimum 1 XP so bodyweight sets (weight = 0) still count.
 *
 * @param {number} reps
 * @param {number} weight - weight used this set (kg)
 * @param {number} prWeight - personal record weight for this exercise (kg)
 */
export function calcSetXP(reps, weight, prWeight = 0) {
  const base = parseInt(reps, 10) * parseFloat(weight) * 0.1;
  const multiplier = getIntensityMultiplier(parseFloat(weight), prWeight);
  return Math.max(1, Math.round(base * multiplier));
}

/**
 * Returns the intensity multiplier based on how heavy the set is
 * relative to the lifter's personal record for that exercise.
 */
export function getIntensityMultiplier(weight, prWeight) {
  if (!prWeight || prWeight <= 0) return 1.0;
  const ratio = weight / prWeight;
  if (ratio > 0.8) return 1.2;
  if (ratio >= 0.5) return 1.0;
  return 0.8;
}

/** PR bonus: flat +50 XP per exercise that beats the historical max weight. */
export const PR_BONUS_XP = 50;

/**
 * Sums total volume (weight * reps) across all exercises and their sets.
 * @param {Array} exercises
 */
export function calcExerciseVolume(exercises) {
  return exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s2, s) => s2 + s.weight * s.reps, 0),
    0
  );
}

/** Streak bonus: +20 XP per workout when streak is 3 or more days. */
export const STREAK_BONUS_XP = 20;

/** Daily XP goal. Progress shown on the Home screen. */
export const DAILY_XP_GOAL = 300;

/**
 * Calculates updated daily XP after a workout.
 * Resets to earnedXP when the date has changed.
 *
 * @param {number} currentDailyXP stored profile value
 * @param {string|null} dailyXPDate stored YYYY-MM-DD string
 * @param {number} earnedXP XP from the workout just completed
 * @returns {{ newDailyXP: number, newDailyXPDate: string }}
 */
export function calcDailyXP(currentDailyXP, dailyXPDate, earnedXP) {
  const today = getTodayStr();
  const newDailyXP = dailyXPDate === today ? currentDailyXP + earnedXP : earnedXP;
  return { newDailyXP, newDailyXPDate: today };
}

// Level formula
/**
 * level = floor(sqrt(totalXP / 100))
 *
 * XP threshold for level N: N^2 * 100
 * Level 0 = 0 XP, Level 1 = 100 XP, Level 5 = 2500 XP, etc.
 */
export function calcLevel(totalXP) {
  return Math.floor(Math.sqrt(Math.max(0, totalXP) / 100));
}

/**
 * Returns { level, currentXP, xpNeeded } for display.
 * level = current level
 * currentXP = XP progress within this level
 * xpNeeded = total XP range of this level for the progress bar
 */
export function getLevelInfo(totalXP) {
  const level = calcLevel(totalXP);
  const xpAtLevel = level * level * 100;
  const xpAtNext = (level + 1) * (level + 1) * 100;

  return {
    level,
    currentXP: totalXP - xpAtLevel,
    xpNeeded: xpAtNext - xpAtLevel,
  };
}

// Rank titles
export function getRankTitle(level) {
  if (level < 3) return 'Rookie';
  if (level < 6) return 'Athlete';
  if (level < 10) return 'Warrior';
  if (level < 15) return 'Champion';
  if (level < 20) return 'Legend';
  return 'God Mode';
}

// Date / week helpers
/**
 * Returns a local date string offset by `days` from today.
 * Example: getDateStr(0) -> "2026-03-25", getDateStr(-1) -> "2026-03-24"
 */
export function getDateStr(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Convenience alias that keeps callers readable. */
export function getTodayStr() {
  return getDateStr(0);
}

/**
 * Returns an ISO 8601 week key like "2026-W12".
 * Weeks start on Monday; week 1 contains the first Thursday of the year.
 * Using UTC so the key is identical for all users at any given moment,
 * which keeps the "community same boss" feature consistent across timezones.
 */
export function getWeekKey() {
  const now = new Date();
  // Shift to the nearest Thursday (ISO week belongs to the year of its Thursday)
  const thursday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${weekNum}`;
}

// ─── Premium system ────────────────────────────────────────────────────────────

/** XP multiplier applied to every workout for active premium users. */
export const PREMIUM_XP_MULTIPLIER = 1.5;

/**
 * Returns true when the user has an active premium entitlement.
 * Handles three premium types:
 *   - isPro          Legacy Stripe subscribers (set server-side).
 *   - session_pack   PayPal pack: active while premiumWorkoutsRemaining > 0.
 *   - monthly/yearly PayPal subscription: active while premiumExpiry > now.
 */
export function isActivePremium(profile) {
  if (!profile) return false;
  if (profile.isPro === true) return true;
  if (!profile.premiumType) return false;
  if (profile.premiumType === 'session_pack') {
    return (profile.premiumWorkoutsRemaining ?? 0) > 0;
  }
  if (!profile.premiumExpiry) return false;
  return new Date(profile.premiumExpiry) > new Date();
}

/** Returns PREMIUM_XP_MULTIPLIER when premium is active, 1.0 otherwise. */
export function getPremiumMultiplier(profile) {
  return isActivePremium(profile) ? PREMIUM_XP_MULTIPLIER : 1.0;
}

/**
 * Returns milliseconds until the streak expires under the 48-hour rule.
 * Streak survives today, tomorrow (yesterday from next day), and the day after.
 * Expiry = midnight at the start of the 3rd calendar day after last workout.
 */
export function getStreakExpiryMs(lastWorkoutDateStr) {
  if (!lastWorkoutDateStr) return 0;
  const [y, m, d] = lastWorkoutDateStr.split('-').map(Number);
  const expiry = new Date(y, m - 1, d + 3, 0, 0, 0); // local midnight of day+3
  return Math.max(0, expiry.getTime() - Date.now());
}

// ─── Streak ────────────────────────────────────────────────────────────────────
/**
 * Computes the new streak after a workout.
 *
 * 48-HOUR WINDOW (updated from 24h):
 * - No previous workout         → streak = 1
 * - Already logged today        → streak unchanged, no bonus
 * - Last workout yesterday      → streak + 1  (within 48 h)
 * - Last workout 2 days ago     → streak + 1  (within 48 h, no freeze needed)
 * - Last workout 3 days ago + freeze available → streak held, freeze consumed
 * - Otherwise                   → streak resets to 1
 *
 * @param {number}      currentStreak
 * @param {string|null} lastWorkoutDate   YYYY-MM-DD
 * @param {number}      freezesAvailable
 * @returns {{ newStreak, streakBonus, usedFreeze, streakIncremented, prevStreak }}
 *
 * streakIncremented — true only when the count actually grew.
 * prevStreak        — value before this save; callers store it for streak restore.
 */
export function calcNewStreak(currentStreak, lastWorkoutDate, freezesAvailable = 0) {
  const today      = getTodayStr();
  const yesterday  = getDateStr(-1);
  const twoDaysAgo = getDateStr(-2);
  const threeDaysAgo = getDateStr(-3);

  if (!lastWorkoutDate) {
    return { newStreak: 1, streakBonus: 0, usedFreeze: false, streakIncremented: true, prevStreak: 0 };
  }

  if (lastWorkoutDate === today) {
    return { newStreak: currentStreak, streakBonus: 0, usedFreeze: false, streakIncremented: false, prevStreak: currentStreak };
  }

  // 48-hour window: both yesterday and two-days-ago continue the streak.
  if (lastWorkoutDate === yesterday || lastWorkoutDate === twoDaysAgo) {
    const newStreak = currentStreak + 1;
    return {
      newStreak,
      streakBonus: newStreak >= 3 ? STREAK_BONUS_XP : 0,
      usedFreeze: false,
      streakIncremented: true,
      prevStreak: currentStreak,
    };
  }

  // Freeze now protects a 3-day gap (shifted from 2-day with the wider window).
  if (lastWorkoutDate === threeDaysAgo && freezesAvailable > 0) {
    return { newStreak: currentStreak, streakBonus: 0, usedFreeze: true, streakIncremented: false, prevStreak: currentStreak };
  }

  // Streak lost — return prevStreak so caller can save it for paid restore.
  return { newStreak: 1, streakBonus: 0, usedFreeze: false, streakIncremented: true, prevStreak: currentStreak };
}
