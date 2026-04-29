import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggleButton() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={toggleTheme}
    >
      <Text style={styles.label}>{isDark ? 'Light' : 'Dark'}</Text>
    </Pressable>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    button: {
      minWidth: 58,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      backgroundColor: colors.brandSoft,
      borderColor: colors.brand,
      transform: [{ scale: 0.98 }],
    },
    label: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
  });
}
