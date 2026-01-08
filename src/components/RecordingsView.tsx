'use client';

import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Mic, Video, ChevronRight as ChevronRightIcon, Loader2, Share2, ListMusic, Sparkles, BarChart3 } from 'lucide-react';
import { getBlobUrl } from '@/lib/storage';
import { cn, formatDuration, formatDate, formatFileSize } from '@/lib/utils';
import { useAnalysis } from '@/hooks/useAnalysis';
import { AnalysisPanel } from './AnalysisPanel';
import type { RecordingAnalysis } from '@/types';

interface Recording {
  id: string;
  topic: string | null;
  type: 'audio' | 'video';
  format: 'mp4' | 'webm';
  duration: number;
  size?: number;
  createdAt: string;
}

interface RecordingsViewProps {
  recordings: Recording[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  t: (key: string) => string;
  locale: string;
}

const ITEMS_PER_PAGE = 10;

export function RecordingsView({ recordings, onRemove, onClearAll, t, locale }: RecordingsViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [loadingBlob, setLoadingBlob] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<RecordingAnalysis['status'] | null>(null);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<RecordingAnalysis | null>(null);
  
  const { analyzeRecording, getAnalysis, hasAnalysis } = useAnalysis();

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(blobUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [blobUrls]);

  // Calculate totals
  const totalDuration = recordings.reduce((sum, r) => sum + r.duration, 0);
  const totalSize = recordings.reduce((sum, r) => sum + (r.size || 0), 0);

  // Pagination
  const totalPages = Math.ceil(recordings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRecordings = recordings.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Helper to get display name for a recording
  const getDisplayName = (r: Recording) => 
    r.topic || `Recording ${new Date(r.createdAt).toLocaleString()}`;

  // Toggle preview and load blob if needed
  const togglePreview = async (id: string) => {
    if (expandedId === id) {
      if (blobUrls[id]) {
        URL.revokeObjectURL(blobUrls[id]);
        setBlobUrls(prev => {
          const newUrls = { ...prev };
          delete newUrls[id];
          return newUrls;
        });
      }
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!blobUrls[id]) {
        setLoadingBlob(id);
        try {
          const url = await getBlobUrl(id);
          if (url) {
            setBlobUrls(prev => ({ ...prev, [id]: url }));
          }
        } catch (err) {
          console.error('Failed to load recording:', err);
        } finally {
          setLoadingBlob(null);
        }
      }
    }
  };

  // Delete recording
  const handleDelete = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm(t('recordings.deleteConfirm'))) {
      onRemove(id);
      if (expandedId === id) {
        setExpandedId(null);
      }
      if (paginatedRecordings.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    }
  }, [onRemove, paginatedRecordings.length, currentPage, expandedId, t]);

  // Download file helper
  const downloadFile = useCallback((url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // Analyze recording
  const handleAnalyze = useCallback(async (recording: Recording, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    // If already analyzed, show the panel
    if (hasAnalysis(recording.id)) {
      const existingAnalysis = getAnalysis(recording.id);
      if (existingAnalysis) {
        setSelectedAnalysis(existingAnalysis);
        setShowAnalysisPanel(true);
      }
      return;
    }
    
    // Start analysis
    setAnalyzingId(recording.id);
    setAnalysisStatus('pending');
    
    try {
      const result = await analyzeRecording(
        recording.id,
        recording.topic,
        locale,
        (status) => setAnalysisStatus(status)
      );
      setSelectedAnalysis(result);
      setShowAnalysisPanel(true);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzingId(null);
      setAnalysisStatus(null);
    }
  }, [analyzeRecording, getAnalysis, hasAnalysis, locale]);

  // Share recording
  const handleShare = useCallback(async (id: string, title: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    try {
      let url = blobUrls[id];
      if (!url) {
        url = await getBlobUrl(id) || '';
      }
      
      if (!url) {
        console.error('No blob URL available for sharing');
        return;
      }

      const recording = recordings.find(r => r.id === id);
      const isVideo = recording?.type === 'video';
      const format = recording?.format || 'webm';
      const extension = format === 'mp4' ? (isVideo ? 'mp4' : 'm4a') : 'webm';
      const mimeType = format === 'mp4' 
        ? (isVideo ? 'video/mp4' : 'audio/mp4')
        : (isVideo ? 'video/webm' : 'audio/webm');
      const filename = `${title}.${extension}`;

      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: mimeType });

      const canShareFiles = navigator.canShare && navigator.canShare({ files: [file] });
      
      if (canShareFiles) {
        try {
          await navigator.share({
            title: title,
            files: [file],
          });
          return;
        } catch (shareError) {
          if ((shareError as Error).name === 'AbortError') {
            return;
          }
          console.log('Share failed, falling back to download');
        }
      }

      const downloadUrl = URL.createObjectURL(blob);
      downloadFile(downloadUrl, filename);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Share/Download failed:', error);
    }
  }, [blobUrls, recordings, downloadFile]);

  if (recordings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
        <ListMusic className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">{t('recordings.empty')}</p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-4">{t('recordings.title')}</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>{recordings.length} {t('recordings.items')}</span>
            <span>·</span>
            <span className="font-mono">{formatDuration(totalDuration)}</span>
            <span>·</span>
            <span>{formatFileSize(totalSize)}</span>
          </div>
          <button
            onClick={() => {
              if (window.confirm(t('recordings.clearAllConfirm'))) {
                onClearAll();
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('recordings.clearAll')}</span>
          </button>
        </div>
      </div>
      
      {/* List */}
      <div className="list">
        {paginatedRecordings.map((recording) => {
          const isExpanded = expandedId === recording.id;
          
          return (
            <div key={recording.id}>
              <div
                onClick={() => togglePreview(recording.id)}
                className={cn(
                  'list-item-interactive',
                  isExpanded && 'bg-white/[0.02]'
                )}
              >
                {/* Type icon */}
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  recording.type === 'video' 
                    ? 'bg-violet-500/10' 
                    : 'bg-rose-500/10'
                )}>
                  {recording.type === 'video' ? (
                    <Video className="w-5 h-5 text-violet-400" />
                  ) : (
                    <Mic className="w-5 h-5 text-rose-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[15px] text-white truncate">{getDisplayName(recording)}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-zinc-500">{formatDate(recording.createdAt)}</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-xs text-zinc-500 font-mono">{formatDuration(recording.duration)}</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-xs text-zinc-600">{formatFileSize(recording.size || 0)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5">
                  {/* Analyze button - only for audio */}
                  {recording.type === 'audio' && (
                    <button
                      onClick={(e) => handleAnalyze(recording, e)}
                      disabled={analyzingId === recording.id}
                      className={cn(
                        'btn-ghost p-2',
                        hasAnalysis(recording.id) ? 'text-emerald-400' : 'text-amber-400 hover:text-amber-300'
                      )}
                      title={hasAnalysis(recording.id) ? t('analysis.viewAnalysis') : t('analysis.analyze')}
                    >
                      {analyzingId === recording.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : hasAnalysis(recording.id) ? (
                        <BarChart3 className="w-4 h-4" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  
                  <button
                    onClick={(e) => handleShare(recording.id, getDisplayName(recording), e)}
                    className="btn-ghost p-2"
                    title={t('common.share')}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => handleDelete(recording.id, e)}
                    className="btn-ghost p-2 hover:text-red-400"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <ChevronRightIcon className={cn(
                    'w-4 h-4 text-zinc-600 transition-transform ml-1',
                    isExpanded && 'rotate-90'
                  )} />
                </div>
              </div>

              {/* Inline preview */}
              {isExpanded && (
                <div className="px-4 pb-4 animate-fade-in">
                  <div className="bg-black rounded-xl overflow-hidden">
                    {loadingBlob === recording.id ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
                      </div>
                    ) : !blobUrls[recording.id] ? (
                      <div className="flex items-center justify-center py-12">
                        <p className="text-zinc-600 text-sm">{t('recordings.notFound')}</p>
                      </div>
                    ) : recording.type === 'video' ? (
                      <video
                        src={blobUrls[recording.id]}
                        controls
                        autoPlay
                        className="w-full"
                      />
                    ) : (
                      <div className="flex items-center justify-center py-6 px-4">
                        <audio
                          src={blobUrls[recording.id]}
                          controls
                          autoPlay
                          className="w-full max-w-md"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Analysis status indicator */}
                  {analyzingId === recording.id && analysisStatus && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-sm text-zinc-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {analysisStatus === 'transcribing' && t('analysis.transcribing')}
                        {analysisStatus === 'analyzing' && t('analysis.analyzing')}
                        {analysisStatus === 'pending' && t('analysis.analyzing')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/[0.06]">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={cn(
              'btn-ghost p-2',
              currentPage === 1 && 'opacity-30 cursor-not-allowed'
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={cn(
                  'w-8 h-8 rounded-lg text-sm font-medium transition-all',
                  page === currentPage
                    ? 'bg-white text-black'
                    : 'text-zinc-500 hover:text-white active:bg-white/[0.06]'
                )}
              >
                {page}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={cn(
              'btn-ghost p-2',
              currentPage === totalPages && 'opacity-30 cursor-not-allowed'
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Analysis Panel */}
      {showAnalysisPanel && selectedAnalysis && (
        <AnalysisPanel
          analysis={selectedAnalysis}
          onClose={() => {
            setShowAnalysisPanel(false);
            setSelectedAnalysis(null);
          }}
          t={t}
        />
      )}
    </div>
  );
}

