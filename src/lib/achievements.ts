/**
 * Achievement badge definitions and unlock logic.
 *
 * Badges are unlocked client-side on quest completion / reward purchase.
 * Because they are stored under the child profile in Firestore, the
 * firestore.rules allow family members to write achievements under
 * their own child. (This is a soft gate — real enforcement is that only
 * family members can write at all.)
 */

import type { UserProfile } from '../types';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji
  color: string; // tailwind gradient
  check: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
  totalCompleted: number;
  streak: number;
  longestStreak: number;
  rewardsRedeemed: number;
  totalPoints: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_step',
    title: '첫 발걸음',
    description: '첫 미션을 지켰어요!',
    icon: '🌱',
    color: 'from-green-400 to-emerald-500',
    check: (s) => s.totalCompleted >= 1,
  },
  {
    id: 'ten_done',
    title: '미션 지킴이',
    description: '미션 10개를 지켰어요',
    icon: '⭐',
    color: 'from-yellow-400 to-orange-500',
    check: (s) => s.totalCompleted >= 10,
  },
  {
    id: 'fifty_done',
    title: '꾸준함의 달인',
    description: '미션 50개 달성!',
    icon: '🏅',
    color: 'from-amber-400 to-yellow-600',
    check: (s) => s.totalCompleted >= 50,
  },
  {
    id: 'hundred_done',
    title: '백 번의 미션',
    description: '미션 100개 달성!',
    icon: '👑',
    color: 'from-yellow-500 to-amber-600',
    check: (s) => s.totalCompleted >= 100,
  },
  {
    id: 'streak_3',
    title: '3일 연속',
    description: '3일 연속 미션 지키기',
    icon: '🔥',
    color: 'from-orange-400 to-red-500',
    check: (s) => s.longestStreak >= 3,
  },
  {
    id: 'streak_7',
    title: '일주일 챔피언',
    description: '7일 연속 미션 지키기',
    icon: '🏆',
    color: 'from-orange-500 to-pink-500',
    check: (s) => s.longestStreak >= 7,
  },
  {
    id: 'streak_30',
    title: '한 달 전설',
    description: '30일 연속 미션 지키기',
    icon: '💎',
    color: 'from-blue-400 to-purple-600',
    check: (s) => s.longestStreak >= 30,
  },
  {
    id: 'first_reward',
    title: '첫 보상',
    description: '첫 보상을 받았어요',
    icon: '🎁',
    color: 'from-pink-400 to-rose-500',
    check: (s) => s.rewardsRedeemed >= 1,
  },
  {
    id: 'point_1000',
    title: '천 포인트 클럽',
    description: '누적 1,000P 달성',
    icon: '💰',
    color: 'from-yellow-400 to-amber-500',
    check: (s) => s.totalPoints >= 1000,
  },
];

/** Given updated stats, returns IDs of newly-unlocked badges. */
export function evaluateNewBadges(
  stats: AchievementStats,
  alreadyUnlocked: string[]
): string[] {
  const unlocked = new Set(alreadyUnlocked);
  const newly: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!unlocked.has(a.id) && a.check(stats)) {
      newly.push(a.id);
    }
  }
  return newly;
}

export function findAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** Format a date as YYYY-MM-DD in local time. */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Compute the next streak value given the previous streak/date and today.
 *   - If lastDate == today -> streak unchanged (already counted today).
 *   - If lastDate == yesterday -> streak + 1.
 *   - Otherwise -> reset to 1.
 */
export function nextStreak(
  prevStreak: number | undefined,
  lastDate: string | undefined,
  today: string = localDateKey()
): { streak: number; touched: boolean } {
  if (!lastDate || !prevStreak) {
    return { streak: 1, touched: true };
  }
  if (lastDate === today) {
    return { streak: prevStreak, touched: false };
  }
  // Check if lastDate is exactly yesterday
  const [ly, lm, ld] = lastDate.split('-').map(Number);
  const last = new Date(ly, lm - 1, ld);
  const [ty, tm, td] = today.split('-').map(Number);
  const cur = new Date(ty, tm - 1, td);
  const diffDays = Math.round((cur.getTime() - last.getTime()) / 86400000);
  if (diffDays === 1) return { streak: prevStreak + 1, touched: true };
  return { streak: 1, touched: true };
}

/** Build stats object from a profile for achievement evaluation. */
export function profileStats(
  profile: UserProfile,
  rewardsRedeemed: number
): AchievementStats {
  return {
    totalCompleted: profile.totalCompleted ?? 0,
    streak: profile.streak ?? 0,
    longestStreak: profile.longestStreak ?? 0,
    rewardsRedeemed,
    totalPoints: profile.totalPoints ?? 0,
  };
}
