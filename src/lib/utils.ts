import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format duration in seconds to MM:SS format
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format file size in bytes to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generate a UUID v7 (time-ordered UUID)
 * Format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
 * - 48 bits: Unix timestamp in milliseconds
 * - 4 bits: version (7)
 * - 12 bits: random
 * - 2 bits: variant (10)
 * - 62 bits: random
 */
export function uuid7(): string {
  const timestamp = Date.now();
  
  // Get random bytes
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  
  // Build the UUID
  // Bytes 0-5: timestamp (48 bits)
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  
  // Bytes 6-7: version (7) + random (12 bits)
  const byte6 = 0x70 | (randomBytes[0] & 0x0f); // version 7 + 4 random bits
  const byte7 = randomBytes[1];
  
  // Bytes 8-9: variant (10) + random (14 bits)  
  const byte8 = 0x80 | (randomBytes[2] & 0x3f); // variant 10 + 6 random bits
  const byte9 = randomBytes[3];
  
  // Bytes 10-15: random (48 bits)
  const randomHex = Array.from(randomBytes.slice(4))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return [
    timestampHex.slice(0, 8),
    timestampHex.slice(8, 12),
    byte6.toString(16).padStart(2, '0') + byte7.toString(16).padStart(2, '0'),
    byte8.toString(16).padStart(2, '0') + byte9.toString(16).padStart(2, '0'),
    randomHex,
  ].join('-');
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  
  return then.toLocaleDateString();
}

/**
 * Format date to YYYY-MM-DD HH:mm
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
