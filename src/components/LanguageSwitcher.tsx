'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Locale, locales, localeNames, localeFlags } from '@/i18n';

interface LanguageSwitcherProps {
  locale: Locale;
}

export function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = (newLocale: Locale) => {
    setIsOpen(false);
    if (newLocale !== locale) {
      const path = newLocale === 'en' ? '/' : `/${newLocale}`;
      router.push(path);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm',
          'bg-white/5 border border-white/10',
          'hover:bg-white/10 transition-all',
          isOpen && 'bg-white/10'
        )}
      >
        <span>{localeFlags[locale]}</span>
        <span className="hidden sm:inline text-slate-300">{localeNames[locale]}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-40 bg-slate-950 border border-white/20 rounded-lg shadow-2xl z-[100] animate-fade-in">
          <div className="py-1">
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => handleSelect(loc)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm transition-all',
                  loc === locale
                    ? 'bg-white/10 text-white'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                )}
              >
                <span>{localeFlags[loc]}</span>
                <span className="flex-1 text-left">{localeNames[loc]}</span>
                {loc === locale && <Check className="w-4 h-4 text-emerald-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
