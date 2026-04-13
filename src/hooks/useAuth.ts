import { useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDocFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserAccount } from '../types';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';

export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error('Please check your Firebase configuration. The client is offline.');
          }
        }

        const userRef = doc(db, 'users', u.uid);
        onSnapshot(
          userRef,
          (snap) => {
            if (snap.exists()) {
              setUserAccount({ uid: u.uid, ...snap.data() } as UserAccount);
            } else {
              const newAccount: UserAccount = {
                uid: u.uid,
                email: u.email || '',
                name: u.displayName || '사용자',
                role: 'parent',
              };
              setDoc(userRef, newAccount).catch((err) => {
                handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`);
              });
              setUserAccount(newAccount);
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
          }
        );
      } else {
        setUserAccount(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  return { user, userAccount, isAuthReady };
}
