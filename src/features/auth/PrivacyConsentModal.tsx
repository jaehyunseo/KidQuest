import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Shield, FileText, UserCheck, Megaphone, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ConsentResult {
  privacy: boolean;
  terms: boolean;
  age: boolean;
  marketing: boolean;
}

interface PrivacyConsentModalProps {
  open: boolean;
  onClose: () => void;
  onAgree: (consent: ConsentResult) => void;
  /**
   * If true, the modal is blocking — clicking the backdrop does
   * nothing, and the cancel button signs the user out instead of
   * simply closing the modal. Use this for the post-login consent
   * check where the user must agree before entering the app.
   */
  blocking?: boolean;
  cancelLabel?: string;
}

export function PrivacyConsentModal({
  open,
  onClose,
  onAgree,
  blocking = false,
  cancelLabel,
}: PrivacyConsentModalProps) {
  const [privacy, setPrivacy] = useState(false);
  const [terms, setTerms] = useState(false);
  const [age, setAge] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const allRequired = privacy && terms && age;

  const toggleAll = () => {
    const next = !(privacy && terms && age && marketing);
    setPrivacy(next);
    setTerms(next);
    setAge(next);
    setMarketing(next);
  };

  const handleAgree = () => {
    if (!allRequired) return;
    onAgree({ privacy, terms, age, marketing });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="privacy-consent-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50"
        >
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={blocking ? undefined : onClose}
          />
          <motion.div
            initial={{ y: 20, scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, scale: 0.95 }}
            className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl pointer-events-auto flex flex-col">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-800">아이퀘스트 이용 동의</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">
                    {blocking
                      ? '서비스 이용을 위해 아래 항목에 동의해주세요'
                      : '서비스 이용 전 아래 내용을 확인해주세요'}
                  </p>
                </div>
                {!blocking && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
                <button
                  onClick={toggleAll}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all',
                    privacy && terms && age && marketing
                      ? 'bg-yellow-50 border-yellow-400'
                      : 'bg-slate-50 border-slate-200'
                  )}
                >
                  <CheckBox checked={privacy && terms && age && marketing} />
                  <span className="font-black text-sm text-slate-800">전체 동의</span>
                </button>

                <div className="h-px bg-slate-100" />

                <ConsentItem
                  icon={<Shield size={16} className="text-blue-500" />}
                  label="개인정보 수집 및 이용 동의"
                  required
                  checked={privacy}
                  onToggle={() => setPrivacy((v) => !v)}
                  expanded={expanded === 'privacy'}
                  onExpand={() => setExpanded(expanded === 'privacy' ? null : 'privacy')}
                  details={
                    <div className="space-y-2 text-[11px] font-medium text-slate-600 leading-relaxed">
                      <p><b>수집 항목</b>: 이메일, 이름, 프로필 사진, 가족·자녀 정보, 퀘스트·포인트 기록</p>
                      <p><b>수집 목적</b>: 서비스 제공, 가족 계정 관리, 자녀 활동 기록 저장</p>
                      <p><b>보유 기간</b>: 회원 탈퇴 시까지 (관련 법령에 따라 필요한 경우 해당 기간)</p>
                      <p><b>제3자 제공</b>: 제공하지 않습니다. 단, 인증 및 데이터 저장을 위해 Google Firebase를 이용합니다.</p>
                      <p className="text-slate-400">
                        동의를 거부할 수 있으나, 동의하지 않을 경우 서비스 이용이 제한됩니다.
                      </p>
                    </div>
                  }
                />

                <ConsentItem
                  icon={<FileText size={16} className="text-purple-500" />}
                  label="서비스 이용약관 동의"
                  required
                  checked={terms}
                  onToggle={() => setTerms((v) => !v)}
                  expanded={expanded === 'terms'}
                  onExpand={() => setExpanded(expanded === 'terms' ? null : 'terms')}
                  details={
                    <div className="space-y-2 text-[11px] font-medium text-slate-600 leading-relaxed">
                      <p><b>서비스명</b>: 아이퀘스트 (KidQuest)</p>
                      <p><b>서비스 내용</b>: 자녀의 습관 형성을 돕는 게임형 퀘스트 관리 서비스</p>
                      <p><b>이용자 의무</b>: 타인의 개인정보를 무단 수집·이용·제공하지 않아야 합니다.</p>
                      <p><b>면책</b>: 천재지변, 서비스 장애 등 불가항력으로 인한 서비스 중단에 대해 책임지지 않습니다.</p>
                      <p><b>운영자</b>: 아이퀘스트 (문의: kidquest@example.com)</p>
                    </div>
                  }
                />

                <ConsentItem
                  icon={<UserCheck size={16} className="text-green-500" />}
                  label="만 14세 이상입니다"
                  required
                  checked={age}
                  onToggle={() => setAge((v) => !v)}
                  details={
                    <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
                      만 14세 미만은 부모 또는 법정대리인의 동의가 필요합니다. 이 계정은
                      부모·보호자 계정으로 사용됩니다.
                    </p>
                  }
                  expanded={expanded === 'age'}
                  onExpand={() => setExpanded(expanded === 'age' ? null : 'age')}
                />

                <ConsentItem
                  icon={<Megaphone size={16} className="text-orange-500" />}
                  label="마케팅 정보 수신 동의"
                  optional
                  checked={marketing}
                  onToggle={() => setMarketing((v) => !v)}
                  details={
                    <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
                      이벤트, 신규 기능, 맞춤형 팁 등의 정보를 이메일로 받아볼 수 있습니다.
                      언제든지 수신 거부가 가능합니다.
                    </p>
                  }
                  expanded={expanded === 'marketing'}
                  onExpand={() => setExpanded(expanded === 'marketing' ? null : 'marketing')}
                />
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 bg-white border border-slate-200 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-100 transition-colors"
                >
                  {cancelLabel ?? (blocking ? '동의하지 않음 (로그아웃)' : '취소')}
                </button>
                <button
                  onClick={handleAgree}
                  disabled={!allRequired}
                  className={cn(
                    'flex-[2] font-black py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg',
                    allRequired
                      ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  )}
                >
                  {blocking ? '동의하고 시작하기' : '동의하고 Google 로그인'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <div
      className={cn(
        'w-5 h-5 rounded-md flex items-center justify-center border-2 shrink-0 transition-all',
        checked ? 'bg-yellow-400 border-yellow-400' : 'bg-white border-slate-300'
      )}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M3 8 L7 12 L13 4" />
        </svg>
      )}
    </div>
  );
}

interface ConsentItemProps {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  optional?: boolean;
  checked: boolean;
  onToggle: () => void;
  expanded: boolean;
  onExpand: () => void;
  details: React.ReactNode;
}

function ConsentItem({
  icon,
  label,
  required,
  optional,
  checked,
  onToggle,
  expanded,
  onExpand,
  details,
}: ConsentItemProps) {
  return (
    <div className="bg-slate-50 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 p-3">
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 text-left">
          <CheckBox checked={checked} />
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            <span className="text-xs font-black text-slate-800 truncate">{label}</span>
            {required && (
              <span className="text-[9px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                필수
              </span>
            )}
            {optional && (
              <span className="text-[9px] font-black text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                선택
              </span>
            )}
          </div>
        </button>
        <button
          onClick={onExpand}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <ChevronDown
            size={14}
            className={cn('transition-transform', expanded && 'rotate-180')}
          />
        </button>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">{details}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
