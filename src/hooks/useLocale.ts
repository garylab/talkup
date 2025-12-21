'use client';

import { useState, useEffect, useCallback } from 'react';
import { Locale, locales, t as translate, getTopics } from '@/i18n';

const STORAGE_KEY = 'random-speech-locale';

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load locale from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && locales.includes(stored)) {
        setLocaleState(stored);
      } else {
        // Try to detect browser language
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('zh')) {
          setLocaleState('zh');
        }
      }
    } catch (e) {
      console.error('Failed to load locale:', e);
    }
    setIsLoaded(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch (e) {
      console.error('Failed to save locale:', e);
    }
  }, []);

  const t = useCallback((key: string): string => {
    return translate(locale, key);
  }, [locale]);

  const topics = getTopics(locale);

  return {
    locale,
    setLocale,
    isLoaded,
    t,
    topics,
  };
}

