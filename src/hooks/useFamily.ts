import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { ChildProfile, Family, UserAccount } from '../types';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';

// Per-user persistence key for the last-active child. Scoped by uid so
// multiple accounts on the same browser don't cross-pollinate.
const childKey = (uid: string) => `kidquest_selected_child_${uid}`;

function readPersistedChild(uid: string | undefined): string | null {
  if (!uid) return null;
  try {
    return localStorage.getItem(childKey(uid));
  } catch {
    return null;
  }
}

function writePersistedChild(uid: string | undefined, id: string | null) {
  if (!uid) return;
  try {
    if (id) localStorage.setItem(childKey(uid), id);
    else localStorage.removeItem(childKey(uid));
  } catch {}
}

export function useFamily(userAccount: UserAccount | null) {
  const [family, setFamily] = useState<Family | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  // Hydrate the selection from localStorage synchronously so the very
  // first render after a refresh already has the right child id, even
  // before the children snapshot has resolved. The children snapshot
  // below will validate it against the live list.
  const [selectedChildId, setSelectedChildIdState] = useState<string | null>(
    () => readPersistedChild(userAccount?.uid),
  );

  // Persist on every change (and clear on logout).
  const setSelectedChildId: typeof setSelectedChildIdState = (next) => {
    setSelectedChildIdState((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: string | null) => string | null)(prev) : next;
      writePersistedChild(userAccount?.uid, resolved);
      return resolved;
    });
  };

  // Auth is async — uid may arrive after first render. Re-hydrate the
  // selection once we actually know who the user is. We only restore
  // when the in-memory state is empty so this never clobbers an active
  // selection mid-session.
  useEffect(() => {
    if (!userAccount?.uid) return;
    setSelectedChildIdState((prev) => prev ?? readPersistedChild(userAccount.uid));
  }, [userAccount?.uid]);

  useEffect(() => {
    if (!userAccount?.familyId) {
      setFamily(null);
      setChildren([]);
      setSelectedChildIdState(null);
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
