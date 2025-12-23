'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface ServiceWorkerState {
  isUpdateAvailable: boolean;
  updateServiceWorker: () => void;
  checkForUpdates: () => void;
}

export function useServiceWorker(): ServiceWorkerState {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);

  const updateServiceWorker = useCallback(() => {
    console.log('[App] Activating update...');
    if (waitingWorkerRef.current) {
      // Tell the service worker to skip waiting and activate
      waitingWorkerRef.current.postMessage({ type: 'SKIP_WAITING' });
    }
    // Reload will be triggered by controllerchange event
    // But also reload after a short delay as fallback
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }, []);

  const checkForUpdates = useCallback(() => {
    if (registrationRef.current) {
      console.log('[App] Manually checking for updates...');
      registrationRef.current.update().catch((err) => {
        console.log('[App] Update check failed:', err);
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let intervalId: NodeJS.Timeout | null = null;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[App] Service worker updated to:', event.data.version);
      }
    };

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Register and check for updates
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registrationRef.current = registration;
      console.log('[App] Service Worker registered');

      // Check for waiting worker immediately
      if (registration.waiting) {
        console.log('[App] Found waiting worker on load');
        waitingWorkerRef.current = registration.waiting;
        setIsUpdateAvailable(true);
      }

      // Listen for new service worker installing
      registration.addEventListener('updatefound', () => {
        console.log('[App] Update found!');
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            console.log('[App] New worker state:', newWorker.state);
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New update available (there's an existing controller)
                console.log('[App] New version available!');
                waitingWorkerRef.current = newWorker;
                setIsUpdateAvailable(true);
              } else {
                // First install, no update needed
                console.log('[App] First install complete');
              }
            }
          });
        }
      });

      // Check for updates immediately
      registration.update().catch(() => {});

      // Check every 1 minute (more aggressive for testing, can reduce later)
      intervalId = setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 1000);
    }).catch((err) => {
      console.error('[App] Service Worker registration failed:', err);
    });

    // Handle controller change (new SW activated)
    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      console.log('[App] Controller changed, reloading...');
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return {
    isUpdateAvailable,
    updateServiceWorker,
    checkForUpdates,
  };
}

