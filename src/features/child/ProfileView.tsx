import { useState } from 'react';
import { Camera, Gift, Sparkles, Smartphone, Flame, Award, Lock, Check, Download } from 'lucide-react';
import type { Reward, UserProfile } from '../../types';
import { ACHIEVEMENTS } from '../../lib/achievements';
import { AVATAR_CATALOG, type PremiumItem } from '../../lib/premiumCatalog';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { cn } from '../../lib/utils';

interface ProfileViewProps {
  profile: UserProfile;
  rewards: Reward[];
  isPro: boolean;
  onSelectAvatar?: (avatarId: string) => void;
  onUpsell?: () => void;
}

export function ProfileView({
  profile,
  rewards,
  isPro,
  onSelectAvatar,
  onUpsell,
}: ProfileViewProps) {
  const install = useInstallPrompt();
  const inventoryItems = profile.inventory
    .map(id => rewards.find(r => r.id === id))
    .filter(Boolean) as Reward[];
  const unlockedIds = new Set(profile.achievements ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handlePick = (item: PremiumItem) => {
    if (item.premium && !isPro) {
      onUpsell?.();
      setPickerOpen(false);
      return;
    }
    onSelectAvatar?.(item.id);
    setPickerOpen(false);
  };

  return (
    <div className="space-y-8 lg:h-full lg:overflow-y-auto scrollbar-hide lg:pr-1">
      <div className="text-center space-y-4">
        <div className="relative inline-block">
          <div className="w-32 h-32 bg-yellow-400 rounded-[40px] flex items-center justify-center text-6xl shadow-xl mx-auto">
            {profile.avatar}
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-label="아바타 변경"
            data-testid="avatar-picker-toggle"
            className="absolute -bottom-2 -right-2 w-10 h-10 bg-white border-2 border-slate-100 rounded-full flex items-center justify-center text-slate-400 shadow-md hover:text-yellow-500 transition-colors"
          >
            <Camera size={20} />
          </button>
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-800">{profile.name}</h2>
          <p className="text-slate-400 font-bold">레벨 {profile.level} 모험가</p>
        </div>

        {pickerOpen && (
          <div
            className="rounded-3xl border-2 border-slate-100 bg-white p-4 shadow-lg text-left"
            data-testid="avatar-picker-panel"
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-700">아바타 선택</h4>
              {!isPro && (
                <span
                  className="flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-black text-yellow-700"
                  data-testid="pro-gate-hint"
                >
                  <Lock size={10} />
                  프리미엄 잠금
                </span>
              )}
            </div>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_CATALOG.map((item) => {
                const locked = item.premium && !isPro;
                const selected = item.display === profile.avatar;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handlePick(item)}
                    aria-label={item.label + (locked ? ' (Pro 전용)' : '')}
                    data-testid={locked ? 'avatar-locked' : 'avatar-free'}
                    data-avatar-id={item.id}
                    className={cn(
                      'relative aspect-square rounded-2xl flex items-center justify-center text-2xl border-2 transition-all',
                      selected && 'border-yellow-400 bg-yellow-50',
                      !selected && !locked && 'border-slate-100 bg-slate-50 hover:border-yellow-300',
                      locked && 'border-slate-100 bg-slate-50 opacity-60',
                    )}
                  >
                    <span className={cn(locked && 'grayscale')}>{item.display}</span>
                    {locked && (
                      <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-white">
                        <Lock size={9} />
                      </span>
                    )}
                    {selected && !locked && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white">
                        <Check size={10} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {!isPro && (
              <button
                type="button"
                onClick={() => onUpsell?.()}
                data-testid="avatar-upsell-cta"
                className="mt-3 w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-400 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:from-yellow-500 hover:to-orange-500"
              >
                ✨ Pro로 모든 캐릭터 해제
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-100 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase">현재 포인트</p>
          <p className="text-xl font-black text-slate-800 mt-1">{profile.totalPoints.toLocaleString()}P</p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-100 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase">받은 보상</p>
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
          받은 보상
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
            <p className="text-slate-400 text-sm font-medium">아직 받은 보상이 없어요.<br/>미션을 지켜 포인트를 모아보세요!</p>
          </div>
        )}
      </div>

      {!install.installed && (
        <div
          className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden"
          data-testid="install-card"
        >
          <div className="relative z-10 space-y-4">
            <h3 className="font-black text-lg flex items-center gap-2">
              <Sparkles size={20} className="text-yellow-400" />
              앱으로 설치하기
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              KidQuest를 스마트폰 홈 화면에 추가하면 진짜 앱처럼 편리하게 사용할 수 있어요!
            </p>

            {install.canInstall && (
              <button
                type="button"
                onClick={() => install.promptInstall()}
                data-testid="install-button"
                className="flex items-center justify-center gap-2 w-full rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-black text-slate-900 shadow hover:bg-yellow-300 active:scale-[0.98]"
              >
                <Download size={16} />
                지금 설치하기
              </button>
            )}

            {!install.canInstall && (
              <div className="space-y-3 pt-2">
                {install.platform !== 'ios' && (
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-yellow-400 text-slate-900 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
                    <p className="text-xs font-medium">
                      <span className="text-yellow-400 font-bold">안드로이드/데스크톱:</span> 크롬 메뉴(⋮)에서 <span className="text-white font-bold">'앱 설치'</span>를 누르세요.
                    </p>
                  </div>
                )}
                {install.platform !== 'android' && (
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-pink-400 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                    <p className="text-xs font-medium">
                      <span className="text-pink-400 font-bold">아이폰:</span> 사파리 공유 버튼(⎋)을 누른 후 <span className="text-white font-bold">'홈 화면에 추가'</span>를 누르세요.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 rotate-12">
            <Smartphone size={96} />
          </div>
        </div>
      )}
    </div>
  );
}
