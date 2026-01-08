'use client';

import { Globe, ChevronRight, Check, Info, Download, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Locale, locales, localeNames, localeFlags } from '@/i18n';
import { useSettings } from '@/hooks/useSettings';
import { useLocale } from '@/hooks/useLocale';

interface SettingsViewProps {
  locale: Locale;
  isInstallable: boolean;
  isInstalled: boolean;
  onInstall: () => void;
  t: (key: string) => string;
}

export function SettingsView({ locale, isInstallable, isInstalled, onInstall, t }: SettingsViewProps) {
  const { settings, setNewsCount } = useSettings();
  const { locale: storedLocale, setLocale } = useLocale(locale);
  
  // Check if iOS Safari (for manual install instructions)
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isInBrowser = !isInstalled;

  const handleLanguageChange = (newLocale: Locale) => {
    if (newLocale !== storedLocale) {
      setLocale(newLocale);
      if (typeof window !== 'undefined') {
        // Clear topic so a new one is fetched in the new language
        window.localStorage.removeItem('talkup-topic');
        // Reload so the selected language takes effect immediately
        window.location.reload();
      }
    }
  };

  return (
    <div className="pb-4">
      <h2 className="text-lg font-semibold mb-4">{t('nav.settings')}</h2>

      {/* News Count Section */}
      <div className="mb-6">
        <h3 className="section-title mb-3">{t('settings.newsCount')}</h3>
        <div className="surface px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/20">
              <Newspaper className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{t('settings.newsCountLabel')}</p>
              <p className="text-xs text-zinc-500">{t('settings.newsCountDesc')}</p>
            </div>
            <span className="text-lg font-semibold text-white w-8 text-center">{settings.newsCount ?? 5}</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={settings.newsCount ?? 5}
            onChange={(e) => setNewsCount(parseInt(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>1</span>
            <span>10</span>
          </div>
        </div>
      </div>

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
              {loc === storedLocale && (
                <Check className="w-5 h-5 text-emerald-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Install PWA - hidden when already in PWA mode */}
      {isInBrowser && (
        <div className="mb-6">
          <h3 className="section-title mb-3">{t('settings.app')}</h3>
          <div className="surface">
            {isInstallable ? (
              // Android/Chrome - can install directly
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
            ) : isIOS ? (
              // iOS Safari - show manual instructions
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/20 flex-shrink-0">
                  <Download className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{t('pwa.install')}</p>
                  <p className="text-xs text-zinc-500 mt-1">{t('settings.iosInstall')}</p>
                </div>
              </div>
            ) : (
              // Other browsers - generic instructions
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-zinc-700 flex-shrink-0">
                  <Download className="w-5 h-5 text-zinc-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{t('pwa.install')}</p>
                  <p className="text-xs text-zinc-500 mt-1">{t('settings.browserInstall')}</p>
                </div>
              </div>
            )}
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
