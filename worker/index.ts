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

// Language to Google Search params mapping
const LANGUAGE_CONFIG: Record<string, { hl: string; gl: string; name: string }> = {
  en: { hl: 'en', gl: 'us', name: 'English' },
  zh: { hl: 'zh-CN', gl: 'cn', name: 'Chinese' },
  es: { hl: 'es', gl: 'es', name: 'Spanish' },
  fr: { hl: 'fr', gl: 'fr', name: 'French' },
  de: { hl: 'de', gl: 'de', name: 'German' },
  ja: { hl: 'ja', gl: 'jp', name: 'Japanese' },
  pt: { hl: 'pt-BR', gl: 'br', name: 'Portuguese' },
};

// Generate cache key - use topic and language directly
function getCacheKey(topic: string, language: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${today}:${topic.toLowerCase()}:${language}`;
}

// Search Google News via Serper - in user's language with localized geo
async function searchNews(topic: string, language: string, apiKey: string): Promise<SerperNewsResult[]> {
  const config = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.en;
  
  console.log(`Searching "${topic}" with hl=${config.hl}, gl=${config.gl}`);
  
  const response = await fetch('https://google.serper.dev/news', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: topic,
      gl: config.gl,
      hl: config.hl,
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
      }),
    });

    if (!response.ok) {
      console.log(`Scrape failed for ${url}: ${response.status}`);
      return '';
    }

    const data = await response.json() as { text?: string };
    // Limit to first 10000 chars to avoid token limits
    const content = data.text || '';
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

// Summarize a single news article in the specified language
async function summarizeSingleNews(
  item: SerperNewsResult,
  content: string,
  language: string,
  apiKey: string
): Promise<string> {
  const config = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.en;
  const contentToUse = content && content.length > 100 ? content : item.snippet;
  
  const prompt = `Extract the core information from this news article in ${config.name} (around 150 words). Focus on: who, what, when, where, why, and key facts.

Title: ${item.title}
Source: ${item.source}
Content:
${contentToUse}

Output only the extracted core info in ${config.name}, nothing else.`;

  try {
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
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.log(`OpenAI error for ${item.title}: ${response.status}`);
      return item.snippet;
    }

    const data = await response.json() as { 
      choices: Array<{ message: { content: string } }> 
    };
    
    return data.choices[0]?.message?.content?.trim() || item.snippet;
  } catch (error) {
    console.log(`Summarize error for ${item.title}:`, error);
    return item.snippet;
  }
}

// Summarize news in user's language using full scraped content - PARALLEL
async function summarizeNews(
  newsItems: SerperNewsResult[],
  contentMap: Map<string, string>,
  language: string,
  apiKey: string
): Promise<NewsItem[]> {
  // Summarize all articles in parallel
  const summaryPromises = newsItems.map(async (item) => {
    const fullContent = contentMap.get(item.link) || '';
    const summary = await summarizeSingleNews(item, fullContent, language, apiKey);
    return {
      title: item.title,
      source: item.source,
      date: item.date,
      url: item.link,
      summary,
    };
  });

  return Promise.all(summaryPromises);
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
    const count = Math.min(10, Math.max(1, parseInt(url.searchParams.get('count') || '5')));

    if (!topic) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Check cache (topic + language + count)
    const cacheKey = `${getCacheKey(topic, language)}:${count}`;
    const cached = await env.TALKUP_CACHE.get(cacheKey);
    
    if (cached) {
      console.log(`Cache hit: ${cacheKey}`);
      return new Response(cached, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Search Google News in user's language with localized geo
    console.log(`Searching news for: "${topic}" in ${language}`);
    const allNewsResults = await searchNews(topic, language, env.SERPER_API_KEY);
    
    if (allNewsResults.length === 0) {
      return new Response(
        JSON.stringify({ news: [], message: 'No news found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to requested count
    const newsResults = allNewsResults.slice(0, count);

    // Step 3: Scrape all news pages in parallel
    console.log(`Scraping ${newsResults.length} news pages...`);
    const contentMap = await scrapeAllNewsPages(newsResults, env.SERPER_API_KEY);
    console.log(`Scraped ${contentMap.size} pages successfully`);

    // Step 4: Summarize in user's language
    console.log(`Summarizing in ${language}...`);
    const news = await summarizeNews(newsResults, contentMap, language, env.OPENAI_API_KEY);
    
    // Step 5: Cache and return
    const responseData = JSON.stringify({ news });
    await env.TALKUP_CACHE.put(cacheKey, responseData, { expirationTtl: 86400 });
    console.log(`Cached news: ${cacheKey}`);

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
