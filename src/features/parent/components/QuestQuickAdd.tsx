import React, { useMemo, useState } from 'react';
import { Plus, ChevronRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORY_LABELS, type CustomCategory, type HistoryRecord, type QuestCategory } from '../../../types';
import { cn } from '../../../lib/utils';
import { CategoryIcon } from '../../../components/CategoryIcon';
import { resolveCategory } from '../../../lib/categoryDisplay';
import { QUEST_PRESETS } from '../constants';
import { topCategories } from '../../../lib/categoryPreference';

interface QuestQuickAddProps {
  onAdd: (title: string, points: number, category: QuestCategory | string) => void;
  customCategories: CustomCategory[];
  history: HistoryRecord[];
}

const BUILTIN_FILTERS: Array<QuestCategory | 'all'> = ['all', 'homework', 'chore', 'habit', 'other'];

export function QuestQuickAdd({ onAdd, customCategories, history }: QuestQuickAddProps) {
  const [filter, setFilter] = useState<string>('recommended');
  const [showFullForm, setShowFullForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPoints, setNewPoints] = useState<number | string>(10);
  const [newCategory, setNewCategory] = useState<string>('homework');

  // Top 3 categories the child actually completes — used to surface the
  // most relevant presets first.
  const favoriteCategories = useMemo(() => topCategories(history, 3), [history]);
  const hasPreferences = favoriteCategories.length > 0;

  const allFilters: string[] = [
    ...(hasPreferences ? ['recommended'] : []),
    ...BUILTIN_FILTERS,
    ...customCategories.map((c) => c.id),
  ];
  const filteredPresets =
    filter === 'all'
      ? QUEST_PRESETS
      : filter === 'recommended'
        ? (hasPreferences
            ? QUEST_PRESETS
                .slice()
                .sort((a, b) => {
                  const ai = favoriteCategories.indexOf(a.category);
                  const bi = favoriteCategories.indexOf(b.category);
                  const av = ai === -1 ? 99 : ai;
                  const bv = bi === -1 ? 99 : bi;
                  return av - bv;
                })
                .slice(0, 6)
            : QUEST_PRESETS)
      : QUEST_PRESETS.filter((p) => p.category === filter);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || newPoints === '' || Number(newPoints) <= 0) return;
    onAdd(newTitle, Number(newPoints), newCategory);
    setNewTitle('');
    setNewPoints(10);
    setShowFullForm(false);
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center text-yellow-600">
            <Plus size={20} />
          </div>
          <div>
            <h3 className="font-black text-lg text-slate-800">함께할 약속 만들기</h3>
            <p className="text-[10px] font-bold text-slate-400">자주 쓰는 약속은 한 번에 추가하세요</p>
          </div>
        </div>
        <button
          onClick={() => setShowFullForm((v) => !v)}
          className="text-xs font-black text-blue-600 hover:text-blue-700"
        >
          {showFullForm ? '프리셋으로' : '직접 만들기'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!showFullForm ? (
          <motion.div
            key="presets"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
              {allFilters.map((c) => {
                const isRecommended = c === 'recommended';
                const label = isRecommended
                  ? '추천'
                  : c === 'all'
                    ? '전체'
                    : resolveCategory(c, customCategories).label;
                return (
                  <button
                    key={c}
                    onClick={() => setFilter(c)}
                    className={cn(
                      'flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-black transition-all flex items-center gap-1',
                      filter === c
                        ? isRecommended
                          ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md'
                          : 'bg-slate-900 text-white'
                        : isRecommended
                          ? 'bg-pink-50 text-pink-600 hover:bg-pink-100'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    )}
                  >
                    {isRecommended && <Sparkles size={10} />}
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredPresets.map((p, i) => {
                const cat = resolveCategory(p.category, customCategories);
                return (
                  <button
                    key={`${p.title}-${i}`}
                    onClick={() => onAdd(p.title, p.points, p.category)}
                    className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 hover:bg-yellow-50 border border-slate-200 hover:border-yellow-300 rounded-xl transition-all active:scale-95 text-left"
                  >
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0',
                        cat.color
                      )}
                    >
                      <CategoryIcon
                        category={p.category}
                        size={14}
                        customCategories={customCategories}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">{p.title}</p>
                      <p className="text-[10px] font-bold text-orange-500">+{p.points}P</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <input
              type="text"
              placeholder="예: 방 정리하기, 책 1권 읽기"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-yellow-400 bg-slate-50/50 font-bold transition-all"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type="number"
                  value={newPoints}
                  onChange={(e) =>
                    setNewPoints(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-yellow-400 bg-slate-50/50 font-black transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-yellow-600">
                  P
                </span>
              </div>
              <div className="relative">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-yellow-400 outline-none transition-all font-bold appearance-none bg-slate-50/50"
                >
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                  {customCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </select>
                <ChevronRight
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black py-4 rounded-2xl shadow-lg shadow-yellow-100 transition-all active:scale-[0.98]"
            >
              약속 만들기
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
