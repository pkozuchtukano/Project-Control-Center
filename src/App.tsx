import { lazy, Suspense, useEffect, useRef, useState } from 'react';

import type {
  EmailTemplate,
  Estimation,
  EstimationItem,
  MeetingNoteData,
  OrderItem,
  Project,
  Stakeholder,
} from './types';
import {
  ProjectProvider,
  useDarkMode,
  useOrders,
  useProjectCalculations,
  useProjectContext,
} from './context/ProjectContext';
import { Sidebar } from './components/Sidebar';
import { ProjectModal } from './components/ProjectModal';
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from './utils/appCalculations';

export { useProjectContext, useOrders, useProjectCalculations, useDarkMode };
export type { Project, Stakeholder, Estimation, EstimationItem, MeetingNoteData, OrderItem, EmailTemplate };

const FONT_SCALE_STORAGE_KEY = 'pcc_font_scale';
const DEFAULT_FONT_SCALE = 100;
const MIN_FONT_SCALE = 80;
const MAX_FONT_SCALE = 140;
const FONT_SCALE_STEP = 5;

const DailyMain = lazy(() =>
  import('./features/daily/components/DailyMain').then((module) => ({ default: module.DailyMain })),
);

const DashboardView = lazy(() =>
  import('./features/dashboard/components/DashboardView').then((module) => ({ default: module.DashboardView })),
);

const SettingsModal = lazy(() =>
  import('./features/dashboard/components/DashboardView').then((module) => ({ default: module.SettingsModal })),
);

const ViewLoadingFallback = () => (
  <div className="flex h-full items-center justify-center text-sm font-medium text-gray-500 dark:text-gray-400">
    Ładowanie widoku...
  </div>
);

const isGoogleAuthRefreshError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.includes('invalid_grant')
    || message.includes('Brak aktywnej autoryzacji Google')
    || message.includes('Aktualny token Google nie ma uprawnień')
    || message.includes('insufficient authentication scopes')
    || message.includes('Request had insufficient authentication scopes')
    || message.includes('Zaloguj się ponownie');
};

type PendingGoogleAction = {
  title: string;
  run: () => Promise<void>;
};

export default function App() {
  return (
    <ProjectProvider>
      <MainLayout />
    </ProjectProvider>
  );
}

const MainLayout = () => {
  useDarkMode();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [googleAuthPromptNonce, setGoogleAuthPromptNonce] = useState(0);
  const pendingGoogleActionRef = useRef<PendingGoogleAction | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'daily'>('dashboard');
  const [isDatabaseTransferPending, setIsDatabaseTransferPending] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const applyFontScale = (scale: number) => {
      document.documentElement.style.fontSize = `${scale}%`;
    };

    const getStoredFontScale = () => {
      const storedValue = Number(window.localStorage.getItem(FONT_SCALE_STORAGE_KEY));
      if (!Number.isFinite(storedValue)) return DEFAULT_FONT_SCALE;
      return Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, storedValue));
    };

    let fontScale = getStoredFontScale();
    applyFontScale(fontScale);

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;

      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      const nextFontScale = Math.min(
        MAX_FONT_SCALE,
        Math.max(MIN_FONT_SCALE, fontScale + direction * FONT_SCALE_STEP),
      );

      if (nextFontScale === fontScale) return;

      fontScale = nextFontScale;
      applyFontScale(fontScale);
      window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(fontScale));
    };

    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleOpenModal = () => {
    setEditingProject(null);
    setIsModalOpen(true);
  };

  const handleEditProject = (p: Project) => {
    setEditingProject(p);
    setIsModalOpen(true);
  };

  const requestGoogleAuthorizationAndRetry = (action: PendingGoogleAction) => {
    pendingGoogleActionRef.current = action;
    alert(`Wygasły uprawnienia Google.\n\nAutoryzuj ponownie dostęp do Google. Po poprawnej autoryzacji akcja zostanie wykonana automatycznie:\n${action.title}`);
    setIsSettingsOpen(true);
    setGoogleAuthPromptNonce((current) => current + 1);
  };

  const handleGoogleAuthorized = async () => {
    const pendingAction = pendingGoogleActionRef.current;
    if (!pendingAction) return;

    pendingGoogleActionRef.current = null;
    setIsSettingsOpen(false);
    await pendingAction.run();
  };

  const handleGoogleActionError = (error: unknown, action: PendingGoogleAction, fallbackMessage: string) => {
    const message = error instanceof Error ? error.message : String(error || 'Nieznany błąd.');
    if (isGoogleAuthRefreshError(error)) {
      requestGoogleAuthorizationAndRetry(action);
      return;
    }
    alert(`${fallbackMessage}\n${message}`);
  };

  const performExportDatabase = async () => {
    if (!window.electron?.exportDatabase) return;

    setIsDatabaseTransferPending(true);
    try {
      const result = await window.electron.exportDatabase();
      if (result.canceled || !result.success) return;
      alert(`Baza danych została wyeksportowana do Google Drive.\nPlik: ${result.fileName || 'pcc-baza_danych.db'}`);
    } catch (error: any) {
      handleGoogleActionError(
        error,
        { title: 'Eksport bazy danych do Google Drive', run: () => performExportDatabase() },
        'Nie udało się wyeksportować bazy danych do Google Drive.',
      );
    } finally {
      setIsDatabaseTransferPending(false);
    }
  };

  const handleExportDatabase = async () => {
    await performExportDatabase();
  };

  const performImportDatabase = async () => {
    if (!window.electron?.importDatabase) return;

    setIsDatabaseTransferPending(true);
    try {
      const result = await window.electron.importDatabase();
      if (result.canceled || !result.success) return;
      alert(`Baza danych została pobrana z Google Drive.\nPlik: ${result.fileName || 'pcc-baza_danych.db'}\nAplikacja zostanie odświeżona.`);
      window.location.reload();
    } catch (error: any) {
      handleGoogleActionError(
        error,
        { title: 'Import bazy danych z Google Drive', run: () => performImportDatabase() },
        'Nie udało się pobrać bazy danych z Google Drive.',
      );
    } finally {
      setIsDatabaseTransferPending(false);
    }
  };

  const handleImportDatabase = async () => {
    const shouldImport = window.confirm('Czy pobrać bazę danych z udostępnionego folderu Google Drive i zastąpić nią lokalną bazę?');
    if (!shouldImport) return;
    await performImportDatabase();
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans transition-colors dark:bg-gray-950 dark:text-gray-100 overflow-hidden">
      <Sidebar 
        onOpenModal={handleOpenModal} 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onExportDatabase={handleExportDatabase}
        onImportDatabase={handleImportDatabase}
        isDatabaseTransferPending={isDatabaseTransferPending}
        currentView={currentView}
        onViewChange={setCurrentView}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed(prev => !prev)}
      />
      
      <main className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-950 transition-colors overflow-hidden flex flex-col h-screen">
        <Suspense fallback={<ViewLoadingFallback />}>
          {currentView === 'daily' ? (
            <DailyMain />
          ) : (
            <DashboardView
              onEdit={handleEditProject}
              onGoogleAuthorizationRequired={requestGoogleAuthorizationAndRetry}
            />
          )}
        </Suspense>
      </main>

      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectToEdit={editingProject}
      />

      {isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            googleAuthPromptNonce={googleAuthPromptNonce}
            onGoogleAuthorized={handleGoogleAuthorized}
            onGoogleAuthorizationRequired={requestGoogleAuthorizationAndRetry}
          />
        </Suspense>
      )}
    </div>
  );
};
