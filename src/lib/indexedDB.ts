'use client';

import type { LocalRecording, AddRecordingInput } from '@/hooks/useLocalStorage';

const DB_NAME = 'talkup-db';
const DB_VERSION = 2;
const BLOBS_STORE = 'blobs';
const RECORDINGS_STORE = 'recordings';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Migrate from v1: rename 'recordings' to 'blobs'
      if (db.objectStoreNames.contains('recordings') && !db.objectStoreNames.contains(BLOBS_STORE)) {
        // Can't rename, so we'll just create new stores
        // Old data will be lost on upgrade - this is acceptable for v1->v2
      }
      
      // Create blobs store for binary data
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE, { keyPath: 'id' });
      }
      
      // Create recordings store for metadata with createdAt index for sorting
      if (!db.objectStoreNames.contains(RECORDINGS_STORE)) {
        const store = db.createObjectStore(RECORDINGS_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });

  return dbPromise;
}

// ============ Blob Operations ============

export async function saveBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BLOBS_STORE, 'readwrite');
    const store = transaction.objectStore(BLOBS_STORE);
    const request = store.put({ id, blob });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BLOBS_STORE, 'readonly');
    const store = transaction.objectStore(BLOBS_STORE);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.blob : null);
    };
  });
}

export async function deleteBlob(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BLOBS_STORE, 'readwrite');
    const store = transaction.objectStore(BLOBS_STORE);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getBlobUrl(id: string): Promise<string | null> {
  const blob = await getBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

// ============ Recording Operations (Metadata + Blob) ============

export async function saveRecording(input: AddRecordingInput): Promise<LocalRecording> {
  const db = await openDB();
  const id = crypto.randomUUID();
  
  const recording: LocalRecording = {
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

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([RECORDINGS_STORE, BLOBS_STORE], 'readwrite');
    
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve(recording);

    // Save metadata
    const recordingsStore = transaction.objectStore(RECORDINGS_STORE);
    recordingsStore.put(recording);

    // Save blob
    const blobsStore = transaction.objectStore(BLOBS_STORE);
    blobsStore.put({ id, blob: input.blob });
  });
}

export async function getAllRecordings(): Promise<LocalRecording[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECORDINGS_STORE, 'readonly');
    const store = transaction.objectStore(RECORDINGS_STORE);
    const index = store.index('createdAt');
    
    // Get all records sorted by createdAt descending (newest first)
    const request = index.openCursor(null, 'prev');
    const recordings: LocalRecording[] = [];

    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        recordings.push(cursor.value);
        cursor.continue();
      } else {
        resolve(recordings);
      }
    };
  });
}

export async function getRecording(id: string): Promise<LocalRecording | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECORDINGS_STORE, 'readonly');
    const store = transaction.objectStore(RECORDINGS_STORE);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([RECORDINGS_STORE, BLOBS_STORE], 'readwrite');
    
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();

    // Delete metadata
    const recordingsStore = transaction.objectStore(RECORDINGS_STORE);
    recordingsStore.delete(id);

    // Delete blob
    const blobsStore = transaction.objectStore(BLOBS_STORE);
    blobsStore.delete(id);
  });
}

export async function updateRecording(id: string, updates: Partial<Omit<LocalRecording, 'id'>>): Promise<void> {
  const db = await openDB();
  const existing = await getRecording(id);
  if (!existing) throw new Error('Recording not found');

  const updated = { ...existing, ...updates };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECORDINGS_STORE, 'readwrite');
    const store = transaction.objectStore(RECORDINGS_STORE);
    const request = store.put(updated);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
