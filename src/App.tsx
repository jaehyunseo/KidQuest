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
import { collection, doc, setDoc, updateDoc, deleteDoc, getDoc, writeBatch, addDoc, query, where, getDocs, limit, deleteField } from 'firebase/firestore';
import type { QuestCategory, UserProfile, Reward, ChildProfile, Family, QuestGroup } from './types';
import { evaluateGroupBonus } from './lib/questMaterializer';
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
const LazyAdminDashboard = lazy(() => import('./features/admin/AdminDashboard'));
import { isAdminUser } from './lib/adminAuth';
import { AnnouncementBanner } from './features/announcements/AnnouncementBanner';
import { uploadChildAvatar, deleteChildAvatar } from './lib/storage';
import { sha256, saltedHash, randomSalt } from './lib/hash';
import {
  evaluateNewBadges,
  localDateKey,
  nextStreak,
} from './lib/achievements';
import { evalPastWindow } from './lib/pastWindow';
import { evaluateProStatus } from './lib/proEntitlement';
import { ProUpsellModal, type UpsellReason } from './features/pro/ProUpsellModal';
import { AVATAR_CATALOG } from './lib/premiumCatalog';
import { PrivacyConsentModal, type ConsentResult } from './features/auth/PrivacyConsentModal';
import { CURRENT_CONSENT_VERSION } from './features/auth/consent';
import * as sfx from './lib/sound';
import { generateEncouragementText } from './lib/gemini';
import { CategoryIcon } from './components/CategoryIcon';
import { Avatar } from './components/Avatar';
import { ChildSwitcher } from './components/ChildSwitcher';
import { BadgeUnlockModal } from './components/BadgeUnlockModal';
import { RewardShop } from './features/child/RewardShop';
import { ProfileView } from './features/child/ProfileView';
import { FamilySetup } from './features/auth/FamilySetup';
import { ChildDashboard } from './features/child/ChildDashboard';

