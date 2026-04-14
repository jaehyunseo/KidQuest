/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import {
  Trophy,
  Settings,
  User,
  Sparkles,
  ShoppingBag,
  Lock,
  LogOut,
  Calendar as CalendarIcon,
  Camera,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, deleteDoc, getDoc, writeBatch, addDoc } from 'firebase/firestore';
import type { Quest, QuestCategory, UserProfile, Reward, ChildProfile, Family } from './types';
import { cn, getLevel, getProgressToNextLevel } from './lib/utils';
import { OperationType, handleFirestoreError } from './lib/firestoreError';
import { useAuth } from './hooks/useAuth';
import { useFamily } from './hooks/useFamily';
import { useChildData } from './hooks/useChildData';
import { useRewards } from './hooks/useRewards';
import { useCategories } from './hooks/useCategories';
import { useFeed } from './hooks/useFeed';
import { loadReminderSettings, startReminderLoop } from './lib/reminders';

// Heavy screens are lazy-loaded to keep the initial bundle small.
const FeedView = lazy(() =>
  import('./features/feed/FeedView').then((m) => ({ default: m.FeedView }))
);
const LazyParentDashboard = lazy(() =>
  import('./features/parent/ParentDashboard').then((m) => ({ default: m.ParentDashboard }))
);
const LazyCalendarView = lazy(() =>
  import('./features/child/CalendarView').then((m) => ({ default: m.CalendarView }))
);
import { uploadChildAvatar, deleteChildAvatar } from './lib/storage';
import { sha256, saltedHash, randomSalt } from './lib/hash';
import {
  evaluateNewBadges,
  localDateKey,
  nextStreak,
} from './lib/achievements';
import { PrivacyConsentModal, type ConsentResult } from './features/auth/PrivacyConsentModal';
import { CURRENT_CONSENT_VERSION } from './features/auth/consent';
import { SOUNDS, playSound } from './lib/sound';
import { generateEncouragementText } from './lib/gemini';
import { CategoryIcon } from './components/CategoryIcon';
import { Avatar } from './components/Avatar';
import { ChildSwitcher } from './components/ChildSwitcher';
import { BadgeUnlockModal } from './components/BadgeUnlockModal';
import { RewardShop } from './features/child/RewardShop';
import { ProfileView } from './features/child/ProfileView';
import { FamilySetup } from './features/auth/FamilySetup';
import { ChildDashboard } from './features/child/ChildDashboard';

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

type ViewMode = 'quests' | 'shop' | 'profile' | 'calendar' | 'feed';

type ModalConfig = {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'alert' | 'confirm';
  onConfirm?: () => void;
};

