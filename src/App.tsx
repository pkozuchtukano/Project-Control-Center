import { lazy, Suspense, useEffect, useState } from 'react';

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

  const handleOpenModal = () => {
    setEditingProject(null);
    setIsModalOpen(true);
  };

  const handleEditProject = (p: Project) => {
    setEditingProject(p);
    setIsModalOpen(true);
  };

  const handleExportDatabase = async () => {
    if (!window.electron?.exportDatabase) return;

    setIsDatabaseTransferPending(true);
    try {
      const result = await window.electron.exportDatabase();
      if (result.canceled || !result.success) return;
      alert(`Baza danych została wyeksportowana do Google Drive.\nPlik: ${result.fileName || 'pcc-baza_danych.db'}`);
    } catch (error: any) {
      alert(`Nie udało się wyeksportować bazy danych do Google Drive.\n${error?.message || 'Nieznany błąd.'}`);
    } finally {
      setIsDatabaseTransferPending(false);
    }
  };

  const handleImportDatabase = async () => {
    if (!window.electron?.importDatabase) return;

    const shouldImport = window.confirm('Czy pobrać bazę danych z udostępnionego folderu Google Drive i zastąpić nią lokalną bazę?');
    if (!shouldImport) return;

    setIsDatabaseTransferPending(true);
    try {
      const result = await window.electron.importDatabase();
      if (result.canceled || !result.success) return;
      alert(`Baza danych została pobrana z Google Drive.\nPlik: ${result.fileName || 'pcc-baza_danych.db'}\nAplikacja zostanie odświeżona.`);
      window.location.reload();
    } catch (error: any) {
      alert(`Nie udało się pobrać bazy danych z Google Drive.\n${error?.message || 'Nieznany błąd.'}`);
    } finally {
      setIsDatabaseTransferPending(false);
    }
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
            <DashboardView onEdit={handleEditProject} />
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
          />
        </Suspense>
      )}
    </div>
  );
};
