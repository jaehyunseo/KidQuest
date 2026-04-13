import { Trophy } from 'lucide-react';
import type { UserProfile, Quest } from '../../../types';
import { getLevel, getProgressToNextLevel } from '../../../lib/utils';
import { Avatar } from '../../../components/Avatar';

interface ChildSummaryWidgetProps {
  profile: UserProfile;
  quests: Quest[];
}

export function ChildSummaryWidget({ profile, quests }: ChildSummaryWidgetProps) {
  const completed = quests.filter((q) => q.completed).length;
  const total = quests.length;
  const progressPercent = total > 0 ? (completed / total) * 100 : 0;
  const levelProgress = getProgressToNextLevel(profile.totalPoints);

  return (
    <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl p-6 text-white shadow-xl shadow-orange-200 relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm overflow-hidden">
              <Avatar emoji={profile.avatar} url={profile.avatarUrl} size={64} className="rounded-2xl" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">
                Active Child
              </p>
              <h2 className="text-2xl font-black tracking-tight">{profile.name}</h2>
              <p className="text-sm font-bold text-white/90">
                Lv.{getLevel(profile.totalPoints)} · {profile.totalPoints.toLocaleString()}P
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">오늘</p>
            <p className="text-3xl font-black tabular-nums">
              {completed}
              <span className="text-lg text-white/70">/{total}</span>
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <div className="flex items-center justify-between text-[10px] font-black text-white/80 mb-1">
              <span>오늘 진행</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] font-black text-white/80 mb-1">
              <span>다음 레벨까지</span>
              <span>{Math.round(levelProgress)}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      <Trophy className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
    </div>
  );
}
