import type { Topic, Transcript, SpeechAnalysis } from '@/types';

export interface NewsItem {
  title: string;
  source: string;
  date: string;
  summary: string;
  url: string;
}

export interface NewsResponse {
  news: NewsItem[];
  error?: string;
  message?: string;
}

export interface TranscribeResponse {
  transcript: Transcript;
  analysis: SpeechAnalysis;
  error?: string;
}

// Get API base URL dynamically
function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side: use relative URL
    return '';
  }
  
  // Client-side: check if we're on localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Local development - use wrangler dev server
    return 'http://localhost:8787';
  }
  
  // Production - use same origin
  return window.location.origin;
}

class LocalApi {
  // Get a random topic from provided topics array
  async getRandomTopic(topics: string[]): Promise<Topic> {
    // Simulate slight delay
    await new Promise(resolve => setTimeout(resolve, 50));
    const randomIndex = Math.floor(Math.random() * topics.length);
    return {
      id: String(randomIndex),
      title: topics[randomIndex],
    };
  }

  // Get news for a topic
  async getNews(topic: string, language: string, count: number = 5): Promise<NewsResponse> {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(
        `${baseUrl}/api/news?topic=${encodeURIComponent(topic)}&lang=${language}&count=${count}`,
        { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch news:', error);
      return { news: [], error: 'Failed to fetch news' };
    }
  }

  // Transcribe and analyze audio recording
  async transcribeAndAnalyze(
    audioBlob: Blob,
    topic: string | null,
    language: string
  ): Promise<TranscribeResponse> {
    try {
      const baseUrl = getApiBaseUrl();
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      if (topic) formData.append('topic', topic);
      formData.append('language', language);

      const response = await fetch(`${baseUrl}/api/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as { error?: string }).error || `API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to transcribe:', error);
      throw error;
    }
  }
}

export const api = new LocalApi();
