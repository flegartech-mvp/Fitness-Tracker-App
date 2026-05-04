import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { httpsCallable } from 'firebase/functions';
import { functions as appFunctions } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AppButton from '../components/AppButton';
import {
  calcSetXP,
  DAILY_XP_GOAL,
  PR_BONUS_XP,
  PREMIUM_XP_MULTIPLIER,
  STREAK_BONUS_XP,
} from '../utils/xpSystem';
import { logAnalyticsEvent } from '../utils/analytics';

function normalizeExercises(exercises) {
  return exercises.map(exercise => ({
    name: String(exercise.name ?? '').trim(),
    sets: (exercise.sets ?? []).map(set => ({
      reps: Number(set.reps),
      weight: Number(set.weight),
    })),
  }));
}

function combineExercises(exercises) {
  const order = [];
  const grouped = new Map();

  exercises.forEach(exercise => {
    const name = String(exercise.name ?? '').trim();
    const key = name.toLowerCase();
    if (!grouped.has(key)) {
      grouped.set(key, { name, sets: [...(exercise.sets ?? [])] });
      order.push(key);
      return;
    }

    grouped.get(key).sets.push(...(exercise.sets ?? []));
  });

  return order.map(key => grouped.get(key));
}

function hasInvalidExercise(exercises) {
  return exercises.some(exercise =>
    !exercise.name ||
    exercise.sets.length === 0 ||
    exercise.sets.some(set =>
      !Number.isFinite(set.reps) ||
      set.reps <= 0 ||
      !Number.isFinite(set.weight) ||
      set.weight < 0
    )
  );
}

