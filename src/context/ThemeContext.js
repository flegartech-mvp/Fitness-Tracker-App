import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@fitquest_theme';
const BRAND = '#75b183';

const lightColors = {
  brand: BRAND,
  brandStrong: '#5f9970',
  brandSoft: '#d8eadc',
  background: '#f4f8f4',
  backgroundAlt: '#e8f1ea',
  surface: '#ffffff',
  surfaceAlt: '#edf5ee',
  surfaceMuted: '#dce9df',
  card: '#ffffff',
  text: '#173126',
  textMuted: '#50695a',
  textSoft: '#789081',
  border: '#c8d8cc',
  borderStrong: '#aac0b0',
  onBrand: '#ffffff',
  success: '#4f9964',
  warning: '#b68a3a',
  danger: '#c75e5e',
  shadow: 'rgba(17, 33, 24, 0.08)',
  pressed: 'rgba(23, 49, 38, 0.08)',
};

const darkColors = {
  brand: BRAND,
  brandStrong: '#8cc698',
  brandSoft: '#183224',
  background: '#08110c',
  backgroundAlt: '#0d1712',
  surface: '#111d17',
  surfaceAlt: '#172720',
  surfaceMuted: '#20342a',
  card: '#101b16',
  text: '#eef5f0',
  textMuted: '#b1c4b7',
  textSoft: '#748a7c',
  border: '#23392d',
  borderStrong: '#355342',
  onBrand: '#08110c',
  success: '#5aa56e',
  warning: '#d4a04d',
  danger: '#e07b7b',
  shadow: 'rgba(0, 0, 0, 0.22)',
  pressed: 'rgba(255, 255, 255, 0.06)',
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState(systemScheme === 'light' ? 'light' : 'dark');
  const [loaded, setLoaded] = useState(false);

  // Load persisted theme on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(saved => {
      if (saved === 'light' || saved === 'dark') {
        setMode(saved);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const value = useMemo(() => {
    const isDark = mode === 'dark';
    const colors = isDark ? darkColors : lightColors;
    const navigationTheme = {
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        primary: colors.brand,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.brand,
      },
    };

    return {
      mode,
      isDark,
      colors,
      loaded,
      statusBarStyle: isDark ? 'light' : 'dark',
      navigationTheme,
      toggleTheme: () => {
        setMode(current => {
          const next = current === 'dark' ? 'light' : 'dark';
          AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
          return next;
        });
      },
    };
  }, [mode, loaded]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
