import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X } from 'lucide-react';
import { findAchievement } from '../lib/achievements';
import { cn } from '../lib/utils';
import { badgeUnlock } from '../lib/sound';

interface BadgeUnlockModalProps {
  /** Queue of newly-unlocked achievement IDs. Modal shows the first and
   *  advances when the user taps "다음". When empty, the modal hides. */
  queue: string[];
  onDismiss: (id: string) => void;
}

export function BadgeUnlockModal({ queue, onDismiss }: BadgeUnlockModalProps) {
  const currentId = queue[0];
  const achievement = currentId ? findAchievement(currentId) : undefined;

  // Play badge unlock sound when a new badge appears
  useEffect(() => {
    if (currentId) badgeUnlock();
  }, [currentId]);

  // Allow Escape to dismiss
  useEffect(() => {
    if (!currentId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss(currentId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentId, onDismiss]);

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          key="badge-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => onDismiss(currentId!)}
        >
          <motion.div
            key={currentId}
            initial={{ scale: 0.7, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
          >
            {/* Decorative glow */}
            <div
              className={cn(
                'absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30 bg-gradient-to-br',
                achievement.color
              )}
            />
            <button
              onClick={() => onDismiss(currentId!)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 z-10"
              aria-label="닫기"
            >
              <X size={16} />
            </button>

            <div className="relative z-10 text-center space-y-4">
              <div className="flex items-center justify-center gap-1 text-yellow-500">
                <Sparkles size={14} />
                <p className="text-[11px] font-black uppercase tracking-widest">
                  새 배지 획득!
                </p>
                <Sparkles size={14} />
              </div>

              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 14, delay: 0.1 }}
                className={cn(
                  'relative w-32 h-32 mx-auto rounded-[2rem] flex items-center justify-center shadow-xl bg-gradient-to-br',
                  achievement.color
                )}
              >
                <span className="text-7xl drop-shadow-md">{achievement.icon}</span>
                {/* Sparkle bursts */}
                <div className="absolute inset-0 pointer-events-none">
                  {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                    <motion.div
                      key={i}
                      className="absolute top-1/2 left-1/2 w-1.5 h-6 bg-yellow-300 rounded-full"
                      style={{
                        transformOrigin: '50% 0%',
                        transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-70px)`,
                      }}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
                      transition={{ duration: 1.2, delay: 0.3 + i * 0.05, repeat: Infinity, repeatDelay: 1.5 }}
                    />
                  ))}
                </div>
              </motion.div>

              <div className="space-y-1.5">
                <h2 className="font-black text-2xl text-slate-800">{achievement.title}</h2>
                <p className="text-sm font-bold text-slate-500 leading-relaxed px-2">
                  {achievement.description}
                </p>
              </div>

              {queue.length > 1 && (
                <p className="text-[10px] font-bold text-slate-400">
                  +{queue.length - 1}개 배지가 더 기다리고 있어요
                </p>
              )}

              <button
                onClick={() => onDismiss(currentId!)}
                className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl text-sm active:scale-[0.98] transition-all mt-2"
              >
                {queue.length > 1 ? '다음 배지 보기' : '계속하기'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
