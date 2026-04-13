import { CATEGORY_COLORS, CATEGORY_LABELS, type CustomCategory, type QuestCategory } from '../types';

export interface ResolvedCategory {
  id: string;
  label: string;
  color: string; // tailwind bg-* class
  isCustom: boolean;
  /**
   * Emoji to render in the icon slot. For built-ins, undefined means
   * the consumer should render the lucide CategoryIcon component
   * instead. For custom categories, this is always set.
   */
  emoji?: string;
}

const BUILT_IN_IDS: QuestCategory[] = ['homework', 'chore', 'habit', 'other'];

export function isBuiltInCategory(id: string): id is QuestCategory {
  return (BUILT_IN_IDS as string[]).includes(id);
}

export function resolveCategory(
  id: string,
  customCategories: CustomCategory[]
): ResolvedCategory {
  if (isBuiltInCategory(id)) {
    return {
      id,
      label: CATEGORY_LABELS[id],
      color: CATEGORY_COLORS[id],
      isCustom: false,
    };
  }
  const found = customCategories.find((c) => c.id === id);
  if (found) {
    return {
      id: found.id,
      label: found.label,
      color: found.color,
      isCustom: true,
      emoji: found.icon,
    };
  }
  // Unknown / deleted category fallback
  return {
    id,
    label: '기타',
    color: 'bg-slate-400',
    isCustom: false,
  };
}

export const CUSTOM_CATEGORY_COLORS = [
  { value: 'bg-pink-500', label: '핑크' },
  { value: 'bg-rose-500', label: '로즈' },
  { value: 'bg-red-500', label: '레드' },
  { value: 'bg-orange-500', label: '오렌지' },
  { value: 'bg-amber-500', label: '앰버' },
  { value: 'bg-yellow-500', label: '옐로우' },
  { value: 'bg-lime-500', label: '라임' },
  { value: 'bg-green-500', label: '그린' },
  { value: 'bg-emerald-500', label: '에메랄드' },
  { value: 'bg-teal-500', label: '틸' },
  { value: 'bg-cyan-500', label: '시안' },
  { value: 'bg-sky-500', label: '스카이' },
  { value: 'bg-blue-500', label: '블루' },
  { value: 'bg-indigo-500', label: '인디고' },
  { value: 'bg-violet-500', label: '바이올렛' },
  { value: 'bg-purple-500', label: '퍼플' },
];

export const CUSTOM_CATEGORY_EMOJIS = [
  '🎯', '🎨', '⚽', '📚', '🎵', '🌱',
  '🧩', '🏃', '💧', '🍎', '🛏️', '🦷',
  '🧹', '🐾', '✏️', '🎮',
];
