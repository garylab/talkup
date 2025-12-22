'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { saveBlob, deleteBlob } from '@/lib/indexedDB';
import { uuid7 } from '@/lib/utils';

// Simple localStorage helper
function getStorageValue<T>(key: string, initialValue: T): T {
  if (typeof window === 'undefined') return initialValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  } catch {
    return initialValue;
  }
}

function setStorageValue<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[localStorage] Failed to write "${key}":`, error);
  }
}

// Generic localStorage hook - simple and reliable
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Use useSyncExternalStore for reliable synchronization with localStorage
  const subscribe = useCallback((callback: () => void) => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key) callback();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [key]);

  const getSnapshot = useCallback(() => {
    return JSON.stringify(getStorageValue(key, initialValue));
  }, [key, initialValue]);

  const getServerSnapshot = useCallback(() => {
    return JSON.stringify(initialValue);
  }, [initialValue]);

  const storedString = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const storedValue = JSON.parse(storedString) as T;

  // Track hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    const currentValue = getStorageValue(key, initialValue);
    const newValue = value instanceof Function ? value(currentValue) : value;
    setStorageValue(key, newValue);
    // Trigger re-render by dispatching storage event
    window.dispatchEvent(new StorageEvent('storage', { key }));
  }, [key, initialValue]);

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
      console.log(`[addRecording] Blob saved: ${id}`);
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
    
    // Update localStorage directly and trigger re-render
    setRecordings((prev) => {
      const updated = [newRecording, ...prev];
      console.log(`[addRecording] Recordings updated, count: ${updated.length}`);
      return updated;
    });
    
    return newRecording;
  }, [setRecordings]);

  const removeRecording = useCallback(async (id: string) => {
    try {
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
