import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface PasswordChangeFormProps {
  onChange: (current: string, next: string) => Promise<{ ok: boolean; error?: string }>;
  showAlert: (title: string, message: string) => void;
}

export function PasswordChangeForm({ onChange, showAlert }: PasswordChangeFormProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (next.length < 4) {
      showAlert('비밀번호 오류', '새 비밀번호는 4자 이상이어야 해요.');
      return;
    }
    if (next !== confirm) {
      showAlert('비밀번호 확인', '새 비밀번호와 확인이 일치하지 않아요.');
      return;
    }
    setBusy(true);
    const result = await onChange(current, next);
    setBusy(false);
    if (result.ok) {
      showAlert('변경 완료', '부모 비밀번호가 변경되었어요.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } else {
      showAlert('변경 실패', result.error || '현재 비밀번호가 올바르지 않아요.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <input
          type={showCurrent ? 'text' : 'password'}
          placeholder="현재 비밀번호"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 pr-10 outline-none focus:border-yellow-400 bg-slate-50/50 font-bold text-sm"
        />
        <button
          type="button"
          onClick={() => setShowCurrent((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label={showCurrent ? '숨기기' : '보기'}
        >
          {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <div className="relative">
        <input
          type={showNext ? 'text' : 'password'}
          placeholder="새 비밀번호 (4자 이상)"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 pr-10 outline-none focus:border-yellow-400 bg-slate-50/50 font-bold text-sm"
        />
        <button
          type="button"
          onClick={() => setShowNext((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label={showNext ? '숨기기' : '보기'}
        >
          {showNext ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <input
        type={showNext ? 'text' : 'password'}
        placeholder="새 비밀번호 확인"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-yellow-400 bg-slate-50/50 font-bold text-sm"
      />
      <button
        type="submit"
        disabled={busy || !current || !next || !confirm}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all',
          busy || !current || !next || !confirm
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]'
        )}
      >
        <KeyRound size={14} />
        {busy ? '변경 중...' : '비밀번호 변경'}
      </button>
    </form>
  );
}
