import { Camera, Gift, Sparkles, Smartphone, Flame, Award } from 'lucide-react';
import type { Reward, UserProfile } from '../../types';
import { ACHIEVEMENTS } from '../../lib/achievements';
import { cn } from '../../lib/utils';

interface ProfileViewProps {
  profile: UserProfile;
  rewards: Reward[];
}

export function ProfileView({ profile, rewards }: ProfileViewProps) {
  const inventoryItems = profile.inventory
    .map(id => rewards.find(r => r.id === id))
    .filter(Boolean) as Reward[];
  const unlockedIds = new Set(profile.achievements ?? []);

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="relative inline-block">
          <div className="w-32 h-32 bg-yellow-400 rounded-[40px] flex items-center justify-center text-6xl shadow-xl mx-auto">
            {profile.avatar}
          </div>
          <button className="absolute -bottom-2 -right-2 w-10 h-10 bg-white border-2 border-slate-100 rounded-full flex items-center justify-center text-slate-400 shadow-md hover:text-yellow-500 transition-colors">
            <Camera size={20} />
          </button>
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-800">{profile.name}</h2>
          <p className="text-slate-400 font-bold">레벨 {profile.level} 모험가</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-100 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase">현재 포인트</p>
          <p className="text-xl font-black text-slate-800 mt-1">{profile.totalPoints.toLocaleString()}P</p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-100 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase">보유 보상</p>
          <p className="text-xl font-black text-slate-800 mt-1">{profile.inventory.length}개</p>
        </div>
        <div className="bg-gradient-to-br from-orange-400 to-red-500 p-4 rounded-3xl text-white text-center">
          <p className="text-[10px] font-bold text-orange-100 uppercase flex items-center justify-center gap-1">
            <Flame size={11} /> 연속 달성
          </p>
          <p className="text-xl font-black mt-1">{profile.streak ?? 0}일</p>
          <p className="text-[9px] font-bold text-orange-100 mt-0.5">
            최고 {profile.longestStreak ?? 0}일
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-400 to-blue-500 p-4 rounded-3xl text-white text-center">
          <p className="text-[10px] font-bold text-purple-100 uppercase flex items-center justify-center gap-1">
            <Award size={11} /> 배지
          </p>
          <p className="text-xl font-black mt-1">
            {unlockedIds.size} / {ACHIEVEMENTS.length}
          </p>
          <p className="text-[9px] font-bold text-purple-100 mt-0.5">
            완료 {profile.totalCompleted ?? 0}개
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
          <Award size={20} className="text-purple-500" />
          나의 배지
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedIds.has(a.id);
            return (
              <div
                key={a.id}
                className={cn(
                  'relative rounded-2xl p-3 text-center border transition-all',
                  unlocked
                    ? `bg-gradient-to-br ${a.color} text-white border-transparent shadow-md`
                    : 'bg-slate-50 border-slate-100 text-slate-300'
                )}
                title={a.description}
              >
                <div
                  className={cn(
                    'text-3xl mb-1',
                    !unlocked && 'grayscale opacity-40'
                  )}
                >
                  {a.icon}
                </div>
                <p className={cn('text-[10px] font-black leading-tight', !unlocked && 'text-slate-400')}>
                  {a.title}
                </p>
                {!unlocked && (
                  <p className="text-[8px] font-bold text-slate-300 mt-0.5 leading-tight">
                    잠김
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
          <Gift size={20} className="text-pink-500" />
          나의 보물함
        </h3>
        {inventoryItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {inventoryItems.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-xs font-bold text-slate-700 truncate">{item.title}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center">
            <p className="text-slate-400 text-sm font-medium">아직 획득한 보상이 없어요.<br/>상점에서 포인트를 사용해보세요!</p>
          </div>
        )}
      </div>

      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <h3 className="font-black text-lg flex items-center gap-2">
            <Sparkles size={20} className="text-yellow-400" />
            앱으로 설치하기
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            아이퀘스트를 스마트폰 홈 화면에 추가하면 진짜 앱처럼 편리하게 사용할 수 있어요!
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-yellow-400 text-slate-900 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
              <p className="text-xs font-medium">
                <span className="text-yellow-400 font-bold">안드로이드:</span> 크롬 메뉴(⋮)에서 <span className="text-white font-bold">'앱 설치'</span> 또는 <span className="text-white font-bold">'홈 화면에 추가'</span>를 누르세요.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-pink-400 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
              <p className="text-xs font-medium">
                <span className="text-pink-400 font-bold">아이폰:</span> 사파리 공유 버튼(⎋)을 누른 후 <span className="text-white font-bold">'홈 화면에 추가'</span>를 누르세요.
              </p>
            </div>
          </div>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 rotate-12">
          <Smartphone size={96} />
        </div>
      </div>
    </div>
  );
}
