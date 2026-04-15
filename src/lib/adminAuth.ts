import type { User } from 'firebase/auth';
import type { UserAccount } from '../types';

export const ADMIN_EMAIL = 'seo574486@gmail.com';

export function isAdminUser(
  ua: UserAccount | null,
  fbUser: User | null
): boolean {
  if (!ua || !fbUser) return false;
  if (!fbUser.emailVerified) return false;
  return ua.email === ADMIN_EMAIL;
}
