import React, { useState } from 'react';
import { Settings, LogOut, Home, Users, Copy, Sparkles, Plus, Trash2, Lock, CheckCircle2, Star, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORY_COLORS, CATEGORY_LABELS, type Quest, type QuestCategory, type UserProfile, type Family, type ChildProfile } from '../../types';
import { cn } from '../../lib/utils';
import { CategoryIcon } from '../../components/CategoryIcon';

export function ParentDashboard({ 
  quests, 
  onAdd, 
  onDelete, 
  onReset,
  onFullReset,
  onPointReset,
  profile,
  setProfile,
  onExit,
  family,
  childrenList,
  onAddChild,
  selectedChildId,
  onSelectChild,
  onJoinFamily,
  onDeleteChild,
  showAlert
}: { 
  quests: Quest[], 
  onAdd: (title: string, points: number, category: QuestCategory) => void, 
  onDelete: (id: string) => void,
  onReset: () => void,
  onFullReset: () => void,
  onPointReset: () => void,
  profile: UserProfile,
  setProfile: any,
  onExit: () => void,
  family: Family | null,
  childrenList: ChildProfile[],
  onAddChild: (name: string, avatar: string) => void,
  selectedChildId: string | null,
  onSelectChild: (id: string) => void,
  onJoinFamily: (code: string) => void,
  onDeleteChild: (id: string, name: string) => void,
  showAlert: (title: string, message: string) => void
}) {
  const [newTitle, setNewTitle] = useState('');
  const [newPoints, setNewPoints] = useState<number | string>(10);
  const [newCategory, setNewCategory] = useState<QuestCategory>('homework');
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [isJoiningFamily, setIsJoiningFamily] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || newPoints === '' || Number(newPoints) <= 0) return;
    onAdd(newTitle, Number(newPoints), newCategory);
    setNewTitle('');
    setNewPoints(10);
  };

  const handleAddChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildName.trim()) return;
    onAddChild(newChildName, '🦁');
    setNewChildName('');
    setIsAddingChild(false);
  };

  const handleJoinFamily = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    onJoinFamily(joinCode.trim().toUpperCase());
    setJoinCode('');
    setIsJoiningFamily(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Sticky Top Header - Moved to the very top as requested */}
      <div className="sticky top-0 z-30 -mx-6 px-6 py-3 bg-[#FDFCF0]/90 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-yellow-400 shadow-lg shadow-slate-200">
            <Settings size={20} />
          </div>
          <div>
            <h2 className="font-black text-slate-800 text-sm">부모님 관리</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Control Center</p>
          </div>
        </div>
        <button 
          onClick={onExit}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-xs transition-all active:scale-95 border border-slate-200 shadow-sm"
        >
          <LogOut size={16} />
          관리 모드 나가기
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Family Card */}
        <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-blue-200">
                  <Home size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Family Account</span>
                </div>
                <h3 className="text-3xl font-black tracking-tight">{family?.name || '우리 가족'}</h3>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsJoiningFamily(!isJoiningFamily)}
                  className="w-10 h-10 bg-blue-500/30 rounded-2xl flex items-center justify-center backdrop-blur-md border border-blue-400/30 hover:bg-blue-500/50 transition-colors"
                  title="다른 가족 합류하기"
                >
                  <Users size={20} />
                </button>
              </div>
            </div>
            
            <AnimatePresence>
              {isJoiningFamily && (
                <motion.form 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleJoinFamily}
                  className="bg-white/10 rounded-3xl p-5 backdrop-blur-xl border border-white/20 space-y-3"
                >
                  <p className="text-xs font-bold text-blue-100">다른 가족 코드로 합류하기</p>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="가족 코드 입력"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      className="flex-1 bg-white/20 border border-white/30 rounded-xl px-4 py-2 text-white placeholder:text-white/50 font-bold outline-none focus:bg-white/30"
                    />
                    <button type="submit" className="bg-white text-blue-600 px-4 py-2 rounded-xl font-black text-sm">합류</button>
                  </div>
                  <p className="text-[9px] text-blue-200">* 합류 시 기존 가족 정보는 보이지 않게 됩니다.</p>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="bg-white/10 rounded-3xl p-5 backdrop-blur-xl border border-white/20">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">가족 초대 코드 (ID)</span>
                <span className="text-[10px] font-bold text-blue-200">다른 보호자(배우자 등)를 초대하세요</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <code className="text-2xl font-black tracking-[0.2em] font-mono bg-blue-900/20 px-4 py-2 rounded-xl flex-1 text-center truncate select-all">
                  {family?.id}
                </code>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(family?.id || '');
                    showAlert('ID 복사 완료', '가족 초대 코드가 클립보드에 복사되었습니다. 다른 보호자에게 전달하여 함께 관리하세요!');
                  }}
                  className="bg-white text-blue-600 p-3 rounded-2xl font-black shadow-lg hover:scale-105 transition-transform active:scale-95 flex items-center justify-center"
                  title="복사하기"
                >
                  <Copy size={20} />
                </button>
              </div>
            </div>
          </div>
          <Sparkles className="absolute -right-8 -bottom-8 w-40 h-40 text-white/10 rotate-12" />
        </div>

        {/* Child Management */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <h3 className="font-black text-xl text-slate-800">아이 관리</h3>
              <p className="text-xs font-bold text-slate-400">함께 모험할 아이들을 등록하고 선택하세요</p>
            </div>
            <button 
              onClick={() => setIsAddingChild(!isAddingChild)}
              className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90",
                isAddingChild ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-blue-600 shadow-lg shadow-blue-100"
              )}
            >
              <Plus size={24} className={cn("transition-transform", isAddingChild ? "rotate-45" : "")} />
            </button>
          </div>

          <AnimatePresence>
            {isAddingChild && (
              <motion.form 
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                onSubmit={handleAddChild} 
                className="bg-slate-50 p-6 rounded-[2rem] space-y-4 border-2 border-dashed border-slate-200 overflow-hidden"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">아이 이름</label>
                  <input 
                    type="text" 
                    placeholder="예: 민수, 지혜"
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 outline-none focus:border-blue-400 bg-white font-bold text-lg transition-all shadow-inner"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="flex-[2] bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 active:scale-95 transition-all">등록하기</button>
                  <button type="button" onClick={() => setIsAddingChild(false)} className="flex-1 bg-white border-2 border-slate-200 text-slate-400 font-bold py-4 rounded-2xl active:scale-95 transition-all">취소</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="flex gap-4 overflow-x-auto py-6 scrollbar-hide -mx-2 px-4">
            {childrenList.map(c => (
              <div key={c.id} className="relative group">
                <button
                  onClick={() => onSelectChild(c.id)}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center gap-3 p-5 rounded-[2rem] border-2 transition-all active:scale-95 relative",
                    selectedChildId === c.id 
                      ? "border-blue-500 bg-blue-50 shadow-xl shadow-blue-100/50 scale-105" 
                      : "border-slate-100 bg-white hover:border-slate-200"
                  )}
                >
                  <div className={cn(
                    "w-16 h-16 rounded-3xl flex items-center justify-center text-4xl shadow-inner transition-all",
                    selectedChildId === c.id ? "bg-white" : "bg-slate-50 group-hover:bg-slate-100"
                  )}>
                    {c.avatar}
                  </div>
                  <div className="text-center">
                    <p className={cn("text-sm font-black", selectedChildId === c.id ? "text-blue-600" : "text-slate-700")}>
                      {c.name}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Lv.{c.level || 1}</p>
                  </div>
                  {selectedChildId === c.id && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full border-4 border-white flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                  )}
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChild(c.id, c.name);
                  }}
                  className="absolute -top-2 -left-2 w-8 h-8 bg-red-50 text-red-500 rounded-xl border border-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-500 hover:text-white"
                  title="아이 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Child Settings */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden">
          <div className="relative z-10 space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-800 rounded-[1.5rem] flex items-center justify-center text-3xl border border-slate-700 shadow-inner">
                {profile.avatar}
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">{profile.name} 관리</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest bg-yellow-400/10 px-2 py-0.5 rounded-md border border-yellow-400/20">Active Profile</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{profile.totalPoints} Points</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">아이 이름 수정</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={profile.name}
                    onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-2xl px-5 py-4 focus:border-yellow-400 focus:ring-0 transition-all font-black text-lg outline-none"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600">
                    <Star size={20} />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">데이터 초기화 및 관리</p>
                <button 
                  onClick={onReset}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-sm font-bold py-5 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 border border-slate-700 group"
                >
                  <CheckCircle2 size={20} className="text-yellow-400 group-hover:scale-110 transition-transform" />
                  내일 퀘스트 준비 (체크 해제, 포인트 유지)
                </button>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={onPointReset}
                    className="bg-red-900/20 text-red-400 hover:bg-red-900/40 text-xs font-bold py-5 rounded-2xl transition-all active:scale-[0.98] border border-red-900/30"
                  >
                    포인트만 초기화
                  </button>
                  <button 
                    onClick={onFullReset}
                    className="bg-red-600 text-white hover:bg-red-700 text-xs font-black py-5 rounded-2xl transition-all active:scale-[0.98] shadow-xl shadow-red-900/20"
                  >
                    모든 데이터 삭제
                  </button>
                </div>
              </div>
            </div>
          </div>
          <Lock className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5 rotate-12" />
        </div>

        {/* New Quest Form */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-2xl flex items-center justify-center text-yellow-600">
              <Plus size={28} />
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-800">새 퀘스트 추가</h3>
              <p className="text-xs font-bold text-slate-400">아이에게 줄 새로운 미션을 만들어주세요</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">퀘스트 내용</label>
              <input 
                type="text" 
                placeholder="예: 방 정리하기, 책 1권 읽기"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-yellow-400 bg-slate-50/50 font-bold text-lg transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">보상 포인트</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={newPoints}
                    onChange={(e) => setNewPoints(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-yellow-400 bg-slate-50/50 font-black text-lg transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-yellow-600">P</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">카테고리</label>
                <div className="relative">
                  <select 
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as QuestCategory)}
                    className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-yellow-400 outline-none transition-all font-bold appearance-none bg-slate-50/50"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90" />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black py-5 rounded-2xl shadow-xl shadow-yellow-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-lg"
            >
              <Plus size={24} />
              퀘스트 등록하기
            </button>
          </form>
        </div>

        {/* Quest List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black text-lg text-slate-800">현재 퀘스트 목록</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{quests.length} Quests</span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {quests.length > 0 ? (
              quests.map(q => (
                <motion.div 
                  layout
                  key={q.id} 
                  className="bg-white p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between group hover:shadow-lg hover:shadow-slate-100 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg", CATEGORY_COLORS[q.category])}>
                      <CategoryIcon category={q.category} size={20} />
                    </div>
                    <div>
                      <p className="font-black text-slate-800 leading-tight">{q.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md">{q.points}P</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{CATEGORY_LABELS[q.category]}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => onDelete(q.id)}
                    className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                  >
                    <Trash2 size={20} />
                  </button>
                </motion.div>
              ))
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center">
                <p className="text-slate-400 font-bold">등록된 퀘스트가 없어요.<br/>새로운 도전을 만들어주세요!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
