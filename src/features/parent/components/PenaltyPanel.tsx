import React, { useState } from 'react';
import { AlertTriangle, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { HistoryRecord } from '../../../types';

interface Props {
  onApply: (points: number, reason: string) => Promise<void>;
  history: HistoryRecord[];
}

const PRESETS: Array<{ points: number; reason: string; emoji: string }> = [
  { points: 10, reason: '약속을 어겼어요', emoji: '⏰' },
  { points: 20, reason: '정리 안 함', emoji: '🧹' },
  { points: 30, reason: '거짓말', emoji: '🤥' },
  { points: 30, reason: '형제자매와 다툼', emoji: '⚔️' },
  { points: 50, reason: '숙제 안 함', emoji: '📕' },
];

export function PenaltyPanel({ onApply, history }: Props) {
  const [customPoints, setCustomPoints] = useState<number | string>(10);
  const [customReason, setCustomReason] = useState('');
  const [pending, setPending] = useState<null | { points: number; reason: string }>(null);

  const recentPenalties = history
    .filter((h) => h.type === 'penalty')
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, 5);

  const confirmApply = async () => {
    if (!pending) return;
    const { points, reason } = pending;
    setPending(null);
    await onApply(points, reason);
  };

  const handlePreset = (p: (typeof PRESETS)[number]) => {
    setPending({ points: p.points, reason: p.reason });
  };

  const handleCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const pts = Number(customPoints);
    if (!pts || pts <= 0 || !customReason.trim()) return;
    setPending({ points: pts, reason: customReason.trim() });
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h3 className="font-black text-lg text-slate-800">패널티 부여</h3>
          <p className="text-[10px] font-bold text-slate-400">
            잘못을 했을 때 보유 포인트를 차감해요. 레벨과 스트릭은 유지돼요.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          빠른 패널티
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => handlePreset(p)}
              className="flex items-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition-all active:scale-95 text-left"
            >
              <span className="text-xl">{p.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-800 truncate">{p.reason}</p>
                <p className="text-[10px] font-bold text-red-500">-{p.points}P</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleCustom} className="space-y-2 bg-slate-50/60 rounded-2xl p-3">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          사용자 지정
        </p>
        <input
          type="text"
          placeholder="사유 (예: 숙제 거짓말)"
          value={customReason}
          onChange={(e) => setCustomReason(e.target.value)}
          className="w-full border-2 border-white rounded-xl px-4 py-3 outline-none focus:border-red-300 bg-white font-bold text-sm"
        />
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="number"
              value={customPoints}
              onChange={(e) =>
                setCustomPoints(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="w-full border-2 border-white rounded-xl px-4 py-3 outline-none focus:border-red-300 bg-white font-black"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-red-500">
              P
            </span>
          </div>
          <button
            type="submit"
            className="px-5 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl active:scale-95 flex items-center gap-1"
          >
            <Minus size={14} />
            차감
          </button>
        </div>
      </form>

      {recentPenalties.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            최근 패널티
          </p>
          <div className="space-y-1">
            {recentPenalties.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between bg-red-50/50 p-2 px-3 rounded-xl"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">
                    {h.reason || h.title}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400">
                    {new Date(h.timestamp).toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className="text-xs font-black text-red-500">{h.points}P</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {pending && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
              onClick={() => setPending(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 pointer-events-auto">
                <div className="text-center space-y-1">
                  <div className="text-4xl">⚠️</div>
                  <h3 className="text-xl font-black text-slate-800">패널티 확인</h3>
                  <p className="text-sm font-bold text-slate-500">
                    정말 -{pending.points}P 를 차감할까요?
                  </p>
                  <p className="text-xs font-bold text-slate-400">사유: {pending.reason}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPending(null)}
                    className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200"
                  >
                    취소
                  </button>
                  <button
                    onClick={confirmApply}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-black py-3 rounded-xl shadow-lg shadow-red-100"
                  >
                    차감하기
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
