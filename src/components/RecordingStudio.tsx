'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Mic, Video, Pause, Play, Square, Circle, Plus, Undo2, RefreshCcw, Maximize2, Minimize2 } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { api } from '@/lib/api';
import type { RecordingType } from '@/types';
import type { RecorderState } from '@/hooks/useRecorder';

interface RecordingStudioProps {
  state: RecorderState;
  duration: number;
  mediaStream: MediaStream | null;
  recordedUrl: string | null;
  error: string | null;
  onStart: (type: RecordingType) => void;
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

  useEffect(() => {
    if (videoRef.current && mediaStream && recordingType === 'video') {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream, recordingType]);

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

  const handleStartVideo = () => {
    onStart('video');
  };

  const handleStartAudio = () => {
    onStart('audio');
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
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
              {/* No topic - show selection buttons */}
              {!topic && !isCreatingTopic && (
                <div className="text-center">
                  <p className="text-slate-400 mb-6 text-lg">{t('topic.question')}</p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={handleGetTopic}
                      disabled={isLoadingTopic}
                      className={cn(
                        'flex items-center gap-2 px-6 py-3 rounded-xl font-medium',
                        'bg-gradient-to-r from-amber-400 to-orange-500 text-black',
                        'hover:from-amber-500 hover:to-orange-600',
                        'transition-all hover:shadow-lg hover:shadow-orange-500/25',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      <RefreshCcw className={cn('w-5 h-5', isLoadingTopic && 'animate-spin')} />
                      {t('topic.getTopic')}
                    </button>
                    <span className="text-slate-500">{t('topic.or')}</span>
                    <button
                      onClick={() => setIsCreatingTopic(true)}
                      className={cn(
                        'flex items-center gap-2 px-6 py-3 rounded-xl font-medium',
                        'bg-white/10 border border-white/20',
                        'hover:bg-white/20 transition-all'
                      )}
                    >
                      <Plus className="w-5 h-5" />
                      {t('topic.create')}
                    </button>
                  </div>
                </div>
              )}

              {/* Creating custom topic */}
              {!topic && isCreatingTopic && (
                <div className="text-center w-full max-w-lg">
                  <p className="text-slate-400 mb-4">{t('topic.enterTopic')}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateTopic()}
                        placeholder={t('topic.placeholder')}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl text-lg',
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
                        'px-5 py-3 rounded-xl font-medium',
                        'bg-gradient-to-r from-rose-500 to-pink-600',
                        'hover:from-rose-600 hover:to-pink-700',
                        'transition-all disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      {t('topic.use')}
                    </button>
                    <button
                      onClick={() => setIsCreatingTopic(false)}
                      className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all"
                    >
                      <Undo2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Topic selected - LARGE display */}
              {topic && (
                <div className="text-center animate-fade-in">
                  <div className="mb-4">
                    <h2 className="text-3xl md:text-4xl font-bold text-white">{topic}</h2>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={handleGetTopic}
                      disabled={isLoadingTopic}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20 transition-all"
                    >
                      <RefreshCcw className={cn('w-4 h-4', isLoadingTopic && 'animate-spin')} />
                      {t('topic.refresh')}
                    </button>
                    <button
                      onClick={handleClearTopic}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                      title={t('recording.back')}
                    >
                      <Undo2 className="w-4 h-4" />
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
        <div className="flex items-center justify-center gap-3">
            {isIdle && (
              <>
                <button
                  onClick={handleStartVideo}
                  disabled={!topic}
                  className={cn(
                    'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold',
                    'bg-gradient-to-r from-violet-500 to-purple-600',
                    'hover:from-violet-600 hover:to-purple-700 hover:shadow-violet-500/25',
                    'transition-all hover:shadow-lg active:scale-95',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Video className="w-5 h-5" />
                  {t('recording.startVideo')}
                </button>
                <button
                  onClick={handleStartAudio}
                  disabled={!topic}
                  className={cn(
                    'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold',
                    'bg-gradient-to-r from-rose-500 to-pink-600',
                    'hover:from-rose-600 hover:to-pink-700 hover:shadow-rose-500/25',
                    'transition-all hover:shadow-lg active:scale-95',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Mic className="w-5 h-5" />
                  {t('recording.startAudio')}
                </button>
              </>
            )}

            {isRecording && (
              <>
                <button
                  onClick={onPause}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium bg-yellow-500 hover:bg-yellow-600 text-black transition-all active:scale-95"
                >
                  <Pause className="w-4 h-4" />
                  {t('recording.pause')}
                </button>
                <button
                  onClick={onStop}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium bg-white/10 hover:bg-white/20 transition-all active:scale-95"
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
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium bg-green-500 hover:bg-green-600 transition-all active:scale-95"
                >
                  <Play className="w-4 h-4" />
                  {t('recording.resume')}
                </button>
                <button
                  onClick={onStop}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium bg-white/10 hover:bg-white/20 transition-all active:scale-95"
                >
                  <Square className="w-4 h-4" />
                  {t('recording.stop')}
                </button>
              </>
            )}

            {isStopped && (
              <button
                onClick={onReset}
                className={cn(
                  'flex items-center gap-2 px-5 py-3 rounded-xl font-semibold',
                  'bg-gradient-to-r from-rose-500 to-pink-600',
                  'hover:from-rose-600 hover:to-pink-700',
                  'transition-all hover:shadow-lg hover:shadow-rose-500/25 active:scale-95'
                )}
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
