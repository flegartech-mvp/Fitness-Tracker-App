import { ACHIEVEMENTS, checkNewAchievements, getAchievementProgress } from '../src/utils/achievements';
import { generateWeeklyChallenge, getChallengeProgress } from '../src/utils/bossChallenge';

describe('game progress helpers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-02T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('unlocks only newly earned achievements', () => {
    const unlocked = checkNewAchievements(
      { totalWorkouts: 10, streak: 1, totalVolume: 1200, level: 5, totalPRs: 1 },
      ['first_workout']
    );

    expect(unlocked.map(item => item.id)).toEqual(
      expect.arrayContaining(['volume_1000', 'level_5', 'pr_first', 'workouts_10'])
    );
    expect(unlocked.map(item => item.id)).not.toContain('first_workout');
  });

  test('reports achievement progress defensively', () => {
    const workoutAchievement = ACHIEVEMENTS.find(item => item.id === 'workouts_50');

    expect(getAchievementProgress(workoutAchievement, { totalWorkouts: 25 })).toEqual({
      current: 25,
      goal: 50,
      progress: 0.5,
    });
  });

  test('generates a stable weekly challenge for the same week', () => {
    const first = generateWeeklyChallenge();
    const second = generateWeeklyChallenge();

    expect(first).toEqual(second);
    expect(first.weekKey).toMatch(/^2026-W\d+$/);
  });

  test('calculates challenge progress by type', () => {
    const exercises = [
      { name: 'Bench', sets: [{ reps: 5, weight: 100 }, { reps: 5, weight: 100 }] },
      { name: 'Pull Up', sets: [{ reps: 8, weight: 0 }] },
    ];

    expect(getChallengeProgress({ type: 'sets' }, exercises)).toBe(3);
    expect(getChallengeProgress({ type: 'workouts' }, exercises)).toBe(1);
    expect(getChallengeProgress({ type: 'volume' }, exercises)).toBe(1000);
    expect(getChallengeProgress({ type: 'unknown' }, exercises)).toBe(0);
  });
});
