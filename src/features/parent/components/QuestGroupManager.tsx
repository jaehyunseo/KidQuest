import React, { useMemo, useState } from 'react';
import { Trash2, Target, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Quest, QuestGroup } from '../../../types';
import { cn } from '../../../lib/utils';

interface Props {
  groups: QuestGroup[];
  quests: Quest[];
  onAdd: (
    data: Omit<QuestGroup, 'id' | 'createdAt'>,
    questIds?: string[],
  ) => Promise<string | null>;
  onUpdate: (
    id: string,
    updates: Partial<Omit<QuestGroup, 'id' | 'createdAt'>>,
  ) => Promise<void>;
  onDelete: (id: string) => void;
  onAssignQuest: (questId: string, groupId: string | null) => Promise<void>;
}

const ICON_CHOICES = ['🏆', '⭐', '🎯', '🔥', '🌈', '💎', '🚀', '🌟'];

export function QuestGroupManager({
  groups,
  quests,
  onAdd,
  onUpdate,
  onDelete,
  onAssignQuest,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [bonusPoints, setBonusPoints] = useState<number | string>(30);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [addQuestOpenFor, setAddQuestOpenFor] = useState<string | null>(null);

  const questsByGroup = useMemo(() => {
    const map: Record<string, Quest[]> = {};
    for (const q of quests) {
      if (q.groupId) {
        if (!map[q.groupId]) map[q.groupId] = [];
        map[q.groupId].push(q);
      }
    }
    return map;
  }, [quests]);

  const unassignedQuests = useMemo(
    () => quests.filter((q) => !q.groupId),
    [quests],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const resetForm = () => {
    setTitle('');
    setIcon(ICON_CHOICES[0]);
    setBonusPoints(30);
    setSelectedIds([]);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || Number(bonusPoints) <= 0 || submitting) return;
    setSubmitting(true);
    try {
      await onAdd(
        {
          title: title.trim(),
          icon,
          bonusPoints: Number(bonusPoints),
          templateIds: [],
        },
        selectedIds,
      );
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
            <Target size={20} />
          </div>
          <div>
            <h3 className="font-black text-lg text-slate-800">퀘스트 그룹 & 보너스</h3>
            <p className="text-[10px] font-bold text-slate-400">
              여러 퀘스트를 묶어 하루 안에 모두 완료하면 추가 포인트 지급
            </p>
          </div>
        </div>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all',
            showForm
              ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              : 'bg-purple-500 text-white hover:bg-purple-600 shadow-md shadow-purple-100',
          )}
        >
          {showForm ? (
            <>
              <X size={12} />
              닫기
            </>
          ) : (
            <>
              <Plus size={12} />
              새 그룹
            </>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showForm && (
          <motion.form
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="space-y-4 bg-linear-to-br from-purple-50 to-pink-50 rounded-2xl p-4 overflow-hidden"
          >
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                1. 그룹 이름
              </label>
              <input
                type="text"
                placeholder="예: 아침 루틴"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                className="w-full border-2 border-white rounded-xl px-4 py-3 outline-none focus:border-purple-400 bg-white font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                2. 아이콘
              </label>
              <div className="grid grid-cols-8 gap-1">
                {ICON_CHOICES.map((ic) => (
                  <button
                    type="button"
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={cn(
                      'aspect-square rounded-xl flex items-center justify-center text-xl transition-all active:scale-90',
                      icon === ic
                        ? 'bg-purple-400 shadow-md scale-105'
                        : 'bg-white hover:bg-purple-100',
                    )}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                3. 완성 보너스 포인트
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={bonusPoints}
                  onChange={(e) =>
                    setBonusPoints(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full border-2 border-white rounded-xl px-4 py-3 outline-none focus:border-purple-400 bg-white font-black"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-purple-600">
                  +P 보너스
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  4. 묶을 퀘스트 선택 ({selectedIds.length}개)
                </label>
                {quests.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIds(
                        selectedIds.length === quests.length
                          ? []
                          : quests.map((q) => q.id),
                      )
                    }
                    className="text-[10px] font-black text-purple-600 hover:text-purple-700"
                  >
                    {selectedIds.length === quests.length ? '전체 해제' : '전체 선택'}
                  </button>
                )}
              </div>
              {quests.length === 0 ? (
                <p className="text-xs font-bold text-slate-400 bg-white rounded-xl p-4 text-center">
                  먼저 퀘스트 탭에서 퀘스트를 등록해주세요
                </p>
              ) : (
                <div className="max-h-52 overflow-y-auto bg-white rounded-xl p-2 space-y-1">
                  {quests.map((q) => {
                    const checked = selectedIds.includes(q.id);
                    const alreadyInAnother =
                      q.groupId && !checked; // belongs to another group
                    return (
                      <label
                        key={q.id}
                        className={cn(
                          'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                          checked
                            ? 'bg-purple-100 hover:bg-purple-200'
                            : 'hover:bg-slate-50',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelected(q.id)}
                          className="w-4 h-4 accent-purple-500 shrink-0"
                        />
                        <span className="flex-1 font-bold text-sm text-slate-700 truncate">
                          {q.title}
                        </span>
                        {alreadyInAnother && (
                          <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                            다른 그룹 이동
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-orange-500 shrink-0">
                          +{q.points}P
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!title.trim() || Number(bonusPoints) <= 0 || submitting}
              className="w-full bg-purple-500 disabled:bg-slate-200 disabled:text-slate-400 hover:bg-purple-600 text-white font-black py-3 rounded-xl active:scale-[0.98] transition-all"
            >
              {submitting ? '만드는 중...' : `그룹 만들기${selectedIds.length > 0 ? ` (${selectedIds.length}개 연결)` : ''}`}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {groups.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center">
            <p className="text-slate-400 font-bold text-xs">
              그룹을 만들어 아이에게 목표 의식을 심어주세요!
            </p>
          </div>
        ) : (
          groups.map((g) => {
            const members = questsByGroup[g.id] || [];
            const isAddOpen = addQuestOpenFor === g.id;
            return (
              <div
                key={g.id}
                className="p-4 rounded-2xl border border-purple-100 bg-linear-to-br from-purple-50 to-pink-50 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-2xl">{g.icon}</span>
                    <div className="min-w-0">
                      <p className="font-black text-slate-800 truncate">{g.title}</p>
                      <p className="text-[10px] font-bold text-purple-600">
                        완성 보너스 +{g.bonusPoints}P · {members.length}개 퀘스트
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDelete(g.id)}
                    className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg active:scale-90"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      onUpdate(g.id, { bonusPoints: Math.max(1, g.bonusPoints - 10) })
                    }
                    className="px-2 py-0.5 text-[10px] font-black bg-white text-purple-600 rounded-lg hover:bg-purple-100"
                  >
                    -10P
                  </button>
                  <button
                    onClick={() => onUpdate(g.id, { bonusPoints: g.bonusPoints + 10 })}
                    className="px-2 py-0.5 text-[10px] font-black bg-white text-purple-600 rounded-lg hover:bg-purple-100"
                  >
                    +10P
                  </button>
                  <button
                    onClick={() => setAddQuestOpenFor(isAddOpen ? null : g.id)}
                    className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black bg-white text-purple-600 rounded-lg hover:bg-purple-100"
                  >
                    <Plus size={10} />
                    퀘스트 추가
                  </button>
                </div>

                {members.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => onAssignQuest(m.id, null)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-full hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="그룹에서 제거"
                      >
                        {m.title}
                        <X size={10} />
                      </button>
                    ))}
                  </div>
                )}

                <AnimatePresence>
                  {isAddOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-white rounded-xl p-2 space-y-1 max-h-48 overflow-y-auto">
                        {unassignedQuests.length === 0 ? (
                          <p className="text-[11px] font-bold text-slate-400 p-2 text-center">
                            그룹에 추가할 수 있는 퀘스트가 없어요
                          </p>
                        ) : (
                          unassignedQuests.map((q) => (
                            <button
                              key={q.id}
                              onClick={() => {
                                void onAssignQuest(q.id, g.id);
                              }}
                              className="w-full flex items-center justify-between gap-2 p-2 hover:bg-purple-50 rounded-lg text-left"
                            >
                              <span className="font-bold text-xs text-slate-700 truncate flex-1">
                                {q.title}
                              </span>
                              <span className="text-[10px] font-bold text-orange-500 shrink-0">
                                +{q.points}P
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
