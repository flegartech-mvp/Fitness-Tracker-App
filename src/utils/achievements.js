export const ACHIEVEMENTS = [
  {
    id: 'first_workout',
    title: 'First Step',
    desc: 'Complete your first workout.',
    icon: '1',
    statKey: 'totalWorkouts',
    goal: 1,
    check: ({ totalWorkouts }) => totalWorkouts >= 1,
  },
  {
    id: 'streak_3',
    title: 'On Fire',
    desc: 'Maintain a 3-day streak.',
    icon: '3D',
    statKey: 'streak',
    goal: 3,
    check: ({ streak }) => streak >= 3,
  },
  {
    id: 'streak_7',
    title: 'Week Warrior',
    desc: 'Maintain a 7-day streak.',
    icon: '7D',
    statKey: 'streak',
    goal: 7,
    check: ({ streak }) => streak >= 7,
  },
  {
    id: 'volume_1000',
    title: 'Ton Lifted',
    desc: 'Lift 1,000 kg total volume.',
    icon: '1T',
    statKey: 'totalVolume',
    goal: 1000,
    check: ({ totalVolume }) => totalVolume >= 1000,
  },
  {
    id: 'volume_10000',
    title: 'Iron Titan',
    desc: 'Lift 10,000 kg total volume.',
    icon: 'IT',
    statKey: 'totalVolume',
    goal: 10000,
    check: ({ totalVolume }) => totalVolume >= 10000,
  },
  {
    id: 'level_5',
    title: 'Rising Star',
    desc: 'Reach Level 5.',
    icon: 'L5',
    statKey: 'level',
    goal: 5,
    check: ({ level }) => level >= 5,
  },
  {
    id: 'level_10',
    title: 'Elite',
    desc: 'Reach Level 10.',
    icon: 'L10',
    statKey: 'level',
    goal: 10,
    check: ({ level }) => level >= 10,
  },
  {
    id: 'pr_first',
    title: 'New Record',
    desc: 'Set your first personal record.',
    icon: 'PR',
    statKey: 'totalPRs',
    goal: 1,
    check: ({ totalPRs }) => totalPRs >= 1,
  },
  {
    id: 'workouts_10',
    title: 'Consistent',
    desc: 'Log 10 workouts.',
    icon: '10',
    statKey: 'totalWorkouts',
    goal: 10,
    check: ({ totalWorkouts }) => totalWorkouts >= 10,
  },
  {
    id: 'workouts_50',
    title: 'Dedicated',
    desc: 'Log 50 workouts.',
    icon: '50',
    statKey: 'totalWorkouts',
    goal: 50,
    check: ({ totalWorkouts }) => totalWorkouts >= 50,
  },
];

export function checkNewAchievements(stats, unlockedIds = []) {
  const unlocked = new Set(unlockedIds);
  return ACHIEVEMENTS.filter(achievement => !unlocked.has(achievement.id) && achievement.check(stats));
}

export function getAchievementProgress(achievement, stats = {}) {
  if (!achievement?.statKey || !achievement?.goal) {
    return { current: 0, goal: 1, progress: 0 };
  }

  const current = Math.max(0, Number(stats[achievement.statKey] ?? 0));
  const goal = achievement.goal;
  const progress = Math.min(current / goal, 1);
  return { current, goal, progress };
}
