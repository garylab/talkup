import type { Topic } from '@/types';

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
  // Returns title and index for looking up English version
  async getRandomTopic(topics: string[]): Promise<Topic & { index: number }> {
    // Simulate slight delay
    await new Promise(resolve => setTimeout(resolve, 50));
    const randomIndex = Math.floor(Math.random() * topics.length);
    return {
      id: String(randomIndex),
      title: topics[randomIndex],
      index: randomIndex,
    };
  }

  // Get news for a topic
  // englishTopic is used for searching (avoids translation API call)
  async getNews(englishTopic: string, language: string): Promise<NewsResponse> {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(
        `${baseUrl}/api/news?topic=${encodeURIComponent(englishTopic)}&lang=${language}`,
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
}

export const api = new LocalApi();
