import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';

export const YouTrackAuthModal = ({ onClose }: { onClose: () => void }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.showModal();
    return () => {
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  const dismiss = async () => {
    if (busyRef.current) return;
    try {
      await window.electron?.closeYouTrackAuth();
      onClose();
    } catch {
      setError('Nie uda\u0142o si\u0119 zamkn\u0105\u0107 logowania. Spr\u00f3buj ponownie.');
    }
  };

  const run = async (action: 'open' | 'link' | 'check') => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const api = window.electron;
      if (!api) throw new Error('Logowanie jest dost\u0119pne w aplikacji desktopowej.');
      if (action === 'open') {
        await api.openYouTrackAuth();
        setMessage('Wpisz e-mail w otwartym oknie. Nast\u0119pnie skopiuj link z wiadomo\u015bci i wklej go poni\u017cej.');
      } else if (action === 'link') {
        const submittedLink = link.trim();
        setLink('');
        await api.submitYouTrackAuthLink(submittedLink);
        setMessage('Doko\u0144cz logowanie w otwartym oknie, a nast\u0119pnie sprawd\u017a po\u0142\u0105czenie.');
      } else {
        const result = await api.checkYouTrackAuth();
        setConnected(true);
        setLink('');
        setMessage(`Po\u0142\u0105czono z YouTrack jako ${result.login}. Oczekuj\u0105ce pobieranie danych jest wznawiane automatycznie.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie uda\u0142o si\u0119 po\u0142\u0105czy\u0107 z YouTrack.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const buttonClass = 'rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 disabled:opacity-50';
  return (
    <dialog ref={dialogRef} aria-labelledby="youtrack-auth-title" aria-describedby="youtrack-auth-description"
      onCancel={(event) => { event.preventDefault(); void dismiss(); }}
      className="fixed inset-0 m-auto w-full max-w-lg rounded-2xl bg-white p-6 text-gray-900 shadow-xl backdrop:bg-black/50 dark:bg-gray-800 dark:text-gray-100">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="youtrack-auth-title" className="text-lg font-bold">Logowanie YouTrack / authentik</h2>
        <button type="button" onClick={() => void dismiss()} disabled={busy} aria-label="Zamknij" className="rounded p-1 disabled:opacity-50"><X size={20} /></button>
      </div>
      <p id="youtrack-auth-description" className="mb-4 text-sm">
        {'Otw\u00f3rz logowanie i podaj e-mail. Link z wiadomo\u015bci wklej tutaj, aby zalogowa\u0107 aplikacj\u0119. Po wyga\u015bni\u0119ciu sesji powt\u00f3rz te kroki.'}
        {' Synchronizacja poczeka na logowanie i wznowi si\u0119 po sprawdzeniu po\u0142\u0105czenia. Anulowanie przerwie oczekuj\u0105ce pobieranie.'}
      </p>
      {!connected && <>
        <button type="button" disabled={busy} onClick={() => void run('open')} className={`${buttonClass} mb-4`}>{'1. Otw\u00f3rz okno logowania'}</button>
        <form onSubmit={(event) => { event.preventDefault(); void run('link'); }} className="space-y-3">
          <label htmlFor="youtrack-email-link" className="block text-sm font-medium">2. Link z e-maila</label>
          <input id="youtrack-email-link" type="password" autoComplete="off" spellCheck={false} value={link}
            onChange={(event) => setLink(event.target.value)} disabled={busy} placeholder="https://..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
          <button type="submit" disabled={busy || !link.trim()} className={buttonClass}>{'Otw\u00f3rz wklejony link'}</button>
        </form>
      </>}
      {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {message && <p role="status" className="mt-4 text-sm">{message}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" disabled={busy} onClick={() => void dismiss()} className={buttonClass}>{connected ? 'Gotowe' : 'Anuluj'}</button>
        {!connected && <button type="button" disabled={busy} onClick={() => void run('check')}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">
          {busy && <Loader2 size={16} className="animate-spin" />}{'3. Sprawd\u017a po\u0142\u0105czenie'}
        </button>}
      </div>
    </dialog>
  );
};
