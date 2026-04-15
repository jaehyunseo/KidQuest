import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type {
  AdminAuditLog,
  AdminStats,
  Announcement,
  AnnouncementSeverity,
  Family,
  FeedPost,
  UserAccount,
} from '../types';

const BATCH_LIMIT = 450; // below Firestore's 500 op hard cap

function currentActor(): { uid: string; email: string } {
  const u = auth.currentUser;
  return {
    uid: u?.uid ?? 'unknown',
    email: u?.email ?? 'unknown',
  };
}

export async function logAdminAction(
  action: string,
  targetPath: string,
  meta?: Record<string, unknown>
): Promise<void> {
  const actor = currentActor();
  await addDoc(collection(db, 'adminAuditLogs'), {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action,
    targetPath,
    meta: meta ?? null,
    createdAt: new Date().toISOString(),
  });
}

async function deleteDocsBatched(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const slice = refs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    slice.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function collectSubcollectionDocs(
  parentPath: string,
  subName: string
): Promise<DocumentReference[]> {
  const snap = await getDocs(collection(db, `${parentPath}/${subName}`));
  return snap.docs.map((d) => d.ref);
}

export async function deleteFamilyWithCascade(fid: string): Promise<void> {
  await logAdminAction('delete_family', `families/${fid}`);

  const famPath = `families/${fid}`;

  // 1. Feed posts + their comments
  const feedSnap = await getDocs(collection(db, `${famPath}/feed`));
  for (const postDoc of feedSnap.docs) {
    const commentRefs = await collectSubcollectionDocs(
      `${famPath}/feed/${postDoc.id}`,
      'comments'
    );
    if (commentRefs.length) await deleteDocsBatched(commentRefs);
  }
  if (feedSnap.docs.length) {
    await deleteDocsBatched(feedSnap.docs.map((d) => d.ref));
  }

  // 2. Children + all their nested collections
  const childrenSnap = await getDocs(collection(db, `${famPath}/children`));
  for (const childDoc of childrenSnap.docs) {
    const childPath = `${famPath}/children/${childDoc.id}`;
    const subcols = ['quests', 'questGroups', 'history', 'achievements'];
    for (const sub of subcols) {
      const refs = await collectSubcollectionDocs(childPath, sub);
      if (refs.length) await deleteDocsBatched(refs);
    }
  }
  if (childrenSnap.docs.length) {
    await deleteDocsBatched(childrenSnap.docs.map((d) => d.ref));
  }

  // 3. Categories, rewards
  for (const sub of ['categories', 'rewards']) {
    const refs = await collectSubcollectionDocs(famPath, sub);
    if (refs.length) await deleteDocsBatched(refs);
  }

  // 4. private/config
  try {
    await deleteDoc(doc(db, `${famPath}/private/config`));
  } catch {
    // may not exist
  }

  // 5. Family doc itself
  await deleteDoc(doc(db, famPath));
}

export async function deleteUserDoc(uid: string): Promise<void> {
  await logAdminAction('delete_user', `users/${uid}`);
  await deleteDoc(doc(db, 'users', uid));
}

export async function listAllFamilies(): Promise<Family[]> {
  const snap = await getDocs(query(collection(db, 'families'), limit(500)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Family));
}

export async function listAllUsers(): Promise<UserAccount[]> {
  const snap = await getDocs(query(collection(db, 'users'), limit(500)));
  return snap.docs.map(
    (d) => ({ uid: d.id, ...(d.data() as any) } as UserAccount)
  );
}

export interface AdminChildProfile {
  id: string;
  name: string;
  avatar?: string;
  totalPoints?: number;
  level?: number;
}

export async function listChildrenOfFamily(
  familyId: string
): Promise<AdminChildProfile[]> {
  try {
    const snap = await getDocs(
      collection(db, `families/${familyId}/children`)
    );
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as any) } as AdminChildProfile)
    );
  } catch (err) {
    console.warn(`[adminOps] list children failed for ${familyId}:`, err);
    return [];
  }
}

export interface FamilyDetail {
  children: AdminChildProfile[];
  rewardCount: number;
  categoryCount: number;
  feedCount: number;
  totalQuests: number;
  completedQuests: number;
}

async function safeCount(path: string): Promise<number> {
  try {
    const cnt = await getCountFromServer(collection(db, path));
    return cnt.data().count;
  } catch (err) {
    console.warn(`[adminOps] count failed for ${path}:`, err);
    return 0;
  }
}

