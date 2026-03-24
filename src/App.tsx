import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';

import type { 
  Project, Order, Settings, Stakeholder, TaskType, 
  DailyHub, DailySection, DailyComment, 
  Estimation, EstimationItem, MeetingNoteData, OrderItem, EmailTemplate, StatusReport, ProjectLink
} from './types';

declare global {
  interface Window {
    electron?: {
      readDb: () => Promise<{ projects: Project[], orders: Order[], settings?: Settings }>;
      writeDb: (data: { projects: Project[], orders: Order[] }) => Promise<{ success: boolean }>;
      fetchYouTrack: (options: any) => Promise<any>;
      getExcludedIssues: () => Promise<string[]>;
      setIssueExcluded: (id: string, excluded: boolean) => Promise<{ success: boolean }>;
      getYoutrackTabs: (projectId: string) => Promise<{ id: string; projectId: string; name: string; statuses: string[]; includeFilters?: boolean; orderIndex?: number }[]>;
      saveYoutrackTab: (tab: { id: string; projectId: string; name: string; statuses: string[]; includeFilters?: boolean; orderIndex?: number }) => Promise<{ success: boolean }>;
      deleteYoutrackTab: (id: string) => Promise<{ success: boolean }>;
      reorderYoutrackTabs: (tabs: { id: string; orderIndex: number }[]) => Promise<{ success: boolean }>;
      getIssueTaskTypes: (issueIds: string[]) => Promise<Record<string, string>>;
      setIssueTaskType: (issueId: string, taskTypeId: string) => Promise<{ success: boolean }>;
      getWorkItems: (projectId: string) => Promise<any[]>;
      upsertWorkItems: (data: { items: any[], projectId: string }) => Promise<{ success: boolean }>;
      getOrderItemTemplate: (projectId: string) => Promise<{ names?: string[]; lastDate?: string } | null>;
      saveOrderItemTemplate: (data: { projectId: string, data: { names: string[]; lastDate: string } }) => Promise<{ success: boolean }>;
      getIssueCategories: () => Promise<Record<string, string>>;
      setIssueCategory: (data: { issueId: string, category: string }) => Promise<{ success: boolean }>;
      importOrders: (data: { orders: any[], projectId: string }) => Promise<{ success: boolean }>;
      getEstimation: (projectId: string) => Promise<any>;
      saveEstimation: (data: { projectId: string, data: any }) => Promise<{ success: boolean }>;
      getMeetingNotes: (projectId: string) => Promise<any>;
      saveMeetingNotes: (data: { projectId: string, data: any }) => Promise<{ success: boolean }>;
      getProjectLinks: (projectId: string) => Promise<ProjectLink[]>;
      saveProjectLink: (data: ProjectLink) => Promise<{ success: boolean }>;
      deleteProjectLink: (id: string) => Promise<{ success: boolean }>;
      getStatusReports: (projectId: string) => Promise<StatusReport[]>;
      saveStatusReport: (data: { projectId: string, data: StatusReport }) => Promise<{ success: boolean }>;
      deleteStatusReport: (id: string) => Promise<{ success: boolean }>;
      writeClipboardHtml: (html: string) => Promise<{ success: boolean }>;
      appendGoogleDoc: (data: { docLink: string, content: string, title: string, participants: string[] }) => Promise<{ success: boolean }>;
      getGoogleAuthStatus: () => Promise<{ isAuthenticated: boolean, hasCredentials: boolean }>;
      getGoogleAuthUrl: () => Promise<string>;
      authorizeGoogle: (code: string) => Promise<any>;
      logoutGoogle: () => Promise<void>;
      openExternal: (url: string) => Promise<{ success: boolean }>;
      exportDatabase: () => Promise<{ success: boolean; canceled?: boolean; fileName?: string; modifiedTime?: string | null }>;
      importDatabase: () => Promise<{ success: boolean; canceled?: boolean; fileName?: string; modifiedTime?: string | null }>;
      exportPdf: (options?: { defaultFileName?: string; password?: string }) => Promise<{ success: boolean; canceled?: boolean; filePath?: string }>;
      
      // Daily Handlers
      getDailyHubs: () => Promise<DailyHub[]>;
      saveDailyHub: (hub: DailyHub) => Promise<{ success: boolean }>;
      deleteDailyHub: (id: string) => Promise<{ success: boolean }>;
      getDailySections: (hubId: string) => Promise<DailySection[]>;
      saveDailySection: (section: DailySection) => Promise<{ success: boolean }>;
      deleteDailySection: (id: string) => Promise<{ success: boolean }>;
      reorderDailySections: (sections: { id: string, orderIndex: number }[]) => Promise<{ success: boolean }>;
      getDailyComments: () => Promise<DailyComment[]>;
      saveDailyComment: (data: { issueId: string, content: string }) => Promise<{ success: boolean }>;
      getDailyIssueStates: () => Promise<Record<string, boolean>>;
      saveDailyIssueState: (data: { issueId: string, isCollapsed: boolean }) => Promise<{ success: boolean }>;
    }
  }
}

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid, ComposedChart, Line, Area, Legend, ReferenceArea
} from 'recharts';
import {
  LayoutDashboard, Plus, Briefcase,
  Clock, AlertTriangle,
  ChevronDown, Edit2, X, Moon, Sun, Loader2, BarChart as BarChartIcon, Info, FileText, Printer,
  FileSpreadsheet, Activity, DollarSign, Settings as SettingsIcon,
  CheckCircle, AlertCircle, Code
} from 'lucide-react';

import { 
  ProjectProvider, useProjectContext, useOrders, 
  useProjectCalculations, useDarkMode 
} from './context/ProjectContext';

import { TaskTypeIconMap } from './utils/icons';

// ==========================================
import { YouTrackTab } from './components/YouTrackTab';
import { WorkRegistryMain } from './features/work-registry/components/WorkRegistryMain';
import { useWorkRegistry } from './features/work-registry/hooks/useWorkRegistry';
import { exportOrdersToExcel, importOrdersFromExcel } from './features/work-registry/services/excelService';
import { FileUp, FileDown } from 'lucide-react';
import { EstimationMain } from './features/estimation/components/EstimationMain';
import { MeetingNotesMain } from './features/meeting-notes/components/MeetingNotesMain';
import { DailyMain } from './features/daily/components/DailyMain';
import { ProjectLinksDropdown, ProjectLinksMain } from './features/project-links/components/ProjectLinksMain';
import { StatusMain } from './features/status/components/StatusMain';
import {
  buildCbcpReportData,
  exportCbcpReportToExcel,
  exportCbcpReportToWord,
} from './features/reports/services/cbcpReportExportService';
import {
  buildPmsReportData,
  exportPmsReportToExcel,
  exportPmsReportToWord,
} from './features/reports/services/pmsReportExportService';
import { buildExecutiveSettlementReportData } from './features/reports/services/settlementExecutiveReportService';
import { exportExecutiveSettlementReportToExcel } from './features/reports/services/settlementExecutiveExcelExportService';
import { exportExecutiveSettlementReportToWord } from './features/reports/services/settlementExecutiveWordExportService';

// Export everything from context for convenience (optional, but avoids breaking other imports immediately)
export { useProjectContext, useOrders, useProjectCalculations, useDarkMode };
export type { Project, Stakeholder, Estimation, EstimationItem, MeetingNoteData, OrderItem, EmailTemplate };

