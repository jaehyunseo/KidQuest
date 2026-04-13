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
        if (childList.length > 0 && !selectedChildId) {
          setSelectedChildId(childList[0].id);
        }
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
