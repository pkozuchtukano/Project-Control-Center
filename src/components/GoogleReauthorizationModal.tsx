import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';

export const GoogleReauthorizationModal = ({ actionTitle, onAuthorized, onClose }: {
  actionTitle: string;
  onAuthorized: () => Promise<void>;
  onClose: () => void;
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.showModal();
    return () => {
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  const runAuthorization = async (submitCode: boolean) => {
    if (busyRef.current || (submitCode && !authCode.trim())) return;
    busyRef.current = true;
    setIsBusy(true);
    setError('');
    try {
      const api = window.electron;
      if (!api) throw new Error('Google authorization requires Electron');
      if (submitCode) {
        // Initializes the existing OAuth client also when a code is pasted directly.
        await api.getGoogleAuthUrl();
        await api.authorizeGoogle(authCode.trim());
      } else {
        await api.logoutGoogle();
        setAuthCode('');
        const url = await api.getGoogleAuthUrl();
        await api.openExternal(url);
      }
    } catch {
      setError(submitCode
        ? 'Nie uda\u0142o si\u0119 autoryzowa\u0107. Sprawd\u017a kod lub pobierz nowy i spr\u00f3buj ponownie.'
        : 'Nie uda\u0142o si\u0119 otworzy\u0107 autoryzacji Google. Sprawd\u017a po\u0142\u0105czenie i konfiguracj\u0119 Google.');
      return;
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
    if (submitCode) {
      setAuthCode('');
      await onAuthorized();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="google-reauthorization-title"
      aria-describedby="google-reauthorization-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busyRef.current) onClose();
      }}
      className="fixed inset-0 m-auto w-full max-w-lg rounded-2xl bg-white p-6 text-gray-900 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm dark:bg-gray-800 dark:text-gray-100"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="google-reauthorization-title" className="text-lg font-bold">{'Odn\u00f3w autoryzacj\u0119 Google'}</h2>
        <button type="button" onClick={onClose} disabled={isBusy} aria-label="Zamknij" className="rounded p-1 disabled:opacity-50"><X size={20} /></button>
      </div>
      <p id="google-reauthorization-description" className="mb-3 text-sm">
        {'Uprawnienia Google wygas\u0142y lub wymagaj\u0105 ponownej autoryzacji. Wyloguj si\u0119 i autoryzuj w przegl\u0105darce, a nast\u0119pnie wklej otrzymany kod poni\u017cej.'}
      </p>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{'Po autoryzacji ponowimy: '}{actionTitle}</p>
      <button type="button" disabled={isBusy} onClick={() => void runAuthorization(false)} className="mb-4 rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 disabled:opacity-50">
        Wyloguj i autoryzuj
      </button>
      <form onSubmit={(event) => { event.preventDefault(); void runAuthorization(true); }} className="space-y-3">
        <label htmlFor="google-reauthorization-code" className="block text-sm font-medium">Kod autoryzacji z Google</label>
        <input id="google-reauthorization-code" type="text" autoComplete="off" spellCheck={false} value={authCode} onChange={(event) => setAuthCode(event.target.value)} disabled={isBusy} placeholder="4/0AX..." className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isBusy} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">Anuluj</button>
          <button type="submit" disabled={isBusy || !authCode.trim()} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
            {isBusy && <Loader2 size={16} className="animate-spin" />}
            {'Zatwierd\u017a kod'}
          </button>
        </div>
      </form>
    </dialog>
  );
};
