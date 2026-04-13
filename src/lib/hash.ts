/**
 * Browser-native SHA-256 hex digest. Used to obfuscate the parent
 * mode gate password so a child poking around DevTools can't read it
 * directly from the family document.
 *
 * NOTE: This is a soft gate, not real authentication. The real auth
 * boundary is Firebase Auth + Firestore rules. This just keeps small
 * children from accidentally entering parent management mode.
 */
export async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
