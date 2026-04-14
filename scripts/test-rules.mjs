/**
 * Firestore Security Rules — automated unit tests.
 *
 * Covers TEST_SCENARIOS.md section M (RBAC) end-to-end, exercising the
 * real firestore.rules file against the Firestore emulator. No real
 * Firebase project or network is used.
 *
 * Prerequisites (one-time):
 *   1. Java JDK 11+ on PATH                      (Firebase emulator needs it)
 *   2. npm install                               (already includes deps)
 *
 * Usage:
 *   # Terminal A:
 *   npm run emulators
 *
 *   # Terminal B:
 *   npm run test:rules
 *
 * Or one-shot:
 *   npm run test:rules:ci
 *
 * Exits non-zero on any failed assertion.
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  setLogLevel,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

setLogLevel('error'); // silence permission-denied noise; assertFails catches them

const PROJECT_ID = 'kidquest-rules-test';
const FAMILY_ID  = 'FAM_TEST';
const OTHER_FAMILY_ID = 'FAM_OTHER';

let env;

// ============================================================
// Helpers
// ============================================================

/** Build a Firestore instance for a given user. `null` uid = unauthenticated. */
function dbAs(uid, opts = {}) {
  if (uid == null) return env.unauthenticatedContext().firestore();
  return env
    .authenticatedContext(uid, { email: `${uid}@test.com`, email_verified: true, ...opts })
    .firestore();
}

/** Seed baseline data using withSecurityRulesDisabled so rules don't block setup. */
async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();

    // Users
    await setDoc(doc(admin, 'users/parent1'), {
      uid: 'parent1', name: 'Parent', email: 'parent1@test.com',
      role: 'parent', familyId: FAMILY_ID,
    });
    await setDoc(doc(admin, 'users/child1'), {
      uid: 'child1', name: 'Child', email: 'child1@test.com',
      role: 'child', familyId: FAMILY_ID,
    });
    await setDoc(doc(admin, 'users/stranger'), {
      uid: 'stranger', name: 'Stranger', email: 'stranger@test.com',
      role: 'parent', familyId: OTHER_FAMILY_ID,
    });

    // Family
    await setDoc(doc(admin, `families/${FAMILY_ID}`), {
      name: 'Test Family',
      inviteCode: FAMILY_ID,
      createdAt: new Date().toISOString(),
      members: { parent1: 'parent', child1: 'child' },
    });
    await setDoc(doc(admin, `families/${OTHER_FAMILY_ID}`), {
      name: 'Other Family',
      inviteCode: OTHER_FAMILY_ID,
      createdAt: new Date().toISOString(),
      members: { stranger: 'parent' },
    });

    // Private config (parent-only)
    await setDoc(doc(admin, `families/${FAMILY_ID}/private/config`), {
      parentPasswordHash: 'hash_xxx',
      parentPasswordSalt: 'salt_xxx',
    });

    // Rewards + categories
    await setDoc(doc(admin, `families/${FAMILY_ID}/rewards/r1`), {
      title: 'Movie Night', description: '', points: 500, icon: '🎬',
    });
    await setDoc(doc(admin, `families/${FAMILY_ID}/categories/c1`), {
      label: 'Sports', color: 'bg-blue-500', icon: '⚽',
      createdAt: new Date().toISOString(),
    });

    // Child + quest + history
    await setDoc(doc(admin, `families/${FAMILY_ID}/children/kid1`), {
      name: 'Kid', avatar: '🦁', totalPoints: 100, level: 2, inventory: [],
    });
    await setDoc(doc(admin, `families/${FAMILY_ID}/children/kid1/quests/q1`), {
      title: 'Homework', points: 20, category: 'homework', completed: false,
    });
    await setDoc(doc(admin, `families/${FAMILY_ID}/children/kid1/history/h1`), {
      title: 'Homework', points: 20, category: 'homework',
      timestamp: new Date().toISOString(),
    });

    // Feed + comment
    await setDoc(doc(admin, `families/${FAMILY_ID}/feed/p1`), {
      authorUid: 'parent1', authorName: 'Parent', authorAvatar: '🦁',
      authorRole: 'parent', text: 'Hello family', createdAt: new Date().toISOString(),
      reactions: {}, commentCount: 0,
    });
    await setDoc(doc(admin, `families/${FAMILY_ID}/feed/p1/comments/cm1`), {
      authorUid: 'child1', authorName: 'Child', authorAvatar: '🐰',
      authorRole: 'child', text: 'Hi!', createdAt: new Date().toISOString(),
    });
  });
}

