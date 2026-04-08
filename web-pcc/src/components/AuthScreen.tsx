import { AlertCircle, Loader2, LogIn, ShieldCheck } from 'lucide-react';

export const AuthScreen = ({
  isConfigured,
  isSigningIn,
  error,
  onSignIn,
}: {
  isConfigured: boolean;
  isSigningIn: boolean;
  error: string | null;
  onSignIn: () => void;
}) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_50%,#f8fafc_100%)] p-6 dark:bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.22),_transparent_35%),linear-gradient(180deg,#020617_0%,#0f172a_50%,#020617_100%)]">
      <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/60 bg-white/90 shadow-2xl shadow-indigo-200/60 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 dark:shadow-black/30">
        <div className="border-b border-gray-100 px-8 py-6 dark:border-gray-800">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-500">PCC Web</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-gray-900 dark:text-white">Logowanie do aplikacji</h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-gray-500 dark:text-gray-400">
            Dostęp do modułów <strong>Daily</strong> i <strong>Status</strong> jest dostępny tylko po zalogowaniu przez Firebase Auth.
          </p>
        </div>

        <div className="space-y-5 px-8 py-7">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 text-sm text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-100">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-indigo-500" size={18} />
              <div>
                <p className="font-bold">Dane Firestore są odseparowane per użytkownik.</p>
                <p className="mt-1 text-indigo-900/80 dark:text-indigo-100/80">
                  Po zalogowaniu dokumenty są odczytywane i zapisywane tylko dla Twojego `uid`.
                </p>
              </div>
            </div>
          </div>

          {!isConfigured && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 shrink-0" size={18} />
                <div>
                  <p className="font-bold">Brak pełnej konfiguracji Firebase.</p>
                  <p className="mt-1">Uzupełnij `VITE_FIREBASE_*` w środowisku i włącz metodę logowania Google w Firebase Console.</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 shrink-0" size={18} />
                <div>
                  <p className="font-bold">Logowanie nie powiodło się.</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onSignIn}
            disabled={!isConfigured || isSigningIn}
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-indigo-300/50 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-indigo-950/30"
          >
            {isSigningIn ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {isSigningIn ? 'Logowanie...' : 'Zaloguj przez Google'}
          </button>
        </div>
      </div>
    </div>
  );
};
