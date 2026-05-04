const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const PR_BONUS_XP = 50;
const STREAK_BONUS_XP = 20;
const DAILY_XP_GOAL = 300;
const PREMIUM_XP_MULTIPLIER = 1.5;

const LEVEL_REWARDS = {
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

const ACHIEVEMENTS = [
  { id: 'first_workout', title: 'First Step', desc: 'Complete your first workout.', icon: '1', check: ({ totalWorkouts }) => totalWorkouts >= 1 },
  { id: 'streak_3', title: 'On Fire', desc: 'Maintain a 3-day streak.', icon: '3D', check: ({ streak }) => streak >= 3 },
  { id: 'streak_7', title: 'Week Warrior', desc: 'Maintain a 7-day streak.', icon: '7D', check: ({ streak }) => streak >= 7 },
  { id: 'volume_1000', title: 'Ton Lifted', desc: 'Lift 1,000 kg total volume.', icon: '1T', check: ({ totalVolume }) => totalVolume >= 1000 },
  { id: 'volume_10000', title: 'Iron Titan', desc: 'Lift 10,000 kg total volume.', icon: 'IT', check: ({ totalVolume }) => totalVolume >= 10000 },
  { id: 'level_5', title: 'Rising Star', desc: 'Reach Level 5.', icon: 'L5', check: ({ level }) => level >= 5 },
  { id: 'level_10', title: 'Elite', desc: 'Reach Level 10.', icon: 'L10', check: ({ level }) => level >= 10 },
  { id: 'pr_first', title: 'New Record', desc: 'Set your first personal record.', icon: 'PR', check: ({ totalPRs }) => totalPRs >= 1 },
  { id: 'workouts_10', title: 'Consistent', desc: 'Log 10 workouts.', icon: '10', check: ({ totalWorkouts }) => totalWorkouts >= 10 },
  { id: 'workouts_50', title: 'Dedicated', desc: 'Log 50 workouts.', icon: '50', check: ({ totalWorkouts }) => totalWorkouts >= 50 },
];

const BOSS_POOL = [
  { type: 'volume', title: 'Volume Beast', desc: 'Lift 5,000 kg total volume this week.', goal: 5000, unit: 'kg', xpReward: 500 },
  { type: 'workouts', title: 'Consistency King', desc: 'Complete 4 workouts this week.', goal: 4, unit: 'workouts', xpReward: 400 },
  { type: 'sets', title: 'Set Machine', desc: 'Log 30 sets this week.', goal: 30, unit: 'sets', xpReward: 350 },
  { type: 'volume', title: 'Iron Week', desc: 'Lift 3,000 kg total volume this week.', goal: 3000, unit: 'kg', xpReward: 300 },
  { type: 'workouts', title: '5-Day Warrior', desc: 'Complete 5 workouts this week.', goal: 5, unit: 'workouts', xpReward: 550 },
];

function getDateStr(days = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function getTodayStr() {
  return getDateStr(0);
}

function getWeekKey() {
  const now = new Date();
  const thursday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${weekNum}`;
}

function generateWeeklyChallenge() {
  const weekKey = getWeekKey();
  const idx = weekKey.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % BOSS_POOL.length;
  return { ...BOSS_POOL[idx], weekKey, progress: 0, completed: false };
}

function getChallengeProgress(challenge, exercises) {
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

function getIntensityMultiplier(weight, prWeight) {
  if (!prWeight || prWeight <= 0) return 1.0;
  const ratio = weight / prWeight;
  if (ratio > 0.8) return 1.2;
  if (ratio >= 0.5) return 1.0;
  return 0.8;
}

function calcSetXP(reps, weight, prWeight = 0) {
  const base = parseInt(reps, 10) * parseFloat(weight) * 0.1;
  return Math.max(1, Math.round(base * getIntensityMultiplier(parseFloat(weight), prWeight)));
}

function calcExerciseVolume(exercises) {
  return exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s2, set) => s2 + set.weight * set.reps, 0),
    0
  );
}

function calcLevel(totalXP) {
  return Math.floor(Math.sqrt(Math.max(0, totalXP) / 100));
}

function calcDailyXP(currentDailyXP, dailyXPDate, earnedXP) {
  const today = getTodayStr();
  return {
    newDailyXP: dailyXPDate === today ? currentDailyXP + earnedXP : earnedXP,
    newDailyXPDate: today,
  };
}

function calcNewStreak(currentStreak, lastWorkoutDate, freezesAvailable = 0) {
  const today = getTodayStr();
  const yesterday = getDateStr(-1);
  const twoDaysAgo = getDateStr(-2);
  const threeDaysAgo = getDateStr(-3);

  if (!lastWorkoutDate) {
    return { newStreak: 1, streakBonus: 0, usedFreeze: false, streakIncremented: true, prevStreak: 0 };
  }
  if (lastWorkoutDate === today) {
    return { newStreak: currentStreak, streakBonus: 0, usedFreeze: false, streakIncremented: false, prevStreak: currentStreak };
  }
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
  if (lastWorkoutDate === threeDaysAgo && freezesAvailable > 0) {
    return { newStreak: currentStreak, streakBonus: 0, usedFreeze: true, streakIncremented: false, prevStreak: currentStreak };
  }
  return { newStreak: 1, streakBonus: 0, usedFreeze: false, streakIncremented: true, prevStreak: currentStreak };
}

function isActivePremium(profile) {
  if (!profile) return false;
  if (profile.isPro === true) return true;
  if (!profile.premiumType) return false;
  if (profile.premiumType === 'session_pack') {
    return (profile.premiumWorkoutsRemaining || 0) > 0;
  }
  if (!profile.premiumExpiry) return false;
  return new Date(profile.premiumExpiry) > new Date();
}

function getPremiumMultiplier(profile) {
  return isActivePremium(profile) ? PREMIUM_XP_MULTIPLIER : 1.0;
}

function getRewardForLevel(level) {
  return LEVEL_REWARDS[level] || null;
}

function checkNewAchievements(stats, unlockedIds = []) {
  const unlocked = new Set(unlockedIds);
  return ACHIEVEMENTS.filter((achievement) => !unlocked.has(achievement.id) && achievement.check(stats));
}

function normalizeExercises(rawExercises) {
  if (!Array.isArray(rawExercises) || rawExercises.length === 0 || rawExercises.length > 40) {
    throw new functions.https.HttpsError('invalid-argument', 'Add 1 to 40 exercises.');
  }

  const grouped = new Map();
  const order = [];

  rawExercises.forEach((rawExercise) => {
    const name = String(rawExercise && rawExercise.name ? rawExercise.name : '').trim();
    if (!name || name.length > 80) {
      throw new functions.https.HttpsError('invalid-argument', 'Each exercise needs a valid name.');
    }

    const rawSets = Array.isArray(rawExercise.sets) ? rawExercise.sets : [];
    if (rawSets.length === 0 || rawSets.length > 20) {
      throw new functions.https.HttpsError('invalid-argument', 'Each exercise needs 1 to 20 sets.');
    }

    const sets = rawSets.map((rawSet) => {
      const reps = Number(rawSet && rawSet.reps);
      const weight = Number(rawSet && rawSet.weight);
      if (!Number.isFinite(reps) || reps <= 0 || reps > 1000 || !Number.isInteger(reps)) {
        throw new functions.https.HttpsError('invalid-argument', 'Reps must be a positive whole number.');
      }
      if (!Number.isFinite(weight) || weight < 0 || weight > 1000) {
        throw new functions.https.HttpsError('invalid-argument', 'Weight must be between 0 and 1000 kg.');
      }
      return { reps, weight };
    });

    const key = name.toLowerCase();
    if (!grouped.has(key)) {
      grouped.set(key, { name, sets });
      order.push(key);
    } else {
      grouped.get(key).sets.push(...sets);
    }
  });

  return order.map((key) => grouped.get(key));
}

async function buildPRMap(userId) {
  const snap = await db.collection('users').doc(userId).collection('workouts').get();
  const prMap = {};

  snap.docs.forEach((docSnap) => {
    (docSnap.data().exercises || []).forEach((exercise) => {
      const key = String(exercise.name || '').toLowerCase();
      const maxWeight = Math.max(0, ...(exercise.sets || []).map((set) => Number(set.weight) || 0));
      prMap[key] = Math.max(prMap[key] || 0, maxWeight);
    });
  });

  return prMap;
}

exports.saveWorkout = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in to save workouts.');
  }

  const userId = context.auth.uid;
  const normalizedExercises = normalizeExercises(data && data.exercises);
  const prMap = await buildPRMap(userId);

  const profileRef = db.collection('users').doc(userId);
  const challengeRef = profileRef.collection('weeklyChallenge').doc('current');
  const workoutRef = profileRef.collection('workouts').doc();

  let txResult = {};

  await db.runTransaction(async (transaction) => {
    const [profileSnap, challengeSnap] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(challengeRef),
    ]);

    if (!profileSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'User profile is missing.');
    }

    const profileData = profileSnap.data() || {};
    const currentTotalXP = profileData.totalXP || 0;
    const currentLevel = profileData.level || 0;
    const currentStreak = profileData.streak || 0;
    const lastDate = profileData.lastWorkoutDate || null;
    const currentVolume = profileData.totalVolume || 0;
    const currentPRs = profileData.totalPRs || 0;
    const currentWorkouts = profileData.totalWorkouts || 0;
    const currentFreezes = profileData.streakFreezes || 0;
    const currentAchievements = profileData.achievements || [];
    const currentLevelRewards = profileData.levelRewards || [];
    const currentDailyXP = profileData.dailyXP || 0;
    const dailyXPDate = profileData.dailyXPDate || null;

    const weekKey = getWeekKey();
    let challenge = challengeSnap.exists ? challengeSnap.data() : null;
    const isNewChallenge = !challenge || challenge.weekKey !== weekKey;
    if (isNewChallenge) {
      challenge = generateWeeklyChallenge();
    }

    let baseEarnedXP = 0;
    let prCount = 0;
    const prExercises = [];

    normalizedExercises.forEach((exercise) => {
      const key = exercise.name.toLowerCase();
      const historicalMax = prMap[key] || null;
      const currentMax = Math.max(0, ...exercise.sets.map((set) => set.weight));
      const isPR = historicalMax !== null && currentMax > historicalMax;

      baseEarnedXP += exercise.sets.reduce(
        (sum, set) => sum + calcSetXP(set.reps, set.weight, historicalMax || 0),
        0
      );

      if (isPR) {
        baseEarnedXP += PR_BONUS_XP;
        prCount += 1;
        prExercises.push(exercise.name);
      }
    });

    const totalVolume = calcExerciseVolume(normalizedExercises);
    const { newStreak, streakBonus, usedFreeze, streakIncremented, prevStreak } = calcNewStreak(
      currentStreak,
      lastDate,
      currentFreezes
    );
    const earnedFreeze = streakIncremented && newStreak > 0 && newStreak % 7 === 0;
    baseEarnedXP += streakBonus;

    const challengeGain = getChallengeProgress(challenge, normalizedExercises);
    const newChallengeProgress = Math.min((challenge.progress || 0) + challengeGain, challenge.goal);
    const bossCompleted = !challenge.completed && newChallengeProgress >= challenge.goal;

    const rawEarnedXP = baseEarnedXP + (bossCompleted ? challenge.xpReward : 0);
    const xpMultiplier = getPremiumMultiplier(profileData);
    const premiumBoosted = xpMultiplier > 1.0;
    const finalEarnedXP = Math.round(rawEarnedXP * xpMultiplier);
    const streakJustReset = newStreak === 1 && prevStreak > 2 && lastDate !== null;

    const newTotalXP = currentTotalXP + finalEarnedXP;
    const newLevel = calcLevel(newTotalXP);
    const didLevelUp = newLevel > currentLevel;
    const { newDailyXP, newDailyXPDate } = calcDailyXP(currentDailyXP, dailyXPDate, finalEarnedXP);
    const dailyGoalHit = currentDailyXP < DAILY_XP_GOAL && newDailyXP >= DAILY_XP_GOAL;
    const levelReward = didLevelUp ? getRewardForLevel(newLevel) : null;
    const rewardAlreadyClaimed = currentLevelRewards.includes(String(newLevel));
    const newRewardUnlocked = Boolean(levelReward) && !rewardAlreadyClaimed;

    const newStats = {
      totalWorkouts: currentWorkouts + 1,
      streak: newStreak,
      totalVolume: currentVolume + totalVolume,
      level: newLevel,
      totalPRs: currentPRs + prCount,
    };
    const newAchievements = checkNewAchievements(newStats, currentAchievements);
    const newAchievementIds = newAchievements.map((achievement) => achievement.id);

    transaction.set(workoutRef, {
      date: FieldValue.serverTimestamp(),
      exercises: normalizedExercises,
      totalXP: finalEarnedXP,
    });

    transaction.update(profileRef, {
      totalXP: FieldValue.increment(finalEarnedXP),
      level: newLevel,
      streak: newStreak,
      lastWorkoutDate: getTodayStr(),
      totalWorkouts: FieldValue.increment(1),
      totalVolume: FieldValue.increment(totalVolume),
      totalPRs: FieldValue.increment(prCount),
      streakFreezes: usedFreeze
        ? Math.max(0, currentFreezes - 1)
        : earnedFreeze
          ? currentFreezes + 1
          : currentFreezes,
      dailyXP: newDailyXP,
      dailyXPDate: newDailyXPDate,
      ...(newAchievementIds.length > 0 && { achievements: FieldValue.arrayUnion(...newAchievementIds) }),
      ...(newRewardUnlocked && { levelRewards: FieldValue.arrayUnion(String(newLevel)) }),
      ...(streakJustReset && {
        savedStreak: prevStreak,
        savedStreakExpiry: getDateStr(3),
      }),
      ...(!streakJustReset && newStreak >= 3 && {
        savedStreak: 0,
        savedStreakExpiry: null,
      }),
      ...(premiumBoosted && profileData.premiumType === 'session_pack' && {
        premiumWorkoutsRemaining: FieldValue.increment(-1),
      }),
    });

    const challengeUpdate = {
      ...(isNewChallenge ? challenge : {}),
      progress: newChallengeProgress,
      completed: bossCompleted || challenge.completed,
    };
    if (isNewChallenge) {
      transaction.set(challengeRef, challengeUpdate);
    } else {
      transaction.update(challengeRef, challengeUpdate);
    }

    txResult = {
      finalEarnedXP,
      newStreak,
      streakBonus,
      prCount,
      prExercises,
      usedFreeze,
      earnedFreeze,
      bossCompleted,
      challenge,
      didLevelUp,
      newLevel,
      currentLevel,
      newTotalXP,
      dailyGoalHit,
      newDailyXP,
      newAchievements,
      newAchievementIds,
      premiumBoosted,
      xpMultiplier,
      newRewardUnlocked,
      levelReward,
      totalVolume,
    };
  });

  return txResult;
});

exports.requestPremiumVerification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in to request premium verification.');
  }

  const planId = String(data && data.planId ? data.planId : '').trim();
  const paypalAmount = String(data && data.paypalAmount ? data.paypalAmount : '').trim();
  if (!['session_pack', 'monthly', 'yearly', 'streak_restore'].includes(planId)) {
    throw new functions.https.HttpsError('invalid-argument', 'Unknown premium plan.');
  }

  await db.collection('premiumVerificationRequests').add({
    userId: context.auth.uid,
    email: context.auth.token.email || null,
    planId,
    paypalAmount,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  });

  return { status: 'pending' };
});
