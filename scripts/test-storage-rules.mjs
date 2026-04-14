/**
 * Firebase Storage Security Rules — automated tests.
 *
 * Covers TEST_SCENARIOS.md section N end-to-end against the real
 * storage.rules file via the Firebase Storage emulator.
 *
 * Prerequisites:
 *   - Java JDK 11+ (handled by scripts/with-java.mjs wrapper)
 *   - Storage emulator running on port 9199 (handled by emulators:exec)
 *
 * Usage:
 *   npm run test:storage:ci      # emulator + tests + shutdown, one-shot
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { readFileSync } from 'node:fs';
import { test, describe, before, after } from 'node:test';

const PROJECT_ID = 'kidquest-storage-test';
const FAMILY_ID  = 'FAM_TEST';
const OTHER_FAMILY_ID = 'FAM_OTHER';

let env;

// ============================================================
// Helpers
// ============================================================

/** Build a Storage instance for a given user. null = unauthenticated. */
function storageAs(uid) {
  if (uid == null) return env.unauthenticatedContext().storage();
  return env.authenticatedContext(uid, { email: `${uid}@test.com` }).storage();
}

/** Build a tiny fake-image Uint8Array of the given byte length. */
function makeBlob(bytes, type = 'image/jpeg') {
  const data = new Uint8Array(bytes);
  // Minimal JPEG magic bytes so content-type sniff isn't entirely fake
  if (type === 'image/jpeg' && bytes >= 4) {
    data[0] = 0xff; data[1] = 0xd8; data[2] = 0xff; data[3] = 0xe0;
  }
  return { data, metadata: { contentType: type } };
}

const SMALL_IMAGE = makeBlob(1024, 'image/jpeg');             // 1KB
const LARGE_IMAGE = makeBlob(4 * 1024 * 1024, 'image/jpeg');  // 4MB (over limit)
const TEXT_FILE   = makeBlob(100, 'text/plain');              // disallowed type

// ============================================================
// Setup
// ============================================================

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      rules: readFileSync('storage.rules', 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

after(async () => {
  if (env) await env.cleanup();
});

// ============================================================
// Child avatar uploads
// ============================================================
describe('families/{id}/children/{childId}/* — avatars', () => {
  test('authenticated user CAN upload a valid image', async () => {
    const storage = storageAs('parent1');
    const r = ref(storage, `families/${FAMILY_ID}/children/kid1/avatar_1.jpg`);
    await assertSucceeds(uploadBytes(r, SMALL_IMAGE.data, SMALL_IMAGE.metadata));
  });

  test('authenticated user CAN read an image', async () => {
    // First seed via bypassed env
    await env.withSecurityRulesDisabled(async (ctx) => {
      const s = ctx.storage();
      await uploadBytes(
        ref(s, `families/${FAMILY_ID}/children/kid1/seeded.jpg`),
        SMALL_IMAGE.data,
        SMALL_IMAGE.metadata
      );
    });
    const storage = storageAs('child1');
    await assertSucceeds(
      getBytes(ref(storage, `families/${FAMILY_ID}/children/kid1/seeded.jpg`))
    );
  });

  test('unauthenticated user CANNOT upload', async () => {
    const storage = storageAs(null);
    const r = ref(storage, `families/${FAMILY_ID}/children/kid1/anon.jpg`);
    await assertFails(uploadBytes(r, SMALL_IMAGE.data, SMALL_IMAGE.metadata));
  });

  test('upload over 3MB CANNOT succeed', async () => {
    const storage = storageAs('parent1');
    const r = ref(storage, `families/${FAMILY_ID}/children/kid1/huge.jpg`);
    await assertFails(uploadBytes(r, LARGE_IMAGE.data, LARGE_IMAGE.metadata));
  });

  test('non-image file type CANNOT be uploaded', async () => {
    const storage = storageAs('parent1');
    const r = ref(storage, `families/${FAMILY_ID}/children/kid1/malware.txt`);
    await assertFails(uploadBytes(r, TEXT_FILE.data, TEXT_FILE.metadata));
  });

  test('authenticated user CAN delete their avatar', async () => {
    // Seed first
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(
        ref(ctx.storage(), `families/${FAMILY_ID}/children/kid1/to_delete.jpg`),
        SMALL_IMAGE.data,
        SMALL_IMAGE.metadata
      );
    });
    const storage = storageAs('parent1');
    await assertSucceeds(
      deleteObject(ref(storage, `families/${FAMILY_ID}/children/kid1/to_delete.jpg`))
    );
  });
});

// ============================================================
// Family feed images
// ============================================================
describe('families/{id}/feed/* — feed photos', () => {
  test('authenticated user CAN upload a feed image', async () => {
    const storage = storageAs('child1');
    const r = ref(storage, `families/${FAMILY_ID}/feed/post_001.jpg`);
    await assertSucceeds(uploadBytes(r, SMALL_IMAGE.data, SMALL_IMAGE.metadata));
  });

  test('authenticated user CAN read feed images', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(
        ref(ctx.storage(), `families/${FAMILY_ID}/feed/seeded_post.jpg`),
        SMALL_IMAGE.data,
        SMALL_IMAGE.metadata
      );
    });
    const storage = storageAs('parent1');
    await assertSucceeds(
      getBytes(ref(storage, `families/${FAMILY_ID}/feed/seeded_post.jpg`))
    );
  });

  test('unauthenticated user CANNOT upload feed images', async () => {
    const storage = storageAs(null);
    const r = ref(storage, `families/${FAMILY_ID}/feed/anon.jpg`);
    await assertFails(uploadBytes(r, SMALL_IMAGE.data, SMALL_IMAGE.metadata));
  });

  test('oversized feed image CANNOT be uploaded', async () => {
    const storage = storageAs('parent1');
    const r = ref(storage, `families/${FAMILY_ID}/feed/huge_post.jpg`);
    await assertFails(uploadBytes(r, LARGE_IMAGE.data, LARGE_IMAGE.metadata));
  });

  test('non-image feed upload CANNOT succeed', async () => {
    const storage = storageAs('parent1');
    const r = ref(storage, `families/${FAMILY_ID}/feed/doc.txt`);
    await assertFails(uploadBytes(r, TEXT_FILE.data, TEXT_FILE.metadata));
  });
});

// ============================================================
// Default deny for other paths
// ============================================================
describe('default deny', () => {
  test('writes outside families/* are blocked', async () => {
    const storage = storageAs('parent1');
    const r = ref(storage, 'random/path/file.jpg');
    await assertFails(uploadBytes(r, SMALL_IMAGE.data, SMALL_IMAGE.metadata));
  });

  test('writes to /users/* are blocked', async () => {
    const storage = storageAs('parent1');
    const r = ref(storage, 'users/parent1/profile.jpg');
    await assertFails(uploadBytes(r, SMALL_IMAGE.data, SMALL_IMAGE.metadata));
  });

  test('unauthenticated reads of random paths are blocked', async () => {
    const storage = storageAs(null);
    const r = ref(storage, 'random.jpg');
    await assertFails(getBytes(r));
  });
});