// ============================================================
// Setup
// ============================================================

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
  await seed();
});

after(async () => {
  if (env) await env.cleanup();
});

// ============================================================
// users/{uid} — role lock
// ============================================================
describe('users/{uid} — privilege escalation', () => {
  test('user can read their own profile', async () => {
    const db = dbAs('parent1');
    await assertSucceeds(getDoc(doc(db, 'users/parent1')));
  });

  test('user CANNOT read another user profile', async () => {
    const db = dbAs('child1');
    await assertFails(getDoc(doc(db, 'users/parent1')));
  });

  test('child CANNOT self-escalate role from child → parent', async () => {
    const db = dbAs('child1');
    await assertFails(
      updateDoc(doc(db, 'users/child1'), { role: 'parent' })
    );
  });

  test('user CAN update their own non-role fields', async () => {
    const db = dbAs('child1');
    await assertSucceeds(
      updateDoc(doc(db, 'users/child1'), {
        uid: 'child1', name: 'New Name', email: 'child1@test.com', role: 'child',
      })
    );
  });
});

// ============================================================
// families/{id}/private/config — parent-only secrets
// ============================================================
describe('families/{id}/private/config — parent-only', () => {
  test('parent CAN read private config (password hash)', async () => {
    const db = dbAs('parent1');
    await assertSucceeds(getDoc(doc(db, `families/${FAMILY_ID}/private/config`)));
  });

  test('child CANNOT read private config', async () => {
    const db = dbAs('child1');
    await assertFails(getDoc(doc(db, `families/${FAMILY_ID}/private/config`)));
  });

  test('stranger CANNOT read private config', async () => {
    const db = dbAs('stranger');
    await assertFails(getDoc(doc(db, `families/${FAMILY_ID}/private/config`)));
  });

  test('parent CAN update private config', async () => {
    const db = dbAs('parent1');
    await assertSucceeds(
      setDoc(doc(db, `families/${FAMILY_ID}/private/config`), {
        parentPasswordHash: 'new_hash',
        parentPasswordSalt: 'new_salt',
      }, { merge: true })
    );
  });

  test('child CANNOT update private config', async () => {
    const db = dbAs('child1');
    await assertFails(
      setDoc(doc(db, `families/${FAMILY_ID}/private/config`), {
        parentPasswordHash: 'evil',
      }, { merge: true })
    );
  });
});

// ============================================================
// families/{id}/rewards — parent writes only
// ============================================================
describe('families/{id}/rewards — parent writes', () => {
  test('family member CAN read rewards', async () => {
    const child = dbAs('child1');
    await assertSucceeds(getDoc(doc(child, `families/${FAMILY_ID}/rewards/r1`)));
  });

  test('stranger CANNOT read rewards', async () => {
    const db = dbAs('stranger');
    await assertFails(getDoc(doc(db, `families/${FAMILY_ID}/rewards/r1`)));
  });

  test('parent CAN create a reward', async () => {
    const db = dbAs('parent1');
    await assertSucceeds(
      setDoc(doc(db, `families/${FAMILY_ID}/rewards/r2`), {
        title: 'New Reward', description: '', points: 300, icon: '🎁',
      })
    );
  });

  test('child CANNOT create a reward', async () => {
    const db = dbAs('child1');
    await assertFails(
      setDoc(doc(db, `families/${FAMILY_ID}/rewards/r3`), {
        title: 'Evil', description: '', points: 1, icon: '😈',
      })
    );
  });
});

