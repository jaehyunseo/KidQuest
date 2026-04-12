/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  Settings, 
  User, 
  Sparkles,
  ChevronRight,
  Home,
  Star,
  BookOpen,
  Heart,
  Gamepad2,
  ShoppingBag,
  Lock,
  Unlock,
  LogOut,
  Gift,
  Camera,
  Smartphone,
  Edit2,
  Calendar as CalendarIcon,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { GoogleGenAI } from "@google/genai";
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, writeBatch, addDoc } from 'firebase/firestore';
import { Quest, QuestCategory, UserProfile, Reward, HistoryRecord, CATEGORY_COLORS, CATEGORY_LABELS, UserAccount, Family, ChildProfile } from './types';
import { cn, getLevel, getProgressToNextLevel } from './lib/utils';

const INITIAL_QUESTS: Quest[] = [
  { id: '1', title: '수학 익힘책 풀기', points: 10, category: 'homework', completed: false },
  { id: '2', title: '엄마 도와서 설거지하기', points: 100, category: 'chore', completed: false },
  { id: '3', title: '방 정리하기', points: 50, category: 'chore', completed: false },
  { id: '4', title: '영어 단어 10개 외우기', points: 20, category: 'homework', completed: false },
];

const INITIAL_REWARDS: Reward[] = [
  { id: 'r1', title: '유튜브 30분 시청권', description: '오늘 하루 유튜브를 30분 더 볼 수 있어요!', points: 300, icon: '📺' },
  { id: 'r2', title: '맛있는 아이스크림', description: '편의점에서 좋아하는 아이스크림 하나!', points: 500, icon: '🍦' },
  { id: 'r3', title: '주말 게임 1시간 추가', description: '이번 주말에 게임을 1시간 더 할 수 있어요.', points: 1000, icon: '🎮' },
  { id: 'r4', title: '원하는 장난감 선물', description: '부모님과 상의해서 원하는 장난감을 골라요!', points: 5000, icon: '🧸' },
];

type ViewMode = 'quests' | 'shop' | 'profile' | 'calendar';

