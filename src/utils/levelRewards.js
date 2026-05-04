export const LEVEL_REWARDS = {
  5: {
    icon: 'L5',
    title: 'Halfway to Warrior',
    desc: 'Level 5 reached. You have left the rookie behind. Keep the momentum going.',
  },
  10: {
    icon: 'L10',
    title: 'Dark Matter Theme',
    desc: 'A deeper, sleeker dark theme is now unlocked in settings.',
  },
  15: {
    icon: 'L15',
    title: 'Champion Badge',
    desc: 'A Champion badge now appears on your profile. Respect earned.',
  },
  20: {
    icon: 'L20',
    title: 'Legend Status',
    desc: 'You are a Legend. Your avatar has evolved. Most people never get here.',
  },
  30: {
    icon: 'L30',
    title: 'God Mode',
    desc: 'Absolute unit. You have achieved God Mode.',
  },
};

export function getRewardForLevel(level) {
  return LEVEL_REWARDS[level] ?? null;
}
