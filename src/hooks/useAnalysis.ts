'use client';

import { useState, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { getBlob } from '@/lib/storage';
import { api } from '@/lib/api';
import { isVideoBlob, formatFileSize, extractAudioFromVideo } from '@/lib/utils';
import type { RecordingAnalysis } from '@/types';

export function useAnalysis() {
  const [analyses, setAnalyses, isHydrated] = useLocalStorage<Record<string, RecordingAnalysis>>('talkup-analyses', {});
  const [currentAnalysis, setCurrentAnalysis] = useState<RecordingAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Get analysis for a specific recording
  const getAnalysis = useCallback((recordingId: string): RecordingAnalysis | null => {
    return analyses[recordingId] || null;
  }, [analyses]);

  // Check if analysis exists for a recording
  const hasAnalysis = useCallback((recordingId: string): boolean => {
    return !!analyses[recordingId] && analyses[recordingId].status === 'complete';
  }, [analyses]);

  // Analyze a recording
  const analyzeRecording = useCallback(async (
    recordingId: string,
    topic: string | null,
    language: string,
    onProgress?: (status: RecordingAnalysis['status']) => void
  ): Promise<RecordingAnalysis> => {
    setIsAnalyzing(true);

    // Initialize analysis record
    const initialAnalysis: RecordingAnalysis = {
      id: recordingId,
      transcript: {
        segments: [],
        paragraphs: [],
        fullText: '',
        duration: 0,
        language: '',
      },
      analysis: {
        score: 0,
        strengths: [],
        improvements: [],
        summary: '',
        wordsPerMinute: 0,
        pauseRatio: 0,
        totalWords: 0,
        totalPauses: 0,
        averagePauseDuration: 0,
        durationSeconds: 0,
      },
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    setAnalyses(prev => ({ ...prev, [recordingId]: initialAnalysis }));
    setCurrentAnalysis(initialAnalysis);
    onProgress?.('pending');

    try {
      // Get the media blob
      const blob = await getBlob(recordingId);
      if (!blob) {
        throw new Error('Recording not found');
      }

      // For large video files (>50MB), extract audio to reduce upload size
      // This speeds up the upload and base64 conversion
      const EXTRACT_THRESHOLD = 50 * 1024 * 1024; // 50MB
      const MIN_VALID_AUDIO_SIZE = 100 * 1024; // 100KB minimum for valid extracted audio
      
      let mediaBlob = blob;
      
      // For large video files, extract audio to reduce upload size
      if (isVideoBlob(blob) && blob.size > EXTRACT_THRESHOLD) {
        console.log(`[Analysis] Large video detected: ${formatFileSize(blob.size)}, extracting audio for faster upload...`);
        
        // Update status to extracting
        const extractingAnalysis = { ...initialAnalysis, status: 'extracting' as const };
        setAnalyses(prev => ({ ...prev, [recordingId]: extractingAnalysis }));
        setCurrentAnalysis(extractingAnalysis);
        onProgress?.('extracting');
        
        try {
          const extractedAudio = await extractAudioFromVideo(blob);
          
          // Validate extracted audio
          if (extractedAudio.size < MIN_VALID_AUDIO_SIZE) {
            console.warn(`[Analysis] Extracted audio too small (${formatFileSize(extractedAudio.size)}), using original video`);
            // Don't fail, just use original video
          } else {
            console.log(`[Analysis] Audio extracted successfully: ${formatFileSize(extractedAudio.size)} (${Math.round((1 - extractedAudio.size / blob.size) * 100)}% smaller)`);
            mediaBlob = extractedAudio;
          }
        } catch (extractError) {
          console.warn('[Analysis] Audio extraction failed, using original video:', extractError);
          // Don't fail, just use original video
        }
      } else if (isVideoBlob(blob)) {
        console.log(`[Analysis] Video detected: ${formatFileSize(blob.size)}, sending directly`);
      } else {
        console.log(`[Analysis] Audio detected: ${formatFileSize(blob.size)}`);
      }

      // Update status to transcribing
      const transcribingAnalysis = { ...initialAnalysis, status: 'transcribing' as const };
      setAnalyses(prev => ({ ...prev, [recordingId]: transcribingAnalysis }));
      setCurrentAnalysis(transcribingAnalysis);
      onProgress?.('transcribing');

      // Update status to analyzing
      const analyzingAnalysis = { ...transcribingAnalysis, status: 'analyzing' as const };
      setAnalyses(prev => ({ ...prev, [recordingId]: analyzingAnalysis }));
      setCurrentAnalysis(analyzingAnalysis);
      onProgress?.('analyzing');

      // Call API to transcribe and analyze
      const result = await api.transcribeAndAnalyze(mediaBlob, topic, language);

      // Create complete analysis
      const completeAnalysis: RecordingAnalysis = {
        id: recordingId,
        transcript: result.transcript,
        analysis: result.analysis,
        createdAt: new Date().toISOString(),
        status: 'complete',
      };

      setAnalyses(prev => ({ ...prev, [recordingId]: completeAnalysis }));
      setCurrentAnalysis(completeAnalysis);
      onProgress?.('complete');
      setIsAnalyzing(false);

      return completeAnalysis;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      const errorAnalysis: RecordingAnalysis = {
        ...initialAnalysis,
        status: 'error',
        error: errorMessage,
      };

      setAnalyses(prev => ({ ...prev, [recordingId]: errorAnalysis }));
      setCurrentAnalysis(errorAnalysis);
      onProgress?.('error');
      setIsAnalyzing(false);

      throw error;
    }
  }, [setAnalyses]);

  // Delete analysis for a recording
  const deleteAnalysis = useCallback((recordingId: string) => {
    setAnalyses(prev => {
      const newAnalyses = { ...prev };
      delete newAnalyses[recordingId];
      return newAnalyses;
    });
    if (currentAnalysis?.id === recordingId) {
      setCurrentAnalysis(null);
    }
  }, [setAnalyses, currentAnalysis]);

  // Clear all analyses
  const clearAllAnalyses = useCallback(() => {
    setAnalyses({});
    setCurrentAnalysis(null);
  }, [setAnalyses]);

  return {
    analyses,
    currentAnalysis,
    setCurrentAnalysis,
    isAnalyzing,
    isHydrated,
    getAnalysis,
    hasAnalysis,
    analyzeRecording,
    deleteAnalysis,
    clearAllAnalyses,
  };
}
