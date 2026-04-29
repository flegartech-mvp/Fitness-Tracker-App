import React, { useMemo, useState } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AppButton from '../components/AppButton';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!displayName || !email || !password || !confirm) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password, displayName.trim());
    } catch (err) {
      Alert.alert('Registration Failed', friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Create your profile</Text>
          <Text style={styles.title}>Start your next level</Text>
          <Text style={styles.subtitle}>
            Set up the account and we will drop you straight into the workout flow.
          </Text>
        </View>

        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            placeholder="Display Name"
            placeholderTextColor={colors.textSoft}
            value={displayName}
            onChangeText={setDisplayName}
          />
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
            placeholder="Password (min 6 chars)"
            placeholderTextColor={colors.textSoft}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={colors.textSoft}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
          />

          <AppButton
            label={loading ? 'Creating account...' : 'Sign Up'}
            onPress={handleRegister}
            loading={loading}
            style={styles.button}
          />

          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.linkWrap, pressed && styles.linkPressed]}
          >
            <Text style={styles.link}>
              Already have an account? <Text style={styles.linkAccent}>Log In</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function friendlyError(code) {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 40,
      gap: 20,
    },
    hero: {
      marginBottom: 10,
    },
    eyebrow: {
      color: colors.brand,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.4,
      marginBottom: 10,
    },
    title: {
      fontSize: 30,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 6,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      maxWidth: 320,
    },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 22,
      gap: 14,
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
