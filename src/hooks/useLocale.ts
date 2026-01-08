'use client';

import { useLocalStorage } from './useLocalStorage';
import type { Locale } from '@/i18n';

export function useLocale(defaultLocale: Locale) {
  const [locale, setLocale, isHydrated] = useLocalStorage<Locale>('talkup-locale', defaultLocale);
  return { locale, setLocale, isHydrated } as const;
}
