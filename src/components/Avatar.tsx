import { cn } from '../lib/utils';

interface AvatarProps {
  emoji: string;
  url?: string | null;
  size?: number;
  className?: string;
}

/**
 * Unified avatar renderer. Shows uploaded photo if url is present,
 * otherwise falls back to the emoji.
 */
export function Avatar({ emoji, url, size = 48, className }: AvatarProps) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={{ width: size, height: size }}
        className={cn('object-cover rounded-inherit', className)}
      />
    );
  }
  return (
    <span
      style={{ fontSize: Math.floor(size * 0.75), lineHeight: 1 }}
      className={cn('leading-none select-none', className)}
    >
      {emoji}
    </span>
  );
}
