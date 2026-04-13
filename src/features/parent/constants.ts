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
