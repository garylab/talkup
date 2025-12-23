'use client';

import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { RecordingType } from '@/types';

export interface AppSettings {
  recordMode: RecordingType;
}

const DEFAULT_SETTINGS: AppSettings = {
  recordMode: 'audio',
};

export function useSettings() {
  const [settings, setSettings] = useLocalStorage<AppSettings>('talkup-settings', DEFAULT_SETTINGS);

  const setRecordMode = useCallback((mode: RecordingType) => {
    setSettings((prev) => ({ ...prev, recordMode: mode }));
  }, [setSettings]);

  return {
    settings,
    setRecordMode,
  };
}
