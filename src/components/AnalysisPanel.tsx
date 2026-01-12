'use client';

import { useState } from 'react';
import { X, FileText, BarChart3, Clock, Gauge, MessageSquare, Pause, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import type { RecordingAnalysis, TranscriptParagraph } from '@/types';

interface AnalysisPanelProps {
  analysis: RecordingAnalysis;
  onClose: () => void;
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
  t: (key: string) => string;
}

type TabId = 'transcript' | 'analysis';

function ScoreCircle({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-14 text-lg',
    lg: 'w-20 h-20 text-2xl',
  };
  
  const getColor = (score: number) => {
    if (score >= 8) return 'text-emerald-400 border-emerald-400/30 bg-emerald-500/10';
    if (score >= 6) return 'text-amber-400 border-amber-400/30 bg-amber-500/10';
    return 'text-red-400 border-red-400/30 bg-red-500/10';
  };

  return (
    <div className={cn(
      'rounded-full border-2 flex items-center justify-center font-bold',
      sizeClasses[size],
      getColor(score)
    )}>
      {score}
    </div>
  );
}

// Language name mapping for Whisper detected languages
const languageNames: Record<string, string> = {
  en: 'English',
  zh: '中文',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  pt: 'Português',
  ko: '한국어',
  ru: 'Русский',
  ar: 'العربية',
  it: 'Italiano',
  nl: 'Nederlands',
  pl: 'Polski',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  id: 'Bahasa Indonesia',
  hi: 'हिन्दी',
};

function TranscriptView({ 
  paragraphs,
  language,
  duration,
  fullText,
  t 
}: { 
  paragraphs: TranscriptParagraph[];
  language: string;
  duration: number;
  fullText: string;
  t: (key: string) => string;
}) {
  if (paragraphs.length === 0 && !fullText) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500">
        <p>{t('analysis.noTranscript')}</p>
      </div>
    );
  }

  const displayLanguage = languageNames[language] || language.toUpperCase();

  return (
    <div className="space-y-4">
      {/* Whisper Results Header */}
      <div className="surface p-4">
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          {t('analysis.whisperResults')}
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-zinc-500 mb-1">{t('analysis.detectedLanguage')}</p>
            <p className="text-sm font-medium text-white">{displayLanguage}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">{t('analysis.duration')}</p>
            <p className="text-sm font-medium text-white">{formatDuration(Math.floor(duration))}</p>
          </div>
        </div>
      </div>

      {/* Full Text */}
      {fullText && (
        <div className="surface p-4">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            {t('analysis.fullText')}
          </h4>
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{fullText}</p>
        </div>
      )}

      {/* Paragraphs with timestamps */}
      {paragraphs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            {t('analysis.timestampedSegments')}
          </h4>
          <div className="space-y-3">
            {paragraphs.map((paragraph) => (
              <div key={paragraph.id} className="surface p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                    {formatDuration(Math.floor(paragraph.startTime))}
                  </span>
                  <span className="text-zinc-700">→</span>
                  <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                    {formatDuration(Math.floor(paragraph.endTime))}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{paragraph.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AnalysisPanel({ analysis, onClose, onReanalyze, isReanalyzing, t }: AnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('analysis');
  
  const { transcript, analysis: speechAnalysis } = analysis;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 animate-fade-in" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h2 className="text-lg font-semibold">{t('analysis.title')}</h2>
        <div className="flex items-center gap-2">
          {onReanalyze && (
            <button
              onClick={onReanalyze}
              disabled={isReanalyzing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-sm disabled:opacity-50"
              title={t('analysis.reanalyze')}
            >
              <RefreshCw className={cn('w-4 h-4', isReanalyzing && 'animate-spin')} />
              <span className="hidden sm:inline">{t('analysis.reanalyze')}</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('analysis')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
            activeTab === 'analysis' 
              ? 'text-white border-b-2 border-white' 
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          <BarChart3 className="w-4 h-4" />
          {t('analysis.analysisTab')}
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
            activeTab === 'transcript' 
              ? 'text-white border-b-2 border-white' 
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          <FileText className="w-4 h-4" />
          {t('analysis.transcriptTab')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {activeTab === 'analysis' ? (
          <div className="p-4 pb-32 space-y-6">
            {/* Overall Score & Summary */}
            <div className="flex flex-col items-center py-6">
              <ScoreCircle score={speechAnalysis.score} size="lg" />
              <h3 className="text-lg font-semibold mt-3">{t('analysis.overallScore')}</h3>
              <p className="text-sm text-zinc-400 text-center mt-2 max-w-md">
                {speechAnalysis.summary}
              </p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="surface p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Gauge className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{speechAnalysis.wordsPerMinute}</p>
                  <p className="text-xs text-zinc-500">{t('analysis.wpm')}</p>
                </div>
              </div>
              
              <div className="surface p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{speechAnalysis.durationSeconds}s</p>
                  <p className="text-xs text-zinc-500">{t('analysis.duration')}</p>
                </div>
              </div>
              
              <div className="surface p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{speechAnalysis.totalWords}</p>
                  <p className="text-xs text-zinc-500">{t('analysis.totalWords')}</p>
                </div>
              </div>
              
              <div className="surface p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Pause className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{speechAnalysis.pauseRatio}%</p>
                  <p className="text-xs text-zinc-500">{t('analysis.pauseRatio')}</p>
                </div>
              </div>
            </div>

            {/* Strengths */}
            {speechAnalysis.strengths && speechAnalysis.strengths.length > 0 && (
              <div className="surface p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-400 mb-4">
                  <CheckCircle2 className="w-4 h-4" />
                  {t('analysis.strengths')}
                </h3>
                <ul className="space-y-3">
                  {speechAnalysis.strengths.map((strength, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                      <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Improvements */}
            {speechAnalysis.improvements && speechAnalysis.improvements.length > 0 && (
              <div className="surface p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-400 mb-4">
                  <AlertCircle className="w-4 h-4" />
                  {t('analysis.improvements')}
                </h3>
                <ul className="space-y-3">
                  {speechAnalysis.improvements.map((improvement, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                      <span className="text-amber-400 mt-0.5 flex-shrink-0">→</span>
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 pb-32">
            <TranscriptView 
              paragraphs={transcript.paragraphs} 
              language={transcript.language}
              duration={transcript.duration}
              fullText={transcript.fullText}
              t={t} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
