import React, { useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORY_LABELS, CATEGORY_COLORS, type QuestCategory } from '../../../types';
import { cn } from '../../../lib/utils';
import { CategoryIcon } from '../../../components/CategoryIcon';
import { QUEST_PRESETS } from '../constants';

interface QuestQuickAddProps {
  onAdd: (title: string, points: number, category: QuestCategory) => void;
}

const CATEGORIES: Array<QuestCategory | 'all'> = ['all', 'homework', 'chore', 'habit', 'other'];

export function QuestQuickAdd({ onAdd }: QuestQuickAddProps) {
  const [filter, setFilter] = useState<QuestCategory | 'all'>('all');
  const [showFullForm, setShowFullForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPoints, setNewPoints] = useState<number | string>(10);
  const [newCategory, setNewCategory] = useState<QuestCategory>('homework');

  const filteredPresets =
    filter === 'all' ? QUEST_PRESETS : QUEST_PRESETS.filter((p) => p.category === filter);

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
            <h3 className="font-black text-lg text-slate-800">퀘스트 추가</h3>
            <p className="text-[10px] font-bold text-slate-400">자주 쓰는 것은 한 번에 추가하세요</p>
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
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={cn(
                    'flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-black transition-all',
                    filter === c
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  )}
                >
                  {c === 'all' ? '전체' : CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredPresets.map((p, i) => (
                <button
                  key={`${p.title}-${i}`}
                  onClick={() => onAdd(p.title, p.points, p.category)}
                  className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 hover:bg-yellow-50 border border-slate-200 hover:border-yellow-300 rounded-xl transition-all active:scale-95 text-left"
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0',
                      CATEGORY_COLORS[p.category]
                    )}
                  >
                    <CategoryIcon category={p.category} size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-800 truncate">{p.title}</p>
                    <p className="text-[10px] font-bold text-orange-500">+{p.points}P</p>
                  </div>
                </button>
              ))}
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
                  onChange={(e) => setNewCategory(e.target.value as QuestCategory)}
                  className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-yellow-400 outline-none transition-all font-bold appearance-none bg-slate-50/50"
                >
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
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
              퀘스트 등록하기
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
