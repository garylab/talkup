interface Env {
  ASSETS: Fetcher;
  TALKUP_CACHE: KVNamespace;
  SERPER_API_KEY: string;
  OPENAI_API_KEY: string;
}

interface SerperNewsResult {
  title: string;
  link: string;
  snippet: string;
  date: string;
  source: string;
}

interface NewsItem {
  title: string;
  source: string;
  date: string;
  summary: string;
  url: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  zh: 'Chinese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  pt: 'Portuguese',
};

// Generate cache key using English topic
function getCacheKey(englishTopic: string, language: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${today}:${englishTopic.toLowerCase()}:${language}`;
}

// Translate topic to English using OpenAI
async function translateTopicToEnglish(topic: string, apiKey: string): Promise<string> {
  // If topic looks like English already, return as-is
  if (/^[a-zA-Z0-9\s\-']+$/.test(topic)) {
    return topic;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ 
        role: 'user', 
        content: `Translate the following topic to English. Only output the English translation, nothing else.\n\nTopic: ${topic}` 
      }],
      temperature: 0,
      max_tokens: 50,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json() as { 
    choices: Array<{ message: { content: string } }> 
  };
  
  return data.choices[0]?.message?.content?.trim() || topic;
}

// Search Google News via Serper (always in English)
async function searchNews(englishTopic: string, apiKey: string): Promise<SerperNewsResult[]> {
  const response = await fetch('https://google.serper.dev/news', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: englishTopic,
      page: 1,
      gl: 'us',
      hl: 'en',
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status}`);
  }

  const data = await response.json() as { news?: SerperNewsResult[] };
  return data.news || [];
}

// Scrape a single news page to get full content
async function scrapeNewsPage(url: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch('https://scrape.serper.dev', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        includeMarkdown: true,
      }),
    });

    if (!response.ok) {
      console.log(`Scrape failed for ${url}: ${response.status}`);
      return '';
    }

    const data = await response.json() as { markdown?: string; text?: string };
    // Prefer markdown, fallback to text, limit to first 10000 chars to avoid token limits
    const content = data.markdown || data.text || '';
    return content.slice(0, 10000);
  } catch (error) {
    console.log(`Scrape error for ${url}:`, error);
    return '';
  }
}

// Scrape all news pages in parallel
async function scrapeAllNewsPages(
  newsItems: SerperNewsResult[],
  apiKey: string
): Promise<Map<string, string>> {
  const contentMap = new Map<string, string>();
  
  // Scrape all pages in parallel
  const scrapePromises = newsItems.map(async (item) => {
    const content = await scrapeNewsPage(item.link, apiKey);
    return { url: item.link, content };
  });
  
  const results = await Promise.all(scrapePromises);
  
  for (const { url, content } of results) {
    contentMap.set(url, content);
  }
  
  return contentMap;
}

// Summarize news in English using full scraped content
async function summarizeNewsEnglish(
  newsItems: SerperNewsResult[],
  contentMap: Map<string, string>,
  apiKey: string
): Promise<NewsItem[]> {
  // Build news items with full content (or fallback to snippet)
  const newsWithContent = newsItems.map((item, i) => {
    const fullContent = contentMap.get(item.link);
    const contentToUse = fullContent && fullContent.length > 100 ? fullContent : item.snippet;
    return `${i + 1}. Title: ${item.title}\nSource: ${item.source}\nContent:\n${contentToUse}`;
  });

  const prompt = `You are a news summarizer. For each news article below, create a concise summary in English (around 150 words). Focus on the key facts and main points.

News articles:
${newsWithContent.join('\n\n---\n\n')}

Respond with a JSON array in this exact format:
[
  {"index": 0, "summary": "150-word English summary here"},
  {"index": 1, "summary": "150-word English summary here"},
  ...
]

Only output the JSON array, nothing else.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000, // Increased for longer summaries
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json() as { 
    choices: Array<{ message: { content: string } }> 
  };
  
  const content = data.choices[0]?.message?.content || '[]';
  
  let summaries: Array<{ index: number; summary: string }>;
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    summaries = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    summaries = [];
  }

  return newsItems.map((item, index) => ({
    title: item.title,
    source: item.source,
    date: item.date,
    url: item.link,
    summary: summaries.find(s => s.index === index)?.summary || item.snippet,
  }));
}

// Translate news to target language
async function translateNews(
  newsItems: NewsItem[],
  targetLanguage: string,
  apiKey: string
): Promise<NewsItem[]> {
  const targetLang = LANGUAGE_NAMES[targetLanguage] || 'English';
  
  const prompt = `Translate the following news titles and summaries to ${targetLang}. Maintain the same level of detail in the summaries.

News items:
${newsItems.map((item, i) => `${i + 1}. Title: ${item.title}\nSummary: ${item.summary}`).join('\n\n---\n\n')}

Respond with a JSON array in this exact format:
[
  {"index": 0, "title": "translated title", "summary": "translated summary"},
  {"index": 1, "title": "translated title", "summary": "translated summary"},
  ...
]

Only output the JSON array, nothing else.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000, // Increased for longer summaries
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json() as { 
    choices: Array<{ message: { content: string } }> 
  };
  
  const content = data.choices[0]?.message?.content || '[]';
  
  let translations: Array<{ index: number; title: string; summary: string }>;
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    translations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    translations = [];
  }

  return newsItems.map((item, index) => {
    const translation = translations.find(t => t.index === index);
    return {
      ...item,
      title: translation?.title || item.title,
      summary: translation?.summary || item.summary,
    };
  });
}