export async function fetchFamilyDetail(
  familyId: string
): Promise<FamilyDetail> {
  const children = await listChildrenOfFamily(familyId);

  const [rewardCount, categoryCount, feedCount] = await Promise.all([
    safeCount(`families/${familyId}/rewards`),
    safeCount(`families/${familyId}/categories`),
    safeCount(`families/${familyId}/feed`),
  ]);

  // Quests are per-child; aggregate
  let totalQuests = 0;
  let completedQuests = 0;
  for (const child of children) {
    const base = `families/${familyId}/children/${child.id}/quests`;
    totalQuests += await safeCount(base);
    try {
      const cnt = await getCountFromServer(
        query(collection(db, base), where('completed', '==', true))
      );
      completedQuests += cnt.data().count;
    } catch (err) {
      console.warn(`[adminOps] completed-quest count failed:`, err);
    }
  }

  return {
    children,
    rewardCount,
    categoryCount,
    feedCount,
    totalQuests,
    completedQuests,
  };
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const [families, users] = await Promise.all([
    listAllFamilies(),
    listAllUsers(),
  ]);

  // Build ownerUid set for semantic bucketing
  const ownerUids = new Set(
    families.map((f) => f.ownerUid).filter(Boolean) as string[]
  );
  const familyIds = new Set(families.map((f) => f.id));

  let masters = 0;
  let coParents = 0;
  let authChildren = 0;
  let admins = 0;
  let orphans = 0;
  let consentComplete = 0;
  let consentMissing = 0;

  users.forEach((u) => {
    if (u.consentPrivacy && u.consentTerms) consentComplete++;
    else consentMissing++;

    if (u.role === 'admin') {
      admins++;
      return;
    }
    if (u.role === 'child') {
      authChildren++;
      return;
    }
    // parent path
    if (ownerUids.has(u.uid)) {
      masters++;
    } else if (u.familyId && familyIds.has(u.familyId)) {
      coParents++;
    } else {
      orphans++;
    }
  });

  // Per-family aggregation (avoids collectionGroup edge cases)
  const details = await Promise.all(
    families.map(async (f) => ({
      family: f,
      detail: await fetchFamilyDetail(f.id),
    }))
  );

  let totalChildProfiles = 0;
  let totalQuests = 0;
  let completedQuests = 0;
  let totalFeedPosts = 0;
  let totalRewards = 0;

  const topFamilies: AdminStats['topFamilies'] = [];
  details.forEach(({ family, detail }) => {
    totalChildProfiles += detail.children.length;
    totalQuests += detail.totalQuests;
    completedQuests += detail.completedQuests;
    totalFeedPosts += detail.feedCount;
    totalRewards += detail.rewardCount;
    topFamilies.push({
      familyId: family.id,
      familyName: family.name ?? family.id,
      childCount: detail.children.length,
      totalQuests: detail.totalQuests,
      completedQuests: detail.completedQuests,
    });
  });
  topFamilies.sort((a, b) => b.completedQuests - a.completedQuests);

  const completionRate = totalQuests > 0 ? completedQuests / totalQuests : 0;

  return {
    totalFamilies: families.length,
    totalUsers: users.length,
    masters,
    coParents,
    authChildren,
    admins,
    orphans,
    totalChildProfiles,
    totalQuests,
    completedQuests,
    completionRate,
    totalFeedPosts,
    totalRewards,
    consentComplete,
    consentMissing,
    topFamilies: topFamilies.slice(0, 5),
  };
}

// ─── Announcements ─────────────────────────────────────────────

export interface AnnouncementInput {
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  expiresAt?: string;
}

export async function createAnnouncement(
  input: AnnouncementInput
): Promise<void> {
  const actor = currentActor();
  const payload = {
    title: input.title,
    body: input.body,
    severity: input.severity,
    createdAt: new Date().toISOString(),
    createdBy: actor.uid,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  };
  const ref = await addDoc(collection(db, 'announcements'), payload);
  await logAdminAction('create_announcement', `announcements/${ref.id}`, {
    title: input.title,
  });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await logAdminAction('delete_announcement', `announcements/${id}`);
  await deleteDoc(doc(db, 'announcements', id));
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const snap = await getDocs(
    query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(100))
  );
  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as any) } as Announcement)
  );
}

// ─── Feed moderation ───────────────────────────────────────────

export interface FeedPostWithFamily extends FeedPost {
  familyId: string;
}

export async function listAllFeedPosts(
  max = 50
): Promise<FeedPostWithFamily[]> {
  // Iterate families and read each feed directly. This avoids collection
  // group rule edge cases and works with the nested family-scoped rule
  // that already has isAdmin() bypass.
  const families = await listAllFamilies();
  const all: FeedPostWithFamily[] = [];

  await Promise.all(
    families.map(async (f) => {
      try {
        const snap = await getDocs(
          query(
            collection(db, `families/${f.id}/feed`),
            orderBy('createdAt', 'desc'),
            limit(max)
          )
        );
        snap.docs.forEach((d) => {
          all.push({
            id: d.id,
            familyId: f.id,
            ...(d.data() as any),
          } as FeedPostWithFamily);
        });
      } catch (err) {
        console.warn(`[adminOps] feed read failed for ${f.id}:`, err);
      }
    })
  );

  all.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return all.slice(0, max);
}

