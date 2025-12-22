'use client';

import { useState, useEffect, useCallback } from 'react';
import { saveBlob, deleteBlob } from '@/lib/indexedDB';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Get initial value from localStorage or use provided initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update localStorage when value changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue((prev) => {
      const newValue = value instanceof Function ? value(prev) : value;
      return newValue;
    });
  }, []);

  return [storedValue, setValue];
}

// Local recording storage for offline support
export interface LocalRecording {
  id: string;
  title: string;
  topic: string | null;
  topicCategory: string | null;
  type: 'video' | 'audio';
  format: 'mp4' | 'webm';
  duration: number;
  createdAt: string;
  synced: boolean;
}

// Input type for adding recordings (includes blob)
export interface AddRecordingInput {
  title: string;
  topic: string | null;
  topicCategory: string | null;
  type: 'video' | 'audio';
  format: 'mp4' | 'webm';
  duration: number;
  blob: Blob;
}

export function useLocalRecordings() {
  const [recordings, setRecordings] = useLocalStorage<LocalRecording[]>('random-speech-recordings', []);

  const addRecording = useCallback(async (input: AddRecordingInput) => {
    const id = crypto.randomUUID();
    
    // Save blob to IndexedDB
    await saveBlob(id, input.blob);
    
    const newRecording: LocalRecording = {
      id,
      title: input.title,
      topic: input.topic,
      topicCategory: input.topicCategory,
      type: input.type,
      format: input.format,
      duration: input.duration,
      createdAt: new Date().toISOString(),
      synced: false,
    };
    
    setRecordings((prev) => [newRecording, ...prev]);
    return newRecording;
  }, [setRecordings]);

  const removeRecording = useCallback(async (id: string) => {
    // Delete blob from IndexedDB
    await deleteBlob(id);
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  }, [setRecordings]);

  const markAsSynced = useCallback((id: string) => {
    setRecordings((prev) =>
      prev.map((r) => (r.id === id ? { ...r, synced: true } : r))
    );
  }, [setRecordings]);

  return {
    recordings,
    addRecording,
    removeRecording,
    markAsSynced,
  };
}

