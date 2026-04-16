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

// Pro tier — drives feature gating, content unlocks, and upsell.
// `free`      = default
// `trial`     = time-bounded free trial (first install)
// `pro_monthly`/`pro_yearly`/`pro_lifetime` = paid tiers
// `promo`     = manually granted via promo code
export type ProTier =
  | 'free'
  | 'trial'
  | 'pro_monthly'
  | 'pro_yearly'
  | 'pro_lifetime'
  | 'promo';

export interface UserAccount {
  uid: string;
  email: string;
  name: string;
  role: 'parent' | 'child' | 'admin';
  familyId?: string;
  consentedAt?: string;
  consentVersion?: number;
  consentPrivacy?: boolean;
  consentTerms?: boolean;
  consentAge?: boolean;
  consentMarketing?: boolean;
  // --------------------------------------------------------------
  // Pro / billing
  // --------------------------------------------------------------
  // Current tier. Absent/undefined is treated as 'free'.
  proTier?: ProTier;
  // Expiry for time-bounded tiers (monthly/yearly/trial). Absent
  // for lifetime/free/promo (with optional `proPromoExpiresAt`
  // for manually issued promos). Stored as ISO string.
  proExpiresAt?: string;
  // For audit: when the tier was first granted and by whom.
  proGrantedAt?: string;
  proGrantedVia?: 'google_play' | 'app_store' | 'promo_code' | 'admin';
  // Legal guardian acknowledgement — PIPA 제22조의2 requires consent
  // for under-14 children's data. PIPA 제3조 (data minimization)
  // tells us to record only what's necessary. We store the explicit
  // acknowledgement, the consent version it applied to, and the
  // timestamp — nothing more.
  guardianConsent?: {
    version: number;
    consentedAt: string;    // ISO
    acknowledged: boolean;
  };
}

export interface Family {
  id: string;
  name: string;
  // Doc ID equals parentInviteCode. `inviteCode` is kept as an alias of
  // parentInviteCode so legacy reads keep working.
  inviteCode: string;
  parentInviteCode: string;
  childInviteCode: string;
  // The family creator. Immutable. Only the owner may remove members.
  ownerUid: string;
  createdAt: string;
  members: Record<string, 'parent' | 'child'>; // uid -> role
  // Display names for members (denormalized so the settings drawer can
  // render the member list without reading other users' /users/{uid} docs,
  // which is forbidden by rules).
  memberNames?: Record<string, string>;
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

// ============================================================
// Admin
// ============================================================

export type AnnouncementSeverity = 'info' | 'warn';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  createdAt: string;       // ISO
  createdBy: string;       // admin uid
  expiresAt?: string;      // ISO, optional
}

export interface AdminAuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetPath: string;
  meta?: Record<string, unknown>;
  createdAt: string;       // ISO
}

export interface AdminStats {
  totalFamilies: number;
  totalUsers: number;
  // Semantic user buckets (much more useful than raw role counts)
  masters: number;          // users who are ownerUid of some family
  coParents: number;        // parent role + in a family but not owner
  authChildren: number;     // users.role === 'child'
  admins: number;           // users.role === 'admin'
  orphans: number;          // parent role without familyId
  // Real children (ChildProfile docs, not Auth accounts)
  totalChildProfiles: number;
  // Quests
  totalQuests: number;
  completedQuests: number;
  completionRate: number;   // 0..1
  // Content
  totalFeedPosts: number;
  totalRewards: number;
  // Consent
  consentComplete: number;
  consentMissing: number;
  // Top families by completion
  topFamilies: Array<{
    familyId: string;
    familyName: string;
    childCount: number;
    totalQuests: number;
    completedQuests: number;
  }>;
}

