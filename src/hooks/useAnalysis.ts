'use client';

import { useState, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { getBlob } from '@/lib/storage';
import { api } from '@/lib/api';
import { extractAudioFromVideo, isVideoBlob, formatFileSize } from '@/lib/utils';
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
        deliveryAndLanguage: { score: 0, feedback: '', strengths: [], improvements: [] },
        structureAndLogic: { score: 0, feedback: '', strengths: [], improvements: [] },
        contentQuality: { score: 0, feedback: '', strengths: [], improvements: [] },
        engagementAndPresence: { score: 0, feedback: '', strengths: [], improvements: [] },
        overallPerformance: { score: 0, feedback: '', strengths: [], improvements: [] },
        wordsPerMinute: 0,
        pauseRatio: 0,
        totalWords: 0,
        totalPauses: 0,
        averagePauseDuration: 0,
        summary: '',
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

      let mediaBlob = blob;
      
      // If it's a video, extract audio first to reduce upload size
      if (isVideoBlob(blob)) {
        console.log(`[Analysis] Video detected: ${formatFileSize(blob.size)}`);
        
        // Update status to extracting
        const extractingAnalysis = { ...initialAnalysis, status: 'extracting' as const };
        setAnalyses(prev => ({ ...prev, [recordingId]: extractingAnalysis }));
        setCurrentAnalysis(extractingAnalysis);
        onProgress?.('extracting');
        
        try {
          mediaBlob = await extractAudioFromVideo(blob);
          console.log(`[Analysis] Audio extracted: ${formatFileSize(mediaBlob.size)} (${Math.round((1 - mediaBlob.size / blob.size) * 100)}% smaller)`);
        } catch (extractError) {
          console.warn('[Analysis] Audio extraction failed, using original video:', extractError);
          // Fall back to original video if extraction fails
          mediaBlob = blob;
        }
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
