'use client';

import { useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { getBlob } from '@/lib/storage';
import { api } from '@/lib/api';
import type { RecordingAnalysis, Transcript, SpeechAnalysis } from '@/types';

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
      // Update status to transcribing
      const transcribingAnalysis = { ...initialAnalysis, status: 'transcribing' as const };
      setAnalyses(prev => ({ ...prev, [recordingId]: transcribingAnalysis }));
      setCurrentAnalysis(transcribingAnalysis);
      onProgress?.('transcribing');

      // Get the audio blob
      const blob = await getBlob(recordingId);
      if (!blob) {
        throw new Error('Recording not found');
      }

      // Update status to analyzing
      const analyzingAnalysis = { ...transcribingAnalysis, status: 'analyzing' as const };
      setAnalyses(prev => ({ ...prev, [recordingId]: analyzingAnalysis }));
      setCurrentAnalysis(analyzingAnalysis);
      onProgress?.('analyzing');

      // Call API to transcribe and analyze
      const result = await api.transcribeAndAnalyze(blob, topic, language);

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
