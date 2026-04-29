import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function AppButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  style,
  textStyle,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        pressed && !inactive && styles[`pressed_${variant}`],
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onBrand : colors.brand} />
      ) : (
        <Text
          style={[
            styles.label,
            styles[`label_${variant}`],
            styles[`labelSize_${size}`],
            textStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    base: {
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    primary: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    secondary: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.borderStrong,
    },
    ghost: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    pressed_primary: {
      backgroundColor: colors.brandStrong,
      borderColor: colors.brandStrong,
    },
    pressed_secondary: {
      backgroundColor: colors.brandSoft,
      borderColor: colors.brand,
    },
    pressed_ghost: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.borderStrong,
    },
    size_sm: {
      minHeight: 38,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    size_md: {
      minHeight: 52,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    label: {
      fontWeight: '700',
      textAlign: 'center',
    },
    label_primary: {
      color: colors.onBrand,
    },
    label_secondary: {
      color: colors.brand,
    },
    label_ghost: {
      color: colors.text,
    },
    labelSize_sm: {
      fontSize: 13,
    },
    labelSize_md: {
      fontSize: 16,
    },
    pressed: {
      opacity: 0.96,
      transform: [{ scale: 0.985 }],
    },
    disabled: {
      opacity: 0.55,
    },
  });
}
