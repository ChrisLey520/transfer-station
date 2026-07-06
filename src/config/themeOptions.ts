import { Monitor, Moon, Sun } from 'lucide-react';

export const themeModeOptions = [
  { id: 'system' as const, labelKey: 'systemMode', icon: Monitor },
  { id: 'light' as const, labelKey: 'lightMode', icon: Sun },
  { id: 'dark' as const, labelKey: 'darkMode', icon: Moon }
];

export const accentThemeOptions = [
  { id: 'sun-gold' as const, labelKey: 'sunGold' },
  { id: 'rose-pink' as const, labelKey: 'rosePink' },
  { id: 'pine-green' as const, labelKey: 'pineGreen' },
  { id: 'violet' as const, labelKey: 'violet' },
  { id: 'bay-blue' as const, labelKey: 'bayBlue' }
];
