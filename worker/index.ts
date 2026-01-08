interface Env {
  ASSETS: Fetcher;
  TALKUP_CACHE: KVNamespace;
  SERPER_API_KEY: string;
  OPENAI_API_KEY: string;
}

// Transcript types
interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface WhisperResponse {
  text: string;
  segments: WhisperSegment[];
  language: string;
  duration: number;
}

interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface TranscriptParagraph {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  segments: TranscriptSegment[];
}

interface Transcript {
  segments: TranscriptSegment[];
  paragraphs: TranscriptParagraph[];
  fullText: string;
  duration: number;
  language: string;
}

interface AnalysisCategory {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

interface SpeechAnalysis {
  deliveryAndLanguage: AnalysisCategory;
  structureAndLogic: AnalysisCategory;
  contentQuality: AnalysisCategory;
  engagementAndPresence: AnalysisCategory;
  overallPerformance: AnalysisCategory;
  wordsPerMinute: number;
  pauseRatio: number;
  totalWords: number;
  totalPauses: number;
  averagePauseDuration: number;
  summary: string;
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

// Group segments into paragraphs based on pauses
function groupIntoParagraphs(segments: TranscriptSegment[], pauseThreshold: number = 1.5): TranscriptParagraph[] {
  if (segments.length === 0) return [];
  
  const paragraphs: TranscriptParagraph[] = [];
  let currentParagraph: TranscriptSegment[] = [segments[0]];
  
  for (let i = 1; i < segments.length; i++) {
    const prevEnd = segments[i - 1].end;
    const currStart = segments[i].start;
    const pause = currStart - prevEnd;
    
    if (pause >= pauseThreshold) {
      // Start new paragraph
      paragraphs.push({
        id: paragraphs.length,
        startTime: currentParagraph[0].start,
        endTime: currentParagraph[currentParagraph.length - 1].end,
        text: currentParagraph.map(s => s.text).join(' ').trim(),
        segments: currentParagraph,
      });
      currentParagraph = [segments[i]];
    } else {
      currentParagraph.push(segments[i]);
    }
  }
  
  // Add last paragraph
  if (currentParagraph.length > 0) {
    paragraphs.push({
      id: paragraphs.length,
      startTime: currentParagraph[0].start,
      endTime: currentParagraph[currentParagraph.length - 1].end,
      text: currentParagraph.map(s => s.text).join(' ').trim(),
      segments: currentParagraph,
    });
  }
  
  return paragraphs;
}

// Calculate speech metrics
function calculateMetrics(segments: TranscriptSegment[], totalDuration: number): {
  wordsPerMinute: number;
  pauseRatio: number;
  totalWords: number;
  totalPauses: number;
  averagePauseDuration: number;
} {
  const fullText = segments.map(s => s.text).join(' ');
  const totalWords = fullText.split(/\s+/).filter(w => w.length > 0).length;
  
  // Calculate total speaking time
  let totalSpeakingTime = 0;
  let totalPauseTime = 0;
  let pauseCount = 0;
  
  for (let i = 0; i < segments.length; i++) {
    totalSpeakingTime += segments[i].end - segments[i].start;
    
    if (i > 0) {
      const pause = segments[i].start - segments[i - 1].end;
      if (pause > 0.3) { // Count pauses longer than 300ms
        totalPauseTime += pause;
        pauseCount++;
      }
    }
  }
  
  const speakingMinutes = totalSpeakingTime / 60;
  const wordsPerMinute = speakingMinutes > 0 ? Math.round(totalWords / speakingMinutes) : 0;
  const pauseRatio = totalDuration > 0 ? Math.round((totalPauseTime / totalDuration) * 100) : 0;
  const averagePauseDuration = pauseCount > 0 ? totalPauseTime / pauseCount : 0;
  
  return {
    wordsPerMinute,
    pauseRatio,
    totalWords,
    totalPauses: pauseCount,
    averagePauseDuration: Math.round(averagePauseDuration * 100) / 100,
  };
}

// Transcribe audio/video using OpenAI Whisper
// Whisper supports: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
async function transcribeMedia(mediaBlob: Blob, filename: string, apiKey: string): Promise<WhisperResponse> {
  const formData = new FormData();
  formData.append('file', mediaBlob, filename);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper API error: ${response.status} - ${error}`);
  }
  
  return response.json() as Promise<WhisperResponse>;
}

// Analyze speech quality using ChatGPT
async function analyzeSpeech(
  transcript: Transcript,
  topic: string | null,
  language: string,
  apiKey: string
): Promise<SpeechAnalysis> {
  const config = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.en;
  
  const prompt = `You are an expert speech coach. Analyze the following speech transcript and provide specific, actionable feedback based on the ACTUAL CONTENT of the speech.

Topic: ${topic || 'Not specified'}
Duration: ${Math.round(transcript.duration)} seconds
Words: ${transcript.fullText.split(/\s+/).length}

Transcript:
${transcript.fullText}

OUTPUT LANGUAGE: All feedback, strengths, improvements, and summary MUST be written in ${config.name}. Do NOT use English unless the output language is English.

Provide analysis in the following JSON format (respond ONLY with valid JSON, no markdown):
{
  "deliveryAndLanguage": {
    "score": <1-10>,
    "feedback": "<detailed feedback>",
    "strengths": ["<quote specific good phrases/words from transcript and explain why they work well>", "<strength 2>"],
    "improvements": ["<quote specific words/phrases from transcript> → <suggest specific replacements in same language>", "<improvement 2>"]
  },
  "structureAndLogic": {
    "score": <1-10>,
    "feedback": "<detailed feedback>",
    "strengths": ["<specific strength from transcript>", "<strength 2>"],
    "improvements": ["<quote from transcript> → <better alternative phrasing/structure>", "<improvement 2>"]
  },
  "contentQuality": {
    "score": <1-10>,
    "feedback": "<detailed feedback>",
    "strengths": ["<specific strength from transcript>", "<strength 2>"],
    "improvements": ["<specific content issue from transcript> → <how to enhance with examples>", "<improvement 2>"]
  },
  "engagementAndPresence": {
    "score": <1-10>,
    "feedback": "<detailed feedback>",
    "strengths": ["<specific strength from transcript>", "<strength 2>"],
    "improvements": ["<specific issue from transcript> → <specific technique to improve>", "<improvement 2>"]
  },
  "overallPerformance": {
    "score": <1-10>,
    "feedback": "<detailed feedback>",
    "strengths": ["<specific strength from transcript>", "<strength 2>"],
    "improvements": ["<key issue from transcript> → <specific fix>", "<improvement 2>"]
  },
  "summary": "<2-3 sentence overall summary>"
}

CRITICAL RULES:
1. ALL output text (feedback, strengths, improvements, summary) MUST be in ${config.name}
2. For ALL improvements, you MUST:
   - Quote the ACTUAL words/phrases from the transcript that need improvement
   - Provide SPECIFIC alternative words/phrases to replace them
   - Format as: "[quoted phrase from transcript] → [better alternatives]"

Examples of GOOD improvements (format varies by language):
- Chinese: "频繁使用'然后' → 可替换为'接着'、'随后'、'此外'"
- English: "Overused 'and' as connector → Try: 'furthermore', 'moreover', 'on the other hand'"
- Spanish: "Uso repetido de 'entonces' → Alternativas: 'por lo tanto', 'en consecuencia', 'así que'"

Examples of BAD improvements (too generic, DO NOT do this):
- "Improve vocabulary diversity" (no specific examples from transcript)
- "Use better transitions" (doesn't quote what was actually said)
- Generic advice not tied to the actual speech content

Evaluation criteria:
- Delivery & Language: fluency, vocabulary variety, grammar, filler words, pace
- Structure & Logic: organization, transitions, coherence, logical flow
- Content Quality: relevance, depth, accuracy, supporting examples
- Engagement & Presence: expressiveness, confidence, rhetorical devices
- Overall Performance: holistic assessment considering all aspects`;

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
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ChatGPT API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as { 
    choices: Array<{ message: { content: string } }> 
  };
  
  const content = data.choices[0]?.message?.content?.trim() || '';
  
  // Parse JSON response
  try {
    const analysis = JSON.parse(content);
    return analysis as SpeechAnalysis;
  } catch {
    throw new Error('Failed to parse analysis response');
  }
}

// Handle transcribe API request
async function handleTranscribeRequest(request: Request, env: Env): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await request.formData();
    const mediaFile = formData.get('audio') as File | null;
    const topic = formData.get('topic') as string | null;
    const language = (formData.get('language') as string) || 'en';

    if (!mediaFile) {
      return new Response(
        JSON.stringify({ error: 'Media file is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get filename from the uploaded file, default to media.webm
    const filename = mediaFile.name || 'media.webm';
    console.log(`Transcribing media: ${mediaFile.size} bytes, filename: ${filename}, topic: ${topic}, lang: ${language}`);

    // Step 1: Transcribe with Whisper (supports audio and video formats)
    const whisperResponse = await transcribeMedia(mediaFile, filename, env.OPENAI_API_KEY);
    
    const segments: TranscriptSegment[] = whisperResponse.segments.map(s => ({
      id: s.id,
      start: s.start,
      end: s.end,
      text: s.text.trim(),
    }));

    // Step 2: Group into paragraphs
    const paragraphs = groupIntoParagraphs(segments);

    // Step 3: Calculate metrics
    const metrics = calculateMetrics(segments, whisperResponse.duration);

    const transcript: Transcript = {
      segments,
      paragraphs,
      fullText: whisperResponse.text.trim(),
      duration: whisperResponse.duration,
      language: whisperResponse.language,
    };

    // Step 4: Analyze speech
    const analysisResult = await analyzeSpeech(transcript, topic, language, env.OPENAI_API_KEY);
    
    // Merge metrics into analysis
    const analysis: SpeechAnalysis = {
      ...analysisResult,
      ...metrics,
    };

    return new Response(
      JSON.stringify({ transcript, analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Transcribe API error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to transcribe' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
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
    
    if (url.pathname === '/api/transcribe') {
      return handleTranscribeRequest(request, env);
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
