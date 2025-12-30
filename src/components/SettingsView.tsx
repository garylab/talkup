'use client';

import { useRouter } from 'next/navigation';
import { Globe, ChevronRight, Check, Info, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Locale, locales, localeNames, localeFlags } from '@/i18n';

interface SettingsViewProps {
  locale: Locale;
  isInstallable: boolean;
  onInstall: () => void;
  t: (key: string) => string;
}

export function SettingsView({ locale, isInstallable, onInstall, t }: SettingsViewProps) {
  const router = useRouter();

  const handleLanguageChange = (newLocale: Locale) => {
    if (newLocale !== locale) {
      const path = newLocale === 'en' ? '/' : `/${newLocale}`;
      router.push(path);
    }
  };

  return (
    <div className="pb-4">
      <h2 className="text-lg font-semibold mb-4">{t('nav.settings')}</h2>

      {/* Language Section */}
      <div className="mb-6">
        <h3 className="section-title mb-3">{t('settings.language')}</h3>
        <div className="surface">
          {locales.map((loc, index) => (
            <button
              key={loc}
              onClick={() => handleLanguageChange(loc)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3.5 transition-colors',
                index < locales.length - 1 && 'border-b border-white/[0.06]'
              )}
            >
              <span className="text-xl">{localeFlags[loc]}</span>
              <span className="flex-1 text-left font-medium">{localeNames[loc]}</span>
              {loc === locale && (
                <Check className="w-5 h-5 text-emerald-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Install PWA */}
      {isInstallable && (
        <div className="mb-6">
          <h3 className="section-title mb-3">{t('settings.app')}</h3>
          <div className="surface">
            <button
              onClick={onInstall}
              className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/20">
                <Download className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium">{t('pwa.install')}</p>
                <p className="text-xs text-zinc-500">{t('settings.installDesc')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </button>
          </div>
        </div>
      )}

      {/* About */}
      <div>
        <h3 className="section-title mb-3">{t('settings.about')}</h3>
        <div className="surface">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-zinc-800">
              <Info className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium">TalkUp</p>
              <p className="text-xs text-zinc-500">v1.0.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
