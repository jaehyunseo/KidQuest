import React, { useState } from 'react';
import { Plus, Trash2, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { CustomCategory, Quest } from '../../../types';
import { CATEGORY_LABELS } from '../../../types';
import { cn } from '../../../lib/utils';
import { CUSTOM_CATEGORY_COLORS, CUSTOM_CATEGORY_EMOJIS } from '../../../lib/categoryDisplay';

interface CategoryManagerProps {
  customCategories: CustomCategory[];
  quests: Quest[];
  onAdd: (data: Omit<CustomCategory, 'id' | 'createdAt'>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showAlert: (title: string, message: string) => void;
}

export function CategoryManager({
  customCategories,
  quests,
  onAdd,
  onDelete,
  showAlert,
}: CategoryManagerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    label: '',
    color: CUSTOM_CATEGORY_COLORS[0].value,
    icon: CUSTOM_CATEGORY_EMOJIS[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.label.trim()) return;
    await onAdd({ label: draft.label.trim(), color: draft.color, icon: draft.icon });
    setDraft({
      label: '',
      color: CUSTOM_CATEGORY_COLORS[0].value,
      icon: CUSTOM_CATEGORY_EMOJIS[0],
    });
    setOpen(false);
  };

  const handleDelete = async (cat: CustomCategory) => {
    const inUse = quests.some((q) => q.category === cat.id);
    if (inUse) {
      showAlert(
        '삭제 불가',
        `"${cat.label}" 카테고리를 사용 중인 약속이 있어요. 먼저 해당 약속들을 삭제하거나 다른 카테고리로 옮긴 후 다시 시도해주세요.`
      );
      return;
    }
    await onDelete(cat.id);
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600 text-xl">
            🏷️
          </div>
          <div>
            <h3 className="font-black text-lg text-slate-800">카테고리 관리</h3>
            <p className="text-[10px] font-bold text-slate-400">
              우리 가족만의 카테고리를 만들어보세요
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90',
            open
              ? 'bg-slate-100 text-slate-400'
              : 'bg-violet-50 text-violet-600 shadow-lg shadow-violet-100'
          )}
        >
          <Plus size={20} className={cn('transition-transform', open && 'rotate-45')} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="bg-violet-50 p-5 rounded-2xl space-y-3 overflow-hidden border-2 border-dashed border-violet-200"
          >
            <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest">
              새 카테고리 만들기
            </p>
            <input
              type="text"
              placeholder="카테고리 이름 (예: 운동, 음악, 책읽기)"
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              maxLength={10}
              className="w-full border-2 border-violet-200 rounded-xl px-4 py-3 outline-none focus:border-violet-400 bg-white font-bold text-sm"
            />
            <div>
              <p className="text-[9px] font-black text-violet-500 uppercase mb-1.5">아이콘</p>
              <div className="grid grid-cols-8 gap-1.5">
                {CUSTOM_CATEGORY_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, icon: e }))}
                    className={cn(
                      'aspect-square rounded-lg flex items-center justify-center text-xl transition-all active:scale-90',
                      draft.icon === e ? 'bg-violet-400 shadow-md' : 'bg-white hover:bg-violet-100'
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black text-violet-500 uppercase mb-1.5">색상</p>
              <div className="grid grid-cols-8 gap-1.5">
                {CUSTOM_CATEGORY_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, color: c.value }))}
                    className={cn(
                      'aspect-square rounded-lg transition-all active:scale-90 border-2',
                      c.value,
                      draft.color === c.value ? 'border-slate-900 scale-110 shadow-md' : 'border-transparent'
                    )}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 bg-white border border-slate-200 text-slate-500 font-bold py-3 rounded-xl text-sm"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!draft.label.trim()}
                className="flex-[2] bg-violet-500 disabled:bg-slate-200 text-white font-black py-3 rounded-xl text-sm shadow-lg shadow-violet-100"
              >
                카테고리 등록
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">기본 카테고리</p>
        <div className="grid grid-cols-2 gap-2">
          {(['homework', 'chore', 'habit', 'other'] as const).map((id) => (
            <div
              key={id}
              className="bg-slate-50 px-3 py-2 rounded-xl flex items-center gap-2 opacity-70"
            >
              <Lock size={10} className="text-slate-400 shrink-0" />
              <span className="text-xs font-black text-slate-600 truncate">{CATEGORY_LABELS[id]}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-bold text-slate-400 mt-1 px-1">
          기본 카테고리는 삭제할 수 없어요
        </p>
      </div>

      {customCategories.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">우리 가족 카테고리</p>
          <div className="space-y-2">
            {customCategories.map((cat) => {
              const usageCount = quests.filter((q) => q.category === cat.id).length;
              return (
                <motion.div
                  layout
                  key={cat.id}
                  className="bg-slate-50 p-3 rounded-2xl flex items-center gap-3"
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl shadow shrink-0',
                      cat.color
                    )}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 text-sm truncate">{cat.label}</p>
                    <p className="text-[10px] font-bold text-slate-400">사용 중: {usageCount}개 약속</p>
                  </div>
                  <button
                    onClick={() => handleDelete(cat)}
                    disabled={usageCount > 0}
                    className={cn(
                      'w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90',
                      usageCount > 0
                        ? 'text-slate-200 cursor-not-allowed'
                        : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                    )}
                    aria-label="삭제"
                    title={usageCount > 0 ? '사용 중인 약속이 있어 삭제할 수 없어요' : '삭제'}
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
