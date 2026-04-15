import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  HistoryRecord,
  Quest,
  QuestGroup,
  UserProfile,
} from '../types';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';

const INITIAL_PROFILE: UserProfile = {
  name: '우리 아이',
  totalPoints: 0,
  level: 1,
  avatar: '🦁',
  inventory: [],
};

const INITIAL_QUESTS: Omit<Quest, 'id'>[] = [
  { title: '수학 익힘책 풀기', points: 10, category: 'homework', completed: false },
  { title: '엄마 도와서 설거지하기', points: 100, category: 'chore', completed: false },
  { title: '방 정리하기', points: 50, category: 'chore', completed: false },
  { title: '영어 단어 10개 외우기', points: 20, category: 'homework', completed: false },
];

export function useChildData(familyId: string | undefined, childId: string | null) {
  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [groups, setGroups] = useState<QuestGroup[]>([]);

  useEffect(() => {
    if (!familyId || !childId) return;

    const profileRef = doc(db, 'families', familyId, 'children', childId);
    const unsubProfile = onSnapshot(
      profileRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `families/${familyId}/children/${childId}`);
      }
    );

    const questsRef = collection(db, 'families', familyId, 'children', childId, 'quests');
    const unsubQuests = onSnapshot(
      questsRef,
      async (snapshot) => {
        if (snapshot.empty) {
          // First-time seed: give fresh children a starter quest set so the
          // dashboard isn't empty. Parents can delete/edit freely afterward.
          const batch = writeBatch(db);
          INITIAL_QUESTS.forEach((q) => {
            const newDocRef = doc(questsRef);
            batch.set(newDocRef, { ...q, id: newDocRef.id });
          });
          try {
            await batch.commit();
          } catch (error) {
            handleFirestoreError(
              error,
              OperationType.WRITE,
              `families/${familyId}/children/${childId}/quests`
            );
          }
        } else {
          setQuests(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Quest)));
        }
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.GET,
          `families/${familyId}/children/${childId}/quests`
        );
      }
    );

    const historyRef = collection(db, 'families', familyId, 'children', childId, 'history');
    const unsubHistory = onSnapshot(
      historyRef,
      (snapshot) => {
        setHistory(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as HistoryRecord)));
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.GET,
          `families/${familyId}/children/${childId}/history`
        );
      }
    );

    const groupsRef = collection(
      db,
      'families',
      familyId,
      'children',
      childId,
      'questGroups'
    );
    const unsubGroups = onSnapshot(
      groupsRef,
      (snapshot) => {
        setGroups(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as QuestGroup)));
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.GET,
          `families/${familyId}/children/${childId}/questGroups`
        );
      }
    );

    return () => {
      unsubProfile();
      unsubQuests();
      unsubHistory();
      unsubGroups();
    };
  }, [familyId, childId]);

  return {
    profile,
    setProfile,
    quests,
    setQuests,
    history,
    setHistory,
    groups,
  };
}
