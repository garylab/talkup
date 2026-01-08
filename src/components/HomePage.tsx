'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { RecordingStudio } from '@/components/RecordingStudio';
import { RecordingsView } from '@/components/RecordingsView';
import { SettingsView } from '@/components/SettingsView';
import { BottomNavbar, TabId } from '@/components/BottomNavbar';
import { useRecorder } from '@/hooks/useRecorder';
import { useLocalRecordings, useLocalStorage } from '@/hooks/useLocalStorage';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { t as translate, getTopics, Locale } from '@/i18n';
import { useLocale } from '@/hooks/useLocale';
import type { RecordingType } from '@/types';

interface HomePageProps {
  locale: Locale;
}

export function HomePage({ locale }: HomePageProps) {
  // Use stored locale (if set) so language switches don't change the URL
  const { locale: storedLocale, isHydrated: isLocaleHydrated } = useLocale(locale);
  const effectiveLocale = isLocaleHydrated ? (storedLocale ?? locale) : locale;

  // i18n helper
  const t = (key: string) => translate(effectiveLocale, key);
  const topics = getTopics(effectiveLocale);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<TabId>('home');

  // Topic state - persisted to localStorage
  const [topic, setTopic, isTopicHydrated] = useLocalStorage<string | null>('talkup-topic', null);
  
  // Local storage (metadata in localStorage, blobs in IndexedDB)
  const { recordings, isHydrated, addRecording, removeRecording, clearAllRecordings } = useLocalRecordings();

  // PWA install
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Service worker updates
  const { isUpdateAvailable, updateServiceWorker } = useServiceWorker();

  // Use refs to track values for the callback
  const topicRef = useRef(topic);
  const recordingTypeRef = useRef<RecordingType>('video');
  
  useEffect(() => {
    topicRef.current = topic;
  }, [topic]);

  // Auto-save when recording completes
  const handleRecordingComplete = useCallback(async (blob: Blob, url: string, duration: number, format: 'mp4' | 'webm') => {
    const currentTopic = topicRef.current;
    const currentType = recordingTypeRef.current;

    await addRecording({
      topic: currentTopic,
      type: currentType,
      format,
      duration,
      blob,
    });

    // Reset for new recording after a brief delay to show completion
    setTimeout(() => {
      setTopic(null);
    }, 100);
  }, [addRecording]);

  // Recorder hook with auto-save
  const recorder = useRecorder({
    onRecordingComplete: handleRecordingComplete,
  });

  // Update ref when recorder type changes
  useEffect(() => {
    if (recorder.recordingType) {
      recordingTypeRef.current = recorder.recordingType;
    }
  }, [recorder.recordingType]);

  // Handle start recording with type and device selection
  const handleStart = useCallback((type: RecordingType, audioDeviceId?: string, videoDeviceId?: string) => {
    recordingTypeRef.current = type;
    recorder.startRecording(type, audioDeviceId, videoDeviceId);
  }, [recorder]);

  return (
    <main className="h-[100dvh] flex flex-col">
      {/* Update notification - top banner */}
      {isUpdateAvailable && (
        <div className="bg-blue-600 px-4 py-2.5 flex items-center justify-between gap-3 animate-fade-in flex-shrink-0">
          <span className="text-sm font-medium">{t('pwa.updateAvailable')}</span>
          <button
            onClick={updateServiceWorker}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-semibold bg-white text-blue-600 active:scale-[0.97] transition-transform"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('pwa.update')}
          </button>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {/* Home Tab - Recording Studio (full screen camera style, extends under navbar) */}
        {activeTab === 'home' && (
          <RecordingStudio
            state={recorder.state}
            duration={recorder.duration}
            mediaStream={recorder.mediaStream}
            recordedUrl={recorder.recordedUrl}
            error={recorder.error}
            onStart={handleStart}
            onPause={recorder.pauseRecording}
            onResume={recorder.resumeRecording}
            onStop={recorder.stopRecording}
            onReset={recorder.resetRecording}
            topic={topic}
            onTopicChange={setTopic}
            isTopicHydrated={isTopicHydrated}
            recordingType={recorder.recordingType || 'video'}
            t={t}
            topics={topics}
            locale={effectiveLocale}
          />
        )}

        {/* Recordings Tab */}
        {activeTab === 'recordings' && isHydrated && (
          <div className="h-full overflow-y-auto animate-fade-in pb-16">
            <div className="app-container py-4">
              <RecordingsView
                recordings={recordings}
                onRemove={removeRecording}
                onClearAll={clearAllRecordings}
                t={t}
              />
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="h-full overflow-y-auto animate-fade-in pb-16">
            <div className="app-container py-4">
              <SettingsView
                locale={locale}
                isInstallable={isInstallable}
                isInstalled={isInstalled}
                onInstall={install}
                t={t}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        recordingsCount={recordings.length}
        t={t}
      />
    </main>
  );
}
