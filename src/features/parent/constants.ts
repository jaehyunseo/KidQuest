import type { QuestCategory } from '../../types';

export interface QuestPreset {
  title: string;
  points: number;
  category: QuestCategory;
}

export const QUEST_PRESETS: QuestPreset[] = [
  { title: '숙제 하기', points: 20, category: 'homework' },
  { title: '받아쓰기', points: 15, category: 'homework' },
  { title: '독서 30분', points: 30, category: 'homework' },
  { title: '방 정리', points: 50, category: 'chore' },
  { title: '설거지 돕기', points: 30, category: 'chore' },
  { title: '장난감 정리', points: 20, category: 'chore' },
  { title: '양치질', points: 10, category: 'habit' },
  { title: '일찍 자기', points: 20, category: 'habit' },
  { title: '물 8잔 마시기', points: 15, category: 'habit' },
  { title: '스트레칭', points: 10, category: 'habit' },
  { title: '운동 30분', points: 30, category: 'other' },
  { title: '가족과 대화', points: 20, category: 'other' },
];

export const AVATAR_OPTIONS = ['🦁', '🐰', '🐻', '🦊', '🐼', '🐯', '🐸', '🦄'];

/**
 * Default reward templates used by:
 *   1. createFamily auto-seed (new families)
 *   2. App.tsx migration effect (pre-existing families with empty rewards)
 *   3. RewardManager "기본 템플릿 추가" button (manual fallback)
 *
 * Keep this list short and broad — parents can edit/delete and add their
 * own. Goal is to avoid an empty shop on first parent visit.
 */
export interface RewardTemplate {
  title: string;
  description: string;
  points: number;
  icon: string;
}

export const REWARD_TEMPLATES: RewardTemplate[] = [
  { title: '유튜브 30분 시청권', description: '오늘 하루 유튜브를 30분 더 볼 수 있어요!', points: 300, icon: '📺' },
  { title: '맛있는 아이스크림', description: '편의점에서 좋아하는 아이스크림 하나!', points: 500, icon: '🍦' },
  { title: '주말 게임 1시간 추가', description: '이번 주말에 게임을 1시간 더 할 수 있어요.', points: 1000, icon: '🎮' },
  { title: '원하는 장난감 선물', description: '부모님과 상의해서 원하는 장난감을 골라요!', points: 5000, icon: '🧸' },
  { title: '가족 외식', description: '가고 싶은 식당에서 함께 저녁을 먹어요!', points: 2000, icon: '🍕' },
  { title: '책 한 권 선물', description: '읽고 싶은 책을 골라 선물 받아요.', points: 1500, icon: '📚' },
];
