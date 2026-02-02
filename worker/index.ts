interface Env {
  ASSETS: Fetcher;
  TALKUP_CACHE: KVNamespace;
  SERPER_API_KEY: string;
  OPENAI_API_KEY: string;
  RUNPOD_API_URL: string;
  RUNPOD_API_KEY: string;
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

// RunPod API response types
interface RunPodSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  seek?: number;
  temperature?: number;
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
  tokens?: number[];
}

interface RunPodWordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface RunPodOutput {
  detected_language: string;
  device?: string;
  model?: string;
  segments: RunPodSegment[];
  transcription: string;
  translation?: string | null;
  word_timestamps?: RunPodWordTimestamp[];
}

interface RunPodResponse {
  id: string;
  status: string;
  delayTime?: number;
  executionTime?: number;
  workerId?: string;
  output?: RunPodOutput;
  error?: string;
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

interface SpeechAnalysis {
  score: number;              // Overall score 1-10
  strengths: string[];        // Max 3 good points
  improvements: string[];     // 3-7 crucial improvements
  summary: string;            // Brief summary
  wordsPerMinute: number;
  pauseRatio: number;
  totalWords: number;
  totalPauses: number;
  averagePauseDuration: number;
  durationSeconds: number;
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
function calculateMetrics(segments: TranscriptSegment[], totalDuration: number, fullText: string): {
  wordsPerMinute: number;
  pauseRatio: number;
  totalWords: number;
  totalPauses: number;
  averagePauseDuration: number;
  durationSeconds: number;
} {
  // Count words properly - handle CJK characters (Chinese, Japanese, Korean)
  // CJK languages don't use spaces between words
  const cjkPattern = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g;
  const cjkChars = fullText.match(cjkPattern) || [];
  const nonCjkText = fullText.replace(cjkPattern, ' ');
  const nonCjkWords = nonCjkText.split(/\s+/).filter(w => w.length > 0);
  
  // For CJK, each character roughly equals a word; for other languages, count words
  const totalWords = cjkChars.length + nonCjkWords.length;
  
  // Calculate actual speaking time from segments
  let totalSpeakingTime = 0;
  let totalPauseTime = 0;
  let pauseCount = 0;
  
  for (let i = 0; i < segments.length; i++) {
    const segmentDuration = segments[i].end - segments[i].start;
    totalSpeakingTime += segmentDuration;
    
    if (i > 0) {
      const pause = segments[i].start - segments[i - 1].end;
      if (pause > 0.5) { // Count pauses longer than 500ms
        totalPauseTime += pause;
        pauseCount++;
      }
    }
  }
  
  // WPM based on actual speaking time (not total duration)
  const speakingMinutes = totalSpeakingTime / 60;
  const wordsPerMinute = speakingMinutes > 0 ? Math.round(totalWords / speakingMinutes) : 0;
  
  // Pause ratio: percentage of total time that is pauses
  const pauseRatio = totalDuration > 0 ? Math.round((totalPauseTime / totalDuration) * 100) : 0;
  const averagePauseDuration = pauseCount > 0 ? totalPauseTime / pauseCount : 0;
  
  console.log(`[Metrics] Words: ${totalWords} (CJK: ${cjkChars.length}, Other: ${nonCjkWords.length})`);
  console.log(`[Metrics] Speaking time: ${totalSpeakingTime.toFixed(1)}s, Total: ${totalDuration.toFixed(1)}s`);
  console.log(`[Metrics] WPM: ${wordsPerMinute}, Pauses: ${pauseCount}, Pause ratio: ${pauseRatio}%`);
  
  return {
    wordsPerMinute,
    pauseRatio,
    totalWords,
    totalPauses: pauseCount,
    averagePauseDuration: Math.round(averagePauseDuration * 10) / 10,
    durationSeconds: Math.round(totalDuration),
  };
}

// Convert Blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// Transcribe audio/video using RunPod Whisper API
// No file size limit - uses base64 encoding
async function transcribeMedia(mediaBlob: Blob, filename: string, apiUrl: string, apiKey: string): Promise<WhisperResponse> {
  console.log(`[RunPod] Converting ${(mediaBlob.size / 1024 / 1024).toFixed(2)}MB to base64...`);
  
  const base64Audio = await blobToBase64(mediaBlob);
  console.log(`[RunPod] Base64 size: ${(base64Audio.length / 1024 / 1024).toFixed(2)}MB`);
  
  const payload = {
    input: {
      model: 'large-v3',           // Best accuracy (turbo for speed)
      word_timestamps: true,        // Get individual word timings
      enable_vad: true,             // Voice Activity Detection - filters silence
      condition_on_previous_text: false,
      audio_base64: base64Audio,
    },
  };
  
  console.log(`[RunPod] Sending to RunPod API: ${apiUrl}`);
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RunPod API error: ${response.status} - ${error}`);
  }
  
  const result = await response.json() as RunPodResponse;
  console.log(`[RunPod] Response status: ${result.status}, executionTime: ${result.executionTime}ms`);
  
  if (result.status === 'FAILED' || result.error) {
    throw new Error(`RunPod transcription failed: ${result.error || 'Unknown error'}`);
  }
  
  if (result.status !== 'COMPLETED') {
    throw new Error(`RunPod job not completed: ${result.status}`);
  }
  
  const output = result.output;
  if (!output) {
    throw new Error('No output from RunPod');
  }
  
  const text = output.transcription || '';
  const segments = output.segments || [];
  const detectedLanguage = output.detected_language || 'en';
  
  // Calculate duration from segments
  let duration = 0;
  if (segments.length > 0) {
    duration = segments[segments.length - 1].end || 0;
  }
  
  console.log(`[RunPod] Transcription complete: ${segments.length} segments, ${duration.toFixed(1)}s duration`);
  console.log(`[RunPod] Detected language: ${detectedLanguage}`);
  console.log(`[RunPod] Text: ${text.substring(0, 200)}...`);
  
  // Convert to WhisperResponse format
  return {
    text,
    segments: segments.map((s, i) => ({
      id: s.id ?? i,
      start: s.start,
      end: s.end,
      text: s.text,
    })),
    language: detectedLanguage,
    duration,
  };
}

// Analyze speech quality using ChatGPT
async function analyzeSpeech(
  transcript: Transcript,
  topic: string | null,
  language: string,
  apiKey: string
): Promise<{ score: number; strengths: string[]; improvements: string[]; summary: string }> {
  const config = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.en;
  
  const prompt = `You are an expert speech coach. Analyze this speech and provide focused, actionable feedback.

Topic: ${topic || 'Not specified'}
Duration: ${Math.round(transcript.duration)} seconds

Transcript:
${transcript.fullText}

OUTPUT LANGUAGE: ${config.name} (All output MUST be in this language)

Respond with ONLY valid JSON (no markdown):
{
  "score": <1-10 overall score>,
  "strengths": [
    "<strength 1: quote good phrase/word from transcript + why it works>",
    "<strength 2>",
    "<strength 3>"
  ],
  "improvements": [
    "<improvement 1: '[quote from transcript]' → [specific better alternative]>",
    "<improvement 2>",
    "<improvement 3>",
    "<improvement 4>",
    "<improvement 5>"
  ],
  "summary": "<1-2 sentence summary>"
}

RULES:
1. Maximum 3 strengths - pick the BEST ones
2. 3-7 improvements - focus on the MOST CRUCIAL issues
3. ALL improvements MUST quote actual text from transcript and suggest specific fixes
4. Be concise and actionable

GOOD improvement examples:
- Chinese: "'然后'使用过多 → 改用'接着'、'随后'"
- English: "'like' used 8 times → Replace with 'such as', 'for example'"
- Japanese: "'えーと'が多い → 間を置くか、言い換えを準備する"

BAD (too generic - DO NOT):
- "Improve vocabulary" (no specific quote)
- "Better transitions" (no concrete suggestion)`;

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
    const fileType = mediaFile.type || 'unknown';
    console.log(`[Transcribe] Received file: ${filename}, type: ${fileType}, size: ${mediaFile.size} bytes`);
    console.log(`[Transcribe] Topic: ${topic}, Language: ${language}`);

    // Step 1: Transcribe with RunPod Whisper API (no file size limit)
    const whisperResponse = await transcribeMedia(mediaFile, filename, env.RUNPOD_API_URL, env.RUNPOD_API_KEY);
    
    console.log(`[RunPod] Response - duration: ${whisperResponse.duration}s, language: ${whisperResponse.language}`);
    console.log(`[RunPod] Full text (first 200 chars): ${whisperResponse.text.substring(0, 200)}`);
    console.log(`[RunPod] Segments count: ${whisperResponse.segments?.length || 0}`);
    
    const segments: TranscriptSegment[] = whisperResponse.segments.map(s => ({
      id: s.id,
      start: s.start,
      end: s.end,
      text: s.text.trim(),
    }));

    // Step 2: Group into paragraphs
    const paragraphs = groupIntoParagraphs(segments);
    
    const fullText = whisperResponse.text.trim();

    // Step 3: Calculate metrics (pass fullText for proper word counting)
    const metrics = calculateMetrics(segments, whisperResponse.duration, fullText);

    const transcript: Transcript = {
      segments,
      paragraphs,
      fullText,
      duration: whisperResponse.duration,
      language: whisperResponse.language,
    };

    // Step 4: Analyze speech with ChatGPT
    const analysisResult = await analyzeSpeech(transcript, topic, language, env.OPENAI_API_KEY);
    
    // Combine ChatGPT analysis with calculated metrics
    const analysis: SpeechAnalysis = {
      score: analysisResult.score,
      strengths: analysisResult.strengths,
      improvements: analysisResult.improvements,
      summary: analysisResult.summary,
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