// ============================================================
// families/{id}/categories — parent writes only
// ============================================================
describe('families/{id}/categories — parent writes', () => {
  test('parent CAN create a category', async () => {
    const db = dbAs('parent1');
    await assertSucceeds(
      setDoc(doc(db, `families/${FAMILY_ID}/categories/c2`), {
        label: 'Music', color: 'bg-purple-500', icon: '🎵',
        createdAt: new Date().toISOString(),
      })
    );
  });

  test('child CANNOT delete a category', async () => {
    const db = dbAs('child1');
    await assertFails(deleteDoc(doc(db, `families/${FAMILY_ID}/categories/c1`)));
  });
});

// ============================================================
// quests — child may only toggle completed/completedAt
// ============================================================
describe('quests — field-level update whitelist', () => {
  test('child CAN mark quest completed', async () => {
    const db = dbAs('child1');
    await assertSucceeds(
      updateDoc(doc(db, `families/${FAMILY_ID}/children/kid1/quests/q1`), {
        completed: true,
        completedAt: new Date().toISOString(),
      })
    );
  });

  test('child CANNOT change quest title (non-whitelisted field)', async () => {
    const db = dbAs('child1');
    await assertFails(
      updateDoc(doc(db, `families/${FAMILY_ID}/children/kid1/quests/q1`), {
        title: 'Hacked Quest',
      })
    );
  });

  test('child CANNOT change quest points', async () => {
    const db = dbAs('child1');
    await assertFails(
      updateDoc(doc(db, `families/${FAMILY_ID}/children/kid1/quests/q1`), {
        points: 999999,
      })
    );
  });

  test('parent CAN create a new quest', async () => {
    const db = dbAs('parent1');
    await assertSucceeds(
      setDoc(doc(db, `families/${FAMILY_ID}/children/kid1/quests/q2`), {
        title: 'New Quest', points: 10, category: 'chore', completed: false,
      })
    );
  });

  test('child CANNOT create a new quest', async () => {
    const db = dbAs('child1');
    await assertFails(
      setDoc(doc(db, `families/${FAMILY_ID}/children/kid1/quests/q3`), {
        title: 'Free Points', points: 9999, category: 'other', completed: false,
      })
    );
  });

  test('parent CAN delete a quest', async () => {
    const db = dbAs('parent1');
    await assertSucceeds(
      deleteDoc(doc(db, `families/${FAMILY_ID}/children/kid1/quests/q2`))
    );
  });

  test('child CANNOT delete a quest', async () => {
    const db = dbAs('child1');
    await assertFails(
      deleteDoc(doc(db, `families/${FAMILY_ID}/children/kid1/quests/q1`))
    );
  });
});

// ============================================================
// Family isolation — cross-family reads
// ============================================================
describe('cross-family isolation', () => {
  test('stranger CANNOT read our children', async () => {
    const db = dbAs('stranger');
    await assertFails(
      getDoc(doc(db, `families/${FAMILY_ID}/children/kid1`))
    );
  });

  test('stranger CANNOT read our feed', async () => {
    const db = dbAs('stranger');
    await assertFails(
      getDoc(doc(db, `families/${FAMILY_ID}/feed/p1`))
    );
  });

  test('stranger CANNOT write to our rewards', async () => {
    const db = dbAs('stranger');
    await assertFails(
      setDoc(doc(db, `families/${FAMILY_ID}/rewards/evil`), {
        title: 'Hack', description: '', points: 1, icon: '😈',
      })
    );
  });
});

