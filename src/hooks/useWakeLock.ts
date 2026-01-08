'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseWakeLockReturn {
  isSupported: boolean;
  isActive: boolean;
  request: () => Promise<void>;
  release: () => Promise<void>;
}

export function useWakeLock(): UseWakeLockReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Check if Wake Lock API is supported
  useEffect(() => {
    setIsSupported('wakeLock' in navigator);
  }, []);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && wakeLockRef.current !== null) {
        // Wake lock was released when page became hidden, re-acquire it
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          setIsActive(true);
          console.log('[WakeLock] Re-acquired after visibility change');
        } catch (err) {
          console.warn('[WakeLock] Failed to re-acquire:', err);
          setIsActive(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const request = useCallback(async () => {
    if (!isSupported) {
      console.log('[WakeLock] Not supported on this device');
      return;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);
      console.log('[WakeLock] Acquired - screen will stay on');

      wakeLockRef.current.addEventListener('release', () => {
        console.log('[WakeLock] Released');
        setIsActive(false);
      });
    } catch (err) {
      console.warn('[WakeLock] Failed to acquire:', err);
      setIsActive(false);
    }
  }, [isSupported]);

  const release = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
        console.log('[WakeLock] Manually released');
      } catch (err) {
        console.warn('[WakeLock] Failed to release:', err);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  return {
    isSupported,
    isActive,
    request,
    release,
  };
}
