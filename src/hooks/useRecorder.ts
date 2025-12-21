'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { RecordingType } from '@/types';

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

interface UseRecorderOptions {
  onDataAvailable?: (blob: Blob) => void;
  onRecordingComplete?: (blob: Blob, url: string, duration: number) => void;
}

interface UseRecorderReturn {
  state: RecorderState;
  duration: number;
  mediaStream: MediaStream | null;
  recordedBlob: Blob | null;
  recordedUrl: string | null;
  error: string | null;
  recordingType: RecordingType | null;
  startRecording: (type: RecordingType) => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  resetRecording: () => void;
}

export function useRecorder({ onDataAvailable, onRecordingComplete }: UseRecorderOptions = {}): UseRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingType, setRecordingType] = useState<RecordingType | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const finalDurationRef = useRef<number>(0);
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  
  // Keep the callback ref updated
  useEffect(() => {
    onRecordingCompleteRef.current = onRecordingComplete;
  }, [onRecordingComplete]);

  // Store values in refs for cleanup on unmount only
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedUrlRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => {
    mediaStreamRef.current = mediaStream;
  }, [mediaStream]);

  useEffect(() => {
    recordedUrlRef.current = recordedUrl;
  }, [recordedUrl]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
      }
    };
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now() - pausedDurationRef.current * 1000;
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDuration(elapsed);
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async (type: RecordingType) => {
    try {
      setError(null);
      chunksRef.current = [];
      setRecordingType(type);

      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video' ? { facingMode: 'user', width: 1280, height: 720 } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMediaStream(stream);

      // Determine best supported mimeType
      let mimeType: string;
      if (type === 'video') {
        mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
          ? 'video/webm;codecs=vp9' 
          : 'video/webm';
      } else {
        // For audio, try multiple formats for better browser compatibility
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          // Fallback - let browser choose
          mimeType = '';
        }
      }

      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      const finalMimeType = mediaRecorder.mimeType || 'audio/webm';

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: finalMimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        onDataAvailable?.(blob);
        // Auto-save callback
        onRecordingCompleteRef.current?.(blob, url, finalDurationRef.current);
      };

      mediaRecorder.start(1000); // Collect data every second
      setState('recording');
      pausedDurationRef.current = 0;
      startTimer();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start recording';
      setError(message);
      console.error('Recording error:', err);
    }
  }, [onDataAvailable, startTimer]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
      stopTimer();
      pausedDurationRef.current = duration;
    }
  }, [state, duration, stopTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'paused') {
      mediaRecorderRef.current.resume();
      setState('recording');
      startTimer();
    }
  }, [state, startTimer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && (state === 'recording' || state === 'paused')) {
      // Capture final duration before stopping
      finalDurationRef.current = duration;
      mediaRecorderRef.current.stop();
      mediaStream?.getTracks().forEach(track => track.stop());
      setState('stopped');
      stopTimer();
    }
  }, [state, mediaStream, stopTimer, duration]);

  const resetRecording = useCallback(() => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setMediaStream(null);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
    setState('idle');
    setError(null);
    setRecordingType(null);
    chunksRef.current = [];
    pausedDurationRef.current = 0;
  }, [mediaStream, recordedUrl]);

  return {
    state,
    duration,
    mediaStream,
    recordedBlob,
    recordedUrl,
    error,
    recordingType,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  };
}