// Default reward templates moved to features/parent/constants.ts
// so they can be reused by createFamily, the migration effect, and the
// parent's "기본 템플릿 추가" button.
import { REWARD_TEMPLATES } from './features/parent/constants';

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
  const { profile, setProfile, quests, history, groups } = useChildData(userAccount?.familyId, selectedChildId);
  const rewards = useRewards(userAccount?.familyId);
  const customCategories = useCategories(userAccount?.familyId);
  const { posts: feedPosts, loading: feedLoading } = useFeed(userAccount?.familyId);

  const [isParentMode, setIsParentMode] = useState(false);
  const [parentPassword, setParentPassword] = useState('');
  const [isParentAuthenticated, setIsParentAuthenticated] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('quests');
  const [modal, setModal] = useState<ModalConfig>({ isOpen: false, title: '', message: '', type: 'alert' });

  // Hidden admin route: `#/admin`
  const [isAdminView, setIsAdminView] = useState<boolean>(
    () => typeof window !== 'undefined' && window.location.hash === '#/admin'
  );
  useEffect(() => {
    const h = () => setIsAdminView(window.location.hash === '#/admin');
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  // Unauthorized admin access → force sign-out and bounce to login.
  // Runs whenever user state resolves or the hash flips to /admin.
  useEffect(() => {
    if (!isAdminView) return;
    if (!user || !userAccount) return; // still resolving
    if (isAdminUser(userAccount, user)) return; // authorized — leave alone
    (async () => {
      try {
        window.location.hash = '';
        await signOut(auth);
      } catch (err) {
        console.warn('[admin] forced sign-out failed:', err);
      }
    })();
  }, [isAdminView, user, userAccount]);

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
  // Pro upsell modal — triggered by gated actions (second child,
  // premium avatar pick, etc). Kept at the App level so any subtree
  // can funnel into the single modal via `openUpsell()`.
  const [upsellModal, setUpsellModal] = useState<{ open: boolean; reason: UpsellReason }>({
    open: false,
    reason: 'generic',
  });
  const openUpsell = (reason: UpsellReason) =>
    setUpsellModal({ open: true, reason });
  const closeUpsell = () => setUpsellModal((prev) => ({ ...prev, open: false }));
  // Derived Pro status — UI gates read this synchronously. Recomputed
  // on every render so an expired trial naturally flips to 'free'
  // without needing a dedicated timer.
  const proStatus = evaluateProStatus(userAccount);

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
          for (const r of REWARD_TEMPLATES) {
            await addDoc(rewardsRef, r);
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

  // Self-heal legacy families. Three separate heals, in order, because
  // each one has a different rules-layer authorization path:
  //
  //  1. Write-once ownerUid claim (any parent member). Unlocks the owner
  //     code path for everything else.
  //  2. Owner fills in missing childInviteCode / parentInviteCode fields.
  //  3. Any member writes their own memberNames[uid] entry so they
  //     appear with a real name in the member list.
  //
  // Each step is idempotent and guarded by a ref so React StrictMode or
  // rapid snapshot updates don't cause write storms.
  const codeHealRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user || !family?.id) return;
    const selfUid = user.uid;
    const myName = userAccount?.name || user.email || '';
    const myRole = family.members?.[selfUid];
    if (!myRole) return; // not a member yet

    const fid = family.id;

    // Step 1: claim ownerUid if missing and I'm a parent.
    if (!family.ownerUid && myRole === 'parent') {
      const claimKey = `${fid}:owner`;
      if (!codeHealRef.current.has(claimKey)) {
        codeHealRef.current.add(claimKey);
        updateDoc(doc(db, 'families', fid), { ownerUid: selfUid }).catch((err) => {
          console.warn('[heal] ownerUid claim failed:', err);
          codeHealRef.current.delete(claimKey);
        });
        return; // wait for snapshot to reflect the claim before next heals
      }
    }

    // Step 2: owner fills code fields if missing.
    if (family.ownerUid === selfUid) {
      const needsChild = !family.childInviteCode;
      const needsParent = !family.parentInviteCode;
      if (needsChild || needsParent) {
        const codeKey = `${fid}:codes`;
        if (!codeHealRef.current.has(codeKey)) {
          codeHealRef.current.add(codeKey);
          const patch: Record<string, any> = {};
          if (needsParent) patch.parentInviteCode = family.inviteCode || fid;
          if (needsChild) {
            let cc = Math.random().toString(36).substring(2, 8).toUpperCase();
            while (cc === (family.parentInviteCode || family.inviteCode || fid)) {
              cc = Math.random().toString(36).substring(2, 8).toUpperCase();
            }
            patch.childInviteCode = cc;
          }
          updateDoc(doc(db, 'families', fid), patch).catch((err) => {
            console.warn('[heal] code fill failed:', err);
            codeHealRef.current.delete(codeKey);
          });
        }
      }
    }

    // Step 3: write my own memberNames entry if missing or stale. Works
    // for both owners (via owner path) and non-owner members (via the
    // join-flow self-slot rule). Skipped when there's no account name
    // yet so we don't churn with empty strings.
    if (myName && family.memberNames?.[selfUid] !== myName) {
      const nameKey = `${fid}:name:${myName}`;
      if (!codeHealRef.current.has(nameKey)) {
        codeHealRef.current.add(nameKey);
        updateDoc(doc(db, 'families', fid), {
          [`memberNames.${selfUid}`]: myName,
        }).catch((err) => {
          console.warn('[heal] memberNames self write failed:', err);
          codeHealRef.current.delete(nameKey);
        });
      }
    }
  }, [user, family, userAccount?.name]);

  // Migration: populate `lifetimeEarned` for children created before the
  // field existed. We compute it from the history subcollection (sum of
  // all positive-point entries, i.e. quest completions only — reward
  // purchases appear as negative and are skipped).
  //
  // Runs once per child per session, only when lifetimeEarned is unset.
  // Idempotent: flipping the field from undefined to a number means the
  // effect short-circuits on re-runs.
  const lifetimeMigrationRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!userAccount?.familyId || !selectedChildId || !profile) return;
    if (profile.lifetimeEarned != null) return;        // already migrated
    if (history.length === 0) return;                  // snapshot not ready
    const key = `${userAccount.familyId}/${selectedChildId}`;
    if (lifetimeMigrationRef.current.has(key)) return; // already attempted
    lifetimeMigrationRef.current.add(key);

    const earned = history.reduce((sum, h) => {
      if (h.type === 'reward') return sum;
      return sum + Math.max(0, h.points ?? 0);
    }, 0);

    const childRef = doc(db, 'families', userAccount.familyId, 'children', selectedChildId);
    updateDoc(childRef, { lifetimeEarned: earned })
      .then(() => {
        console.info(`[migration] lifetimeEarned=${earned} set for ${key}`);
      })
      .catch((err) => {
        console.warn('[migration] failed to set lifetimeEarned:', err);
      });
  }, [userAccount?.familyId, selectedChildId, profile?.lifetimeEarned, history]);

  // Daily quest auto-reset. When the local day rolls over, uncheck any
  // quest whose `completedAt` is before today — yesterday's points stay
  // earned, but the checkboxes are fresh for the new day. Quests with
  // an explicit `scheduledDate` are date-pinned and must NOT be reset
  // (otherwise retroactive completions would vanish overnight).
  useEffect(() => {
    if (!userAccount?.familyId || !selectedChildId || quests.length === 0) return;
    const staleQuests = quests.filter((q: any) => {
      if (!q.completed || !q.completedAt) return false;
      if (q.scheduledDate) return false;
      return localDateKey(new Date(q.completedAt)) < dayKey;
    });
    if (staleQuests.length === 0) return;
    const run = async () => {
      const batch = writeBatch(db);
      staleQuests.forEach((q: any) => {
        batch.update(
          doc(db, 'families', userAccount.familyId!, 'children', selectedChildId, 'quests', q.id),
          { completed: false, completedAt: null, groupBonusClaimed: false }
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
  //
  // Level is derived from `lifetimeEarned` (monotonic cumulative points),
  // NOT the current balance. This way buying rewards never drops level.
  // Fallback to `totalPoints` only when lifetimeEarned is absent
  // (legacy data, pre-migration).
  useEffect(() => {
    if (!profile || !userAccount?.familyId || !selectedChildId) return;
    const basis = profile.lifetimeEarned ?? profile.totalPoints;
    const newLevel = getLevel(basis);
    // Level can only increase. If current stored level is somehow higher
    // (e.g. legacy inflated), don't regress it on this render.
    if (newLevel > profile.level) {
      const childRef = doc(db, 'families', userAccount.familyId, 'children', selectedChildId);
      updateDoc(childRef, { level: newLevel }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, childRef.path);
      });
      sfx.levelUp();
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#FF4500']
      });
    }
  }, [profile?.lifetimeEarned, profile?.totalPoints, profile?.level, userAccount?.familyId, selectedChildId]);

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
      const now = new Date().toISOString();
      await updateDoc(userRef, {
        consentedAt: now,
        consentVersion: CURRENT_CONSENT_VERSION,
        consentPrivacy: consent.privacy,
        consentTerms: consent.terms,
        consentAge: consent.age,
        consentMarketing: consent.marketing,
        // Structured guardian acknowledgement. Per PIPA Article 3
        // (data minimization), we record only the fact and timestamp
        // of the legal-guardian acknowledgement — no name, no count.
        guardianConsent: {
          version: CURRENT_CONSENT_VERSION,
          consentedAt: now,
          acknowledged: consent.guardianAck,
        },
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

    // Date-scoped guard: today + last 7 days are toggleable (retroactive
    // completion). Future-scheduled quests stay locked.
    const PAST_WINDOW_DAYS = 7;
    const decision = evalPastWindow(
      quest.scheduledDate,
      dayKey,
      PAST_WINDOW_DAYS,
    );
    if (decision.allowed === false) {
      sfx.error();
      if (decision.reason === 'future') {
        showAlert('아직 이른 미션', '이 미션은 아직 시작할 수 없어요. 그날이 되면 다시 만나요!');
      } else {
        showAlert(
          '지난 미션',
          `${PAST_WINDOW_DAYS}일이 지난 미션은 기록으로만 남아요. 더 최근의 미션부터 정리해볼까요?`,
        );
      }
      return;
    }
    const { isPastScheduled, effectiveTimestamp } = decision;

    const newCompleted = !quest.completed;
    const familyId = userAccount.familyId;
    const childId = selectedChildId;

    if (newCompleted) {
      sfx.questComplete();
      const batch = writeBatch(db);

      // Streak bookkeeping. Retroactive (past-scheduled) completions
      // don't advance today's streak — only real same-day completions do.
      const today = localDateKey();
      const { streak: computedStreak, touched } = nextStreak(
        profile.streak,
        profile.lastCompletedDate,
        today
      );
      const newStreak = isPastScheduled ? (profile.streak ?? 0) : computedStreak;
      const longest = Math.max(profile.longestStreak ?? 0, newStreak);
      const newTotalCompleted = (profile.totalCompleted ?? 0) + 1;
      const newTotalPoints = profile.totalPoints + quest.points;
      // lifetimeEarned is monotonic — drives level, never decreases
      // when rewards are purchased.
      const newLifetimeEarned = (profile.lifetimeEarned ?? profile.totalPoints) + quest.points;

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
        completedAt: effectiveTimestamp,
      });

      // Update Profile: points + streak + achievements. For retroactive
      // completions leave lastCompletedDate untouched.
      batch.update(doc(db, 'families', familyId, 'children', childId), {
        totalPoints: newTotalPoints,
        lifetimeEarned: newLifetimeEarned,
        totalCompleted: newTotalCompleted,
        streak: newStreak,
        longestStreak: longest,
        lastCompletedDate: isPastScheduled
          ? (profile.lastCompletedDate ?? today)
          : (touched ? today : (profile.lastCompletedDate ?? today)),
        achievements: mergedAchievements,
      });

      // Add History
      const historyRef = doc(collection(db, 'families', familyId, 'children', childId, 'history'));
      batch.set(historyRef, {
        questId: quest.id,
        title: quest.title,
        points: quest.points,
        category: quest.category,
        timestamp: effectiveTimestamp,
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

      // Group bonus: if this quest belongs to a group and completing it
      // closes out every sibling for today (and the bonus hasn't been
      // paid for this group today yet), award bonus points once.
      //
      // Double-award prevention is gated on the presence of a
      // `group-bonus` history record for today — that record is the
      // ground-truth receipt and is explicitly deleted on uncheck. We
      // deliberately do NOT rely on the `groupBonusClaimed` flag on
      // sibling quests here, because React state for that flag can lag
      // a round-trip behind the uncheck's snapshot propagation and
      // would otherwise block a legitimate re-award after uncheck.
      if (quest.groupId) {
        const group = groups.find((g) => g.id === quest.groupId);
        const todayString = new Date().toDateString();
        const alreadyAwardedToday = history.some(
          (h) =>
            h.type === 'group-bonus' &&
            h.groupId === quest.groupId &&
            new Date(h.timestamp).toDateString() === todayString,
        );
        // Strip stale `groupBonusClaimed` from the projection so the
        // underlying eligibility check (kept for the "all done" math)
        // doesn't veto on a lagging flag. The history gate above is
        // the real double-award guard.
        const projected = quests.map((q) => {
          const base = { ...q, groupBonusClaimed: false };
          return q.id === quest.id ? { ...base, completed: true } : base;
        });
        const { eligible, siblings } = evaluateGroupBonus(
          quest.groupId,
          dayKey,
          projected,
        );
        if (!alreadyAwardedToday && eligible && group && group.bonusPoints > 0) {
          const bonusBatch = writeBatch(db);
          siblings.forEach((s) => {
            bonusBatch.update(
              doc(db, 'families', familyId, 'children', childId, 'quests', s.id),
              { groupBonusClaimed: true },
            );
          });
          bonusBatch.update(doc(db, 'families', familyId, 'children', childId), {
            totalPoints: newTotalPoints + group.bonusPoints,
            lifetimeEarned: newLifetimeEarned + group.bonusPoints,
          });
          const bonusHistoryRef = doc(
            collection(db, 'families', familyId, 'children', childId, 'history'),
          );
          bonusBatch.set(bonusHistoryRef, {
            type: 'group-bonus',
            groupId: group.id,
            title: `${group.icon || '🏆'} ${group.title} 완성 보너스`,
            points: group.bonusPoints,
            timestamp: new Date().toISOString(),
          });
          try {
            await bonusBatch.commit();
            sfx.bonus();
            confetti({
              particleCount: 220,
              spread: 120,
              origin: { y: 0.5 },
              colors: ['#FFD700', '#FF69B4', '#8B5CF6', '#3B82F6'],
            });
            showAlert(
              '🎉 그룹 보너스!',
              `${group.title}을(를) 모두 완료해서 +${group.bonusPoints}P 보너스를 받았어요!`,
            );
          } catch (bonusErr) {
            console.warn('[group-bonus] failed to award', bonusErr);
          }
        }
      }

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
      // Uncheck flow. The current balance may go negative if the child
      // already spent points in the shop — that's allowed (so the
      // running balance stays accurate), but warn the user first.

      // If this quest belongs to a group whose bonus was already claimed
      // for this day, we must reverse the bonus so that re-checking the
      // quest can re-award it. Without this, `evaluateGroupBonus` sees
      // `anyClaimed === true` on the stale sibling flag and the bonus
      // never fires again.
      const siblingDate = quest.scheduledDate ?? dayKey;
      const siblings = quest.groupId
        ? quests.filter(
            (q) =>
              q.groupId === quest.groupId &&
              (q.scheduledDate ? q.scheduledDate === siblingDate : true),
          )
        : [];
      const bonusWasClaimed = siblings.some((q) => q.groupBonusClaimed === true);
      const groupForBonus = bonusWasClaimed
        ? groups.find((g) => g.id === quest.groupId)
        : undefined;
      const bonusReversal =
        groupForBonus && groupForBonus.bonusPoints > 0 ? groupForBonus.bonusPoints : 0;

      const projectedTotal = profile.totalPoints - quest.points - bonusReversal;
      const performUncheck = async () => {
        sfx.questUncheck();
        const batch = writeBatch(db);

        batch.update(doc(db, 'families', familyId, 'children', childId, 'quests', id), {
          completed: false,
          completedAt: null,
          groupBonusClaimed: false,
        });

        // Clear the bonus-claimed flag on every sibling so the next
        // completion can re-evaluate from a clean slate.
        if (bonusReversal > 0) {
          siblings.forEach((s) => {
            if (s.id !== id) {
              batch.update(
                doc(db, 'families', familyId, 'children', childId, 'quests', s.id),
                { groupBonusClaimed: false },
              );
            }
          });
        }

        // lifetimeEarned drives level — keep monotonic, clamp at 0.
        const rolledBackLifetime = Math.max(
          0,
          (profile.lifetimeEarned ?? profile.totalPoints) - quest.points - bonusReversal,
        );
        batch.update(doc(db, 'families', familyId, 'children', childId), {
          totalPoints: projectedTotal,
          lifetimeEarned: rolledBackLifetime,
        });

        // Remove History. For retroactive quests, match the past-day record;
        // otherwise match today's record for this quest.
        const targetDayString = isPastScheduled
          ? new Date(`${quest.scheduledDate}T12:00:00`).toDateString()
          : new Date().toDateString();
        const recordToDelete = history.find(h =>
          h.questId === quest.id && new Date(h.timestamp).toDateString() === targetDayString
        );
        if (recordToDelete) {
          batch.delete(doc(db, 'families', familyId, 'children', childId, 'history', recordToDelete.id));
        }

        // Also delete the group-bonus history record for the same day so
        // the calendar and totals stay consistent with the reversal.
        if (bonusReversal > 0 && quest.groupId) {
          const bonusRecord = history.find(
            (h) =>
              h.type === 'group-bonus' &&
              h.groupId === quest.groupId &&
              new Date(h.timestamp).toDateString() === targetDayString,
          );
          if (bonusRecord) {
            batch.delete(
              doc(db, 'families', familyId, 'children', childId, 'history', bonusRecord.id),
            );
          }
        }

        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `families/${familyId}/children/${childId}`);
        }
      };

      const deductLabel =
        bonusReversal > 0
          ? `${quest.points}P + 그룹 보너스 ${bonusReversal}P`
          : `${quest.points}P`;

      if (projectedTotal < 0) {
        showConfirm(
          '미션 취소',
          `'${quest.title}' 완료를 취소할까요?\n${deductLabel}가 차감돼요.\n\n⚠️ 현재 잔액 ${profile.totalPoints}P에서 차감하면 ${projectedTotal}P (마이너스)가 돼요.`,
          () => { void performUncheck(); },
        );
      } else if (bonusReversal > 0) {
        showConfirm(
          '미션 취소',
          `'${quest.title}' 완료를 취소하면 그룹 보너스 ${bonusReversal}P도 함께 회수돼요. 계속할까요?`,
          () => { void performUncheck(); },
        );
      } else {
        await performUncheck();
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

  // Add a backdated completion for a quest on a past day from the
  // calendar view. Only allowed for dates within the last 7 days and
  // strictly in the past (today's completions still go through
  // toggleQuest in the mission list to keep one source of truth for
  // streak/group-bonus). Backdated entries credit points and create a
  // history record dated to the chosen day, but do NOT advance streak.
  const addBackdatedCompletion = async (questId: string, dateKey: string) => {
    if (!user || !userAccount?.familyId || !selectedChildId) return;
    const quest = quests.find(q => q.id === questId);
    if (!quest) return;
    if (dateKey >= dayKey) {
      // Today and future are not handled here.
      return;
    }
    const decision = evalPastWindow(dateKey, dayKey, 7);
    if (decision.allowed === false) {
      sfx.error();
      showAlert(
        '수정 불가',
        decision.reason === 'future'
          ? '미래 날짜는 미리 등록할 수 없어요.'
          : '7일이 지난 날짜는 수정할 수 없어요.',
      );
      return;
    }
    // Guard against double-credit: if a history entry for this quest
    // already exists on this day, do nothing. The user can remove it
    // first via the X button.
    const targetDayString = new Date(`${dateKey}T12:00:00`).toDateString();
    const existing = history.find(
      h => h.questId === questId && new Date(h.timestamp).toDateString() === targetDayString,
    );
    if (existing) return;

    const familyId = userAccount.familyId;
    const childId = selectedChildId;
    const ts = new Date(`${dateKey}T12:00:00`).toISOString();

    const batch = writeBatch(db);
    const newTotalCompleted = (profile.totalCompleted ?? 0) + 1;
    const newTotalPoints = profile.totalPoints + quest.points;
    const newLifetimeEarned =
      (profile.lifetimeEarned ?? profile.totalPoints) + quest.points;

    batch.update(doc(db, 'families', familyId, 'children', childId), {
      totalPoints: newTotalPoints,
      lifetimeEarned: newLifetimeEarned,
      totalCompleted: newTotalCompleted,
    });

    const historyRef = doc(
      collection(db, 'families', familyId, 'children', childId, 'history'),
    );
    batch.set(historyRef, {
      questId: quest.id,
      title: quest.title,
      points: quest.points,
      category: quest.category,
      timestamp: ts,
    });

    try {
      await batch.commit();
      sfx.coinCollect();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `families/${familyId}/children/${childId}/history`,
      );
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

  // Cancel a past quest completion from the calendar. Only allowed for
  // records within the last 7 days — older records are immutable. The
  // current point balance IS allowed to go negative (so the running
  // balance reflects reality after a reward purchase), but we warn the
  // user up-front when a cancellation would push it below zero.
  // `lifetimeEarned` and `totalCompleted` are monotonic counters and
  // remain clamped at 0.
  const removeHistoryRecord = async (recordId: string) => {
    if (!user || !userAccount?.familyId || !selectedChildId) return;
    const record = history.find(h => h.id === recordId);
    if (!record) return;
    // Reward purchases and admin penalty records are never editable
    // from the calendar — they belong to the shop / parent flows.
    if (record.type === 'reward' || record.type === 'penalty') {
      showAlert('수정 불가', '상점 구매와 패널티 기록은 캘린더에서 취소할 수 없어요.');
      return;
    }
    const recordDayKey = localDateKey(new Date(record.timestamp));
    const decision = evalPastWindow(recordDayKey, dayKey, 7);
    if (decision.allowed === false) {
      sfx.error();
      if (decision.reason === 'future') {
        showAlert('수정 불가', '미래 날짜의 기록은 다룰 수 없어요.');
      } else {
        showAlert('수정 불가', '7일이 지난 기록은 취소할 수 없어요. 기록은 그대로 남아요.');
      }
      return;
    }

    const projectedTotal = profile.totalPoints - record.points;
    const willGoNegative = record.points > 0 && projectedTotal < 0;
    const baseLine = record.points > 0
      ? `'${record.title}' 기록을 취소할까요?\n${record.points}P가 차감돼요.`
      : `'${record.title}' 기록을 취소할까요?`;
    const confirmMessage = willGoNegative
      ? `${baseLine}\n\n⚠️ 현재 잔액 ${profile.totalPoints}P에서 차감하면 ${projectedTotal}P (마이너스)가 돼요. 그래도 취소할까요?`
      : baseLine;

    showConfirm(
      '기록 취소',
      confirmMessage,
      async () => {
        const familyId = userAccount.familyId!;
        const childId = selectedChildId!;
        const batch = writeBatch(db);
        if (record.points > 0) {
          // totalPoints reflects the live spendable balance and may go
          // negative after a reward purchase + cancellation combo —
          // user has been warned in the confirm dialog above.
          const rolledTotal = profile.totalPoints - record.points;
          // lifetimeEarned drives level — keep monotonic, clamp at 0.
          const rolledLifetime = Math.max(
            0,
            (profile.lifetimeEarned ?? profile.totalPoints) - record.points,
          );
          const rolledCompleted = Math.max(0, (profile.totalCompleted ?? 0) - 1);
          batch.update(doc(db, 'families', familyId, 'children', childId), {
            totalPoints: rolledTotal,
            lifetimeEarned: rolledLifetime,
            totalCompleted: rolledCompleted,
          });
        }
        // If the record's quest is still in the collection AND it was
        // completed today, also flip its `completed` flag back. Past-day
        // records for already-reset daily quests don't need this.
        if (record.questId && recordDayKey === dayKey) {
          const liveQuest = quests.find(q => q.id === record.questId);
          if (liveQuest?.completed) {
            batch.update(
              doc(db, 'families', familyId, 'children', childId, 'quests', record.questId),
              { completed: false, completedAt: null, groupBonusClaimed: false },
            );
          }
        }
        // For a group-bonus record, clear the bonus-claimed flag on every
        // sibling in that group for the same day so a future re-completion
        // can re-evaluate the bonus from scratch.
        if (record.type === 'group-bonus' && record.groupId && recordDayKey === dayKey) {
          const siblings = quests.filter(
            (q) =>
              q.groupId === record.groupId &&
              (q.scheduledDate ? q.scheduledDate === recordDayKey : true),
          );
          siblings.forEach((s) => {
            if (s.groupBonusClaimed) {
              batch.update(
                doc(db, 'families', familyId, 'children', childId, 'quests', s.id),
                { groupBonusClaimed: false },
              );
            }
          });
        }
        batch.delete(doc(db, 'families', familyId, 'children', childId, 'history', recordId));
        try {
          await batch.commit();
          sfx.questUncheck();
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.WRITE,
            `families/${familyId}/children/${childId}/history/${recordId}`,
          );
        }
      },
    );
  };

  // Assign / unassign a quest to a group. `groupId=null` clears the link.
  const setQuestGroup = async (questId: string, groupId: string | null) => {
    if (!userAccount?.familyId || !selectedChildId) return;
    try {
      const ref = doc(
        db,
        'families',
        userAccount.familyId,
        'children',
        selectedChildId,
        'quests',
        questId,
      );
      await updateDoc(ref, { groupId: groupId ?? null });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `families/${userAccount.familyId}/children/${selectedChildId}/quests/${questId}`,
      );
    }
  };

  // ---------------- Quest Groups ----------------
  // Returns the new group id so the caller can atomically attach quests.
  const addGroup = async (
    data: Omit<QuestGroup, 'id' | 'createdAt'>,
    questIds: string[] = [],
  ): Promise<string | null> => {
    if (!userAccount?.familyId || !selectedChildId) return null;
    try {
      const familyId = userAccount.familyId;
      const childId = selectedChildId;
      const groupsRef = collection(
        db,
        'families',
        familyId,
        'children',
        childId,
        'questGroups',
      );
      const newGroupRef = doc(groupsRef);
      const batch = writeBatch(db);
      batch.set(newGroupRef, {
        ...data,
        id: newGroupRef.id,
        createdAt: new Date().toISOString(),
      });
      questIds.forEach((qid) => {
        batch.update(
          doc(db, 'families', familyId, 'children', childId, 'quests', qid),
          { groupId: newGroupRef.id },
        );
      });
      await batch.commit();
      return newGroupRef.id;
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `families/${userAccount.familyId}/children/${selectedChildId}/questGroups`,
      );
      return null;
    }
  };

  const updateGroup = async (
    id: string,
    updates: Partial<Omit<QuestGroup, 'id' | 'createdAt'>>,
  ) => {
    if (!userAccount?.familyId || !selectedChildId) return;
    try {
      await updateDoc(
        doc(
          db,
          'families',
          userAccount.familyId,
          'children',
          selectedChildId,
          'questGroups',
          id,
        ),
        updates,
      );
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `families/${userAccount.familyId}/children/${selectedChildId}/questGroups/${id}`,
      );
    }
  };

  const deleteGroup = (id: string) => {
    if (!userAccount?.familyId || !selectedChildId) return;
    const g = groups.find((x: QuestGroup) => x.id === id);
    if (!g) return;
    showConfirm(
      '그룹 삭제',
      `'${g.title}' 그룹을 삭제할까요? 소속 마스터 미션은 그대로 남습니다.`,
      async () => {
        try {
          // Unlink any quests currently in this group.
          const linked = quests.filter((q: any) => q.groupId === id);
          if (linked.length > 0) {
            const batch = writeBatch(db);
            linked.forEach((q: any) => {
              batch.update(
                doc(
                  db,
                  'families',
                  userAccount.familyId!,
                  'children',
                  selectedChildId!,
                  'quests',
                  q.id,
                ),
                { groupId: null },
              );
            });
            await batch.commit();
          }
          await deleteDoc(
            doc(
              db,
              'families',
              userAccount.familyId!,
              'children',
              selectedChildId!,
              'questGroups',
              id,
            ),
          );
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.DELETE,
            `families/${userAccount.familyId}/children/${selectedChildId}/questGroups/${id}`,
          );
        }
      },
    );
  };

  // ---------------- Penalty (parent-only) ----------------
  const applyPenalty = async (points: number, reason: string) => {
    if (!userAccount?.familyId || !selectedChildId) return;
    if (!isParentAuthenticated) return;
    const abs = Math.max(1, Math.round(Math.abs(points)));
    try {
      const batch = writeBatch(db);
      const familyId = userAccount.familyId;
      const childId = selectedChildId;
      // Subtract only from the spendable balance — lifetimeEarned,
      // level, and streak are preserved so a single mistake can't erase
      // long-term progress.
      const nextBalance = Math.max(0, (profile.totalPoints ?? 0) - abs);
      batch.update(doc(db, 'families', familyId, 'children', childId), {
        totalPoints: nextBalance,
      });
      const historyRef = doc(
        collection(db, 'families', familyId, 'children', childId, 'history'),
      );
      batch.set(historyRef, {
        type: 'penalty',
        reason,
        title: `패널티: ${reason || '사유 미기재'}`,
        points: -abs,
        timestamp: new Date().toISOString(),
      });
      await batch.commit();
      sfx.pointsLose();
      showAlert('패널티 적용', `-${abs}P 차감되었어요. 사유: ${reason || '(미기재)'}`);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `families/${userAccount.familyId}/children/${selectedChildId}`,
      );
    }
  };

  const purchaseReward = (reward: Reward) => {
    if (!userAccount?.familyId || !selectedChildId) return;
    if (profile.totalPoints < reward.points) {
      sfx.error();
      showAlert('성장 포인트 부족', '포인트가 부족해요! 미션을 더 지켜볼까요?');
      return;
    }

    sfx.tap();
    showConfirm('보상 받기', `정말 '${reward.title}' 보상을 받을까요?\n${reward.points}P가 사용되며, 이 작업은 되돌릴 수 없습니다.`, async () => {
      try {
        sfx.rewardClaim();
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
        sfx.error();
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
      const gen = () => Math.random().toString(36).substring(2, 8).toUpperCase();
      const parentInviteCode = gen();
      // Re-roll the child code until it differs from the parent code so the
      // two roles can never collide on the same string.
      let childInviteCode = gen();
      while (childInviteCode === parentInviteCode) childInviteCode = gen();
      const familyRef = doc(db, 'families', parentInviteCode); // Use parent code as ID for direct lookup
      const salt = randomSalt();
      const defaultPasswordHash = await saltedHash('1234', salt);
      const ownerName = userAccount?.name || user.email || '부모';
      const newFamily: Family = {
        id: parentInviteCode,
        name,
        inviteCode: parentInviteCode,
        parentInviteCode,
        childInviteCode,
        ownerUid: user.uid,
        createdAt: new Date().toISOString(),
        members: { [user.uid]: 'parent' },
        memberNames: { [user.uid]: ownerName },
      };
      await setDoc(familyRef, newFamily);
      // Parent password hash + salt live in a parent-only private subdoc
      // so they are NOT exposed via the join-by-invite-code read of the
      // family doc. Salt makes the hash resistant to rainbow tables.
      try {
        await setDoc(
          doc(db, 'families', parentInviteCode, 'private', 'config'),
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
      await updateDoc(userRef, { familyId: parentInviteCode });

      // Auto-create a default child so the parent dashboard isn't empty on first entry.
      try {
        const childrenRef = collection(db, 'families', parentInviteCode, 'children');
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
        const rewardsRef = collection(db, 'families', parentInviteCode, 'rewards');
        for (const r of REWARD_TEMPLATES) {
          await addDoc(rewardsRef, r);
        }
        // Mark migration flag so the auto-seed effect doesn't run later
        await updateDoc(doc(db, 'families', parentInviteCode), { rewardsSeeded: true });
      } catch (rewardErr) {
        console.warn('Failed to seed default rewards:', rewardErr);
      }

      // Trigger onboarding banner for first-time parents
      try {
        localStorage.setItem(`kidquest_onboarding_${user.uid}`, 'pending');
      } catch {}
      setShowOnboarding(true);

      showAlert(
        '가족 생성 완료',
        `가족이 생성되었습니다!\n부모 코드: ${parentInviteCode}\n자녀 코드: ${childInviteCode}`
      );
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

  // Switch the child's emoji avatar. Gated by Pro — premium catalog
  // entries silently open the upsell modal instead of writing.
  const updateChildAvatarEmoji = async (avatarId: string) => {
    if (!userAccount?.familyId || !selectedChildId) return;
    const item = AVATAR_CATALOG.find((a) => a.id === avatarId);
    if (!item) return;
    if (item.premium && !proStatus.isPro) {
      openUpsell('premium_avatar');
      return;
    }
    const familyId = userAccount.familyId;
    const childId = selectedChildId;
    setProfile((p: UserProfile) => ({ ...p, avatar: item.display }));
    try {
      await updateDoc(doc(db, 'families', familyId, 'children', childId), {
        avatar: item.display,
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `families/${familyId}/children/${childId}`,
      );
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
    if (!userAccount?.familyId) throw new Error('가족 정보를 찾을 수 없어요');
    try {
      await addDoc(collection(db, 'families', userAccount.familyId, 'rewards'), data);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, `families/${userAccount.familyId}/rewards`);
      // Re-throw so callers (e.g. RewardManager bulk seed button) can
      // surface a real error message instead of silently failing.
      throw error;
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
  //
  // Primary storage: families/{id}/private/config (parent-only via rules)
  // Backup storage: families/{id} root doc fields (works pre-rules-deploy)
  // Final fallback: default password '1234' (for brand-new / never-set families)
  //
  // Verification order: private/config → family root fields → default '1234'.
  // Any Firestore error at any step falls through silently so the user is
  // never locked out of parent mode.
  const verifyParentPassword = async (input: string): Promise<boolean> => {
    if (!userAccount?.familyId) return false;
    const inputSha = await sha256(input);
    const defaultSha = await sha256('1234');

    // 1. Try the parent-only private config subdoc
    try {
      const snap = await getDoc(doc(db, 'families', userAccount.familyId, 'private', 'config'));
      if (snap.exists()) {
        const data = snap.data() as any;
        const stored = data?.parentPasswordHash as string | undefined;
        const salt = data?.parentPasswordSalt as string | undefined;
        if (stored) {
          if (salt) return (await saltedHash(input, salt)) === stored;
          return inputSha === stored;
        }
      }
    } catch {
      // permission-denied (rules not deployed) or network → fall through
    }

    // 2. Try the legacy fields on the family root doc
    const legacyHash = family?.parentPasswordHash;
    const legacySalt = family?.parentPasswordSalt;
    if (legacyHash) {
      if (legacySalt) return (await saltedHash(input, legacySalt)) === legacyHash;
      return inputSha === legacyHash;
    }

    // 3. Default password
    return inputSha === defaultSha;
  };

  const changeParentPassword = async (
    current: string,
    next: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!userAccount?.familyId || !family) return { ok: false, error: '가족 정보를 찾을 수 없어요' };
    const ok = await verifyParentPassword(current);
    if (!ok) return { ok: false, error: '현재 비밀번호가 올바르지 않아요' };

    const familyId = userAccount.familyId;
    const salt = randomSalt();
    const nextHash = await saltedHash(next, salt);
    const updatedAt = new Date().toISOString();

    // Write the hash ONLY to the parent-only private subdoc. The family
    // root doc is readable by any authenticated user (required for the
    // join-by-invite-code flow) and must never carry secrets. Legacy
    // deployments may still have `parentPasswordHash` on the root doc —
    // we proactively scrub those fields on every password change.
    try {
      await setDoc(
        doc(db, 'families', familyId, 'private', 'config'),
        { parentPasswordHash: nextHash, parentPasswordSalt: salt, updatedAt },
        { merge: true },
      );
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `families/${familyId}/private/config`);
      return { ok: false, error: err?.message || '저장 중 오류가 발생했어요' };
    }

    // Best-effort scrub of legacy fields on the root doc. Ignore
    // failures — if the caller lacks permission to touch the root doc
    // the new password is still safely stored in the private subdoc.
    try {
      await updateDoc(doc(db, 'families', familyId), {
        parentPasswordHash: deleteField(),
        parentPasswordSalt: deleteField(),
      });
    } catch (scrubErr) {
      console.warn('[security] legacy password field scrub skipped:', scrubErr);
    }
    return { ok: true };
  };

  const joinFamily = async (rawCode: string) => {
    if (!user) return;
    // Normalize: strip whitespace, uppercase, keep only alnum.
    // Pasted codes often carry newlines/spaces from clipboard managers,
    // and users may type in lowercase — we want them all to work.
    const code = (rawCode || '').replace(/\s+/g, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (!code) {
      showAlert('가족 합류', '가족 코드를 입력해주세요.');
      return;
    }

    const performJoin = async () => {
      try {
        // The role of the joining user is determined by WHICH code matches:
        //   - parentInviteCode (== doc ID) → parent
        //   - childInviteCode  (queried)   → child
        // The user does not get to pick — this is the entire point of the
        // dual-code RBAC. If the code matches neither, we reject.
        let familyId: string | null = null;
        let familyData: Family | null = null;
        let joinedRole: 'parent' | 'child' | null = null;

        // 1) Parent code = doc ID → direct lookup.
        const directSnap = await getDoc(doc(db, 'families', code));
        if (directSnap.exists()) {
          familyId = directSnap.id;
          familyData = directSnap.data() as Family;
          joinedRole = 'parent';
        }

        // 2) Child code → query by childInviteCode field.
        if (!familyId) {
          const childQ = query(
            collection(db, 'families'),
            where('childInviteCode', '==', code),
            limit(1)
          );
          const childSnap = await getDocs(childQ);
          if (!childSnap.empty) {
            familyId = childSnap.docs[0].id;
            familyData = childSnap.docs[0].data() as Family;
            joinedRole = 'child';
          }
        }

        if (!familyId || !familyData || !joinedRole) {
          showAlert('가족 찾기 실패', `'${code}' 코드를 가진 가족을 찾을 수 없어요. 코드를 다시 확인해주세요.`);
          return;
        }

        const memberName = userAccount?.name || user.email || (joinedRole === 'parent' ? '부모' : '자녀');
        await updateDoc(doc(db, 'families', familyId), {
          [`members.${user.uid}`]: joinedRole,
          [`memberNames.${user.uid}`]: memberName,
        });
        await updateDoc(doc(db, 'users', user.uid), { familyId, role: joinedRole });
        showAlert('가족 합류 완료', `${familyData.name} 가족에 ${joinedRole === 'parent' ? '부모' : '자녀'}로 합류했어요!`);
      } catch (error: any) {
        showAlert('합류 실패', error?.message || '가족 합류 중 오류가 발생했어요.');
        handleFirestoreError(error, OperationType.WRITE, `families/${code}`);
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

  const updateMyDisplayName = async (nextName: string) => {
    if (!user) return;
    const trimmed = nextName.trim();
    if (!trimmed) {
      showAlert('이름을 입력해주세요', '표시할 이름을 비워둘 수 없어요.');
      return;
    }
    if (trimmed.length > 40) {
      showAlert('이름이 너무 길어요', '40자 이내로 입력해주세요.');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid), { name: trimmed });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      return;
    }
    // Denormalize into the family doc so the member list reflects the new
    // name without a page reload. We surface failures explicitly because
    // silently swallowing them was masking a rules-layer bug where legacy
    // families without a memberNames map rejected the update.
    if (family?.id) {
      try {
        await updateDoc(doc(db, 'families', family.id), {
          [`memberNames.${user.uid}`]: trimmed,
        });
      } catch (famErr) {
        console.error('[name] family memberNames sync failed:', famErr);
        showAlert(
          '일부 저장 실패',
          '이름은 저장됐지만 가족 멤버 리스트에는 반영되지 않았어요. 잠시 후 다시 시도해주세요.'
        );
        return;
      }
    }
    showAlert('저장 완료', '이름이 변경되었어요.');
  };

  const removeFamilyMember = async (targetUid: string) => {
    if (!user || !family) return;
    if (family.ownerUid !== user.uid) {
      showAlert('권한 없음', '가족 멤버 삭제는 가족 주인만 할 수 있어요.');
      return;
    }
    if (targetUid === user.uid) {
      showAlert('삭제 불가', '본인은 가족에서 제거할 수 없어요.');
      return;
    }
    const targetName = family.memberNames?.[targetUid] || '이 멤버';
    showConfirm(
      '가족 멤버 제거',
      `${targetName}님을 가족에서 제거할까요? 해당 사용자는 더 이상 이 가족의 데이터를 볼 수 없게 됩니다.`,
      async () => {
        try {
          await updateDoc(doc(db, 'families', family.id), {
            [`members.${targetUid}`]: deleteField(),
            [`memberNames.${targetUid}`]: deleteField(),
          });
          // Best-effort: clear familyId on the removed user's account so
          // their next login lands them back in family setup. May fail under
          // strict rules — that's fine, the family-side removal is the
          // authoritative permission boundary.
          try {
            await updateDoc(doc(db, 'users', targetUid), { familyId: deleteField() });
          } catch {}
          showAlert('제거 완료', `${targetName}님을 가족에서 제거했어요.`);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `families/${family.id}`);
        }
      }
    );
  };

  const addChild = async (name: string, avatar: string) => {
    if (!userAccount?.familyId) return;
    // Free tier is capped at 1 child. On the second+ add attempt we
    // open the upsell modal instead of creating the doc, and leave
    // the caller free to retry after upgrade.
    if (children.length >= 1 && !proStatus.isPro) {
      openUpsell('second_child');
      return;
    }
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
      quests.filter(q => q.completed).map(q => q.title),
      quests.length,
      { streak: profile?.streak, now: new Date() },
    );
    if (text) setEncouragement(text);
    setIsLoadingAI(false);
  };

  // Refresh the encouragement message whenever the quest set changes
  // shape (loaded for the first time, child switched, count changed).
  // Toggling individual completion does NOT trigger a new message —
  // we want it stable during a single session unless the user hits
  // the refresh button.
  useEffect(() => {
    if (quests.length === 0 && !encouragement) {
      // Initial paint with no data yet — show the "starter" pool.
      void generateEncouragement();
      return;
    }
    if (quests.length > 0 && !encouragement) {
      void generateEncouragement();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quests.length, selectedChildId]);

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
                작은 성취를 평생의 힘으로 키워가는 가족 습관 동반자, KidQuest.
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
                  sfx.tap();
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
              <span>© 2026 KidQuest · Pyxora</span>
              <div className="flex gap-6">
                <a
                  href="/terms.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-600 transition-colors"
                >
                  Terms of Service
                </a>
                <a
                  href="/privacy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-600 transition-colors"
                >
                  Privacy Policy
                </a>
                <a
                  href="mailto:hello@pyxora.app"
                  className="hover:text-slate-600 transition-colors"
                >
                  Contact
                </a>
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

  if (isAdminView) {
    if (!isAdminUser(userAccount, user)) {
      // Effect above is signing out + clearing hash. Show a spinner
      // while that races to completion instead of a blank screen.
      return (
        <div className="min-h-screen bg-[#FDFCF0] flex flex-col items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
          <div className="text-sm text-slate-500">권한이 없습니다. 로그아웃 중…</div>
        </div>
      );
    }
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
          </div>
        }
      >
        <LazyAdminDashboard />
      </Suspense>
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

  const isParentAuthedMode = isParentMode && isParentAuthenticated;

  return (
    <div className="h-screen flex flex-col bg-[#FDFCF0] font-sans text-slate-900 md:pl-24 overflow-hidden">
      <AnnouncementBanner />
      {/* Header — hidden in authenticated parent mode (TopBar replaces it) */}
      {!isParentAuthedMode && (
      <header className="shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 py-4 z-30 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <button 
              onClick={() => {
                sfx.tap();
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
                sfx.nav();
                setSelectedChildId(id);
              }}
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] md:text-xs font-black bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">Lv.{profile.level}</span>
              <div className="w-16 md:w-32 h-1.5 md:h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-yellow-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${getProgressToNextLevel(profile.lifetimeEarned ?? profile.totalPoints)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isParentMode && (
            <button 
              onClick={() => {
                sfx.tap();
                setIsParentMode(true);
              }}
              className="p-2 md:p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              title="부모 모드"
            >
              <Settings size={20} className="md:w-6 md:h-6" />
            </button>
          )}
          <button 
            onClick={() => {
              sfx.tap();
              handleLogout();
            }}
            className="p-2 md:p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            title="로그아웃"
          >
            <LogOut size={20} className="md:w-6 md:h-6" />
          </button>
        </div>
      </header>
      )}

      <main className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden overflow-x-hidden pb-24 md:pb-0 flex flex-col">
        <div className="max-w-5xl w-full mx-auto p-4 md:p-6 lg:p-10 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
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
                      sfx.questComplete();
                      setIsParentAuthenticated(true);
                      setParentPassword('');
                    } else {
                      sfx.error();
                      showAlert('인증 실패', '비밀번호가 올바르지 않아요.');
                    }
                  }}
                  className="space-y-6"
                >
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="••••"
                    value={parentPassword}
                    onChange={(e) =>
                      setParentPassword(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    autoFocus
                    className="w-full border-2 border-slate-100 rounded-2xl px-4 py-4 text-center text-3xl tracking-[0.5em] outline-none focus:border-yellow-400 transition-all bg-slate-50/50 font-black placeholder:text-slate-300 placeholder:tracking-[0.3em]"
                  />
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => {
                        sfx.tap();
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
                sfx.tap();
                exitParentMode();
              }}
              family={family}
              childrenList={children}
              onAddChild={addChild}
              onDeleteChild={deleteChild}
              selectedChildId={selectedChildId}
              onSelectChild={setSelectedChildId}
              onJoinFamily={joinFamily}
              onRemoveMember={removeFamilyMember}
              currentUid={user?.uid || null}
              currentUserName={userAccount?.name || ''}
              onUpdateMyName={updateMyDisplayName}
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
              groups={groups}
              onAddGroup={addGroup}
              onUpdateGroup={updateGroup}
              onDeleteGroup={deleteGroup}
              onSetQuestGroup={setQuestGroup}
              onApplyPenalty={applyPenalty}
              isPro={proStatus.isPro}
            />
            </Suspense>
          )
        ) : (
          <div className="lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
          <AnimatePresence mode="wait">
            {(viewMode === 'quests' || viewMode === 'calendar') && (
              <motion.div
                key="quests-calendar"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="lg:grid lg:grid-cols-10 lg:gap-6 lg:flex-1 lg:min-h-0"
              >
                <div className={cn("lg:col-span-6 lg:h-full lg:min-h-0", viewMode === 'calendar' && "hidden lg:block")}>
                  <ChildDashboard
                    quests={quests}
                    customCategories={customCategories}
                    onToggle={(id) => {
                      toggleQuest(id);
                    }}
                    profile={profile}
                    encouragement={encouragement}
                    isLoadingAI={isLoadingAI}
                    onRefreshAI={() => {
                      sfx.tap();
                      generateEncouragement();
                    }}
                    groups={groups}
                    isPro={proStatus.isPro}
                    onUpsell={() => openUpsell('premium_avatar')}
                  />
                </div>
                <div className={cn("lg:col-span-4 mt-6 lg:mt-0 lg:h-full lg:min-h-0", viewMode === 'quests' && "hidden lg:block")}>
                  <Suspense fallback={<div className="p-6 text-center text-slate-400 text-xs font-bold">달력을 불러오는 중...</div>}>
                    <LazyCalendarView
                      history={history}
                      customCategories={customCategories}
                      dayKey={dayKey}
                      quests={quests}
                      onRemoveRecord={removeHistoryRecord}
                      onAddBackdated={addBackdatedCompletion}
                    />
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
                className="lg:flex-1 lg:min-h-0 lg:flex lg:flex-col"
              >
                <RewardShop
                  rewards={rewards}
                  profile={profile}
                  onPurchase={(reward) => {
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
                className="lg:flex-1 lg:min-h-0 lg:flex lg:flex-col"
              >
                <ProfileView
                  profile={profile}
                  rewards={rewards}
                  isPro={proStatus.isPro}
                  onSelectAvatar={updateChildAvatarEmoji}
                  onUpsell={() => openUpsell('premium_avatar')}
                />
              </motion.div>
            )}
            {viewMode === 'feed' && (
              <motion.div
                key="feed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="lg:flex-1 lg:min-h-0 lg:flex lg:flex-col"
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
          </div>
        )}
        </div>
      </main>

      {/* Navigation */}
      {!isParentMode && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex justify-around items-center z-40 md:top-0 md:bottom-0 md:left-0 md:w-24 md:flex-col md:border-t-0 md:border-r md:py-12 md:justify-center md:gap-12">
          <button
            onClick={() => {
              sfx.nav();
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
              sfx.nav();
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
              sfx.nav();
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
              sfx.nav();
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
              sfx.nav();
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

      {/* Custom Modal — outer wrapper MUST be motion + keyed so
          AnimatePresence properly unmounts the backdrop on exit.
          The previous plain <div> wrapper left the z-50 backdrop in the
          DOM after close, silently eating clicks on the header gear
          button and making the app look frozen. */}
      <AnimatePresence>
        {modal.isOpen && (
          <motion.div
            key="app-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          >
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
          </motion.div>
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

      {/* Global Pro upsell modal — any gated action funnels here. */}
      <ProUpsellModal
        open={upsellModal.open}
        reason={upsellModal.reason}
        onClose={closeUpsell}
        onSelectYearly={() => {
          // TODO(phase 3): hand off to Google Play Billing / App Store IAP.
          closeUpsell();
          showAlert(
            '결제 준비 중',
            '인앱 결제는 앱스토어 등록 후 활성화됩니다. 조금만 기다려주세요!',
          );
        }}
        onSelectMonthly={() => {
          closeUpsell();
          showAlert(
            '결제 준비 중',
            '인앱 결제는 앱스토어 등록 후 활성화됩니다. 조금만 기다려주세요!',
          );
        }}
        onEnterPromoCode={() => {
          closeUpsell();
          showAlert(
            '프로모 코드',
            '프로모 코드 입력은 곧 지원될 예정이에요.',
          );
        }}
      />
    </div>
  );
}


