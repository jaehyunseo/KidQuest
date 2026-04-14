import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import type { FeedPost } from '../types';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';

/**
 * Subscribes to the most recent `families/{familyId}/feed` posts,
 * newest first. Limited to 50 posts for bandwidth; infinite scroll
 * can be added later if the family posts prolifically.
 */
export function useFeed(familyId: string | undefined) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!familyId) {
      setPosts([]);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'families', familyId, 'feed'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedPost)));
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `families/${familyId}/feed`);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [familyId]);

  return { posts, loading };
}
