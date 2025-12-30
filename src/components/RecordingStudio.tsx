'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Mic, Video, Pause, Play, Square, Plus, Undo2, RefreshCcw, SwitchCamera, ChevronRight } from 'lucide-react';
import { NewsPanel } from './NewsPanel';
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
  locale: string;
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
  locale,
}: RecordingStudioProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  
  const [isLoadingTopic, setIsLoadingTopic] = useState(false);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [showNewsPanel, setShowNewsPanel] = useState(false);
  const [useFrontCamera, setUseFrontCamera] = useState(true);
  const [cameraCount, setCameraCount] = useState(0);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  
  // Settings from localStorage
  const { settings, setRecordMode } = useSettings();
  const recordMode = settings.recordMode;

  // Set media stream on video elements
  useEffect(() => {
    if (mediaStream && recordingType === 'video' && videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream, recordingType]);

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
    if (mediaStream || previewStream) {
      countCameras();
    }
  }, [mediaStream, previewStream]);

  // Start/stop preview stream when video mode is selected in idle state
  useEffect(() => {
    let isMounted = true;
    
    const startPreview = async () => {
      if (state !== 'idle' || recordMode !== 'video') {
        if (previewStream) {
          previewStream.getTracks().forEach(track => track.stop());
          setPreviewStream(null);
        }
        return;
      }
      
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
    onStart(recordMode, undefined, useFrontCamera ? 'user' : 'environment');
  };

  // Flip camera (front/back) - only works before recording starts
  const handleFlipCamera = useCallback(() => {
    if (!isIdle) return;
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
    setUseFrontCamera(prev => !prev);
  }, [isIdle, previewStream]);

  return (
    <>
      {/* Camera-style full screen layout */}
      <div className="relative h-full bg-black overflow-hidden">
        {/* Main viewfinder area - full height */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Video preview - idle with preview stream */}
          {isIdle && recordMode === 'video' && previewStream && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: useFrontCamera ? 'scaleX(-1)' : 'none' }}
            />
          )}

          {/* Video during recording */}
          {!isIdle && recordingType === 'video' && mediaStream && !isStopped && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: useFrontCamera ? 'scaleX(-1)' : 'none' }}
            />
          )}

          {/* Audio mode background */}
          {(recordMode === 'audio' || recordingType === 'audio') && !isStopped && (
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-black" />
          )}

          {/* Audio visualization during recording */}
          {recordingType === 'audio' && isActive && (
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className={cn(
                'w-32 h-32 rounded-full flex items-center justify-center',
                'bg-white/10',
                isRecording && 'animate-pulse'
              )}>
                <Mic className="w-16 h-16 text-white" />
              </div>
            </div>
          )}

          {/* Playback after stopped */}
          {isStopped && recordedUrl && (
            recordingType === 'video' ? (
              <video
                key={recordedUrl}
                ref={playbackRef as React.RefObject<HTMLVideoElement>}
                src={recordedUrl}
                controls
                playsInline
                autoPlay
                muted={false}
                className="absolute inset-0 w-full h-full object-contain bg-black z-20"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 w-full px-8 z-20 bg-black">
                <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center">
                  <Mic className="w-12 h-12 text-white" />
                </div>
                <audio
                  key={recordedUrl}
                  ref={playbackRef as React.RefObject<HTMLAudioElement>}
                  src={recordedUrl}
                  controls
                  autoPlay
                  className="w-full max-w-sm"
                />
              </div>
            )
          )}

          {/* Topic overlay - IDLE state */}
          {isIdle && !isStopped && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              {isCreatingTopic ? (
                <div className="text-center w-full max-w-sm px-4 animate-fade-in">
                  <p className="text-zinc-400 mb-4 text-sm">{t('topic.enterTopic')}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateTopic()}
                      placeholder={t('topic.placeholder')}
                      className="flex-1 px-4 py-3 rounded-xl text-base bg-black/60 backdrop-blur placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20"
                      autoFocus
                    />
                    <button
                      onClick={handleCreateTopic}
                      disabled={!customTopic.trim()}
                      className="px-4 py-3 rounded-xl font-semibold text-sm bg-white text-zinc-900 disabled:opacity-40 active:scale-95 transition-all"
                    >
                      {t('topic.use')}
                    </button>
                    <button
                      onClick={() => setIsCreatingTopic(false)}
                      className="p-3 rounded-xl bg-black/60 backdrop-blur active:scale-95 transition-all"
                    >
                      <Undo2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center animate-fade-in px-4">
                  {/* Topic text - clickable */}
                  <div className="mb-6">
                    {topic ? (
                      <button
                        onClick={() => setShowNewsPanel(true)}
                        className="group inline-flex items-center gap-2 active:scale-[0.98] transition-all"
                        title={t('news.title')}
                      >
                        <span 
                          className="text-3xl md:text-5xl font-bold max-w-[320px] md:max-w-lg truncate"
                          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)' }}
                        >
                          {topic}
                        </span>
                        <ChevronRight 
                          className="w-5 h-5 group-hover:translate-x-0.5 transition-all flex-shrink-0"
                          style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))' }}
                        />
                      </button>
                    ) : (
                      <span className="text-xl md:text-2xl font-bold text-zinc-500">
                        {isLoadingTopic ? '...' : ''}
                      </span>
                    )}
                  </div>
                  
                  {/* Topic actions */}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={handleGetTopic}
                      disabled={isLoadingTopic}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-white/10 backdrop-blur hover:bg-white/20 disabled:opacity-50 active:scale-95 transition-all"
                    >
                      <RefreshCcw className={cn('w-4 h-4', isLoadingTopic && 'animate-spin')} />
                      {t('topic.refresh')}
                    </button>
                    <button
                      onClick={() => setIsCreatingTopic(true)}
                      className="w-10 h-10 rounded-full bg-white/10 backdrop-blur hover:bg-white/20 flex items-center justify-center active:scale-95 transition-all"
                      title={t('topic.create')}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recording overlay - top bar */}
          {isActive && (
            <div className="absolute top-4 left-0 right-0 px-4 flex items-start justify-between z-10">
              {/* Topic */}
              {topic && (
                <div className="max-w-[60%]">
                  <span className="inline-block px-3 py-1.5 bg-black/60 backdrop-blur rounded-full text-xs font-medium truncate">
                    {topic}
                  </span>
                </div>
              )}
              
              {/* Duration */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur rounded-full">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  isRecording ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'
                )} />
                <span className="font-mono text-xs tabular-nums">{formatDuration(duration)}</span>
              </div>
            </div>
          )}

          {/* Stopped state - duration */}
          {isStopped && (
            <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur rounded-full">
              <span className="font-mono text-sm tabular-nums">{formatDuration(duration)}</span>
            </div>
          )}

          {/* Camera flip button - top right area */}
          {isIdle && recordMode === 'video' && cameraCount > 1 && (
            <button
              onClick={handleFlipCamera}
              className="absolute top-4 right-4 p-3 rounded-full bg-black/40 backdrop-blur hover:bg-black/60 active:scale-95 transition-all z-10"
              title="Flip camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}

          {/* Error display */}
          {error && (
            <div className="absolute bottom-28 left-4 right-4 p-3 bg-red-500/20 backdrop-blur rounded-xl text-red-400 text-sm text-center z-20">
              {error}
            </div>
          )}
        </div>

        {/* Bottom controls bar - floating over preview, above navbar */}
        <div className="absolute left-0 right-0 px-4 py-2 z-30" style={{ bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}>
          {/* Idle state controls */}
          {isIdle && (
            <div className="flex items-center justify-center">
              {/* Video/Audio switcher - right side */}
              <div className="absolute right-4 flex items-center gap-1 p-1 rounded-full bg-zinc-800/80 backdrop-blur ring-1 ring-white/20">
                <button
                  onClick={() => setRecordMode('audio')}
                  className={cn(
                    'p-2 rounded-full transition-all',
                    recordMode === 'audio' ? 'bg-white/20' : 'hover:bg-white/10'
                  )}
                  title={t('recording.audio')}
                >
                  <Mic className={cn('w-4 h-4', recordMode === 'audio' ? 'text-white' : 'text-zinc-400')} />
                </button>
                <button
                  onClick={() => setRecordMode('video')}
                  className={cn(
                    'p-2 rounded-full transition-all',
                    recordMode === 'video' ? 'bg-white/20' : 'hover:bg-white/10'
                  )}
                  title={t('recording.video')}
                >
                  <Video className={cn('w-4 h-4', recordMode === 'video' ? 'text-white' : 'text-zinc-400')} />
                </button>
              </div>

              {/* Shutter button - center */}
              <button
                onClick={handleStart}
                disabled={!topic}
                className={cn(
                  'w-[68px] h-[68px] rounded-full',
                  'flex items-center justify-center',
                  'bg-red-500',
                  'ring-[3px] ring-white/90',
                  'active:scale-95 transition-all',
                  'disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                {recordMode === 'video' ? (
                  <Video className="w-6 h-6 text-white" />
                ) : (
                  <Mic className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
          )}

          {/* Recording controls */}
          {isRecording && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={onPause}
                className="p-4 rounded-full bg-white active:scale-95 transition-all"
              >
                <Pause className="w-6 h-6 text-zinc-900" />
              </button>
              <button
                onClick={onStop}
                className="w-[72px] h-[72px] rounded-full ring-4 ring-white/90 bg-red-500 flex items-center justify-center active:scale-95 transition-all"
              >
                <Square className="w-8 h-8 text-white fill-white" />
              </button>
            </div>
          )}

          {/* Paused controls */}
          {isPaused && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={onResume}
                className="p-4 rounded-full bg-white active:scale-95 transition-all"
              >
                <Play className="w-6 h-6 text-zinc-900" />
              </button>
              <button
                onClick={onStop}
                className="w-[72px] h-[72px] rounded-full ring-4 ring-white/90 bg-red-500 flex items-center justify-center active:scale-95 transition-all"
              >
                <Square className="w-8 h-8 text-white fill-white" />
              </button>
            </div>
          )}

          {/* Stopped controls */}
          {isStopped && (
            <div className="flex items-center justify-center">
              <button
                onClick={onReset}
                className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all"
              >
                <Undo2 className="w-5 h-5" />
                {t('recording.back')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* News Panel */}
      {showNewsPanel && topic && (
        <NewsPanel
          topic={topic}
          language={locale}
          onClose={() => setShowNewsPanel(false)}
          t={t}
        />
      )}
    </>
  );
}
