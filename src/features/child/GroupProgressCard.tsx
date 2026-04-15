import { useMemo } from 'react';
import { motion } from 'motion/react';
import type { Quest, QuestGroup } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  group: QuestGroup;
  quests: Quest[]; // today's instances
  key?: string | number;
}

export function GroupProgressCard({ group, quests }: Props) {
  const { done, total, claimed } = useMemo(() => {
    const members = quests.filter((q) => q.groupId === group.id);
    const doneCount = members.filter((q) => q.completed).length;
    const anyClaimed = members.some((q) => q.groupBonusClaimed);
    return { done: doneCount, total: members.length, claimed: anyClaimed };
  }, [group.id, quests]);

  if (total === 0) return null;

  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const fullyDone = done === total;

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl p-4 border-2 transition-all',
        claimed
          ? 'bg-gradient-to-br from-yellow-100 to-amber-100 border-yellow-300'
          : fullyDone
            ? 'bg-gradient-to-br from-purple-100 to-pink-100 border-purple-300'
            : 'bg-white border-slate-100',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">{group.icon || '🏆'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-black text-slate-800 truncate">{group.title}</p>
            <span className="text-[10px] font-black text-purple-600 bg-white px-2 py-0.5 rounded-full">
              +{group.bonusPoints}P 보너스
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 bg-white/60 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                className={cn(
                  'h-full rounded-full',
                  claimed ? 'bg-yellow-500' : 'bg-purple-500',
                )}
              />
            </div>
            <span className="text-[10px] font-black text-slate-600 shrink-0">
              {done}/{total}
            </span>
          </div>
          {claimed && (
            <p className="text-[10px] font-black text-amber-700 mt-1">
              ✨ 오늘 보너스 받음!
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
