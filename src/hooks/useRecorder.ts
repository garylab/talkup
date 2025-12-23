'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { RecordingType } from '@/types';

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';
export type RecordingFormat = 'mp4' | 'webm';

interface UseRecorderOptions {
  onDataAvailable?: (blob: Blob) => void;
  onRecordingComplete?: (blob: Blob, url: string, duration: number, format: RecordingFormat) => void;
}

interface UseRecorderReturn {
  state: RecorderState;
  duration: number;
  mediaStream: MediaStream | null;
  recordedBlob: Blob | null;
  recordedUrl: string | null;
  error: string | null;
  recordingType: RecordingType | null;
  recordingFormat: RecordingFormat | null;
  startRecording: (type: RecordingType, audioDeviceId?: string, facingMode?: string) => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  resetRecording: () => void;
  switchCamera: (useFrontCamera: boolean) => Promise<void>;
}

// Detect if browser supports MP4 recording (Safari)
function getBestCodec(type: RecordingType): { mimeType: string; format: RecordingFormat } {
  if (type === 'video') {
    // Try MP4/H.264 first (Safari, better iOS compatibility)
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      return { mimeType: 'video/mp4;codecs=avc1', format: 'mp4' };
    }
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      return { mimeType: 'video/mp4', format: 'mp4' };
    }
    // Fall back to WebM/VP9 (Chrome, Firefox, Edge)
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      return { mimeType: 'video/webm;codecs=vp9', format: 'webm' };
    }
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      return { mimeType: 'video/webm;codecs=vp8', format: 'webm' };
    }
    return { mimeType: 'video/webm', format: 'webm' };
  } else {
    // Audio: Try MP4/AAC first (Safari, iOS compatibility)
    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      return { mimeType: 'audio/mp4', format: 'mp4' };
    }
    // Fall back to WebM/Opus (Chrome, Firefox, Edge)
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return { mimeType: 'audio/webm;codecs=opus', format: 'webm' };
    }
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      return { mimeType: 'audio/webm', format: 'webm' };
    }
    return { mimeType: '', format: 'webm' };
  }
}

export function useRecorder({ onDataAvailable, onRecordingComplete }: UseRecorderOptions = {}): UseRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingType, setRecordingType] = useState<RecordingType | null>(null);
  const [recordingFormat, setRecordingFormat] = useState<RecordingFormat | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const finalDurationRef = useRef<number>(0);
  const formatRef = useRef<RecordingFormat>('webm');
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

  const startRecording = useCallback(async (type: RecordingType, _audioDeviceId?: string, facingMode?: string) => {
    try {
      setError(null);
      chunksRef.current = [];
      setRecordingType(type);

      // Always use default microphone
      const audioConstraints: MediaTrackConstraints | boolean = true;
      
      // Build video constraints with facingMode
      let videoConstraints: MediaTrackConstraints | boolean = false;
      if (type === 'video') {
        videoConstraints = {
          facingMode: facingMode || 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        };
      }

      const constraints: MediaStreamConstraints = {
        audio: audioConstraints,
        video: videoConstraints,
      };

      console.log('[useRecorder] Requesting media with constraints:', JSON.stringify(constraints));
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[useRecorder] Got media stream');
      setMediaStream(stream);

      // Get best codec for this browser (MP4 for Safari, WebM for others)
      const { mimeType, format } = getBestCodec(type);
      formatRef.current = format;
      setRecordingFormat(format);

      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      const finalMimeType = mediaRecorder.mimeType || mimeType || 'video/webm';

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
        // Auto-save callback with format info
        onRecordingCompleteRef.current?.(blob, url, finalDurationRef.current, formatRef.current);
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

  // Switch camera (front/back) while recording
  const switchCamera = useCallback(async (useFrontCamera: boolean) => {
    if (!mediaStream || recordingType !== 'video' || (state !== 'recording' && state !== 'paused')) {
      return;
    }

    try {
      const facingMode = useFrontCamera ? 'user' : 'environment';
      console.log('[useRecorder] Switching camera to:', facingMode);
      
      // Get new video track with different facing mode
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      
      if (!newVideoTrack) {
        console.error('[useRecorder] No video track from new camera');
        return;
      }

      // Get old video track
      const oldVideoTrack = mediaStream.getVideoTracks()[0];
      
      // Remove old track and add new one to the stream
      if (oldVideoTrack) {
        mediaStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      mediaStream.addTrack(newVideoTrack);

      // Trigger re-render by creating a new reference
      setMediaStream(new MediaStream(mediaStream.getTracks()));
      
      console.log('[useRecorder] Camera switched successfully');
    } catch (err) {
      console.error('[useRecorder] Failed to switch camera:', err);
    }
  }, [mediaStream, recordingType, state]);

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
    setRecordingFormat(null);
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
    recordingFormat,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
    switchCamera,
  };
}
