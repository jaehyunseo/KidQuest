import { useMemo } from 'react';
import { TrendingUp, Flame, Award, CheckCircle2, Coins } from 'lucide-react';
import type { ChildProfile, HistoryRecord } from '../../../types';
import { ACHIEVEMENTS } from '../../../lib/achievements';

interface WeeklyReportProps {
  profile: ChildProfile | { name: string; streak?: number; longestStreak?: number; achievements?: string[]; totalCompleted?: number };
  history: HistoryRecord[];
}

/**
 * 7-day growth summary card for parents. Rolls up quest completions,
 * points earned/spent, and newly-unlocked badges from the last 7 days.
 * Uses only data already subscribed to by the app — no extra fetches.
 */
export function WeeklyReport({ profile, history }: WeeklyReportProps) {
  const stats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    let questsDone = 0;
    let pointsEarned = 0;
    let pointsSpent = 0;
    let missionsRedeemed = 0;

    // Per-day buckets for sparkline
    const buckets: number[] = [0, 0, 0, 0, 0, 0, 0]; // index 0 = 6 days ago, 6 = today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    for (const h of history) {
      const ts = new Date(h.timestamp).getTime();
      if (ts < weekAgo) continue;
      if (h.type === 'reward' || (h.points ?? 0) < 0) {
        pointsSpent += Math.abs(h.points ?? 0);
        missionsRedeemed += 1;
      } else {
        questsDone += 1;
        pointsEarned += h.points ?? 0;
        // Bucket
        const dayDiff = Math.floor((startOfToday.getTime() - new Date(ts).setHours(0, 0, 0, 0)) / 86400000);
        const idx = 6 - dayDiff;
        if (idx >= 0 && idx < 7) buckets[idx] += 1;
      }
    }

    return { questsDone, pointsEarned, pointsSpent, missionsRedeemed, buckets };
  }, [history]);

  const maxBucket = Math.max(1, ...stats.buckets);
  const unlockedCount = profile.achievements?.length ?? 0;

  // Weekday labels for the sparkline
  const dayLabels = useMemo(() => {
    const labels: string[] = [];
    const names = ['일', '월', '화', '수', '목', '금', '토'];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      labels.push(names[d.getDay()]);
    }
    return labels;
  }, []);

  return (
    <div className="bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 rounded-[2rem] p-6 text-white shadow-lg shadow-blue-200 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className="font-black text-lg">이번 주 성장 리포트</h3>
            <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">
              지난 7일 · {profile.name}
            </p>
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center">
            <CheckCircle2 size={14} className="mx-auto text-yellow-300 mb-0.5" />
            <p className="text-lg font-black leading-none">{stats.questsDone}</p>
            <p className="text-[9px] font-bold text-blue-100 mt-0.5">완료</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center">
            <Coins size={14} className="mx-auto text-yellow-300 mb-0.5" />
            <p className="text-lg font-black leading-none">+{stats.pointsEarned}</p>
            <p className="text-[9px] font-bold text-blue-100 mt-0.5">획득</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center">
            <Flame size={14} className="mx-auto text-orange-300 mb-0.5" />
            <p className="text-lg font-black leading-none">{profile.streak ?? 0}</p>
            <p className="text-[9px] font-bold text-blue-100 mt-0.5">연속일</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center">
            <Award size={14} className="mx-auto text-pink-200 mb-0.5" />
            <p className="text-lg font-black leading-none">
              {unlockedCount}/{ACHIEVEMENTS.length}
            </p>
            <p className="text-[9px] font-bold text-blue-100 mt-0.5">배지</p>
          </div>
        </div>

        {/* Sparkline */}
        <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
          <p className="text-[9px] font-black text-blue-100 uppercase tracking-widest mb-2">
            일별 약속 완료
          </p>
          <div className="flex items-end justify-between gap-1 h-16">
            {stats.buckets.map((count, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full bg-yellow-300 rounded-t-md transition-all"
                    style={{ height: `${(count / maxBucket) * 100}%`, minHeight: count > 0 ? 4 : 0 }}
                  />
                </div>
                <span className="text-[9px] font-bold text-blue-100">{dayLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {stats.questsDone === 0 && (
          <p className="text-[11px] font-bold text-blue-100 text-center">
            이번 주는 아직 완료한 약속이 없어요. 함께 응원해주세요!
          </p>
        )}
      </div>
    </div>
  );
}
