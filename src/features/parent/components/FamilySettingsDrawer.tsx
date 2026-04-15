import React, { useEffect, useRef, useState } from 'react';
import { X, Home, Copy, Users, ChevronRight, CheckCircle2, AlertTriangle, KeyRound, Upload, Trash2, Download, Crown, UserMinus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { UserProfile, Family, HistoryRecord } from '../../../types';
import { downloadHistoryCsv } from '../../../lib/exportCsv';
import { cn } from '../../../lib/utils';
import { AvatarPicker } from './AvatarPicker';
import { Avatar } from '../../../components/Avatar';
import { validateImageFile } from '../../../lib/storage';
import { PasswordChangeForm } from './PasswordChangeForm';
import { ReminderSettings } from './ReminderSettings';

interface FamilySettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  family: Family | null;
  profile: UserProfile;
  onUpdateChildField: (updates: Partial<UserProfile>) => void;
  onUploadChildPhoto: (file: File) => Promise<void>;
  onRemoveChildPhoto: () => void;
  onJoinFamily: (code: string) => void;
  onRemoveMember: (uid: string) => void;
  currentUid: string | null;
  currentUserName: string;
  onUpdateMyName: (name: string) => void;
  onDeleteSelectedChild: () => void;
  onReset: () => void;
  onPointReset: () => void;
  onFullReset: () => void;
  showAlert: (title: string, message: string) => void;
  hasSelectedChild: boolean;
  onChangePassword: (current: string, next: string) => Promise<{ ok: boolean; error?: string }>;
  history: HistoryRecord[];
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
  onRemoveMember,
  currentUid,
  currentUserName,
  onUpdateMyName,
  onDeleteSelectedChild,
  onReset,
  onPointReset,
  onFullReset,
  showAlert,
  hasSelectedChild,
  onChangePassword,
  history,
}: FamilySettingsDrawerProps) {
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [childName, setChildName] = useState(profile.name);
  const [myName, setMyName] = useState(currentUserName);
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

  useEffect(() => {
    setMyName(currentUserName);
  }, [currentUserName]);

  const handleSaveMyName = () => {
    if (myName.trim() && myName !== currentUserName) {
      onUpdateMyName(myName.trim());
    }
  };

  // Two distinct invite codes — role is determined by which one was used.
  // parentInviteCode is also the family doc ID. childInviteCode is queried
  // separately. Old families that predate this split fall back to the
  // single legacy `inviteCode` value for the parent slot.
  const parentCode = family?.parentInviteCode || family?.inviteCode || family?.id || '';
  const childCode = family?.childInviteCode || '';

  const handleCopy = (code: string, label: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    showAlert('복사 완료', `${label}이(가) 클립보드에 복사되었습니다.`);
  };

  const isOwner = !!(family?.ownerUid && currentUid && family.ownerUid === currentUid);
  const memberEntries: Array<{ uid: string; role: 'parent' | 'child'; name: string }> =
    family?.members
      ? Object.entries(family.members).map(([uid, role]) => ({
          uid,
          role: role as 'parent' | 'child',
          name: family.memberNames?.[uid] || uid.slice(0, 6),
        }))
      : [];

  const handleJoinFamily = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.replace(/\s+/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!cleaned) return;
    onJoinFamily(cleaned);
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
                  내 프로필
                </h3>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    표시 이름
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={myName}
                      onChange={(e) => setMyName(e.target.value)}
                      onBlur={handleSaveMyName}
                      placeholder="내 이름"
                      maxLength={40}
                      className="flex-1 border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-blue-400 bg-slate-50/50 font-bold"
                    />
                    <button
                      onClick={handleSaveMyName}
                      disabled={!myName.trim() || myName === currentUserName}
                      className="px-4 py-3 bg-blue-600 disabled:bg-slate-200 text-white font-black rounded-xl text-xs active:scale-95"
                    >
                      저장
                    </button>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400">
                    가족 멤버 리스트와 피드에 표시되는 이름이에요.
                  </p>
                </div>
              </section>

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
                      부모 초대 코드
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-base font-black font-mono truncate select-all tracking-widest">
                        {parentCode || '—'}
                      </code>
                      <button
                        onClick={() => handleCopy(parentCode, '부모 초대 코드')}
                        className="w-8 h-8 bg-white text-blue-600 rounded-lg flex items-center justify-center active:scale-95"
                        aria-label="부모 초대 코드 복사"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                    <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest mb-1">
                      자녀 초대 코드
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-base font-black font-mono truncate select-all tracking-widest">
                        {childCode || '—'}
                      </code>
                      <button
                        onClick={() => handleCopy(childCode, '자녀 초대 코드')}
                        disabled={!childCode}
                        className="w-8 h-8 bg-white text-blue-600 rounded-lg flex items-center justify-center active:scale-95 disabled:opacity-40"
                        aria-label="자녀 초대 코드 복사"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <p className="text-[9px] font-bold text-blue-200/90 mt-2 leading-snug">
                      코드별로 합류 시 역할이 자동 결정돼요. 자녀 코드는 부모 권한을 받지 못해요.
                    </p>
                  </div>
                </div>

                {memberEntries.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                      가족 멤버 ({memberEntries.length}명)
                    </p>
                    {memberEntries.map((m) => {
                      const isMemberOwner = m.uid === family?.ownerUid;
                      const isSelf = m.uid === currentUid;
                      const canRemove = isOwner && !isSelf;
                      return (
                        <div
                          key={m.uid}
                          className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl"
                        >
                          <div className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0',
                            m.role === 'parent' ? 'bg-blue-500' : 'bg-emerald-500'
                          )}>
                            {isMemberOwner ? <Crown size={14} /> : <Users size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm text-slate-800 truncate">
                              {m.name}
                              {isSelf && <span className="text-[10px] font-bold text-slate-400 ml-1">(나)</span>}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400">
                              {isMemberOwner ? '👑 가족 주인 · ' : ''}
                              {m.role === 'parent' ? '부모' : '자녀'}
                            </p>
                          </div>
                          {canRemove && (
                            <button
                              onClick={() => onRemoveMember(m.uid)}
                              className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg flex items-center justify-center active:scale-95"
                              aria-label={`${m.name} 제거`}
                            >
                              <UserMinus size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {!isOwner && (
                      <p className="text-[10px] font-bold text-slate-400 px-1 pt-1">
                        * 멤버 제거는 가족 주인만 할 수 있어요.
                      </p>
                    )}
                  </div>
                )}

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

              <section className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  매일 알림
                </h3>
                <ReminderSettings showAlert={showAlert} />
              </section>

              <section className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <KeyRound size={12} /> 부모 비밀번호
                </h3>
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <p className="text-[10px] font-bold text-slate-400 mb-3">
                    부모 관리 모드 진입 비밀번호를 변경합니다. 기본값은 1234 입니다.
                  </p>
                  <PasswordChangeForm onChange={onChangePassword} showAlert={showAlert} />
                </div>
              </section>

              {hasSelectedChild && (
                <section className="space-y-3">
                  <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
                    <AlertTriangle size={12} /> 데이터 관리
                  </h3>
                  <div className="bg-white border border-red-100 rounded-2xl p-5 space-y-3">
                    <button
                      onClick={() => {
                        if (history.length === 0) {
                          showAlert('내보낼 기록 없음', '아직 기록된 활동이 없어요.');
                          return;
                        }
                        downloadHistoryCsv(history, profile.name || '아이');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-blue-50 hover:bg-blue-100 rounded-xl text-xs font-black text-blue-600 transition-colors"
                    >
                      <Download size={14} />
                      활동 기록 CSV로 내보내기
                    </button>
                    <button
                      onClick={onReset}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-black text-slate-700 transition-colors"
                    >
                      <CheckCircle2 size={14} className="text-yellow-500" />
                      내일 다시 시작 (미션 체크 해제)
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
