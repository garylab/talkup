'use client';

const DB_NAME = 'talkup-db';
const DB_VERSION = 1;
const BLOBS_STORE = 'blobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    // Check if IndexedDB is available
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDB] Failed to open database:', request.error);
        dbPromise = null; // Reset so we can retry
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('[IndexedDB] Database opened successfully');
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        console.log('[IndexedDB] Upgrading database...');
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create blobs store for binary data only
        if (!db.objectStoreNames.contains(BLOBS_STORE)) {
          db.createObjectStore(BLOBS_STORE, { keyPath: 'id' });
          console.log('[IndexedDB] Created blobs store');
        }
      };

      // Handle blocked (another tab has the db open with old version)
      request.onblocked = () => {
        console.warn('[IndexedDB] Database blocked - close other tabs');
      };
    } catch (error) {
      console.error('[IndexedDB] Error opening database:', error);
      dbPromise = null;
      reject(error);
    }
  });

  return dbPromise;
}

// ============ Blob Operations ============

export async function saveBlob(id: string, blob: Blob): Promise<void> {
  console.log(`[IndexedDB] Saving blob: ${id}, size: ${blob.size}, type: ${blob.type}`);
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(BLOBS_STORE, 'readwrite');
      const store = transaction.objectStore(BLOBS_STORE);
      
      // For iOS compatibility, convert blob to ArrayBuffer if needed
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const request = store.put({ 
            id, 
            blob,
            // Store as ArrayBuffer backup for iOS compatibility
            arrayBuffer: reader.result,
            type: blob.type,
            size: blob.size
          });

          request.onerror = () => {
            console.error(`[IndexedDB] Failed to save blob ${id}:`, request.error);
            reject(request.error);
          };

          request.onsuccess = () => {
            console.log(`[IndexedDB] Blob saved successfully: ${id}`);
            resolve();
          };
        } catch (error) {
          console.error(`[IndexedDB] Error in put operation:`, error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        console.error(`[IndexedDB] Failed to read blob:`, reader.error);
        reject(reader.error);
      };
      
      reader.readAsArrayBuffer(blob);
      
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
  console.log(`[IndexedDB] Getting blob: ${id}`);
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(BLOBS_STORE, 'readonly');
      const store = transaction.objectStore(BLOBS_STORE);
      const request = store.get(id);

      request.onerror = () => {
        console.error(`[IndexedDB] Failed to get blob ${id}:`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          console.log(`[IndexedDB] Blob not found: ${id}`);
          resolve(null);
          return;
        }

        // Try to get blob directly first
        if (result.blob instanceof Blob) {
          console.log(`[IndexedDB] Retrieved blob: ${id}`);
          resolve(result.blob);
          return;
        }

        // Fallback: reconstruct from ArrayBuffer (iOS compatibility)
        if (result.arrayBuffer) {
          console.log(`[IndexedDB] Reconstructing blob from ArrayBuffer: ${id}`);
          const blob = new Blob([result.arrayBuffer], { type: result.type || 'application/octet-stream' });
          resolve(blob);
          return;
        }

        console.warn(`[IndexedDB] No valid blob data found for: ${id}`);
        resolve(null);
      };
    } catch (error) {
      console.error(`[IndexedDB] Error in getBlob:`, error);
      reject(error);
    }
  });
}

export async function deleteBlob(id: string): Promise<void> {
  console.log(`[IndexedDB] Deleting blob: ${id}`);
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(BLOBS_STORE, 'readwrite');
      const store = transaction.objectStore(BLOBS_STORE);
      const request = store.delete(id);

      request.onerror = () => {
        console.error(`[IndexedDB] Failed to delete blob ${id}:`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log(`[IndexedDB] Blob deleted: ${id}`);
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

// Check if IndexedDB is available and working
export async function checkIndexedDBSupport(): Promise<boolean> {
  try {
    await openDB();
    return true;
  } catch {
    return false;
  }
}
