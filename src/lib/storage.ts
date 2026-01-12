'use client';

/**
 * Blob Storage Module
 * 
 * Uses OPFS (Origin Private File System) as primary storage for all modern browsers.
 * Falls back to IndexedDB for older browsers.
 * 
 * OPFS Support: Chrome 86+, Safari 15.2+, Firefox 111+, Edge 86+
 */

const DB_NAME = 'talkup-db';
const DB_VERSION = 1;
const BLOBS_STORE = 'blobs';

// Check if OPFS is available (Chrome 86+, Safari 15.2+, Firefox 111+, Edge 86+)
function hasOPFS(): boolean {
  return typeof navigator !== 'undefined' && 
    'storage' in navigator && 
    'getDirectory' in navigator.storage;
}

// Request persistent storage (helps prevent iOS from clearing data)
async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      console.log(`[Storage] Persistent storage: ${isPersisted ? 'granted' : 'denied'}`);
    }
  } catch (e) {
    console.warn('[Storage] Could not request persistent storage:', e);
  }
}

// Initialize persistent storage on first use
let persistenceRequested = false;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[IndexedDB] Failed to open:', request.error);
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('[IndexedDB] Opened');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE, { keyPath: 'id' });
      }
    };
  });

  return dbPromise;
}

// ============ OPFS Storage (Primary - for all modern browsers) ============

async function saveBlobOPFS(id: string, blob: Blob): Promise<void> {
  console.log(`[OPFS] Saving: ${id}, size: ${blob.size}, type: ${blob.type}`);
  
  // Request persistent storage on first save
  if (!persistenceRequested) {
    persistenceRequested = true;
    await requestPersistentStorage();
  }
  
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(id, { create: true });
    
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    
    // Store metadata
    const metaHandle = await root.getFileHandle(`${id}.meta`, { create: true });
    const metaWritable = await metaHandle.createWritable();
    await metaWritable.write(JSON.stringify({ type: blob.type, size: blob.size }));
    await metaWritable.close();
    
    // Verify the file was saved correctly
    const verifyHandle = await root.getFileHandle(id);
    const verifyFile = await verifyHandle.getFile();
    console.log(`[OPFS] Saved and verified: ${id}, saved size: ${verifyFile.size}`);
    
    if (verifyFile.size !== blob.size) {
      console.error(`[OPFS] Size mismatch! Expected ${blob.size}, got ${verifyFile.size}`);
      throw new Error('File size mismatch after save');
    }
  } catch (error) {
    console.error(`[OPFS] Save failed for ${id}:`, error);
    throw error;
  }
}

async function getBlobOPFS(id: string): Promise<Blob | null> {
  console.log(`[OPFS] Getting: ${id}`);
  
  try {
    const root = await navigator.storage.getDirectory();
    
    // Get metadata for MIME type
    let storedType = '';
    try {
      const metaHandle = await root.getFileHandle(`${id}.meta`);
      const metaFile = await metaHandle.getFile();
      const metaText = await metaFile.text();
      const meta = JSON.parse(metaText);
      storedType = meta.type || '';
    } catch {
      // No metadata file, continue without stored type
    }
    
    // Get file - File extends Blob
    const fileHandle = await root.getFileHandle(id);
    const file = await fileHandle.getFile();
    
    // Determine the best type to use
    // Priority: stored metadata type > file.type > default
    const finalType = storedType || file.type || 'application/octet-stream';
    
    console.log(`[OPFS] Retrieved: ${id}, size: ${file.size}, file.type: ${file.type || '(empty)'}, stored: ${storedType || '(none)'}, using: ${finalType}`);
    
    // If the file already has the correct type, return it directly
    if (file.type === finalType) {
      return file;
    }
    
    // Apply the correct type using slice()
    return file.slice(0, file.size, finalType);
  } catch (error) {
    console.error(`[OPFS] Failed to get ${id}:`, error);
    return null;
  }
}

async function deleteBlobOPFS(id: string): Promise<void> {
  console.log(`[OPFS] Deleting: ${id}`);
  
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(id);
    try {
      await root.removeEntry(`${id}.meta`);
    } catch {
      // Meta might not exist
    }
    console.log(`[OPFS] Deleted: ${id}`);
  } catch {
    console.log(`[OPFS] Not found: ${id}`);
  }
}

// ============ IndexedDB Storage (Fallback for older browsers) ============

