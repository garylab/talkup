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
 * Uses captureStream with moderate playback speed for reliable extraction
 */
export async function extractAudioFromVideo(
  videoBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    console.log(`[AudioExtract] Starting extraction from ${formatFileSize(videoBlob.size)} video`);
    
    const video = document.createElement('video');
    video.muted = false; // Need audio to be enabled for captureStream
    video.volume = 0; // But set volume to 0 to avoid playback sound
    video.playsInline = true;
    
    const url = URL.createObjectURL(videoBlob);
    video.src = url;
    
    let recorder: MediaRecorder | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      video.remove();
    };
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      console.log(`[AudioExtract] Video duration: ${duration}s`);
      
      // Set a timeout in case something hangs (duration * 1000ms / playbackRate + 30s buffer)
      const playbackRate = 4; // Use 4x speed - more reliable than 16x
      const expectedTime = (duration * 1000 / playbackRate) + 30000;
      timeoutId = setTimeout(() => {
        console.error('[AudioExtract] Timeout - extraction took too long');
        cleanup();
        reject(new Error('Audio extraction timed out'));
      }, expectedTime);
      
      // Capture the media stream from video
      const stream = (video as any).captureStream?.() || (video as any).mozCaptureStream?.();
      if (!stream) {
        cleanup();
        reject(new Error('captureStream not supported in this browser'));
        return;
      }
      
      // Get only audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        cleanup();
        reject(new Error('No audio track found in video'));
        return;
      }
      
      console.log(`[AudioExtract] Found ${audioTracks.length} audio track(s)`);
      
      // Create audio-only stream
      const audioStream = new MediaStream(audioTracks);
      
      // Use MediaRecorder to capture audio
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
      
      console.log(`[AudioExtract] Using MIME type: ${mimeType}`);
      
      recorder = new MediaRecorder(audioStream, {
        mimeType,
        audioBitsPerSecond: 64000, // 64kbps - good enough for speech, smaller file
      });
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        cleanup();
        const audioBlob = new Blob(chunks, { type: mimeType });
        console.log(`[AudioExtract] Extraction complete: ${formatFileSize(audioBlob.size)}`);
        resolve(audioBlob);
      };
      
      recorder.onerror = (e) => {
        console.error('[AudioExtract] Recorder error:', e);
        cleanup();
        reject(new Error('MediaRecorder error during extraction'));
      };
      
      video.onended = () => {
        console.log('[AudioExtract] Video playback ended, stopping recorder');
        if (recorder && recorder.state === 'recording') {
          recorder.stop();
        }
      };
      
      video.ontimeupdate = () => {
        if (onProgress && duration > 0) {
          onProgress(Math.min(video.currentTime / duration, 1));
        }
      };
      
      video.onerror = () => {
        cleanup();
        reject(new Error('Failed to load video'));
      };
      
      // Start recording and play video at moderate speed
      recorder.start(1000); // Request data every 1 second
      video.playbackRate = playbackRate;
      video.play().catch(err => {
        console.error('[AudioExtract] Play failed:', err);
        cleanup();
        reject(err);
      });
    };
    
    video.onerror = () => {
      cleanup();
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
