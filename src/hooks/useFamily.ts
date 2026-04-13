import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { ChildProfile, Family, UserAccount } from '../types';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';

export function useFamily(userAccount: UserAccount | null) {
  const [family, setFamily] = useState<Family | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  useEffect(() => {
    if (!userAccount?.familyId) {
      setFamily(null);
      setChildren([]);
      setSelectedChildId(null);
      return;
    }

    const familyId = userAccount.familyId;
    const familyRef = doc(db, 'families', familyId);
    const unsubFamily = onSnapshot(
      familyRef,
      (snap) => {
        if (snap.exists()) {
          setFamily({ id: snap.id, ...snap.data() } as Family);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `families/${familyId}`);
      }
    );

    const childrenRef = collection(db, 'families', familyId, 'children');
    const unsubChildren = onSnapshot(
      childrenRef,
      (snap) => {
        const childList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChildProfile));
        setChildren(childList);
        // Use functional updater so we read the *latest* selectedChildId,
        // not the stale closure value captured when the effect first ran.
        // Otherwise every subsequent snapshot (e.g. after a quest toggle
        // updates the child's totalPoints) would reset the selection back
        // to childList[0].
        setSelectedChildId((prev) => {
          if (prev && childList.some((c) => c.id === prev)) return prev;
          return childList[0]?.id ?? null;
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `families/${familyId}/children`);
      }
    );

    return () => {
      unsubFamily();
      unsubChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAccount?.familyId]);

  return { family, children, selectedChildId, setSelectedChildId };
}
