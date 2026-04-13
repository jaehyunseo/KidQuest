import { motion, AnimatePresence } from 'motion/react';
import { Trash2, RotateCcw } from 'lucide-react';

interface UndoToastProps {
  message: string | null;
  onUndo: () => void;
}

export function UndoToast({ message, onUndo }: UndoToastProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[60]"
        >
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4">
            <Trash2 size={16} className="text-red-400 shrink-0" />
            <span className="text-sm font-bold whitespace-nowrap">{message}</span>
            <button
              onClick={onUndo}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-900 rounded-lg font-black text-xs hover:bg-slate-100 transition-colors active:scale-95"
            >
              <RotateCcw size={14} />
              되돌리기
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
