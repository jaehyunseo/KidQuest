import { useMemo } from 'react';
import { Trophy, Sparkles, CheckCircle2, Circle, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  type CustomCategory,
  type Quest,
  type QuestGroup,
  type UserProfile,
} from '../../types';
import { cn } from '../../lib/utils';
import { CategoryIcon } from '../../components/CategoryIcon';
import { resolveCategory } from '../../lib/categoryDisplay';
import { GroupProgressCard } from './GroupProgressCard';

export function ChildDashboard({
  quests,
  customCategories,
  onToggle,
  profile,
  encouragement,
  isLoadingAI,
  onRefreshAI,
  groups,
}: {
  quests: Quest[],
  customCategories: CustomCategory[],
  onToggle: (id: string) => void,
  profile: UserProfile,
  encouragement: string,
  isLoadingAI: boolean,
  onRefreshAI: () => void,
  groups: QuestGroup[],
}) {
  const sortedQuests = useMemo(() => {
    return [...quests].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  }, [quests]);

  return (
    <div className="space-y-6">
      {/* Point Card */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl p-6 text-white shadow-xl shadow-orange-200 relative overflow-hidden"
      >
        <div className="relative z-10">
          <p className="text-orange-100 font-bold text-sm uppercase tracking-wider">현재 보유 포인트</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-5xl font-black tracking-tighter">{profile.totalPoints.toLocaleString()}</span>
            <span className="text-xl font-bold opacity-80">P</span>
          </div>
          {(profile.streak ?? 0) > 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
              <Flame size={14} className="text-white" />
              <span className="text-xs font-black">
                {profile.streak}일 연속 미션 성공 🔥
              </span>
            </div>
          )}
        </div>
        <Trophy className="absolute -right-4 -bottom-4 w-32 h-32 text-white/20 rotate-12" />
      </motion.div>

      {/* AI Encouragement */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex gap-4 items-start relative group">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
          <Sparkles size={20} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">오늘의 응원</p>
          <p className="text-slate-700 font-medium leading-relaxed">
            {isLoadingAI ? '응원 메시지를 생각 중이에요...' : encouragement}
          </p>
        </div>
        <button 
          onClick={onRefreshAI}
          className="p-1 text-slate-300 hover:text-blue-500 transition-colors"
        >
          <Sparkles size={16} />
        </button>
      </div>

      {/* Quest Groups */}
      {groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((g) => (
            <GroupProgressCard key={g.id} group={g} quests={quests} />
          ))}
        </div>
      )}

      {/* Quest List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-black text-xl text-slate-800">오늘의 미션</h2>
          <span className="text-xs font-bold text-slate-400">
            {quests.filter(q => q.completed).length} / {quests.length} 완료
          </span>
        </div>
        
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sortedQuests.map((quest) => {
              const cat = resolveCategory(quest.category, customCategories);
              return (
              <motion.button
                key={quest.id}
                layout
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={() => onToggle(quest.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                  quest.completed
                    ? "bg-slate-50 border-slate-100 opacity-60"
                    : "bg-white border-white shadow-md hover:border-yellow-200 active:scale-95"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  quest.completed ? "bg-slate-200 text-slate-400" : cat.color + " text-white"
                )}>
                  <CategoryIcon category={quest.category} customCategories={customCategories} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500",
                      !quest.completed && "bg-white/50"
                    )}>
                      {cat.label}
                    </span>
                    <span className="text-xs font-bold text-orange-500">+{quest.points}P</span>
                  </div>
                  <h3 className={cn(
                    "font-bold text-slate-800 truncate",
                    quest.completed && "line-through text-slate-400"
                  )}>
                    {quest.title}
                  </h3>
                </div>

                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                  quest.completed ? "bg-green-500 text-white" : "border-2 border-slate-200 text-slate-200"
                )}>
                  {quest.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </div>
              </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
