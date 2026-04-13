import React, { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type ChildProfile,
  type Family,
  type Quest,
  type QuestCategory,
  type UserProfile,
} from '../../types';
import { cn } from '../../lib/utils';
import { CategoryIcon } from '../../components/CategoryIcon';
import { TopBar } from './components/TopBar';
import { ChildRail } from './components/ChildRail';
import { ChildSummaryWidget } from './components/ChildSummaryWidget';
import { QuestQuickAdd } from './components/QuestQuickAdd';
import { FamilySettingsDrawer } from './components/FamilySettingsDrawer';
import { UndoToast } from './components/UndoToast';
import { AVATAR_OPTIONS } from './constants';

interface ParentDashboardProps {
  quests: Quest[];
  onAdd: (title: string, points: number, category: QuestCategory) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
  onFullReset: () => void;
  onPointReset: () => void;
  profile: UserProfile;
  onUpdateChildField: (updates: Partial<UserProfile>) => void;
  onExit: () => void;
  family: Family | null;
  childrenList: ChildProfile[];
  onAddChild: (name: string, avatar: string) => void;
  selectedChildId: string | null;
  onSelectChild: (id: string) => void;
  onJoinFamily: (code: string) => void;
  onDeleteChild: (id: string, name: string) => void;
  showAlert: (title: string, message: string) => void;
}

export function ParentDashboard(props: ParentDashboardProps) {
  const {
    quests,
    onAdd,
    onDelete,
    onReset,
    onFullReset,
    onPointReset,
    profile,
    onUpdateChildField,
    onExit,
    family,
    childrenList,
    onAddChild,
    selectedChildId,
    onSelectChild,
    onJoinFamily,
    onDeleteChild,
    showAlert,
  } = props;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);
  const undoActionRef = useRef<(() => void) | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const hasChildren = childrenList.length > 0;
  const hasSelectedChild = selectedChildId !== null;

  const triggerUndo = (message: string, undoFn: () => void) => {
    setUndoMessage(message);
    undoActionRef.current = undoFn;
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => {
      setUndoMessage(null);
      undoActionRef.current = null;
    }, 3500);
  };

  const performUndo = () => {
    undoActionRef.current?.();
    setUndoMessage(null);
    undoActionRef.current = null;
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
  };

  const handleDeleteQuest = (quest: Quest) => {
    onDelete(quest.id);
    triggerUndo(`"${quest.title}" 삭제됨`, () =>
      onAdd(quest.title, quest.points, quest.category)
    );
  };

  return (
    <div className="pb-24">
      <TopBar
        familyName={family?.name || '우리 가족'}
        onOpenSettings={() => setSettingsOpen(true)}
        onExit={onExit}
      />

      {!hasChildren ? (
        <EmptyStateNoChildren onAddChild={() => setAddChildOpen(true)} />
      ) : (
        <div className="mt-6 lg:grid lg:grid-cols-[280px_1fr] lg:gap-6">
          <ChildRail
            childrenList={childrenList}
            selectedId={selectedChildId}
            onSelect={onSelectChild}
            onOpenAddChild={() => setAddChildOpen(true)}
            selectedChildQuests={quests}
          />

          <main className="mt-6 lg:mt-0 space-y-6">
            {hasSelectedChild ? (
              <>
                <ChildSummaryWidget profile={profile} quests={quests} />
                <QuestQuickAdd onAdd={onAdd} />
                <QuestList quests={quests} onDelete={handleDeleteQuest} />
              </>
            ) : (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center">
                <p className="text-slate-400 font-bold">왼쪽에서 자녀를 선택하세요</p>
              </div>
            )}
          </main>
        </div>
      )}

      <AnimatePresence>
        {addChildOpen && (
          <AddChildModal
            onAdd={(name, avatar) => {
              onAddChild(name, avatar);
              setAddChildOpen(false);
            }}
            onClose={() => setAddChildOpen(false)}
          />
        )}
      </AnimatePresence>

      <FamilySettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        family={family}
        profile={profile}
        onUpdateChildField={onUpdateChildField}
        onJoinFamily={onJoinFamily}
        onDeleteSelectedChild={() => {
          if (selectedChildId) {
            onDeleteChild(selectedChildId, profile.name);
            setSettingsOpen(false);
          }
        }}
        onReset={onReset}
        onPointReset={onPointReset}
        onFullReset={onFullReset}
        showAlert={showAlert}
        hasSelectedChild={hasSelectedChild}
      />

      <UndoToast message={undoMessage} onUndo={performUndo} />
    </div>
  );
}

function EmptyStateNoChildren({ onAddChild }: { onAddChild: () => void }) {
  return (
    <div className="mt-8 bg-white rounded-[2.5rem] p-12 border-2 border-dashed border-slate-200 text-center space-y-6">
      <div className="text-6xl">👨‍👩‍👧</div>
      <div>
        <h2 className="text-xl font-black text-slate-800">첫 자녀를 등록해주세요</h2>
        <p className="text-sm font-bold text-slate-400 mt-1">
          자녀를 등록하면 퀘스트를 만들 수 있어요
        </p>
      </div>
      <button
        onClick={onAddChild}
        className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black rounded-2xl shadow-lg shadow-yellow-100 transition-all active:scale-95"
      >
        <Plus size={18} />첫 자녀 추가하기
      </button>
    </div>
  );
}

function AddChildModal({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, avatar: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim(), avatar);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 pointer-events-auto"
        >
          <h2 className="text-xl font-black text-slate-800">새 자녀 등록</h2>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              이름
            </label>
            <input
              type="text"
              placeholder="예: 민수, 지혜"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-yellow-400 bg-slate-50/50 font-bold text-lg transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              아바타
            </label>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setAvatar(e)}
                  className={cn(
                    'aspect-square rounded-2xl flex items-center justify-center text-3xl transition-all active:scale-90',
                    avatar === e
                      ? 'bg-yellow-400 shadow-lg shadow-yellow-100 scale-105'
                      : 'bg-slate-100 hover:bg-slate-200'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-[2] bg-yellow-400 disabled:bg-slate-200 text-slate-900 font-black py-4 rounded-2xl shadow-lg shadow-yellow-100 transition-all active:scale-[0.98]"
            >
              등록하기
            </button>
          </div>
        </form>
      </motion.div>
    </>
  );
}

function QuestList({
  quests,
  onDelete,
}: {
  quests: Quest[];
  onDelete: (q: Quest) => void;
}) {
  return (
    <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-lg text-slate-800">현재 퀘스트 목록</h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {quests.length} Quests
        </span>
      </div>
      <div className="space-y-3">
        {quests.length > 0 ? (
          quests.map((q) => (
            <motion.div
              layout
              key={q.id}
              className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between group hover:bg-slate-100 transition-all"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center text-white shadow',
                    CATEGORY_COLORS[q.category]
                  )}
                >
                  <CategoryIcon category={q.category} size={18} />
                </div>
                <div>
                  <p className="font-black text-slate-800 text-sm leading-tight">{q.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">
                      {q.points}P
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {CATEGORY_LABELS[q.category]}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => onDelete(q)}
                className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"
              >
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))
        ) : (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-slate-400 font-bold text-sm">
              등록된 퀘스트가 없어요.
              <br />
              위에서 새 퀘스트를 추가해보세요!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
