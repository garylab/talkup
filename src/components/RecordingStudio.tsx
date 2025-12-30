'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Mic, Video, Pause, Play, Square, Circle, Plus, Undo2, RefreshCcw, Maximize2, Minimize2, SwitchCamera } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { api } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import type { RecordingType } from '@/types';
import type { RecorderState } from '@/hooks/useRecorder';

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
  const [useFrontCamera, setUseFrontCamera] = useState(true);
  const [cameraCount, setCameraCount] = useState(0);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  
  // Settings from localStorage
  const { settings } = useSettings();
  const recordMode = settings.recordMode;

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

  // Handle ESC key to exit maximized mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMaximized) {
        setIsMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized]);

  // Reset maximized state when recording stops
  useEffect(() => {
    if (state === 'stopped' || state === 'idle') {
      setIsMaximized(false);
    }
  }, [state]);

  // Count available cameras
  useEffect(() => {
    const countCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameraCount(videoDevices.length);
      } catch {
        setCameraCount(0);
      }
    };
    countCameras();
    // Also update count when mediaStream or previewStream changes (permissions granted)
    if (mediaStream || previewStream) {
      countCameras();
    }
  }, [mediaStream, previewStream]);

  // Start/stop preview stream when video mode is selected in idle state
  useEffect(() => {
    let isMounted = true;
    
    const startPreview = async () => {
      if (state !== 'idle' || recordMode !== 'video') {
        // Stop preview if not in idle video mode
        if (previewStream) {
          previewStream.getTracks().forEach(track => track.stop());
          setPreviewStream(null);
        }
        return;
      }
      
      // Don't start if we already have a preview
      if (previewStream) return;
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: useFrontCamera ? 'user' : 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        
        if (isMounted && state === 'idle' && recordMode === 'video') {
          setPreviewStream(stream);
        } else {
          // Component unmounted or state changed, stop the stream
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.log('[RecordingStudio] Could not start preview:', err);
      }
    };
    
    startPreview();
    
    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, recordMode, useFrontCamera]);

  // Stop preview when recording starts
  useEffect(() => {
    if (state !== 'idle' && previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
  }, [state, previewStream]);

  // Set preview stream on video element
  useEffect(() => {
    if (previewStream && videoRef.current && state === 'idle') {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream, state]);

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
    // Pass facingMode preference via a special marker
    // We use undefined for deviceIds to use defaults, but pass facingMode info
    onStart(recordMode, undefined, useFrontCamera ? 'user' : 'environment');
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  // Flip camera (front/back) - only works before recording starts
  const handleFlipCamera = useCallback(() => {
    // Only allow switching when idle (not recording)
    if (!isIdle) return;
    // Stop current preview stream - useEffect will start new one with new camera
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
    setUseFrontCamera(prev => !prev);
  }, [isIdle, previewStream]);

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
                style={{ transform: useFrontCamera ? 'scaleX(-1)' : 'none' }}
              />
            )}

            {/* Topic at top-left */}
            {topic && (
              <div className="absolute top-6 left-6 max-w-[70%]">
                <span className="inline-block px-4 py-2 bg-black/70 backdrop-blur rounded-xl font-semibold text-lg">{topic}</span>
              </div>
            )}

            {/* Duration - top right */}
            <div className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 bg-black/70 backdrop-blur rounded-xl">
              <Circle
                className={cn(
                  'w-3 h-3 fill-current',
                  isRecording ? 'text-red-500 animate-pulse' : 'text-yellow-500'
                )}
              />
              <span className="font-mono text-lg tabular-nums">{formatDuration(duration)}</span>
            </div>

            {/* Minimize button - bottom right */}
            <button
              onClick={toggleMaximize}
              className="absolute bottom-6 right-6 p-3 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
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
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-amber-500 text-black active:scale-[0.97] transition-transform"
                >
                  <Pause className="w-5 h-5" />
                  {t('recording.pause')}
                </button>
                <button
                  onClick={onStop}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-red-500 active:scale-[0.97] transition-transform"
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
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-emerald-500 active:scale-[0.97] transition-transform"
                >
                  <Play className="w-5 h-5" />
                  {t('recording.resume')}
                </button>
                <button
                  onClick={onStop}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-red-500 active:scale-[0.97] transition-transform"
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
      <div className={cn('surface', isMaximized && 'invisible')}>
        {/* Recording Screen */}
        <div 
          ref={containerRef}
          className="relative bg-black overflow-hidden flex items-center justify-center"
          style={{ aspectRatio: '16/9' }}
        >
          {/* Video preview - before recording (preview stream) */}
          {isIdle && recordMode === 'video' && previewStream && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: useFrontCamera ? 'scaleX(-1)' : 'none' }}
            />
          )}

          {/* Video preview - during recording (media stream) */}
          {!isIdle && recordingType === 'video' && mediaStream && !isStopped && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: useFrontCamera ? 'scaleX(-1)' : 'none' }}
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
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 py-6">
              {/* Creating custom topic - overlay */}
              {isCreatingTopic ? (
                <div className="text-center w-full max-w-lg px-2 animate-fade-in">
                  <p className="text-zinc-400 mb-4 text-sm">{t('topic.enterTopic')}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateTopic()}
                      placeholder={t('topic.placeholder')}
                      className="flex-1 px-4 py-3 rounded-xl text-base bg-zinc-800 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20"
                      autoFocus
                    />
                    <button
                      onClick={handleCreateTopic}
                      disabled={!customTopic.trim()}
                      className="px-4 py-3 rounded-xl font-semibold text-sm bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
                    >
                      {t('topic.use')}
                    </button>
                    <button
                      onClick={() => setIsCreatingTopic(false)}
                      className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.97] transition-all"
                    >
                      <Undo2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Topic display - always show */
                <div className="text-center animate-fade-in px-4">
                  <h2 className="text-2xl md:text-4xl font-bold mb-5">
                    {topic || (isLoadingTopic ? '...' : '')}
                  </h2>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={handleGetTopic}
                      disabled={isLoadingTopic}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 active:scale-[0.97] transition-all"
                    >
                      <RefreshCcw className={cn('w-4 h-4', isLoadingTopic && 'animate-spin')} />
                      {t('topic.refresh')}
                    </button>
                    <button
                      onClick={() => setIsCreatingTopic(true)}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.97] transition-all"
                      title={t('topic.create')}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RECORDING/PAUSED: Topic at top-left */}
          {isActive && topic && (
            <div className="absolute top-3 left-3 max-w-[60%]">
              <span className="inline-block px-2.5 py-1 bg-black/70 backdrop-blur rounded-lg text-xs font-semibold truncate">{topic}</span>
            </div>
          )}

          {/* Duration - top right (with recording indicator dot) */}
          {isActive && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/70 backdrop-blur rounded-lg">
              <Circle
                className={cn(
                  'w-2 h-2 fill-current',
                  isRecording ? 'text-red-500 animate-pulse' : 'text-yellow-500'
                )}
              />
              <span className="font-mono text-xs tabular-nums">{formatDuration(duration)}</span>
            </div>
          )}

          {/* Camera flip button - only before recording starts, if multiple cameras */}
          {isIdle && recordMode === 'video' && cameraCount > 1 && (
            <button
              onClick={handleFlipCamera}
              className="absolute bottom-3 left-3 p-2.5 rounded-full bg-black/70 backdrop-blur hover:bg-black/90 active:scale-95 transition-all"
              title="Flip camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}

          {/* Maximize button for video recording - bottom right */}
          {isActive && recordingType === 'video' && (
            <button
              onClick={toggleMaximize}
              className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/70 backdrop-blur hover:bg-black/90 active:scale-95 transition-all"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          {/* Duration for stopped state */}
          {isStopped && (
            <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/70 backdrop-blur rounded-lg">
              <span className="font-mono text-sm tabular-nums">{formatDuration(duration)}</span>
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/10 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Controls Toolbar */}
        <div className="p-4 flex items-center justify-center gap-2">
          {isIdle && (
            /* Start Button */
            <button
              onClick={handleStart}
              disabled={!topic}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold',
                recordMode === 'video'
                  ? 'bg-violet-500 hover:bg-violet-600'
                  : 'bg-rose-500 hover:bg-rose-600',
                'active:scale-[0.97] transition-all',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              {recordMode === 'video' ? <Video className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              {recordMode === 'video' ? t('recording.startVideo') : t('recording.startAudio')}
            </button>
          )}

          {isRecording && (
            <>
              <button
                onClick={onPause}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-sm bg-amber-500 text-black active:scale-[0.97] transition-transform"
              >
                <Pause className="w-4 h-4" />
                {t('recording.pause')}
              </button>
              <button
                onClick={onStop}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-sm bg-red-500 active:scale-[0.97] transition-transform"
              >
                <Square className="w-4 h-4" />
                {t('recording.stop')}
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button
                onClick={onResume}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-sm bg-emerald-500 active:scale-[0.97] transition-transform"
              >
                <Play className="w-4 h-4" />
                {t('recording.resume')}
              </button>
              <button
                onClick={onStop}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-sm bg-red-500 active:scale-[0.97] transition-transform"
              >
                <Square className="w-4 h-4" />
                {t('recording.stop')}
              </button>
            </>
          )}

          {isStopped && (
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-rose-500 hover:bg-rose-600 active:scale-[0.97] transition-all"
            >
              <Undo2 className="w-4 h-4" />
              {t('recording.back')}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
