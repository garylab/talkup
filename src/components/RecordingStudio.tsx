'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Mic, Video, Pause, Play, Square, Circle, Plus, Undo2, RefreshCcw, Maximize2, Minimize2, ChevronDown, Check } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { api } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
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
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isLoadingTopic, setIsLoadingTopic] = useState(false);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);
  
  // Settings from localStorage
  const { 
    settings, 
    setRecordMode, 
    setSelectedAudioDevice, 
    setSelectedVideoDevice 
  } = useSettings();
  
  // Local UI state
  const [audioDevices, setAudioDevices] = useState<MediaDeviceOption[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceOption[]>([]);
  const [showMicDropdown, setShowMicDropdown] = useState(false);
  const [showCameraDropdown, setShowCameraDropdown] = useState(false);
  const [devicesLoaded, setDevicesLoaded] = useState(false);
  
  // Derived values from settings
  const recordMode = settings.recordMode;
  const selectedAudioDevice = settings.selectedAudioDevice;
  const selectedVideoDevice = settings.selectedVideoDevice;

  // Set media stream on video elements
  useEffect(() => {
    if (mediaStream && recordingType === 'video') {
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      if (fullscreenVideoRef.current) {
        fullscreenVideoRef.current.srcObject = mediaStream;
      }
    }
  }, [mediaStream, recordingType]);

  // Also update fullscreen video when maximized state changes
  useEffect(() => {
    if (isMaximized && fullscreenVideoRef.current && mediaStream && recordingType === 'video') {
      fullscreenVideoRef.current.srcObject = mediaStream;
    }
  }, [isMaximized, mediaStream, recordingType]);

  // Handle ESC key to exit maximized mode or close dropdowns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showMicDropdown || showCameraDropdown) {
          setShowMicDropdown(false);
          setShowCameraDropdown(false);
        } else if (isMaximized) {
          setIsMaximized(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized, showMicDropdown, showCameraDropdown]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setShowMicDropdown(false);
        setShowCameraDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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
      setDevicesLoaded(true);

      // Set default selections if not already set
      if (!selectedAudioDevice && audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }
      if (!selectedVideoDevice && videoInputs.length > 0) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
      setDevicesLoaded(true);
    }
  }, [selectedAudioDevice, selectedVideoDevice, setSelectedAudioDevice, setSelectedVideoDevice]);

  // Load devices on mount
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

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

  // Auto-load topic on mount
  useEffect(() => {
    if (!topic && isIdle) {
      handleGetTopic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateTopic = () => {
    if (customTopic.trim()) {
      onTopicChange(customTopic.trim());
      setCustomTopic('');
      setIsCreatingTopic(false);
    }
  };

  const handleStart = () => {
    onStart(recordMode, selectedAudioDevice || undefined, selectedVideoDevice || undefined);
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
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
                ref={fullscreenVideoRef}
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
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg h-9">
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
              <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg h-9 flex items-center">
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
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-red-500/80 hover:bg-red-500 transition-all active:scale-95"
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
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-red-500/80 hover:bg-red-500 transition-all active:scale-95"
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

          {/* IDLE STATE: Topic display */}
          {isIdle && !isStopped && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 py-6 md:p-6">
              {/* Creating custom topic - overlay */}
              {isCreatingTopic ? (
                <div className="text-center w-full max-w-lg px-2 animate-fade-in">
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
              ) : (
                /* Topic display - always show */
                <div className="text-center animate-fade-in px-4">
                  <div className="mb-3 md:mb-4">
                    <h2 className="text-2xl md:text-4xl font-bold text-white">
                      {topic || (isLoadingTopic ? '...' : '')}
                    </h2>
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
                      onClick={() => setIsCreatingTopic(true)}
                      className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-md md:rounded-lg text-xs md:text-sm bg-white/10 hover:bg-white/20 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      {t('topic.create')}
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
              <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg h-7">
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
              <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg h-7 flex items-center">
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

        {/* Controls Toolbar */}
        <div className="flex items-center justify-between gap-2 md:gap-3">
            {isIdle && (
              <>
                {/* Left side: Start Button + Mode Toggle */}
                <div className="flex items-center gap-2 md:gap-3">
                  {/* Start Button */}
                  <button
                    onClick={handleStart}
                    disabled={!topic}
                    className={cn(
                      'flex items-center gap-1 md:gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-semibold text-xs md:text-sm',
                      recordMode === 'video'
                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 hover:shadow-violet-500/25'
                        : 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 hover:shadow-rose-500/25',
                      'transition-all hover:shadow-lg active:scale-95',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <Play className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    {t('recording.start')}
                  </button>

                  {/* Video/Audio Mode Toggle */}
                  <div className="flex items-center bg-white/5 rounded-lg border border-white/10">
                    <button
                      onClick={() => setRecordMode('video')}
                      className={cn(
                        'flex items-center gap-1 md:gap-1.5 px-2 py-1.5 md:px-2.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all',
                        recordMode === 'video'
                          ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-white/10'
                      )}
                    >
                      <Video className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      <span className="hidden sm:inline">{t('recording.video')}</span>
                    </button>
                    <button
                      onClick={() => setRecordMode('audio')}
                      className={cn(
                        'flex items-center gap-1 md:gap-1.5 px-2 py-1.5 md:px-2.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all',
                        recordMode === 'audio'
                          ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-white/10'
                      )}
                    >
                      <Mic className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      <span className="hidden sm:inline">{t('recording.audio')}</span>
                    </button>
                  </div>
                </div>

                {/* Right side: Device Dropdowns */}
                <div className="flex items-center gap-2 md:gap-3">
                  {/* Camera Dropdown (only shown when video mode) */}
                  {recordMode === 'video' && (
                    <div className="relative" data-dropdown>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCameraDropdown(!showCameraDropdown);
                          setShowMicDropdown(false);
                        }}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1.5 md:px-2.5 md:py-2 rounded-lg',
                          'bg-white/5 border border-white/10 text-slate-300',
                          'hover:bg-white/10 hover:text-white transition-all',
                          showCameraDropdown && 'bg-white/10 text-white'
                        )}
                      >
                        <Video className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <ChevronDown className={cn('w-3 h-3 transition-transform', showCameraDropdown && 'rotate-180')} />
                      </button>
                      
                      {showCameraDropdown && (
                        <div className="absolute top-full right-0 mt-1 w-64 bg-slate-950 border border-white/20 rounded-lg shadow-2xl z-[100] animate-fade-in">
                          <div className="p-1.5 max-h-48 overflow-y-auto">
                            {videoDevices.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-slate-500">{t('settings.noDevices')}</div>
                            ) : (
                              videoDevices.map((device) => (
                                <button
                                  key={device.deviceId}
                                  onClick={() => {
                                    setSelectedVideoDevice(device.deviceId);
                                    setShowCameraDropdown(false);
                                  }}
                                  className={cn(
                                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all',
                                    device.deviceId === selectedVideoDevice
                                      ? 'bg-violet-500/20 text-violet-300'
                                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                  )}
                                >
                                  <Check className={cn(
                                    'w-4 h-4 shrink-0',
                                    device.deviceId === selectedVideoDevice ? 'opacity-100' : 'opacity-0'
                                  )} />
                                  <span className="line-clamp-1 text-left">{device.label}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Microphone Dropdown */}
                  <div className="relative" data-dropdown>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMicDropdown(!showMicDropdown);
                        setShowCameraDropdown(false);
                      }}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1.5 md:px-2.5 md:py-2 rounded-lg',
                        'bg-white/5 border border-white/10 text-slate-300',
                        'hover:bg-white/10 hover:text-white transition-all',
                        showMicDropdown && 'bg-white/10 text-white'
                      )}
                    >
                      <Mic className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      <ChevronDown className={cn('w-3 h-3 transition-transform', showMicDropdown && 'rotate-180')} />
                    </button>
                    
                    {showMicDropdown && (
                      <div className="absolute top-full right-0 mt-1 w-64 bg-slate-950 border border-white/20 rounded-lg shadow-2xl z-[100] animate-fade-in">
                        <div className="p-1.5 max-h-48 overflow-y-auto">
                          {audioDevices.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-slate-500">{t('settings.noDevices')}</div>
                          ) : (
                            audioDevices.map((device) => (
                              <button
                                key={device.deviceId}
                                onClick={() => {
                                  setSelectedAudioDevice(device.deviceId);
                                  setShowMicDropdown(false);
                                }}
                                className={cn(
                                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all',
                                  device.deviceId === selectedAudioDevice
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                )}
                              >
                                <Check className={cn(
                                  'w-4 h-4 shrink-0',
                                  device.deviceId === selectedAudioDevice ? 'opacity-100' : 'opacity-0'
                                )} />
                                <span className="line-clamp-1 text-left">{device.label}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
                  className="flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-lg md:rounded-xl font-medium text-sm md:text-base bg-red-500/80 hover:bg-red-500 transition-all active:scale-95"
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
                  className="flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-lg md:rounded-xl font-medium text-sm md:text-base bg-red-500/80 hover:bg-red-500 transition-all active:scale-95"
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
    </>
  );
}
