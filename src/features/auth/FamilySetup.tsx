import { useState } from 'react';
import { Home, Plus, Users, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { SOUNDS, playSound } from '../../lib/sound';

interface FamilySetupProps {
  onCreate: (name: string) => void;
  onJoin: (code: string) => void;
  onLogout: () => void;
}

export function FamilySetup({ onCreate, onJoin, onLogout }: FamilySetupProps) {
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [mode, setMode] = useState<'initial' | 'create' | 'join'>('initial');

  return (
    <div className="min-h-screen bg-[#FDFCF0] flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] p-10 shadow-2xl max-w-md w-full text-center space-y-8 border border-slate-100"
      >
        <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
          <Home size={48} className="text-blue-500" />
        </div>

        {mode === 'initial' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">가족 설정</h1>
              <p className="text-slate-500 mt-3 font-medium">새로운 가족을 만들거나<br/>기존 가족의 코드로 합류하세요.</p>
            </div>
            <div className="grid gap-4">
              <button
                onClick={() => {
                  playSound(SOUNDS.CLICK);
                  setMode('create');
                }}
                className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <Plus size={24} />
                새 가족 만들기
              </button>
              <button
                onClick={() => {
                  playSound(SOUNDS.CLICK);
                  setMode('join');
                }}
                className="w-full bg-white border-2 border-slate-100 text-slate-700 font-black py-5 rounded-2xl hover:bg-slate-50 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <Users size={24} className="text-blue-500" />
                가족 코드로 합류하기
              </button>
            </div>
            <button
              onClick={() => {
                playSound(SOUNDS.CLICK);
                onLogout();
              }}
              className="text-slate-400 text-sm font-bold hover:text-slate-600 transition-colors"
            >
              다른 계정으로 로그인
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-6">
            <div className="text-left">
              <button
                onClick={() => {
                  playSound(SOUNDS.CLICK);
                  setMode('initial');
                }}
                className="text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1 font-bold text-sm"
              >
                <ChevronLeft size={16} /> 뒤로가기
              </button>
              <h2 className="text-2xl font-black text-slate-800">가족 이름 정하기</h2>
              <p className="text-slate-500 text-sm mt-1">우리 가족을 나타내는 이름을 입력해주세요.</p>
            </div>
            <input
              type="text"
              placeholder="예: 행복한 우리집, 김씨네 가족"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              className="w-full border-2 border-slate-100 rounded-2xl px-6 py-4 outline-none focus:border-blue-400 bg-slate-50/50 font-bold text-lg transition-all"
            />
            <button
              onClick={() => {
                playSound(SOUNDS.CLICK);
                onCreate(familyName);
              }}
              disabled={!familyName.trim()}
              className="w-full bg-blue-600 disabled:bg-slate-200 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-[0.98]"
            >
              가족 생성하기
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-6">
            <div className="text-left">
              <button
                onClick={() => {
                  playSound(SOUNDS.CLICK);
                  setMode('initial');
                }}
                className="text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1 font-bold text-sm"
              >
                <ChevronLeft size={16} /> 뒤로가기
              </button>
              <h2 className="text-2xl font-black text-slate-800">가족 코드 입력</h2>
              <p className="text-slate-500 text-sm mt-1">초대받은 6자리 코드를 입력해주세요.</p>
            </div>
            <input
              type="text"
              placeholder="가족 코드 (예: ABCDEF)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full border-2 border-slate-100 rounded-2xl px-6 py-4 outline-none focus:border-blue-400 bg-slate-50/50 font-black text-2xl tracking-[0.3em] text-center transition-all"
              maxLength={6}
            />
            <button
              onClick={() => {
                playSound(SOUNDS.CLICK);
                onJoin(inviteCode);
              }}
              disabled={inviteCode.length < 4}
              className="w-full bg-blue-600 disabled:bg-slate-200 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-[0.98]"
            >
              가족 합류하기
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
