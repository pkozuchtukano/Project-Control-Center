import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Moon,
  Plus,
  Settings as SettingsIcon,
  Sun,
} from 'lucide-react';
import { DailyMain } from '@/features/daily/components/DailyMain';
import { StatusMain } from '@/features/status/components/StatusMain';
import { pccRepository } from '@/repositories/pccRepository';
import { appStorageKeys, readLocalJson, writeLocalJson } from '@/lib/storage';
import { createClientId, cn } from '@/lib/utils';
import { env } from '@/lib/env';
import { firebaseConfigured, getFirebaseAuthErrorMessage, signInWithGoogle, signOutUser, subscribeToAuth } from '@/lib/firebase';
import { testYouTrackConnection } from '@/services/youtrackApi';
import { AuthScreen } from '@/components/AuthScreen';
import type { AppSettings, Project } from '@/types/domain';

const ProjectModal = ({
  isOpen,
  projectToEdit,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  projectToEdit: Project | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [youtrackQuery, setYoutrackQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setCode(projectToEdit?.code || '');
    setName(projectToEdit?.name || '');
    setYoutrackQuery(projectToEdit?.youtrackQuery || projectToEdit?.code || '');
  }, [isOpen, projectToEdit]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{projectToEdit ? 'Edytuj projekt' : 'Nowy projekt'}</h2>
        </div>
        <form
          className="space-y-4 p-6"
          onSubmit={async (event) => {
            event.preventDefault();
            await pccRepository.saveProject({
              id: projectToEdit?.id || createClientId('project'),
              code: code.trim(),
              name: name.trim(),
              youtrackQuery: youtrackQuery.trim() || code.trim(),
            });
            onSaved();
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Kod projektu</label>
            <input
              required
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Nazwa projektu</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">YouTrack Query</label>
            <input
              value={youtrackQuery}
              onChange={(event) => setYoutrackQuery(event.target.value)}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
              Anuluj
            </button>
            <button type="submit" className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700">
              Zapisz
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SettingsModal = ({ isOpen, onClose, user }: { isOpen: boolean; onClose: () => void; user: User | null }) => {
  const [settings, setSettings] = useState<AppSettings>({ firebaseConfigured, youtrackBaseUrlDetected: false, lastConnectionStatus: 'idle' });
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (isOpen) void pccRepository.getSettings().then(setSettings);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <SettingsIcon size={20} className="text-indigo-500" />Ustawienia G³ówne
          </h2>
        </div>
        <div className="space-y-5 p-6">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Firebase</p>
            <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              {firebaseConfigured ? 'Konfiguracja wykryta.' : 'Brak pe³nej konfiguracji Firebase w env.'}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {user ? `Zalogowano jako: ${user.email || user.displayName || user.uid}` : 'Brak aktywnej sesji.'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">YouTrack</p>
            <div className="mt-3 space-y-2">
              {settings.lastConnectionStatus === 'success' && (
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 size={16} />
                  {settings.lastConnectionMessage}
                </div>
              )}
              {settings.lastConnectionStatus === 'error' && (
                <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
                  <AlertCircle size={16} />
                  {settings.lastConnectionMessage}
                </div>
              )}
              <button
                onClick={async () => {
                  setIsChecking(true);
                  try {
                    const result = await testYouTrackConnection();
                    const next: AppSettings = {
                      ...settings,
                      youtrackBaseUrlDetected: result.baseUrlDetected,
                      lastConnectionStatus: result.success ? 'success' : 'error',
                      lastConnectionMessage: result.message,
                    };
                    setSettings(next);
                    await pccRepository.saveSettings(next);
                  } catch (caughtError) {
                    const next: AppSettings = {
                      ...settings,
                      lastConnectionStatus: 'error',
                      lastConnectionMessage: caughtError instanceof Error ? caughtError.message : 'Nie uda³o siê sprawdziæ po³¹czenia.',
                    };
                    setSettings(next);
                    await pccRepository.saveSettings(next);
                  } finally {
                    setIsChecking(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {isChecking && <Loader2 size={16} className="animate-spin" />}
                Test po³¹czenia
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={onClose} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
              Zamknij
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
    <div className="inline-flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm font-semibold text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
      <Loader2 size={18} className="animate-spin text-indigo-500" />
      Sprawdzanie sesji logowania...
    </div>
  </div>
);

export const App = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [currentView, setCurrentView] = useState<'daily' | 'status'>('daily');
  const [isDark, setIsDark] = useState(() => readLocalJson(appStorageKeys.darkMode, true));
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const loadProjects = async () => setProjects(await pccRepository.getProjects());

  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      setAuthStatus(user ? 'authenticated' : 'unauthenticated');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    writeLocalJson(appStorageKeys.darkMode, isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      setProjects([]);
      setSelectedProject(null);
      return;
    }
    void loadProjects();
  }, [authStatus]);

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/daily') setCurrentView('daily');
    const statusMatch = path.match(/^\/projects\/([^/]+)\/status$/);
    if (statusMatch) {
      setCurrentView('status');
      const projectId = statusMatch[1];
      const project = projects.find((item) => item.id === projectId);
      if (project) setSelectedProject(project);
    }
  }, [projects]);

  const navigate = (view: 'daily' | 'status', project?: Project | null) => {
    setCurrentView(view);
    if (view === 'daily') {
      window.history.pushState({}, '', '/daily');
      return;
    }
    if (project) {
      setSelectedProject(project);
      window.history.pushState({}, '', `/projects/${project.id}/status`);
      writeLocalJson(appStorageKeys.selectedProjectId, project.id);
      return;
    }
    const fallback = selectedProject || projects[0] || null;
    if (fallback) {
      setSelectedProject(fallback);
      window.history.pushState({}, '', `/projects/${fallback.id}/status`);
      writeLocalJson(appStorageKeys.selectedProjectId, fallback.id);
    }
  };

  const resolvedBaseUrl = useMemo(() => env.publicYouTrackBaseUrl, []);

  if (authStatus === 'loading') {
    return <LoadingScreen />;
  }

  if (authStatus === 'unauthenticated') {
    return (
      <AuthScreen
        isConfigured={firebaseConfigured}
        isSigningIn={isSigningIn}
        error={authError}
        onSignIn={() => {
          setAuthError(null);
          setIsSigningIn(true);
          void signInWithGoogle()
            .catch((error: unknown) => {
              setAuthError(getFirebaseAuthErrorMessage(error));
            })
            .finally(() => setIsSigningIn(false));
        }}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
      <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col border-r border-gray-200 bg-white transition-colors dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 p-6 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <LayoutDashboard size={18} />
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">PCC Web</h1>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsSettingsOpen(true)} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800" title="Ustawienia G³ówne">
              <SettingsIcon size={18} />
            </button>
            <button onClick={() => setIsDark((current) => !current)} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800" title="Zmieñ motyw">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Projekty</h2>
            <button onClick={() => { setEditingProject(null); setIsProjectModalOpen(true); }} className="rounded-md bg-indigo-50 p-1 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400">
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-1">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => navigate('status', project)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all',
                  currentView === 'status' && selectedProject?.id === project.id
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-600 dark:text-white'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                )}
              >
                <Briefcase size={16} className={currentView === 'status' && selectedProject?.id === project.id ? 'opacity-100' : 'opacity-50'} />
                <span className="truncate">{project.code}</span>
              </button>
            ))}
            {projects.length === 0 && <p className="py-4 text-center text-sm text-gray-400">Brak projektów</p>}
          </div>

          <div className="mt-8 border-t border-gray-100 pt-6 dark:border-gray-800">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Narzêdzia</h2>
            <button
              onClick={() => navigate('daily')}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all',
                currentView === 'daily'
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-600 dark:text-white'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
              )}
            >
              <LayoutDashboard size={16} className={currentView === 'daily' ? 'opacity-100' : 'opacity-50'} />
              <span className="font-semibold">DAILY</span>
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100 p-4 dark:border-gray-800">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{currentUser?.displayName || currentUser?.email || 'U¿ytkownik'}</p>
            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{currentUser?.email || currentUser?.uid}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                Zalogowano
              </span>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-600 hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <LogOut size={12} />
                Wyloguj
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">Webowa replika Daily / Status</p>
        </div>
      </aside>

      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-gray-50 transition-colors dark:bg-gray-950">
        {currentView === 'daily' ? (
          <DailyMain youtrackBaseUrl={resolvedBaseUrl} />
        ) : selectedProject ? (
          <div className="flex-1 overflow-y-auto p-6">
            <StatusMain project={selectedProject} youtrackBaseUrl={resolvedBaseUrl} />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-500">Wybierz projekt.</div>
        )}
      </main>

      <ProjectModal
        isOpen={isProjectModalOpen}
        projectToEdit={editingProject}
        onClose={() => setIsProjectModalOpen(false)}
        onSaved={() => {
          setIsProjectModalOpen(false);
          void loadProjects();
        }}
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} user={currentUser} />
    </div>
  );
};
