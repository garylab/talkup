'use client';

import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { RecordingType } from '@/types';

export interface AppSettings {
  recordMode: RecordingType;
  selectedAudioDevice: string;
  selectedVideoDevice: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  recordMode: 'video',
  selectedAudioDevice: '',
  selectedVideoDevice: '',
};

export function useSettings() {
  const [settings, setSettings] = useLocalStorage<AppSettings>('talkup-settings', DEFAULT_SETTINGS);

  const setRecordMode = useCallback((mode: RecordingType) => {
    setSettings((prev) => ({ ...prev, recordMode: mode }));
  }, [setSettings]);

  const setSelectedAudioDevice = useCallback((deviceId: string) => {
    setSettings((prev) => ({ ...prev, selectedAudioDevice: deviceId }));
  }, [setSettings]);

  const setSelectedVideoDevice = useCallback((deviceId: string) => {
    setSettings((prev) => ({ ...prev, selectedVideoDevice: deviceId }));
  }, [setSettings]);

  return {
    settings,
    setRecordMode,
    setSelectedAudioDevice,
    setSelectedVideoDevice,
  };
}

// Re-export for convenience
export type { AppSettings };
