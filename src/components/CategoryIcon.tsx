import { BookOpen, Heart, Star, Gamepad2 } from 'lucide-react';
import type { QuestCategory } from '../types';

interface CategoryIconProps {
  category: QuestCategory;
  size?: number;
}

export function CategoryIcon({ category, size = 24 }: CategoryIconProps) {
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
