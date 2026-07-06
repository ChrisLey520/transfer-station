import type { Language } from './types.js';
import { en } from './i18n/en.js';
import { zhCN } from './i18n/zh-CN.js';
import { zhTW } from './i18n/zh-TW.js';

export const dictionary = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en
} satisfies Record<Language, Record<string, string>>;

export function tr(t: Record<string, string>, key: string, fallback: string) {
  return t[key] || fallback;
}
