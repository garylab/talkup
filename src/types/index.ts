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
export interface AnalysisCategory {
  score: number; // 1-10
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface SpeechAnalysis {
  deliveryAndLanguage: AnalysisCategory;
  structureAndLogic: AnalysisCategory;
  contentQuality: AnalysisCategory;
  engagementAndPresence: AnalysisCategory;
  overallPerformance: AnalysisCategory;
  wordsPerMinute: number;
  pauseRatio: number; // percentage of time spent in pauses
  totalWords: number;
  totalPauses: number;
  averagePauseDuration: number;
  summary: string;
}

export interface RecordingAnalysis {
  id: string; // same as recording id
  transcript: Transcript;
  analysis: SpeechAnalysis;
  createdAt: string;
  status: 'pending' | 'transcribing' | 'analyzing' | 'complete' | 'error';
  error?: string;
}
