export type RecordingType = 'video' | 'audio';

export interface Topic {
  id: string;
  title: string;
}

// Transcript types
export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptParagraph {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  segments: TranscriptSegment[];
}

export interface Transcript {
  segments: TranscriptSegment[];
  paragraphs: TranscriptParagraph[];
  fullText: string;
  duration: number;
  language: string;
}

// Analysis types
export interface SpeechAnalysis {
  score: number;              // Overall score 1-10
  strengths: string[];        // Max 3 good points
  improvements: string[];     // 3-7 crucial improvements
  summary: string;            // Brief summary
  wordsPerMinute: number;
  pauseRatio: number;         // percentage of time spent in pauses
  totalWords: number;
  totalPauses: number;
  averagePauseDuration: number;
  durationSeconds: number;
}

export interface RecordingAnalysis {
  id: string; // same as recording id
  transcript: Transcript;
  analysis: SpeechAnalysis;
  createdAt: string;
  status: 'pending' | 'extracting' | 'transcribing' | 'analyzing' | 'complete' | 'error';
  error?: string;
}
