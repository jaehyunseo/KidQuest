import { cn } from '../../../lib/utils';
import { AVATAR_OPTIONS } from '../constants';

interface AvatarPickerProps {
  value: string;
  onChange: (avatar: string) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {AVATAR_OPTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={cn(
            'aspect-square rounded-2xl flex items-center justify-center text-3xl transition-all active:scale-90',
            value === emoji
              ? 'bg-yellow-400 shadow-lg shadow-yellow-100 scale-105'
              : 'bg-slate-100 hover:bg-slate-200'
          )}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
