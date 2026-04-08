const valueOrEmpty = (value?: string) => value?.trim() || '';

export const env = {
  firebaseApiKey: valueOrEmpty(import.meta.env.VITE_FIREBASE_API_KEY),
  firebaseAuthDomain: valueOrEmpty(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  firebaseProjectId: valueOrEmpty(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  firebaseStorageBucket: valueOrEmpty(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  firebaseMessagingSenderId: valueOrEmpty(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  firebaseAppId: valueOrEmpty(import.meta.env.VITE_FIREBASE_APP_ID),
  publicYouTrackBaseUrl: valueOrEmpty(import.meta.env.VITE_YOUTRACK_BASE_URL) || valueOrEmpty(import.meta.env.VITE_PUBLIC_YOUTRACK_BASE_URL),
};

export const hasFirebaseEnv = Boolean(
  env.firebaseApiKey &&
  env.firebaseAuthDomain &&
  env.firebaseProjectId &&
  env.firebaseStorageBucket &&
  env.firebaseMessagingSenderId &&
  env.firebaseAppId
);
