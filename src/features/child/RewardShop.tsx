import { Star, Lock, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import type { Reward, UserProfile } from '../../types';
import { cn } from '../../lib/utils';

interface RewardShopProps {
  rewards: Reward[];
  profile: UserProfile;
  onPurchase: (reward: Reward) => void;
}

export function RewardShop({ rewards, profile, onPurchase }: RewardShopProps) {
  return (
    <div className="space-y-6 lg:h-full lg:flex lg:flex-col lg:min-h-0 lg:space-y-4">
      <div className="flex justify-between items-center lg:shrink-0">
        <div>
          <h2 className="font-black text-2xl text-slate-800">미션 보상</h2>
          <p className="text-xs font-bold text-slate-400 mt-0.5">
            미션 달성으로 모은 포인트로 보상을 받아요!
          </p>
        </div>
        <div className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-black flex items-center gap-1">
          <Star size={14} fill="currentColor" />
          {profile.totalPoints.toLocaleString()} P
        </div>
      </div>

      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto scrollbar-hide lg:pr-1 space-y-6 lg:space-y-4">
      {rewards.length === 0 && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center space-y-3">
          <div className="text-5xl">🎁</div>
          <p className="text-slate-600 font-bold text-sm">아직 보상이 등록되지 않았어요</p>
          <p className="text-slate-400 text-[11px] font-medium leading-relaxed">
            부모님이 <span className="font-black">부모 모드 → 미션 보상 관리</span>에서<br />
            아이가 받을 수 있는 보상을 만들어주세요!
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {rewards.map((reward) => {
          const unlocked = profile.totalPoints >= reward.points;
          return (
            <motion.div
              key={reward.id}
              whileHover={{ y: -2 }}
              className={cn(
                "bg-white border-2 rounded-3xl p-5 shadow-sm flex gap-4 items-center",
                unlocked ? "border-yellow-200" : "border-slate-100"
              )}
            >
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-inner relative",
                unlocked ? "bg-yellow-50" : "bg-slate-50"
              )}>
                {reward.icon}
                {!unlocked && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-slate-300 rounded-full flex items-center justify-center text-white">
                    <Lock size={12} />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800">{reward.title}</h3>
                <p className="text-xs text-slate-500 leading-tight mt-1">{reward.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm font-black text-orange-500">{reward.points.toLocaleString()} P</span>
                  {!unlocked && (
                    <span className="text-[10px] font-bold text-slate-400">
                      · {(reward.points - profile.totalPoints).toLocaleString()}P 더 필요
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onPurchase(reward)}
                disabled={!unlocked}
                className={cn(
                  "px-4 py-2 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center gap-1.5",
                  unlocked
                    ? "bg-yellow-400 text-slate-900 shadow-lg shadow-yellow-100"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                {unlocked ? (
                  <>
                    <Sparkles size={12} />
                    받기
                  </>
                ) : (
                  <>
                    <Lock size={12} />
                    잠김
                  </>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