export default function WorkoutScreen({ navigation }) {
  const { user, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [exercises, setExercises] = useState([]);
  const [draftName, setDraftName] = useState('');
  const [draftSets, setDraftSets] = useState([]);
  const [repsInput, setRepsInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    void logAnalyticsEvent(user.uid, 'screen_view', { screen: 'workout' });
  }, [user?.uid]);

  function addSetToDraft() {
    const reps = parseInt(repsInput, 10);
    const weight = parseFloat(weightInput);

    if (!reps || reps <= 0 || Number.isNaN(weight) || weight < 0) {
      Alert.alert('Invalid Input', 'Enter valid reps and weight (0 for bodyweight).');
      return;
    }

    setDraftSets(prev => [...prev, { reps, weight }]);
    setRepsInput('');
    setWeightInput('');
  }

  function removeDraftSet(index) {
    setDraftSets(prev => prev.filter((_, currentIndex) => currentIndex !== index));
  }

  function commitExercise() {
    if (!draftName.trim()) {
      Alert.alert('Missing Name', 'Enter the exercise name.');
      return;
    }
    if (draftSets.length === 0) {
      Alert.alert('No Sets', 'Add at least one set.');
      return;
    }

    const duplicateIndex = exercises.findIndex(
      exercise => exercise.name.trim().toLowerCase() === draftName.trim().toLowerCase()
    );
    if (duplicateIndex >= 0) {
      setExercises(prev => prev.map((exercise, index) => (
        index === duplicateIndex
          ? { ...exercise, sets: [...exercise.sets, ...draftSets] }
          : exercise
      )));
      Alert.alert('Merged Exercise', 'Those sets were added to your existing exercise instead of creating a duplicate.');
      setDraftName('');
      setDraftSets([]);
      setRepsInput('');
      setWeightInput('');
      return;
    }

    setExercises(prev => [...prev, { name: draftName.trim(), sets: draftSets }]);
    setDraftName('');
    setDraftSets([]);
    setRepsInput('');
    setWeightInput('');
  }

  function repeatLastExercise() {
    if (saving || exercises.length === 0) return;
    if (draftName.trim() || draftSets.length > 0 || repsInput.trim() || weightInput.trim()) {
      Alert.alert('Finish Your Draft', 'Save or clear the current draft before repeating the last exercise.');
      return;
    }

    const lastExercise = exercises[exercises.length - 1];
    setDraftName(lastExercise.name);
    setDraftSets(lastExercise.sets.map(set => ({ ...set })));
    void logAnalyticsEvent(user?.uid, 'workout_repeat_last_exercise', {
      exercise: lastExercise.name,
      sets: lastExercise.sets.length,
    });
  }

  function removeExercise(index) {
    setExercises(prev => prev.filter((_, currentIndex) => currentIndex !== index));
  }

  async function saveWorkout() {
    if (saving) return;

    if (!user?.uid) {
      Alert.alert('Not Ready Yet', 'Your account is still loading. Try again in a second.');
      return;
    }

    const hasPendingSetInput = repsInput.trim().length > 0 || weightInput.trim().length > 0;
    if (hasPendingSetInput) {
      Alert.alert('Finish This Set', 'Add or clear the reps and weight you are currently typing before saving.');
      return;
    }

    if ((draftName.trim() && draftSets.length === 0) || (!draftName.trim() && draftSets.length > 0)) {
      Alert.alert('Finish This Exercise', 'Complete the draft exercise or tap "Add Another Exercise" before saving.');
      return;
    }

    const allExercises = [...exercises];
    if (draftName.trim() && draftSets.length > 0) {
      allExercises.push({ name: draftName.trim(), sets: draftSets });
    }

    if (allExercises.length === 0) {
      Alert.alert('Empty Workout', 'Add at least one exercise with sets.');
      return;
    }

    const normalizedExercises = combineExercises(normalizeExercises(allExercises));
    if (hasInvalidExercise(normalizedExercises)) {
      Alert.alert('Invalid Workout', 'Each exercise needs a name, at least one valid set, positive reps, and non-negative weight.');
      return;
    }

    setSaving(true);

    try {
      const saveWorkoutFn = httpsCallable(appFunctions, 'saveWorkout');
      const { data: txResult } = await saveWorkoutFn({ exercises: normalizedExercises });

      const {
        finalEarnedXP, newStreak, streakBonus, prCount, prExercises,
        usedFreeze, earnedFreeze, bossCompleted, challenge,
        didLevelUp, newLevel, currentLevel, newTotalXP,
        dailyGoalHit, newDailyXP,
        newAchievements, newAchievementIds,
        premiumBoosted, xpMultiplier,
        newRewardUnlocked, levelReward,
      } = txResult;

      await refreshProfile();

      setExercises([]);
      setDraftName('');
      setDraftSets([]);
      setRepsInput('');
      setWeightInput('');

      void logAnalyticsEvent(user.uid, 'workout_logged', {
        exercises: normalizedExercises.length,
        sets: normalizedExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
        xpEarned: finalEarnedXP,
        prs: prCount,
        streak: newStreak,
        bossCompleted,
        levelUp: didLevelUp,
        achievementsUnlocked: newAchievementIds.length,
        premiumBoosted,
        xpMultiplier,
      });
      if (didLevelUp) {
        void logAnalyticsEvent(user.uid, 'level_up', {
          fromLevel: currentLevel,
          toLevel: newLevel,
          totalXP: newTotalXP,
        });
      }
      if (bossCompleted) {
        void logAnalyticsEvent(user.uid, 'boss_completed', {
          title: challenge.title,
          xpReward: challenge.xpReward,
        });
      }
      if (usedFreeze) {
        void logAnalyticsEvent(user.uid, 'streak_freeze_used', {
          streakKept: newStreak,
        });
      }
      if (earnedFreeze) {
        void logAnalyticsEvent(user.uid, 'streak_freeze_earned', {
          streak: newStreak,
        });
      }
      if (dailyGoalHit) {
        void logAnalyticsEvent(user.uid, 'daily_goal_hit', {
          dailyXP: newDailyXP,
        });
      }
      newAchievements.forEach(achievement => {
        void logAnalyticsEvent(user.uid, 'achievement_unlocked', {
          achievementId: achievement.id,
          title: achievement.title,
        });
      });

      const lines = [
        `+${finalEarnedXP} XP earned${premiumBoosted ? ` (${PREMIUM_XP_MULTIPLIER}x boost)` : ''}`,
        `${normalizedExercises.length} exercises | ${normalizedExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)} sets`,
      ];
      if (premiumBoosted) lines.push('Premium XP boost active');
      if (prExercises.length > 0) lines.push(`PR: ${prExercises.join(', ')}`);
      if (streakBonus > 0) lines.push(`Streak bonus +${STREAK_BONUS_XP} XP (${newStreak} days)`);
      if (usedFreeze) lines.push('Streak freeze used. Streak saved.');
      if (earnedFreeze) lines.push('New streak freeze earned.');
      if (dailyGoalHit) lines.push(`Daily goal hit (${DAILY_XP_GOAL} XP).`);
      if (bossCompleted) lines.push(`Boss defeated +${challenge.xpReward} XP`);

      if (newAchievements.length > 0) {
        lines.push('');
        lines.push(`Achievement${newAchievements.length > 1 ? 's' : ''} unlocked:`);
        newAchievements.forEach(achievement => {
          lines.push(`${achievement.icon} ${achievement.title}`);
        });
      }

      const afterSave = () => {
        if (newRewardUnlocked && levelReward) {
          Alert.alert(
            `${levelReward.icon} ${levelReward.title}`,
            levelReward.desc,
            [{ text: 'Claim it', onPress: () => navigation.goBack() }]
          );
          return;
        }
        navigation.goBack();
      };

      if (didLevelUp || bossCompleted || newAchievements.length > 0) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      Alert.alert(
        didLevelUp ? `Level ${newLevel}!` : 'Workout Saved!',
        lines.join('\n'),
        [{ text: didLevelUp ? "Let's go" : 'Nice', onPress: afterSave }]
      );
    } catch (err) {
      console.error('saveWorkout:', err);
      void logAnalyticsEvent(user.uid, 'workout_save_failed', {
        message: err.message ?? 'unknown_error',
      });
      Alert.alert('Error', err.message || 'Could not save workout. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }
  const previewExercises = useMemo(
    () => (
      draftName.trim() && draftSets.length > 0
        ? [...exercises, { name: draftName.trim(), sets: draftSets }]
        : exercises
    ),
    [draftName, draftSets, exercises]
  );

  const xpPreview = useMemo(
    () => previewExercises.reduce(
      (sum, exercise) => sum + exercise.sets.reduce((setSum, set) => setSum + calcSetXP(set.reps, set.weight), 0),
      0
    ),
    [previewExercises]
  );

  const setsPreview = useMemo(
    () => previewExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
    [previewExercises]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        {exercises.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Exercises Added</Text>
            {exercises.map((exercise, index) => (
              <ExerciseSummaryCard
                key={`${exercise.name}-${index}`}
                exercise={exercise}
                disabled={saving}
                onRemove={() => removeExercise(index)}
                styles={styles}
              />
            ))}
          </>
        )}

        {exercises.length > 0 && (
          <AppButton
            label="Repeat Last Exercise"
            onPress={repeatLastExercise}
            variant="secondary"
            size="sm"
            style={styles.repeatBtn}
          />
        )}

        <Text style={styles.sectionLabel}>
          {exercises.length === 0 ? 'Exercise 1' : `Exercise ${exercises.length + 1}`}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Exercise name (e.g. Bench Press)"
          placeholderTextColor={colors.textSoft}
          value={draftName}
          onChangeText={setDraftName}
          editable={!saving}
        />

        <Text style={styles.subLabel}>Add Set</Text>
        <View style={styles.setRow}>
          <TextInput
            style={[styles.input, styles.setInput]}
            placeholder="Reps"
            placeholderTextColor={colors.textSoft}
            keyboardType="numeric"
            value={repsInput}
            onChangeText={setRepsInput}
            editable={!saving}
          />
          <TextInput
            style={[styles.input, styles.setInput]}
            placeholder="Weight (kg)"
            placeholderTextColor={colors.textSoft}
            keyboardType="numeric"
            value={weightInput}
            onChangeText={setWeightInput}
            editable={!saving}
          />
          <Pressable
            style={({ pressed }) => [
              styles.addSetBtn,
              pressed && !saving && styles.pressedBtn,
              saving && styles.disabledBtn,
            ]}
            onPress={addSetToDraft}
            disabled={saving}
            accessibilityLabel="Add set"
            accessibilityRole="button"
          >
            <Text style={styles.addSetBtnText}>+</Text>
          </Pressable>
        </View>

        {draftSets.length > 0 && (
          <View style={styles.draftSetsList}>
            {draftSets.map((set, index) => (
              <View key={`${set.reps}-${set.weight}-${index}`} style={styles.setChip}>
                <Text style={styles.setChipText}>
                  Set {index + 1}: {set.reps} reps @ {set.weight} kg
                  {'  '}
                  <Text style={styles.setChipXP}>+{calcSetXP(set.reps, set.weight)} XP</Text>
                </Text>
                <Pressable
                  onPress={() => removeDraftSet(index)}
                  disabled={saving}
                  style={({ pressed }) => pressed && !saving && styles.inlinePress}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.chipRemove}>X</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.addExBtn,
            pressed && !saving && styles.pressedCard,
            saving && styles.disabledBtn,
          ]}
          onPress={commitExercise}
          disabled={saving}
        >
          <Text style={styles.addExBtnText}>+ Add Another Exercise</Text>
        </Pressable>

        {(exercises.length > 0 || draftSets.length > 0) && (
          <View style={styles.summaryCard}>
            <SummaryRow label="Exercises" value={previewExercises.length} styles={styles} />
            <SummaryRow label="Total Sets" value={setsPreview} styles={styles} />
            <SummaryRow label="XP to earn" value={`+${xpPreview}`} accent styles={styles} />
            <View style={styles.bonusHint}>
              <Text style={styles.bonusHintText}>
                PR sets earn +{PR_BONUS_XP} bonus XP per exercise
              </Text>
              <Text style={styles.bonusHintText}>
                3-day streak earns +{STREAK_BONUS_XP} bonus XP
              </Text>
            </View>
          </View>
        )}

        <AppButton
          label={saving ? 'Saving...' : 'Save Workout'}
          onPress={saveWorkout}
          loading={saving}
          style={styles.saveBtn}
          accessibilityLabel="Save workout"
          accessibilityRole="button"
        />
        {saving && (
          <Text style={styles.saveStatus}>
            Saving workout, streak progress, and boss updates...
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ExerciseSummaryCard({ exercise, onRemove, disabled, styles }) {
  return (
    <View style={styles.exCard}>
      <View style={styles.exCardHeader}>
        <Text style={styles.exCardName}>{exercise.name}</Text>
        <Pressable
          onPress={onRemove}
          disabled={disabled}
          style={({ pressed }) => pressed && !disabled && styles.inlinePress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.exCardRemove}>X</Text>
        </Pressable>
      </View>
      <Text style={styles.exCardMeta}>
        {exercise.sets.length} set{exercise.sets.length > 1 ? 's' : ''}
        {'  '}|{'  '}
        {exercise.sets.map(set => `${set.reps}x${set.weight}kg`).join('  ')}
      </Text>
    </View>
  );
}

function SummaryRow({ label, value, accent, styles }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryVal, accent && styles.summaryValAccent]}>{value}</Text>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 20, paddingBottom: 60 },
    sectionLabel: {
      color: colors.textSoft,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginTop: 24,
      marginBottom: 10,
    },
    subLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 14,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.text,
      fontSize: 15,
      marginBottom: 4,
    },
    setRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    setInput: { flex: 1, marginBottom: 0 },
    pressedBtn: {
      backgroundColor: colors.brandStrong,
    },
    pressedCard: {
      opacity: 0.92,
      transform: [{ scale: 0.985 }],
    },
    inlinePress: {
      opacity: 0.65,
    },
    disabledBtn: {
      opacity: 0.55,
    },
    addSetBtn: {
      backgroundColor: colors.brand,
      width: 50,
      height: 50,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addSetBtnText: { color: colors.onBrand, fontSize: 22, fontWeight: '700', lineHeight: 26 },
    draftSetsList: { marginTop: 10, gap: 6 },
    setChip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    setChipText: { color: colors.textMuted, fontSize: 14, flex: 1, paddingRight: 8 },
    setChipXP: { color: colors.brand, fontWeight: '600' },
    chipRemove: { color: colors.textSoft, fontSize: 13 },
    addExBtn: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderStyle: 'dashed',
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 18,
      backgroundColor: colors.surfaceAlt,
    },
    addExBtnText: { color: colors.brand, fontWeight: '700', fontSize: 14 },
    repeatBtn: {
      alignSelf: 'flex-start',
      marginTop: 4,
      marginBottom: 8,
    },
    exCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    exCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    exCardName: { color: colors.text, fontWeight: '700', fontSize: 15 },
    exCardRemove: { color: colors.textSoft, fontSize: 14 },
    exCardMeta: { color: colors.textMuted, fontSize: 12 },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginTop: 22,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    summaryLabel: { color: colors.textMuted, fontSize: 13 },
    summaryVal: { color: colors.text, fontWeight: '700', fontSize: 13 },
    summaryValAccent: { color: colors.brand },
    bonusHint: { paddingHorizontal: 18, paddingVertical: 12, gap: 4 },
    bonusHintText: { color: colors.textSoft, fontSize: 11 },
    saveBtn: {
      marginTop: 24,
    },
    saveStatus: {
      color: colors.textSoft,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 10,
    },
  });
}