export default function App() {
  const { user, userAccount, isAuthReady } = useAuth();
  const { family, children, selectedChildId, setSelectedChildId } = useFamily(userAccount);
  const { profile, setProfile, quests, history } = useChildData(userAccount?.familyId, selectedChildId);
  const rewards = useRewards(userAccount?.familyId);
  const customCategories = useCategories(userAccount?.familyId);
  const { posts: feedPosts, loading: feedLoading } = useFeed(userAccount?.familyId);

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

  const [encouragement, setEncouragement] = useState<string>('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dayKey, setDayKey] = useState<string>(localDateKey());
  const [unlockQueue, setUnlockQueue] = useState<string[]>([]);

  // Track the current local day. Bumps on visibility change (returning
  // to the tab the next morning) and on a 1-minute interval (for tabs
  // left open through midnight). Downstream effects depend on `dayKey`
  // to auto-reset completed quests when the day rolls over.
  useEffect(() => {
    const tick = () => {
      const k = localDateKey();
      setDayKey((prev) => (prev === k ? prev : k));
    };
    const interval = setInterval(tick, 60 * 1000);
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', tick);
    };
  }, []);

  // Daily reminder loop — fires local notifications at the configured
  // morning/evening hours when the tab is active. Settings persist in
  // localStorage; see src/lib/reminders.ts.
  useEffect(() => {
    const childName = profile?.name || '우리 아이';
    const cleanup = startReminderLoop(
      () => loadReminderSettings(),
      (kind) =>
        kind === 'morning'
          ? {
              title: '🌅 좋은 아침이에요!',
              body: `${childName}와 오늘의 미션을 함께 시작해볼까요?`,
            }
          : {
              title: '🌙 하루를 마무리할 시간',
              body: `${childName}의 오늘을 함께 되돌아보고 미션을 체크해주세요.`,
            }
    );
    return cleanup;
  }, [profile?.name]);

  // Migration: seed default rewards for pre-existing families.
  //
  // Before the Reward CRUD round, rewards were a hardcoded client-side
  // array. Now they live in Firestore at families/{id}/rewards and are
  // seeded inside createFamily. Families created BEFORE that change have
  // an empty rewards collection and show nothing in the shop.
  //
  // This effect waits for the first rewards snapshot to settle, then
  // seeds INITIAL_REWARDS if the collection is still empty. A
  // `rewardsSeeded` flag on the family doc makes it idempotent — once
  // set, we never seed again even if the user deletes all their rewards.
  const rewardsSeedAttemptedRef = useRef(false);
  useEffect(() => {
    if (!userAccount?.familyId || !family) return;
    if (family.rewardsSeeded) return;            // already done in a prior session
    if (rewardsSeedAttemptedRef.current) return; // already attempted this session
    // Wait ~1.2s for the useRewards snapshot to arrive
    const timer = setTimeout(async () => {
      rewardsSeedAttemptedRef.current = true;
      const familyId = userAccount.familyId!;
      try {
        if (rewards.length === 0) {
          const rewardsRef = collection(db, 'families', familyId, 'rewards');
          for (const r of INITIAL_REWARDS) {
            const { id: _id, ...rest } = r;
            await addDoc(rewardsRef, rest);
          }
          console.info('[migration] seeded default rewards for', familyId);
        }
        // Mark flag whether we seeded or just found existing rewards
        await updateDoc(doc(db, 'families', familyId), { rewardsSeeded: true });
      } catch (err) {
        console.warn('[migration] failed to seed default rewards:', err);
      }
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAccount?.familyId, family?.rewardsSeeded]);

  // Auto-reset quest checks when the local day rolls over.
  // A quest is "stale" if it's marked completed but `completedAt` is before
  // today's local date. We uncheck it WITHOUT subtracting points (yesterday's
  // effort stays earned). Runs when `dayKey`, `quests`, or `selectedChildId`
  // changes, so it fires both on mount and whenever midnight passes.
  useEffect(() => {
    if (!userAccount?.familyId || !selectedChildId || quests.length === 0) return;
    const staleQuests = quests.filter((q) => {
      if (!q.completed || !q.completedAt) return false;
      return localDateKey(new Date(q.completedAt)) < dayKey;
    });
    if (staleQuests.length === 0) return;
    const run = async () => {
      const batch = writeBatch(db);
      staleQuests.forEach((q) => {
        batch.update(
          doc(db, 'families', userAccount.familyId!, 'children', selectedChildId, 'quests', q.id),
          { completed: false, completedAt: null }
        );
      });
      try {
        await batch.commit();
      } catch (error) {
        console.warn('[auto-reset] failed to uncheck stale quests', error);
      }
    };
    void run();
  }, [dayKey, quests, userAccount?.familyId, selectedChildId]);

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

  // Post-login consent check: if the user doc lacks a valid consentVersion,
  // force the blocking consent modal to open. This handles both first-time
  // sign-ups and existing users who need to re-consent after a policy bump.
  const needsConsent =
    !!userAccount &&
    (userAccount.consentVersion === undefined ||
      userAccount.consentVersion < CURRENT_CONSENT_VERSION);

  useEffect(() => {
    if (needsConsent) setConsentOpen(true);
    else setConsentOpen(false);
  }, [needsConsent]);

  // Onboarding banner: pending if createFamily set it OR if user has a family
  // but no children yet (edge case where default child creation failed)
  useEffect(() => {
    if (!user) {
      setShowOnboarding(false);
      return;
    }
    try {
      const flag = localStorage.getItem(`kidquest_onboarding_${user.uid}`);
      if (flag === 'pending') {
        setShowOnboarding(true);
      }
    } catch {}
  }, [user]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    if (user) {
      try {
        localStorage.removeItem(`kidquest_onboarding_${user.uid}`);
      } catch {}
    }
  };


  const handleLoginClick = () => {
    void doSignIn();
  };

  const handleConsentAgree = async (consent: ConsentResult) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        consentedAt: new Date().toISOString(),
        consentVersion: CURRENT_CONSENT_VERSION,
        consentPrivacy: consent.privacy,
        consentTerms: consent.terms,
        consentAge: consent.age,
        consentMarketing: consent.marketing,
      });
      setConsentOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleConsentReject = async () => {
    setConsentOpen(false);
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const doSignIn = async () => {
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

      // Streak bookkeeping
      const today = localDateKey();
      const { streak: newStreak, touched } = nextStreak(
        profile.streak,
        profile.lastCompletedDate,
        today
      );
      const longest = Math.max(profile.longestStreak ?? 0, newStreak);
      const newTotalCompleted = (profile.totalCompleted ?? 0) + 1;
      const newTotalPoints = profile.totalPoints + quest.points;

      // Evaluate newly-unlocked achievements against the *post-update* stats
      const already = profile.achievements ?? [];
      const newBadges = evaluateNewBadges(
        {
          totalCompleted: newTotalCompleted,
          streak: newStreak,
          longestStreak: longest,
          rewardsRedeemed: profile.inventory.length,
          totalPoints: newTotalPoints,
        },
        already
      );
      const mergedAchievements = newBadges.length
        ? [...already, ...newBadges]
        : already;

      // Update Quest
      batch.update(doc(db, 'families', familyId, 'children', childId, 'quests', id), {
        completed: true,
        completedAt: new Date().toISOString()
      });

      // Update Profile: points + streak + achievements
      batch.update(doc(db, 'families', familyId, 'children', childId), {
        totalPoints: newTotalPoints,
        totalCompleted: newTotalCompleted,
        streak: newStreak,
        longestStreak: longest,
        lastCompletedDate: touched ? today : (profile.lastCompletedDate ?? today),
        achievements: mergedAchievements,
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

      // Celebrate newly-unlocked badges via the dedicated modal queue
      if (newBadges.length) {
        setTimeout(() => {
          confetti({
            particleCount: 200,
            spread: 120,
            origin: { y: 0.5 },
            colors: ['#FFD700', '#FF69B4', '#8B5CF6', '#3B82F6'],
          });
          setUnlockQueue((q) => [...q, ...newBadges]);
        }, 400);
      }
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
    showConfirm('미션 삭제', `정말 '${quest.title}' 미션을 삭제할까요?\n삭제하면 복구할 수 없습니다.`, async () => {
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
      showAlert('성장 포인트 부족', '포인트가 부족해요! 미션을 더 지켜볼까요?');
      return;
    }
    
    playSound(SOUNDS.CLICK);
    showConfirm('보상 받기', `정말 '${reward.title}' 보상을 받을까요?\n${reward.points}P가 사용되며, 이 작업은 되돌릴 수 없습니다.`, async () => {
      try {
        playSound(SOUNDS.CELEBRATE);
        const batch = writeBatch(db);
        const familyId = userAccount.familyId!;
        const childId = selectedChildId!;
        
        // Evaluate badges for reward redemption path
        const newInventory = [...profile.inventory, reward.id];
        const newRedeemedCount = newInventory.length;
        const already = profile.achievements ?? [];
        const newBadges = evaluateNewBadges(
          {
            totalCompleted: profile.totalCompleted ?? 0,
            streak: profile.streak ?? 0,
            longestStreak: profile.longestStreak ?? 0,
            rewardsRedeemed: newRedeemedCount,
            totalPoints: profile.totalPoints - reward.points,
          },
          already
        );
        const mergedAchievements = newBadges.length ? [...already, ...newBadges] : already;

        // Update Profile
        batch.update(doc(db, 'families', familyId, 'children', childId), {
          totalPoints: profile.totalPoints - reward.points,
          inventory: newInventory,
          achievements: mergedAchievements,
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

        if (newBadges.length) {
          setTimeout(() => {
            setUnlockQueue((q) => [...q, ...newBadges]);
          }, 500);
        }
      } catch (error) {
        console.error("Failed to purchase reward:", error);
        playSound(SOUNDS.ERROR);
      }
    });
  };

  const resetDaily = () => {
    if (!userAccount?.familyId || !selectedChildId) return;
    showConfirm('내일 다시 시작', '내일을 위해 오늘의 미션 체크만 해제할까요? (모은 성장 포인트는 유지됩니다)', async () => {
      try {
        const batch = writeBatch(db);
        quests.forEach(q => {
          batch.update(doc(db, 'families', userAccount.familyId!, 'children', selectedChildId!, 'quests', q.id), { completed: false, completedAt: null });
        });
        await batch.commit();
        showAlert('준비 완료', '내일을 위한 새로운 시작이에요. 우리 아이를 응원해주세요!');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `families/${userAccount.familyId}/children/${selectedChildId}/quests`);
      }
    });
  };

  const fullReset = () => {
    if (!userAccount?.familyId || !selectedChildId) return;
    showConfirm('전체 초기화', '정말 모든 데이터를 초기화할까요? (포인트, 기록, 받은 보상 모두 삭제되며 복구할 수 없습니다)', async () => {
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
      const salt = randomSalt();
      const defaultPasswordHash = await saltedHash('1234', salt);
      const newFamily: Family = {
        id: inviteCode,
        name,
        inviteCode,
        createdAt: new Date().toISOString(),
        members: { [user.uid]: 'parent' },
      };
      await setDoc(familyRef, newFamily);
      // Parent password hash + salt live in a parent-only private subdoc
      // so they are NOT exposed via the join-by-invite-code read of the
      // family doc. Salt makes the hash resistant to rainbow tables.
      try {
        await setDoc(
          doc(db, 'families', inviteCode, 'private', 'config'),
          {
            parentPasswordHash: defaultPasswordHash,
            parentPasswordSalt: salt,
            updatedAt: new Date().toISOString(),
          }
        );
      } catch (secretErr) {
        console.warn('Failed to seed private config:', secretErr);
      }
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { familyId: inviteCode });

      // Auto-create a default child so the parent dashboard isn't empty on first entry.
      try {
        const childrenRef = collection(db, 'families', inviteCode, 'children');
        await addDoc(childrenRef, {
          name: '우리 아이',
          avatar: '🦁',
          totalPoints: 0,
          level: 1,
          inventory: [],
        } as Omit<ChildProfile, 'id'>);
      } catch (childErr) {
        console.warn('Failed to create default child:', childErr);
      }

      // Seed default rewards so the shop isn't empty
      try {
        const rewardsRef = collection(db, 'families', inviteCode, 'rewards');
        for (const r of INITIAL_REWARDS) {
          const { id: _id, ...rest } = r;
          await addDoc(rewardsRef, rest);
        }
      } catch (rewardErr) {
        console.warn('Failed to seed default rewards:', rewardErr);
      }

      // Trigger onboarding banner for first-time parents
      try {
        localStorage.setItem(`kidquest_onboarding_${user.uid}`, 'pending');
      } catch {}
      setShowOnboarding(true);

      showAlert('가족 생성 완료', `가족이 생성되었습니다! 초대 코드: ${inviteCode}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'families');
    }
  };

  const uploadChildPhoto = async (file: File) => {
    if (!userAccount?.familyId || !selectedChildId) return;
    const familyId = userAccount.familyId;
    const childId = selectedChildId;
    const previousUrl = profile.avatarUrl;
    const url = await uploadChildAvatar(familyId, childId, file);
    setProfile((p: UserProfile) => ({ ...p, avatarUrl: url }));
    try {
      await updateDoc(doc(db, 'families', familyId, 'children', childId), { avatarUrl: url });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `families/${familyId}/children/${childId}`
      );
    }
    if (previousUrl && previousUrl !== url) {
      deleteChildAvatar(previousUrl).catch(() => {});
    }
  };

  const removeChildPhoto = async () => {
    if (!userAccount?.familyId || !selectedChildId) return;
    const familyId = userAccount.familyId;
    const childId = selectedChildId;
    const previousUrl = profile.avatarUrl;
    setProfile((p: UserProfile) => ({ ...p, avatarUrl: undefined }));
    try {
      await updateDoc(doc(db, 'families', familyId, 'children', childId), { avatarUrl: null });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `families/${familyId}/children/${childId}`
      );
    }
    if (previousUrl) {
      deleteChildAvatar(previousUrl).catch(() => {});
    }
  };

  // ===== Reward CRUD =====
  const addReward = async (data: Omit<Reward, 'id'>) => {
    if (!userAccount?.familyId) return;
    try {
      await addDoc(collection(db, 'families', userAccount.familyId, 'rewards'), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `families/${userAccount.familyId}/rewards`);
    }
  };

  const updateReward = async (id: string, updates: Partial<Omit<Reward, 'id'>>) => {
    if (!userAccount?.familyId) return;
    try {
      await updateDoc(doc(db, 'families', userAccount.familyId, 'rewards', id), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `families/${userAccount.familyId}/rewards/${id}`);
    }
  };

  const deleteReward = async (id: string) => {
    if (!userAccount?.familyId) return;
    try {
      await deleteDoc(doc(db, 'families', userAccount.familyId, 'rewards', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `families/${userAccount.familyId}/rewards/${id}`);
    }
  };

  // ===== Custom Category CRUD =====
  const addCustomCategory = async (data: { label: string; color: string; icon: string }) => {
    if (!userAccount?.familyId) return;
    try {
      await addDoc(collection(db, 'families', userAccount.familyId, 'categories'), {
        ...data,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `families/${userAccount.familyId}/categories`);
    }
  };

  const deleteCustomCategory = async (id: string) => {
    if (!userAccount?.familyId) return;
    try {
      await deleteDoc(doc(db, 'families', userAccount.familyId, 'categories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `families/${userAccount.familyId}/categories/${id}`);
    }
  };

  // ===== Parent Password =====
  // Hash + salt are stored in families/{id}/private/config, readable only
  // by parents. Legacy families without a salt fall back to unsalted sha256.
  const verifyParentPassword = async (input: string): Promise<boolean> => {
    if (!userAccount?.familyId) return false;
    try {
      const snap = await getDoc(doc(db, 'families', userAccount.familyId, 'private', 'config'));
      const data = snap.exists() ? (snap.data() as any) : null;
      const stored = data?.parentPasswordHash as string | undefined;
      const salt = data?.parentPasswordSalt as string | undefined;
      if (!stored) {
        // Unseeded — fall back to default '1234' via unsalted sha256.
        const defaultHash = await sha256('1234');
        return (await sha256(input)) === defaultHash;
      }
      if (salt) {
        return (await saltedHash(input, salt)) === stored;
      }
      // Legacy pre-salt hash
      return (await sha256(input)) === stored;
    } catch {
      return false;
    }
  };

  const changeParentPassword = async (
    current: string,
    next: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!userAccount?.familyId || !family) return { ok: false, error: '가족 정보를 찾을 수 없어요' };
    const ok = await verifyParentPassword(current);
    if (!ok) return { ok: false, error: '현재 비밀번호가 올바르지 않아요' };
    try {
      const salt = randomSalt();
      const nextHash = await saltedHash(next, salt);
      await setDoc(
        doc(db, 'families', userAccount.familyId, 'private', 'config'),
        {
          parentPasswordHash: nextHash,
          parentPasswordSalt: salt,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return { ok: true };
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `families/${userAccount.familyId}/private/config`);
      return { ok: false, error: error?.message || '저장 중 오류가 발생했어요' };
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
      `${childName} 아이의 모든 기록(미션, 성장 포인트, 일기 등)이 영구적으로 삭제됩니다. 정말 삭제할까요?`,
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
                부모와 아이가 함께 약속을 세우고 매일 실천하며,
                작은 성취를 평생의 힘으로 키워가는 가족 습관 동반자, 아이퀘스트.
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
                  handleLoginClick();
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

  if (!userAccount) {
    return (
      <div className="min-h-screen bg-[#FDFCF0] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  if (!userAccount.familyId) {
    return (
      <>
        <FamilySetup
          onCreate={createFamily}
          onJoin={joinFamily}
          onLogout={handleLogout}
        />
        <PrivacyConsentModal
          open={consentOpen}
          onClose={handleConsentReject}
          onAgree={handleConsentAgree}
          blocking
        />
      </>
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
              className="w-10 h-10 md:w-14 md:h-14 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-inner cursor-pointer hover:scale-105 transition-transform overflow-hidden"
            >
              <Avatar emoji={profile.avatar} url={profile.avatarUrl} size={56} className="rounded-2xl" />
            </button>
            {children.length > 1 && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">
                {children.length}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <ChildSwitcher
              childrenList={children}
              selectedId={selectedChildId}
              onSelect={(id) => {
                playSound(SOUNDS.CLICK);
                setSelectedChildId(id);
              }}
            />
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
                  <p className="text-slate-500 text-sm font-bold">우리 아이의 미션과 성장을 관리하려면<br/>비밀번호를 입력하세요. (기본: 1234)</p>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await verifyParentPassword(parentPassword);
                    if (ok) {
                      playSound(SOUNDS.SUCCESS);
                      setIsParentAuthenticated(true);
                      setParentPassword('');
                    } else {
                      playSound(SOUNDS.ERROR);
                      showAlert('인증 실패', '비밀번호가 올바르지 않아요.');
                    }
                  }}
                  className="space-y-6"
                >
                  <input
                    type="password"
                    placeholder="비밀번호 (기본 1234)"
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
            <Suspense fallback={<div className="p-12 text-center text-slate-400 font-bold">부모 대시보드를 불러오는 중...</div>}>
            <LazyParentDashboard
              quests={quests}
              history={history}
              onAdd={addQuest}
              onDelete={deleteQuest}
              onReset={resetDaily}
              onFullReset={fullReset}
              onPointReset={resetPoints}
              profile={profile}
              onUpdateChildField={async (updates) => {
                if (!userAccount?.familyId || !selectedChildId) return;
                setProfile((p: UserProfile) => ({ ...p, ...updates }));
                try {
                  await updateDoc(
                    doc(db, 'families', userAccount.familyId, 'children', selectedChildId),
                    updates
                  );
                } catch (error) {
                  handleFirestoreError(
                    error,
                    OperationType.UPDATE,
                    `families/${userAccount.familyId}/children/${selectedChildId}`
                  );
                }
              }}
              onUploadChildPhoto={uploadChildPhoto}
              onRemoveChildPhoto={removeChildPhoto}
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
              showOnboarding={showOnboarding}
              onDismissOnboarding={dismissOnboarding}
              rewards={rewards}
              onAddReward={addReward}
              onUpdateReward={updateReward}
              onDeleteReward={deleteReward}
              customCategories={customCategories}
              onAddCategory={addCustomCategory}
              onDeleteCategory={deleteCustomCategory}
              onChangePassword={changeParentPassword}
            />
            </Suspense>
          )
        ) : (
          <AnimatePresence mode="wait">
            {(viewMode === 'quests' || viewMode === 'calendar') && (
              <motion.div
                key="quests-calendar"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="lg:grid lg:grid-cols-10 lg:gap-6"
              >
                <div className={cn("lg:col-span-6", viewMode === 'calendar' && "hidden lg:block")}>
                  <ChildDashboard
                    quests={quests}
                    customCategories={customCategories}
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
                </div>
                <div className={cn("lg:col-span-4 mt-6 lg:mt-0", viewMode === 'quests' && "hidden lg:block")}>
                  <Suspense fallback={<div className="p-6 text-center text-slate-400 text-xs font-bold">달력을 불러오는 중...</div>}>
                    <LazyCalendarView history={history} customCategories={customCategories} />
                  </Suspense>
                </div>
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
            {viewMode === 'feed' && (
              <motion.div
                key="feed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Suspense fallback={<div className="p-12 text-center text-slate-400 font-bold">피드를 불러오는 중...</div>}>
                  <FeedView
                    familyId={userAccount?.familyId}
                    posts={feedPosts}
                    loading={feedLoading}
                    userAccount={userAccount}
                    profile={profile}
                    showAlert={showAlert}
                  />
                </Suspense>
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
            <span className="text-[10px] md:text-xs font-black">오늘의 미션</span>
          </button>
          <button
            onClick={() => {
              playSound(SOUNDS.CLICK);
              setViewMode('calendar');
            }}
            className={cn(
              "flex flex-col items-center gap-1 transition-all hover:scale-110 lg:hidden",
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
            <span className="text-[10px] md:text-xs font-black">미션 보상</span>
          </button>
          <button
            onClick={() => {
              playSound(SOUNDS.CLICK);
              setViewMode('feed');
            }}
            className={cn(
              "flex flex-col items-center gap-1 transition-all hover:scale-110",
              viewMode === 'feed' ? "text-yellow-500" : "text-slate-400"
            )}
          >
            <Camera size={28} className="md:w-8 md:h-8" />
            <span className="text-[10px] md:text-xs font-black">가족 피드</span>
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

      <PrivacyConsentModal
        open={consentOpen}
        onClose={handleConsentReject}
        onAgree={handleConsentAgree}
        blocking
      />

      <BadgeUnlockModal
        queue={unlockQueue}
        onDismiss={(id) => setUnlockQueue((q) => q.filter((x) => x !== id))}
      />
    </div>
  );
}


