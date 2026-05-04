import {
  calcDailyXP,
  calcExerciseVolume,
  calcLevel,
  calcNewStreak,
  calcSetXP,
  getIntensityMultiplier,
  getPremiumMultiplier,
  getStreakExpiryMs,
  isActivePremium,
  STREAK_BONUS_XP,
} from '../src/utils/xpSystem';

describe('xpSystem', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-02T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('calculates set XP with intensity multipliers and minimum bodyweight XP', () => {
    expect(calcSetXP(10, 100, 100)).toBe(120);
    expect(calcSetXP(10, 60, 100)).toBe(60);
    expect(calcSetXP(10, 40, 100)).toBe(32);
    expect(calcSetXP(15, 0, 0)).toBe(1);
  });

  test('returns expected intensity multipliers', () => {
    expect(getIntensityMultiplier(90, 100)).toBe(1.2);
    expect(getIntensityMultiplier(50, 100)).toBe(1.0);
    expect(getIntensityMultiplier(49, 100)).toBe(0.8);
    expect(getIntensityMultiplier(100, 0)).toBe(1.0);
  });

  test('calculates volume and level from deterministic formulas', () => {
    const exercises = [
      { name: 'Bench', sets: [{ reps: 5, weight: 100 }, { reps: 8, weight: 80 }] },
      { name: 'Squat', sets: [{ reps: 3, weight: 140 }] },
    ];

    expect(calcExerciseVolume(exercises)).toBe(1560);
    expect(calcLevel(0)).toBe(0);
    expect(calcLevel(100)).toBe(1);
    expect(calcLevel(2500)).toBe(5);
  });

  test('tracks daily XP per calendar date', () => {
    expect(calcDailyXP(50, '2026-05-02', 25)).toEqual({
      newDailyXP: 75,
      newDailyXPDate: '2026-05-02',
    });
    expect(calcDailyXP(50, '2026-05-01', 25)).toEqual({
      newDailyXP: 25,
      newDailyXPDate: '2026-05-02',
    });
  });

  test('continues, freezes, and resets streaks', () => {
    expect(calcNewStreak(2, '2026-05-01', 0)).toMatchObject({
      newStreak: 3,
      streakBonus: STREAK_BONUS_XP,
      usedFreeze: false,
    });
    expect(calcNewStreak(4, '2026-04-29', 1)).toMatchObject({
      newStreak: 4,
      usedFreeze: true,
    });
    expect(calcNewStreak(4, '2026-04-28', 0)).toMatchObject({
      newStreak: 1,
      prevStreak: 4,
    });
  });

  test('detects active premium types', () => {
    expect(isActivePremium({ isPro: true })).toBe(true);
    expect(isActivePremium({ premiumType: 'session_pack', premiumWorkoutsRemaining: 2 })).toBe(true);
    expect(isActivePremium({ premiumType: 'session_pack', premiumWorkoutsRemaining: 0 })).toBe(false);
    expect(isActivePremium({ premiumType: 'monthly', premiumExpiry: '2026-06-01T00:00:00.000Z' })).toBe(true);
    expect(isActivePremium({ premiumType: 'monthly', premiumExpiry: '2026-04-01T00:00:00.000Z' })).toBe(false);
    expect(getPremiumMultiplier({ premiumType: 'monthly', premiumExpiry: '2026-06-01T00:00:00.000Z' })).toBe(1.5);
  });

  test('computes streak expiry from the stored local date', () => {
    expect(getStreakExpiryMs('2026-05-01')).toBeGreaterThan(0);
    expect(getStreakExpiryMs('2026-04-20')).toBe(0);
  });
});
