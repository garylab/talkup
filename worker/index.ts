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

// Generate cache key
function getCacheKey(topic: string, language: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${today}:${topic}:${language}`;
}

// Search Google News via Serper
async function searchNews(topic: string, apiKey: string): Promise<SerperNewsResult[]> {
  const response = await fetch('https://google.serper.dev/news', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: topic,
      num: 5,
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

// Summarize and translate news using OpenAI
async function summarizeAndTranslate(
  newsItems: SerperNewsResult[],
  targetLanguage: string,
  apiKey: string
): Promise<NewsItem[]> {
  const languageNames: Record<string, string> = {
    en: 'English',
    zh: 'Chinese',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ja: 'Japanese',
    pt: 'Portuguese',
  };

  const targetLang = languageNames[targetLanguage] || 'English';
  
  const prompt = `You are a news summarizer. For each news item below, create a concise summary in ${targetLang} (around 150-200 characters).

News items:
${newsItems.map((item, i) => `${i + 1}. Title: ${item.title}\nSnippet: ${item.snippet}\nSource: ${item.source}`).join('\n\n')}

Respond with a JSON array of summaries in this exact format:
[
  {"index": 0, "summary": "summary in ${targetLang}"},
  {"index": 1, "summary": "summary in ${targetLang}"},
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
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json() as { 
    choices: Array<{ message: { content: string } }> 
  };
  
  const content = data.choices[0]?.message?.content || '[]';
  
  // Parse the JSON response
  let summaries: Array<{ index: number; summary: string }>;
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    summaries = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    summaries = [];
  }

  // Map summaries back to news items
  return newsItems.map((item, index) => ({
    title: item.title,
    source: item.source,
    date: item.date,
    url: item.link,
    summary: summaries.find(s => s.index === index)?.summary || item.snippet.slice(0, 200),
  }));
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

    // Check cache first
    const cacheKey = getCacheKey(topic, language);
    const cached = await env.TALKUP_CACHE.get(cacheKey);
    
    if (cached) {
      return new Response(cached, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Search for news
    const newsResults = await searchNews(topic, env.SERPER_API_KEY);
    
    if (newsResults.length === 0) {
      return new Response(
        JSON.stringify({ news: [], message: 'No news found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Summarize and translate
    const summarizedNews = await summarizeAndTranslate(newsResults, language, env.OPENAI_API_KEY);

    const responseData = JSON.stringify({ news: summarizedNews });

    // Cache for 24 hours
    await env.TALKUP_CACHE.put(cacheKey, responseData, { expirationTtl: 86400 });

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
