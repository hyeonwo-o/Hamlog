import { createContext } from 'react';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

export const THEME_STORAGE_KEY = 'hamlog:theme';

export const parseThemePreference = (value: string | null): ThemePreference => (
  value === 'light' || value === 'dark' ? value : 'system'
);

export const ThemeContext = createContext<{
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
} | null>(null);