type ModalConfig = {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'alert' | 'confirm';
  onConfirm?: () => void;
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isParentMode, setIsParentMode] = useState(false);
  const [parentPassword, setParentPassword] = useState('');
  const [isParentAuthenticated, setIsParentAuthenticated] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('quests');
  const [modal, setModal] = useState<ModalConfig>({ isOpen: false, title: '', message: '', type: 'alert' });
  
  const showAlert = (title: string, message: string) => {
    setModal({ isOpen: true, title, message, type: 'alert' });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModal({ isOpen: true, title, message, type: 'confirm', onConfirm });
  };

  const [quests, setQuests] = useState<Quest[]>([]);
  const [rewards, setRewards] = useState<Reward[]>(INITIAL_REWARDS);
  const [profile, setProfile] = useState<UserProfile>({ name: '우리 아이', totalPoints: 0, level: 1, avatar: '🦁', inventory: [] });
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [encouragement, setEncouragement] = useState<string>('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // Auth & User Account Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setUserAccount({ uid: u.uid, ...snap.data() } as UserAccount);
          } else {
            const newAccount: UserAccount = {
              uid: u.uid,
              email: u.email || '',
              name: u.displayName || '사용자',
              role: 'parent' // Default to parent for first login
            };
            setDoc(userRef, newAccount);
            setUserAccount(newAccount);
          }
        });
      } else {
        setUserAccount(null);
        setFamily(null);
        setChildren([]);
        setSelectedChildId(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Family Listener
  useEffect(() => {
    if (!userAccount?.familyId) return;

    const familyRef = doc(db, 'families', userAccount.familyId);
    const unsubFamily = onSnapshot(familyRef, (snap) => {
      if (snap.exists()) {
        setFamily({ id: snap.id, ...snap.data() } as Family);
      }
    });

    const childrenRef = collection(db, 'families', userAccount.familyId, 'children');
    const unsubChildren = onSnapshot(childrenRef, (snap) => {
      const childList = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChildProfile));
      setChildren(childList);
      if (childList.length > 0 && !selectedChildId) {
        setSelectedChildId(childList[0].id);
      }
    });

    return () => {
      unsubFamily();
      unsubChildren();
    };
  }, [userAccount?.familyId]);

  // Selected Child Data Listeners
  useEffect(() => {
    if (!userAccount?.familyId || !selectedChildId) return;

    const familyId = userAccount.familyId;
    const childId = selectedChildId;

    const profileRef = doc(db, 'families', familyId, 'children', childId);
    const unsubProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
    });

    const questsRef = collection(db, 'families', familyId, 'children', childId, 'quests');
    const unsubQuests = onSnapshot(questsRef, async (snapshot) => {
      if (snapshot.empty) {
        const batch = writeBatch(db);
        INITIAL_QUESTS.forEach(q => {
          const newDocRef = doc(questsRef);
          batch.set(newDocRef, { ...q, id: newDocRef.id });
        });
        await batch.commit();
      } else {
        setQuests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Quest)));
      }
    });

    const historyRef = collection(db, 'families', familyId, 'children', childId, 'history');
    const unsubHistory = onSnapshot(historyRef, (snapshot) => {
      setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HistoryRecord)));
    });

    return () => {
      unsubProfile();
      unsubQuests();
      unsubHistory();
    };
  }, [userAccount?.familyId, selectedChildId]);

  // Level up logic
  useEffect(() => {
    if (!profile || !userAccount?.familyId || !selectedChildId) return;
    const newLevel = getLevel(profile.totalPoints);
    if (newLevel !== profile.level) {
      updateDoc(doc(db, 'families', userAccount.familyId, 'children', selectedChildId), { level: newLevel });
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#FF4500']
      });
    }
  }, [profile?.totalPoints, userAccount?.familyId, selectedChildId]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
      showAlert('로그인 실패', '로그인 중 오류가 발생했습니다.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const toggleQuest = async (id: string) => {
    if (!user) return;
    const quest = quests.find(q => q.id === id);
    if (!quest) return;

    const newCompleted = !quest.completed;
    
    if (newCompleted) {
      const batch = writeBatch(db);
      
      // Update Quest
      batch.update(doc(db, 'users', user.uid, 'quests', id), { 
        completed: true, 
        completedAt: new Date().toISOString() 
      });
      
      // Update Profile Points
      batch.update(doc(db, 'users', user.uid, 'profile', 'main'), {
        totalPoints: profile.totalPoints + quest.points
      });

      // Add History
      const historyRef = doc(collection(db, 'users', user.uid, 'history'));
      batch.set(historyRef, {
        questId: quest.id,
        title: quest.title,
        points: quest.points,
        category: quest.category,
        timestamp: new Date().toISOString()
      });

      await batch.commit();

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } else {
      const batch = writeBatch(db);
      
      // Update Quest
      batch.update(doc(db, 'users', user.uid, 'quests', id), { 
        completed: false, 
        completedAt: null 
      });
      
      // Update Profile Points
      batch.update(doc(db, 'users', user.uid, 'profile', 'main'), {
        totalPoints: Math.max(0, profile.totalPoints - quest.points)
      });

      // Remove History (find today's record for this quest)
      const today = new Date().toDateString();
      const recordToDelete = history.find(h => 
        h.questId === quest.id && new Date(h.timestamp).toDateString() === today
      );
      if (recordToDelete) {
        batch.delete(doc(db, 'users', user.uid, 'history', recordToDelete.id));
      }

      await batch.commit();
    }
  };

  const addQuest = async (title: string, points: number, category: QuestCategory) => {
    if (!user) return;
    await addDoc(collection(db, 'users', user.uid, 'quests'), {
      title,
      points,
      category,
      completed: false
    });
  };

  const deleteQuest = (id: string) => {
    if (!user) return;
    const quest = quests.find(q => q.id === id);
    if (!quest) return;
    showConfirm('퀘스트 삭제', `정말 '${quest.title}' 퀘스트를 삭제할까요?\n삭제하면 복구할 수 없습니다.`, async () => {
      await deleteDoc(doc(db, 'users', user.uid, 'quests', id));
    });
  };

  const purchaseReward = (reward: Reward) => {
    if (!user) return;
    if (profile.totalPoints < reward.points) {
      showAlert('포인트 부족', '포인트가 부족해요! 퀘스트를 더 완료해볼까요?');
      return;
    }
    
    showConfirm('보상 구매', `정말 '${reward.title}' 보상을 구매할까요?\n구매 시 ${reward.points}P가 차감되며, 이 작업은 되돌릴 수 없습니다.`, async () => {
      const batch = writeBatch(db);
      
      // Update Profile
      batch.update(doc(db, 'users', user.uid, 'profile', 'main'), {
        totalPoints: profile.totalPoints - reward.points,
        inventory: [...profile.inventory, reward.id]
      });

      // Add History Record
      const historyRef = doc(collection(db, 'users', user.uid, 'history'));
      batch.set(historyRef, {
        type: 'reward',
        rewardId: reward.id,
        title: reward.title,
        points: -reward.points,
        timestamp: new Date().toISOString()
      });

      await batch.commit();

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4ade80', '#22c55e']
      });
    });
  };

  const resetDaily = () => {
    if (!userAccount?.familyId || !selectedChildId) return;
    showConfirm('내일 준비', '내일을 위해 퀘스트 체크만 해제할까요? (모은 포인트는 유지됩니다)', async () => {
      try {
        const batch = writeBatch(db);
        quests.forEach(q => {
          batch.update(doc(db, 'families', userAccount.familyId!, 'children', selectedChildId!, 'quests', q.id), { completed: false, completedAt: null });
        });
        await batch.commit();
        showAlert('준비 완료', '모든 퀘스트가 초기화되었습니다. 내일도 화이팅!');
      } catch (error) {
        console.error("Failed to reset daily quests:", error);
        showAlert('오류', '퀘스트 초기화 중 오류가 발생했습니다.');
      }
    });
  };

  const fullReset = () => {
    if (!userAccount?.familyId || !selectedChildId) return;
    showConfirm('전체 초기화', '정말 모든 데이터를 초기화할까요? (포인트, 기록, 보상 모두 삭제되며 복구할 수 없습니다)', async () => {
      try {
        const batch = writeBatch(db);
        quests.forEach(q => {
          batch.update(doc(db, 'families', userAccount.familyId!, 'children', selectedChildId!, 'quests', q.id), { completed: false, completedAt: null });
        });
        history.forEach(h => {
          batch.delete(doc(db, 'families', userAccount.familyId!, 'children', selectedChildId!, 'history', h.id));
        });
        batch.update(doc(db, 'families', userAccount.familyId!, 'children', selectedChildId!), {
          totalPoints: 0,
          level: 1,
          inventory: []
        });
        await batch.commit();
        showAlert('초기화 완료', '모든 데이터가 초기화되었습니다.');
      } catch (error) {
        console.error("Failed to full reset:", error);
        showAlert('오류', '초기화 중 오류가 발생했습니다.');
      }
    });
  };

  const resetPoints = () => {
    if (!userAccount?.familyId || !selectedChildId) return;
    showConfirm('포인트 초기화', '정말 포인트를 0으로 초기화할까요?\n모아둔 모든 포인트가 사라지며 복구할 수 없습니다.', async () => {
      try {
        await updateDoc(doc(db, 'families', userAccount.familyId, 'children', selectedChildId), { totalPoints: 0 });
        showAlert('초기화 완료', '포인트가 0으로 초기화되었습니다.');
      } catch (error) {
        console.error("Failed to reset points:", error);
        showAlert('오류', '포인트 초기화 중 오류가 발생했습니다.');
      }
    });
  };

  const createFamily = async (name: string) => {
    if (!user) return;
    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const familyRef = doc(collection(db, 'families'));
      const newFamily: Family = {
        id: familyRef.id,
        name,
        inviteCode,
        createdAt: new Date().toISOString(),
        members: { [user.uid]: 'parent' }
      };
      await setDoc(familyRef, newFamily);
      await updateDoc(doc(db, 'users', user.uid), { familyId: familyRef.id });
      showAlert('가족 생성 완료', `가족이 생성되었습니다! 초대 코드: ${inviteCode}`);
    } catch (error) {
      console.error("Failed to create family:", error);
      showAlert('오류', '가족 생성 중 오류가 발생했습니다.');
    }
  };

  const joinFamily = async (inviteCode: string) => {
    if (!user) return;
    try {
      const familyRef = doc(db, 'families', inviteCode);
      const snap = await getDoc(familyRef);
      if (snap.exists()) {
        const familyData = snap.data() as Family;
        await updateDoc(familyRef, {
          [`members.${user.uid}`]: 'parent'
        });
        await updateDoc(doc(db, 'users', user.uid), { familyId: inviteCode });
        showAlert('가족 합류 완료', `${familyData.name} 가족에 합류했습니다!`);
      } else {
        showAlert('오류', '해당 ID의 가족을 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error("Failed to join family:", error);
      showAlert('오류', '가족 합류 중 오류가 발생했습니다.');
    }
  };

  const addChild = async (name: string, avatar: string) => {
    if (!userAccount?.familyId) return;
    try {
      const childrenRef = collection(db, 'families', userAccount.familyId, 'children');
      const newChild: Omit<ChildProfile, 'id'> = {
        name,
        avatar,
        totalPoints: 0,
        level: 1,
        inventory: []
      };
      const docRef = await addDoc(childrenRef, newChild);
      setSelectedChildId(docRef.id);
      showAlert('아이 등록 완료', `${name} 아이가 등록되었습니다!`);
    } catch (error) {
      console.error("Failed to add child:", error);
      showAlert('오류', '아이 등록 중 오류가 발생했습니다.');
    }
  };

  const generateEncouragement = async () => {
    if (!process.env.GEMINI_API_KEY) return;
    setIsLoadingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const completedQuests = quests.filter(q => q.completed).map(q => q.title).join(', ');
      const prompt = `당신은 아이들을 격려하는 다정한 선생님입니다. 아이가 오늘 완료한 일들(${completedQuests || '아직 없지만 시작하려는 중'})을 보고 아이에게 칭찬과 응원의 메시지를 한 문장으로 아주 재미있고 따뜻하게 해주세요. 이모티콘도 섞어서요.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setEncouragement(response.text || '오늘도 멋진 하루를 만들어보자!');
    } catch (error) {
      console.error('AI Error:', error);
      setEncouragement('오늘도 너의 도전을 응원해! 화이팅! 🌟');
    } finally {
      setIsLoadingAI(false);
    }
  };

  useEffect(() => {
    generateEncouragement();
  }, []);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#FDFCF0] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FDFCF0] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 shadow-xl max-w-sm w-full text-center space-y-6">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
            <Trophy size={40} className="text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">KidQuest</h1>
            <p className="text-slate-500 mt-2">우리가족 퀘스트 관리 앱</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google로 시작하기
          </button>
        </div>
      </div>
    );
  }

  if (!userAccount?.familyId) {
    return (
      <FamilySetup 
        onCreate={createFamily} 
        onJoin={joinFamily} 
        onLogout={handleLogout}
      />
    );
  }

  if (children.length === 0) {
    return (
      <div className="min-h-screen bg-[#FDFCF0] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 shadow-xl max-w-sm w-full text-center space-y-6">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
            <Plus size={40} className="text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">아이 등록</h1>
            <p className="text-slate-500 mt-2">가족에 등록된 아이가 없습니다.<br/>첫 번째 아이를 등록해주세요.</p>
          </div>
          <button 
            onClick={() => addChild('우리 아이', '🦁')}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black py-4 rounded-2xl transition-all shadow-lg shadow-yellow-100"
          >
            아이 등록하기
          </button>
          <button 
            onClick={handleLogout}
            className="text-slate-400 text-sm font-bold hover:text-slate-600"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  if (!selectedChildId) {
    return (
      <div className="min-h-screen bg-[#FDFCF0] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  const handleParentAuth = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple mock password for demo purposes
    if (parentPassword === '1234') {
      setIsParentAuthenticated(true);
      setParentPassword('');
    } else {
      showAlert('인증 실패', '비밀번호가 틀렸어요! (힌트: 1234)');
    }
  };

  const exitParentMode = () => {
    setIsParentMode(false);
    setIsParentAuthenticated(false);
  };

  return (
    <div className="min-h-screen bg-[#FDFCF0] font-sans text-slate-900 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <button 
              onClick={() => setIsParentMode(true)}
              className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center text-2xl shadow-inner cursor-pointer hover:scale-105 transition-transform"
            >
              {profile.avatar}
            </button>
            {children.length > 1 && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">
                {children.length}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <select 
                value={selectedChildId || ''} 
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="font-bold text-lg leading-tight bg-transparent border-none focus:ring-0 p-0 cursor-pointer appearance-none"
              >
                {children.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronRight size={16} className="text-slate-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">Lv.{profile.level}</span>
              <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-yellow-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${getProgressToNextLevel(profile.totalPoints)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isParentMode && (
            <button 
              onClick={() => setIsParentMode(true)}
              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <Settings size={24} />
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <LogOut size={24} />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-6">
        {isParentMode ? (
          !isParentAuthenticated ? (
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center space-y-6">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Lock size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black">부모님 확인</h2>
                <p className="text-slate-500 text-sm">퀘스트를 관리하려면 비밀번호를 입력하세요.</p>
              </div>
              <form onSubmit={handleParentAuth} className="space-y-4">
                <input 
                  type="password" 
                  placeholder="비밀번호 (1234)"
                  value={parentPassword}
                  onChange={(e) => setParentPassword(e.target.value)}
                  className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-center text-2xl tracking-widest outline-none focus:border-yellow-400 transition-all"
                />
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsParentMode(false)}
                    className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl"
                  >
                    취소
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-yellow-400 text-slate-900 font-black py-4 rounded-2xl shadow-lg shadow-yellow-100"
                  >
                    확인
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <ParentDashboard 
              quests={quests} 
              onAdd={addQuest} 
              onDelete={deleteQuest} 
              onReset={resetDaily}
              onFullReset={fullReset}
              onPointReset={resetPoints}
              profile={profile}
              setProfile={async (p) => {
                if (typeof p === 'function') {
                  const newP = p(profile);
                  if (userAccount?.familyId && selectedChildId) {
                    await updateDoc(doc(db, 'families', userAccount.familyId, 'children', selectedChildId), { name: newP.name });
                  }
                }
              }}
              onExit={exitParentMode}
              family={family}
              childrenList={children}
              onAddChild={addChild}
              selectedChildId={selectedChildId}
              onSelectChild={setSelectedChildId}
            />
          )
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'quests' && (
              <motion.div
                key="quests"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <ChildDashboard 
                  quests={quests} 
                  onToggle={toggleQuest} 
                  profile={profile}
                  encouragement={encouragement}
                  isLoadingAI={isLoadingAI}
                  onRefreshAI={generateEncouragement}
                />
              </motion.div>
            )}
            {viewMode === 'shop' && (
              <motion.div
                key="shop"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <RewardShop 
                  rewards={rewards} 
                  profile={profile} 
                  onPurchase={purchaseReward} 
                />
              </motion.div>
            )}
            {viewMode === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <ProfileView 
                  profile={profile} 
                  rewards={rewards}
                />
              </motion.div>
            )}
            {viewMode === 'calendar' && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <CalendarView history={history} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Bottom Navigation */}
      {!isParentMode && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex justify-around items-center z-10">
          <button 
            onClick={() => setViewMode('quests')}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              viewMode === 'quests' ? "text-yellow-500" : "text-slate-400"
            )}
          >
            <Trophy size={24} />
            <span className="text-[10px] font-bold">퀘스트</span>
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              viewMode === 'calendar' ? "text-yellow-500" : "text-slate-400"
            )}
          >
            <CalendarIcon size={24} />
            <span className="text-[10px] font-bold">기록</span>
          </button>
          <button 
            onClick={() => setViewMode('shop')}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              viewMode === 'shop' ? "text-yellow-500" : "text-slate-400"
            )}
          >
            <ShoppingBag size={24} />
            <span className="text-[10px] font-bold">보상샵</span>
          </button>
          <button 
            onClick={() => setViewMode('profile')}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              viewMode === 'profile' ? "text-yellow-500" : "text-slate-400"
            )}
          >
            <User size={24} />
            <span className="text-[10px] font-bold">프로필</span>
          </button>
        </nav>
      )}

      {/* Custom Modal */}
      <AnimatePresence>
        {modal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-black text-slate-800 mb-2">{modal.title}</h3>
              <p className="text-slate-600 font-medium mb-6">{modal.message}</p>
              <div className="flex gap-3">
                {modal.type === 'confirm' && (
                  <button 
                    onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    취소
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (modal.onConfirm) modal.onConfirm();
                    setModal(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="flex-1 bg-yellow-400 text-slate-900 font-black py-3 rounded-xl hover:bg-yellow-500 transition-colors shadow-lg shadow-yellow-100"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChildDashboard({ 
  quests, 
  onToggle, 
  profile, 
  encouragement, 
  isLoadingAI,
  onRefreshAI 
}: { 
  quests: Quest[], 
  onToggle: (id: string) => void, 
  profile: UserProfile,
  encouragement: string,
  isLoadingAI: boolean,
  onRefreshAI: () => void
}) {
  const sortedQuests = useMemo(() => {
    return [...quests].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  }, [quests]);

  return (
    <div className="space-y-6">
      {/* Point Card */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl p-6 text-white shadow-xl shadow-orange-200 relative overflow-hidden"
      >
        <div className="relative z-10">
          <p className="text-orange-100 font-bold text-sm uppercase tracking-wider">현재 보유 포인트</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-5xl font-black tracking-tighter">{profile.totalPoints.toLocaleString()}</span>
            <span className="text-xl font-bold opacity-80">P</span>
          </div>
        </div>
        <Trophy className="absolute -right-4 -bottom-4 w-32 h-32 text-white/20 rotate-12" />
      </motion.div>

      {/* AI Encouragement */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex gap-4 items-start relative group">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
          <Sparkles size={20} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">오늘의 응원</p>
          <p className="text-slate-700 font-medium leading-relaxed">
            {isLoadingAI ? '응원 메시지를 생각 중이에요...' : encouragement}
          </p>
        </div>
        <button 
          onClick={onRefreshAI}
          className="p-1 text-slate-300 hover:text-blue-500 transition-colors"
        >
          <Sparkles size={16} />
        </button>
      </div>

      {/* Quest List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-black text-xl text-slate-800">오늘의 퀘스트</h2>
          <span className="text-xs font-bold text-slate-400">
            {quests.filter(q => q.completed).length} / {quests.length} 완료
          </span>
        </div>
        
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sortedQuests.map((quest) => (
              <motion.button
                key={quest.id}
                layout
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={() => onToggle(quest.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                  quest.completed 
                    ? "bg-slate-50 border-slate-100 opacity-60" 
                    : "bg-white border-white shadow-md hover:border-yellow-200 active:scale-95"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  quest.completed ? "bg-slate-200 text-slate-400" : CATEGORY_COLORS[quest.category] + " text-white"
                )}>
                  {getCategoryIcon(quest.category)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500",
                      !quest.completed && "bg-white/50"
                    )}>
                      {CATEGORY_LABELS[quest.category]}
                    </span>
                    <span className="text-xs font-bold text-orange-500">+{quest.points}P</span>
                  </div>
                  <h3 className={cn(
                    "font-bold text-slate-800 truncate",
                    quest.completed && "line-through text-slate-400"
                  )}>
                    {quest.title}
                  </h3>
                </div>

                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                  quest.completed ? "bg-green-500 text-white" : "border-2 border-slate-200 text-slate-200"
                )}>
                  {quest.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function RewardShop({ 
  rewards, 
  profile, 
  onPurchase 
}: { 
  rewards: Reward[], 
  profile: UserProfile, 
  onPurchase: (reward: Reward) => void 
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-black text-2xl text-slate-800">보상 상점</h2>
        <div className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-black flex items-center gap-1">
          <Star size={14} fill="currentColor" />
          {profile.totalPoints.toLocaleString()} P
        </div>
      </div>

      <div className="grid gap-4">
        {rewards.map((reward) => (
          <motion.div
            key={reward.id}
            whileHover={{ y: -2 }}
            className="bg-white border-2 border-slate-100 rounded-3xl p-5 shadow-sm flex gap-4 items-center"
          >
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-4xl shadow-inner">
              {reward.icon}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-800">{reward.title}</h3>
              <p className="text-xs text-slate-500 leading-tight mt-1">{reward.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-black text-orange-500">{reward.points.toLocaleString()} P</span>
              </div>
            </div>
            <button 
              onClick={() => onPurchase(reward)}
              disabled={profile.totalPoints < reward.points}
              className={cn(
                "px-4 py-2 rounded-xl font-black text-sm transition-all active:scale-95",
                profile.totalPoints >= reward.points 
                  ? "bg-yellow-400 text-slate-900 shadow-lg shadow-yellow-100" 
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}
            >
              구매
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ProfileView({ 
  profile, 
  rewards 
}: { 
  profile: UserProfile, 
  rewards: Reward[] 
}) {
  const inventoryItems = profile.inventory.map(id => rewards.find(r => r.id === id)).filter(Boolean) as Reward[];

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="relative inline-block">
          <div className="w-32 h-32 bg-yellow-400 rounded-[40px] flex items-center justify-center text-6xl shadow-xl mx-auto">
            {profile.avatar}
          </div>
          <button className="absolute -bottom-2 -right-2 w-10 h-10 bg-white border-2 border-slate-100 rounded-full flex items-center justify-center text-slate-400 shadow-md hover:text-yellow-500 transition-colors">
            <Camera size={20} />
          </button>
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-800">{profile.name}</h2>
          <p className="text-slate-400 font-bold">레벨 {profile.level} 모험가</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-100 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase">현재 포인트</p>
          <p className="text-xl font-black text-slate-800 mt-1">{profile.totalPoints.toLocaleString()}P</p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-100 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase">보유 보상</p>
          <p className="text-xl font-black text-slate-800 mt-1">{profile.inventory.length}개</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
          <Gift size={20} className="text-pink-500" />
          나의 보물함
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
            <p className="text-slate-400 text-sm font-medium">아직 획득한 보상이 없어요.<br/>상점에서 포인트를 사용해보세요!</p>
          </div>
        )}
      </div>

      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <h3 className="font-black text-lg flex items-center gap-2">
            <Sparkles size={20} className="text-yellow-400" />
            앱으로 설치하기
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            아이퀘스트를 스마트폰 홈 화면에 추가하면 진짜 앱처럼 편리하게 사용할 수 있어요!
          </p>
          
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-yellow-400 text-slate-900 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
              <p className="text-xs font-medium">
                <span className="text-yellow-400 font-bold">안드로이드:</span> 크롬 메뉴(⋮)에서 <span className="text-white font-bold">'앱 설치'</span> 또는 <span className="text-white font-bold">'홈 화면에 추가'</span>를 누르세요.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-pink-400 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
              <p className="text-xs font-medium">
                <span className="text-pink-400 font-bold">아이폰:</span> 사파리 공유 버튼(⎋)을 누른 후 <span className="text-white font-bold">'홈 화면에 추가'</span>를 누르세요.
              </p>
            </div>
          </div>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 rotate-12">
          <Smartphone size={96} />
        </div>
      </div>
    </div>
  );
}

function CalendarView({ history }: { history: HistoryRecord[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toDateString());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const historyByDate = useMemo(() => {
    const map: Record<string, { count: number, earnedPoints: number, spentPoints: number, records: HistoryRecord[] }> = {};
    history.forEach(record => {
      const dateStr = new Date(record.timestamp).toDateString();
      if (!map[dateStr]) {
        map[dateStr] = { count: 0, earnedPoints: 0, spentPoints: 0, records: [] };
      }
      map[dateStr].count += 1;
      if (record.points > 0) {
        map[dateStr].earnedPoints += record.points;
      } else {
        map[dateStr].spentPoints += Math.abs(record.points);
      }
      map[dateStr].records.push(record);
    });
    return map;
  }, [history]);

  const selectedDayData = selectedDate ? historyByDate[selectedDate] : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-black text-2xl text-slate-800">성장 기록</h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-600">
            <ChevronLeft size={20} />
          </button>
          <span className="font-black text-slate-700 min-w-[100px] text-center">
            {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
          </span>
          <button onClick={nextMonth} className="p-2 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-slate-600">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map(day => (
            <div key={day} className="text-center text-[10px] font-black text-slate-400 uppercase py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dateStr = date.toDateString();
            const data = historyByDate[dateStr];
            const isSelected = selectedDate === dateStr;
            const isToday = new Date().toDateString() === dateStr;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  "aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all",
                  isSelected ? "bg-yellow-400 text-slate-900 shadow-lg shadow-yellow-100" : "hover:bg-slate-50",
                  isToday && !isSelected && "border-2 border-yellow-200"
                )}
              >
                <span className={cn("text-xs font-bold", isSelected ? "text-slate-900" : "text-slate-600")}>
                  {day}
                </span>
                {data && (
                  <div className="flex gap-0.5 mt-0.5">
                    {Array.from({ length: Math.min(data.count, 3) }).map((_, idx) => (
                      <div key={idx} className={cn("w-1 h-1 rounded-full", isSelected ? "bg-slate-900" : "bg-yellow-400")} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details */}
      <AnimatePresence mode="wait">
        {selectedDate && (
          <motion.div
            key={selectedDate}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-black text-slate-800">
                {new Date(selectedDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}의 기록
              </h3>
              {selectedDayData && (
                <div className="flex gap-2">
                  {selectedDayData.earnedPoints > 0 && (
                    <span className="text-xs font-bold text-orange-500">+{selectedDayData.earnedPoints}P 획득</span>
                  )}
                  {selectedDayData.spentPoints > 0 && (
                    <span className="text-xs font-bold text-blue-500">-{selectedDayData.spentPoints}P 사용</span>
                  )}
                </div>
              )}
            </div>

            {selectedDayData ? (
              <div className="space-y-2">
                {selectedDayData.records.map((record) => (
                  <div key={record.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {record.type === 'reward' ? (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-blue-500">
                          <Gift size={16} />
                        </div>
                      ) : (
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", CATEGORY_COLORS[record.category || 'other'])}>
                          {getCategoryIcon(record.category || 'other', 16)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{record.title}</p>
                        <p className="text-[10px] font-bold text-slate-400">
                          {new Date(record.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className={cn("text-xs font-black", record.type === 'reward' ? "text-blue-500" : "text-orange-500")}>
                      {record.points > 0 ? '+' : ''}{record.points}P
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center">
                <p className="text-slate-400 text-sm font-medium">이날은 기록이 없어요.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ParentDashboard({ 
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
  onSelectChild
}: { 
  quests: Quest[], 
  onAdd: (title: string, points: number, category: QuestCategory) => void, 
  onDelete: (id: string) => void,
  onReset: () => void,
  onFullReset: () => void,
  onPointReset: () => void,
  profile: UserProfile,
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>,
  onExit: () => void,
  family: Family | null,
  childrenList: ChildProfile[],
  onAddChild: (name: string, avatar: string) => void,
  selectedChildId: string | null,
  onSelectChild: (id: string) => void
}) {
  const [newTitle, setNewTitle] = useState('');
  const [newPoints, setNewPoints] = useState<number | string>(10);
  const [newCategory, setNewCategory] = useState<QuestCategory>('homework');
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');

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

  return (
    <div className="space-y-6">
      {/* Top Header with Exit Button */}
      <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-yellow-400">
            <Settings size={20} />
          </div>
          <div>
            <h2 className="font-black text-slate-800">부모님 관리 모드</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parent Control Center</p>
          </div>
        </div>
        <button 
          onClick={onExit}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-all active:scale-95"
        >
          <LogOut size={16} />
          나가기
        </button>
      </div>

      {/* Family Info */}
      <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-black flex items-center gap-2">
              <Home size={24} className="text-blue-200" />
              {family?.name || '우리 가족'}
            </h2>
            <span className="text-[10px] font-black bg-blue-500/50 px-2 py-1 rounded-lg uppercase tracking-widest">Family Account</span>
          </div>
          <div className="bg-blue-700/50 rounded-2xl p-4 backdrop-blur-sm">
            <p className="text-[10px] font-bold text-blue-200 uppercase mb-1 tracking-wider">가족 초대 코드 (ID)</p>
            <div className="flex items-center justify-between">
              <code className="text-xl font-black tracking-widest font-mono">{family?.id}</code>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(family?.id || '');
                  alert('ID가 복사되었습니다!');
                }}
                className="flex items-center gap-1 text-xs bg-white text-blue-600 px-3 py-1.5 rounded-xl font-black shadow-sm hover:bg-blue-50 transition-colors"
              >
                <Plus size={14} className="rotate-45" />
                복사하기
              </button>
            </div>
          </div>
        </div>
        <Sparkles className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 rotate-12" />
      </div>

      {/* Child Management */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-blue-500 rounded-full" />
            <h3 className="font-black text-lg text-slate-800">아이 관리</h3>
          </div>
          <button 
            onClick={() => setIsAddingChild(!isAddingChild)}
            className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 hover:bg-blue-100 transition-colors"
          >
            <Plus size={14} />
            새 아이 등록
          </button>
        </div>

        {isAddingChild && (
          <motion.form 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleAddChild} 
            className="bg-slate-50 p-5 rounded-2xl space-y-4 border-2 border-blue-100"
          >
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">아이 이름</label>
              <input 
                type="text" 
                placeholder="예: 민수, 지혜"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-blue-400 bg-white font-bold transition-all"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-2 bg-blue-500 text-white font-black py-3 rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all">등록하기</button>
              <button type="button" onClick={() => setIsAddingChild(false)} className="flex-1 bg-white border-2 border-slate-200 text-slate-400 font-bold py-3 rounded-xl active:scale-95 transition-all">취소</button>
            </div>
          </motion.form>
        )}

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {childrenList.map(c => (
            <button
              key={c.id}
              onClick={() => onSelectChild(c.id)}
              className={cn(
                "flex-shrink-0 flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all active:scale-95",
                selectedChildId === c.id 
                  ? "border-blue-500 bg-blue-50 ring-4 ring-blue-50" 
                  : "border-slate-100 bg-white hover:border-slate-200"
              )}
            >
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner transition-transform",
                selectedChildId === c.id ? "scale-110" : ""
              )}>
                {c.avatar}
              </div>
              <span className={cn("text-xs font-black", selectedChildId === c.id ? "text-blue-600" : "text-slate-500")}>
                {c.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Child Settings */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-2xl">
              {profile.avatar}
            </div>
            <div>
              <h2 className="text-xl font-black">{profile.name} 관리</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Child Settings</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">아이 이름 수정</label>
              <input 
                type="text" 
                value={profile.name}
                onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-slate-800 border-none rounded-2xl px-4 py-3 mt-1 focus:ring-2 focus:ring-yellow-400 transition-all font-bold"
              />
            </div>
            
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">데이터 관리</p>
              <button 
                onClick={onReset}
                className="w-full bg-slate-800 hover:bg-slate-700 text-sm font-bold py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 border border-slate-700"
              >
                <CheckCircle2 size={18} className="text-yellow-400" />
                내일 퀘스트 준비 (체크 해제, 포인트 유지)
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={onPointReset}
                  className="flex-1 bg-red-900/20 text-red-400 hover:bg-red-900/40 text-xs font-bold py-4 rounded-2xl transition-all active:scale-95 border border-red-900/30"
                >
                  포인트만 0으로
                </button>
                <button 
                  onClick={onFullReset}
                  className="flex-1 bg-red-600 text-white hover:bg-red-700 text-xs font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-red-900/20"
                >
                  모든 데이터 초기화
                </button>
              </div>
            </div>
          </div>
        </div>
        <Lock className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 rotate-12" />
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
        <h3 className="font-black text-lg text-slate-800">새 퀘스트 추가</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="text" 
            placeholder="할 일을 입력하세요 (예: 수학 문제집 풀기)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-yellow-400 outline-none transition-all font-medium"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">포인트</label>
              <input 
                type="number" 
                value={newPoints}
                onChange={(e) => setNewPoints(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-yellow-400 outline-none transition-all font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">카테고리</label>
              <select 
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as QuestCategory)}
                className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-yellow-400 outline-none transition-all font-bold appearance-none bg-white"
              >
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black py-4 rounded-2xl shadow-lg shadow-yellow-100 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            퀘스트 등록하기
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="font-black text-lg text-slate-800">현재 퀘스트 목록</h3>
        <div className="space-y-2">
          {quests.map(q => (
            <div key={q.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", CATEGORY_COLORS[q.category])}>
                  {getCategoryIcon(q.category, 16)}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{q.title}</p>
                  <p className="text-[10px] font-bold text-orange-500">{q.points}P</p>
                </div>
              </div>
              <button 
                onClick={() => onDelete(q.id)}
                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getCategoryIcon(category: QuestCategory, size = 24) {
  switch (category) {
    case 'homework': return <BookOpen size={size} />;
    case 'chore': return <Heart size={size} />;
    case 'habit': return <Star size={size} />;
    default: return <Gamepad2 size={size} />;
  }
}

function FamilySetup({ onCreate, onJoin, onLogout }: { 
  onCreate: (name: string) => void, 
  onJoin: (code: string) => void,
  onLogout: () => void
}) {
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [mode, setMode] = useState<'initial' | 'create' | 'join'>('initial');

  return (
    <div className="min-h-screen bg-[#FDFCF0] flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 shadow-xl max-w-sm w-full text-center space-y-6">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <Home size={40} className="text-blue-500" />
        </div>
        
        {mode === 'initial' && (
          <>
            <div>
              <h1 className="text-2xl font-black text-slate-800">가족 설정</h1>
              <p className="text-slate-500 mt-2">새로운 가족을 만들거나<br/>기존 가족에 합류하세요.</p>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => setMode('create')}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-blue-100"
              >
                새 가족 만들기
              </button>
              <button 
                onClick={() => setMode('join')}
                className="w-full bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-4 rounded-2xl transition-colors"
              >
                초대 코드로 합류하기
              </button>
            </div>
          </>
        )}

        {mode === 'create' && (
          <>
            <div>
              <h1 className="text-2xl font-black text-slate-800">가족 이름</h1>
              <p className="text-slate-500 mt-2">가족의 이름을 정해주세요.</p>
            </div>
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="예: 우리집, 행복한가족"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-400 focus:outline-none"
            />
            <div className="space-y-3">
              <button 
                onClick={() => onCreate(familyName)}
                disabled={!familyName}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl transition-all disabled:opacity-50"
              >
                생성하기
              </button>
              <button 
                onClick={() => setMode('initial')}
                className="w-full text-slate-400 font-bold py-2"
              >
                뒤로가기
              </button>
            </div>
          </>
        )}

        {mode === 'join' && (
          <>
            <div>
              <h1 className="text-2xl font-black text-slate-800">초대 코드</h1>
              <p className="text-slate-500 mt-2">가족 ID를 입력해주세요.</p>
            </div>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="가족 ID 입력"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-400 focus:outline-none"
            />
            <div className="space-y-3">
              <button 
                onClick={() => onJoin(inviteCode)}
                disabled={!inviteCode}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl transition-all disabled:opacity-50"
              >
                합류하기
              </button>
              <button 
                onClick={() => setMode('initial')}
                className="w-full text-slate-400 font-bold py-2"
              >
                뒤로가기
              </button>
            </div>
          </>
        )}

        <button 
          onClick={onLogout}
          className="text-slate-400 text-sm font-bold hover:text-slate-600"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
