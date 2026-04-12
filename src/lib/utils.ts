import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getLevel(points: number): number {
  return Math.floor(points / 500) + 1;
}

export function getProgressToNextLevel(points: number): number {
  const currentLevelPoints = (getLevel(points) - 1) * 500;
  const nextLevelPoints = getLevel(points) * 500;
  const progress = ((points - currentLevelPoints) / (nextLevelPoints - currentLevelPoints)) * 100;
  return Math.min(100, Math.max(0, progress));
}
