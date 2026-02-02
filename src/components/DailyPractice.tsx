'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp, Check, RotateCcw, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface SubItem {
  id: string;
  content: string;
}

interface PracticeItem {
  id: string;
  title: string;
  duration: string;
  durationMinutes: number;
  goal?: string;
  principles?: string[];
  methods?: string[];
  templates?: { name: string; content: string }[];
  exercises?: string[];
  tips?: string[];
  focus?: string[];
  subItems?: SubItem[];
}

const practiceItems: PracticeItem[] = [
  {
    id: 'content',
    title: '内容组织',
    duration: '30 min',
    durationMinutes: 30,
    goal: '不停、不卡、不自责',
    principles: ['不审稿', '不回头', '不评价好不好'],
    methods: ['选 1 个话题', '用 3 个模版各说一遍', '每个模版 10 分钟，一个模版说到顺，再练下一个'],
    templates: [
      { name: '模版一', content: '观点 → 原因 → 例子' },
      { name: '模版二', content: '事情 → 感受 → 判断' },
      { name: '模版三', content: '一个点 → 对比 → 结论' },
    ],
  },
  {
    id: 'breathing',
    title: '气息',
    duration: '10 min',
    durationMinutes: 10,
    goal: '一口气说完整句，尾音不塌',
    exercises: [
      'ssss—— 20–40s ×3',
      '一口气数数 ×3',
      '完整句子 ×10',
    ],
    tips: ['❌ 不耸肩', '❌ 不顶喉', '✅ 气匀、稳、不断'],
  },
  {
    id: 'resonance',
    title: '音量 & 共鸣',
    duration: '5 min',
    durationMinutes: 5,
    goal: '声音大但不累',
    exercises: [
      'mmm / ng 哼声',
      'mmm → ah',
      'ng → ah 滑音',
      '元音 a e i o u',
    ],
    tips: ['感受：胸腔 / 口腔 / 鼻腔在帮你"扩音"'],
  },
  {
    id: 'intonation',
    title: '语气语调',
    duration: '10 min',
    durationMinutes: 10,
    goal: '不平、不塌、不急',
    methods: ['Shadowing 跟读法'],
    exercises: ['听 → 跟 → 连 → 回听'],
    focus: ['重音', '停顿', '尾音走向'],
  },
];

function getTodayKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface TimerState {
  itemId: string;
  remainingSeconds: number;
  isRunning: boolean;
}

interface DailyPracticeProps {
  t: (key: string) => string;
}

