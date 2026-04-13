import { BookOpen, Heart, Star, Gamepad2 } from 'lucide-react';
import type { CustomCategory, QuestCategory } from '../types';
import { isBuiltInCategory } from '../lib/categoryDisplay';

interface CategoryIconProps {
  category: QuestCategory | string;
  size?: number;
  customCategories?: CustomCategory[];
}

export function CategoryIcon({ category, size = 24, customCategories }: CategoryIconProps) {
  // Built-in icons via lucide
  if (isBuiltInCategory(category)) {
    switch (category) {
      case 'homework':
        return <BookOpen size={size} />;
      case 'chore':
        return <Heart size={size} />;
      case 'habit':
        return <Star size={size} />;
      default:
        return <Gamepad2 size={size} />;
    }
  }
  // Custom category — render its emoji
  const found = customCategories?.find((c) => c.id === category);
  if (found?.icon) {
    return (
      <span style={{ fontSize: Math.floor(size * 0.85), lineHeight: 1 }} className="select-none">
        {found.icon}
      </span>
    );
  }
  return <Gamepad2 size={size} />;
}
