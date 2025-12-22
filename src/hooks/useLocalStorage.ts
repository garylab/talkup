'use client';

import { useState, useEffect, useCallback } from 'react';
import { saveBlob, deleteBlob } from '@/lib/indexedDB';
import { uuid7 } from '@/lib/utils';

// Generic localStorage hook - hydration safe
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Always start with initialValue to avoid hydration mismatch
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Read from localStorage after mount (client-side only)
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
    setIsHydrated(true);
  }, [key]);

  // Write to localStorage when value changes (but only after hydration)
  useEffect(() => {
    if (!isHydrated) return;

    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue, isHydrated]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue((prev) => {
      const newValue = value instanceof Function ? value(prev) : value;
      return newValue;
    });
  }, []);

  return [storedValue, setValue];
}

// ============ Recording Types & Hook ============

export interface LocalRecording {
  id: string;
  topic: string | null;
  type: 'video' | 'audio';
  format: 'mp4' | 'webm';
  duration: number;
  size: number;
  createdAt: string;
}

export interface AddRecordingInput {
  topic: string | null;
  type: 'video' | 'audio';
  format: 'mp4' | 'webm';
  duration: number;
  blob: Blob;
}

export function useLocalRecordings() {
  const [recordings, setRecordings] = useLocalStorage<LocalRecording[]>('talkup-recordings', []);

  const addRecording = useCallback(async (input: AddRecordingInput) => {
    const id = uuid7();
    
    // Save blob to IndexedDB
    await saveBlob(id, input.blob);
    
    const newRecording: LocalRecording = {
      id,
      topic: input.topic,
      type: input.type,
      format: input.format,
      duration: input.duration,
      size: input.blob.size,
      createdAt: new Date().toISOString(),
    };
    
    setRecordings((prev) => [newRecording, ...prev]);
    return newRecording;
  }, [setRecordings]);

  const removeRecording = useCallback(async (id: string) => {
    // Delete blob from IndexedDB
    await deleteBlob(id);
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  }, [setRecordings]);

  return {
    recordings,
    addRecording,
    removeRecording,
  };
}
