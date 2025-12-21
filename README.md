# Random Speech

A speech practice app that gives you random topics to talk about. Record yourself, playback, and improve your speaking skills.

## Features

- 🎲 **Random Topics** - 339 topics from [TED Topics](https://www.ted.com/topics)
- ✏️ **Custom Topics** - Create your own topics to practice
- 🎥 **Video Recording** - Record video with your camera
- 🎤 **Audio Recording** - Record audio only
- ⏸️ **Pause/Resume** - Control your recording flow
- 💾 **Local Storage** - Recordings saved in your browser (IndexedDB)
- 🌐 **Multi-language** - English and Simplified Chinese support
- 📱 **Responsive** - Works on desktop and mobile

## Languages

- 🇬🇧 English
- 🇨🇳 简体中文 (Simplified Chinese)

The app auto-detects your browser language and saves your preference.

## Tech Stack

- **Framework**: Next.js 14 (App Router, Static Export)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Storage**: IndexedDB for recordings, LocalStorage for settings
- **Deployment**: Cloudflare Pages

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
```

## Deployment to Cloudflare Pages

### Option 1: Git Integration (Recommended)

1. Push your code to GitHub/GitLab
2. Go to [Cloudflare Pages](https://pages.cloudflare.com)
3. Create a new project and connect your repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `out`

### Option 2: Direct Upload

```bash
npm run deploy
```

## Project Structure

```
├── src/
│   ├── app/                 # Next.js pages
│   │   └── page.tsx         # Home page with recording studio
│   ├── components/          # React components
│   │   ├── RecordingStudio.tsx
│   │   └── LanguageSwitcher.tsx
│   ├── data/                # Topic data
│   │   ├── topics-en.json   # English topics (339)
│   │   └── topics-zh.json   # Chinese topics (339)
│   ├── i18n/                # Internationalization
│   │   ├── index.ts
│   │   └── locales/
│   │       ├── en.json      # English translations
│   │       └── zh.json      # Chinese translations
│   ├── hooks/               # Custom React hooks
│   │   ├── useRecorder.ts
│   │   ├── useLocalStorage.ts
│   │   └── useLocale.ts
│   ├── lib/                 # Utilities
│   │   ├── api.ts
│   │   ├── indexedDB.ts
│   │   └── utils.ts
│   └── types/
├── public/
├── out/                     # Built static files
├── next.config.js
├── wrangler.toml
└── tailwind.config.js
```

## Topics Source

Topics are sourced from [TED Topics](https://www.ted.com/topics) - 339 topics covering:
- Science & Technology
- Health & Psychology
- Environment & Nature
- Business & Economics
- Society & Culture
- And many more!

## License

MIT
