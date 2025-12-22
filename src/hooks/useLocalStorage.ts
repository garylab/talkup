'use client';

import { useState, useEffect, useCallback } from 'react';
import { saveBlob, deleteBlob } from '@/lib/storage';
import { uuid7 } from '@/lib/utils';

// Simple localStorage hook - iOS compatible
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        console.log(`[useLocalStorage] Loaded "${key}":`, parsed?.length ?? parsed);
        setStoredValue(parsed);
      }
    } catch (error) {
      console.error(`[useLocalStorage] Error loading "${key}":`, error);
    }
    setIsHydrated(true);
  }, [key]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue((currentValue) => {
      const newValue = value instanceof Function ? value(currentValue) : value;
      
      // Write to localStorage immediately
      try {
        const json = JSON.stringify(newValue);
        window.localStorage.setItem(key, json);
        console.log(`[useLocalStorage] Saved "${key}":`, Array.isArray(newValue) ? newValue.length : newValue);
      } catch (error) {
        console.error(`[useLocalStorage] Error saving "${key}":`, error);
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
    console.log(`[addRecording] Starting save for ${id}`);
    
    try {
      // Save blob to IndexedDB
      await saveBlob(id, input.blob);
      console.log(`[addRecording] Blob saved to IndexedDB: ${id}`);
    } catch (error) {
      console.error(`[addRecording] Failed to save blob:`, error);
      // Continue anyway - at least save metadata
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
    
    // Update recordings list
    setRecordings((prev) => {
      const updated = [newRecording, ...prev];
      console.log(`[addRecording] Updated list, new count: ${updated.length}`);
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
