import en from './locales/en.json';
import zh from './locales/zh.json';
import topicsEn from '@/data/topics-en.json';
import topicsZh from '@/data/topics-zh.json';

export type Locale = 'en' | 'zh';

export const locales: Locale[] = ['en', 'zh'];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
};

const translations: Record<Locale, typeof en> = {
  en,
  zh,
};

const topicsMap: Record<Locale, string[]> = {
  en: topicsEn.topics,
  zh: topicsZh.topics,
};

export function getTranslations(locale: Locale) {
  return translations[locale];
}

export function getTopics(locale: Locale): string[] {
  return topicsMap[locale];
}

export function t(locale: Locale, key: string): string {
  const keys = key.split('.');
  let value: unknown = translations[locale];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }
  
  return typeof value === 'string' ? value : key;
}

