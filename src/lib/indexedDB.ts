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
        console.log('[IndexedDB] Opened');
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

// ============ Blob Operations ============

export async function saveBlob(id: string, blob: Blob): Promise<void> {
  console.log(`[IndexedDB] Saving: ${id}, size: ${blob.size}, type: ${blob.type}`);
  
  // Step 1: Convert blob to ArrayBuffer BEFORE opening transaction
  // This is critical - the transaction will close if we do async work after opening it
  let arrayBuffer: ArrayBuffer;
  try {
    // Modern browsers support blob.arrayBuffer()
    arrayBuffer = await blob.arrayBuffer();
    console.log(`[IndexedDB] Converted to ArrayBuffer: ${arrayBuffer.byteLength} bytes`);
  } catch (error) {
    console.error(`[IndexedDB] Failed to convert blob:`, error);
    throw error;
  }
  
  // Step 2: Open database
  const db = await openDB();
  
  // Step 3: Store in IndexedDB with proper transaction handling
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(BLOBS_STORE, 'readwrite');
      const store = transaction.objectStore(BLOBS_STORE);
      
      const data = { 
        id, 
        arrayBuffer,
        type: blob.type,
        size: blob.size
      };
      
      const request = store.put(data);

      // IMPORTANT: Wait for transaction.oncomplete, not just request.onsuccess
      // This ensures data is fully committed to disk (critical for iOS!)
      transaction.oncomplete = () => {
        console.log(`[IndexedDB] Saved: ${id}`);
        resolve();
      };

      transaction.onerror = () => {
        console.error(`[IndexedDB] Transaction error:`, transaction.error);
        reject(transaction.error);
      };
      
      transaction.onabort = () => {
        console.error(`[IndexedDB] Transaction aborted`);
        reject(new Error('Transaction aborted'));
      };

      request.onerror = () => {
        console.error(`[IndexedDB] Put error:`, request.error);
        // Don't reject here - let transaction.onerror handle it
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

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          console.log(`[IndexedDB] Not found: ${id}`);
          resolve(null);
          return;
        }

        // Reconstruct blob from ArrayBuffer
        if (result.arrayBuffer) {
          try {
            const blob = new Blob([result.arrayBuffer], { 
              type: result.type || 'application/octet-stream' 
            });
            console.log(`[IndexedDB] Retrieved: ${id}, size: ${blob.size}`);
            resolve(blob);
          } catch (e) {
            console.error(`[IndexedDB] Failed to reconstruct blob:`, e);
            resolve(null);
          }
          return;
        }

        // Legacy fallback: direct blob
        if (result.blob instanceof Blob) {
          console.log(`[IndexedDB] Retrieved direct blob: ${id}`);
          resolve(result.blob);
          return;
        }

        // Legacy fallback: base64
        if (result.base64) {
          try {
            const byteString = atob(result.base64.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: result.type || 'application/octet-stream' });
            console.log(`[IndexedDB] Retrieved from base64: ${id}`);
            resolve(blob);
          } catch (e) {
            console.error(`[IndexedDB] Failed to convert base64:`, e);
            resolve(null);
          }
          return;
        }

        console.warn(`[IndexedDB] No valid data for: ${id}`);
        resolve(null);
      };

      request.onerror = () => {
        console.error(`[IndexedDB] Get error:`, request.error);
        reject(request.error);
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
      store.delete(id);

      transaction.oncomplete = () => {
        console.log(`[IndexedDB] Deleted: ${id}`);
        resolve();
      };

      transaction.onerror = () => {
        console.error(`[IndexedDB] Delete error:`, transaction.error);
        reject(transaction.error);
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
