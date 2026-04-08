import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { env, hasFirebaseEnv } from '@/lib/env';

const app = hasFirebaseEnv
  ? initializeApp({
      apiKey: env.firebaseApiKey,
      authDomain: env.firebaseAuthDomain,
      projectId: env.firebaseProjectId,
      storageBucket: env.firebaseStorageBucket,
      messagingSenderId: env.firebaseMessagingSenderId,
      appId: env.firebaseAppId,
    })
  : null;

export const firestore = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
export const googleProvider = auth ? new GoogleAuthProvider() : null;
export const firebaseConfigured = Boolean(app && firestore && auth);

if (googleProvider) {
  googleProvider.setCustomParameters({
    prompt: 'select_account',
  });
}

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  if (!auth) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
};

const resolveFirebaseAuthErrorCode = (error: unknown) => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }

  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : null;
};

export const getFirebaseAuthErrorMessage = (error: unknown) => {
  const errorCode = resolveFirebaseAuthErrorCode(error);

  switch (errorCode) {
    case 'auth/operation-not-allowed':
      return 'Logowanie Google jest wyłączone w Firebase Authentication. Włącz provider Google w Firebase Console: Authentication -> Sign-in method.';
    case 'auth/popup-closed-by-user':
      return 'Okno logowania zostało zamknięte przed zakończeniem logowania.';
    case 'auth/popup-blocked':
      return 'Przeglądarka zablokowała okno logowania. Zezwól na popup i spróbuj ponownie.';
    case 'auth/cancelled-popup-request':
      return 'Poprzednia próba logowania została przerwana przez nową próbę.';
    case 'auth/network-request-failed':
      return 'Nie udało się połączyć z Firebase. Sprawdź połączenie sieciowe i konfigurację domeny autoryzowanej.';
    default:
      return error instanceof Error ? error.message : 'Nie udało się zalogować przez Google.';
  }
};

export const signInWithGoogle = async () => {
  if (!auth || !googleProvider) {
    throw new Error('Firebase Auth nie jest skonfigurowany.');
  }
  return signInWithPopup(auth, googleProvider);
};

export const signOutUser = async () => {
  if (!auth) return;
  await signOut(auth);
};

