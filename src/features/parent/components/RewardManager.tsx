import React, { useState } from 'react';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Reward } from '../../../types';
import { cn } from '../../../lib/utils';

const REWARD_EMOJIS = ['🎁', '📺', '🍦', '🎮', '🧸', '🍕', '🍫', '🎬', '🎨', '⚽', '📚', '🎵', '🚲', '🎢', '🏖️', '🎪'];

interface RewardManagerProps {
  rewards: Reward[];
  onAdd: (reward: Omit<Reward, 'id'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<Reward, 'id'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function RewardManager({ rewards, onAdd, onUpdate, onDelete }: RewardManagerProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<Reward, 'id'>>({
    title: '',
    description: '',
    points: 100,
    icon: REWARD_EMOJIS[0],
  });

  const resetDraft = () => {
    setDraft({ title: '', description: '', points: 100, icon: REWARD_EMOJIS[0] });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim() || draft.points <= 0) return;
    if (editingId) {
      await onUpdate(editingId, draft);
    } else {
      await onAdd(draft);
    }
    resetDraft();
    setOpen(false);
  };

  const startEdit = (reward: Reward) => {
    setDraft({
      title: reward.title,
      description: reward.description,
      points: reward.points,
      icon: reward.icon,
    });
    setEditingId(reward.id);
    setOpen(true);
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center text-pink-600 text-xl">
            🎁
          </div>
          <div>
            <h3 className="font-black text-lg text-slate-800">특별 미션 보드</h3>
            <p className="text-[10px] font-bold text-slate-400">
              아이가 성장 포인트를 모아 열 수 있는 특별한 경험을 만들어주세요
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (open) resetDraft();
            setOpen(!open);
          }}
          className={cn(
            'w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90',
            open ? 'bg-slate-100 text-slate-400' : 'bg-pink-50 text-pink-600 shadow-lg shadow-pink-100'
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
            className="bg-pink-50 p-5 rounded-2xl space-y-3 overflow-hidden border-2 border-dashed border-pink-200"
          >
            <p className="text-[10px] font-black text-pink-600 uppercase tracking-widest">
              {editingId ? '미션 수정' : '새 특별 미션 만들기'}
            </p>
            <div className="grid grid-cols-8 gap-1.5">
              {REWARD_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, icon: e }))}
                  className={cn(
                    'aspect-square rounded-lg flex items-center justify-center text-xl transition-all active:scale-90',
                    draft.icon === e ? 'bg-pink-400 shadow-md' : 'bg-white hover:bg-pink-100'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="미션 이름 (예: 가족 영화의 밤, 주말 캠핑)"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              className="w-full border-2 border-pink-200 rounded-xl px-4 py-3 outline-none focus:border-pink-400 bg-white font-bold text-sm"
            />
            <textarea
              placeholder="설명 (선택)"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={2}
              className="w-full border-2 border-pink-200 rounded-xl px-4 py-3 outline-none focus:border-pink-400 bg-white text-xs resize-none"
            />
            <div className="relative">
              <input
                type="number"
                min={1}
                placeholder="필요 포인트"
                value={draft.points || ''}
                onChange={(e) => setDraft((d) => ({ ...d, points: Number(e.target.value) || 0 }))}
                className="w-full border-2 border-pink-200 rounded-xl px-4 py-3 outline-none focus:border-pink-400 bg-white font-black text-sm"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-pink-500 text-sm">P</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  resetDraft();
                  setOpen(false);
                }}
                className="flex-1 bg-white border border-slate-200 text-slate-500 font-bold py-3 rounded-xl text-sm"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!draft.title.trim() || draft.points <= 0}
                className="flex-[2] bg-pink-500 disabled:bg-slate-200 text-white font-black py-3 rounded-xl text-sm shadow-lg shadow-pink-100"
              >
                {editingId ? '수정 완료' : '미션 등록'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {rewards.length > 0 ? (
          rewards.map((r) => (
            <motion.div
              layout
              key={r.id}
              className="bg-slate-50 p-3 rounded-2xl flex items-center gap-3 group"
            >
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-2xl shadow-inner shrink-0">
                {r.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 text-sm leading-tight truncate">{r.title}</p>
                {r.description && (
                  <p className="text-[10px] font-medium text-slate-500 truncate">{r.description}</p>
                )}
                <p className="text-[10px] font-black text-pink-500 mt-0.5">{r.points.toLocaleString()}P</p>
              </div>
              <button
                onClick={() => startEdit(r)}
                className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all active:scale-90"
                aria-label="수정"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => onDelete(r.id)}
                className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"
                aria-label="삭제"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))
        ) : (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center">
            <p className="text-slate-400 font-bold text-xs">
              아직 특별 미션이 없어요.
              <br />위 + 버튼으로 첫 미션을 만들어보세요!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
