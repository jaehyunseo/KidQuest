import { X, Sparkles, Check, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

// Trigger reason drives the headline copy so the modal feels
// contextual rather than generic "upgrade to Pro" spam. Add new
// reasons here as we wire more gates.
export type UpsellReason =
  | 'second_child'
  | 'ai_limit'
  | 'reward_slots'
  | 'quest_groups'
  | 'premium_avatar'
  | 'premium_badge'
  | 'premium_theme'
  | 'calendar_history'
  | 'remove_ads'
  | 'generic';

const REASON_COPY: Record<UpsellReason, { title: string; lead: string }> = {
  second_child: {
    title: '두 명 이상 아이를 함께 관리하려면',
    lead: '형제자매를 한 화면에서 관리하고, 각자의 포인트와 기록을 구분해 볼 수 있어요.',
  },
  ai_limit: {
    title: 'AI 응원 메시지를 무제한으로',
    lead: '매일 새로운 응원을 원하는 만큼 받아보세요.',
  },
  reward_slots: {
    title: '더 많은 보상을 등록하려면',
    lead: '기본 5개 슬롯을 넘어 자유롭게 보상을 채워보세요.',
  },
  quest_groups: {
    title: '퀘스트 그룹을 무제한으로',
    lead: '과목별·상황별 묶음을 원하는 만큼 만들 수 있어요.',
  },
  premium_avatar: {
    title: '프리미엄 캐릭터 팩',
    lead: '유니콘, 드래곤, 닌자, 마법사 — 특별한 아바타로 아이의 세계를 꾸며보세요.',
  },
  premium_badge: {
    title: '특별한 배지 스킨',
    lead: '네온·레인보우·홀로그램 효과로 성취를 더 빛나게 만들어요.',
  },
  premium_theme: {
    title: '나만의 테마',
    lead: '파스텔, 다크, 네온 테마로 앱 분위기를 바꿔보세요.',
  },
  calendar_history: {
    title: '전체 기록 돌아보기',
    lead: '7일 제한을 풀고, 지난 모든 날의 성장을 한눈에 확인하세요.',
  },
  remove_ads: {
    title: '광고 없이 사용하기',
    lead: 'KidQuest Pro로 더 깔끔한 경험을 즐겨보세요.',
  },
  generic: {
    title: 'KidQuest Pro',
    lead: '가족 모두를 위한 프리미엄 기능을 한 번에.',
  },
};

const PRO_BENEFITS: string[] = [
  '아이 무제한 등록',
  'AI 응원 메시지 무제한',
  '프리미엄 아바타 + 캐릭터 팩',
  '배지 스킨 · 테마 커스터마이징',
  '보상 · 퀘스트 그룹 무제한',
  '전체 기록 무제한 조회',
  '광고 완전 제거',
  '주간 상세 성장 리포트',
];

interface ProUpsellModalProps {
  open: boolean;
  reason: UpsellReason;
  onClose: () => void;
  // Callbacks for each CTA. The host app wires these to the actual
  // billing flow (Google Play / App Store IAP) when available. For
  // now they can be no-ops or navigate to a "coming soon" screen.
  onSelectYearly?: () => void;
  onSelectMonthly?: () => void;
  // Optional promo code path — shown at the bottom when present.
  onEnterPromoCode?: () => void;
}

export function ProUpsellModal({
  open,
  reason,
  onClose,
  onSelectYearly,
  onSelectMonthly,
  onEnterPromoCode,
}: ProUpsellModalProps) {
  const copy = REASON_COPY[reason] ?? REASON_COPY.generic;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl md:rounded-3xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="bg-gradient-to-br from-yellow-400 via-orange-400 to-pink-500 p-6 text-white">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/25 backdrop-blur">
                  <Crown size={20} className="text-white" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider opacity-90">
                  KidQuest Pro
                </span>
              </div>
              <h2 className="mt-3 text-xl font-black leading-tight">
                {copy.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed opacity-95">
                {copy.lead}
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-2 px-6 pt-5">
              {PRO_BENEFITS.map((b) => (
                <div key={b} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <Check size={13} />
                  </div>
                  <span className="text-sm text-slate-700">{b}</span>
                </div>
              ))}
            </div>

            {/* Pricing cards */}
            <div className="px-6 pt-5">
              <button
                type="button"
                onClick={onSelectYearly}
                className={cn(
                  'relative w-full rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-4 text-left transition-all',
                  'hover:border-yellow-500 hover:bg-yellow-100 active:scale-[0.98]',
                )}
              >
                <div className="absolute -top-2.5 right-3 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white">
                  31% 할인
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-orange-500">
                      Pro 연간
                    </p>
                    <p className="mt-1 text-2xl font-black text-slate-900">
                      ₩24,000
                      <span className="text-sm font-bold text-slate-400">/년</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400">월 환산</p>
                    <p className="text-sm font-black text-slate-600">₩2,000</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={onSelectMonthly}
                className="mt-2.5 w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition-all hover:border-slate-300 active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Pro 월간</p>
                    <p className="text-lg font-black text-slate-800">
                      ₩2,900
                      <span className="text-xs font-bold text-slate-400">/월</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">유연하게</span>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 pb-5 pt-4">
              <button
                type="button"
                onClick={onEnterPromoCode}
                className="text-xs font-bold text-slate-400 underline-offset-2 hover:underline"
              >
                프로모 코드 입력
              </button>
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                <Sparkles size={11} />
                언제든 해지 가능
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
