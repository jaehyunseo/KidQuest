import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { CustomCategory } from '../types';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';

/**
 * Custom categories live in families/{familyId}/categories. They are
 * additive on top of the four built-in ones (homework / chore / habit
 * / other), not a replacement.
 */
export function useCategories(familyId: string | undefined) {
  const [categories, setCategories] = useState<CustomCategory[]>([]);

  useEffect(() => {
    if (!familyId) {
      setCategories([]);
      return;
    }
    const ref = collection(db, 'families', familyId, 'categories');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CustomCategory));
        list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        setCategories(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `families/${familyId}/categories`);
      }
    );
    return () => unsub();
  }, [familyId]);

  return categories;
}
