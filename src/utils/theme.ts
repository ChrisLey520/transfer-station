import { AccentTheme, ThemeMode } from '../types.js';

export function readThemeMode(): ThemeMode {
  const value = localStorage.getItem('themeMode');
  return value === 'system' || value === 'light' || value === 'dark' ? value : 'system';
}

export function readAccentTheme(): AccentTheme {
  const value = localStorage.getItem('accentTheme');
  if (
    value === 'sun-gold' ||
    value === 'rose-pink' ||
    value === 'pine-green' ||
    value === 'violet' ||
    value === 'bay-blue'
  ) {
    return value;
  }
  return 'sun-gold';
}

export function getBrowserThemeMode(): Exclude<ThemeMode, 'system'> {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveThemeMode(themeMode: ThemeMode): Exclude<ThemeMode, 'system'> {
  return themeMode === 'system' ? getBrowserThemeMode() : themeMode;
}
