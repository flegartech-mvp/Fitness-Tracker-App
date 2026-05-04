import React, { useEffect, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { logAnalyticsEvent } from '../utils/analytics';
import { ACHIEVEMENTS, getAchievementProgress } from '../utils/achievements';

export default function AchievementsScreen() {
  const { user, profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const unlocked = new Set(profile?.achievements ?? []);
  const stats = {
    totalWorkouts: profile?.totalWorkouts ?? 0,
    streak: profile?.streak ?? 0,
    totalVolume: profile?.totalVolume ?? 0,
    level: profile?.level ?? 0,
    totalPRs: profile?.totalPRs ?? 0,
  };

  const sorted = [
    ...ACHIEVEMENTS.filter(item => unlocked.has(item.id)),
    ...ACHIEVEMENTS.filter(item => !unlocked.has(item.id)),
  ];

  useEffect(() => {
    if (!user?.uid) return;
    void logAnalyticsEvent(user.uid, 'screen_view', { screen: 'achievements' });
  }, [user?.uid]);

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>
        {unlocked.size} / {ACHIEVEMENTS.length} unlocked
      </Text>

      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <AchievementCard
            achievement={item}
            unlocked={unlocked.has(item.id)}
            progress={getAchievementProgress(item, stats)}
            styles={styles}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function AchievementCard({ achievement, unlocked, progress, styles }) {
  return (
    <View style={[styles.card, !unlocked && styles.cardLocked]}>
      <Text style={styles.icon}>{achievement.icon}</Text>
      <View style={styles.cardText}>
        <Text style={[styles.title, !unlocked && styles.titleLocked]}>
          {achievement.title}
        </Text>
        <Text style={styles.desc}>{achievement.desc}</Text>
        {!unlocked && (
          <>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress.progress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {Math.min(progress.current, progress.goal)} / {progress.goal}
            </Text>
          </>
        )}
      </View>
      {unlocked && (
        <View style={styles.checkBadge}>
          <Text style={styles.check}>DONE</Text>
        </View>
      )}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      marginBottom: 16,
      textAlign: 'center',
    },
    listContent: {
      paddingBottom: 40,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardLocked: {
      opacity: 0.9,
    },
    icon: {
      width: 46,
      fontSize: 28,
      textAlign: 'center',
    },
    cardText: {
      flex: 1,
    },
    title: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 15,
      marginBottom: 3,
    },
    titleLocked: {
      color: colors.text,
    },
    desc: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 8,
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.brand,
    },
    progressText: {
      color: colors.textSoft,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 6,
    },
    checkBadge: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 20,
      minWidth: 48,
      height: 28,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: 10,
    },
    check: {
      color: colors.success,
      fontWeight: '800',
      fontSize: 11,
    },
  });
}
