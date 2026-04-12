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
  Users,
  Star,
  ShoppingBag,
  Lock,
  Unlock,
  LogOut,
  Edit2,
  Calendar as CalendarIcon,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, writeBatch, addDoc, getDocFromServer } from 'firebase/firestore';
import { Quest, QuestCategory, UserProfile, Reward, HistoryRecord, CATEGORY_COLORS, CATEGORY_LABELS, UserAccount, Family, ChildProfile } from './types';
import { cn, getLevel, getProgressToNextLevel } from './lib/utils';
import { OperationType, handleFirestoreError } from './lib/firestoreError';
import { SOUNDS, playSound } from './lib/sound';
import { generateEncouragementText } from './lib/gemini';
import { CategoryIcon } from './components/CategoryIcon';
import { RewardShop } from './features/child/RewardShop';
import { ProfileView } from './features/child/ProfileView';
import { CalendarView } from './features/child/CalendarView';
import { FamilySetup } from './features/auth/FamilySetup';

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
  
  const exitParentMode = () => {
    setIsParentMode(false);
    setIsParentAuthenticated(false);
  };

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
        // Test connection to Firestore
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration. The client is offline.");
          }
        }

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
            setDoc(userRef, newAccount).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`);
            });
            setUserAccount(newAccount);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
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

    const familyId = userAccount.familyId;
    const familyRef = doc(db, 'families', familyId);
    const unsubFamily = onSnapshot(familyRef, (snap) => {
      if (snap.exists()) {
        setFamily({ id: snap.id, ...snap.data() } as Family);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `families/${familyId}`);
    });

    const childrenRef = collection(db, 'families', familyId, 'children');
    const unsubChildren = onSnapshot(childrenRef, (snap) => {
      const childList = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChildProfile));
      setChildren(childList);
      if (childList.length > 0 && !selectedChildId) {
        setSelectedChildId(childList[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `families/${familyId}/children`);
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
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `families/${familyId}/children/${childId}`);
    });

    const questsRef = collection(db, 'families', familyId, 'children', childId, 'quests');
    const unsubQuests = onSnapshot(questsRef, async (snapshot) => {
      if (snapshot.empty) {
        const batch = writeBatch(db);
        INITIAL_QUESTS.forEach(q => {
          const newDocRef = doc(questsRef);
          batch.set(newDocRef, { ...q, id: newDocRef.id });
        });
        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `families/${familyId}/children/${childId}/quests`);
        }
      } else {
        setQuests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Quest)));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `families/${familyId}/children/${childId}/quests`);
    });

    const historyRef = collection(db, 'families', familyId, 'children', childId, 'history');
    const unsubHistory = onSnapshot(historyRef, (snapshot) => {
      setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HistoryRecord)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `families/${familyId}/children/${childId}/history`);
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
      const childRef = doc(db, 'families', userAccount.familyId, 'children', selectedChildId);
      updateDoc(childRef, { level: newLevel }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, childRef.path);
      });
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
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/unauthorized-domain') {
        showAlert('로그인 실패', '이 도메인이 Firebase에 승인되지 않았습니다. Firebase Console의 Authentication > Settings > Authorized domains에 현재 URL을 추가해주세요.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        showAlert('로그인 취소', '로그인 팝업이 닫혔습니다. 다시 시도해주세요.');
      } else if (error.code === 'auth/web-storage-unsupported') {
        showAlert('로그인 실패', '브라우저 설정에서 서드파티 쿠키가 차단되어 있습니다. 설정에서 쿠키를 허용해주세요.');
      } else {
        showAlert('로그인 실패', `로그인 중 오류가 발생했습니다: ${error.message}`);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const toggleQuest = async (id: string) => {
    if (!user || !userAccount?.familyId || !selectedChildId) return;
    const quest = quests.find(q => q.id === id);
    if (!quest) return;

    const newCompleted = !quest.completed;
    const familyId = userAccount.familyId;
    const childId = selectedChildId;
    
    if (newCompleted) {
      playSound(SOUNDS.SUCCESS);
      const batch = writeBatch(db);
      
      // Update Quest
      batch.update(doc(db, 'families', familyId, 'children', childId, 'quests', id), { 
        completed: true, 
        completedAt: new Date().toISOString() 
      });
      
      // Update Profile Points
      batch.update(doc(db, 'families', familyId, 'children', childId), {
        totalPoints: profile.totalPoints + quest.points
      });
 
      // Add History
      const historyRef = doc(collection(db, 'families', familyId, 'children', childId, 'history'));
      batch.set(historyRef, {
        questId: quest.id,
        title: quest.title,
        points: quest.points,
        category: quest.category,
        timestamp: new Date().toISOString()
      });

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `families/${familyId}/children/${childId}`);
      }

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#FF4500']
      });
    } else {
      playSound(SOUNDS.CLICK);
      const batch = writeBatch(db);
      
      // Update Quest
      batch.update(doc(db, 'families', familyId, 'children', childId, 'quests', id), { 
        completed: false, 
        completedAt: null 
      });
      
      // Update Profile Points
      batch.update(doc(db, 'families', familyId, 'children', childId), {
        totalPoints: profile.totalPoints - quest.points
      });

      // Remove History (find today's record for this quest)
      const today = new Date().toDateString();
      const recordToDelete = history.find(h => 
        h.questId === quest.id && new Date(h.timestamp).toDateString() === today
      );
      if (recordToDelete) {
        batch.delete(doc(db, 'families', familyId, 'children', childId, 'history', recordToDelete.id));
      }

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `families/${familyId}/children/${childId}`);
      }
    }
  };

  const addQuest = async (title: string, points: number, category: QuestCategory) => {
    if (!userAccount?.familyId || !selectedChildId) return;
    try {
      await addDoc(collection(db, 'families', userAccount.familyId, 'children', selectedChildId, 'quests'), {
        title,
        points,
        category,
        completed: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `families/${userAccount.familyId}/children/${selectedChildId}/quests`);
    }
  };

  const deleteQuest = (id: string) => {
    if (!userAccount?.familyId || !selectedChildId) return;
    const quest = quests.find(q => q.id === id);
    if (!quest) return;
    showConfirm('퀘스트 삭제', `정말 '${quest.title}' 퀘스트를 삭제할까요?\n삭제하면 복구할 수 없습니다.`, async () => {
      try {
        await deleteDoc(doc(db, 'families', userAccount.familyId!, 'children', selectedChildId!, 'quests', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `families/${userAccount.familyId}/children/${selectedChildId}/quests/${id}`);
      }
    });
  };

  const purchaseReward = (reward: Reward) => {
    if (!userAccount?.familyId || !selectedChildId) return;
    if (profile.totalPoints < reward.points) {
      playSound(SOUNDS.ERROR);
      showAlert('포인트 부족', '포인트가 부족해요! 퀘스트를 더 완료해볼까요?');
      return;
    }
    
    playSound(SOUNDS.CLICK);
    showConfirm('보상 구매', `정말 '${reward.title}' 보상을 구매할까요?\n구매 시 ${reward.points}P가 차감되며, 이 작업은 되돌릴 수 없습니다.`, async () => {
      try {
        playSound(SOUNDS.CELEBRATE);
        const batch = writeBatch(db);
        const familyId = userAccount.familyId!;
        const childId = selectedChildId!;
        
        // Update Profile
        batch.update(doc(db, 'families', familyId, 'children', childId), {
          totalPoints: profile.totalPoints - reward.points,
          inventory: [...profile.inventory, reward.id]
        });

        // Add History Record
        const historyRef = doc(collection(db, 'families', familyId, 'children', childId, 'history'));
        batch.set(historyRef, {
          type: 'reward',
          rewardId: reward.id,
          title: reward.title,
          points: -reward.points,
          timestamp: new Date().toISOString()
        });

        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `families/${familyId}/children/${childId}`);
        }
        
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#3B82F6', '#60A5FA', '#93C5FD']
        });
      } catch (error) {
        console.error("Failed to purchase reward:", error);
        playSound(SOUNDS.ERROR);
      }
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
        handleFirestoreError(error, OperationType.WRITE, `families/${userAccount.familyId}/children/${selectedChildId}/quests`);
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
        handleFirestoreError(error, OperationType.WRITE, `families/${userAccount.familyId}/children/${selectedChildId}`);
      }
    });
  };

  const resetPoints = () => {
    if (!userAccount?.familyId || !selectedChildId) return;
    showConfirm('포인트 초기화', '정말 포인트를 0으로 초기화할까요?\n모아둔 모든 포인트가 사라지며 복구할 수 없습니다.', async () => {
      try {
        const profileRef = doc(db, 'families', userAccount.familyId, 'children', selectedChildId);
        await updateDoc(profileRef, { totalPoints: 0 });
        showAlert('초기화 완료', '포인트가 0으로 초기화되었습니다.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `families/${userAccount.familyId}/children/${selectedChildId}`);
      }
    });
  };

  const createFamily = async (name: string) => {
    if (!user) return;
    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const familyRef = doc(db, 'families', inviteCode); // Use inviteCode as ID for easier joining
      const newFamily: Family = {
        id: inviteCode,
        name,
        inviteCode,
        createdAt: new Date().toISOString(),
        members: { [user.uid]: 'parent' }
      };
      await setDoc(familyRef, newFamily);
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { familyId: inviteCode });
      showAlert('가족 생성 완료', `가족이 생성되었습니다! 초대 코드: ${inviteCode}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'families');
    }
  };

  const joinFamily = async (inviteCode: string) => {
    if (!user) return;
    
    const performJoin = async () => {
      try {
        const familyRef = doc(db, 'families', inviteCode);
        const snap = await getDoc(familyRef);
        if (snap.exists()) {
          const familyData = snap.data() as Family;
          await updateDoc(familyRef, {
            [`members.${user.uid}`]: 'parent'
          });
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { familyId: inviteCode });
          showAlert('가족 합류 완료', `${familyData.name} 가족에 합류했습니다!`);
        } else {
          showAlert('오류', '해당 코드를 가진 가족을 찾을 수 없습니다.');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `families/${inviteCode}`);
      }
    };

    if (userAccount?.familyId) {
      showConfirm(
        '가족 이동 안내', 
        '새로운 가족에 합류하면 기존 가족의 정보는 더 이상 보이지 않게 됩니다. 계속할까요?', 
        performJoin
      );
    } else {
      performJoin();
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
      handleFirestoreError(error, OperationType.CREATE, `families/${userAccount.familyId}/children`);
    }
  };

  const deleteChild = async (childId: string, childName: string) => {
    if (!userAccount?.familyId) return;
    
    const performDelete = async () => {
      try {
        const childRef = doc(db, 'families', userAccount.familyId!, 'children', childId);
        await deleteDoc(childRef);
        if (selectedChildId === childId) {
          setSelectedChildId(null);
        }
        showAlert('삭제 완료', `${childName} 아이의 정보가 삭제되었습니다.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `families/${userAccount.familyId}/children/${childId}`);
      }
    };

    showConfirm(
      '아이 삭제 확인',
      `${childName} 아이의 모든 데이터(포인트, 퀘스트 등)가 영구적으로 삭제됩니다. 정말 삭제할까요?`,
      performDelete
    );
  };

  const generateEncouragement = async () => {
    setIsLoadingAI(true);
    const text = await generateEncouragementText(
      quests.filter(q => q.completed).map(q => q.title)
    );
    if (text) setEncouragement(text);
    setIsLoadingAI(false);
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
      <div className="min-h-screen flex bg-white font-sans overflow-hidden">
        {/* Left Side: Premium Brand Visual */}
        <div className="hidden lg:flex lg:w-3/5 relative bg-[#0F172A] items-center justify-center p-12 overflow-hidden">
          {/* Subtle Grid Pattern */}
          <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          
          <div className="relative z-10 w-full max-w-2xl space-y-12">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-black uppercase tracking-[0.2em]">
                <Sparkles size={14} />
                <span>Premium Family Experience</span>
              </div>
              <h1 className="text-7xl font-display font-black text-white leading-[0.9] tracking-tighter">
                Adventure <br />
                Is A <span className="text-yellow-400 underline decoration-4 underline-offset-8">Habit.</span>
              </h1>
              <p className="text-xl text-slate-400 font-medium max-w-lg leading-relaxed">
                아이들의 성취를 기록하고, 가족의 유대감을 강화하세요. <br />
                가장 진보된 패밀리 퀘스트 플랫폼, KidQuest.
              </p>
            </motion.div>

            {/* App Mockup Preview */}
            <motion.div 
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-yellow-400/20 blur-3xl rounded-full"></div>
              <div className="relative bg-slate-800 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden aspect-[16/10] flex items-center justify-center p-8">
                <div className="w-full h-full bg-slate-900 rounded-2xl border border-white/5 p-6 space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="w-24 h-4 bg-slate-800 rounded-full"></div>
                    <div className="w-8 h-8 bg-yellow-400 rounded-lg"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-32 bg-slate-800 rounded-2xl animate-pulse"></div>
                    <div className="h-32 bg-slate-800 rounded-2xl animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <div className="h-20 bg-slate-800 rounded-2xl animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Floating Accents */}
          <motion.div 
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-20 right-20 text-yellow-500/10"
          >
            <Trophy size={200} />
          </motion.div>
        </div>

        {/* Right Side: Clean Login Interface */}
        <div className="w-full lg:w-2/5 flex flex-col justify-between p-8 md:p-20 bg-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-xl shadow-yellow-400/20">
                <Trophy size={28} className="text-slate-900" />
              </div>
              <span className="text-3xl font-display font-black tracking-tight text-slate-900">KidQuest</span>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-12"
          >
            <div className="space-y-4">
              <h2 className="text-5xl font-display font-black text-slate-900 leading-tight">
                Welcome <br /> Back.
              </h2>
              <p className="text-slate-500 text-lg font-medium">
                가족의 모험을 계속하려면 로그인해 주세요.
              </p>
            </div>

            <div className="space-y-6">
              <button 
                onClick={() => {
                  playSound(SOUNDS.CLICK);
                  handleLogin();
                }}
                className="w-full group relative flex items-center justify-center gap-4 bg-slate-900 text-white font-black py-6 px-8 rounded-2xl transition-all hover:bg-slate-800 active:scale-[0.98] shadow-2xl shadow-slate-200"
              >
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center p-1">
                  <svg viewBox="0 0 24 24" className="w-full h-full">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </div>
                <span className="text-xl">Google 계정으로 계속하기</span>
              </button>

              <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1 bg-slate-100"></div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Secure Authentication</span>
                <div className="h-px flex-1 bg-slate-100"></div>
              </div>
            </div>
          </motion.div>

          <footer className="space-y-6">
            <div className="h-px bg-slate-100 w-full"></div>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>© 2024 KidQuest Platform</span>
              <div className="flex gap-6">
                <span className="hover:text-slate-600 cursor-pointer transition-colors">Terms of Service</span>
                <span className="hover:text-slate-600 cursor-pointer transition-colors">Privacy Policy</span>
              </div>
            </div>
          </footer>
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

  return (
    <div className="min-h-screen bg-[#FDFCF0] font-sans text-slate-900 pb-24 md:pb-0 md:pl-24">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-30 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <button 
              onClick={() => {
                playSound(SOUNDS.CLICK);
                setIsParentMode(true);
              }}
              className="w-10 h-10 md:w-14 md:h-14 bg-yellow-400 rounded-2xl flex items-center justify-center text-xl md:text-3xl shadow-inner cursor-pointer hover:scale-105 transition-transform"
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
                onChange={(e) => {
                  playSound(SOUNDS.CLICK);
                  setSelectedChildId(e.target.value);
                }}
                className="font-black text-base md:text-xl leading-tight bg-transparent border-none focus:ring-0 p-0 cursor-pointer appearance-none"
              >
                {children.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronRight size={16} className="text-slate-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] md:text-xs font-black bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">Lv.{profile.level}</span>
              <div className="w-16 md:w-32 h-1.5 md:h-2 bg-slate-100 rounded-full overflow-hidden">
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
              onClick={() => {
                playSound(SOUNDS.CLICK);
                setIsParentMode(true);
              }}
              className="p-2 md:p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              title="부모님 관리"
            >
              <Settings size={20} className="md:w-6 md:h-6" />
            </button>
          )}
          <button 
            onClick={() => {
              playSound(SOUNDS.CLICK);
              handleLogout();
            }}
            className="p-2 md:p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            title="로그아웃"
          >
            <LogOut size={20} className="md:w-6 md:h-6" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-10">
        {isParentMode ? (
          !isParentAuthenticated ? (
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-slate-100 text-center space-y-8 max-w-sm w-full">
                <div className="w-20 h-20 bg-yellow-50 rounded-[2rem] flex items-center justify-center mx-auto text-yellow-500 shadow-inner">
                  <Lock size={40} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black tracking-tight">부모님 확인</h2>
                  <p className="text-slate-500 text-sm font-bold">퀘스트를 관리하려면 비밀번호를 입력하세요.<br/>(기본: 1234)</p>
                </div>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (parentPassword === '1234') {
                      playSound(SOUNDS.SUCCESS);
                      setIsParentAuthenticated(true);
                      setParentPassword('');
                    } else {
                      playSound(SOUNDS.ERROR);
                      showAlert('인증 실패', '비밀번호가 틀렸어요! (힌트: 1234)');
                    }
                  }} 
                  className="space-y-6"
                >
                  <input 
                    type="password" 
                    placeholder="••••"
                    maxLength={4}
                    value={parentPassword}
                    onChange={(e) => setParentPassword(e.target.value)}
                    className="w-full border-2 border-slate-100 rounded-2xl px-4 py-4 text-center text-3xl tracking-[1em] outline-none focus:border-yellow-400 transition-all bg-slate-50/50 font-black"
                  />
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => {
                        playSound(SOUNDS.CLICK);
                        setIsParentMode(false);
                      }}
                      className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl active:scale-95 transition-all"
                    >
                      취소
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 bg-yellow-400 text-slate-900 font-black py-4 rounded-2xl shadow-lg shadow-yellow-100 active:scale-95 transition-all"
                    >
                      확인
                    </button>
                  </div>
                </form>
              </div>
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
              setProfile={async (p: any) => {
                if (typeof p === 'function') {
                  const newP = p(profile);
                  if (userAccount?.familyId && selectedChildId) {
                    try {
                      await updateDoc(doc(db, 'families', userAccount.familyId, 'children', selectedChildId), { name: newP.name });
                    } catch (error) {
                      handleFirestoreError(error, OperationType.UPDATE, `families/${userAccount.familyId}/children/${selectedChildId}`);
                    }
                  }
                }
              }}
              onExit={() => {
                playSound(SOUNDS.CLICK);
                exitParentMode();
              }}
              family={family}
              childrenList={children}
              onAddChild={addChild}
              onDeleteChild={deleteChild}
              selectedChildId={selectedChildId}
              onSelectChild={setSelectedChildId}
              onJoinFamily={joinFamily}
              showAlert={showAlert}
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
                  onToggle={(id) => {
                    playSound(SOUNDS.CLICK);
                    toggleQuest(id);
                  }} 
                  profile={profile}
                  encouragement={encouragement}
                  isLoadingAI={isLoadingAI}
                  onRefreshAI={() => {
                    playSound(SOUNDS.CLICK);
                    generateEncouragement();
                  }}
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
                  onPurchase={(reward) => {
                    playSound(SOUNDS.CLICK);
                    purchaseReward(reward);
                  }} 
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

      {/* Navigation */}
      {!isParentMode && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex justify-around items-center z-40 md:top-0 md:bottom-0 md:left-0 md:w-24 md:flex-col md:border-t-0 md:border-r md:py-12 md:justify-center md:gap-12">
          <button 
            onClick={() => {
              playSound(SOUNDS.CLICK);
              setViewMode('quests');
            }}
            className={cn(
              "flex flex-col items-center gap-1 transition-all hover:scale-110",
              viewMode === 'quests' ? "text-yellow-500" : "text-slate-400"
            )}
          >
            <Trophy size={28} className="md:w-8 md:h-8" />
            <span className="text-[10px] md:text-xs font-black">퀘스트</span>
          </button>
          <button 
            onClick={() => {
              playSound(SOUNDS.CLICK);
              setViewMode('calendar');
            }}
            className={cn(
              "flex flex-col items-center gap-1 transition-all hover:scale-110",
              viewMode === 'calendar' ? "text-yellow-500" : "text-slate-400"
            )}
          >
            <CalendarIcon size={28} className="md:w-8 md:h-8" />
            <span className="text-[10px] md:text-xs font-black">기록</span>
          </button>
          <button 
            onClick={() => {
              playSound(SOUNDS.CLICK);
              setViewMode('shop');
            }}
            className={cn(
              "flex flex-col items-center gap-1 transition-all hover:scale-110",
              viewMode === 'shop' ? "text-yellow-500" : "text-slate-400"
            )}
          >
            <ShoppingBag size={28} className="md:w-8 md:h-8" />
            <span className="text-[10px] md:text-xs font-black">보상샵</span>
          </button>
          <button 
            onClick={() => {
              playSound(SOUNDS.CLICK);
              setViewMode('profile');
            }}
            className={cn(
              "flex flex-col items-center gap-1 transition-all hover:scale-110",
              viewMode === 'profile' ? "text-yellow-500" : "text-slate-400"
            )}
          >
            <User size={28} className="md:w-8 md:h-8" />
            <span className="text-[10px] md:text-xs font-black">프로필</span>
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
                  <CategoryIcon category={quest.category} />
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

