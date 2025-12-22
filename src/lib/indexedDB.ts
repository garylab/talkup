'use client';

const DB_NAME = 'talkup-db';
const DB_VERSION = 1;
const BLOBS_STORE = 'blobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDB] Failed to open:', request.error);
        dbPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('[IndexedDB] Opened successfully');
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        console.log('[IndexedDB] Upgrading...');
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(BLOBS_STORE)) {
          db.createObjectStore(BLOBS_STORE, { keyPath: 'id' });
        }
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Blocked - close other tabs');
      };
    } catch (error) {
      console.error('[IndexedDB] Error:', error);
      dbPromise = null;
      reject(error);
    }
  });

  return dbPromise;
}

// Helper to convert Blob to ArrayBuffer
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

// ============ Blob Operations ============

export async function saveBlob(id: string, blob: Blob): Promise<void> {
  console.log(`[IndexedDB] Saving: ${id}, size: ${blob.size}`);
  
  // IMPORTANT: Convert blob to ArrayBuffer BEFORE opening transaction
  // This prevents the transaction from closing while reading
  const arrayBuffer = await blobToArrayBuffer(blob);
  console.log(`[IndexedDB] Converted to ArrayBuffer: ${arrayBuffer.byteLength} bytes`);
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(BLOBS_STORE, 'readwrite');
      const store = transaction.objectStore(BLOBS_STORE);
      
      // Store ArrayBuffer (works better on iOS than Blob)
      const request = store.put({ 
        id, 
        arrayBuffer,
        type: blob.type,
        size: blob.size
      });

      request.onerror = () => {
        console.error(`[IndexedDB] Save failed: ${id}`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log(`[IndexedDB] Saved: ${id}`);
        resolve();
      };
      
      transaction.onerror = () => {
        console.error(`[IndexedDB] Transaction error:`, transaction.error);
        reject(transaction.error);
      };
    } catch (error) {
      console.error(`[IndexedDB] Error in saveBlob:`, error);
      reject(error);
    }
  });
}

export async function getBlob(id: string): Promise<Blob | null> {
  console.log(`[IndexedDB] Getting: ${id}`);
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(BLOBS_STORE, 'readonly');
      const store = transaction.objectStore(BLOBS_STORE);
      const request = store.get(id);

      request.onerror = () => {
        console.error(`[IndexedDB] Get failed: ${id}`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          console.log(`[IndexedDB] Not found: ${id}`);
          resolve(null);
          return;
        }

        // Reconstruct blob from ArrayBuffer
        if (result.arrayBuffer) {
          console.log(`[IndexedDB] Reconstructing: ${id}, size: ${result.size}`);
          const blob = new Blob([result.arrayBuffer], { 
            type: result.type || 'application/octet-stream' 
          });
          resolve(blob);
          return;
        }

        // Legacy: try direct blob (might not work on iOS)
        if (result.blob instanceof Blob) {
          console.log(`[IndexedDB] Direct blob: ${id}`);
          resolve(result.blob);
          return;
        }

        console.warn(`[IndexedDB] No valid data: ${id}`);
        resolve(null);
      };
    } catch (error) {
      console.error(`[IndexedDB] Error in getBlob:`, error);
      reject(error);
    }
  });
}

export async function deleteBlob(id: string): Promise<void> {
  console.log(`[IndexedDB] Deleting: ${id}`);
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(BLOBS_STORE, 'readwrite');
      const store = transaction.objectStore(BLOBS_STORE);
      const request = store.delete(id);

      request.onerror = () => {
        console.error(`[IndexedDB] Delete failed: ${id}`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log(`[IndexedDB] Deleted: ${id}`);
        resolve();
      };
    } catch (error) {
      console.error(`[IndexedDB] Error in deleteBlob:`, error);
      reject(error);
    }
  });
}

export async function getBlobUrl(id: string): Promise<string | null> {
  const blob = await getBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