// ============================================================
// Family feed (mini SNS) rules
// ============================================================
describe('feed posts + reactions + comments', () => {
  test('family member CAN read feed', async () => {
    const db = dbAs('child1');
    await assertSucceeds(getDoc(doc(db, `families/${FAMILY_ID}/feed/p1`)));
  });

  test('family member CAN create own post', async () => {
    const db = dbAs('child1');
    await assertSucceeds(
      addDoc(collection(db, `families/${FAMILY_ID}/feed`), {
        authorUid: 'child1', authorName: 'Child', authorAvatar: '🐰',
        authorRole: 'child', text: 'My first post',
        createdAt: new Date().toISOString(), reactions: {}, commentCount: 0,
      })
    );
  });

  test('CANNOT create post impersonating another user', async () => {
    const db = dbAs('child1');
    await assertFails(
      addDoc(collection(db, `families/${FAMILY_ID}/feed`), {
        authorUid: 'parent1', // lying about author
        authorName: 'Parent', authorAvatar: '🦁', authorRole: 'parent',
        text: 'Fake post', createdAt: new Date().toISOString(),
        reactions: {}, commentCount: 0,
      })
    );
  });

  test('non-author CAN toggle their own reaction (allowed whitelist)', async () => {
    const db = dbAs('child1');
    await assertSucceeds(
      updateDoc(doc(db, `families/${FAMILY_ID}/feed/p1`), {
        reactions: { child1: '❤️' },
      })
    );
  });

  test('non-author CANNOT edit post text', async () => {
    const db = dbAs('child1');
    await assertFails(
      updateDoc(doc(db, `families/${FAMILY_ID}/feed/p1`), {
        text: 'hijacked text',
      })
    );
  });

  test('author CAN delete own post', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `families/${FAMILY_ID}/feed/p_del`), {
        authorUid: 'parent1', authorName: 'P', authorAvatar: '🦁',
        authorRole: 'parent', text: 'deletable', createdAt: new Date().toISOString(),
        reactions: {}, commentCount: 0,
      });
    });
    const db = dbAs('parent1');
    await assertSucceeds(deleteDoc(doc(db, `families/${FAMILY_ID}/feed/p_del`)));
  });

  test('non-author CANNOT delete a post', async () => {
    const db = dbAs('child1');
    await assertFails(deleteDoc(doc(db, `families/${FAMILY_ID}/feed/p1`)));
  });

  test('stranger CANNOT read comments', async () => {
    const db = dbAs('stranger');
    await assertFails(
      getDoc(doc(db, `families/${FAMILY_ID}/feed/p1/comments/cm1`))
    );
  });

  test('family member CAN comment as themselves', async () => {
    const db = dbAs('parent1');
    await assertSucceeds(
      addDoc(collection(db, `families/${FAMILY_ID}/feed/p1/comments`), {
        authorUid: 'parent1', authorName: 'Parent', authorAvatar: '🦁',
        authorRole: 'parent', text: 'Reply',
        createdAt: new Date().toISOString(),
      })
    );
  });

  test('family member CANNOT comment impersonating another user', async () => {
    const db = dbAs('child1');
    await assertFails(
      addDoc(collection(db, `families/${FAMILY_ID}/feed/p1/comments`), {
        authorUid: 'parent1', // lying
        authorName: 'Parent', authorAvatar: '🦁', authorRole: 'parent',
        text: 'fake', createdAt: new Date().toISOString(),
      })
    );
  });
});

// ============================================================
// Unauthenticated access — default deny
// ============================================================
describe('unauthenticated access', () => {
  test('anon CANNOT read users', async () => {
    const db = dbAs(null);
    await assertFails(getDoc(doc(db, 'users/parent1')));
  });

  test('anon CANNOT read children', async () => {
    const db = dbAs(null);
    await assertFails(getDoc(doc(db, `families/${FAMILY_ID}/children/kid1`)));
  });

  test('anon CANNOT write anywhere', async () => {
    const db = dbAs(null);
    await assertFails(
      setDoc(doc(db, `families/${FAMILY_ID}/rewards/anon`), {
        title: 'anon', description: '', points: 1, icon: '🤖',
      })
    );
  });
});
