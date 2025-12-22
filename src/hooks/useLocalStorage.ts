'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  saveRecording, 
  getAllRecordings, 
  deleteRecording, 
  updateRecording 
} from '@/lib/indexedDB';

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

// Local recording storage - now using IndexedDB
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
  const [recordings, setRecordings] = useState<LocalRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load recordings from IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    
    async function loadRecordings() {
      try {
        const data = await getAllRecordings();
        if (mounted) {
          setRecordings(data);
        }
      } catch (error) {
        console.error('Failed to load recordings:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadRecordings();
    
    return () => {
      mounted = false;
    };
  }, []);

  const addRecording = useCallback(async (input: AddRecordingInput) => {
    const newRecording = await saveRecording(input);
    setRecordings((prev) => [newRecording, ...prev]);
    return newRecording;
  }, []);

  const removeRecording = useCallback(async (id: string) => {
    await deleteRecording(id);
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const markAsSynced = useCallback(async (id: string) => {
    await updateRecording(id, { synced: true });
    setRecordings((prev) =>
      prev.map((r) => (r.id === id ? { ...r, synced: true } : r))
    );
  }, []);

  return {
    recordings,
    isLoading,
    addRecording,
    removeRecording,
    markAsSynced,
  };
}