// Handle news API request
async function handleNewsRequest(request: Request, env: Env): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const topic = url.searchParams.get('topic');
    const language = url.searchParams.get('lang') || 'en';

    if (!topic) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Translate topic to English
    const englishTopic = await translateTopicToEnglish(topic, env.OPENAI_API_KEY);
    console.log(`Topic "${topic}" translated to English: "${englishTopic}"`);

    // Step 2: Check if translated version exists in cache
    const langCacheKey = getCacheKey(englishTopic, language);
    const cachedLang = await env.TALKUP_CACHE.get(langCacheKey);
    
    if (cachedLang) {
      console.log(`Cache hit: ${langCacheKey}`);
      return new Response(cachedLang, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Check if English version exists in cache
    const enCacheKey = getCacheKey(englishTopic, 'en');
    const cachedEn = await env.TALKUP_CACHE.get(enCacheKey);
    
    let englishNews: NewsItem[];
    
    if (cachedEn) {
      console.log(`English cache hit: ${enCacheKey}`);
      englishNews = JSON.parse(cachedEn).news;
    } else {
      // Step 4: Search Google News
      console.log(`Searching news for: ${englishTopic}`);
      const newsResults = await searchNews(englishTopic, env.SERPER_API_KEY);
      
      if (newsResults.length === 0) {
        return new Response(
          JSON.stringify({ news: [], message: 'No news found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step 5: Scrape all news pages in parallel
      console.log(`Scraping ${newsResults.length} news pages...`);
      const contentMap = await scrapeAllNewsPages(newsResults, env.SERPER_API_KEY);
      console.log(`Scraped ${contentMap.size} pages successfully`);

      // Step 6: Summarize in English using full content
      englishNews = await summarizeNewsEnglish(newsResults, contentMap, env.OPENAI_API_KEY);
      
      // Cache English version
      const enResponseData = JSON.stringify({ news: englishNews });
      await env.TALKUP_CACHE.put(enCacheKey, enResponseData, { expirationTtl: 86400 });
      console.log(`Cached English news: ${enCacheKey}`);
    }

    // Step 5: If requested language is English, return directly
    if (language === 'en') {
      const responseData = JSON.stringify({ news: englishNews });
      return new Response(responseData, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 6: Translate to target language
    console.log(`Translating news to: ${language}`);
    const translatedNews = await translateNews(englishNews, language, env.OPENAI_API_KEY);
    
    // Cache translated version
    const responseData = JSON.stringify({ news: translatedNews });
    await env.TALKUP_CACHE.put(langCacheKey, responseData, { expirationTtl: 86400 });
    console.log(`Cached translated news: ${langCacheKey}`);

    return new Response(responseData, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('News API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch news' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle API routes
    if (url.pathname === '/api/news') {
      return handleNewsRequest(request, env);
    }
    
    // Handle root path
    if (url.pathname === '/') {
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    }
    
    // Handle language paths
    const langPaths = ['/zh', '/es', '/fr', '/de', '/ja', '/pt'];
    if (langPaths.includes(url.pathname)) {
      return env.ASSETS.fetch(new Request(new URL(`${url.pathname}.html`, request.url), request));
    }
    
    // Try to serve the asset directly
    const response = await env.ASSETS.fetch(request);
    
    // If not found, try adding .html extension
    if (response.status === 404) {
      const htmlPath = url.pathname.endsWith('/') 
        ? `${url.pathname}index.html` 
        : `${url.pathname}.html`;
      const htmlResponse = await env.ASSETS.fetch(
        new Request(new URL(htmlPath, request.url), request)
      );
      if (htmlResponse.status !== 404) {
        return htmlResponse;
      }
    }
    
    return response;
  },
};
