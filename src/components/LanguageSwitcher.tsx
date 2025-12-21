'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Locale } from '@/i18n';

interface LanguageSwitcherProps {
  locale: Locale;
}

export function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  return (
    <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
      <Link
        href="/"
        className={cn(
          'px-2 py-1 rounded text-xs font-medium transition-all',
          locale === 'en'
            ? 'bg-white/20 text-white'
            : 'text-slate-400 hover:text-white'
        )}
      >
        EN
      </Link>
      <Link
        href="/zh"
        className={cn(
          'px-2 py-1 rounded text-xs font-medium transition-all',
          locale === 'zh'
            ? 'bg-white/20 text-white'
            : 'text-slate-400 hover:text-white'
        )}
      >
        中文
      </Link>
    </div>
  );
}
