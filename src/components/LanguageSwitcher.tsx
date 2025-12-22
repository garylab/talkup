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
          'flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-sm',
          'hover:bg-white/[0.06] transition-colors',
          isOpen && 'bg-white/[0.06]'
        )}
      >
        <span className="text-lg">{localeFlags[locale]}</span>
        <span className="hidden sm:inline text-slate-400">{localeNames[locale]}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-slate-500 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-44 dropdown-menu z-[100] animate-fade-in">
          <div className="py-1">
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => handleSelect(loc)}
                className={cn(
                  'dropdown-item',
                  loc === locale && 'dropdown-item-active'
                )}
              >
                <span className="text-base">{localeFlags[loc]}</span>
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
