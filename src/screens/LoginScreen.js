import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AppButton from '../components/AppButton';
import ThemeToggleButton from '../components/ThemeToggleButton';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      Alert.alert('Login Failed', friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.toggleWrap}>
        <ThemeToggleButton />
      </View>

      <View style={styles.header}>
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>FITQUEST</Text>
        </View>
        <Text style={styles.logo}>FitQuest</Text>
        <Text style={styles.tagline}>Train consistently. Level up daily.</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Welcome back</Text>
        <Text style={styles.formSubtitle}>Sign in and keep the streak moving.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textSoft}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textSoft}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <AppButton
          label={loading ? 'Logging in...' : 'Log In'}
          onPress={handleLogin}
          loading={loading}
          style={styles.button}
        />

        <Pressable
          onPress={() => navigation.navigate('Register')}
          style={({ pressed }) => [styles.linkWrap, pressed && styles.linkPressed]}
        >
          <Text style={styles.link}>
            Don't have an account? <Text style={styles.linkAccent}>Sign Up</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function friendlyError(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    toggleWrap: {
      position: 'absolute',
      top: 58,
      right: 24,
      zIndex: 2,
    },
    header: {
      alignItems: 'center',
      marginBottom: 28,
    },
    brandBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 18,
    },
    brandBadgeText: {
      color: colors.brand,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.4,
    },
    logo: {
      fontSize: 38,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.5,
    },
    tagline: {
      color: colors.textMuted,
      fontSize: 14,
      marginTop: 8,
    },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 22,
      gap: 14,
      shadowColor: colors.brand,
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    formTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
    },
    formSubtitle: {
      color: colors.textMuted,
      fontSize: 13,
      marginBottom: 2,
    },
    input: {
      backgroundColor: colors.backgroundAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.text,
      fontSize: 15,
    },
    button: {
      marginTop: 4,
    },
    link: {
      color: colors.textMuted,
      textAlign: 'center',
      fontSize: 13,
    },
    linkWrap: {
      marginTop: 8,
      alignSelf: 'center',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 8,
    },
    linkPressed: {
      opacity: 0.75,
    },
    linkAccent: {
      color: colors.brand,
      fontWeight: '700',
    },
  });
}
