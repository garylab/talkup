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
  onSwitchAudioDevice: (deviceId: string) => Promise<void>;
  onSwitchVideoDevice: (deviceId: string) => Promise<void>;
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
  onSwitchAudioDevice,
  onSwitchVideoDevice,
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

  // Load available media devices (without requesting permission)
  const loadDevices = useCallback(async (withPermission = false) => {
    try {
      // Only request permission if explicitly asked (after user clicks Start)
      if (withPermission) {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
          stream.getTracks().forEach(track => track.stop());
        }).catch(() => {
          // Try audio only if video fails
          return navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            stream.getTracks().forEach(track => track.stop());
          });
        });
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
        }));
      
      const videoInputs = devices
        .filter(device => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
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

  // Load devices on mount (without requesting permission - labels may be generic)
  useEffect(() => {
    loadDevices(false);
  }, [loadDevices]);

  // Reload devices with proper labels when recording starts (permission granted)
  useEffect(() => {
    if (mediaStream && !devicesLoaded) {
      loadDevices(false); // Permission already granted, just enumerate
    }
    // When we get a media stream, reload to get proper labels
    if (mediaStream) {
      loadDevices(false);
    }
  }, [mediaStream, devicesLoaded, loadDevices]);

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

  // Track previous state to detect when returning from stopped
  const prevStateRef = useRef<RecorderState>(state);
  
  // Auto-load topic on mount
  useEffect(() => {
    if (!topic && isIdle) {
      handleGetTopic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-load new topic when returning from stopped state
  useEffect(() => {
    if (prevStateRef.current === 'stopped' && state === 'idle') {
      handleGetTopic();
    }
    prevStateRef.current = state;
  }, [state, handleGetTopic]);

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

  // Handle device selection - updates settings and switches device if recording
  const handleAudioDeviceSelect = useCallback((deviceId: string) => {
    setSelectedAudioDevice(deviceId);
    // If recording, switch the device on the active stream
    if (isRecording || isPaused) {
      onSwitchAudioDevice(deviceId);
    }
  }, [setSelectedAudioDevice, isRecording, isPaused, onSwitchAudioDevice]);

  const handleVideoDeviceSelect = useCallback((deviceId: string) => {
    setSelectedVideoDevice(deviceId);
    // If recording, switch the device on the active stream
    if (isRecording || isPaused) {
      onSwitchVideoDevice(deviceId);
    }
  }, [setSelectedVideoDevice, isRecording, isPaused, onSwitchVideoDevice]);

  // Dropdown component for device selection
  const DeviceDropdown = ({ 
    type, 
    devices, 
    selected, 
    onSelect, 
    isOpen, 
    onToggle,
    icon: Icon 
  }: {
    type: 'camera' | 'mic';
    devices: MediaDeviceOption[];
    selected: string | null;
    onSelect: (id: string) => void;
    isOpen: boolean;
    onToggle: () => void;
    icon: typeof Video | typeof Mic;
  }) => (
    <div className="relative" data-dropdown>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-sm',
          'bg-white/[0.04] text-slate-400',
          'hover:bg-white/[0.08] hover:text-slate-300 transition-colors',
          isOpen && 'bg-white/[0.08] text-slate-300'
        )}
      >
        <Icon className="w-4 h-4" />
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 dropdown-menu z-[100] animate-fade-in">
          <div className="py-1 max-h-48 overflow-y-auto">
            {devices.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">{t('settings.noDevices')}</div>
            ) : (
              devices.map((device) => (
                <button
                  key={device.deviceId}
                  onClick={() => {
                    onSelect(device.deviceId);
                    onToggle();
                  }}
                  className={cn(
                    'dropdown-item',
                    device.deviceId === selected && 'dropdown-item-active'
                  )}
                >
                  <Check className={cn(
                    'w-4 h-4 shrink-0',
                    device.deviceId === selected ? 'opacity-100' : 'opacity-0'
                  )} />
                  <span className="line-clamp-1 text-left">{device.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

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
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-xl">
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
              <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-xl">
                <span className="font-mono text-xl">{formatDuration(duration)}</span>
              </div>
            </div>

            {/* Minimize button - bottom right */}
            <button
              onClick={toggleMaximize}
              className="absolute bottom-6 right-6 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
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
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-yellow-500 hover:bg-yellow-600 text-black transition-colors active:scale-[0.98]"
                >
                  <Pause className="w-5 h-5" />
                  {t('recording.pause')}
                </button>
                <button
                  onClick={onStop}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-red-500 hover:bg-red-600 transition-colors active:scale-[0.98]"
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
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-green-500 hover:bg-green-600 transition-colors active:scale-[0.98]"
                >
                  <Play className="w-5 h-5" />
                  {t('recording.resume')}
                </button>
                <button
                  onClick={onStop}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-red-500 hover:bg-red-600 transition-colors active:scale-[0.98]"
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
      <div className={cn('card p-4 md:p-5', isMaximized && 'invisible')}>
        {/* Recording Screen */}
        <div 
          ref={containerRef}
          className="relative bg-slate-950 rounded-xl overflow-hidden mb-4 flex items-center justify-center"
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
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-500/20 to-pink-600/20 flex items-center justify-center animate-pulse">
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
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500/15 to-pink-600/15 flex items-center justify-center">
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
                          'w-full px-4 py-3 rounded-xl text-base md:text-lg',
                          'bg-white/[0.06] placeholder:text-slate-600 text-white',
                          'focus:outline-none focus:bg-white/[0.08] focus:ring-1 focus:ring-white/20'
                        )}
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={handleCreateTopic}
                      disabled={!customTopic.trim()}
                      className={cn(
                        'px-4 py-3 rounded-xl font-medium text-sm md:text-base',
                        'bg-gradient-to-r from-rose-500 to-pink-600',
                        'hover:from-rose-600 hover:to-pink-700',
                        'transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]'
                      )}
                    >
                      {t('topic.use')}
                    </button>
                    <button
                      onClick={() => setIsCreatingTopic(false)}
                      className="p-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
                    >
                      <Undo2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Topic display - always show */
                <div className="text-center animate-fade-in px-4">
                  <div className="mb-4 md:mb-5">
                    <h2 className="text-2xl md:text-4xl font-bold text-white">
                      {topic || (isLoadingTopic ? '...' : '')}
                    </h2>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={handleGetTopic}
                      disabled={isLoadingTopic}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                        'bg-amber-500/90 text-black hover:bg-amber-400',
                        'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]'
                      )}
                    >
                      <RefreshCcw className={cn('w-4 h-4', isLoadingTopic && 'animate-spin')} />
                      {t('topic.refresh')}
                    </button>
                    <button
                      onClick={() => setIsCreatingTopic(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.08] hover:bg-white/[0.12] transition-colors active:scale-[0.98]"
                    >
                      <Plus className="w-4 h-4" />
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
              <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg">
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
              <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg">
                <span className="font-mono text-sm">{formatDuration(duration)}</span>
              </div>
            </div>
          )}

          {/* Maximize button for video recording */}
          {isActive && recordingType === 'video' && (
            <button
              onClick={toggleMaximize}
              className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/60 hover:bg-black/80 transition-colors"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          {/* Duration for stopped state */}
          {isStopped && (
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg">
              <span className="font-mono text-sm">{formatDuration(duration)}</span>
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Controls Toolbar */}
        <div className="flex items-center justify-between gap-3">
          {isIdle && (
            <>
              {/* Left side: Start Button + Mode Toggle */}
              <div className="flex items-center gap-2">
                {/* Start Button */}
                <button
                  onClick={handleStart}
                  disabled={!topic}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm',
                    recordMode === 'video'
                      ? 'bg-violet-500 hover:bg-violet-600'
                      : 'bg-rose-500 hover:bg-rose-600',
                    'transition-colors active:scale-[0.98]',
                    'disabled:opacity-40 disabled:cursor-not-allowed'
                  )}
                >
                  <Play className="w-4 h-4" />
                  {t('recording.start')}
                </button>

                {/* Video/Audio Mode Toggle */}
                <div className="flex items-center bg-white/[0.04] rounded-xl p-1">
                  <button
                    onClick={() => setRecordMode('video')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      recordMode === 'video'
                        ? 'bg-violet-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    )}
                  >
                    <Video className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('recording.video')}</span>
                  </button>
                  <button
                    onClick={() => setRecordMode('audio')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      recordMode === 'audio'
                        ? 'bg-rose-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    )}
                  >
                    <Mic className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('recording.audio')}</span>
                  </button>
                </div>
              </div>

              {/* Right side: Device Dropdowns */}
              <div className="flex items-center gap-2">
                {recordMode === 'video' && (
                  <DeviceDropdown
                    type="camera"
                    devices={videoDevices}
                    selected={selectedVideoDevice}
                    onSelect={handleVideoDeviceSelect}
                    isOpen={showCameraDropdown}
                    onToggle={() => {
                      setShowCameraDropdown(!showCameraDropdown);
                      setShowMicDropdown(false);
                    }}
                    icon={Video}
                  />
                )}
                <DeviceDropdown
                  type="mic"
                  devices={audioDevices}
                  selected={selectedAudioDevice}
                  onSelect={handleAudioDeviceSelect}
                  isOpen={showMicDropdown}
                  onToggle={() => {
                    setShowMicDropdown(!showMicDropdown);
                    setShowCameraDropdown(false);
                  }}
                  icon={Mic}
                />
              </div>
            </>
          )}

          {isRecording && (
            <>
              {/* Left side: Recording controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onPause}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium text-sm bg-yellow-500 hover:bg-yellow-600 text-black transition-colors active:scale-[0.98]"
                >
                  <Pause className="w-4 h-4" />
                  {t('recording.pause')}
                </button>
                <button
                  onClick={onStop}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium text-sm bg-red-500 hover:bg-red-600 transition-colors active:scale-[0.98]"
                >
                  <Square className="w-4 h-4" />
                  {t('recording.stop')}
                </button>
              </div>

              {/* Right side: Device Dropdowns */}
              <div className="flex items-center gap-2">
                {recordingType === 'video' && (
                  <DeviceDropdown
                    type="camera"
                    devices={videoDevices}
                    selected={selectedVideoDevice}
                    onSelect={handleVideoDeviceSelect}
                    isOpen={showCameraDropdown}
                    onToggle={() => {
                      setShowCameraDropdown(!showCameraDropdown);
                      setShowMicDropdown(false);
                    }}
                    icon={Video}
                  />
                )}
                <DeviceDropdown
                  type="mic"
                  devices={audioDevices}
                  selected={selectedAudioDevice}
                  onSelect={handleAudioDeviceSelect}
                  isOpen={showMicDropdown}
                  onToggle={() => {
                    setShowMicDropdown(!showMicDropdown);
                    setShowCameraDropdown(false);
                  }}
                  icon={Mic}
                />
              </div>
            </>
          )}

          {isPaused && (
            <>
              {/* Left side: Recording controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onResume}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium text-sm bg-green-500 hover:bg-green-600 transition-colors active:scale-[0.98]"
                >
                  <Play className="w-4 h-4" />
                  {t('recording.resume')}
                </button>
                <button
                  onClick={onStop}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium text-sm bg-red-500 hover:bg-red-600 transition-colors active:scale-[0.98]"
                >
                  <Square className="w-4 h-4" />
                  {t('recording.stop')}
                </button>
              </div>

              {/* Right side: Device Dropdowns */}
              <div className="flex items-center gap-2">
                {recordingType === 'video' && (
                  <DeviceDropdown
                    type="camera"
                    devices={videoDevices}
                    selected={selectedVideoDevice}
                    onSelect={handleVideoDeviceSelect}
                    isOpen={showCameraDropdown}
                    onToggle={() => {
                      setShowCameraDropdown(!showCameraDropdown);
                      setShowMicDropdown(false);
                    }}
                    icon={Video}
                  />
                )}
                <DeviceDropdown
                  type="mic"
                  devices={audioDevices}
                  selected={selectedAudioDevice}
                  onSelect={handleAudioDeviceSelect}
                  isOpen={showMicDropdown}
                  onToggle={() => {
                    setShowMicDropdown(!showMicDropdown);
                    setShowCameraDropdown(false);
                  }}
                  icon={Mic}
                />
              </div>
            </>
          )}

          {isStopped && (
            <div className="flex items-center justify-center w-full">
              <button
                onClick={onReset}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm',
                  'bg-gradient-to-r from-rose-500 to-pink-600',
                  'hover:from-rose-600 hover:to-pink-700',
                  'transition-all active:scale-[0.98]'
                )}
              >
                <Undo2 className="w-4 h-4" />
                {t('recording.back')}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
