'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Mic, Video, ChevronDown, ChevronUp, Loader2, Search, X, Download, Share2 } from 'lucide-react';
import { RecordingStudio } from '@/components/RecordingStudio';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useRecorder } from '@/hooks/useRecorder';
import { useLocalRecordings } from '@/hooks/useLocalStorage';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { getBlobUrl } from '@/lib/storage';
import { cn, formatDuration, formatDate, formatFileSize } from '@/lib/utils';
import { t as translate, getTopics, Locale } from '@/i18n';
import type { RecordingType } from '@/types';

const ITEMS_PER_PAGE = 5;

interface HomePageProps {
  locale: Locale;
}

export function HomePage({ locale }: HomePageProps) {
  // i18n helper
  const t = (key: string) => translate(locale, key);
  const topics = getTopics(locale);

  // Topic state
  const [topic, setTopic] = useState<string | null>(null);
  
  // Local storage (metadata in localStorage, blobs in IndexedDB)
  const { recordings, isHydrated, addRecording, removeRecording } = useLocalRecordings();

  // PWA install
  const { isInstallable, install } = usePWAInstall();

  // Use refs to track values for the callback
  const topicRef = useRef(topic);
  const recordingTypeRef = useRef<RecordingType>('video');
  
  // Recordings list state
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [loadingBlob, setLoadingBlob] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    topicRef.current = topic;
  }, [topic]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(blobUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [blobUrls]);

  // Auto-save when recording completes
  const handleRecordingComplete = useCallback(async (blob: Blob, url: string, duration: number, format: 'mp4' | 'webm') => {
    const currentTopic = topicRef.current;
    const currentType = recordingTypeRef.current;

    await addRecording({
      topic: currentTopic,
      type: currentType,
      format,
      duration,
      blob,
    });

    // Reset for new recording after a brief delay to show completion
    setTimeout(() => {
      setTopic(null);
    }, 100);
  }, [addRecording]);

  // Recorder hook with auto-save
  const recorder = useRecorder({
    onRecordingComplete: handleRecordingComplete,
  });

  // Update ref when recorder type changes
  useEffect(() => {
    if (recorder.recordingType) {
      recordingTypeRef.current = recorder.recordingType;
    }
  }, [recorder.recordingType]);

  // Handle start recording with type and device selection
  const handleStart = useCallback((type: RecordingType, audioDeviceId?: string, videoDeviceId?: string) => {
    recordingTypeRef.current = type;
    recorder.startRecording(type, audioDeviceId, videoDeviceId);
  }, [recorder]);

  // Filter recordings by search query
  // Helper to get display name for a recording
  const getDisplayName = (r: typeof recordings[0]) => 
    r.topic || `Recording ${new Date(r.createdAt).toLocaleString()}`;

  const filteredRecordings = searchQuery.trim()
    ? recordings.filter(r => 
        getDisplayName(r).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : recordings;

  // Pagination (on filtered results)
  const totalPages = Math.ceil(filteredRecordings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRecordings = filteredRecordings.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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
      removeRecording(id);
      if (expandedId === id) {
        setExpandedId(null);
      }
      if (paginatedRecordings.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    }
  }, [removeRecording, paginatedRecordings.length, currentPage, expandedId, t]);

  // Download file helper
  const downloadFile = useCallback((url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // Share recording
  const handleShare = useCallback(async (id: string, title: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    try {
      // Get the blob URL if not already loaded
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

      // Fetch the blob to create a file
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: mimeType });

      // Check if Web Share API with files is supported
      const canShareFiles = navigator.canShare && navigator.canShare({ files: [file] });
      
      if (canShareFiles) {
        try {
          await navigator.share({
            title: title,
            files: [file],
          });
          return; // Success
        } catch (shareError) {
          // User cancelled or share failed - fall through to download
          if ((shareError as Error).name === 'AbortError') {
            return; // User cancelled, don't download
          }
          console.log('Share failed, falling back to download');
        }
      }

      // Fallback: download the file
      const downloadUrl = URL.createObjectURL(blob);
      downloadFile(downloadUrl, filename);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Share/Download failed:', error);
    }
  }, [blobUrls, recordings, downloadFile]);

  return (
    <main className="min-h-screen p-4 py-8">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-rose-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-4xl mx-auto">
        {/* Header with language switcher */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight shrink-0">
              <span className="text-gradient">{t('app.title')}</span>
            </h1>
            <span className="hidden sm:block text-sm text-slate-400 truncate">{t('topic.question')}</span>
            {/* PWA Install Button */}
            {isInstallable && (
              <button
                onClick={install}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shrink-0',
                  'bg-gradient-to-r from-emerald-500 to-teal-600',
                  'hover:from-emerald-600 hover:to-teal-700',
                  'transition-all hover:shadow-lg hover:shadow-emerald-500/25 active:scale-95'
                )}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{t('pwa.install')}</span>
              </button>
            )}
          </div>
          <LanguageSwitcher locale={locale} />
        </div>

        {/* Recording Studio */}
        <RecordingStudio
          state={recorder.state}
          duration={recorder.duration}
          mediaStream={recorder.mediaStream}
          recordedUrl={recorder.recordedUrl}
          error={recorder.error}
          onStart={handleStart}
          onPause={recorder.pauseRecording}
          onResume={recorder.resumeRecording}
          onStop={recorder.stopRecording}
          onReset={recorder.resetRecording}
          topic={topic}
          onTopicChange={setTopic}
          recordingType={recorder.recordingType || 'video'}
          t={t}
          topics={topics}
        />

        {/* Recordings List */}
        {isHydrated && recordings.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="text-lg font-semibold text-slate-300">
                {t('recordings.title')} ({filteredRecordings.length})
              </h2>
              
              {/* Search box */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('recordings.search')}
                  className={cn(
                    'w-full pl-9 pr-8 py-1.5 rounded-lg text-sm',
                    'bg-white/5 border border-white/10',
                    'placeholder:text-slate-500 text-white',
                    'focus:outline-none focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50'
                  )}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/10"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>
            </div>
            
            {paginatedRecordings.length === 0 ? (
              <div className="glass-card p-8 text-center text-slate-400">
                {t('recordings.noResults')}
              </div>
            ) : (
            <div className="space-y-2">
              {paginatedRecordings.map((recording) => {
                const isExpanded = expandedId === recording.id;
                
                return (
                  <div key={recording.id} className="glass-card overflow-hidden">
                    {/* Recording row */}
                    <div
                      onClick={() => togglePreview(recording.id)}
                      className={cn(
                        'px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-all',
                        isExpanded ? 'bg-white/5' : 'hover:bg-white/5'
                      )}
                    >
                      {/* Type icon */}
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        recording.type === 'video' 
                          ? 'bg-violet-500/20' 
                          : 'bg-rose-500/20'
                      )}>
                        {recording.type === 'video' ? (
                          <Video className="w-4 h-4 text-violet-400" />
                        ) : (
                          <Mic className="w-4 h-4 text-rose-400" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{getDisplayName(recording)}</h3>
                        <p className="text-xs text-slate-500">{formatDate(recording.createdAt)}</p>
                      </div>

                      {/* File info: size, extension, duration */}
                      <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400">
                        <span>{formatFileSize(recording.size || 0)}</span>
                        <span className="text-slate-600">•</span>
                        <span className="uppercase">{recording.format === 'mp4' ? (recording.type === 'video' ? 'mp4' : 'm4a') : 'webm'}</span>
                        <span className="text-slate-600">•</span>
                        <span>{formatDuration(recording.duration)}</span>
                      </div>

                      {/* Share button */}
                      <button
                        onClick={(e) => handleShare(recording.id, getDisplayName(recording), e)}
                        className="p-1.5 rounded-lg hover:bg-blue-500/20 hover:text-blue-400 transition-all"
                        title={t('common.share')}
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDelete(recording.id, e)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-all"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Expand indicator */}
                      <div className="p-0.5">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Inline preview */}
                    {isExpanded && (
                      <div className="border-t border-white/10 p-4 bg-slate-900/30">
                        {loadingBlob === recording.id ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                          </div>
                        ) : !blobUrls[recording.id] ? (
                          <div className="flex items-center justify-center py-6">
                            <p className="text-slate-400 text-sm">{t('recordings.notFound')}</p>
                          </div>
                        ) : recording.type === 'video' ? (
                          <video
                            src={blobUrls[recording.id]}
                            controls
                            autoPlay
                            className="w-full max-w-2xl mx-auto rounded-lg"
                          />
                        ) : (
                          <div className="flex items-center justify-center py-2">
                            <audio
                              src={blobUrls[recording.id]}
                              controls
                              autoPlay
                              className="w-full max-w-md"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={cn(
                    'p-1.5 rounded-lg transition-all',
                    currentPage === 1
                      ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                      : 'bg-white/10 hover:bg-white/20'
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
                          ? 'bg-gradient-to-r from-rose-500 to-pink-600'
                          : 'bg-white/10 hover:bg-white/20'
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
                    'p-1.5 rounded-lg transition-all',
                    currentPage === totalPages
                      ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                      : 'bg-white/10 hover:bg-white/20'
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

