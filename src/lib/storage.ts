import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, storage } from '../firebase';

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'JPG, PNG, WEBP 파일만 업로드할 수 있어요';
  }
  if (file.size > MAX_FILE_SIZE) {
    return '사진은 3MB 이하만 가능해요';
  }
  return null;
}

// Produce an unguessable filename token. crypto.randomUUID is available
// in all modern browsers we target; fall back to a longer Math.random
// string only for environments (tests) where it's missing.
function randomToken(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '');
    }
  } catch {}
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Authentication required for upload');
  return uid;
}

export async function uploadChildAvatar(
  familyId: string,
  childId: string,
  file: File
): Promise<string> {
  const uid = requireUid();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  // Filename pattern: `{uploaderUid}_{randomToken}.{ext}` — Storage
  // rules enforce the uid prefix so a compromised client can't write
  // objects that impersonate another user.
  const path = `families/${familyId}/children/${childId}/${uid}_${randomToken()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return await getDownloadURL(storageRef);
}

export async function deleteChildAvatar(url: string): Promise<void> {
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch (e) {
    // ignore — object may already be gone
    console.warn('Failed to delete old avatar:', e);
  }
}

export async function uploadFeedImage(
  familyId: string,
  file: File
): Promise<string> {
  const uid = requireUid();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `families/${familyId}/feed/${uid}_${randomToken()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  // The returned download URL carries a long-lived capability token.
  // Direct path-based reads are denied by storage.rules, so family
  // membership is effectively enforced via Firestore (which stores
  // this URL under the feed post doc and is family-scoped).
  return await getDownloadURL(storageRef);
}
