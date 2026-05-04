import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions as appFunctions } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AppButton from '../components/AppButton';
import { logAnalyticsEvent } from '../utils/analytics';
import { isActivePremium } from '../utils/xpSystem';

// ─── Plan definitions ──────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'session_pack',
    badge: 'STARTER',
    title: '5-Session Boost Pack',
    subtitle: 'Try premium, no commitment',
    price: '$2.99',
    paypalAmount: '2.99',
    perks: [
      '⚡ 1.5x XP on your next 5 workouts',
      '🔥 Restore 1 lost streak',
      '📦 Never expires — use at your own pace',
    ],
  },
  {
    id: 'monthly',
    badge: 'POPULAR',
    title: 'Monthly Pro',
    subtitle: 'Best for active lifters',
    price: '$9.99 / month',
    paypalAmount: '9.99',
    perks: [
      '⚡ 1.5x XP on every workout',
      '🔥 Restore streak once per week',
      '🏅 Pro badge on your profile',
      '👑 Early access to new challenges',
    ],
  },
  {
    id: 'yearly',
    badge: 'BEST VALUE',
    title: 'Yearly Pro',
    subtitle: 'Save 33% vs monthly',
    price: '$79.99 / year',
    paypalAmount: '79.99',
    perks: [
      '⚡ 1.5x XP on every workout',
      '🔥 Restore streak twice per month',
      '🏅 Legend Pro badge',
      '👑 All future premium perks included',
      '🌌 God Mode theme (level 30 unlock)',
    ],
  },
];

const PAYPAL_BASE = 'https://paypal.me/TiniFlegar/';

