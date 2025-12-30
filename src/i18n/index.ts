import en from './locales/en.json';
import zh from './locales/zh.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import pt from './locales/pt.json';

import topicsEn from '@/data/topics-en.json';
import topicsZh from '@/data/topics-zh.json';
import topicsEs from '@/data/topics-es.json';
import topicsFr from '@/data/topics-fr.json';
import topicsDe from '@/data/topics-de.json';
import topicsJa from '@/data/topics-ja.json';
import topicsPt from '@/data/topics-pt.json';

export type Locale = 'en' | 'zh' | 'es' | 'fr' | 'de' | 'ja' | 'pt';

export const locales: Locale[] = ['en', 'zh', 'es', 'fr', 'de', 'ja', 'pt'];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  pt: 'Português',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  zh: '🇨🇳',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  ja: '🇯🇵',
  pt: '🇧🇷',
};

const translations: Record<Locale, typeof en> = {
  en,
  zh,
  es,
  fr,
  de,
  ja,
  pt,
};

const topicsMap: Record<Locale, string[]> = {
  en: topicsEn.topics,
  zh: topicsZh.topics,
  es: topicsEs.topics,
  fr: topicsFr.topics,
  de: topicsDe.topics,
  ja: topicsJa.topics,
  pt: topicsPt.topics,
};

export function getTranslations(locale: Locale) {
  return translations[locale];
}

export function getTopics(locale: Locale): string[] {
  return topicsMap[locale];
}

export function getEnglishTopics(): string[] {
  return topicsEn.topics;
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
