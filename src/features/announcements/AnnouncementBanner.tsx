import { useEffect, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../../firebase';
import type { Announcement } from '../../types';

const DISMISS_KEY_PREFIX = 'kidquest_ann_dismissed_';

export function AnnouncementBanner() {
  const [active, setActive] = useState<Announcement | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const now = Date.now();
        const first = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) } as Announcement))
          .find((a) => {
            if (a.expiresAt && Date.parse(a.expiresAt) < now) return false;
            if (localStorage.getItem(DISMISS_KEY_PREFIX + a.id)) return false;
            return true;
          });
        setActive(first ?? null);
      },
      (err) => {
        console.warn('[announcements] subscribe failed:', err);
      }
    );
    return () => unsub();
  }, []);

  if (!active) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY_PREFIX + active.id, '1');
    setActive(null);
  };

  const tone =
    active.severity === 'warn'
      ? 'bg-amber-50 border-amber-300 text-amber-900'
      : 'bg-blue-50 border-blue-300 text-blue-900';

  return (
    <div className={`border-b ${tone} px-4 py-2`}>
      <div className="max-w-4xl mx-auto flex items-start gap-3">
        <div className="text-lg leading-none mt-0.5">
          {active.severity === 'warn' ? '⚠️' : '📢'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{active.title}</div>
          <div className="text-xs opacity-90 whitespace-pre-wrap">
            {active.body}
          </div>
        </div>
        <button
          onClick={dismiss}
          className="text-xs px-2 py-1 rounded hover:bg-black/5"
          aria-label="공지 닫기"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
