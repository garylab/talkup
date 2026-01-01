'use client';

import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { RecordingType } from '@/types';

export interface AppSettings {
  recordMode: RecordingType;
  newsCount: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  recordMode: 'audio',
  newsCount: 5,
};

export function useSettings() {
  const [settings, setSettings] = useLocalStorage<AppSettings>('talkup-settings', DEFAULT_SETTINGS);

  const setRecordMode = useCallback((mode: RecordingType) => {
    setSettings((prev) => ({ ...prev, recordMode: mode }));
  }, [setSettings]);

  const setNewsCount = useCallback((count: number) => {
    const validCount = Math.min(10, Math.max(1, count));
    setSettings((prev) => ({ ...prev, newsCount: validCount }));
  }, [setSettings]);

  return {
    settings,
    setRecordMode,
    setNewsCount,
  };
}