export async function deleteFeedPostAsAdmin(
  fid: string,
  postId: string
): Promise<void> {
  await logAdminAction('delete_feed_post', `families/${fid}/feed/${postId}`);

  // Cascade delete comments first
  const commentRefs = await collectSubcollectionDocs(
    `families/${fid}/feed/${postId}`,
    'comments'
  );
  if (commentRefs.length) await deleteDocsBatched(commentRefs);
  await deleteDoc(doc(db, `families/${fid}/feed/${postId}`));
}

export async function deleteFeedCommentAsAdmin(
  fid: string,
  postId: string,
  cid: string
): Promise<void> {
  await logAdminAction(
    'delete_feed_comment',
    `families/${fid}/feed/${postId}/comments/${cid}`
  );
  await deleteDoc(
    doc(db, `families/${fid}/feed/${postId}/comments/${cid}`)
  );
}

// ─── Audit logs ────────────────────────────────────────────────

export async function listAuditLogs(max = 100): Promise<AdminAuditLog[]> {
  const snap = await getDocs(
    query(collection(db, 'adminAuditLogs'), orderBy('createdAt', 'desc'), limit(max))
  );
  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as any) } as AdminAuditLog)
  );
}

// ─── Ownership migration ───────────────────────────────────────

export interface ReassignOptions {
  keepOldOwnerAsParent: boolean;
}

export async function reassignFamilyOwner(
  familyId: string,
  newOwnerUid: string,
  newOwnerName: string,
  opts: ReassignOptions = { keepOldOwnerAsParent: true }
): Promise<void> {
  const famRef = doc(db, 'families', familyId);
  const famSnap = await getDoc(famRef);
  if (!famSnap.exists()) throw new Error(`Family ${familyId} not found`);
  const fam = famSnap.data() as any;
  const oldOwnerUid: string | undefined = fam.ownerUid;

  const newMembers: Record<string, 'parent' | 'child'> = { ...(fam.members ?? {}) };
  const newMemberNames: Record<string, string> = { ...(fam.memberNames ?? {}) };

  newMembers[newOwnerUid] = 'parent';
  newMemberNames[newOwnerUid] = newOwnerName;

  if (oldOwnerUid && oldOwnerUid !== newOwnerUid) {
    if (opts.keepOldOwnerAsParent) {
      newMembers[oldOwnerUid] = 'parent';
    } else {
      delete newMembers[oldOwnerUid];
      delete newMemberNames[oldOwnerUid];
    }
  }

  // Step 1: audit log (non-fatal — we still want to attempt the migration
  // even if audit fails, so the user isn't stuck)
  try {
    await logAdminAction('reassign_family_owner', `families/${familyId}`, {
      oldOwnerUid: oldOwnerUid ?? null,
      newOwnerUid,
      keepOldOwnerAsParent: opts.keepOldOwnerAsParent,
    });
  } catch (err) {
    console.warn('[reassignFamilyOwner] audit log failed (continuing):', err);
  }

  // Step 2: family doc update (fatal — the core of the migration)
  try {
    await updateDoc(famRef, {
      ownerUid: newOwnerUid,
      members: newMembers,
      memberNames: newMemberNames,
    });
  } catch (err: any) {
    throw new Error(
      `[가족 문서 업데이트 실패] families/${familyId}: ${err?.message ?? err}`
    );
  }

  // Step 3: new owner's user doc (fatal — needed for client to see family)
  try {
    await updateDoc(doc(db, 'users', newOwnerUid), {
      familyId,
      role: 'parent',
    });
  } catch (err: any) {
    throw new Error(
      `[새 소유자 user 문서 업데이트 실패] users/${newOwnerUid}: ${err?.message ?? err}`
    );
  }

  // Step 4: old owner's user doc (non-fatal — already likely correct)
  if (oldOwnerUid && opts.keepOldOwnerAsParent) {
    try {
      await updateDoc(doc(db, 'users', oldOwnerUid), {
        familyId,
        role: 'parent',
      });
    } catch (err) {
      console.warn(
        '[reassignFamilyOwner] old owner user doc update failed (non-fatal):',
        err
      );
    }
  }
}

// ─── Helpers exposed for tests/UI ──────────────────────────────

export async function getFamilyOwnerEmail(
  ownerUid: string
): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'users', ownerUid));
    return snap.exists() ? (snap.data() as any).email ?? null : null;
  } catch {
    return null;
  }
}