async function saveBlobIndexedDB(id: string, blob: Blob): Promise<void> {
  console.log(`[IndexedDB] Saving: ${id}, size: ${blob.size}`);
  
  const arrayBuffer = await blob.arrayBuffer();
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BLOBS_STORE, 'readwrite');
    const store = transaction.objectStore(BLOBS_STORE);
    
    store.put({ id, arrayBuffer, type: blob.type, size: blob.size });

    transaction.oncomplete = () => {
      console.log(`[IndexedDB] Saved: ${id}`);
      resolve();
    };

    transaction.onerror = () => {
      console.error(`[IndexedDB] Error:`, transaction.error);
      reject(transaction.error);
    };
  });
}

async function getBlobIndexedDB(id: string): Promise<Blob | null> {
  console.log(`[IndexedDB] Getting: ${id}`);
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BLOBS_STORE, 'readonly');
    const store = transaction.objectStore(BLOBS_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result;
      if (!result) {
        console.log(`[IndexedDB] Not found: ${id}`);
        resolve(null);
        return;
      }

      if (result.arrayBuffer) {
        const blob = new Blob([result.arrayBuffer], { type: result.type || 'application/octet-stream' });
        console.log(`[IndexedDB] Retrieved: ${id}, size: ${blob.size}`);
        resolve(blob);
        return;
      }

      // Legacy fallbacks
      if (result.base64) {
        try {
          const byteString = atob(result.base64.split(',')[1]);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          resolve(new Blob([ab], { type: result.type || 'application/octet-stream' }));
          return;
        } catch {
          resolve(null);
          return;
        }
      }

      if (result.blob instanceof Blob) {
        resolve(result.blob);
        return;
      }

      resolve(null);
    };

    request.onerror = () => reject(request.error);
  });
}

async function deleteBlobIndexedDB(id: string): Promise<void> {
  console.log(`[IndexedDB] Deleting: ${id}`);
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BLOBS_STORE, 'readwrite');
    const store = transaction.objectStore(BLOBS_STORE);
    store.delete(id);

    transaction.oncomplete = () => {
      console.log(`[IndexedDB] Deleted: ${id}`);
      resolve();
    };

    transaction.onerror = () => reject(transaction.error);
  });
}

// ============ Public API ============
// Strategy: OPFS first (95%+ browsers), IndexedDB fallback

// Log storage quota info for debugging
async function logStorageQuota(): Promise<void> {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usedMB = Math.round((estimate.usage || 0) / 1024 / 1024);
      const quotaMB = Math.round((estimate.quota || 0) / 1024 / 1024);
      console.log(`[Storage] Quota: ${usedMB}MB used / ${quotaMB}MB available`);
    }
  } catch {
    // Ignore
  }
}

export async function saveBlob(id: string, blob: Blob): Promise<void> {
  console.log(`[Storage] Saving blob: ${id}, size: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
  await logStorageQuota();
  
  if (hasOPFS()) {
    try {
      await saveBlobOPFS(id, blob);
      console.log(`[Storage] Successfully saved to OPFS: ${id}`);
      return;
    } catch (error) {
      console.warn('[Storage] OPFS failed, falling back to IndexedDB:', error);
    }
  }
  
  try {
    await saveBlobIndexedDB(id, blob);
    console.log(`[Storage] Successfully saved to IndexedDB: ${id}`);
  } catch (error) {
    console.error('[Storage] All storage methods failed:', error);
    throw error;
  }
}

export async function getBlob(id: string): Promise<Blob | null> {
  console.log(`[Storage] Getting blob: ${id}`);
  
  if (hasOPFS()) {
    try {
      const blob = await getBlobOPFS(id);
      if (blob) {
        console.log(`[Storage] Found in OPFS: ${id}, size: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
        return blob;
      }
    } catch (error) {
      console.warn('[Storage] OPFS get failed, trying IndexedDB:', error);
    }
  }
  
  // Also check IndexedDB for legacy data
  const blob = await getBlobIndexedDB(id);
  if (blob) {
    console.log(`[Storage] Found in IndexedDB: ${id}, size: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
  } else {
    console.warn(`[Storage] Blob not found in any storage: ${id}`);
  }
  return blob;
}

export async function deleteBlob(id: string): Promise<void> {
  // Try to delete from both storages
  if (hasOPFS()) {
    try {
      await deleteBlobOPFS(id);
    } catch {
      // Continue
    }
  }
  try {
    await deleteBlobIndexedDB(id);
  } catch {
    // Ignore
  }
}

export async function getBlobUrl(id: string): Promise<string | null> {
  const blob = await getBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

// Export for debugging
export function getStorageType(): string {
  return hasOPFS() ? 'OPFS' : 'IndexedDB';
}