export function DailyPractice({ t }: DailyPracticeProps) {
  const todayKey = getTodayKey();
  const [checkedItems, setCheckedItems] = useLocalStorage<Record<string, string[]>>('talkup-daily-practice', {});
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [timers, setTimers] = useState<Record<string, TimerState>>({});
  const intervalRefs = useRef<Record<string, NodeJS.Timeout>>({});

  const todayChecked = checkedItems[todayKey] || [];

  const markItemChecked = useCallback((itemId: string) => {
    setCheckedItems((prev) => {
      const current = prev[todayKey] || [];
      if (current.includes(itemId)) return prev;
      return { ...prev, [todayKey]: [...current, itemId] };
    });
  }, [todayKey, setCheckedItems]);

  const toggleCheck = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Stop timer if running
    if (intervalRefs.current[itemId]) {
      clearInterval(intervalRefs.current[itemId]);
      delete intervalRefs.current[itemId];
    }
    setTimers((prev) => {
      const newTimers = { ...prev };
      delete newTimers[itemId];
      return newTimers;
    });
    
    setCheckedItems((prev) => {
      const current = prev[todayKey] || [];
      const updated = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];
      return { ...prev, [todayKey]: updated };
    });
  };

  const startTimer = (itemId: string, durationMinutes: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If timer exists, toggle pause/resume
    if (timers[itemId]) {
      if (timers[itemId].isRunning) {
        // Pause
        if (intervalRefs.current[itemId]) {
          clearInterval(intervalRefs.current[itemId]);
          delete intervalRefs.current[itemId];
        }
        setTimers((prev) => ({
          ...prev,
          [itemId]: { ...prev[itemId], isRunning: false },
        }));
      } else {
        // Resume
        const interval = setInterval(() => {
          setTimers((prev) => {
            const current = prev[itemId];
            if (!current) return prev;
            
            const newRemaining = current.remainingSeconds - 1;
            if (newRemaining <= 0) {
              clearInterval(intervalRefs.current[itemId]);
              delete intervalRefs.current[itemId];
              // Auto-check the item
              markItemChecked(itemId);
              const newTimers = { ...prev };
              delete newTimers[itemId];
              return newTimers;
            }
            return {
              ...prev,
              [itemId]: { ...current, remainingSeconds: newRemaining },
            };
          });
        }, 1000);
        intervalRefs.current[itemId] = interval;
        setTimers((prev) => ({
          ...prev,
          [itemId]: { ...prev[itemId], isRunning: true },
        }));
      }
      return;
    }

    // Start new timer
    const totalSeconds = durationMinutes * 60;
    setTimers((prev) => ({
      ...prev,
      [itemId]: { itemId, remainingSeconds: totalSeconds, isRunning: true },
    }));

    const interval = setInterval(() => {
      setTimers((prev) => {
        const current = prev[itemId];
        if (!current) return prev;
        
        const newRemaining = current.remainingSeconds - 1;
        if (newRemaining <= 0) {
          clearInterval(intervalRefs.current[itemId]);
          delete intervalRefs.current[itemId];
          // Auto-check the item
          markItemChecked(itemId);
          const newTimers = { ...prev };
          delete newTimers[itemId];
          return newTimers;
        }
        return {
          ...prev,
          [itemId]: { ...current, remainingSeconds: newRemaining },
        };
      });
    }, 1000);
    intervalRefs.current[itemId] = interval;
  };

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(intervalRefs.current).forEach(clearInterval);
    };
  }, []);

  const toggleExpand = (itemId: string) => {
    setExpandedItem((prev) => (prev === itemId ? null : itemId));
  };

  const resetToday = () => {
    // Clear all timers
    Object.values(intervalRefs.current).forEach(clearInterval);
    intervalRefs.current = {};
    setTimers({});
    setCheckedItems((prev) => ({ ...prev, [todayKey]: [] }));
  };

  const completedCount = todayChecked.length;
  const totalCount = practiceItems.length;
  const progressPercent = (completedCount / totalCount) * 100;

  return (
    <div className="min-h-full pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-lg border-b border-white/[0.06] px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold">每日口语训练</h1>
            <p className="text-sm text-zinc-400 mt-0.5">55 min · {todayKey}</p>
          </div>
          <button
            onClick={resetToday}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            title="重置今日进度"
          >
            <RotateCcw className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-500 to-orange-400 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 mt-1.5 text-right">
          {completedCount} / {totalCount} 完成
        </p>
      </div>

      {/* Practice Items */}
      <div className="p-4 space-y-3">
        {practiceItems.map((item, index) => {
          const isChecked = todayChecked.includes(item.id);
          const isExpanded = expandedItem === item.id;
          const timer = timers[item.id];
          const hasTimer = !!timer;
          const isTimerRunning = timer?.isRunning ?? false;

          return (
            <div
              key={item.id}
              className={cn(
                'rounded-2xl border transition-all duration-300',
                isChecked
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : hasTimer
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-zinc-800/50 border-white/[0.06]'
              )}
            >
              {/* Main row */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => toggleExpand(item.id)}
              >
                {/* Check button */}
                <button
                  onClick={(e) => toggleCheck(item.id, e)}
                  className={cn(
                    'flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all',
                    isChecked
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-zinc-500 hover:border-zinc-400'
                  )}
                >
                  {isChecked && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 font-mono">0{index + 1}</span>
                    <h3
                      className={cn(
                        'font-semibold transition-colors',
                        isChecked ? 'text-emerald-400' : 'text-white'
                      )}
                    >
                      {item.title}
                    </h3>
                  </div>
                  {/* Timer display or duration */}
                  {hasTimer ? (
                    <p className={cn(
                      'text-sm font-mono mt-0.5 font-medium',
                      isTimerRunning ? 'text-amber-400' : 'text-zinc-400'
                    )}>
                      {formatTime(timer.remainingSeconds)}
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-400 mt-0.5">{item.duration}</p>
                  )}
                </div>

                {/* Timer button - only show if not checked */}
                {!isChecked && (
                  <button
                    onClick={(e) => startTimer(item.id, item.durationMinutes, e)}
                    className={cn(
                      'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all',
                      hasTimer
                        ? isTimerRunning
                          ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                        : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                    )}
                  >
                    {hasTimer && isTimerRunning ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" />
                    )}
                  </button>
                )}

                {/* Expand icon */}
                <div className="flex-shrink-0 text-zinc-500">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-white/[0.06] animate-fade-in">
                  <div className="pt-4 space-y-4">
                    {/* Goal */}
                    {item.goal && (
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">目标</p>
                        <p className="text-sm text-rose-400 font-medium">{item.goal}</p>
                      </div>
                    )}

                    {/* Principles */}
                    {item.principles && (
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">原则</p>
                        <div className="space-y-1.5">
                          {item.principles.map((p, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                              {p}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Methods */}
                    {item.methods && (
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">方式</p>
                        <div className="space-y-1.5">
                          {item.methods.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              {m}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Templates */}
                    {item.templates && (
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">模版</p>
                        <div className="space-y-2">
                          {item.templates.map((tmpl, i) => (
                            <div
                              key={i}
                              className="bg-zinc-900/50 rounded-xl p-3 border border-white/[0.04]"
                            >
                              <p className="text-xs text-zinc-500 mb-1">{tmpl.name}</p>
                              <p className="text-sm text-amber-400 font-medium">{tmpl.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Exercises */}
                    {item.exercises && (
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">练习</p>
                        <div className="space-y-1.5">
                          {item.exercises.map((ex, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                              <span className="text-xs text-zinc-600">{i + 1}.</span>
                              {ex}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Focus points */}
                    {item.focus && (
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">重点模仿</p>
                        <div className="flex flex-wrap gap-2">
                          {item.focus.map((f, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 text-sm bg-purple-500/20 text-purple-300 rounded-full"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tips */}
                    {item.tips && (
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">提示</p>
                        <div className="space-y-1">
                          {item.tips.map((tip, i) => (
                            <p key={i} className="text-sm text-zinc-400">
                              {tip}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completion celebration */}
      {completedCount === totalCount && (
        <div className="mx-4 p-6 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-center animate-fade-in">
          <p className="text-4xl mb-2">🎉</p>
          <h3 className="text-lg font-bold text-emerald-400">今日训练完成！</h3>
          <p className="text-sm text-zinc-400 mt-1">坚持练习，每天进步一点点</p>
        </div>
      )}
    </div>
  );
}
