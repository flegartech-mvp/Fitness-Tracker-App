import { calcExerciseVolume, getWeekKey } from './xpSystem';

const BOSS_POOL = [
  {
    type: 'volume',
    title: 'Volume Beast',
    desc: 'Lift 5,000 kg total volume this week.',
    goal: 5000,
    unit: 'kg',
    xpReward: 500,
  },
  {
    type: 'workouts',
    title: 'Consistency King',
    desc: 'Complete 4 workouts this week.',
    goal: 4,
    unit: 'workouts',
    xpReward: 400,
  },
  {
    type: 'sets',
    title: 'Set Machine',
    desc: 'Log 30 sets this week.',
    goal: 30,
    unit: 'sets',
    xpReward: 350,
  },
  {
    type: 'volume',
    title: 'Iron Week',
    desc: 'Lift 3,000 kg total volume this week.',
    goal: 3000,
    unit: 'kg',
    xpReward: 300,
  },
  {
    type: 'workouts',
    title: '5-Day Warrior',
    desc: 'Complete 5 workouts this week.',
    goal: 5,
    unit: 'workouts',
    xpReward: 550,
  },
];

export function generateWeeklyChallenge() {
  const weekKey = getWeekKey();
  const idx = weekKey.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % BOSS_POOL.length;

  return {
    ...BOSS_POOL[idx],
    weekKey,
    progress: 0,
    completed: false,
  };
}

export function getChallengeProgress(challenge, exercises) {
  switch (challenge.type) {
    case 'volume':
      return calcExerciseVolume(exercises);
    case 'workouts':
      return 1;
    case 'sets':
      return exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    default:
      return 0;
  }
}