const Sidebar = ({ isDark, toggleDark, onOpenModal, onOpenSettings, onExportDatabase, onImportDatabase, isDatabaseTransferPending, currentView, onViewChange }: {
  isDark: boolean,
  toggleDark: () => void,
  onOpenModal: () => void,
  onOpenSettings: () => void,
  onExportDatabase: () => Promise<void>,
  onImportDatabase: () => Promise<void>,
  isDatabaseTransferPending: boolean,
  currentView: 'dashboard' | 'daily',
  onViewChange: (view: 'dashboard' | 'daily') => void
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
    <aside className="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col h-screen h-full sticky top-0 transition-colors shrink-0">
      <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <LayoutDashboard size={18} />
          </div>
          <h1 className="font-bold text-lg text-gray-900 dark:text-white">PCC</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onOpenSettings} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors" title="Ustawienia Główne">
            <SettingsIcon size={18} />
          </button>
          <button onClick={toggleDark} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors" title="Zmień motyw">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Projekty</h2>
          <button
            onClick={onOpenModal}
            className="p-1 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 transition-colors"
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
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-3 ${currentView === 'dashboard' && selectedProject?.id === p.id
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-600 dark:text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
              >
                <Briefcase size={16} className={currentView === 'dashboard' && selectedProject?.id === p.id ? 'opacity-100' : 'opacity-50'} />
                <span className="truncate">{p.code}</span>
              </button>
            ))}
            {projects.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Brak projektów</p>
            )}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Narzędzia</h2>
          <button
            onClick={handleDailyClick}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-3 ${currentView === 'daily'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-600 dark:text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
          >
            <Activity size={16} className={currentView === 'daily' ? 'opacity-100' : 'opacity-50'} />
            <span className="font-semibold">DAILY</span>
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
        <div className="space-y-2">
          <button
            onClick={() => void onExportDatabase()}
            disabled={isDatabaseTransferPending}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown size={16} />
            Eksport bazy
          </button>
          <button
            onClick={() => void onImportDatabase()}
            disabled={isDatabaseTransferPending}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileUp size={16} />
            Import bazy
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            PM
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Admin</p>
            <p className="text-xs text-gray-500">Project Manager</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

const ProjectModal = ({
  isOpen,
  onClose,
  projectToEdit = null
}: {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Project | null;
}) => {
  const { addProject, updateProject } = useProjectContext();
  const [formData, setFormData] = useState<Omit<Project, 'id'>>({
    code: '', name: '', contractNo: '', contractSubject: '',
    dateFrom: '', dateTo: '',
    minHours: 0, maxHours: 0, rateNetto: 0, rateBrutto: 0, vatRate: 23, targetProfitPct: 20,
    taskTypes: [],
    googleDocLink: '',
    stakeholders: []
  });
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const predefinedIcons = Object.keys(TaskTypeIconMap);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (projectToEdit) {
      setFormData({
        code: projectToEdit.code,
        name: projectToEdit.name,
        contractNo: projectToEdit.contractNo,
        contractSubject: projectToEdit.contractSubject || '',
        dateFrom: projectToEdit.dateFrom,
        dateTo: projectToEdit.dateTo,
        minHours: projectToEdit.minHours,
        maxHours: projectToEdit.maxHours,
        rateNetto: projectToEdit.rateNetto,
        rateBrutto: projectToEdit.rateBrutto,
        vatRate: projectToEdit.vatRate !== undefined ? projectToEdit.vatRate : 23,
        targetProfitPct: projectToEdit.targetProfitPct !== undefined ? projectToEdit.targetProfitPct : 20,
        taskTypes: projectToEdit.taskTypes || [],
        googleDocLink: projectToEdit.googleDocLink || '',
        stakeholders: projectToEdit.stakeholders || []
      });
      setTaskTypes(projectToEdit.taskTypes || []);
      setStakeholders(projectToEdit.stakeholders || []);
    } else {
      setFormData({
        code: '', name: '', contractNo: '', contractSubject: '',
        dateFrom: '', dateTo: '',
        minHours: 0, maxHours: 0, rateNetto: 0, rateBrutto: 0, vatRate: 23, targetProfitPct: 20,
        taskTypes: [],
        googleDocLink: '',
        stakeholders: []
      });
      setTaskTypes([]);
      setStakeholders([]);
    }
  }, [projectToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    let newValue: any = value;

    if (type === 'number') {
      newValue = parseFloat(value) || 0;
    }

    setFormData(prev => {
      const updated = { ...prev, [name]: newValue };

      const currentVatRate = name === 'vatRate' ? newValue : prev.vatRate;
      const vatMultiplier = 1 + (currentVatRate / 100);

      if (name === 'rateNetto' || name === 'vatRate') {
        updated.rateBrutto = parseFloat((updated.rateNetto * vatMultiplier).toFixed(2));
      } else if (name === 'rateBrutto') {
        updated.rateNetto = parseFloat((newValue / vatMultiplier).toFixed(2));
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Walidacja dat
    if (formData.dateFrom && formData.dateTo && new Date(formData.dateTo) < new Date(formData.dateFrom)) {
      setError('Data zakonczenia musi byc pozniejsza niz data rozpoczecia.');
      return;
    }

    if (formData.minHours && formData.maxHours && formData.minHours > formData.maxHours) {
      setError('Limit minimalny nie moze byc wiekszy niz maksymalny.');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalFormData = {
        ...formData,
        taskTypes: taskTypes.filter(t => t.name.trim() !== ''),
        stakeholders: stakeholders.filter(s => s.name.trim() !== '')
      };

      if (projectToEdit) {
        await updateProject(projectToEdit.id, finalFormData);
      } else {
        await addProject(finalFormData);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Wystapil blad zapisu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-left">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-[90vw] max-w-[90vw] flex flex-col max-h-[95vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {projectToEdit ? 'Edytuj Projekt' : 'Nowy Projekt'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Sekcja 1: Parametry ogólne */}
            <div className="mb-8">
              <h3 className="text-md font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">Parametry ogólne</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kod (Skrót) *</label>
                    <input required name="code" value={formData.code} onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      placeholder="np. PRJ-01" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pełna Nazwa</label>
                    <input name="name" value={formData.name} onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nr Umowy</label>
                    <input name="contractNo" value={formData.contractNo} onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Przedmiot Umowy</label>
                    <input name="contractSubject" value={formData.contractSubject} onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Od</label>
                      <input type="date" name="dateFrom" value={formData.dateFrom} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition [color-scheme:light] dark:[color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Do</label>
                      <input type="date" name="dateTo" value={formData.dateTo} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition [color-scheme:light] dark:[color-scheme:dark]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Godzin</label>
                      <input type="number" min="0" name="minHours" value={formData.minHours} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Godzin</label>
                      <input type="number" min="0" name="maxHours" value={formData.maxHours} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stawka Netto (PLN)</label>
                      <input type="number" min="0" step="0.01" name="rateNetto" value={formData.rateNetto} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stawka Brutto (+{formData.vatRate}%)</label>
                      <input type="number" min="0" step="0.01" name="rateBrutto" value={formData.rateBrutto} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stawka VAT (%)</label>
                      <input type="number" min="0" step="1" name="vatRate" value={formData.vatRate} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Docelowy zysk (%)</label>
                      <input type="number" min="0" step="0.1" name="targetProfitPct" value={formData.targetProfitPct ?? 20} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Cel liczony jako narzut względem godzin przepracowanych: (wykorzystane - przepracowane) / przepracowane.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link dokumentu Google dla Notatek</label>
                      <input name="googleDocLink" value={formData.googleDocLink} onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" 
                        placeholder="https://docs.google.com/document/d/..." />
                    </div>
                    <div></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sekcja 2: Interesariusze (Stakeholders) */}
            <div className="mb-8 p-6 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Briefcase size={18} />
                  </div>
                  <h3 className="text-md font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm">Interesariusze</h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setStakeholders(prev => [...prev, { id: Date.now().toString(), name: '', role: '', company: 'customer', isPresent: true }])} 
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5 hover:text-indigo-700 transition px-3 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-900"
                >
                  <Plus size={14} /> Dodaj Osobę
                </button>
              </div>
              <div className="space-y-3">
                {stakeholders.map((s) => (
                  <div key={s.id} className="flex gap-3 items-start animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-12 gap-3 flex-1 bg-white dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700/50 shadow-sm">
                      <div className="col-span-5">
                        <input
                          value={s.name}
                          onChange={(e) => setStakeholders(prev => prev.map(item => item.id === s.id ? { ...item, name: e.target.value } : item))}
                          placeholder="Imię i Nazwisko"
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/50 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          value={s.role}
                          onChange={(e) => setStakeholders(prev => prev.map(item => item.id === s.id ? { ...item, role: e.target.value } : item))}
                          placeholder="Rola w projekcie"
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/50 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                        />
                      </div>
                      <div className="col-span-3">
                        <select
                          value={s.company}
                          onChange={(e) => setStakeholders(prev => prev.map(item => item.id === s.id ? { ...item, company: e.target.value as any } : item))}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/50 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                        >
                          <option value="customer">Klient</option>
                          <option value="contractor">Wykonawca</option>
                        </select>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setStakeholders(prev => prev.filter(item => item.id !== s.id))} 
                      className="text-gray-400 hover:text-red-500 p-2.5 transition-colors bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl mt-0.5 shadow-sm"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {stakeholders.length === 0 && (
                  <p className="text-xs text-center text-gray-500 py-4 bg-white/50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">Brak zdefiniowanych osób przypisanych do projektu.</p>
                )}
              </div>
            </div>

            {/* Sekcja 3: Rodzaje zadań */}
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                <h3 className="text-md font-bold text-gray-900 dark:text-white">Rodzaje zadań zdefiniowane dla projektu</h3>
                <button type="button" onClick={() => setTaskTypes(prev => [...prev, { id: Date.now().toString(), name: '', color: '#3b82f6', icon: 'Code' }])} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 hover:text-indigo-700 transition bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1.5 rounded-md">
                  <Plus size={14} /> Dodaj rodzaj
                </button>
              </div>
              <div className="space-y-4">
                {taskTypes.map((tt) => {
                  const SelectedIcon = TaskTypeIconMap[tt.icon] || Code;
                  return (
                    <div key={tt.id} className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                      <div className="flex gap-3 items-center">
                        <div className="flex items-center justify-center w-10 h-10 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shrink-0 shadow-sm" style={{ color: tt.color }}>
                          <SelectedIcon size={20} />
                        </div>
                        <input
                          value={tt.name}
                          onChange={(e) => setTaskTypes(prev => prev.map(t => t.id === tt.id ? { ...t, name: e.target.value } : t))}
                          placeholder="Wpisz nazwę rodzaju zadania..."
                          className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                        />
                        <input
                          type="color"
                          value={tt.color}
                          onChange={(e) => setTaskTypes(prev => prev.map(t => t.id === tt.id ? { ...t, color: e.target.value } : t))}
                          className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer bg-white dark:bg-gray-700 p-1 shrink-0"
                          title="Wybierz kolor"
                        />
                        <button type="button" onClick={() => setTaskTypes(prev => prev.filter(t => t.id !== tt.id))} className="text-gray-400 hover:text-red-500 p-2 transition-colors bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shrink-0" title="Usuń rodzaj">
                          <X size={18} />
                        </button>
                      </div>

                      <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 pl-1">Wybierz ikonę</p>
                        <div className="flex flex-wrap items-center gap-1.5 focus-within:ring-0">
                          {predefinedIcons.map(iconName => {
                            const IconComponent = TaskTypeIconMap[iconName] || Code;
                            const isSelected = tt.icon === iconName;
                            return (
                              <button
                                key={iconName}
                                type="button"
                                onClick={() => setTaskTypes(prev => prev.map(t => t.id === tt.id ? { ...t, icon: iconName } : t))}
                                className={`p-2.5 rounded-xl transition-all border ${isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/40 dark:border-indigo-800/60 dark:text-indigo-400 shadow-sm scale-105' : 'border-transparent text-gray-400 hover:text-gray-700 hover:bg-white hover:shadow-sm hover:border-gray-200 dark:hover:bg-gray-700 dark:hover:text-gray-200 dark:hover:border-gray-600'}`}
                                title={iconName}
                              >
                                <IconComponent size={20} />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {taskTypes.length === 0 && (
                  <p className="text-sm text-gray-500 italic p-4 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">Brak zdefiniowanych rodzajów zadań do tego projektu.</p>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
              Anuluj
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition flex items-center justify-center min-w-[120px]">
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (projectToEdit ? 'Zapisz Zmiany' : 'Utwórz Projekt')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ==========================================
// VIEWS
// ==========================================

const DashboardView = ({ onEdit }: { onEdit: (p: Project) => void }) => {
  const { selectedProject, settings } = useProjectContext();
  const calculations = useProjectCalculations(selectedProject);
  const { workItems } = useWorkRegistry(selectedProject);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'work' | 'settlements' | 'status' | 'youtrack' | 'estimation' | 'notes' | '__status_placeholder__'>('dashboard');
  const [isExecutiveSettlementReportOpen, setIsExecutiveSettlementReportOpen] = useState(false);
  const [isFinancialDataVisible, setIsFinancialDataVisible] = useState(false);
  const [burnUpRangeMode, setBurnUpRangeMode] = useState<'halfYear' | 'full' | 'custom'>('halfYear');
  const [burnUpVisibleRange, setBurnUpVisibleRange] = useState<{ start: string; end: string } | null>(null);
  const [burnUpSelectionStart, setBurnUpSelectionStart] = useState<string | null>(null);
  const [burnUpSelectionEnd, setBurnUpSelectionEnd] = useState<string | null>(null);
  const { orders } = useOrders(selectedProject?.id);

  useEffect(() => {
    if (typeof window === 'undefined' || !selectedProject) return;

    const storedTab = sessionStorage.getItem(`pcc_dashboard_active_tab:${selectedProject.id}`);
    if (!storedTab) {
      setActiveTab('dashboard');
      return;
    }

    const allowedTabs = ['dashboard', 'orders', 'work', 'settlements', 'status', 'youtrack', 'estimation', 'notes'];
    if (allowedTabs.includes(storedTab)) {
      setActiveTab(storedTab as typeof activeTab);
      return;
    }

    setActiveTab('dashboard');
  }, [selectedProject]);

  useEffect(() => {
    if (typeof window === 'undefined' || !selectedProject) return;
    sessionStorage.setItem(`pcc_dashboard_active_tab:${selectedProject.id}`, activeTab);
  }, [activeTab, selectedProject]);

  useEffect(() => {
    setBurnUpRangeMode('halfYear');
    setBurnUpVisibleRange(null);
    setBurnUpSelectionStart(null);
    setBurnUpSelectionEnd(null);
  }, [selectedProject?.id]);

  if (!selectedProject || !calculations) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 dark:bg-gray-900/50">
        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-300 rounded-full flex items-center justify-center mb-6">
          <LayoutDashboard size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Wybierz projekt z menu</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">Wybierz projekt z menu po lewej stronie, aby wyświetlić szczegóły i statystyki.</p>
      </div>
    );
  }

  const {
    timeProgress, daysRemaining, isEndingSoon, isOverdue,
    budgetMin, budgetMax
  } = calculations;

  const settledOrders = orders.filter(isSettledOrder);
  const cancelledOrders = orders.filter(isCancelledOrder);
  const pendingSettlementOrders = orders.filter(isPendingSettlementOrder);
  const settledHours = settledOrders.reduce((sum, order) => sum + getOrderHoursTotal(order), 0);
  const contractedHours = pendingSettlementOrders.reduce((sum, order) => sum + getOrderHoursTotal(order), 0);
  const totalHoursUsed = settledHours + contractedHours;
  const remainingToMax = Math.max(0, selectedProject.maxHours - totalHoursUsed);

  const chartData = [
    { name: 'Min', Godziny: selectedProject.minHours, fill: '#6366f1' },
    { name: 'Rozlicz.', Godziny: settledHours, fill: '#10b981' },
    { name: 'Zakontr.', Godziny: contractedHours, fill: '#f59e0b' },
    { name: 'Suma', Godziny: totalHoursUsed, fill: '#3b82f6' },
    { name: 'Zostaje', Godziny: remainingToMax, fill: '#c026d3' },
    { name: 'Max', Godziny: selectedProject.maxHours, fill: '#818cf8' }
  ];

  // Calculate YouTrack hours by category
  const youtrackHours: Record<string, number> = {
    'Programistyczne': 0,
    'Obsługa projektu': 0,
    'Inne': 0
  };
  
  workItems?.forEach(item => {
    const cat = item.category || 'Inne';
    if (youtrackHours[cat] !== undefined) {
      youtrackHours[cat] += (item.minutes || 0) / 60;
    } else {
      youtrackHours[cat] = (item.minutes || 0) / 60;
    }
  });

  const youtrackTotal = youtrackHours['Programistyczne'] + youtrackHours['Obsługa projektu'] + youtrackHours['Inne'];
  const maxScale = Math.max(selectedProject.maxHours || 1, totalHoursUsed, youtrackTotal);
  const hoursDifference = totalHoursUsed - youtrackTotal;
  const hoursDifferencePct = totalHoursUsed > 0
    ? (hoursDifference / totalHoursUsed) * 100
    : 0;
  const hoursDifferenceLabel = hoursDifference > 0
    ? 'Wykorzystane wyższe od przepracowanych'
    : hoursDifference < 0
      ? 'Przepracowane wyższe od wykorzystanych'
      : 'Wykorzystane równe przepracowanym';
  const hoursDifferenceTone = hoursDifference > 0
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : hoursDifference < 0
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  const hoursDifferenceNet = hoursDifference * selectedProject.rateNetto;
  const hoursDifferenceGross = hoursDifference * selectedProject.rateBrutto;
  const targetProfitPct = selectedProject.targetProfitPct ?? 20;
  const targetProfitRatio = targetProfitPct / 100;
  const historicalUsedHours = totalHoursUsed;
  const historicalWorkedHours = youtrackTotal;
  const remainingPricedHours = remainingToMax;
  const projectedTotalUsedHours = historicalUsedHours + remainingPricedHours;
  const targetFinalWorkedHours = projectedTotalUsedHours / (1 + targetProfitRatio);
  const allowedFutureWorkedForTarget = targetFinalWorkedHours - historicalWorkedHours;
  const bestCaseFinalProfitPct = projectedTotalUsedHours > 0
    ? (youtrackTotal > 0 ? ((projectedTotalUsedHours - youtrackTotal) / youtrackTotal) * 100 : Infinity)
    : 0;
  const rawRequiredMarkupPct = allowedFutureWorkedForTarget > 0
    ? ((remainingPricedHours / allowedFutureWorkedForTarget) - 1) * 100
    : null;
  const requiredMarkupPctForTarget = rawRequiredMarkupPct === null ? null : Math.max(0, rawRequiredMarkupPct);
  const allowedFutureWorkedDisplay = Math.max(0, allowedFutureWorkedForTarget);
  const requiredMarkupDisplayValue = remainingPricedHours <= 0
    ? (bestCaseFinalProfitPct >= targetProfitPct ? '0.0%' : '∞')
    : allowedFutureWorkedForTarget <= 0
      ? '∞'
      : `${requiredMarkupPctForTarget?.toFixed(1)}%`;
  const requiredMarkupStatus = remainingPricedHours <= 0
    ? (bestCaseFinalProfitPct >= targetProfitPct
        ? `Projekt już domyka co najmniej ${targetProfitPct}% zysku.`
        : `Brak pozostałych godzin do wykorzystania, a projekt kończy się poniżej ${targetProfitPct}% zysku.`)
    : allowedFutureWorkedForTarget <= 0
      ? `Cel ${targetProfitPct}% zysku wymagałby nieskończonego narzutu przy dotychczasowej historii godzin.`
      : requiredMarkupPctForTarget === 0
        ? `Obecna historia projektu już zabezpiecza co najmniej ${targetProfitPct}% zysku przy pozostałych godzinach.`
        : `Minimalny narzut dla kolejnych zleceń, aby domknąć projekt z ${targetProfitPct}% zysku.`;

  const progPct = youtrackTotal > 0 ? (youtrackHours['Programistyczne'] / youtrackTotal) * 100 : 0;
  const obsPct = youtrackTotal > 0 ? (youtrackHours['Obsługa projektu'] / youtrackTotal) * 100 : 0;
  const inPct = youtrackTotal > 0 ? (youtrackHours['Inne'] / youtrackTotal) * 100 : 0;
  const inProgressOrders = pendingSettlementOrders.filter(isInProgressPendingOrder);
  const handedOverPendingOrders = pendingSettlementOrders.filter(isHandedOverPendingOrder);
  const pendingSettlementHours = contractedHours;
  const contractedTotalHours = totalHoursUsed;
  const remainingInContract = selectedProject.maxHours - contractedTotalHours;
  const contractUsagePct = selectedProject.maxHours > 0
    ? (contractedTotalHours / selectedProject.maxHours) * 100
    : 0;
  const contractedNetValue = contractedTotalHours * selectedProject.rateNetto;
  const contractedGrossValue = contractedTotalHours * selectedProject.rateBrutto;
  const settledNetValue = settledHours * selectedProject.rateNetto;
  const settledGrossValue = settledHours * selectedProject.rateBrutto;
  const pendingNetValue = pendingSettlementHours * selectedProject.rateNetto;
  const pendingGrossValue = pendingSettlementHours * selectedProject.rateBrutto;
  const remainingNetValue = remainingInContract * selectedProject.rateNetto;
  const remainingGrossValue = remainingInContract * selectedProject.rateBrutto;
  const workedNetValue = youtrackTotal * selectedProject.rateNetto;
  const workedGrossValue = youtrackTotal * selectedProject.rateBrutto;
  const profitabilityHours = contractedTotalHours - youtrackTotal;
  const profitabilityNetValue = profitabilityHours * selectedProject.rateNetto;
  const profitabilityGrossValue = profitabilityHours * selectedProject.rateBrutto;
  const profitabilityPct = contractedTotalHours > 0 ? (profitabilityHours / contractedTotalHours) * 100 : 0;
  const settlementRows = [
    {
      label: 'Umowa max godzin',
      value: formatOrderHours(selectedProject.maxHours),
      amountNet: selectedProject.maxHours * selectedProject.rateNetto,
      amountGross: selectedProject.maxHours * selectedProject.rateBrutto,
      note: 'Limit maksymalny zapisany w umowie dla projektu.',
      tone: 'text-slate-700 dark:text-slate-200',
    },
    {
      label: 'Zakontraktowane',
      value: formatOrderHours(contractedTotalHours),
      amountNet: contractedNetValue,
      amountGross: contractedGrossValue,
      note: 'Suma wszystkich godzin ze zleceń zapisanych w rejestrze.',
      tone: 'text-indigo-700 dark:text-indigo-300',
    },
    {
      label: 'Rozliczone',
      value: formatOrderHours(settledHours),
      amountNet: settledNetValue,
      amountGross: settledGrossValue,
      note: 'Zlecenia z uzupełnioną datą odbioru, czyli formalnie rozliczone.',
      tone: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      label: 'Do rozliczenia',
      value: formatOrderHours(pendingSettlementHours),
      amountNet: pendingNetValue,
      amountGross: pendingGrossValue,
      note: 'Zlecenia z uzupełnioną datą realizacji od, nadal bez daty odbioru.',
      tone: 'text-amber-700 dark:text-amber-300',
    },
    {
      label: 'Pozostało w umowie',
      value: formatOrderHours(remainingInContract),
      amountNet: remainingNetValue,
      amountGross: remainingGrossValue,
      note: remainingInContract >= 0
        ? 'Pozostała pula godzin do wykorzystania w umowie.'
        : 'Przekroczono maksymalny limit godzin w umowie.',
      tone: remainingInContract >= 0
        ? 'text-fuchsia-700 dark:text-fuchsia-300'
        : 'text-red-700 dark:text-red-300',
    },
  ];
  const profitabilityRows = [
    {
      label: 'Zakontraktowane godziny',
      value: formatOrderHours(contractedTotalHours),
      note: 'Suma godzin zakontraktowanych w zleceniach projektu.',
      financialNote: `Netto ${formatCurrencyValue(contractedNetValue)} zł, brutto ${formatCurrencyValue(contractedGrossValue)} zł.`,
      tone: 'text-indigo-700 dark:text-indigo-300',
    },
    {
      label: 'Rzeczywiście przepracowane',
      value: formatOrderHours(youtrackTotal),
      note: 'Na podstawie rejestru pracy YouTrack.',
      financialNote: `Netto ${formatCurrencyValue(workedNetValue)} zł, brutto ${formatCurrencyValue(workedGrossValue)} zł.`,
      tone: 'text-violet-700 dark:text-violet-300',
    },
    {
      label: 'Zysk na różnicy godzin',
      value: formatOrderHours(profitabilityHours),
      note: 'Różnica zakontraktowane - przepracowane.',
      financialNote: `Netto ${formatCurrencyValue(profitabilityNetValue)} zł, brutto ${formatCurrencyValue(profitabilityGrossValue)} zł.`,
      tone: profitabilityHours >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
    },
  ];
  const authorHours = Object.entries(
    workItems.reduce<Record<string, number>>((acc, item) => {
      const authorName = item.authorName || 'Nieznana osoba';
      acc[authorName] = (acc[authorName] || 0) + ((item.minutes || 0) / 60);
      return acc;
    }, {})
  )
    .map(([name, hours]) => ({ name, hours }))
    .sort((a, b) => b.hours - a.hours);
  const burnUpTrendData = buildBurnUpTrendData({
    orders: orders.filter((order) => !isCancelledOrder(order)),
    workItems,
    contractEndDate: selectedProject.dateTo,
  });
  const lastBurnUpDate = burnUpTrendData.length > 0 ? burnUpTrendData[burnUpTrendData.length - 1].date : null;
  const todayDateKey = getDateKey(new Date());
  const latestVisibleBurnUpDate = lastBurnUpDate && lastBurnUpDate < todayDateKey ? lastBurnUpDate : todayDateKey;
  const fullContractBurnUpRange = (() => {
    const contractStart = parseCalendarDate(selectedProject.dateFrom);
    const contractEnd = parseCalendarDate(selectedProject.dateTo);

    if (contractStart && contractEnd) {
      return normalizeDateRange(getDateKey(contractStart), getDateKey(contractEnd));
    }

    if (contractStart && latestVisibleBurnUpDate) {
      return normalizeDateRange(getDateKey(contractStart), latestVisibleBurnUpDate);
    }

    if (lastBurnUpDate) {
      const firstBurnUpDate = burnUpTrendData[0]?.date || lastBurnUpDate;
      return normalizeDateRange(firstBurnUpDate, lastBurnUpDate);
    }

    return null;
  })();
  const lastHalfYearRange = (() => {
    if (!latestVisibleBurnUpDate) return null;
    const endDate = parseCalendarDate(latestVisibleBurnUpDate);
    if (!endDate) return null;
    const startDate = addMonths(endDate, -6);
    return {
      start: getDateKey(startDate),
      end: latestVisibleBurnUpDate,
    };
  })();
  const effectiveBurnUpRange = burnUpRangeMode === 'full'
    ? fullContractBurnUpRange
    : burnUpRangeMode === 'custom'
      ? burnUpVisibleRange
      : lastHalfYearRange;
  const visibleBurnUpTrendData = (() => {
    if (!effectiveBurnUpRange) return burnUpTrendData;
    return burnUpTrendData.filter((point) => point.date >= effectiveBurnUpRange.start && point.date <= effectiveBurnUpRange.end);
  })();
  const latestVisibleBurnUpPoint = visibleBurnUpTrendData[visibleBurnUpTrendData.length - 1] || null;
  const latestVisibleTrendPoint = [...visibleBurnUpTrendData]
    .reverse()
    .find((point) => point.trendRatio !== null || point.rollingTrendRatio !== null) || null;
  const burnUpEstimateCeiling = latestVisibleBurnUpPoint?.cumulativeEstimate || 0;
  const burnUpActualCeiling = latestVisibleBurnUpPoint?.cumulativeActual || 0;
  const burnUpDeltaHours = latestVisibleBurnUpPoint?.deltaHours || 0;
  const burnUpTrendRatio = latestVisibleTrendPoint?.trendRatio ?? null;
  const burnUpRollingTrendRatio = latestVisibleTrendPoint?.rollingTrendRatio ?? null;
  const burnUpTrendTone = burnUpDeltaHours >= 0
    ? 'text-emerald-700 dark:text-emerald-300'
    : 'text-red-700 dark:text-red-300';
  const burnUpTrendBadgeTone = burnUpTrendRatio === null
    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300'
    : burnUpTrendRatio >= 1
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  const burnUpTrendValues = visibleBurnUpTrendData.flatMap((point) => [
    point.trendRatio,
    point.rollingTrendRatio,
    point.regressionTrendRatio,
    1,
  ]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const burnUpTrendMin = burnUpTrendValues.length > 0 ? Math.min(...burnUpTrendValues) : 0;
  const burnUpTrendMax = burnUpTrendValues.length > 0 ? Math.max(...burnUpTrendValues) : 1;
  const burnUpTrendDomain: [number, number] = [
    burnUpTrendMin === burnUpTrendMax
      ? burnUpTrendMin - 0.1
      : Math.max(Math.floor(burnUpTrendMin * 10) / 10, -3),
    burnUpTrendMin === burnUpTrendMax
      ? burnUpTrendMax + 0.1
      : Math.min(Math.ceil(burnUpTrendMax * 10) / 10, 3),
  ];
  const applyFullBurnUpRange = () => {
    setBurnUpRangeMode('full');
    setBurnUpVisibleRange(fullContractBurnUpRange);
    setBurnUpSelectionStart(null);
    setBurnUpSelectionEnd(null);
  };
  const applyLastHalfYearBurnUpRange = () => {
    setBurnUpRangeMode('halfYear');
    setBurnUpVisibleRange(lastHalfYearRange);
    setBurnUpSelectionStart(null);
    setBurnUpSelectionEnd(null);
  };
  const handleBurnUpMouseDown = (state: { activeLabel?: string | number } | undefined) => {
    if (state?.activeLabel === undefined || state.activeLabel === null) return;
    const nextLabel = String(state.activeLabel);
    setBurnUpSelectionStart(nextLabel);
    setBurnUpSelectionEnd(nextLabel);
  };
  const handleBurnUpMouseMove = (state: { activeLabel?: string | number } | undefined) => {
    if (!burnUpSelectionStart || state?.activeLabel === undefined || state.activeLabel === null) return;
    setBurnUpSelectionEnd(String(state.activeLabel));
  };
  const handleBurnUpMouseUp = () => {
    if (!burnUpSelectionStart || !burnUpSelectionEnd) {
      setBurnUpSelectionStart(null);
      setBurnUpSelectionEnd(null);
      return;
    }

    if (burnUpSelectionStart !== burnUpSelectionEnd) {
      setBurnUpRangeMode('custom');
      setBurnUpVisibleRange(normalizeDateRange(burnUpSelectionStart, burnUpSelectionEnd));
    }

    setBurnUpSelectionStart(null);
    setBurnUpSelectionEnd(null);
  };
  const burnUpSelectionRange = burnUpSelectionStart && burnUpSelectionEnd
    ? normalizeDateRange(burnUpSelectionStart, burnUpSelectionEnd)
    : null;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 xl:px-5 xl:py-6 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-[1500px] mx-auto space-y-5">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold text-xs rounded-full uppercase tracking-wider">
                {selectedProject.code}
              </span>
              {(isEndingSoon || isOverdue) && (
                <span className={`flex items-center gap-1.5 px-3 py-1 font-semibold text-xs rounded-full uppercase tracking-wider ${isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                  <AlertTriangle size={14} />
                  {isOverdue ? 'Zakończony / Opóźniony' : 'Koniec blisko'}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{selectedProject.name}</h1>
          </div>
          <button
            onClick={() => onEdit(selectedProject)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
          >
            <Edit2 size={16} /> Edytuj szczegóły
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-8 border-b border-gray-200 dark:border-gray-800 mb-6 font-medium text-sm">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-3 border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-3 border-b-2 transition-colors ${activeTab === 'orders' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Rejestr Zleceń
          </button>
          <button
            onClick={() => setActiveTab('work')}
            className={`pb-3 border-b-2 transition-colors ${activeTab === 'work' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Rejestr Pracy
          </button>
          <button
            onClick={() => setActiveTab('settlements')}
            className={`pb-3 border-b-2 transition-colors ${activeTab === 'settlements' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Rozliczenia
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-3 border-b-2 transition-colors ${activeTab === 'status' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Status
          </button>
          <button
            onClick={() => setActiveTab('youtrack')}
            className={`pb-3 border-b-2 transition-colors ${activeTab === 'youtrack' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            YouTrack
          </button>
          <button
            onClick={() => setActiveTab('estimation')}
            className={`pb-3 border-b-2 transition-colors ${activeTab === 'estimation' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Wycena
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-3 border-b-2 transition-colors ${activeTab === 'notes' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Notatki
          </button>
        </div>

        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2.4fr)_minmax(320px,0.9fr)] xl:items-stretch">
              <div className="space-y-6">
                {/* TIME PROGRESS */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                      <Clock size={20} className="text-indigo-500" />
                      <h3 className="font-bold sm:text-lg">Postęp czasu realizacji</h3>
                    </div>
                    <div className="text-sm font-medium text-gray-500 bg-gray-100 dark:bg-gray-900 px-3 py-1 rounded-full">
                      {timeProgress}% upłynęło
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 mb-3 overflow-hidden">
                    <div
                      className={`h-4 rounded-full transition-all duration-1000 ${timeProgress > 90 ? 'bg-rose-500' : timeProgress > 75 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                      style={{ width: `${Math.min(100, timeProgress)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 font-medium">
                    <span>Start: {selectedProject.dateFrom}</span>
                    {daysRemaining >= 0 ? <span>Pozostało dni: <strong className="text-gray-900 dark:text-gray-200">{daysRemaining}</strong></span> : <span className="text-red-500 font-bold">Po terminie od {-daysRemaining} dni</span>}
                    <span>Koniec: {selectedProject.dateTo}</span>
                  </div>
                </div>

                {/* HOURS COMPARISON PROGRESS */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                  <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                      <Activity size={20} className="text-indigo-500" />
                      <h3 className="font-bold sm:text-lg">Wykorzystane vs Przepracowane</h3>
                    </div>
                    <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${hoursDifferenceTone}`}>
                      {hoursDifference > 0 ? '+' : ''}{hoursDifferencePct.toFixed(1)}% · {hoursDifferenceLabel}
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <div className="flex justify-between text-sm mb-1.5 font-medium">
                        <span className="text-gray-600 dark:text-gray-400">Wykorzystane (Rozliczone + Zakontraktowane)</span>
                        <span className="text-gray-900 dark:text-white font-bold">{totalHoursUsed.toFixed(1)} <span className="text-gray-500 font-normal">h</span></span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${Math.min(100, (totalHoursUsed / maxScale) * 100)}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1.5 font-medium">
                        <span className="text-gray-600 dark:text-gray-400">Przepracowane w YouTrack</span>
                        <span className="text-gray-900 dark:text-white font-bold">{youtrackTotal.toFixed(1)} <span className="text-gray-500 font-normal">h</span></span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden flex">
                        <div className="bg-violet-500 h-full transition-all duration-1000 flex items-center justify-center text-[10px] font-bold text-white leading-none" style={{ width: `${(youtrackHours['Programistyczne'] / maxScale) * 100}%` }} title={`Programistyczne: ${youtrackHours['Programistyczne'].toFixed(1)}h (${progPct.toFixed(0)}%)`}>
                          {progPct > 5 ? `${progPct.toFixed(0)}%` : ''}
                        </div>
                        <div className="bg-emerald-500 h-full transition-all duration-1000 flex items-center justify-center text-[10px] font-bold text-white leading-none" style={{ width: `${(youtrackHours['Obsługa projektu'] / maxScale) * 100}%` }} title={`Obsługa projektu: ${youtrackHours['Obsługa projektu'].toFixed(1)}h (${obsPct.toFixed(0)}%)`}>
                          {obsPct > 5 ? `${obsPct.toFixed(0)}%` : ''}
                        </div>
                        <div className="bg-amber-500 h-full transition-all duration-1000 flex items-center justify-center text-[10px] font-bold text-white leading-none" style={{ width: `${(youtrackHours['Inne'] / maxScale) * 100}%` }} title={`Inne: ${youtrackHours['Inne'].toFixed(1)}h (${inPct.toFixed(0)}%)`}>
                          {inPct > 5 ? `${inPct.toFixed(0)}%` : ''}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs font-medium text-gray-500">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-violet-500"></div> Programistyczne {progPct > 0 && `(${progPct.toFixed(0)}%)`}</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></div> Obsługa projektu {obsPct > 0 && `(${obsPct.toFixed(0)}%)`}</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500"></div> Inne {inPct > 0 && `(${inPct.toFixed(0)}%)`}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="xl:min-h-full">
                <ProjectLinksMain project={selectedProject} compact />
              </div>
            </div>

            {/* BENTO GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* KARTA INFO */}
              <div className="col-span-1 md:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                    <Briefcase className="text-indigo-500" size={20} /> Wszystkie informacje
                  </h3>
                  <button
                    onClick={() => setIsFinancialDataVisible(!isFinancialDataVisible)}
                    className={`p-2 rounded-lg transition-colors ${isFinancialDataVisible ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'}`}
                    title={isFinancialDataVisible ? "Ukryj dane finansowe" : "Pokaż dane finansowe"}
                  >
                    <DollarSign size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-y-8 gap-x-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Nr Umowy i Status</p>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-gray-900 dark:text-white">{selectedProject.contractNo || 'Brak'}</p>
                      <div className="flex items-center gap-1.5 font-medium text-sm border-l border-gray-200 dark:border-gray-700 pl-3">
                        {isOverdue ? <><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-red-600 dark:text-red-400">Zakończona</span></>
                          : <><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-emerald-600 dark:text-emerald-400">Aktywna</span></>}
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Liczba Godzin Min / Max</p>
                    <div className="flex items-baseline gap-2 text-gray-900 dark:text-white font-bold sm:text-lg">
                      {selectedProject.minHours} <span className="text-sm text-gray-400 font-normal">/</span> {selectedProject.maxHours} <span className="text-sm text-gray-500 font-normal">h</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Różnica godzin vs przepracowane</p>
                    <div className="flex items-baseline gap-2 text-gray-900 dark:text-white font-bold sm:text-lg">
                      {hoursDifference > 0 ? '+' : ''}{hoursDifference.toFixed(1)} <span className="text-sm text-gray-500 font-normal">h</span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {hoursDifference > 0 ? '+' : ''}{hoursDifferencePct.toFixed(1)}% marży godzin względem wykorzystanych
                    </p>
                  </div>

                  {isFinancialDataVisible && (
                    <div className="col-span-2 grid grid-cols-2 gap-x-6 gap-y-6 pt-4 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Stawka Godzinowa Brutto (Netto)</p>
                        <div className="flex items-end gap-2 text-gray-900 dark:text-white font-bold sm:text-lg">
                          {selectedProject.rateBrutto.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-gray-500 font-normal pb-0.5">PLN</span>
                          <span className="text-sm text-gray-400 dark:text-gray-500 font-normal pb-0.5 ml-1">({selectedProject.rateNetto.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN)</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Budżet Min / Max (Brutto)</p>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-baseline gap-2 text-gray-900 dark:text-white font-bold sm:text-lg">
                            {(budgetMin * (1 + selectedProject.vatRate / 100)).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-gray-400 font-normal">/</span> {(budgetMax * (1 + selectedProject.vatRate / 100)).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-gray-500 font-normal">PLN</span>
                          </div>
                          <div className="flex items-baseline gap-1 text-gray-400 dark:text-gray-500 font-medium text-sm">
                            <span>Netto:</span>
                            <span>{budgetMin.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {budgetMax.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Wartość różnicy godzin Brutto (Netto)</p>
                        <div className="flex items-end gap-2 text-gray-900 dark:text-white font-bold sm:text-lg">
                          {hoursDifferenceGross.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' })} <span className="text-sm text-gray-500 font-normal pb-0.5">PLN</span>
                          <span className="text-sm text-gray-400 dark:text-gray-500 font-normal pb-0.5 ml-1">({hoursDifferenceNet.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' })} PLN)</span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                          {hoursDifference > 0 ? 'Dodatnia różnica oznacza zysk firmy na różnicy godzin.' : hoursDifference < 0 ? 'Ujemna różnica oznacza, że przepracowano więcej niż wykorzystano.' : 'Brak różnicy wartości godzin.'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Wymagany narzut w kolejnych zleceniach do {targetProfitPct}% zysku</p>
                        <div className="flex items-end gap-2 text-gray-900 dark:text-white font-bold sm:text-lg">
                          {requiredMarkupDisplayValue}
                        </div>
                        <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                          {requiredMarkupStatus}
                        </p>
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          Historia projektu: wykorzystane {historicalUsedHours.toFixed(1)}h, przepracowane {historicalWorkedHours.toFixed(1)}h. Pozostały limit do wyceny: {remainingPricedHours.toFixed(1)}h.
                        </p>
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          Aby domknąć projekt z {targetProfitPct}% zysku, łączna liczba godzin przepracowanych na koniec nie powinna przekroczyć {targetFinalWorkedHours.toFixed(1)}h, czyli na pozostałej puli można jeszcze przepracować maksymalnie {allowedFutureWorkedDisplay.toFixed(1)}h.
                        </p>
                        {(allowedFutureWorkedForTarget <= 0 || remainingPricedHours <= 0) && (
                          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            Maksymalny możliwy zysk przy obecnej historii: {Number.isFinite(bestCaseFinalProfitPct) ? `${bestCaseFinalProfitPct.toFixed(1)}%` : '∞'}.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="col-span-2 pt-4 pb-2 border-t border-gray-100 dark:border-gray-800">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Wykorzystanie Godzin w Projekcie</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                        <p className="text-sm flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium mb-1 truncate" title="Suma rozliczonych">Rozliczone</p>
                        <p className="font-bold text-gray-900 dark:text-white sm:text-xl">{settledHours} <span className="text-sm font-normal text-gray-500">h</span></p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                        <p className="text-sm flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium mb-1 truncate" title="Suma zakontraktowanych">Zakontraktowane</p>
                        <p className="font-bold text-gray-900 dark:text-white sm:text-xl">{contractedHours} <span className="text-sm font-normal text-gray-500">h</span></p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                        <p className="text-sm flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-medium mb-1 truncate" title="Całkowita suma wykorzystanych godzin">Wykorzystane</p>
                        <p className="font-bold text-gray-900 dark:text-white sm:text-xl">{totalHoursUsed} <span className="text-sm font-normal text-gray-500">h</span></p>
                      </div>
                      <div className="bg-fuchsia-50 dark:bg-fuchsia-900/20 p-4 rounded-xl border border-fuchsia-100 dark:border-fuchsia-800/30 relative overflow-hidden">
                        <p className="text-sm flex items-center gap-1.5 text-fuchsia-700 dark:text-fuchsia-400 font-medium mb-1 truncate" title="Pozostało do limitu MAX">Pozostało</p>
                        <p className="font-bold text-gray-900 dark:text-white sm:text-xl relative z-10">{remainingToMax} <span className="text-sm font-normal text-gray-500">h</span></p>
                        {remainingToMax <= 0 && <div className="absolute inset-0 bg-red-100 dark:bg-red-900/40 opacity-50 z-0"></div>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              {/* CHARTS */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <BarChartIcon className="text-indigo-500" size={20} /> Limity Godzin
                </h3>
                <div className="flex-1 min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }} dy={10} interval={0} angle={-20} textAnchor="end" height={40} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tw-prose-invert, #fff)' }}
                      />
                      <Bar dataKey="Godziny" radius={[6, 6, 0, 0]} maxBarSize={60}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </>
        )}

        {activeTab === 'orders' && (
          <OrdersRegistryView />
        )}

        {activeTab === 'work' && (
          <WorkRegistryMain project={selectedProject} settings={settings} />
        )}

        {activeTab === 'settlements' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="relative overflow-hidden rounded-3xl border border-emerald-100 dark:border-emerald-900/40 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_40%),linear-gradient(135deg,_#ffffff_0%,_#f8fafc_55%,_#ecfdf5_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_35%),linear-gradient(135deg,_rgba(17,24,39,0.96)_0%,_rgba(15,23,42,0.98)_60%,_rgba(6,78,59,0.35)_100%)] p-6 shadow-sm">
              <div className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-500/10" />
              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 shadow-sm dark:bg-white/5 dark:text-emerald-300">
                    <FileSpreadsheet size={14} />
                    Rozliczenia projektu
                  </div>
                  <h3 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Zestawienie kontraktu i rozliczeń</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                    Widok pokazuje realne wykorzystanie godzin z umowy: całość zakontraktowaną w zleceniach, część już rozliczoną oraz pozycje, które nadal czekają na protokół odbioru.
                  </p>
                </div>
                <div className="flex min-w-[220px] flex-col gap-3 lg:items-end">
                  <div className="flex items-center gap-3">
                    <ProjectLinksDropdown project={selectedProject} visibleInTab="settlements" />
                    <button
                      onClick={() => setIsFinancialDataVisible(!isFinancialDataVisible)}
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-sm font-semibold shadow-sm transition ${
                        isFinancialDataVisible
                          ? 'border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:border-emerald-900/40 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40'
                          : 'border-white/70 bg-white/90 text-slate-500 hover:bg-white dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-900'
                      }`}
                      title={isFinancialDataVisible ? 'Ukryj kwoty' : 'Pokaż kwoty'}
                    >
                      <DollarSign size={18} />
                    </button>
                    <button
                      onClick={() => setIsExecutiveSettlementReportOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200/70 bg-white/90 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-white dark:border-emerald-900/50 dark:bg-slate-900/70 dark:text-emerald-300 dark:hover:bg-slate-900"
                    >
                      <Printer size={16} />
                      Raport zarządczy
                    </button>
                  </div>
                  <div className="w-full min-w-[220px] rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">Wykorzystanie umowy</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-black text-gray-900 dark:text-white">{contractUsagePct.toFixed(1)}%</span>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">limitu max</span>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-200/80 dark:bg-gray-700/80">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${contractUsagePct > 100 ? 'bg-red-500' : contractUsagePct > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, Math.max(0, contractUsagePct))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {formatOrderHours(contractedTotalHours)} h z {formatOrderHours(selectedProject.maxHours)} h
                    </p>
                    <div className={`mt-3 rounded-xl border px-3 py-2 ${remainingInContract >= 0 ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-900/20' : 'border-red-200 bg-red-50/80 dark:border-red-900/40 dark:bg-red-900/20'}`}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Pozostało godzin</p>
                      <p className={`mt-1 text-xl font-black ${remainingInContract >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                        {formatOrderHours(remainingInContract)} h
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              {settlementRows.map((row) => (
                <div key={row.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-800">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">{row.label}</p>
                  <div className={`mt-3 text-3xl font-black tracking-tight ${row.tone}`}>
                    {row.value}
                    <span className="ml-1 text-sm font-semibold text-gray-400 dark:text-gray-500">h</span>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-sm leading-5 text-gray-500 dark:text-gray-400">{row.note}</p>
                    {isFinancialDataVisible && (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                          Netto: {formatCurrencyValue(Number(row.amountNet))} zł
                        </p>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                          Brutto: {formatCurrencyValue(Number(row.amountGross))} zł
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Wykres zleceń, logów i trendu</h4>
                  <h3 className="mt-2 text-2xl font-black text-gray-900 dark:text-white">Narastająco: godziny zleceń vs. godziny zalogowane</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    Główne linie pokazują, jak w czasie narastają godziny zakontraktowane w zleceniach oraz godziny rzeczywiście zalogowane przez zespół. Zakres analizy ustawisz ręcznie polami dat lub szybkimi przyciskami dla ostatniego półrocza i pełnej historii projektu.
                  </p>
                </div>
                <div className="flex min-w-[320px] flex-wrap items-end gap-3 lg:justify-end">
                  <label className="min-w-[150px] flex-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                    Zakres od
                    <input
                      type="date"
                      value={effectiveBurnUpRange?.start || ''}
                      onChange={(event) => {
                        const nextStart = event.target.value;
                        if (!nextStart) return;
                        setBurnUpRangeMode('custom');
                        setBurnUpVisibleRange(normalizeDateRange(nextStart, effectiveBurnUpRange?.end || nextStart));
                      }}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    />
                  </label>
                  <label className="min-w-[150px] flex-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                    Zakres do
                    <input
                      type="date"
                      value={effectiveBurnUpRange?.end || ''}
                      onChange={(event) => {
                        const nextEnd = event.target.value;
                        if (!nextEnd) return;
                        setBurnUpRangeMode('custom');
                        setBurnUpVisibleRange(normalizeDateRange(effectiveBurnUpRange?.start || nextEnd, nextEnd));
                      }}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    />
                  </label>
                  <button
                    onClick={applyLastHalfYearBurnUpRange}
                    className={`h-[42px] rounded-xl px-4 text-sm font-semibold transition ${
                      burnUpRangeMode === 'halfYear'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                    }`}
                  >
                    Ostatnie pół roku
                  </button>
                  <button
                    onClick={applyFullBurnUpRange}
                    className={`h-[42px] rounded-xl px-4 text-sm font-semibold transition ${
                      burnUpRangeMode === 'full'
                        ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                    }`}
                  >
                    Całość
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                  Powiększ: przeciągnij myszą po wykresie, aby zaznaczyć zakres dat.
                </p>
              </div>

              {visibleBurnUpTrendData.length > 0 ? (
                <>
                  <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
                    <div className="rounded-2xl bg-indigo-50 p-4 dark:bg-indigo-950/30">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300">Godziny zleceń narastająco</p>
                      <p className="mt-2 text-2xl font-black text-indigo-700 dark:text-indigo-200">{formatOrderHours(burnUpEstimateCeiling)} h</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-500 dark:text-emerald-300">Godziny zalogowane narastająco</p>
                      <p className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-200">{formatOrderHours(burnUpActualCeiling)} h</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/60">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Różnica godzin</p>
                      <p className={`mt-2 text-2xl font-black ${burnUpTrendTone}`}>{formatOrderHours(burnUpDeltaHours)} h</p>
                    </div>
                    <div className={`rounded-2xl p-4 ${burnUpTrendBadgeTone}`}>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em]">Relacja zleceń do logów / trend 30 dni</p>
                      <p className="mt-2 text-2xl font-black">
                        {burnUpTrendRatio !== null ? burnUpTrendRatio.toFixed(2) : 'brak'}
                        <span className="ml-2 text-sm font-semibold opacity-80">
                          {burnUpRollingTrendRatio !== null ? `30d: ${burnUpRollingTrendRatio.toFixed(2)}` : '30d: brak'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50/70 p-5 dark:border-gray-700 dark:bg-gray-900/30">
                    <div className="flex flex-col gap-2">
                      <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Narastanie godzin</h4>
                      <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
                        Główne linie pokazują, jak w czasie narastają godziny zakontraktowane w zleceniach oraz godziny rzeczywiście zalogowane przez zespół.
                      </p>
                    </div>
                    <div className="mt-5 h-[420px] min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={visibleBurnUpTrendData}
                          margin={{ top: 16, right: 24, left: 8, bottom: 12 }}
                          onMouseDown={handleBurnUpMouseDown}
                          onMouseMove={handleBurnUpMouseMove}
                          onMouseUp={handleBurnUpMouseUp}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.45} />
                          <XAxis
                            dataKey="date"
                            minTickGap={28}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => {
                              const date = new Date(`${value}T00:00:00`);
                              return Number.isNaN(date.getTime()) ? value : format(date, 'dd.MM');
                            }}
                            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                          />
                          <YAxis
                            yAxisId="hours"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickFormatter={(value) => `${Math.round(Number(value))}h`}
                          />
                          <Tooltip content={<BurnUpTrendTooltip />} />
                          <Legend verticalAlign="top" height={42} wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                          <Bar yAxisId="hours" dataKey="dailyEstimate" name="Przyrost godzin zleceń" fill="rgba(59,130,246,0.18)" stroke="none" barSize={10} isAnimationActive={false} />
                          <Area yAxisId="hours" dataKey="favorableBase" stackId="planBuffer" fill="transparent" stroke="none" isAnimationActive={false} legendType="none" />
                          <Area yAxisId="hours" dataKey="favorableGap" stackId="planBuffer" name="Bufor względem logów" fill="rgba(16,185,129,0.22)" stroke="none" isAnimationActive={false} />
                          <Area yAxisId="hours" dataKey="overrunBase" stackId="actualOverrun" fill="transparent" stroke="none" isAnimationActive={false} legendType="none" />
                          <Area yAxisId="hours" dataKey="overrunGap" stackId="actualOverrun" name="Przekroczenie logów nad zleceniami" fill="rgba(239,68,68,0.18)" stroke="none" isAnimationActive={false} />
                          <Line yAxisId="hours" type="monotone" dataKey="cumulativeEstimate" name="Godziny zleceń narastająco" stroke="#4f46e5" strokeWidth={3} dot={false} isAnimationActive={false} />
                          <Line yAxisId="hours" type="monotone" dataKey="cumulativeActual" name="Godziny zalogowane narastająco" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={false} />
                          {burnUpSelectionRange && (
                            <ReferenceArea
                              yAxisId="hours"
                              x1={burnUpSelectionRange.start}
                              x2={burnUpSelectionRange.end}
                              strokeOpacity={0}
                              fill="rgba(79,70,229,0.14)"
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50/70 p-5 dark:border-gray-700 dark:bg-gray-900/30">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div className="max-w-3xl">
                        <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Trend relacji</h4>
                        <h3 className="mt-2 text-2xl font-black text-gray-900 dark:text-white">Trend: godziny zleceń do godzin zalogowanych</h3>
                        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                          Ten wykres pokazuje wyłącznie relację między godzinami wynikającymi ze zleceń a godzinami rzeczywiście zalogowanymi w pracy. Wartość powyżej 1,0 oznacza zapas godzin w zleceniach, a wartość poniżej 1,0 oznacza niedoszacowanie względem realnie wykonanej pracy.
                        </p>
                      </div>
                      <div className={`inline-flex rounded-2xl px-4 py-3 text-sm font-bold ${burnUpTrendBadgeTone}`}>
                        {burnUpTrendRatio !== null ? `Bieżąca relacja: ${burnUpTrendRatio.toFixed(2)}` : 'Brak danych trendu'}
                      </div>
                    </div>

                    <div className="mt-6 h-[320px] min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={visibleBurnUpTrendData}
                          margin={{ top: 16, right: 24, left: 8, bottom: 12 }}
                          onMouseDown={handleBurnUpMouseDown}
                          onMouseMove={handleBurnUpMouseMove}
                          onMouseUp={handleBurnUpMouseUp}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.45} />
                          <XAxis
                            dataKey="date"
                            minTickGap={28}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => {
                              const date = new Date(`${value}T00:00:00`);
                              return Number.isNaN(date.getTime()) ? value : format(date, 'dd.MM');
                            }}
                            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            width={56}
                            domain={burnUpTrendDomain}
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickFormatter={(value) => `${Number(value).toFixed(1)}x`}
                          />
                          <Tooltip
                            formatter={(value: number | string | undefined, name?: string) => {
                              const numericValue = Number(value);
                              return [Number.isFinite(numericValue) ? `${numericValue.toFixed(2)}x` : 'brak', name ?? 'Trend'];
                            }}
                            labelFormatter={(label) => {
                              const date = new Date(`${label}T00:00:00`);
                              return `Data: ${Number.isNaN(date.getTime()) ? label : format(date, 'dd.MM.yyyy')}`;
                            }}
                          />
                          <Legend verticalAlign="top" height={38} wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                          <Line type="monotone" dataKey="trendRatio" name="Relacja zleceń / logów" stroke="#f59e0b" strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
                          <Line type="monotone" dataKey="rollingTrendRatio" name="Trend 30 dni" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
                          <Line type="monotone" dataKey="regressionTrendRatio" name="Kierunek trendu" stroke="#0f172a" strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
                          <Line type="monotone" dataKey={() => 1} name="Punkt równowagi 1,0" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} legendType="plainline" />
                          {burnUpSelectionRange && (
                            <ReferenceArea
                              x1={burnUpSelectionRange.start}
                              x2={burnUpSelectionRange.end}
                              strokeOpacity={0}
                              fill="rgba(79,70,229,0.14)"
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-sm leading-7 text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                  Brak wystarczających danych do zbudowania wykresów zleceń, logów i trendu. Wymagane są zlecenia z datami i godzinami albo logi pracy z YouTrack.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-800 overflow-hidden">
                <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
                  <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Tabela rozliczeń</h4>
                </div>
                <div className="grid grid-cols-1 gap-4 p-4 sm:p-5">
                  {settlementRows.map((row) => (
                    <div key={row.label} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/30">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{row.label}</p>
                          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">{row.note}</p>
                        </div>
                        <div className="sm:text-right shrink-0">
                          <p className={`text-2xl font-black ${row.tone}`}>{row.value} h</p>
                        </div>
                      </div>
                      {isFinancialDataVisible && (
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800/70">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Netto</p>
                            <p className="mt-1 text-base font-bold text-gray-900 dark:text-white">{formatCurrencyValue(Number(row.amountNet))} zł</p>
                          </div>
                          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800/70">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Brutto</p>
                            <p className="mt-1 text-base font-bold text-gray-900 dark:text-white">{formatCurrencyValue(Number(row.amountGross))} zł</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
                  <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Zyskowność projektu</h4>
                  <div className="mt-4 space-y-4">
                    {profitabilityRows.map((row) => (
                      <div key={row.label} className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{row.label}</p>
                          <p className={`text-xl font-black ${row.tone}`}>{row.value} h</p>
                        </div>
                        <p className="mt-2 text-sm leading-5 text-gray-500 dark:text-gray-400">{row.note}</p>
                        {isFinancialDataVisible && (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                            {row.financialNote}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className={`mt-5 rounded-2xl border p-4 ${profitabilityHours >= 0 ? 'border-emerald-100 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/20' : 'border-red-100 bg-red-50 dark:border-red-900/30 dark:bg-red-900/20'}`}>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Marża godzinowa</p>
                    <p className={`mt-2 text-3xl font-black ${profitabilityHours >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                      {profitabilityPct.toFixed(1)}%
                    </p>
                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                      {profitabilityHours >= 0
                        ? 'Dodatnia różnica oznacza, że zakontraktowano więcej godzin niż rzeczywiście przepracowano, więc projekt utrzymuje dodatnią zyskowność godzinową.'
                        : 'Ujemna różnica oznacza, że przepracowano więcej godzin niż zakontraktowano, więc projekt generuje stratę na godzinach.'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
                  <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Osoby pracujące w projekcie</h4>
                  <div className="mt-5 space-y-4">
                    {authorHours.length > 0 ? authorHours.map((author) => {
                      const sharePct = youtrackTotal > 0 ? (author.hours / youtrackTotal) * 100 : 0;
                      return (
                        <div key={author.name} className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{author.name}</p>
                            <p className="text-lg font-black text-slate-700 dark:text-slate-200">{formatOrderHours(author.hours)} h</p>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                              className="h-full rounded-full bg-sky-500 transition-all duration-700"
                              style={{ width: `${Math.min(100, Math.max(0, sharePct))}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                            Udział w przepracowanych godzinach: {sharePct.toFixed(1)}%
                          </p>
                        </div>
                      );
                    }) : (
                      <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
                        Brak zalogowanych godzin w rejestrze pracy dla tego projektu.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
                  <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Status zleceń</h4>
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-900/20">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">W trakcie</p>
                      <p className="mt-2 text-3xl font-black text-amber-800 dark:text-amber-200">{inProgressOrders.length}</p>
                      <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">Mają datę od, bez przekazania i bez odbioru</p>
                    </div>
                    <div className="rounded-2xl bg-sky-50 p-4 dark:bg-sky-900/20">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Po protokole przekazania</p>
                      <p className="mt-2 text-3xl font-black text-sky-800 dark:text-sky-200">{handedOverPendingOrders.length}</p>
                      <p className="mt-1 text-xs text-sky-700/80 dark:text-sky-300/80">Mają przekazanie, nadal bez odbioru</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-800/70">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">Anulowane</p>
                      <p className="mt-2 text-3xl font-black text-slate-800 dark:text-slate-100">{cancelledOrders.length}</p>
                      <p className="mt-1 text-xs text-slate-600/80 dark:text-slate-300/80">Nie mają uzupełnionej żadnej daty</p>
                    </div>
                  </div>
                </div>

                <div className={`rounded-2xl border p-6 shadow-sm ${remainingInContract >= 0 ? 'border-fuchsia-100 bg-fuchsia-50 dark:border-fuchsia-900/30 dark:bg-fuchsia-900/20' : 'border-red-100 bg-red-50 dark:border-red-900/30 dark:bg-red-900/20'}`}>
                  <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Wniosek</h4>
                  <p className={`mt-4 text-2xl font-black ${remainingInContract >= 0 ? 'text-fuchsia-700 dark:text-fuchsia-300' : 'text-red-700 dark:text-red-300'}`}>
                    {remainingInContract >= 0 ? 'Umowa mieści się w limicie' : 'Umowa jest przekroczona'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {remainingInContract >= 0
                      ? `Po uwzględnieniu wszystkich zleceń w rejestrze pozostaje jeszcze ${formatOrderHours(remainingInContract)} h do wykorzystania w ramach umowy.`
                      : `Suma zleceń przekracza limit umowny o ${formatOrderHours(Math.abs(remainingInContract))} h i wymaga korekty lub aneksu.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'status' && (
          <StatusMain project={selectedProject} />
        )}

        {activeTab === '__status_placeholder__' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 shadow-sm border border-gray-100 dark:border-gray-800 text-center flex flex-col items-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-4">
              <Activity size={28} className="text-blue-400 dark:text-blue-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Status Projektu</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm">Rozbudowany moduł śledzenia postępów i alertów jest w przygotowaniu.</p>
          </div>
        )}

        {activeTab === 'youtrack' && (
          <YouTrackTab project={selectedProject} />
        )}

        {activeTab === 'estimation' && (
          <EstimationMain project={selectedProject} />
        )}

        {activeTab === 'notes' && (
          <MeetingNotesMain project={selectedProject} />
        )}

      </div>

      <ExecutiveSettlementReportModal
        isOpen={isExecutiveSettlementReportOpen}
        onClose={() => setIsExecutiveSettlementReportOpen(false)}
        project={selectedProject}
        orders={orders}
        workItems={workItems}
        isFinancialDataVisible={isFinancialDataVisible}
        onToggleFinancialData={() => setIsFinancialDataVisible(!isFinancialDataVisible)}
      />
    </div >
  );
};

const OrdersRegistryView = () => {
  const { selectedProject } = useProjectContext();
  const { orders, isLoading, addOrder, updateOrder, deleteOrder, importOrders } = useOrders(selectedProject?.id);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPmsReportModalOpen, setIsPmsReportModalOpen] = useState(false);
  const [isReportsExpanded, setIsReportsExpanded] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  if (!selectedProject) return null;

  const handleOpenModal = () => {
    setEditingOrder(null);
    setIsModalOpen(true);
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  const handleSave = async (orderData: Omit<Order, 'id'>) => {
    if (editingOrder) {
      await updateOrder(editingOrder.id, orderData);
    } else {
      await addOrder(orderData);
    }
    setIsModalOpen(false);
  };

  const handleDeleteFromModal = async () => {
    if (!editingOrder) {
      return;
    }

    if (!window.confirm('Czy na pewno chcesz usunąć to zlecenie?')) {
      return;
    }

    await deleteOrder(editingOrder.id);
    setIsModalOpen(false);
    setEditingOrder(null);
  };

  const handleExport = () => {
    if (!selectedProject || orders.length === 0) return;
    const fileName = `Zlecenia_${selectedProject.code}_${format(new Date(), 'yyyy-MM-dd')}`;
    exportOrdersToExcel(orders, selectedProject, fileName);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const items = await importOrdersFromExcel(file);
      if (items.length === 0) {
        alert('Nie znaleziono poprawnych zleceń w pliku.');
        return;
      }
      if (confirm(`Czy zaimportować ${items.length} zleceń? Istniejące ID nie zostaną nadpisane.`)) {
        await importOrders(items);
        alert('Import zakończony pomyślnie.');
      }
    } catch (err: any) {
      alert('Błąd podczas importu: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
            <Briefcase className="text-indigo-500" /> Rejestr Zleceń
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Zarządzaj zleceniami dla: {selectedProject.code}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={orders.length === 0}
            className="p-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm disabled:opacity-50"
            title="Eksport do Excel"
            aria-label="Eksport do Excel"
          >
            <FileDown size={18} />
          </button>

          <label
            className="p-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm cursor-pointer"
            title="Import z Excel"
            aria-label="Import z Excel"
          >
            <FileUp size={18} />
            <input type="file" accept=".xlsx, .xls" onChange={handleImport} className="hidden" />
          </label>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsReportsExpanded((current) => !current)}
              className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
              aria-expanded={isReportsExpanded}
              aria-haspopup="true"
            >
              <FileText size={16} />
              <span>Raporty</span>
              <ChevronDown size={16} className={`transition-transform ${isReportsExpanded ? 'rotate-180' : ''}`} />
            </button>

            {isReportsExpanded && (
              <div className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsReportsExpanded(false);
                      setIsReportModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-indigo-600 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-indigo-300"
                  >
                    <FileText size={15} />
                    <span>Raport CBCP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsReportsExpanded(false);
                      setIsPmsReportModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-indigo-600 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-indigo-300"
                  >
                    <FileText size={15} />
                    <span>Raport PMS</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <ProjectLinksDropdown project={selectedProject} visibleInTab="orders" />
          <button onClick={handleOpenModal} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm">
            <Plus size={16} /> Nowe Zlecenie
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900/50 rounded-full flex items-center justify-center mb-4">
              <Briefcase size={28} className="text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Brak zleceń</h3>
            <p className="text-gray-500 dark:text-gray-400">W tym projekcie nie ma jeszcze żadnych zleceń.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">Nr</th>
                  <th className="px-6 py-4">Tytuł</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">Daty</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Suma Godzin</th>
                  <th className="px-6 py-4 text-right">Kwota Brutto <span className="text-xs font-normal text-gray-400">(Netto)</span></th>
                  <th className="px-6 py-4 text-center">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {orders.map(order => {
                  const totalHours = order.items.reduce((sum, item) => sum + (Number(item.hours) || 0), 0);
                  const total = totalHours * selectedProject.rateNetto;
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white whitespace-nowrap">{order.orderNumber}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                          {order.title}
                          {order.notes && (
                            <span title={order.notes} className="flex items-center cursor-help">
                              <Info size={16} className="text-indigo-400 dark:text-indigo-500" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center leading-tight whitespace-nowrap">
                        <div className="text-gray-900 dark:text-gray-300 font-medium">
                          {order.scheduleFrom || '-'} – {order.scheduleTo || '-'}
                        </div>
                        <div className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5" title="Przekazanie , Odbiór">
                          {order.handoverDate || '-'} , {order.acceptanceDate || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500 whitespace-nowrap">{formatOrderHours(totalHours)}h</td>
                      <td className="px-6 py-4 text-right leading-tight whitespace-nowrap">
                        <div className="text-indigo-600 dark:text-indigo-400 font-medium">
                          {(totalHours * selectedProject.rateBrutto).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                        </div>
                        <div className="text-[13px] text-gray-400 dark:text-gray-500 mt-0.5">
                          ({total.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł)
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => handleEdit(order)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition mr-1">
                          <Edit2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 font-bold">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right uppercase text-xs tracking-wider text-gray-500">Razem</td>
                  <td className="px-6 py-4 text-right text-indigo-600 dark:text-indigo-400 text-base">
                    {formatOrderHours(orders.reduce((sum, order) => sum + order.items.reduce((s, item) => s + (Number(item.hours) || 0), 0), 0))}h
                  </td>
                  <td className="px-6 py-4 text-right leading-tight whitespace-nowrap">
                    <div className="text-indigo-600 dark:text-indigo-400 text-base">
                      {(orders.reduce((sum, order) => sum + order.items.reduce((s, item) => s + (Number(item.hours) || 0), 0), 0) * selectedProject.rateBrutto).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                    </div>
                    <div className="text-sm text-gray-400 font-normal uppercase tracking-wider mt-0.5">
                      ({(orders.reduce((sum, order) => sum + order.items.reduce((s, item) => s + (Number(item.hours) || 0), 0), 0) * selectedProject.rateNetto).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł)
                    </div>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <OrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} project={selectedProject} orderToEdit={editingOrder} onSave={handleSave} onDelete={handleDeleteFromModal} />
      <ReportCbcpModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} project={selectedProject} orders={orders} />
      <ReportPmsModal isOpen={isPmsReportModalOpen} onClose={() => setIsPmsReportModalOpen(false)} project={selectedProject} orders={orders} />
    </div>
  );
};

const handleDateInputTabNavigation = (event: React.KeyboardEvent<HTMLInputElement>) => {
  if (event.key !== 'Tab') return;

  const container = event.currentTarget.closest('form, .no-print, [role="dialog"]');
  if (!container) return;

  const focusableElements = Array.from(
    container.querySelectorAll<HTMLElement>('input, select, textarea, button, [tabindex]:not([tabindex="-1"])')
  ).filter((element) => {
    if (element.hasAttribute('disabled')) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    if (element.tabIndex < 0) return false;
    return element.offsetParent !== null;
  });

  const currentIndex = focusableElements.indexOf(event.currentTarget);
  if (currentIndex === -1) return;

  const nextIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;
  const nextElement = focusableElements[nextIndex];
  if (!nextElement) return;

  event.preventDefault();
  nextElement.focus();
};

const hasOrderDateValue = (value?: string) => Boolean(value && value.trim());
const getOrderHoursTotal = (order: Order) =>
  order.items.reduce((sum, item) => sum + (Number(item.hours) || 0), 0);
const isCancelledOrder = (order: Order) =>
  !hasOrderDateValue(order.scheduleFrom)
  && !hasOrderDateValue(order.scheduleTo)
  && !hasOrderDateValue(order.handoverDate)
  && !hasOrderDateValue(order.acceptanceDate);
const isSettledOrder = (order: Order) => hasOrderDateValue(order.acceptanceDate);
const isPendingSettlementOrder = (order: Order) =>
  !isCancelledOrder(order)
  && !isSettledOrder(order)
  && hasOrderDateValue(order.scheduleFrom);
const isHandedOverPendingOrder = (order: Order) =>
  isPendingSettlementOrder(order) && hasOrderDateValue(order.handoverDate);
const isInProgressPendingOrder = (order: Order) =>
  isPendingSettlementOrder(order) && !hasOrderDateValue(order.handoverDate);

const createOrderItemRow = (overrides?: Partial<OrderItem>): OrderItem => ({
  id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
  name: '',
  date: '',
  hours: 0,
  ...overrides,
});

const buildOrderItemsFromTemplate = (template?: { names?: string[]; lastDate?: string } | null): OrderItem[] => {
  const names = (template?.names || []).map(name => name.trim()).filter(Boolean);
  if (names.length === 0) {
    return [createOrderItemRow(template?.lastDate ? { date: template.lastDate } : undefined)];
  }

  return names.map(name => createOrderItemRow({ name, date: template?.lastDate || '', hours: 0 }));
};

const formatOrderHours = (value: number) =>
  value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatCurrencyValue = (value: number) =>
  value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseCalendarDate = (value?: string) => {
  if (!value?.trim()) return null;
  const normalizedValue = value.includes('T') ? value : `${value}T00:00:00`;
  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
};
const getDateKey = (date: Date) => format(date, 'yyyy-MM-dd');
const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};
const addMonths = (date: Date, months: number) => {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
};
const getDaysDiffInclusive = (start: Date, end: Date) =>
  Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
const getMinDate = (dates: Date[]) =>
  dates.reduce((minDate, currentDate) => (currentDate.getTime() < minDate.getTime() ? currentDate : minDate));
const getMaxDate = (dates: Date[]) =>
  dates.reduce((maxDate, currentDate) => (currentDate.getTime() > maxDate.getTime() ? currentDate : maxDate));
const normalizeDateRange = (start: string, end: string) =>
  start <= end ? { start, end } : { start: end, end: start };
const getOrderTimelineStartDate = (order: Order) => {
  const itemDates = order.items
    .map((item) => parseCalendarDate(item.date))
    .filter((date): date is Date => Boolean(date));
  const candidateDates = [
    parseCalendarDate(order.scheduleFrom),
    ...itemDates,
    parseCalendarDate(order.handoverDate),
    parseCalendarDate(order.acceptanceDate),
    parseCalendarDate(order.scheduleTo),
    parseCalendarDate(order.createdAt),
  ].filter((date): date is Date => Boolean(date));

  if (candidateDates.length === 0) {
    return null;
  }

  return getMinDate(candidateDates);
};
const getOrderTimelineEndDate = (order: Order, fallbackEndDate: Date) =>
  parseCalendarDate(order.scheduleTo)
  || parseCalendarDate(order.acceptanceDate)
  || parseCalendarDate(order.handoverDate)
  || fallbackEndDate;

type BurnUpTrendPoint = {
  date: string;
  shortLabel: string;
  dailyEstimate: number;
  dailyActual: number;
  cumulativeEstimate: number;
  cumulativeActual: number;
  deltaHours: number;
  deltaPct: number | null;
  trendRatio: number | null;
  rollingTrendRatio: number | null;
  regressionTrendRatio: number | null;
  favorableBase: number;
  favorableGap: number;
  overrunBase: number;
  overrunGap: number;
};

const buildBurnUpTrendData = ({
  orders,
  workItems,
  contractEndDate,
}: {
  orders: Order[];
  workItems: Array<{ date: string; minutes: number }>;
  contractEndDate?: string;
}) => {
  const today = parseCalendarDate(format(new Date(), 'yyyy-MM-dd')) || new Date();
  const contractEnd = parseCalendarDate(contractEndDate) || today;
  const relevantOrders = orders
    .map((order) => {
      const startDate = getOrderTimelineStartDate(order);
      const endDate = getOrderTimelineEndDate(order, contractEnd);
      const totalHours = getOrderHoursTotal(order);

      if (!startDate || !endDate || totalHours <= 0) {
        return null;
      }

      const normalizedEndDate = endDate.getTime() >= startDate.getTime() ? endDate : startDate;
      return {
        startDate,
        endDate: normalizedEndDate,
        totalHours,
      };
    })
    .filter((order): order is { startDate: Date; endDate: Date; totalHours: number } => Boolean(order));

  const actualEntries = workItems
    .map((item) => ({
      date: parseCalendarDate(item.date),
      hours: (item.minutes || 0) / 60,
    }))
    .filter((entry): entry is { date: Date; hours: number } => Boolean(entry.date));

  const boundaryDates = [
    ...relevantOrders.flatMap((order) => [order.startDate, order.endDate]),
    ...actualEntries.map((entry) => entry.date),
  ];

  if (boundaryDates.length === 0) {
    return [] as BurnUpTrendPoint[];
  }

  const startDate = getMinDate(boundaryDates);
  const endDate = getMaxDate([new Date(), ...boundaryDates]);
  const dailyEstimateMap = new Map<string, number>();
  const dailyActualMap = new Map<string, number>();

  relevantOrders.forEach((order) => {
    const durationDays = getDaysDiffInclusive(order.startDate, order.endDate);
    const dailyEstimate = order.totalHours / durationDays;
    for (let offset = 0; offset < durationDays; offset += 1) {
      const dateKey = getDateKey(addDays(order.startDate, offset));
      dailyEstimateMap.set(dateKey, (dailyEstimateMap.get(dateKey) || 0) + dailyEstimate);
    }
  });

  actualEntries.forEach((entry) => {
    const dateKey = getDateKey(entry.date);
    dailyActualMap.set(dateKey, (dailyActualMap.get(dateKey) || 0) + entry.hours);
  });

  const points: BurnUpTrendPoint[] = [];
  const rollingEstimateWindow: number[] = [];
  const rollingActualWindow: number[] = [];
  let cumulativeEstimate = 0;
  let cumulativeActual = 0;

  for (let cursor = new Date(startDate); cursor.getTime() <= endDate.getTime(); cursor = addDays(cursor, 1)) {
    const dateKey = getDateKey(cursor);
    const dailyEstimate = dailyEstimateMap.get(dateKey) || 0;
    const dailyActual = dailyActualMap.get(dateKey) || 0;
    const isAfterToday = cursor.getTime() > today.getTime();

    cumulativeEstimate += dailyEstimate;
    cumulativeActual += dailyActual;

    rollingEstimateWindow.push(dailyEstimate);
    rollingActualWindow.push(dailyActual);
    if (rollingEstimateWindow.length > 30) rollingEstimateWindow.shift();
    if (rollingActualWindow.length > 30) rollingActualWindow.shift();

    const rollingEstimateAvg = rollingEstimateWindow.reduce((sum, value) => sum + value, 0) / rollingEstimateWindow.length;
    const rollingActualAvg = rollingActualWindow.reduce((sum, value) => sum + value, 0) / rollingActualWindow.length;
    const deltaHours = cumulativeEstimate - cumulativeActual;
    const minBandBase = Math.min(cumulativeEstimate, cumulativeActual);

    points.push({
      date: dateKey,
      shortLabel: format(cursor, 'dd.MM'),
      dailyEstimate,
      dailyActual,
      cumulativeEstimate,
      cumulativeActual,
      deltaHours,
      deltaPct: cumulativeActual > 0 ? (deltaHours / cumulativeActual) * 100 : null,
      trendRatio: !isAfterToday && cumulativeActual > 0 ? cumulativeEstimate / cumulativeActual : null,
      rollingTrendRatio: !isAfterToday && rollingActualAvg > 0 ? rollingEstimateAvg / rollingActualAvg : null,
      regressionTrendRatio: null,
      favorableBase: minBandBase,
      favorableGap: Math.max(cumulativeEstimate - cumulativeActual, 0),
      overrunBase: minBandBase,
      overrunGap: Math.max(cumulativeActual - cumulativeEstimate, 0),
    });
  }

  const regressionPoints = points
    .map((point, index) => ({ x: index, y: point.rollingTrendRatio ?? point.trendRatio }))
    .filter((point): point is { x: number; y: number } => typeof point.y === 'number' && Number.isFinite(point.y));

  if (regressionPoints.length >= 2) {
    const pointCount = regressionPoints.length;
    const sumX = regressionPoints.reduce((sum, point) => sum + point.x, 0);
    const sumY = regressionPoints.reduce((sum, point) => sum + point.y, 0);
    const sumXY = regressionPoints.reduce((sum, point) => sum + point.x * point.y, 0);
    const sumXX = regressionPoints.reduce((sum, point) => sum + point.x * point.x, 0);
    const denominator = (pointCount * sumXX) - (sumX * sumX);

    if (denominator !== 0) {
      const slope = ((pointCount * sumXY) - (sumX * sumY)) / denominator;
      const intercept = (sumY - (slope * sumX)) / pointCount;

      points.forEach((point, index) => {
        if (point.trendRatio === null && point.rollingTrendRatio === null) {
          point.regressionTrendRatio = null;
          return;
        }

        point.regressionTrendRatio = intercept + (slope * index);
      });
    }
  }

  return points;
};

const BurnUpTrendTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: BurnUpTrendPoint }>;
  label?: string;
}) => {
  if (!active || !payload?.[0]) return null;

  const point = payload[0].payload;

  return (
    <div className="max-w-[280px] rounded-2xl border border-gray-200 bg-white/95 p-4 text-sm shadow-xl dark:border-gray-700 dark:bg-gray-900/95">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
        {label ? format(new Date(`${label}T00:00:00`), 'dd.MM.yyyy') : '-'}
      </p>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500 dark:text-gray-400">Godziny zleceń narastająco</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-300">{formatOrderHours(point.cumulativeEstimate)} h</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500 dark:text-gray-400">Godziny zalogowane narastająco</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-300">{formatOrderHours(point.cumulativeActual)} h</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500 dark:text-gray-400">Przyrost zleceń w dniu</span>
          <span className="font-bold text-sky-600 dark:text-sky-300">{formatOrderHours(point.dailyEstimate)} h</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500 dark:text-gray-400">Delta</span>
          <span className={`font-bold ${point.deltaHours >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
            {formatOrderHours(point.deltaHours)} h{point.deltaPct !== null ? ` (${point.deltaPct.toFixed(1)}%)` : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

const removeFinancialSentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/zł/i.test(sentence))
    .join(' ')
    .trim();

const OrderModal = ({ isOpen, onClose, project, orderToEdit, onSave, onDelete }: any) => {
  const [formData, setFormData] = useState<Omit<Order, 'id'>>({
    projectId: project?.id || '',
    orderNumber: '',
    title: '',
    priority: 'niski',
    problemDescription: '',
    expectedStateDescription: '',
    items: [createOrderItemRow()],
    location: 'zdalnie',
    methodologyRequired: false,
    methodologyScope: '',
    scheduleFrom: '',
    scheduleTo: '',
    handoverDate: '',
    acceptanceDate: '',
    systemModule: project?.code || '',
    notes: '',
    createdAt: new Date().toISOString()
  });

  useEffect(() => {
    const loadFormData = async () => {
      if (!isOpen) return;

      if (orderToEdit) {
        setFormData(orderToEdit);
        return;
      }

      if (!project) {
        return;
      }

      const template = window.electron?.getOrderItemTemplate
        ? await window.electron.getOrderItemTemplate(project.id)
        : null;

      setFormData({
        projectId: project.id,
        orderNumber: '',
        title: '',
        priority: 'niski',
        problemDescription: '',
        expectedStateDescription: '',
        items: buildOrderItemsFromTemplate(template),
        location: 'zdalnie',
        methodologyRequired: false,
        methodologyScope: '',
        scheduleFrom: '',
        scheduleTo: '',
        handoverDate: '',
        acceptanceDate: '',
        systemModule: project.code,
        notes: '',
        createdAt: new Date().toISOString()
      });
    };

    void loadFormData();
  }, [orderToEdit, isOpen, project]);

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleItemChange = (id: string, field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const addItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, createOrderItemRow()]
    }));
  };

  const removeItemRow = (id: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (project?.id && window.electron?.saveOrderItemTemplate) {
      const names = formData.items.map(item => item.name.trim()).filter(Boolean);
      const lastDatedItem = [...formData.items].reverse().find(item => item.date);
      await window.electron.saveOrderItemTemplate({
        projectId: project.id,
        data: {
          names,
          lastDate: lastDatedItem?.date || '',
        },
      });
    }
    await onSave(formData);
  };

  if (!isOpen) return null;

  const totalHours = formData.items.reduce((sum, item) => sum + (Number(item.hours) || 0), 0);
  const totalAmountNetto = totalHours * (project?.rateNetto || 0);
  const totalAmountBrutto = totalHours * (project?.rateBrutto || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0 bg-gray-50 dark:bg-gray-800/80 rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Briefcase className="text-indigo-500" />
            {orderToEdit ? 'Edytuj Formularz Zlecenia' : 'Nowy Formularz Zlecenia'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-6 overflow-y-auto flex-1">
          <form id="order-form" onSubmit={handleSubmit} className="space-y-8">

            {/* Sekcja 1: Podstawowe */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Formularz zlecenia nr *</label>
                <input required name="orderNumber" value={formData.orderNumber} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tytuł zlecenia *</label>
                <input required name="title" value={formData.title} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition" />
              </div>
              <div className="grid grid-cols-2 gap-4 md:col-span-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data realizacji od</label>
                  <input type="date" name="scheduleFrom" value={formData.scheduleFrom} onChange={handleChange} onKeyDown={handleDateInputTabNavigation} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data realizacji do</label>
                  <input type="date" name="scheduleTo" value={formData.scheduleTo} onChange={handleChange} onKeyDown={handleDateInputTabNavigation} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:col-span-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data przekazania</label>
                  <input type="date" name="handoverDate" value={formData.handoverDate || ''} onChange={handleChange} onKeyDown={handleDateInputTabNavigation} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data odbioru zlecenia</label>
                  <input type="date" name="acceptanceDate" value={formData.acceptanceDate || ''} onChange={handleChange} onKeyDown={handleDateInputTabNavigation} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:col-span-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System / Moduł</label>
                  <input name="systemModule" value={formData.systemModule || ''} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priorytet zlecenia</label>
                  <select name="priority" value={formData.priority} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition">
                    <option value="niski">Niski</option>
                    <option value="normalny">Normalny</option>
                    <option value="wysoki">Wysoki</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Sekcja 2: Opisy */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Opis problemu (przed wdrożeniem)</label>
                <textarea name="problemDescription" value={formData.problemDescription} onChange={handleChange} rows={3} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none"></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Opis stanu oczekiwanego (po wdrożeniu)</label>
                <textarea name="expectedStateDescription" value={formData.expectedStateDescription} onChange={handleChange} rows={3} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none"></textarea>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Uwagi dodatkowe (wewnętrzne)</label>
                <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={2} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none" placeholder="Opcjonalne uwagi do zlecenia. Pojawią się jako informacja po najechaniu w rejestrze."></textarea>
              </div>
            </div>

            {/* Sekcja 3: Wycena (Produkty) */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 dark:bg-gray-900/80 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Wycena (Produkty zlecenia)</h3>
                <button type="button" onClick={addItemRow} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 hover:text-indigo-700 transition">
                  <Plus size={16} /> Dodaj wiersz
                </button>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-gray-800/50">
                    <tr>
                      <th className="py-3 px-4 w-10 text-center">Lp.</th>
                      <th className="py-3 px-4">Produkty zlecenia</th>
                      <th className="py-3 px-4 w-36">Data wykonania</th>
                      <th className="py-3 px-4 w-28 text-center">L. godzin rob.</th>
                      <th className="py-3 px-4 w-32 text-right">Stawka za h <span className="block text-[10px] text-gray-400 font-normal">Brutto (Netto)</span></th>
                      <th className="py-3 px-4 w-40 text-right">Kwota <span className="block text-[10px] text-gray-400 font-normal">Brutto (Netto)</span></th>
                      <th className="py-3 px-4 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {formData.items.map((item, idx) => (
                      <tr key={item.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                        <td className="py-2 px-4 text-center text-gray-400">{idx + 1}.</td>
                        <td className="py-2 px-4">
                          <input value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} className="w-full rounded bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-500 dark:hover:border-gray-600 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 px-2 py-1.5 focus:ring-0 outline-none transition" placeholder="Wpisz nazwę..." />
                        </td>
                        <td className="py-2 px-4">
                          <input type="date" value={item.date} onChange={e => handleItemChange(item.id, 'date', e.target.value)} onKeyDown={handleDateInputTabNavigation} className="w-full rounded bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-500 dark:hover:border-gray-600 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 px-2 py-1.5 focus:ring-0 outline-none transition [color-scheme:light] dark:[color-scheme:dark]" />
                        </td>
                        <td className="py-2 px-4">
                          <input type="number" min="0" step="0.01" value={item.hours} onChange={e => handleItemChange(item.id, 'hours', parseFloat(e.target.value) || 0)} className="w-full rounded bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-500 dark:hover:border-gray-600 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 px-2 py-1.5 text-center focus:ring-0 outline-none transition" />
                        </td>
                        <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap leading-tight">
                          <div className="font-medium text-gray-900 dark:text-white">{project?.rateBrutto.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</div>
                          <div className="text-[11px] text-gray-400">({project?.rateNetto.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł)</div>
                        </td>
                        <td className="py-2 px-4 text-right whitespace-nowrap leading-tight">
                          <div className="font-bold text-gray-900 dark:text-gray-200">{((item.hours || 0) * (project?.rateBrutto || 0)).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</div>
                          <div className="text-[11px] text-gray-400">({((item.hours || 0) * (project?.rateNetto || 0)).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł)</div>
                        </td>
                        <td className="py-2 px-4 text-center">
                          <button type="button" onClick={() => removeItemRow(item.id)} className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition focus:opacity-100">
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {formData.items.length === 0 && (
                      <tr><td colSpan={7} className="py-6 text-center text-gray-500 dark:text-gray-400">Tabela jest pusta. Dodaj przynajmniej jeden produkt zlecenia.</td></tr>
                    )}
                  </tbody>
                  <tfoot className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 font-bold">
                    <tr>
                      <td colSpan={3} className="py-4 px-4 text-right uppercase text-xs tracking-wider text-gray-500">Razem</td>
                      <td className="py-4 px-4 text-center text-indigo-600 dark:text-indigo-400 text-lg">{formatOrderHours(totalHours)}</td>
                      <td></td>
                      <td className="py-4 px-4 text-right leading-tight whitespace-nowrap">
                        <div className="text-indigo-600 dark:text-indigo-400 text-lg">{totalAmountBrutto.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-normal mt-0.5">({totalAmountNetto.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł)</div>
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Sekcja 4: Dodatkowe */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-900/30 p-5 rounded-xl border border-gray-100 dark:border-gray-800/50">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Miejsce wykonywania usługi</label>
                <input name="location" value={formData.location} onChange={handleChange} placeholder="np. zdalnie / w siedzibie" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mt-[2px]">
                  <input type="checkbox" name="methodologyRequired" checked={formData.methodologyRequired} onChange={handleChange} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600" />
                  Wymagane zastosowanie metodyki wdrożenia (TAK)
                </label>
                {formData.methodologyRequired && (
                  <div className="animate-in slide-in-from-top-2 duration-200">
                    <input name="methodologyScope" placeholder="Podaj w jakim zakresie..." value={formData.methodologyScope} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-sm" />
                  </div>
                )}
              </div>
            </div>

          </form>
        </div>

        {/* MODAL FOOTER STATIC */}
        <div className="px-6 py-4 flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800/80 rounded-b-2xl">
          <div>
            {orderToEdit && (
              <button
                type="button"
                onClick={onDelete}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition"
              >
                Usuń zlecenie
              </button>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
              Anuluj
            </button>
            <button type="submit" form="order-form" className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition">
              Zapisz Zlecenie
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

const ReportCbcpModal = ({ isOpen, onClose, project, orders }: { isOpen: boolean, onClose: () => void, project: Project, orders: Order[] }) => {
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodFrom, setPeriodFrom] = useState(project?.dateFrom || '');
  const [periodTo, setPeriodTo] = useState(project?.dateTo || '');

  if (!isOpen) return null;

  const reportData = buildCbcpReportData(orders, periodFrom, periodTo, reportDate);

  return (
    <div className="fixed inset-0 z-[100] bg-white text-black overflow-y-auto">
      <style>{`
        @media print {
          @page { size: landscape; margin: 15mm; }
          body { background: white; }
          .no-print { display: none !important; }
          .print-section { display: block !important; padding: 0 !important; }
          .print-table th, .print-table td { border: 1px solid black !important; padding: 6px !important; font-size: 11px !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center z-10">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sporządzono:</label>
            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} onKeyDown={handleDateInputTabNavigation} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white outline-none focus:border-indigo-500" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Okres od:</label>
            <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} onKeyDown={handleDateInputTabNavigation} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white outline-none focus:border-indigo-500" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Do:</label>
            <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} onKeyDown={handleDateInputTabNavigation} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCbcpReportToWord(project, reportData)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition flex items-center gap-2">
            <FileText size={16} /> Export Word
          </button>
          <button onClick={() => exportCbcpReportToExcel(project, reportData)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition flex items-center gap-2">
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button onClick={() => window.print()} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm">
            <Printer size={16} /> Export PDF / Drukuj
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            Zamknij
          </button>
        </div>
      </div>

      <div className="print-section max-w-[297mm] mx-auto p-12 bg-white min-h-screen font-serif text-[12px] leading-relaxed text-black">
        <div className="text-right font-bold mb-6">
          Załącznik nr 14. Wzór raportu końcowego z realizacji usług.
        </div>

        <h1 className="text-center font-bold text-lg mb-8">
          <span>Raport Końcowy</span> realizacji usług w ramach Umowy <span className="border-b-2 border-dotted border-black px-4">{project.contractNo}</span>
        </h1>

        <div className="flex justify-between items-start mb-8 gap-8">
          <div className="space-y-2">
            <div>
              Data sporządzenia raportu: <span className="border-b border-dotted border-black inline-block min-w-[120px] text-center px-2">{reportDate}</span>
            </div>
            <div>
              Raport za okres od <span className="border-b border-dotted border-black inline-block px-2 min-w-[80px] text-center">{periodFrom}</span> do <span className="border-b border-dotted border-black inline-block px-2 min-w-[80px] text-center">{periodTo}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              Liczba zgłoszeń w raportowanym okresie <span className="border-b border-dotted border-black inline-block min-w-[40px] text-center">{reportData.totalOrders}</span>
            </div>
            <div>
              Liczba zgłoszeń zrealizowanych w raportowanym okresie <span className="border-b border-dotted border-black inline-block min-w-[40px] text-center">{reportData.realizedOrders}</span>
            </div>
            <div>
              Liczba zgłoszeń pozostających w realizacji <span className="border-b border-dotted border-black inline-block min-w-[40px] text-center">{reportData.remainingOrders}</span>
            </div>
          </div>
        </div>

        <table className="w-full text-left border-collapse print-table">
          <thead>
            <tr className="bg-gray-50 font-bold">
              <th className="border border-black p-2 w-12 text-center">Nr<br />zgł.</th>
              <th className="border border-black p-2">Nazwa zlecenia</th>
              <th className="border border-black p-2">Produkty</th>
              <th className="border border-black p-2 text-center">System/<br />Moduł</th>
              <th className="border border-black p-2 text-center">Data<br />zlecenia</th>
              <th className="border border-black p-2 text-center">Data<br />przekazania</th>
              <th className="border border-black p-2 text-center w-24">Data odbioru<br />zlecenia</th>
              <th className="border border-black p-2 text-center w-24">Czas realizacji<br />zlecenia</th>
            </tr>
          </thead>
          <tbody>
            {reportData.rows.map((row) => (
              <tr key={`${row.orderNumber}-${row.title}`}>
                <td className="border border-black p-2 text-center whitespace-nowrap">{row.orderNumber}</td>
                <td className="border border-black p-2">{row.title}</td>
                <td className="border border-black p-2 text-xs">{row.products}</td>
                <td className="border border-black p-2 text-center text-xs">{row.systemModule}</td>
                <td className="border border-black p-2 text-center whitespace-nowrap">{row.orderDate}</td>
                <td className="border border-black p-2 text-center whitespace-nowrap">{row.handoverDate}</td>
                <td className="border border-black p-2 text-center whitespace-nowrap">{row.acceptanceDate}</td>
                <td className="border border-black p-2 text-center whitespace-nowrap">{formatOrderHours(row.totalHours)}h</td>
              </tr>
            ))}
            {reportData.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="border border-black p-4 text-center italic text-gray-500">
                  Brak zleceń w wybranym okresie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ReportPmsModal = ({ isOpen, onClose, project, orders }: { isOpen: boolean, onClose: () => void, project: Project, orders: Order[] }) => {
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodFrom, setPeriodFrom] = useState(project?.dateFrom || '');
  const [periodTo, setPeriodTo] = useState(project?.dateTo || '');

  useEffect(() => {
    if (!isOpen) return;
    setPeriodFrom(project?.dateFrom || '');
    setPeriodTo(project?.dateTo || '');
  }, [isOpen, project?.dateFrom, project?.dateTo]);

  if (!isOpen) return null;

  const reportData = buildPmsReportData(orders, project, periodFrom, periodTo, reportDate);

  return (
    <div className="fixed inset-0 z-[100] bg-white text-black overflow-y-auto">
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          body { background: white; }
          .no-print { display: none !important; }
          .print-section { display: block !important; padding: 0 !important; }
          .print-table th, .print-table td { border: 1px solid black !important; padding: 4px !important; font-size: 10px !important; vertical-align: middle !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center z-10">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sporządzono:</label>
            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} onKeyDown={handleDateInputTabNavigation} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white outline-none focus:border-indigo-500" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Okres od:</label>
            <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} onKeyDown={handleDateInputTabNavigation} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white outline-none focus:border-indigo-500" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Do:</label>
            <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} onKeyDown={handleDateInputTabNavigation} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportPmsReportToWord(project, reportData)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition flex items-center gap-2">
            <FileText size={16} /> Export Word
          </button>
          <button onClick={() => exportPmsReportToExcel(project, reportData)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition flex items-center gap-2">
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button onClick={() => window.print()} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm">
            <Printer size={16} /> Export PDF / Drukuj
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            Zamknij
          </button>
        </div>
      </div>

      <div className="print-section max-w-[420mm] mx-auto p-8 bg-white min-h-screen font-serif text-[11px] leading-relaxed text-black">
        <div className="text-right font-bold mb-6">
          Raport PMS
        </div>

        <div className="mb-6 space-y-1">
          <div><strong>Projekt:</strong> {project.code}</div>
          <div><strong>Umowa:</strong> {project.contractNo}</div>
          <div><strong>Data sporządzenia raportu:</strong> {reportDate}</div>
          <div><strong>Raport za okres:</strong> {periodFrom} do {periodTo}</div>
          <div><strong>Liczba zgłoszeń:</strong> {reportData.totalOrders}</div>
          <div><strong>Liczba zgłoszeń zrealizowanych:</strong> {reportData.realizedOrders}</div>
          <div><strong>Liczba zgłoszeń pozostających w realizacji:</strong> {reportData.remainingOrders}</div>
        </div>

        <table className="w-full text-left border-collapse print-table table-fixed">
          <thead>
            <tr className="bg-gray-50 font-bold">
              <th className="border border-black p-2 text-center w-16">Nr zlecenia</th>
              <th className="border border-black p-2 text-center w-24">Od</th>
              <th className="border border-black p-2 text-center w-24">Do</th>
              <th className="border border-black p-2 text-center w-28">Protokół przekazania</th>
              <th className="border border-black p-2 text-center w-24">Protokół odbioru</th>
              <th className="border border-black p-2 text-center w-56">Tytuł zlecenia</th>
              <th className="border border-black p-2 text-center w-28">Produkty zlecenia</th>
              <th className="border border-black p-2 text-center w-20">Liczba godzin zleconych</th>
              <th className="border border-black p-2 text-center w-20">Stawka (netto)</th>
              <th className="border border-black p-2 text-center w-24">Kwota (netto)</th>
              <th className="border border-black p-2 text-center w-20">Łącznie zrealizowano (h)</th>
              <th className="border border-black p-2 text-center w-28">Łącznie kwota (netto)</th>
              <th className="border border-black p-2 text-center w-24">Łącznie brutto</th>
            </tr>
          </thead>
          <tbody>
            {reportData.rows.map((row) => (
              row.lines.map((line, lineIndex) => (
                <tr key={`${row.orderId}-${lineIndex}`}>
                  {lineIndex === 0 && (
                    <>
                      <td rowSpan={row.lines.length} className="border border-black p-2 text-center whitespace-nowrap">{row.orderNumber}</td>
                      <td rowSpan={row.lines.length} className="border border-black p-2 text-center whitespace-nowrap">{row.from}</td>
                      <td rowSpan={row.lines.length} className="border border-black p-2 text-center whitespace-nowrap">{row.to}</td>
                      <td rowSpan={row.lines.length} className="border border-black p-2 text-center whitespace-nowrap">{row.handoverDate}</td>
                      <td rowSpan={row.lines.length} className="border border-black p-2 text-center whitespace-nowrap">{row.acceptanceDate}</td>
                      <td rowSpan={row.lines.length} className="border border-black p-2 align-top">{row.title}</td>
                    </>
                  )}
                  <td className="border border-black p-2">{line.name}</td>
                  <td className="border border-black p-2 text-right whitespace-nowrap">{formatOrderHours(line.hours)}</td>
                  <td className="border border-black p-2 text-right whitespace-nowrap">{project.rateNetto.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł</td>
                  <td className="border border-black p-2 text-right whitespace-nowrap">{line.amountNetto.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł</td>
                  {lineIndex === 0 && (
                    <>
                      <td rowSpan={row.lines.length} className="border border-black p-2 text-right whitespace-nowrap font-bold">{formatOrderHours(row.totalHours)}</td>
                      <td rowSpan={row.lines.length} className="border border-black p-2 text-right whitespace-nowrap font-bold">{row.totalNetto.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł</td>
                      <td rowSpan={row.lines.length} className="border border-black p-2 text-right whitespace-nowrap font-bold">{row.totalBrutto.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł</td>
                    </>
                  )}
                </tr>
              ))
            ))}
            {reportData.rows.length === 0 && (
              <tr>
                <td colSpan={13} className="border border-black p-4 text-center italic text-gray-500">
                  Brak zleceń w wybranym okresie.
                </td>
              </tr>
            )}
            <tr className="font-bold bg-gray-50">
              <td colSpan={10} className="border border-black p-2 text-right">Suma</td>
              <td className="border border-black p-2 text-right whitespace-nowrap">{formatOrderHours(reportData.grandTotalHours)}</td>
              <td className="border border-black p-2 text-right whitespace-nowrap">{reportData.grandTotalNetto.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł</td>
              <td className="border border-black p-2 text-right whitespace-nowrap">{reportData.grandTotalBrutto.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const GoogleAuthSection = ({ clientId, clientSecret }: { clientId: string; clientSecret: string }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authCode, setAuthCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState('');

  const hasCredentials = !!(clientId && clientSecret);

  useEffect(() => {
    if (!hasCredentials) { setIsLoading(false); return; }
    (window as any).electron?.getGoogleAuthStatus?.()
      .then((status: any) => setIsAuthenticated(status?.isAuthenticated || false))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsLoading(false));
  }, [hasCredentials]);

  const handleAuthorize = async () => {
    setAuthError('');
    try {
      const url = await (window as any).electron?.getGoogleAuthUrl?.();
      if (url) {
        await (window as any).electron?.openExternal?.(url);
        setShowCodeInput(true);
      }
    } catch {
      setAuthError('Nie udało się uzyskać URL autoryzacji. Sprawdź Client ID i Secret.');
    }
  };

  const handleSubmitCode = async () => {
    if (!authCode.trim()) return;
    setIsAuthorizing(true);
    setAuthError('');
    try {
      await (window as any).electron?.authorizeGoogle?.(authCode.trim());
      setIsAuthenticated(true);
      setShowCodeInput(false);
      setAuthCode('');
    } catch {
      setAuthError('Nieprawidłowy kod autoryzacji. Spróbuj ponownie.');
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleLogout = async () => {
    await (window as any).electron?.logoutGoogle?.();
    setIsAuthenticated(false);
    setShowCodeInput(false);
    setAuthCode('');
    setAuthError('');
  };

  if (!hasCredentials) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 italic">
        Wypełnij Client ID i Client Secret powyżej, aby połączyć z Google.
      </p>
    );
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 size={14} className="animate-spin" /> Sprawdzanie statusu...</div>;
  }

  return (
    <div className="space-y-3">
      {isAuthenticated ? (
        <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
            <CheckCircle size={16} />
            Połączono z Google ✓
          </div>
          <button type="button" onClick={handleLogout} className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition">
            Wyloguj
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
              <AlertCircle size={16} />
              Nie połączono z Google
            </div>
            {!showCodeInput && (
              <button type="button" onClick={handleAuthorize}
                className="text-xs font-medium px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition text-gray-700 dark:text-gray-200">
                Autoryzuj z Google
              </button>
            )}
          </div>

          {showCodeInput && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                Skopiuj kod z przeglądarki i wklej tutaj:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={authCode}
                  onChange={e => setAuthCode(e.target.value)}
                  placeholder="4/0AX..."
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono"
                  onKeyDown={e => e.key === 'Enter' && handleSubmitCode()}
                />
                <button type="button" onClick={handleSubmitCode} disabled={isAuthorizing || !authCode.trim()}
                  className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-1.5 shrink-0">
                  {isAuthorizing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Zatwierdź
                </button>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={handleAuthorize} className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition">
                  Otwórz przeglądarkę ponownie
                </button>
                <button type="button" onClick={() => setShowCodeInput(false)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                  Anuluj
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {authError && (
        <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
          <AlertCircle size={12} /> {authError}
        </p>
      )}
    </div>
  );
};

const ExecutiveSettlementReportModal = ({
  isOpen,
  onClose,
  project,
  orders,
  workItems,
  isFinancialDataVisible,
  onToggleFinancialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  orders: Order[];
  workItems: ReturnType<typeof useWorkRegistry>['workItems'];
  isFinancialDataVisible: boolean;
  onToggleFinancialData: () => void;
}) => {
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isPdfPasswordModalOpen, setIsPdfPasswordModalOpen] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [pdfPasswordConfirmation, setPdfPasswordConfirmation] = useState('');
  const [pdfPasswordError, setPdfPasswordError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setReportDate(format(new Date(), 'yyyy-MM-dd'));
  }, [isOpen]);

  if (!isOpen) return null;

  const reportData = buildExecutiveSettlementReportData({
    project,
    orders,
    workItems,
    reportDate,
  });

  const toneClasses: Record<string, string> = {
    positive: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    risk: 'border-red-200 bg-red-50 text-red-900',
    neutral: 'border-slate-200 bg-slate-50 text-slate-900',
  };
  const teamChartPalette = ['#2563eb', '#4f46e5', '#0891b2', '#7c3aed', '#0f766e', '#ea580c', '#db2777', '#64748b'];
  const pdfTeamChartData = reportData.topContributors.map((contributor, index) => ({
    name: contributor.name,
    value: contributor.hours,
    fill: teamChartPalette[index % teamChartPalette.length],
  }));

  const renderPdfBars = (
    data: { name: string; value: number; fill: string }[],
    formatValue: (value: number) => string,
    options?: { compact?: boolean },
  ) => {
    const maxValue = Math.max(1, ...data.map((item) => item.value));

    return (
      <div className={options?.compact ? 'space-y-3' : 'space-y-4'}>
        {data.map((item) => (
          <div key={item.name} className="grid grid-cols-[180px_minmax(0,1fr)_72px] items-center gap-4">
            <p className="text-xs font-semibold leading-5 text-slate-600">{item.name}</p>
            <div className="h-4 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(3, (item.value / maxValue) * 100)}%`, backgroundColor: item.fill }}
              />
            </div>
            <p className="text-right text-xs font-bold text-slate-500">{formatValue(item.value)}</p>
          </div>
        ))}
      </div>
    );
  };

  const closePdfPasswordModal = () => {
    if (isExportingPdf) return;
    setIsPdfPasswordModalOpen(false);
    setPdfPassword('');
    setPdfPasswordConfirmation('');
    setPdfPasswordError('');
  };

  const performPdfExport = async (password?: string) => {
    if (!window.electron?.exportPdf) {
      alert('Eksport PDF nie jest dostępny w tej wersji aplikacji.');
      return;
    }

    setIsExportingPdf(true);
    try {
      document.body.classList.add('pdf-export-active');
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      });
      await new Promise((resolve) => window.setTimeout(resolve, 80));

      const result = await window.electron.exportPdf({
        defaultFileName: `raport-zarzadczy-${project.code}-${reportDate}.pdf`,
        password,
      });

      if (result.canceled || !result.success) {
        return;
      }

      alert(`Raport został zapisany do pliku PDF.\nPlik: ${result.filePath || 'raport.pdf'}`);
    } catch (error: any) {
      alert(`Nie udało się zapisać raportu PDF.\n${error?.message || 'Nieznany błąd.'}`);
    } finally {
      document.body.classList.remove('pdf-export-active');
      setIsExportingPdf(false);
    }
  };

  const handleProtectedPdfExport = async () => {
    if (!pdfPassword) {
      setPdfPasswordError('Podaj hasło do otwarcia pliku PDF.');
      return;
    }

    if (pdfPassword !== pdfPasswordConfirmation) {
      setPdfPasswordError('Hasła nie są zgodne.');
      return;
    }

    setPdfPasswordError('');
    setIsPdfPasswordModalOpen(false);
    const password = pdfPassword;
    setPdfPassword('');
    setPdfPasswordConfirmation('');
    await performPdfExport(password);
  };

  const handlePdfExport = async () => {
    if (isFinancialDataVisible) {
      setPdfPassword('');
      setPdfPasswordConfirmation('');
      setPdfPasswordError('');
      setIsPdfPasswordModalOpen(true);
      return;
    }

    await performPdfExport();
  };

  const handleWordExport = async () => {
    setIsExportingWord(true);
    try {
      await exportExecutiveSettlementReportToWord(project, reportData, {
        includeFinancialData: isFinancialDataVisible,
      });
    } catch (error: any) {
      alert(`Nie udało się zapisać raportu Word.\n${error?.message || 'Nieznany błąd.'}`);
    } finally {
      setIsExportingWord(false);
    }
  };

  const handleExcelExport = async () => {
    setIsExportingExcel(true);
    try {
      exportExecutiveSettlementReportToExcel(project, reportData, {
        includeFinancialData: isFinancialDataVisible,
      });
    } catch (error: any) {
      alert(`Nie udało się zapisać raportu Excel.\n${error?.message || 'Nieznany błąd.'}`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="report-root fixed inset-0 z-[110] overflow-y-auto bg-slate-100/95 text-slate-900 backdrop-blur-sm">
      <style>{`
        body.pdf-export-active {
          background: white !important;
          overflow: visible !important;
        }
        body.pdf-export-active * {
          visibility: hidden !important;
        }
        body.pdf-export-active .report-root,
        body.pdf-export-active .report-root * {
          visibility: visible !important;
        }
        body.pdf-export-active .report-root {
          position: absolute !important;
          inset: 0 !important;
          z-index: 99999 !important;
          overflow: visible !important;
          height: auto !important;
          background: white !important;
          backdrop-filter: none !important;
        }
        body.pdf-export-active .no-print {
          display: none !important;
        }
        body.pdf-export-active .report-shell {
          max-width: 980px !important;
          margin: 0 auto !important;
          padding: 20px !important;
        }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body {
            background: white !important;
            overflow: visible !important;
            height: auto !important;
          }
          .no-print { display: none !important; }
          .report-root {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            height: auto !important;
            background: white !important;
            backdrop-filter: none !important;
          }
          .report-shell {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            space-y: 0 !important;
          }
          .report-page {
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 0 8mm 0 !important;
            break-after: auto !important;
            page-break-after: auto !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }
          .report-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-chart text {
            fill: #475569 !important;
            font-size: 11px !important;
          }
          .print-chart {
            height: 190px !important;
          }
        }
      `}</style>

      {isPdfPasswordModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Zabezpieczenie PDF</p>
            <h3 className="mt-2 text-xl font-black text-slate-900">Ustaw hasło do otwarcia pliku</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Eksport zawiera widoczne kwoty. Podaj hasło, które będzie wymagane przy otwieraniu tego pliku PDF.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Hasło PDF</label>
                <input
                  type="password"
                  value={pdfPassword}
                  onChange={(event) => {
                    setPdfPassword(event.target.value);
                    if (pdfPasswordError) setPdfPasswordError('');
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Wpisz hasło do pliku PDF"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Potwierdź hasło</label>
                <input
                  type="password"
                  value={pdfPasswordConfirmation}
                  onChange={(event) => {
                    setPdfPasswordConfirmation(event.target.value);
                    if (pdfPasswordError) setPdfPasswordError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void handleProtectedPdfExport();
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Powtórz hasło"
                />
              </div>
            </div>

            {pdfPasswordError ? (
              <p className="mt-3 text-sm font-medium text-red-600">{pdfPasswordError}</p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closePdfPasswordModal}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={() => void handleProtectedPdfExport()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Zapisz zabezpieczony PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Raport zarządczy</p>
            <h3 className="mt-1 text-lg font-black text-slate-900">{project.code} - rozliczenia, wykresy i komentarz zarządczy</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Sporządzono:
              <input
                type="date"
                value={reportDate}
                onChange={(event) => setReportDate(event.target.value)}
                onKeyDown={handleDateInputTabNavigation}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
              />
            </label>
            <button
              onClick={onToggleFinancialData}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold shadow-sm transition ${
                isFinancialDataVisible
                  ? 'border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
              title={isFinancialDataVisible ? 'Ukryj kwoty' : 'Pokaż kwoty'}
            >
              <DollarSign size={16} />
            </button>
            <button
              onClick={() => void handleExcelExport()}
              disabled={isExportingExcel}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <FileSpreadsheet size={16} />
              {isExportingExcel ? 'Zapisywanie Excel...' : 'Export Excel'}
            </button>
            <button
              onClick={() => void handleWordExport()}
              disabled={isExportingWord}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <FileText size={16} />
              {isExportingWord ? 'Zapisywanie Word...' : 'Export Word'}
            </button>
            <button
              onClick={() => void handlePdfExport()}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              <Printer size={16} />
              {isExportingPdf ? 'Zapisywanie PDF...' : 'Export PDF'}
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Zamknij
            </button>
          </div>
        </div>
      </div>

      <div className="report-shell mx-auto max-w-[980px] space-y-6 p-5">
        <section className="report-page overflow-hidden rounded-[28px] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.14)]">
          <div className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(135deg,_#0f172a_0%,_#1e293b_48%,_#0f766e_100%)] px-8 py-8 text-white">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="absolute bottom-0 right-20 h-32 w-32 rounded-full bg-cyan-300/10 blur-2xl" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
                  <FileSpreadsheet size={14} />
                  Raport dla zarządu
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight">{project.name}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
                  Raport pokazuje bieżący stan kontraktu, formalne rozliczenia zleceń, rzeczywiste roboczogodziny z YouTrack oraz syntetyczny komentarz o tym, co aktualnie dzieje się w projekcie.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-slate-100 md:min-w-[400px]">
                <div className="min-w-0 rounded-2xl border border-white/15 bg-white/10 px-5 py-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">Kod projektu</p>
                  <p className="mt-3 break-words text-[1.9rem] font-black leading-none">{project.code}</p>
                </div>
                <div className="min-w-0 rounded-2xl border border-white/15 bg-white/10 px-5 py-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">Umowa</p>
                  <p className="mt-3 break-words text-[1.9rem] font-black leading-none">{project.contractNo || 'brak'}</p>
                </div>
                <div className="min-w-0 rounded-2xl border border-white/15 bg-white/10 px-5 py-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">Okres projektu</p>
                  <p className="mt-3 break-words text-base font-semibold leading-6">{reportData.projectPeriodLabel}</p>
                </div>
                <div className="min-w-0 rounded-2xl border border-white/15 bg-white/10 px-5 py-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">Stan na dzień</p>
                  <p className="mt-3 break-words text-base font-semibold leading-6">{reportDate}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8 px-8 py-8">
            <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,_#f8fafc_0%,_#eef2ff_55%,_#ecfeff_100%)] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-4xl">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Podsumowanie zarządcze</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-900">
                    {reportData.remainingInContract >= 0 ? 'Projekt pozostaje w granicach umowy' : 'Projekt wymaga korekty limitu lub aneksu'}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{reportData.summaryText}</p>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Wykorzystanie umowy</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-4xl font-black text-slate-900">{reportData.contractUsagePct.toFixed(1)}%</span>
                    <span className="pb-1 text-sm font-semibold text-slate-400">limitu</span>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${reportData.contractUsagePct > 100 ? 'bg-red-500' : reportData.contractUsagePct > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Math.max(0, reportData.contractUsagePct))}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-slate-500">
                    {formatOrderHours(reportData.contractedTotalHours)} h z {formatOrderHours(project.maxHours)} h
                  </p>
                  <p className={`mt-2 text-sm font-bold ${reportData.remainingInContract >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {reportData.remainingInContract >= 0 ? 'Pozostało' : 'Przekroczenie'}: {formatOrderHours(Math.abs(reportData.remainingInContract))} h
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {reportData.metrics.map((metric) => (
                <div key={metric.label} className="avoid-break rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{metric.label}</p>
                  <div className="mt-3 flex min-w-0 items-baseline gap-1" style={{ color: metric.accent }}>
                    <span className="min-w-0 break-words text-[2rem] font-black leading-none sm:text-3xl">{formatOrderHours(metric.hours)}</span>
                    <span className="shrink-0 text-sm font-semibold text-slate-400">h</span>
                  </div>
                  {isFinancialDataVisible && (
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Netto</p>
                        <p className="mt-1 text-[0.92rem] font-bold leading-5 text-slate-900">
                          <span className="whitespace-nowrap">{formatCurrencyValue(metric.netValue)} zł</span>
                        </p>
                      </div>
                      <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Brutto</p>
                        <p className="mt-1 text-[0.92rem] font-bold leading-5 text-slate-900">
                          <span className="whitespace-nowrap">{formatCurrencyValue(metric.grossValue)} zł</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {reportData.highlights.map((highlight) => (
                <div key={highlight.title} className={`avoid-break rounded-[24px] border p-5 ${toneClasses[highlight.tone]}`}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] opacity-70">Komentarz</p>
                  <h3 className="mt-2 text-lg font-black">{highlight.title}</h3>
                  <p className="mt-3 text-sm leading-7">{isFinancialDataVisible ? highlight.body : removeFinancialSentences(highlight.body)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="report-page overflow-hidden rounded-[28px] bg-white px-8 py-8 shadow-[0_18px_55px_rgba(15,23,42,0.14)]">
          <div className="border-b border-slate-200 pb-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Strona analityczna</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Godziny, rozliczenia i status projektu</h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
              Ta strona pokazuje przekrój wykonanych i rozliczonych godzin, bieżący status formalny zleceń oraz strukturę pracy widoczną w danych projektowych.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {reportData.statusCards.map((statusCard) => (
                <div key={statusCard.label} className="min-w-0 rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-5 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-[10px] font-bold uppercase leading-4 tracking-[0.12em] text-slate-400">{statusCard.label}</p>
                      <p className="mt-3 text-4xl font-black leading-none text-slate-900">{statusCard.count}</p>
                    </div>
                    <div className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: statusCard.fill }} />
                  </div>
                  <p className="mt-3 break-words text-base font-bold leading-5" style={{ color: statusCard.fill }}>{formatOrderHours(statusCard.hours)} h</p>
                  <p className="mt-2 break-words text-xs leading-5 text-slate-500">{statusCard.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5">
            <div className="avoid-break rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Wykres godzin</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">Kontrakt, rozliczenia i praca zespołu</h3>
              </div>
              <div className="print-chart h-[260px]">
                {isExportingPdf ? (
                  renderPdfBars(reportData.hoursChartData, (value) => `${formatOrderHours(value)} h`)
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.hoursChartData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.45} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} interval={0} angle={-18} textAnchor="end" height={52} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip formatter={(value: number | string | undefined) => [`${formatOrderHours(Number(value || 0))} h`, 'Godziny']} />
                      <Bar dataKey="value" radius={[12, 12, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                        {reportData.hoursChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="avoid-break rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Wykres wartości</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">Wartość kontraktu i bieżącej zyskowności</h3>
              </div>
              {isFinancialDataVisible ? (
                <div className="print-chart h-[260px]">
                  {isExportingPdf ? (
                    renderPdfBars(reportData.valuesChartData, (value) => `${formatCurrencyValue(value)} zł`)
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.valuesChartData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.45} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} interval={0} angle={-18} textAnchor="end" height={52} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                        <Tooltip formatter={(value: number | string | undefined) => [`${formatCurrencyValue(Number(value || 0))} zł`, 'Netto']} />
                        <Bar dataKey="value" radius={[12, 12, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                          {reportData.valuesChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              ) : (
                <div className="flex h-[260px] items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-8 text-center text-sm leading-7 text-slate-500">
                  Dane kwotowe są ukryte. Kliknij ikonę dolara w nagłówku raportu, aby odsłonić wartości netto i wykres finansowy.
                </div>
              )}
            </div>

            <div className="avoid-break rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Status zleceń</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">Godziny według etapu formalnego</h3>
              </div>
              <div className="print-chart h-[240px]">
                {isExportingPdf ? (
                  renderPdfBars(reportData.statusChartData, (value) => `${formatOrderHours(value)} h`, { compact: true })
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.statusChartData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.45} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} interval={0} angle={-12} textAnchor="end" height={46} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip formatter={(value: number | string | undefined) => [`${formatOrderHours(Number(value || 0))} h`, 'Godziny']} />
                      <Bar dataKey="value" radius={[12, 12, 0, 0]} maxBarSize={60} isAnimationActive={false}>
                        {reportData.statusChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="avoid-break rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Kategorie pracy</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">Struktura godzin z YouTrack</h3>
              </div>
              <div className="print-chart h-[240px]">
                {isExportingPdf ? (
                  renderPdfBars(reportData.categoryChartData, (value) => `${formatOrderHours(value)} h`, { compact: true })
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.categoryChartData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.45} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} interval={0} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip formatter={(value: number | string | undefined) => [`${formatOrderHours(Number(value || 0))} h`, 'Godziny']} />
                      <Bar dataKey="value" radius={[12, 12, 0, 0]} maxBarSize={70} isAnimationActive={false}>
                        {reportData.categoryChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="report-page overflow-hidden rounded-[28px] bg-white px-8 py-8 shadow-[0_18px_55px_rgba(15,23,42,0.14)]">
          <div className="border-b border-slate-200 pb-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Strona operacyjna</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Co realnie dzieje się w projekcie</h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
              Ta strona pokazuje rozkład pracy zespołu oraz osoby, które faktycznie logowały roboczogodziny w projekcie.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5">
            <div className="avoid-break rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Zespół projektowy</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">Najwięcej zalogowanych godzin</h3>
              </div>
              <div className={isExportingPdf ? 'space-y-4' : 'print-chart h-[280px]'}>
                {(isExportingPdf ? pdfTeamChartData : reportData.teamChartData).length > 0 ? (
                  isExportingPdf ? (
                    renderPdfBars(pdfTeamChartData, (value) => `${formatOrderHours(value)} h`)
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.teamChartData} layout="vertical" margin={{ top: 10, right: 20, left: 48, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" opacity={0.45} />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(value) => `${Number(value).toFixed(0)}h`} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={148} tickMargin={10} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                        <Tooltip formatter={(value: number | string | undefined) => [`${formatOrderHours(Number(value || 0))} h`, 'Godziny']} />
                        <Bar dataKey="value" radius={[0, 12, 12, 0]} maxBarSize={28} isAnimationActive={false}>
                          {reportData.teamChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )
                ) : (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm leading-6 text-slate-500">
                    Brak zalogowanych godzin w YouTrack. Po synchronizacji rejestru pracy raport pokaże realne obciążenie zespołu.
                  </div>
                )}
              </div>
            </div>

            <div className="avoid-break rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Osoby i udziały</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">Lista roboczogodzin zespołu</h3>
              </div>
              <div className="space-y-3">
                {reportData.topContributors.length > 0 ? reportData.topContributors.map((contributor) => (
                  <div key={contributor.name} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{contributor.name}</p>
                      <p className="text-lg font-black text-slate-900">{formatOrderHours(contributor.hours)} h</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: `${Math.min(100, Math.max(0, contributor.sharePct))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Udział w całkowitej pracy: {contributor.sharePct.toFixed(1)}%
                    </p>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-500">
                    Brak danych o osobach pracujących w projekcie.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const SettingsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { settings } = useProjectContext();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SettingsIcon size={20} className="text-indigo-500" />
            Ustawienia Główne
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Google Cloud (Docs API)</h3>
              <div className="space-y-4">
                <GoogleAuthSection clientId={settings?.googleClientId || ''} clientSecret={settings?.googleClientSecret || ''} />
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition flex items-center justify-center min-w-[120px]"
            >
              Zamknij
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ProjectProvider>
      <MainLayout />
    </ProjectProvider>
  );
}

const MainLayout = () => {
  const { isDark, toggleDark } = useDarkMode();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'daily'>('dashboard');
  const [isDatabaseTransferPending, setIsDatabaseTransferPending] = useState(false);

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
        isDark={isDark} 
        toggleDark={toggleDark} 
        onOpenModal={handleOpenModal} 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onExportDatabase={handleExportDatabase}
        onImportDatabase={handleImportDatabase}
        isDatabaseTransferPending={isDatabaseTransferPending}
        currentView={currentView}
        onViewChange={setCurrentView}
      />
      
      <main className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-950 transition-colors overflow-hidden flex flex-col h-screen">
        {currentView === 'daily' ? (
          <DailyMain />
        ) : (
          <DashboardView onEdit={handleEditProject} />
        )}
      </main>

      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectToEdit={editingProject}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
