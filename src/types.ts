/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type QuestCategory = 'homework' | 'chore' | 'habit' | 'other';

export interface Quest {
  id: string;
  title: string;
  points: number;
  category: QuestCategory;
  completed: boolean;
  completedAt?: string;
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
}

export interface ChildProfile {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  totalPoints: number;
  level: number;
  inventory: string[];
}

export interface UserProfile {
  uid?: string;
  email?: string;
  role?: 'parent' | 'child';
  name: string;
  totalPoints: number;
  level: number;
  avatar: string;
  avatarUrl?: string;
  inventory: string[]; // IDs of purchased rewards
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  points: number;
  icon: string;
}

export interface HistoryRecord {
  id: string;
  type?: 'quest' | 'reward';
  questId?: string;
  rewardId?: string;
  title: string;
  points: number;
  category?: QuestCategory;
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
  homework: '배움',
  chore: '도움',
  habit: '나 돌보기',
  other: '특별한 약속',
};
