import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a UUID v7 (time-ordered)
 */
export function uuid7(): string {
  const timestamp = Date.now();
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  
  // Set version (7) and variant bits
  randomBytes[0] = (randomBytes[0] & 0x0f) | 0x70; // version 7
  randomBytes[2] = (randomBytes[2] & 0x3f) | 0x80; // variant 10
  
  const randomHex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `${timestampHex.slice(0, 8)}-${timestampHex.slice(8, 12)}-${randomHex.slice(0, 4)}-${randomHex.slice(4, 8)}-${randomHex.slice(8, 20)}`;
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  } else {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

/**
 * Extract audio from a video blob
 * Uses captureStream and accelerated playback for fast extraction
 */
export async function extractAudioFromVideo(
  videoBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true; // Mute to avoid audio playback during extraction
    video.playsInline = true;
    
    const url = URL.createObjectURL(videoBlob);
    video.src = url;
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      console.log(`[AudioExtract] Video duration: ${duration}s`);
      
      // Capture the media stream from video
      const stream = (video as any).captureStream?.() || (video as any).mozCaptureStream?.();
      if (!stream) {
        URL.revokeObjectURL(url);
        reject(new Error('captureStream not supported'));
        return;
      }
      
      // Get only audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        URL.revokeObjectURL(url);
        reject(new Error('No audio track found in video'));
        return;
      }
      
      // Create audio-only stream
      const audioStream = new MediaStream(audioTracks);
      
      // Use MediaRecorder to capture audio
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      const recorder = new MediaRecorder(audioStream, {
        mimeType,
        audioBitsPerSecond: 128000, // 128kbps for good quality, smaller size
      });
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        URL.revokeObjectURL(url);
        const audioBlob = new Blob(chunks, { type: mimeType });
        console.log(`[AudioExtract] Extracted audio: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`);
        resolve(audioBlob);
      };
      
      recorder.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      
      video.onended = () => {
        recorder.stop();
        video.remove();
      };
      
      video.ontimeupdate = () => {
        if (onProgress && duration > 0) {
          onProgress(Math.min(video.currentTime / duration, 1));
        }
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video'));
      };
      
      // Start recording and play video at high speed
      recorder.start();
      video.playbackRate = 16; // 16x speed for fast extraction
      video.play().catch(err => {
        URL.revokeObjectURL(url);
        reject(err);
      });
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video'));
    };
  });
}

/**
 * Check if blob is a video
 */
export function isVideoBlob(blob: Blob): boolean {
  return blob.type.startsWith('video/');
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
