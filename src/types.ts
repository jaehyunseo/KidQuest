/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type QuestCategory = 'homework' | 'chore' | 'habit' | 'other';

export interface Quest {
  id: string;
  title: string;
  points: number;
  category: QuestCategory | string;
  completed: boolean;
  completedAt?: string;
  // Optional — reserved for future date-scoped scheduling.
  scheduledDate?: string;   // 'YYYY-MM-DD'
  // Group binding for bonus payouts.
  groupId?: string;
  groupBonusClaimed?: boolean; // reset on daily auto-reset; blocks double-award
}

// A bundle of quests that pays a bonus once all members are completed
// on the same day.
export interface QuestGroup {
  id: string;
  title: string;
  icon: string;            // emoji
  bonusPoints: number;
  templateIds?: string[];  // legacy — kept for backward-compat, unused
  createdAt: string;
}

export interface UserAccount {
  uid: string;
  email: string;
  name: string;
  role: 'parent' | 'child';
  familyId?: string;
  consentedAt?: string;
  consentVersion?: number;
  consentPrivacy?: boolean;
  consentTerms?: boolean;
  consentAge?: boolean;
  consentMarketing?: boolean;
}

export interface Family {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  members: Record<string, 'parent' | 'child'>; // uid -> role
  // Parent password hash — PRIMARY location is /families/{id}/private/config
  // (parent-only via deployed rules). These root-level fields are a
  // fallback-writable backup so password change works even before the
  // new firestore.rules are deployed. If rules ARE deployed, private/config
  // wins; if NOT, these legacy fields are used.
  parentPasswordHash?: string;
  parentPasswordSalt?: string;
  rewardsSeeded?: boolean; // migration flag — true after default rewards seeded
}

export interface CustomCategory {
  id: string;
  label: string;
  color: string; // tailwind bg-* class, e.g. "bg-pink-500"
  icon: string;  // emoji
  createdAt: string;
}

export interface ChildProfile {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  totalPoints: number;         // current balance (can go down on reward purchase)
  lifetimeEarned?: number;     // monotonic — sum of all points ever earned; drives level
  level: number;
  inventory: string[];
  // Streak / achievements (added in RBAC+Streak round)
  streak?: number;          // current consecutive-day streak
  longestStreak?: number;   // best all-time streak
  lastCompletedDate?: string; // YYYY-MM-DD of last quest completion
  totalCompleted?: number;  // lifetime completed-quest count
  achievements?: string[];  // unlocked badge IDs
}

export interface UserProfile {
  uid?: string;
  email?: string;
  role?: 'parent' | 'child';
  name: string;
  totalPoints: number;
  lifetimeEarned?: number;
  level: number;
  avatar: string;
  avatarUrl?: string;
  inventory: string[]; // IDs of purchased rewards
  streak?: number;
  longestStreak?: number;
  lastCompletedDate?: string;
  totalCompleted?: number;
  achievements?: string[];
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  points: number;
  icon: string;
}

// ============================================================
// Family Feed (mini Instagram — internal family SNS)
// ============================================================

export type FeedReactionEmoji = '❤️' | '👍' | '🎉' | '😍' | '🔥' | '🌟';

export const FEED_REACTIONS: FeedReactionEmoji[] = ['❤️', '👍', '🎉', '😍', '🔥', '🌟'];

export interface FeedPost {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar: string;        // emoji
  authorAvatarUrl?: string;    // photo URL if set
  authorRole: 'parent' | 'child';
  text: string;
  imageUrl?: string;
  createdAt: string;           // ISO
  // reactions: uid -> emoji
  reactions?: Record<string, FeedReactionEmoji>;
  commentCount?: number;
}

export interface FeedComment {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar: string;
  authorAvatarUrl?: string;
  authorRole: 'parent' | 'child';
  text: string;
  createdAt: string;
}

export interface HistoryRecord {
  id: string;
  type?: 'quest' | 'reward' | 'penalty' | 'group-bonus';
  questId?: string;
  rewardId?: string;
  groupId?: string;                // set when type === 'group-bonus'
  reason?: string;                 // set when type === 'penalty'
  title: string;
  points: number;                  // negative for penalty / reward purchases
  category?: QuestCategory | string;
  timestamp: string;
}

export interface AppState {
  profile: UserProfile;
  quests: Quest[];
  rewards: Reward[];
  history: HistoryRecord[];
  lastResetDate: string;
}

export const CATEGORY_COLORS: Record<QuestCategory, string> = {
  homework: 'bg-blue-500',
  chore: 'bg-purple-500',
  habit: 'bg-green-500',
  other: 'bg-orange-500',
};

export const CATEGORY_LABELS: Record<QuestCategory, string> = {
  homework: '숙제',
  chore: '부모님 도와드리기',
  habit: '나 돌보기',
  other: '특별한 미션',
};
