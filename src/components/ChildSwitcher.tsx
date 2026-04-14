import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ChildProfile } from '../types';
import { Avatar } from './Avatar';
import { cn } from '../lib/utils';

interface ChildSwitcherProps {
  childrenList: ChildProfile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ChildSwitcher({ childrenList, selectedId, onSelect }: ChildSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = childrenList.find((c) => c.id === selectedId);
  const hasMultiple = childrenList.length > 1;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  if (!current) {
    return (
      <span className="font-black text-base md:text-xl leading-tight text-slate-400">
        아이 선택
      </span>
    );
  }

  // Single child — no interactive picker needed
  if (!hasMultiple) {
    return (
      <span className="font-black text-base md:text-xl leading-tight truncate">
        {current.name}
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'group flex items-center gap-1.5 px-2 py-1 -mx-2 -my-1 rounded-xl transition-all',
          'hover:bg-slate-100 active:scale-95',
          open && 'bg-slate-100'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="font-black text-base md:text-xl leading-tight truncate">
          {current.name}
        </span>
        <div
          className={cn(
            'flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white transition-transform',
            open && 'rotate-180'
          )}
        >
          <ChevronDown size={12} strokeWidth={3} />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="absolute top-full left-0 mt-3 z-50 min-w-[300px] sm:min-w-[340px]"
          >
            <div className="bg-white rounded-3xl shadow-2xl shadow-slate-300/40 border border-slate-100 overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-white">
                <div className="flex items-center gap-2">
                  <Users size={14} strokeWidth={3} />
                  <p className="text-[11px] font-black uppercase tracking-widest">아이 바꾸기</p>
                </div>
                <p className="text-[10px] font-bold text-white/80 mt-0.5">
                  누구의 미션을 볼까요?
                </p>
              </div>

              <div className="p-2 max-h-[60vh] overflow-y-auto space-y-1">
                {childrenList.map((c) => {
                  const isActive = c.id === selectedId;
                  return (
                    <motion.button
                      key={c.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        onSelect(c.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left',
                        isActive
                          ? 'bg-yellow-50 border-2 border-yellow-400 shadow-sm'
                          : 'border-2 border-transparent hover:bg-slate-50'
                      )}
                    >
                      <div
                        className={cn(
                          'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden transition-all',
                          isActive
                            ? 'bg-white shadow-inner ring-2 ring-yellow-300'
                            : 'bg-slate-50'
                        )}
                      >
                        <Avatar
                          emoji={c.avatar}
                          url={c.avatarUrl}
                          size={56}
                          className="rounded-2xl"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'font-black text-base truncate',
                            isActive ? 'text-yellow-700' : 'text-slate-700'
                          )}
                        >
                          {c.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={cn(
                              'text-[10px] font-black px-1.5 py-0.5 rounded-full',
                              isActive
                                ? 'bg-yellow-200 text-yellow-800'
                                : 'bg-slate-100 text-slate-500'
                            )}
                          >
                            Lv.{c.level || 1}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {(c.totalPoints || 0).toLocaleString()}P
                          </span>
                        </div>
                      </div>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center shrink-0 shadow-md"
                        >
                          <Check size={16} strokeWidth={4} className="text-white" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
