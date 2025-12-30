'use client';

import { Home, ListMusic, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabId = 'home' | 'recordings' | 'settings';

interface BottomNavbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  recordingsCount?: number;
  t: (key: string) => string;
}

export function BottomNavbar({ activeTab, onTabChange, recordingsCount = 0, t }: BottomNavbarProps) {
  const tabs = [
    { id: 'home' as TabId, icon: Home, label: t('nav.home') },
    { id: 'recordings' as TabId, icon: ListMusic, label: t('nav.recordings'), badge: recordingsCount },
    { id: 'settings' as TabId, icon: Settings, label: t('nav.settings') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-lg border-t border-white/[0.06] safe-bottom">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {tabs.map(({ id, icon: Icon, label, badge }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors relative',
                isActive ? 'text-white' : 'text-zinc-500'
              )}
            >
              <div className="relative">
                <Icon className={cn('w-5 h-5', isActive && 'text-rose-400')} />
                {badge !== undefined && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold bg-rose-500 text-white rounded-full">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px] font-medium', isActive && 'text-rose-400')}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

