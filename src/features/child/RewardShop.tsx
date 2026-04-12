import { Star } from 'lucide-react';
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-black text-2xl text-slate-800">보상 상점</h2>
        <div className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-black flex items-center gap-1">
          <Star size={14} fill="currentColor" />
          {profile.totalPoints.toLocaleString()} P
        </div>
      </div>

      <div className="grid gap-4">
        {rewards.map((reward) => (
          <motion.div
            key={reward.id}
            whileHover={{ y: -2 }}
            className="bg-white border-2 border-slate-100 rounded-3xl p-5 shadow-sm flex gap-4 items-center"
          >
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-4xl shadow-inner">
              {reward.icon}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-800">{reward.title}</h3>
              <p className="text-xs text-slate-500 leading-tight mt-1">{reward.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-black text-orange-500">{reward.points.toLocaleString()} P</span>
              </div>
            </div>
            <button
              onClick={() => onPurchase(reward)}
              disabled={profile.totalPoints < reward.points}
              className={cn(
                "px-4 py-2 rounded-xl font-black text-sm transition-all active:scale-95",
                profile.totalPoints >= reward.points
                  ? "bg-yellow-400 text-slate-900 shadow-lg shadow-yellow-100"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}
            >
              구매
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
