import { Crown, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

// Kid-screen upsell strip. This REPLACES the ad slot on child-facing
// views — Google Families Policy forbids ads on kid content, and a
// Pro nudge both respects the policy and monetizes better than any
// family-safe banner would.
//
// Hidden entirely for Pro users.

interface ProUpsellBannerProps {
  isPro: boolean;
  onUpsell: () => void;
}

export function ProUpsellBanner({ isPro, onUpsell }: ProUpsellBannerProps) {
  if (isPro) return null;

  return (
    <motion.button
      type="button"
      onClick={onUpsell}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 p-0.5 text-left shadow-sm active:scale-[0.99]"
    >
      <div className="flex items-center gap-3 rounded-[14px] bg-white/95 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white shadow-sm">
          <Crown size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wider text-fuchsia-500">
            KidQuest Pro
          </p>
          <p className="truncate text-sm font-black text-slate-800">
            프리미엄 아바타와 테마 열어보기
          </p>
        </div>
        <Sparkles
          size={16}
          className="shrink-0 text-fuchsia-400 transition-transform group-hover:rotate-12"
        />
      </div>
    </motion.button>
  );
}
