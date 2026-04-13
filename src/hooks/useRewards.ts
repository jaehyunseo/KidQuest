import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Reward } from '../types';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';

export function useRewards(familyId: string | undefined) {
  const [rewards, setRewards] = useState<Reward[]>([]);

  useEffect(() => {
    if (!familyId) {
      setRewards([]);
      return;
    }
    const rewardsRef = collection(db, 'families', familyId, 'rewards');
    const unsub = onSnapshot(
      rewardsRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reward));
        // Sort by points ascending so cheapest rewards show first
        list.sort((a, b) => a.points - b.points);
        setRewards(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `families/${familyId}/rewards`);
      }
    );
    return () => unsub();
  }, [familyId]);

  return rewards;
}
