'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2, Newspaper } from 'lucide-react';
import { api, NewsItem } from '@/lib/api';
import { cn } from '@/lib/utils';

// Request deduplication - store pending requests
const pendingRequests = new Map<string, Promise<{ news: NewsItem[]; error?: string }>>();
const completedCache = new Map<string, { data: { news: NewsItem[]; error?: string }; timestamp: number }>();

function fetchNewsWithDedup(topic: string, language: string): Promise<{ news: NewsItem[]; error?: string }> {
  const key = `${topic}:${language}`;
  
  // Check completed cache first (valid for 60 seconds)
  const cached = completedCache.get(key);
  if (cached && Date.now() - cached.timestamp < 60000) {
    return Promise.resolve(cached.data);
  }
  
  // Check if request is already in flight
  const pending = pendingRequests.get(key);
  if (pending) {
    return pending;
  }
  
  // Create and store promise BEFORE any async work
  const promise = api.getNews(topic, language).then(data => {
    // Cache the result
    completedCache.set(key, { data, timestamp: Date.now() });
    pendingRequests.delete(key);
    return data;
  }).catch(err => {
    pendingRequests.delete(key);
    throw err;
  });
  
  pendingRequests.set(key, promise);
  return promise;
}

interface NewsPanelProps {
  topic: string;
  language: string;
  onClose: () => void;
  t: (key: string) => string;
}

export function NewsPanel({ topic, language, onClose, t }: NewsPanelProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    const fetchNews = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetchNewsWithDedup(topic, language);
        if (cancelled) return;
        
        if (response.error) {
          setError(response.error);
        } else {
          setNews(response.news);
        }
      } catch (err) {
        if (cancelled) return;
        setError('Failed to load news');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchNews();
    
    return () => {
      cancelled = true;
    };
  }, [topic, language]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="relative w-full max-w-lg max-h-[80vh] bg-zinc-900 rounded-t-2xl sm:rounded-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold">{t('news.title')}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Topic */}
        <div className="px-4 py-2 bg-zinc-800/50">
          <p className="font-medium truncate">{topic}</p>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh] p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500 mb-3" />
              <p className="text-sm text-zinc-500">{t('news.loading')}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-red-400 mb-2">{error}</p>
              <p className="text-sm text-zinc-500">{t('news.tryAgain')}</p>
            </div>
          ) : news.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Newspaper className="w-12 h-12 text-zinc-600 mb-3" />
              <p className="text-zinc-400">{t('news.noNews')}</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {news.map((item, index) => (
                <div key={index} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="text-zinc-500 text-sm font-medium w-5 flex-shrink-0">{index + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm leading-tight mb-1.5">{item.title}</h4>
                    <p className="text-sm text-zinc-400 leading-relaxed mb-2">
                      {item.summary}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      {item.date && <span>{item.date}</span>}
                      {item.date && <span>·</span>}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-zinc-300 transition-colors"
                      >
                        <span>{item.source}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

