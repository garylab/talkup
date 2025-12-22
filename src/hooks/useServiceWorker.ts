'use client';

import { useEffect, useState, useCallback } from 'react';

interface ServiceWorkerState {
  isUpdateAvailable: boolean;
  updateServiceWorker: () => void;
}

export function useServiceWorker(): ServiceWorkerState {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  const updateServiceWorker = useCallback(() => {
    if (waitingWorker) {
      // Tell the service worker to skip waiting
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    // Reload the page to get the new version
    window.location.reload();
  }, [waitingWorker]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[App] Service worker updated to:', event.data.version);
        // Optionally auto-reload on update
        // window.location.reload();
      }
    };

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Check for updates on registration
    navigator.serviceWorker.ready.then((registration) => {
      // Check for waiting worker
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setIsUpdateAvailable(true);
      }

      // Listen for new service worker installing
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New update available
              setWaitingWorker(newWorker);
              setIsUpdateAvailable(true);
              console.log('[App] New version available!');
            }
          });
        }
      });

      // Check for updates periodically (every 5 minutes)
      const checkForUpdates = () => {
        registration.update().catch((err) => {
          console.log('[App] Update check failed:', err);
        });
      };

      // Check immediately
      checkForUpdates();

      // Then check every 5 minutes
      const intervalId = setInterval(checkForUpdates, 5 * 60 * 1000);

      return () => {
        clearInterval(intervalId);
      };
    });

    // Handle controller change (new SW activated)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  return {
    isUpdateAvailable,
    updateServiceWorker,
  };
}

