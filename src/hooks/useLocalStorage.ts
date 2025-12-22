'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { saveBlob, deleteBlob } from '@/lib/indexedDB';
import { uuid7 } from '@/lib/utils';

// Generic localStorage hook - hydration safe
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  // Always start with initialValue to avoid hydration mismatch
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);
  const initialLoadDone = useRef(false);

  // Read from localStorage after mount (client-side only)
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        setStoredValue(parsed);
      }
    } catch (error) {
      console.error(`[useLocalStorage] Error reading "${key}":`, error);
    }
    setIsHydrated(true);
  }, [key]);

  // Write to localStorage when value changes (but only after hydration)
  useEffect(() => {
    if (!isHydrated) return;

    try {
      const json = JSON.stringify(storedValue);
      window.localStorage.setItem(key, json);
    } catch (error) {
      console.error(`[useLocalStorage] Error writing "${key}":`, error);
    }
  }, [key, storedValue, isHydrated]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue((prev) => {
      const newValue = value instanceof Function ? value(prev) : value;
      // Also write immediately to localStorage for reliability (especially on iOS)
      try {
        window.localStorage.setItem(key, JSON.stringify(newValue));
      } catch (error) {
        console.error(`[useLocalStorage] Error in setValue for "${key}":`, error);
      }
      return newValue;
    });
  }, [key]);

  return [storedValue, setValue, isHydrated];
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
  const [recordings, setRecordings, isHydrated] = useLocalStorage<LocalRecording[]>('talkup-recordings', []);

  const addRecording = useCallback(async (input: AddRecordingInput): Promise<LocalRecording> => {
    const id = uuid7();
    
    try {
      // Save blob to IndexedDB first
      await saveBlob(id, input.blob);
      console.log(`[addRecording] Blob saved to IndexedDB: ${id}`);
    } catch (error) {
      console.error(`[addRecording] Failed to save blob:`, error);
      throw error;
    }
    
    const newRecording: LocalRecording = {
      id,
      topic: input.topic,
      type: input.type,
      format: input.format,
      duration: input.duration,
      size: input.blob.size,
      createdAt: new Date().toISOString(),
    };
    
    // Update state and localStorage
    setRecordings((prev) => {
      const updated = [newRecording, ...prev];
      console.log(`[addRecording] Updated recordings list, count: ${updated.length}`);
      return updated;
    });
    
    return newRecording;
  }, [setRecordings]);

  const removeRecording = useCallback(async (id: string) => {
    try {
      // Delete blob from IndexedDB
      await deleteBlob(id);
      console.log(`[removeRecording] Blob deleted: ${id}`);
    } catch (error) {
      console.error(`[removeRecording] Failed to delete blob:`, error);
    }
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  }, [setRecordings]);

  return {
    recordings,
    isHydrated,
    addRecording,
    removeRecording,
  };
}
