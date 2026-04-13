import React, { useEffect, useRef, useState } from 'react';
import { X, Home, Copy, Users, ChevronRight, CheckCircle2, AlertTriangle, Camera, Upload, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { UserProfile, Family } from '../../../types';
import { cn } from '../../../lib/utils';
import { AvatarPicker } from './AvatarPicker';
import { Avatar } from '../../../components/Avatar';
import { validateImageFile } from '../../../lib/storage';

interface FamilySettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  family: Family | null;
  profile: UserProfile;
  onUpdateChildField: (updates: Partial<UserProfile>) => void;
  onUploadChildPhoto: (file: File) => Promise<void>;
  onRemoveChildPhoto: () => void;
  onJoinFamily: (code: string) => void;
  onDeleteSelectedChild: () => void;
  onReset: () => void;
  onPointReset: () => void;
  onFullReset: () => void;
  showAlert: (title: string, message: string) => void;
  hasSelectedChild: boolean;
}

export function FamilySettingsDrawer({
  open,
  onClose,
  family,
  profile,
  onUpdateChildField,
  onUploadChildPhoto,
  onRemoveChildPhoto,
  onJoinFamily,
  onDeleteSelectedChild,
  onReset,
  onPointReset,
  onFullReset,
  showAlert,
  hasSelectedChild,
}: FamilySettingsDrawerProps) {
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [childName, setChildName] = useState(profile.name);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      showAlert('업로드 실패', err);
      return;
    }
    setUploading(true);
    try {
      await onUploadChildPhoto(file);
    } catch (uploadErr: any) {
      showAlert('업로드 실패', uploadErr?.message || '사진 업로드 중 오류가 발생했어요');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    setChildName(profile.name);
  }, [profile.name]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(family?.id || '');
    showAlert('복사 완료', '가족 초대 코드가 클립보드에 복사되었습니다.');
  };

  const handleJoinFamily = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    onJoinFamily(joinCode.trim().toUpperCase());
    setJoinCode('');
    setShowJoin(false);
    onClose();
  };

  const handleNameBlur = () => {
    if (childName.trim() && childName !== profile.name) {
      onUpdateChildField({ name: childName.trim() });
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[440px] bg-[#FDFCF0] z-50 overflow-y-auto shadow-2xl"
          >
            <div className="sticky top-0 bg-[#FDFCF0]/90 backdrop-blur-md border-b border-slate-200/50 px-6 py-4 flex items-center justify-between">
              <h2 className="font-black text-lg text-slate-800">설정</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-8">
              <section className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  가족
                </h3>
                <div className="bg-blue-600 rounded-2xl p-5 text-white space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Home size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">
                        가족 이름
                      </p>
                      <p className="text-lg font-black">{family?.name || '우리 가족'}</p>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                    <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest mb-1">
                      초대 코드
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-black font-mono truncate select-all">
                        {family?.id}
                      </code>
                      <button
                        onClick={handleCopyCode}
                        className="w-8 h-8 bg-white text-blue-600 rounded-lg flex items-center justify-center active:scale-95"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowJoin((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Users size={14} className="text-blue-500" />
                    다른 가족으로 합류
                  </span>
                  <ChevronRight
                    size={14}
                    className={cn('transition-transform', showJoin && 'rotate-90')}
                  />
                </button>

                <AnimatePresence>
                  {showJoin && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleJoinFamily}
                      className="space-y-2 overflow-hidden"
                    >
                      <input
                        type="text"
                        placeholder="가족 코드"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-blue-400 bg-white font-bold text-sm"
                      />
                      <button
                        type="submit"
                        className="w-full bg-blue-600 text-white font-black py-3 rounded-xl text-sm"
                      >
                        합류하기
                      </button>
                      <p className="text-[10px] font-bold text-slate-400 px-1">
                        * 합류 시 기존 가족 정보는 보이지 않게 됩니다.
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </section>

              {hasSelectedChild && (
                <section className="space-y-3">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    현재 자녀 편집
                  </h3>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        이름
                      </label>
                      <input
                        type="text"
                        value={childName}
                        onChange={(e) => setChildName(e.target.value)}
                        onBlur={handleNameBlur}
                        className="mt-1 w-full border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-yellow-400 bg-slate-50/50 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        프로필 사진
                      </label>
                      <div className="mt-2 flex items-center gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                          <Avatar emoji={profile.avatar} url={profile.avatarUrl} size={80} className="rounded-2xl" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handlePhotoPick}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl text-xs font-black transition-all active:scale-95"
                          >
                            {uploading ? (
                              <>업로드 중...</>
                            ) : (
                              <>
                                <Upload size={14} />
                                사진 업로드
                              </>
                            )}
                          </button>
                          {profile.avatarUrl && (
                            <button
                              type="button"
                              onClick={onRemoveChildPhoto}
                              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-red-200 text-red-500 rounded-xl text-[11px] font-bold hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={12} />
                              사진 제거 (이모지로)
                            </button>
                          )}
                          <p className="text-[10px] text-slate-400 font-medium">
                            JPG/PNG/WEBP · 최대 3MB
                          </p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        이모지 아바타 (사진 없을 때 표시)
                      </label>
                      <div className="mt-2">
                        <AvatarPicker
                          value={profile.avatar}
                          onChange={(avatar) => onUpdateChildField({ avatar })}
                        />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {hasSelectedChild && (
                <section className="space-y-3">
                  <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
                    <AlertTriangle size={12} /> 데이터 관리
                  </h3>
                  <div className="bg-white border border-red-100 rounded-2xl p-5 space-y-3">
                    <button
                      onClick={onReset}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-black text-slate-700 transition-colors"
                    >
                      <CheckCircle2 size={14} className="text-yellow-500" />
                      내일 퀘스트 준비 (체크 해제)
                    </button>
                    <button
                      onClick={onPointReset}
                      className="w-full py-3 bg-red-50 hover:bg-red-100 rounded-xl text-xs font-black text-red-600 transition-colors"
                    >
                      포인트만 초기화
                    </button>
                    <button
                      onClick={onFullReset}
                      className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl text-xs font-black text-white transition-colors"
                    >
                      이 자녀의 모든 데이터 삭제
                    </button>
                    <div className="h-px bg-slate-100 my-2" />
                    <button
                      onClick={onDeleteSelectedChild}
                      className="w-full py-3 bg-slate-900 hover:bg-black rounded-xl text-xs font-black text-red-400 transition-colors"
                    >
                      자녀 프로필 삭제
                    </button>
                  </div>
                </section>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
