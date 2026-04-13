import { Settings, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OnboardingBannerProps {
  show: boolean;
  onDismiss: () => void;
  onOpenSettings: () => void;
}

export function OnboardingBanner({ show, onDismiss, onOpenSettings }: OnboardingBannerProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          className="overflow-hidden"
        >
          <div className="mt-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl p-5 text-white shadow-xl shadow-blue-100 relative">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shrink-0">
                <Sparkles size={20} />
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <h3 className="font-black text-sm">환영해요! 👋</h3>
                <p className="text-xs font-medium text-blue-100 mt-1 leading-relaxed">
                  시작을 돕기 위해 <b>"우리 아이"</b> 프로필을 만들어뒀어요.
                  <br />
                  오른쪽 상단 <b>⚙ 설정</b>에서 아이 이름과 사진을 바꿀 수 있어요.
                </p>
                <button
                  onClick={onOpenSettings}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 bg-white text-blue-600 rounded-xl text-[11px] font-black hover:bg-blue-50 transition-colors active:scale-95"
                >
                  <Settings size={12} />
                  지금 설정하기
                </button>
              </div>
              <button
                onClick={onDismiss}
                className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="배너 닫기"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
