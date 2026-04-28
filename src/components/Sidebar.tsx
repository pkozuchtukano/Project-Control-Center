import {
  Activity,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileUp,
  LayoutDashboard,
  Loader2,
  Plus,
  Settings as SettingsIcon,
} from 'lucide-react';

import type { Project } from '../types';
import { useProjectContext } from '../context/ProjectContext';

export const Sidebar = ({ onOpenModal, onOpenSettings, onExportDatabase, onImportDatabase, isDatabaseTransferPending, currentView, onViewChange, isCollapsed, onToggleCollapsed }: {
  onOpenModal: () => void,
  onOpenSettings: () => void,
  onExportDatabase: () => Promise<void>,
  onImportDatabase: () => Promise<void>,
  isDatabaseTransferPending: boolean,
  currentView: 'dashboard' | 'daily',
  onViewChange: (view: 'dashboard' | 'daily') => void,
  isCollapsed: boolean,
  onToggleCollapsed: () => void
}) => {
  const { projects, selectedProject, setSelectedProject, isLoading } = useProjectContext();

  const handleProjectClick = (p: Project) => {
    onViewChange('dashboard');
    setSelectedProject(p);
  };

  const handleDailyClick = () => {
    onViewChange('daily');
    setSelectedProject(null);
  };

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col h-screen h-full sticky top-0 transition-all duration-200 shrink-0`}>
      <div className={`${isCollapsed ? 'p-3' : 'p-6'} flex items-center ${isCollapsed ? 'flex-col gap-2' : 'justify-between'} border-b border-gray-100 dark:border-gray-800`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'}`}>
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <LayoutDashboard size={18} />
          </div>
          {!isCollapsed && <h1 className="font-bold text-lg text-gray-900 dark:text-white">PCC</h1>}
        </div>
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2' : 'gap-1'}`}>
          <button
            onClick={onToggleCollapsed}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            title={isCollapsed ? 'Rozwiń sidebar' : 'Zminimalizuj sidebar'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          {!isCollapsed && (
            <>
              <button onClick={onOpenSettings} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors" title="Ustawienia Główne">
                <SettingsIcon size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`${isCollapsed ? 'p-3' : 'p-4'} flex-1 overflow-y-auto`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} mb-4`}>
          {!isCollapsed && <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Projekty</h2>}
          <button
            onClick={onOpenModal}
            className="p-1 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 transition-colors"
            title="Dodaj projekt"
          >
            <Plus size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-4"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
        ) : (
          <div className="space-y-1">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => handleProjectClick(p)}
                title={p.code}
                className={`w-full ${isCollapsed ? 'justify-center px-2 py-2.5' : 'text-left px-3 py-2.5'} rounded-lg text-sm font-medium transition-all flex items-center gap-3 ${currentView === 'dashboard' && selectedProject?.id === p.id
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-600 dark:text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
              >
                <Briefcase size={16} className={currentView === 'dashboard' && selectedProject?.id === p.id ? 'opacity-100' : 'opacity-50'} />
                {!isCollapsed && <span className="truncate">{p.code}</span>}
              </button>
            ))}
            {projects.length === 0 && (
              <p className={`text-sm text-gray-400 text-center py-4 ${isCollapsed ? 'hidden' : ''}`}>Brak projektów</p>
            )}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
          {!isCollapsed && <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Narzędzia</h2>}
          <button
            onClick={handleDailyClick}
            title="DAILY"
            className={`w-full ${isCollapsed ? 'justify-center px-2 py-2.5' : 'text-left px-3 py-2.5'} rounded-lg text-sm font-medium transition-all flex items-center gap-3 ${currentView === 'daily'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-600 dark:text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
          >
            <Activity size={16} className={currentView === 'daily' ? 'opacity-100' : 'opacity-50'} />
            {!isCollapsed && <span className="font-semibold">DAILY</span>}
          </button>
        </div>
      </div>

      <div className={`${isCollapsed ? 'p-3' : 'p-4'} border-t border-gray-100 dark:border-gray-800 space-y-4`}>
        <div className="space-y-2">
          <button
            onClick={() => void onExportDatabase()}
            disabled={isDatabaseTransferPending}
            title="Eksport bazy"
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown size={16} />
            {!isCollapsed && 'Eksport bazy'}
          </button>
          <button
            onClick={() => void onImportDatabase()}
            disabled={isDatabaseTransferPending}
            title="Import bazy"
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileUp size={16} />
            {!isCollapsed && 'Import bazy'}
          </button>
        </div>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`} title="Admin - Project Manager">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            PM
          </div>
          {!isCollapsed && <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Admin</p>
            <p className="text-xs text-gray-500">Project Manager</p>
          </div>}
        </div>
      </div>
    </aside>
  );
};