export default function UpgradeScreen() {
  const { user, profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedPlanId, setSelectedPlanId] = useState(null);
  // 'select' -> 'confirm'
  const [step, setStep] = useState('select');
  const [confirming, setConfirming] = useState(false);

  const alreadyPremium = isActivePremium(profile);
  const selectedPlan = PLANS.find(p => p.id === selectedPlanId);

  useEffect(() => {
    if (!user?.uid) return;
    void logAnalyticsEvent(user.uid, 'paywall_opened', {
      isPremium: alreadyPremium,
    });
  }, [user?.uid, alreadyPremium]);

  async function handlePayWithPayPal(plan) {
    setSelectedPlanId(plan.id);
    void logAnalyticsEvent(user.uid, 'paypal_payment_started', {
      plan: plan.id,
      amount: plan.paypalAmount,
    });
    const url = `${PAYPAL_BASE}${plan.paypalAmount}`;
    await Linking.openURL(url);
    setStep('confirm');
  }

  async function handleConfirmPayment() {
    if (confirming || !selectedPlan) return;
    setConfirming(true);

    try {
      const requestVerification = httpsCallable(appFunctions, 'requestPremiumVerification');
      await requestVerification({
        planId: selectedPlan.id,
        paypalAmount: selectedPlan.paypalAmount,
      });

      void logAnalyticsEvent(user.uid, 'premium_verification_requested', {
        plan: selectedPlan.id,
        amount: selectedPlan.paypalAmount,
      });

      setStep('select');
      setSelectedPlanId(null);
      Alert.alert(
        'Verification Requested',
        'Your request was saved. Premium access will be enabled after the payment is verified by an admin.'
      );
    } catch (err) {
      console.error('handleConfirmPayment:', err);
      void logAnalyticsEvent(user.uid, 'premium_verification_failed', {
        plan: selectedPlan?.id,
        message: err.message ?? 'unknown',
      });
      Alert.alert('Error', 'Could not request verification. Check your connection and try again.');
    } finally {
      setConfirming(false);
    }
  }
  // Already premium ────────────────────────────────────────────────────────
  if (alreadyPremium) {
    const type = profile?.premiumType ?? 'pro';
    const expiry = profile?.premiumExpiry
      ? new Date(profile.premiumExpiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;
    const remaining = profile?.premiumWorkoutsRemaining ?? 0;

    return (
      <View style={styles.container}>
        <View style={styles.activeCard}>
          <Text style={styles.activeIcon}>⚡</Text>
          <Text style={styles.activeTitle}>Premium Active</Text>
          <Text style={styles.activePlan}>
            {type === 'session_pack'
              ? `${remaining} boosted workout${remaining !== 1 ? 's' : ''} remaining`
              : type === 'monthly'
                ? `Monthly · renews ${expiry ?? '—'}`
                : `Yearly · renews ${expiry ?? '—'}`}
          </Text>
          <Text style={styles.activeSub}>1.5x XP is running on every workout you save.</Text>
        </View>
      </View>
    );
  }

  // ── Confirm step ───────────────────────────────────────────────────────────
  if (step === 'confirm' && selectedPlan) {
    return (
      <View style={[styles.container, styles.confirmContainer]}>
        <Text style={styles.confirmIcon}>💸</Text>
        <Text style={styles.confirmTitle}>Complete your payment</Text>
        <Text style={styles.confirmDesc}>
          Open PayPal, pay{' '}
          <Text style={styles.confirmAmount}>{selectedPlan.price}</Text>, then
          tap the button below to request admin verification.
        </Text>
        <AppButton
          label={confirming ? 'Requesting...' : "I've paid - Request verification"}
          onPress={handleConfirmPayment}
          loading={confirming}
          style={styles.confirmBtn}
          accessibilityLabel="Request payment verification"
          accessibilityRole="button"
        />
        <Pressable
          style={styles.backLink}
          onPress={() => { setStep('select'); setSelectedPlanId(null); }}
        >
          <Text style={styles.backLinkText}>← Back to plans</Text>
        </Pressable>
        <Pressable
          style={styles.reopenLink}
          onPress={() => Linking.openURL(`${PAYPAL_BASE}${selectedPlan.paypalAmount}`)}
        >
          <Text style={styles.reopenLinkText}>Re-open PayPal</Text>
        </Pressable>
      </View>
    );
  }

  // ── Plan selection ─────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        <Text style={styles.heroBadge}>FITQUEST PREMIUM</Text>
        <Text style={styles.heroTitle}>Work harder.{'\n'}Earn more.</Text>
        <Text style={styles.heroSub}>1.5x XP on every workout. Streak restores. No tricks.</Text>
        <Text style={styles.paypalNote}>Payments via PayPal · Cancel anytime</Text>
      </View>

      {PLANS.map(plan => (
        <View key={plan.id} style={[styles.planCard, selectedPlanId === plan.id && styles.planCardSelected]}>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planBadge}>{plan.badge}</Text>
              <Text style={styles.planTitle}>{plan.title}</Text>
              <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
            </View>
            <Text style={styles.planPrice}>{plan.price}</Text>
          </View>

          <View style={styles.perkList}>
            {plan.perks.map(perk => (
              <Text key={perk} style={styles.perkItem}>{perk}</Text>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.payBtn, pressed && styles.pressedCard]}
            onPress={() => handlePayWithPayPal(plan)}
            accessibilityLabel={`Pay ${plan.price} with PayPal for ${plan.title}`}
            accessibilityRole="button"
          >
            <Text style={styles.payBtnText}>Pay with PayPal</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.legalNote}>
        Payments are processed by PayPal. After completing payment, return to
        the app and request verification. Premium is enabled only after an admin verifies the payment.
      </Text>
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 20, paddingBottom: 50 },

    // Active state
    activeCard: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 24,
    },
    activeIcon: { fontSize: 44 },
    activeTitle: { color: colors.brand, fontSize: 26, fontWeight: '800' },
    activePlan: { color: colors.text, fontSize: 15, fontWeight: '600', textAlign: 'center' },
    activeSub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

    // Confirm step
    confirmContainer: { alignItems: 'center', justifyContent: 'center', padding: 28 },
    confirmIcon: { fontSize: 48, marginBottom: 8 },
    confirmTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 10 },
    confirmDesc: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    confirmAmount: { color: colors.brand, fontWeight: '800' },
    confirmBtn: { width: '100%', marginBottom: 14 },
    backLink: { marginBottom: 10 },
    backLinkText: { color: colors.textMuted, fontSize: 13 },
    reopenLink: {},
    reopenLinkText: { color: colors.brand, fontSize: 13, fontWeight: '600' },

    // Hero
    hero: {
      alignItems: 'center',
      marginBottom: 24,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroBadge: {
      color: colors.brand,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.6,
      marginBottom: 8,
    },
    heroTitle: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '800',
      textAlign: 'center',
      lineHeight: 34,
      marginBottom: 8,
    },
    heroSub: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 8,
    },
    paypalNote: {
      color: colors.textSoft,
      fontSize: 11,
    },

    // Plan cards
    planCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    planCardSelected: {
      borderColor: colors.brand,
      backgroundColor: colors.surfaceAlt,
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    planBadge: {
      color: colors.brand,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      marginBottom: 4,
    },
    planTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    planSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    planPrice: {
      color: colors.brand,
      fontSize: 16,
      fontWeight: '800',
    },
    perkList: {
      gap: 6,
      marginBottom: 14,
    },
    perkItem: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
    payBtn: {
      backgroundColor: colors.brand,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
    },
    payBtnText: {
      color: colors.onBrand,
      fontWeight: '700',
      fontSize: 14,
    },
    pressedCard: {
      opacity: 0.88,
      transform: [{ scale: 0.98 }],
    },

    legalNote: {
      color: colors.textSoft,
      fontSize: 11,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 10,
    },
  });
}
