'use client';

import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Locale, localeNames } from '@/i18n';

interface LanguageSwitcherProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

export function LanguageSwitcher({ locale, onLocaleChange }: LanguageSwitcherProps) {
  return (
    <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
      <button
        onClick={() => onLocaleChange('en')}
        className={cn(
          'px-2 py-1 rounded text-xs font-medium transition-all',
          locale === 'en'
            ? 'bg-white/20 text-white'
            : 'text-slate-400 hover:text-white'
        )}
      >
        EN
      </button>
      <button
        onClick={() => onLocaleChange('zh')}
        className={cn(
          'px-2 py-1 rounded text-xs font-medium transition-all',
          locale === 'zh'
            ? 'bg-white/20 text-white'
            : 'text-slate-400 hover:text-white'
        )}
      >
        中文
      </button>
    </div>
  );
}

