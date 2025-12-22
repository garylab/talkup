'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Mic, Video, Pause, Play, Square, Circle, Plus, Undo2, RefreshCcw, Maximize2, Minimize2, Settings, X } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { api } from '@/lib/api';
import type { RecordingType } from '@/types';
import type { RecorderState } from '@/hooks/useRecorder';

interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

interface RecordingStudioProps {
  state: RecorderState;
  duration: number;
  mediaStream: MediaStream | null;
  recordedUrl: string | null;
  error: string | null;
  onStart: (type: RecordingType, audioDeviceId?: string, videoDeviceId?: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
  topic: string | null;
  onTopicChange: (topic: string | null) => void;
  recordingType: RecordingType;
  // i18n
  t: (key: string) => string;
  topics: string[];
}

export function RecordingStudio({
  state,
  duration,
  mediaStream,
  recordedUrl,
  error,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  topic,
  onTopicChange,
  recordingType,
  t,
  topics,
}: RecordingStudioProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isLoadingTopic, setIsLoadingTopic] = useState(false);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);
  
  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [recordMode, setRecordMode] = useState<RecordingType>('video');
  const [audioDevices, setAudioDevices] = useState<MediaDeviceOption[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceOption[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');

  useEffect(() => {
    if (videoRef.current && mediaStream && recordingType === 'video') {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream, recordingType]);

  // Handle ESC key to exit maximized mode or close settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSettings) {
          setShowSettings(false);
        } else if (isMaximized) {
          setIsMaximized(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized, showSettings]);

  // Reset maximized state when recording stops
  useEffect(() => {
    if (state === 'stopped' || state === 'idle') {
      setIsMaximized(false);
    }
  }, [state]);

  // Load available media devices
  const loadDevices = useCallback(async () => {
    try {
      // Request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop());
      }).catch(() => {
        // Try audio only if video fails
        return navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          stream.getTracks().forEach(track => track.stop());
        });
      });

      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
        }));
      
      const videoInputs = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 5)}`,
        }));

      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);

      // Set default selections if not already set
      if (!selectedAudioDevice && audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }
      if (!selectedVideoDevice && videoInputs.length > 0) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  }, [selectedAudioDevice, selectedVideoDevice]);

  // Load devices when settings panel opens
  useEffect(() => {
    if (showSettings) {
      loadDevices();
    }
  }, [showSettings, loadDevices]);

  const isRecording = state === 'recording';
  const isPaused = state === 'paused';
  const isStopped = state === 'stopped';
  const isIdle = state === 'idle';
  const isActive = isRecording || isPaused;

  const handleGetTopic = useCallback(async () => {
    setIsLoadingTopic(true);
    setIsCreatingTopic(false);
    try {
      const data = await api.getRandomTopic(topics);
      onTopicChange(data.title);
    } catch {
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      onTopicChange(randomTopic);
    } finally {
      setIsLoadingTopic(false);
    }
  }, [onTopicChange, topics]);

  const handleCreateTopic = () => {
    if (customTopic.trim()) {
      onTopicChange(customTopic.trim());
      setCustomTopic('');
      setIsCreatingTopic(false);
    }
  };

  const handleClearTopic = () => {
    onTopicChange(null);
    setIsCreatingTopic(false);
    setCustomTopic('');
  };

  const handleStart = () => {
    onStart(recordMode, selectedAudioDevice || undefined, selectedVideoDevice || undefined);
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  return (
    <>
      {/* Fullscreen overlay when maximized */}
      {isMaximized && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Maximized video container */}
          <div className="flex-1 relative">
            {recordingType === 'video' && mediaStream && (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain"
                style={{ transform: 'scaleX(-1)' }}
              />
            )}

            {/* Topic at top-left */}
            {topic && (
              <div className="absolute top-6 left-6 max-w-[70%] bg-black/60 backdrop-blur-sm px-4 py-2.5 rounded-xl">
                <span className="font-semibold text-white text-xl truncate">{topic}</span>
              </div>
            )}

            {/* Recording indicator & duration - top right */}
            <div className="absolute top-6 right-6 flex items-center gap-3">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <Circle
                  className={cn(
                    'w-3 h-3 fill-current',
                    isRecording ? 'text-red-500 animate-pulse' : 'text-yellow-500'
                  )}
                />
                <span className="text-sm font-medium">
                  {isRecording ? t('recording.rec') : t('recording.paused')}
                </span>
              </div>
              <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <span className="font-mono text-xl">{formatDuration(duration)}</span>
              </div>
            </div>

            {/* Minimize button - bottom right */}
            <button
              onClick={toggleMaximize}
              className="absolute bottom-6 right-6 p-3 rounded-xl bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-all"
              title="Exit fullscreen (ESC)"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>

          {/* Controls at bottom */}
          <div className="p-6 bg-black/80 flex items-center justify-center gap-3">
            {isRecording && (
              <>
                <button
                  onClick={onPause}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-yellow-500 hover:bg-yellow-600 text-black transition-all active:scale-95"
                >
                  <Pause className="w-5 h-5" />
                  {t('recording.pause')}
                </button>
                <button
                  onClick={onStop}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-white/10 hover:bg-white/20 transition-all active:scale-95"
                >
                  <Square className="w-5 h-5" />
                  {t('recording.stop')}
                </button>
              </>
            )}

            {isPaused && (
              <>
                <button
                  onClick={onResume}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-green-500 hover:bg-green-600 transition-all active:scale-95"
                >
                  <Play className="w-5 h-5" />
                  {t('recording.resume')}
                </button>
                <button
                  onClick={onStop}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-white/10 hover:bg-white/20 transition-all active:scale-95"
                >
                  <Square className="w-5 h-5" />
                  {t('recording.stop')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Normal view */}
      <div className={cn('glass-card p-4 md:p-5', isMaximized && 'invisible')}>
        {/* Recording Screen */}
        <div 
          ref={containerRef}
          className="relative bg-slate-900/50 rounded-xl overflow-hidden mb-4 flex items-center justify-center"
          style={{ aspectRatio: '16/9' }}
        >
          {/* Video preview during recording */}
          {recordingType === 'video' && mediaStream && !isStopped && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          )}

          {/* Audio visualization during recording */}
          {recordingType === 'audio' && isActive && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-500/30 to-pink-600/30 flex items-center justify-center animate-pulse">
                <Mic className="w-12 h-12 text-rose-400" />
              </div>
            </div>
          )}

          {/* Playback after stopped */}
          {isStopped && recordedUrl && (
            recordingType === 'video' ? (
              <video
                ref={playbackRef as React.RefObject<HTMLVideoElement>}
                src={recordedUrl}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-4 w-full px-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500/20 to-pink-600/20 flex items-center justify-center">
                  <Mic className="w-10 h-10 text-rose-400" />
                </div>
                <audio
                  ref={playbackRef as React.RefObject<HTMLAudioElement>}
                  src={recordedUrl}
                  controls
                  className="w-full max-w-2xl"
                />
              </div>
            )
          )}

          {/* IDLE STATE: Topic selection */}
          {isIdle && !isStopped && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 md:p-6">
              {/* No topic - show selection buttons */}
              {!topic && !isCreatingTopic && (
                <div className="text-center">
                  <p className="text-slate-400 mb-4 md:mb-6 text-base md:text-lg">{t('topic.question')}</p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 md:gap-3">
                    <button
                      onClick={handleGetTopic}
                      disabled={isLoadingTopic}
                      className={cn(
                        'flex items-center gap-1.5 md:gap-2 px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl font-medium text-sm md:text-base',
                        'bg-gradient-to-r from-amber-400 to-orange-500 text-black',
                        'hover:from-amber-500 hover:to-orange-600',
                        'transition-all hover:shadow-lg hover:shadow-orange-500/25',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      <RefreshCcw className={cn('w-4 h-4 md:w-5 md:h-5', isLoadingTopic && 'animate-spin')} />
                      {t('topic.getTopic')}
                    </button>
                    <span className="text-slate-500 text-sm md:text-base">{t('topic.or')}</span>
                    <button
                      onClick={() => setIsCreatingTopic(true)}
                      className={cn(
                        'flex items-center gap-1.5 md:gap-2 px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl font-medium text-sm md:text-base',
                        'bg-white/10 border border-white/20',
                        'hover:bg-white/20 transition-all'
                      )}
                    >
                      <Plus className="w-4 h-4 md:w-5 md:h-5" />
                      {t('topic.create')}
                    </button>
                  </div>
                </div>
              )}

              {/* Creating custom topic */}
              {!topic && isCreatingTopic && (
                <div className="text-center w-full max-w-lg px-2">
                  <p className="text-slate-400 mb-3 md:mb-4 text-sm md:text-base">{t('topic.enterTopic')}</p>
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateTopic()}
                        placeholder={t('topic.placeholder')}
                        className={cn(
                          'w-full px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl text-base md:text-lg',
                          'bg-white/10 border border-white/20',
                          'placeholder:text-slate-500 text-white',
                          'focus:outline-none focus:ring-2 focus:ring-rose-500/50'
                        )}
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={handleCreateTopic}
                      disabled={!customTopic.trim()}
                      className={cn(
                        'px-3 py-2 md:px-5 md:py-3 rounded-lg md:rounded-xl font-medium text-sm md:text-base',
                        'bg-gradient-to-r from-rose-500 to-pink-600',
                        'hover:from-rose-600 hover:to-pink-700',
                        'transition-all disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      {t('topic.use')}
                    </button>
                    <button
                      onClick={() => setIsCreatingTopic(false)}
                      className="p-2 md:p-3 rounded-lg md:rounded-xl bg-white/10 hover:bg-white/20 transition-all"
                    >
                      <Undo2 className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Topic selected - LARGE display */}
              {topic && (
                <div className="text-center animate-fade-in px-4">
                  <div className="mb-3 md:mb-4">
                    <h2 className="text-2xl md:text-4xl font-bold text-white">{topic}</h2>
                  </div>
                  <div className="flex items-center justify-center gap-2 md:gap-3">
                    <button
                      onClick={handleGetTopic}
                      disabled={isLoadingTopic}
                      className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-md md:rounded-lg text-xs md:text-sm bg-white/10 hover:bg-white/20 transition-all"
                    >
                      <RefreshCcw className={cn('w-3.5 h-3.5 md:w-4 md:h-4', isLoadingTopic && 'animate-spin')} />
                      {t('topic.refresh')}
                    </button>
                    <button
                      onClick={handleClearTopic}
                      className="p-1.5 md:p-2 rounded-md md:rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                      title={t('recording.back')}
                    >
                      <Undo2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RECORDING/PAUSED: Topic at top-left (small) */}
          {isActive && topic && (
            <div className="absolute top-3 left-3 max-w-[60%] bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <span className="font-semibold text-white text-sm truncate">{topic}</span>
            </div>
          )}

          {/* Recording indicator & duration - top right */}
          {isActive && (
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg">
                <Circle
                  className={cn(
                    'w-2.5 h-2.5 fill-current',
                    isRecording ? 'text-red-500 animate-pulse' : 'text-yellow-500'
                  )}
                />
                <span className="text-xs font-medium">
                  {isRecording ? t('recording.rec') : t('recording.paused')}
                </span>
              </div>
              <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg">
                <span className="font-mono text-sm">{formatDuration(duration)}</span>
              </div>
            </div>
          )}

          {/* Maximize button for video recording */}
          {isActive && recordingType === 'video' && (
            <button
              onClick={toggleMaximize}
              className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-all"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          {/* Duration for stopped state */}
          {isStopped && (
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg">
              <span className="font-mono text-sm">{formatDuration(duration)}</span>
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 md:gap-3">
            {isIdle && (
              <>
                {/* Start Button */}
                <button
                  onClick={handleStart}
                  disabled={!topic}
                  className={cn(
                    'flex items-center gap-1.5 md:gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-lg md:rounded-xl font-semibold text-sm md:text-base',
                    recordMode === 'video'
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 hover:shadow-violet-500/25'
                      : 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 hover:shadow-rose-500/25',
                    'transition-all hover:shadow-lg active:scale-95',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {recordMode === 'video' ? <Video className="w-4 h-4 md:w-5 md:h-5" /> : <Mic className="w-4 h-4 md:w-5 md:h-5" />}
                  {t('recording.start')}
                </button>

                {/* Settings Button */}
                <button
                  onClick={toggleSettings}
                  className="p-2 md:p-2.5 rounded-lg md:rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                  title={t('settings.title')}
                >
                  <Settings className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </>
            )}

            {isRecording && (
              <div className="flex items-center justify-center gap-2 md:gap-3 w-full">
                <button
                  onClick={onPause}
                  className="flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-lg md:rounded-xl font-medium text-sm md:text-base bg-yellow-500 hover:bg-yellow-600 text-black transition-all active:scale-95"
                >
                  <Pause className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  {t('recording.pause')}
                </button>
                <button
                  onClick={onStop}
                  className="flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-lg md:rounded-xl font-medium text-sm md:text-base bg-white/10 hover:bg-white/20 transition-all active:scale-95"
                >
                  <Square className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  {t('recording.stop')}
                </button>
              </div>
            )}

            {isPaused && (
              <div className="flex items-center justify-center gap-2 md:gap-3 w-full">
                <button
                  onClick={onResume}
                  className="flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-lg md:rounded-xl font-medium text-sm md:text-base bg-green-500 hover:bg-green-600 transition-all active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  {t('recording.resume')}
                </button>
                <button
                  onClick={onStop}
                  className="flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-lg md:rounded-xl font-medium text-sm md:text-base bg-white/10 hover:bg-white/20 transition-all active:scale-95"
                >
                  <Square className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  {t('recording.stop')}
                </button>
              </div>
            )}

            {isStopped && (
              <div className="flex items-center justify-center w-full">
                <button
                  onClick={onReset}
                  className={cn(
                    'flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-lg md:rounded-xl font-semibold text-sm md:text-base',
                    'bg-gradient-to-r from-rose-500 to-pink-600',
                    'hover:from-rose-600 hover:to-pink-700',
                    'transition-all hover:shadow-lg hover:shadow-rose-500/25 active:scale-95'
                  )}
                >
                  <Undo2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  {t('recording.back')}
                </button>
              </div>
            )}
        </div>

      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          />
          
          {/* Modal */}
          <div className="relative w-full max-w-sm bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="font-semibold text-white">{t('settings.title')}</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Recording Mode */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  {t('settings.mode')}
                </label>
                <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/10">
                  <button
                    onClick={() => setRecordMode('video')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all',
                      recordMode === 'video'
                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    )}
                  >
                    <Video className="w-4 h-4" />
                    {t('recording.video')}
                  </button>
                  <button
                    onClick={() => setRecordMode('audio')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all',
                      recordMode === 'audio'
                        ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    )}
                  >
                    <Mic className="w-4 h-4" />
                    {t('recording.audio')}
                  </button>
                </div>
              </div>

              {/* Microphone Selection */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  <Mic className="w-4 h-4 inline mr-2" />
                  {t('settings.microphone')}
                </label>
                <select
                  value={selectedAudioDevice}
                  onChange={(e) => setSelectedAudioDevice(e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm',
                    'bg-white/10 border border-white/20 text-white',
                    'focus:outline-none focus:ring-2 focus:ring-rose-500/50',
                    'cursor-pointer'
                  )}
                >
                  {audioDevices.length === 0 ? (
                    <option value="">{t('settings.noDevices')}</option>
                  ) : (
                    audioDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId} className="bg-slate-800">
                        {device.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Camera Selection (only shown when video mode) */}
              {recordMode === 'video' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    <Video className="w-4 h-4 inline mr-2" />
                    {t('settings.camera')}
                  </label>
                  <select
                    value={selectedVideoDevice}
                    onChange={(e) => setSelectedVideoDevice(e.target.value)}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      'bg-white/10 border border-white/20 text-white',
                      'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
                      'cursor-pointer'
                    )}
                  >
                    {videoDevices.length === 0 ? (
                      <option value="">{t('settings.noDevices')}</option>
                    ) : (
                      videoDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId} className="bg-slate-800">
                          {device.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
