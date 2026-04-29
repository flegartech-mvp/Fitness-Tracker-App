import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { collection, doc, getDoc, getDocs, increment, limit, orderBy, query, startAfter, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AppButton from '../components/AppButton';
import ThemeToggleButton from '../components/ThemeToggleButton';
import { logAnalyticsEvent } from '../utils/analytics';
import { generateWeeklyChallenge } from '../utils/bossChallenge';
import { DAILY_XP_GOAL, getDateStr, getLevelInfo, getPremiumMultiplier, getRankTitle, getStreakExpiryMs, getTodayStr, getWeekKey, isActivePremium } from '../utils/xpSystem';

// Decides once — only after the profile has loaded — whether to show the nudge.
// Using a ref (not state) avoids a re-render; the decision is stable for the
// lifetime of the screen. Runs synchronously on every render but only commits
// the random decision once profile becomes non-null, so Pro users whose profile
// loads asynchronously never see the nudge.
function useProNudge(profile) {
  const decided = useRef(false);
  const show = useRef(false);
  if (!decided.current && profile !== null) {
    decided.current = true;
    show.current = !profile?.isPro && Math.random() < 0.33;
  }
  return show.current;
}

export default function HomeScreen({ navigation }) {
  const { user, profile, logout, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [workouts, setWorkouts] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const lastWorkoutDocRef = useRef(null);
  const [error, setError] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [restoreStep, setRestoreStep] = useState('idle'); // 'idle' | 'paying' | 'confirming'
  const [restoringStreak, setRestoringStreak] = useState(false);
  const [streakMsLeft, setStreakMsLeft] = useState(0);

  const showProNudge = useProNudge(profile);

  const fetchWorkouts = useCallback(async () => {
    setError(null);
    try {
      const workoutQuery = query(
        collection(db, 'users', user.uid, 'workouts'),
        orderBy('date', 'desc'),
        limit(20)
      );
      const snap = await getDocs(workoutQuery);
      lastWorkoutDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === 20);
      setWorkouts(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    } catch (err) {
      console.error('fetchWorkouts:', err);
      setError('Could not load workouts. Pull down to retry.');
    } finally {
      setLoadingList(false);
    }
  }, [user.uid]);

  const loadMoreWorkouts = useCallback(async () => {
    if (loadingMore || !hasMore || !lastWorkoutDocRef.current) return;
    setLoadingMore(true);
    try {
      const workoutQuery = query(
        collection(db, 'users', user.uid, 'workouts'),
        orderBy('date', 'desc'),
        startAfter(lastWorkoutDocRef.current),
        limit(20)
      );
      const snap = await getDocs(workoutQuery);
      lastWorkoutDocRef.current = snap.docs[snap.docs.length - 1] ?? lastWorkoutDocRef.current;
      setHasMore(snap.docs.length === 20);
      setWorkouts(prev => [...prev, ...snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))]);
    } catch (err) {
      console.error('loadMoreWorkouts:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [user.uid, loadingMore, hasMore]);

  const fetchChallenge = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'weeklyChallenge', 'current'));
      if (snap.exists() && snap.data().weekKey === getWeekKey()) {
        setChallenge(snap.data());
      } else {
        setChallenge(generateWeeklyChallenge());
      }
    } catch (err) {
      console.error('fetchChallenge:', err);
    }
  }, [user.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    void logAnalyticsEvent(user.uid, 'screen_view', { screen: 'home' });
  }, [user?.uid]);

  // Live streak countdown — updates every 60 s so "Xh left" stays accurate.
  useEffect(() => {
    const date = profile?.lastWorkoutDate ?? null;
    if (!date) { setStreakMsLeft(0); return; }
    setStreakMsLeft(getStreakExpiryMs(date));
    const timer = setInterval(() => setStreakMsLeft(getStreakExpiryMs(date)), 60_000);
    return () => clearInterval(timer);
  }, [profile?.lastWorkoutDate]);

  // The focus event fires on initial mount AND whenever the screen regains
  // focus (e.g. returning from WorkoutScreen), so a single listener is enough.
  // The previous standalone mount effect was a duplicate that caused double
  // Firestore reads on every initial load.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshProfile();
      fetchWorkouts();
      fetchChallenge();
    });
    return unsubscribe;
  }, [navigation, refreshProfile, fetchWorkouts, fetchChallenge]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refreshProfile(), fetchWorkouts(), fetchChallenge()]);
    setRefreshing(false);
  }

  function handleLogout() {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  }

  const totalXP = profile?.totalXP ?? 0;
  const freezes = profile?.streakFreezes ?? 0;

  // The stored streak is only updated when a workout is saved, so a user who
  // hasn't worked out in days still sees their old number until they save again.
  // Compute whether the stored streak is still "alive" and show 0 if it has
  // expired — this matches what calcNewStreak would produce on the next save.
  const storedStreak = profile?.streak ?? 0;
  const lastDate = profile?.lastWorkoutDate ?? null;
  // 48-hour window: streak alive if last workout was today, yesterday, or 2 days ago.
  // Freeze at 3-day gap mirrors the updated calcNewStreak logic.
  const streakAlive =
    lastDate === getTodayStr() ||
    lastDate === getDateStr(-1) ||
    lastDate === getDateStr(-2) ||
    (lastDate === getDateStr(-3) && freezes > 0);
  const streak = storedStreak > 0 && streakAlive ? storedStreak : 0;

  // Hours remaining before streak expires (under 48h window).
  const streakHoursLeft = Math.ceil(streakMsLeft / 3_600_000);
  const streakUrgent = streak > 0 && streakHoursLeft > 0 && streakHoursLeft <= 24;

  // Streak restore availability: show offer within 3 days of losing a significant streak.
  const savedStreak = profile?.savedStreak ?? 0;
  const savedStreakExpiry = profile?.savedStreakExpiry ?? null;
  const canRestoreStreak = savedStreak > 2 && streak === 0 &&
    savedStreakExpiry !== null && savedStreakExpiry >= getTodayStr();

  // Premium boost indicator
  const premiumActive = isActivePremium(profile);

  const { level, currentXP, xpNeeded } = getLevelInfo(totalXP);
  const progressPct = xpNeeded > 0 ? currentXP / xpNeeded : 0;
  const rank = getRankTitle(level);
  const powerLevel = Math.round((profile?.totalVolume ?? 0) + totalXP * 2);

  const dailyXP = profile?.dailyXPDate === getTodayStr() ? (profile?.dailyXP ?? 0) : 0;
  const dailyPct = Math.min(dailyXP / DAILY_XP_GOAL, 1);
  const dailyDone = dailyXP >= DAILY_XP_GOAL;
  const almostThere = !dailyDone && dailyPct >= 0.8;

  async function handleRestoreWithPayPal() {
    void logAnalyticsEvent(user.uid, 'streak_restore_started', { savedStreak });
    await Linking.openURL('https://paypal.me/TiniFlegar/0.99');
    setRestoreStep('paying');
  }

  async function handleConfirmRestore() {
    if (restoringStreak) return;
    setRestoringStreak(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        streak: savedStreak,
        lastWorkoutDate: getDateStr(-1), // yesterday — user must work out today to keep it
        savedStreak: 0,
        savedStreakExpiry: null,
        streakRestoresUsed: increment(1),
      });
      await refreshProfile();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void logAnalyticsEvent(user.uid, 'streak_restored', { restoredTo: savedStreak });
      setRestoreStep('idle');
      Alert.alert('Streak Restored!', `Your ${savedStreak}-day streak is back. Work out today to keep it going.`);
    } catch (err) {
      console.error('handleConfirmRestore:', err);
      Alert.alert('Error', 'Could not restore streak. Try again.');
    } finally {
      setRestoringStreak(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {profile?.displayName ?? 'Warrior'}</Text>
          <Text style={styles.rank}>{rank}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={({ pressed }) => [
              styles.streakBadge,
              streak >= 3 && styles.streakBadgeActive,
              pressed && styles.pressedCard,
            ]}
            accessibilityLabel={`Streak: ${streak} day${streak !== 1 ? 's' : ''}${freezes > 0 ? `, ${freezes} freeze${freezes > 1 ? 's' : ''}` : ''}`}
            accessibilityRole="button"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void logAnalyticsEvent(user.uid, 'home_streak_badge_tapped', {
                streak,
                freezes,
              });
              if (freezes > 0) {
                Alert.alert(
                  'Streak Freeze',
                  `You have ${freezes} freeze${freezes > 1 ? 's' : ''}. Miss a day and your streak is automatically protected.`
                );
              }
            }}
          >
            <Text style={styles.streakLabel}>Streak</Text>
            <Text style={[styles.streakCount, streak >= 3 && styles.streakCountActive]}>{streak}</Text>
            {freezes > 0 && <Text style={styles.freezeCount}>❄️ {freezes}</Text>}
            {streakUrgent && <Text style={styles.streakUrgent}>{streakHoursLeft}h</Text>}
          </Pressable>
          <ThemeToggleButton />
          <Pressable
            onPress={() => {
              void logAnalyticsEvent(user.uid, 'home_logout_tapped');
              handleLogout();
            }}
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressedCard]}
            accessibilityLabel="Log out"
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.identityCard}>
        <View style={styles.identityLeft}>
          <Text style={styles.identityLevelLabel}>LEVEL</Text>
          <Text style={styles.identityLevelNum}>{level}</Text>
          <Text style={styles.identityRank}>{rank}</Text>
        </View>
        <View style={styles.identityDivider} />
        <View style={styles.identityRight}>
          <Text style={styles.powerLabel}>POWER LEVEL</Text>
          <Text style={styles.powerVal}>{powerLevel.toLocaleString()}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.min(progressPct * 100, 100)}%` }]} />
          </View>
          <Text style={styles.xpSub}>{currentXP} / {xpNeeded} XP to next level</Text>
          {premiumActive && (
            <Text style={styles.boostBadge}>⚡ 1.5x XP Active</Text>
          )}
        </View>
      </View>

      <View style={[
        styles.dailyCard,
        dailyDone && styles.dailyCardDone,
        almostThere && styles.dailyCardAlmost,
      ]}>
        <View style={styles.dailyHeader}>
          <Text style={[styles.dailyLabel, almostThere && styles.dailyLabelAlmost]}>
            {dailyDone ? 'Daily goal complete' : almostThere ? 'Almost there' : 'Daily goal'}
          </Text>
          <Text style={[styles.dailyXPText, dailyDone && styles.dailyXPDone]}>
            {dailyXP} / {DAILY_XP_GOAL} XP
          </Text>
        </View>
        <View style={styles.dailyBarTrack}>
          <View
            style={[
              styles.dailyBarFill,
              { width: `${dailyPct * 100}%` },
              dailyDone && styles.dailyBarDone,
              almostThere && styles.dailyBarAlmost,
            ]}
          />
        </View>
      </View>

      {challenge && (
        <View style={[styles.bossCard, challenge.completed && styles.bossCardDone]}>
          <View style={styles.bossHeader}>
            <Text style={styles.bossWeek}>WEEKLY BOSS</Text>
            {challenge.completed ? (
              <Text style={styles.bossDoneBadge}>DONE</Text>
            ) : (
              <Text style={styles.bossXPBadge}>+{challenge.xpReward} XP</Text>
            )}
          </View>
          <Text style={styles.bossTitle}>{challenge.title}</Text>
          <Text style={styles.bossDesc}>{challenge.desc}</Text>
          <View style={styles.bossBarTrack}>
            <View
              style={[
                styles.bossBarFill,
                { width: `${Math.min((challenge.progress / challenge.goal) * 100, 100)}%` },
                challenge.completed && styles.bossBarDone,
              ]}
            />
          </View>
          <Text style={styles.bossProg}>
            {Math.round(challenge.progress).toLocaleString()} / {challenge.goal.toLocaleString()} {challenge.unit}
          </Text>
        </View>
      )}

      {canRestoreStreak && (
        <View style={styles.restoreCard}>
          <View style={styles.restoreHeader}>
            <Text style={styles.restoreTitle}>🔥 Restore your {savedStreak}-day streak</Text>
            <Text style={styles.restorePrice}>$0.99</Text>
          </View>
          <Text style={styles.restoreDesc}>Pay via PayPal, then confirm below to get it back.</Text>
          {restoreStep === 'idle' && (
            <Pressable
              style={({ pressed }) => [styles.restoreBtn, pressed && styles.pressedCard]}
              onPress={handleRestoreWithPayPal}
              accessibilityLabel={`Restore ${savedStreak}-day streak for $0.99 via PayPal`}
              accessibilityRole="button"
            >
              <Text style={styles.restoreBtnText}>Pay with PayPal</Text>
            </Pressable>
          )}
          {restoreStep === 'paying' && (
            <View style={styles.restoreConfirmRow}>
              <Pressable
                style={({ pressed }) => [styles.restoreBtn, pressed && styles.pressedCard]}
                onPress={handleConfirmRestore}
                disabled={restoringStreak}
                accessibilityLabel="Confirm payment and restore streak"
                accessibilityRole="button"
              >
                <Text style={styles.restoreBtnText}>
                  {restoringStreak ? 'Activating…' : "I've paid — Restore"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setRestoreStep('idle')}
                accessibilityLabel="Cancel streak restore"
                accessibilityRole="button"
              >
                <Text style={styles.restoreCancel}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {showProNudge && (
        <Pressable
          style={({ pressed }) => [styles.proNudge, pressed && styles.pressedCard]}
          onPress={() => {
            void logAnalyticsEvent(user.uid, 'upgrade_nudge_tapped', { source: 'home' });
            navigation.navigate('Upgrade');
          }}
        >
          <Text style={styles.proNudgeText}>Get 1.5x XP, streak restores, and more.</Text>
          <Text style={styles.proNudgeLink}>Upgrade</Text>
        </Pressable>
      )}

      <View style={styles.actionRow}>
        <AppButton
          label="+ Start Workout"
          onPress={() => {
            void logAnalyticsEvent(user.uid, 'home_cta_tapped', { target: 'workout' });
            navigation.navigate('Workout');
          }}
          style={styles.startBtn}
          accessibilityLabel="Start a new workout"
          accessibilityRole="button"
        />
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressedCard]}
          onPress={() => {
            void logAnalyticsEvent(user.uid, 'home_cta_tapped', { target: 'achievements' });
            navigation.navigate('Achievements');
          }}
          accessibilityLabel="View achievements"
          accessibilityRole="button"
        >
          <Text style={styles.iconBtnText}>Wins</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>
        History{workouts.length > 0 ? ` (${workouts.length})` : ''}
      </Text>

      {loadingList ? (
        <ActivityIndicator color={colors.brand} style={styles.loadingList} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No workouts yet.{'\n'}Tap "+ Start Workout" to begin.</Text>
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable
                style={({ pressed }) => [styles.loadMoreBtn, pressed && styles.pressedCard]}
                onPress={loadMoreWorkouts}
                disabled={loadingMore}
                accessibilityLabel="Load more workouts"
                accessibilityRole="button"
              >
                {loadingMore
                  ? <ActivityIndicator color={colors.brand} size="small" />
                  : <Text style={styles.loadMoreText}>Load more</Text>}
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => <WorkoutCard workout={item} styles={styles} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function WorkoutCard({ workout, styles }) {
  const dateStr = workout.date?.toDate
    ? workout.date.toDate().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Recent';

  const exercises = workout.exercises ?? [];
  const totalSets = exercises.reduce((sum, exercise) => sum + (exercise.sets?.length ?? 0), 0);
  const names = exercises.slice(0, 3).map(exercise => exercise.name).join(', ');
  const overflow = exercises.length > 3 ? ` +${exercises.length - 3}` : '';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{dateStr}</Text>
        <View style={styles.xpBadge}>
          <Text style={styles.xpBadgeText}>+{workout.totalXP ?? 0} XP</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <StatPill label="Exercises" value={exercises.length} styles={styles} />
        <StatPill label="Sets" value={totalSets} styles={styles} />
      </View>
      {names.length > 0 && (
        <Text style={styles.exerciseNames} numberOfLines={1}>
          {names}
          {overflow}
        </Text>
      )}
    </View>
  );
}

function StatPill({ label, value, styles }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 12,
      paddingHorizontal: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    greeting: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
    },
    rank: {
      color: colors.brand,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 4,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pressedCard: {
      opacity: 0.9,
      transform: [{ scale: 0.985 }],
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    streakBadgeActive: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.brand,
    },
    streakLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
    streakCount: {
      color: colors.text,
      fontWeight: '800',
      fontSize: 14,
    },
    streakCountActive: {
      color: colors.brand,
    },
    freezeCount: {
      color: colors.brand,
      fontWeight: '700',
      fontSize: 11,
    },
    streakUrgent: {
      color: colors.danger,
      fontWeight: '800',
      fontSize: 10,
    },
    logoutBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    logoutText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    identityCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    identityLeft: {
      alignItems: 'center',
      minWidth: 72,
    },
    identityLevelLabel: {
      color: colors.textSoft,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2,
      marginBottom: 2,
    },
    identityLevelNum: {
      color: colors.brand,
      fontSize: 40,
      fontWeight: '800',
      lineHeight: 44,
    },
    identityRank: {
      color: colors.brand,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    },
    identityDivider: {
      width: 1,
      backgroundColor: colors.border,
      height: '100%',
      marginHorizontal: 16,
    },
    identityRight: {
      flex: 1,
    },
    powerLabel: {
      color: colors.textSoft,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
      marginBottom: 2,
    },
    powerVal: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
      marginBottom: 8,
    },
    barTrack: {
      height: 6,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 5,
    },
    barFill: {
      height: '100%',
      backgroundColor: colors.brand,
      borderRadius: 3,
    },
    xpSub: {
      color: colors.textSoft,
      fontSize: 11,
    },
    boostBadge: {
      color: colors.warning,
      fontSize: 10,
      fontWeight: '700',
      marginTop: 4,
    },
    dailyCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dailyCardDone: {
      borderColor: colors.success,
      backgroundColor: colors.surfaceAlt,
    },
    dailyCardAlmost: {
      borderColor: colors.brand,
      backgroundColor: colors.surfaceAlt,
    },
    dailyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    dailyLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    dailyLabelAlmost: {
      color: colors.brand,
      fontWeight: '700',
    },
    dailyXPText: {
      color: colors.textSoft,
      fontSize: 12,
      fontWeight: '700',
    },
    dailyXPDone: {
      color: colors.success,
    },
    dailyBarTrack: {
      height: 6,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 3,
      overflow: 'hidden',
    },
    dailyBarFill: {
      height: '100%',
      backgroundColor: colors.brand,
      borderRadius: 3,
    },
    dailyBarDone: {
      backgroundColor: colors.success,
    },
    dailyBarAlmost: {
      backgroundColor: colors.brand,
    },
    bossCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    bossCardDone: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.success,
    },
    bossHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    bossWeek: {
      color: colors.brand,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2,
    },
    bossDoneBadge: {
      color: colors.success,
      fontSize: 11,
      fontWeight: '700',
    },
    bossXPBadge: {
      color: colors.warning,
      fontSize: 12,
      fontWeight: '700',
    },
    bossTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 3,
    },
    bossDesc: {
      color: colors.textMuted,
      fontSize: 12,
      marginBottom: 10,
    },
    bossBarTrack: {
      height: 6,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 5,
    },
    bossBarFill: {
      height: '100%',
      backgroundColor: colors.warning,
      borderRadius: 3,
    },
    bossBarDone: {
      backgroundColor: colors.success,
    },
    bossProg: {
      color: colors.textSoft,
      fontSize: 11,
    },
    restoreCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    restoreHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    restoreTitle: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 14,
    },
    restorePrice: {
      color: colors.brand,
      fontWeight: '800',
      fontSize: 14,
    },
    restoreDesc: {
      color: colors.textMuted,
      fontSize: 12,
      marginBottom: 10,
    },
    restoreBtn: {
      backgroundColor: colors.brand,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    restoreBtnText: {
      color: colors.onBrand,
      fontWeight: '700',
      fontSize: 13,
    },
    restoreConfirmRow: {
      gap: 10,
    },
    restoreCancel: {
      color: colors.textSoft,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 6,
    },
    proNudge: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    proNudgeText: {
      color: colors.textMuted,
      fontSize: 12,
      flex: 1,
      lineHeight: 18,
    },
    proNudgeLink: {
      color: colors.brand,
      fontWeight: '700',
      fontSize: 12,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 22,
    },
    startBtn: {
      flex: 1,
      minHeight: 50,
    },
    iconBtn: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      width: 56,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconBtnText: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 13,
    },
    sectionTitle: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
      marginBottom: 12,
    },
    loadingList: {
      marginTop: 30,
    },
    empty: {
      color: colors.textSoft,
      textAlign: 'center',
      marginTop: 40,
      fontSize: 14,
      lineHeight: 22,
    },
    errorText: {
      color: colors.danger,
      textAlign: 'center',
      marginTop: 30,
      fontSize: 13,
    },
    listContent: {
      paddingBottom: 40,
    },
    loadMoreBtn: {
      alignItems: 'center',
      paddingVertical: 14,
      marginBottom: 10,
    },
    loadMoreText: {
      color: colors.brand,
      fontWeight: '600',
      fontSize: 13,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    cardDate: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 14,
    },
    xpBadge: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    xpBadgeText: {
      color: colors.brand,
      fontWeight: '700',
      fontSize: 13,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    statPill: {
      backgroundColor: colors.backgroundAlt,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      alignItems: 'center',
      minWidth: 72,
    },
    statValue: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 18,
    },
    statLabel: {
      color: colors.textSoft,
      fontSize: 11,
      marginTop: 1,
    },
    exerciseNames: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
  });
}
