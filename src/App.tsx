import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';

import type { 
  Project, Order, Settings, Stakeholder, TaskType, 
  DailyHub, DailySection, DailyComment,
  Estimation, EstimationItem, MeetingNoteData, OrderItem, EmailTemplate, StatusReport, ProjectLink, MaintenanceEntry, OrderProtocolEmailTemplateData, OrderAcceptanceEmailTemplateData, MaintenanceSettlementEmailTemplateData, OrderProtocolFlow, ScheduledTask, GlobalScheduleType
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
      getIssueMaintenanceFlags: () => Promise<Record<string, boolean>>;
      setIssueMaintenanceFlag: (data: { issueId: string, isMaintenance: boolean }) => Promise<{ success: boolean }>;
      importOrders: (data: { orders: any[], projectId: string }) => Promise<{ success: boolean }>;
      getEstimation: (projectId: string) => Promise<any>;
      saveEstimation: (data: { projectId: string, data: any }) => Promise<{ success: boolean }>;
      getMeetingNotes: (projectId: string) => Promise<any>;
      saveMeetingNotes: (data: { projectId: string, data: any }) => Promise<{ success: boolean }>;
      getOrderProtocolEmailTemplate: (projectId: string) => Promise<OrderProtocolEmailTemplateData | null>;
      saveOrderProtocolEmailTemplate: (data: { projectId: string, data: OrderProtocolEmailTemplateData }) => Promise<{ success: boolean }>;
      getOrderAcceptanceEmailTemplate: (projectId: string) => Promise<OrderAcceptanceEmailTemplateData | null>;
      saveOrderAcceptanceEmailTemplate: (data: { projectId: string, data: OrderAcceptanceEmailTemplateData }) => Promise<{ success: boolean }>;
      getMaintenanceSettlementEmailTemplate: (projectId: string) => Promise<MaintenanceSettlementEmailTemplateData | null>;
      saveMaintenanceSettlementEmailTemplate: (data: { projectId: string, data: MaintenanceSettlementEmailTemplateData }) => Promise<{ success: boolean }>;
      getScheduledTasks: () => Promise<ScheduledTask[]>;
      saveScheduledTask: (data: ScheduledTask) => Promise<{ success: boolean }>;
      deleteScheduledTask: (id: string) => Promise<{ success: boolean }>;
      runScheduledTaskNow: (id: string) => Promise<{ success: boolean; task: ScheduledTask }>;
      getProjectLinks: (projectId: string) => Promise<ProjectLink[]>;
      saveProjectLink: (data: ProjectLink) => Promise<{ success: boolean }>;
      deleteProjectLink: (id: string) => Promise<{ success: boolean }>;
      getStatusReports: (projectId: string) => Promise<StatusReport[]>;
      saveStatusReport: (data: { projectId: string, data: StatusReport }) => Promise<{ success: boolean }>;
      deleteStatusReport: (id: string) => Promise<{ success: boolean }>;
      getMaintenanceEntries: (projectId: string) => Promise<MaintenanceEntry[]>;
      saveMaintenanceEntry: (data: MaintenanceEntry) => Promise<{ success: boolean }>;
      deleteMaintenanceEntry: (id: string) => Promise<{ success: boolean }>;
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
  Cell, CartesianGrid, ComposedChart, Line, Area, Legend, ReferenceArea, ReferenceLine
} from 'recharts';
import { 
  LayoutDashboard, Plus, Briefcase,
  Clock, AlertTriangle,
  ChevronDown, Edit2, X, Moon, Sun, Loader2, BarChart as BarChartIcon, Info, FileText, Printer,
  FileSpreadsheet, Activity, DollarSign, Settings as SettingsIcon,
  CheckCircle, AlertCircle, Code, Lock, LockOpen, Mail, Copy, Send
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
import { FileUp, FileDown, ExternalLink, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
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

const DEFAULT_MAINTENANCE_VAT_RATE = 23;

const roundCurrency = (value: number) => Number((value || 0).toFixed(2));

const calculateGrossFromNet = (net: number, vatRate: number) =>
  roundCurrency((net || 0) * (1 + (vatRate || 0) / 100));

const calculateNetFromGross = (gross: number, vatRate: number) => {
  const divisor = 1 + (vatRate || 0) / 100;
  if (divisor <= 0) {
    return roundCurrency(gross || 0);
  }

  return roundCurrency((gross || 0) / divisor);
};

const createClientId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

const getCurrentMonthValue = () => format(new Date(), 'yyyy-MM');

const formatMaintenanceMonth = (value: string) => {
  if (!value) return 'Brak miesiąca';
  const [year, month] = value.split('-');
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  if (!parsedYear || !parsedMonth) return value;
  return new Date(parsedYear, parsedMonth - 1, 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
};

const createMaintenanceDraft = (project: Project): MaintenanceEntry => {
  const now = new Date().toISOString();
  return {
    id: createClientId(),
    projectId: project.id,
    month: getCurrentMonthValue(),
    netAmount: project.maintenanceNetAmount || 0,
    vatRate: project.maintenanceVatRate || DEFAULT_MAINTENANCE_VAT_RATE,
    grossAmount: project.maintenanceGrossAmount || 0,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
};

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
    hasMaintenance: false, maintenanceNetAmount: 0, maintenanceVatRate: DEFAULT_MAINTENANCE_VAT_RATE, maintenanceGrossAmount: 0,
    taskTypes: [],
    googleDocLink: '',
    stakeholders: []
  });
  const [isMaintenanceGrossLocked, setIsMaintenanceGrossLocked] = useState(true);
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
        hasMaintenance: projectToEdit.hasMaintenance ?? false,
        maintenanceNetAmount: projectToEdit.maintenanceNetAmount ?? 0,
        maintenanceVatRate: projectToEdit.maintenanceVatRate ?? DEFAULT_MAINTENANCE_VAT_RATE,
        maintenanceGrossAmount: projectToEdit.maintenanceGrossAmount ?? calculateGrossFromNet(projectToEdit.maintenanceNetAmount ?? 0, projectToEdit.maintenanceVatRate ?? DEFAULT_MAINTENANCE_VAT_RATE),
        targetProfitPct: projectToEdit.targetProfitPct !== undefined ? projectToEdit.targetProfitPct : 20,
        taskTypes: projectToEdit.taskTypes || [],
        googleDocLink: projectToEdit.googleDocLink || '',
        stakeholders: projectToEdit.stakeholders || []
      });
      setIsMaintenanceGrossLocked(true);
      setTaskTypes(projectToEdit.taskTypes || []);
      setStakeholders(projectToEdit.stakeholders || []);
    } else {
      setFormData({
        code: '', name: '', contractNo: '', contractSubject: '',
        dateFrom: '', dateTo: '',
        minHours: 0, maxHours: 0, rateNetto: 0, rateBrutto: 0, vatRate: 23, targetProfitPct: 20,
        hasMaintenance: false, maintenanceNetAmount: 0, maintenanceVatRate: DEFAULT_MAINTENANCE_VAT_RATE, maintenanceGrossAmount: 0,
        taskTypes: [],
        googleDocLink: '',
        stakeholders: []
      });
      setIsMaintenanceGrossLocked(true);
      setTaskTypes([]);
      setStakeholders([]);
    }
  }, [projectToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    let newValue: any = value;

    if (type === 'number') {
      newValue = parseFloat(value) || 0;
    }

    if (name === 'hasMaintenance' && !checked) {
      setIsMaintenanceGrossLocked(true);
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

      if (name === 'hasMaintenance') {
        const hasMaintenance = checked;
        updated.hasMaintenance = hasMaintenance;
        if (!hasMaintenance) {
          updated.maintenanceNetAmount = 0;
          updated.maintenanceVatRate = DEFAULT_MAINTENANCE_VAT_RATE;
          updated.maintenanceGrossAmount = 0;
        } else {
          updated.maintenanceVatRate = prev.maintenanceVatRate || DEFAULT_MAINTENANCE_VAT_RATE;
          updated.maintenanceGrossAmount = calculateGrossFromNet(
            updated.maintenanceNetAmount,
            updated.maintenanceVatRate,
          );
        }
      }

      if (name === 'maintenanceVatRate') {
        updated.maintenanceVatRate = newValue;
        if (isMaintenanceGrossLocked) {
          updated.maintenanceGrossAmount = calculateGrossFromNet(updated.maintenanceNetAmount, newValue);
        } else {
          updated.maintenanceNetAmount = calculateNetFromGross(updated.maintenanceGrossAmount, newValue);
        }
      } else if (name === 'maintenanceNetAmount') {
        updated.maintenanceNetAmount = newValue;
        if (isMaintenanceGrossLocked) {
          updated.maintenanceGrossAmount = calculateGrossFromNet(newValue, updated.maintenanceVatRate);
        }
      } else if (name === 'maintenanceGrossAmount') {
        updated.maintenanceGrossAmount = newValue;
        if (!isMaintenanceGrossLocked) {
          updated.maintenanceNetAmount = calculateNetFromGross(newValue, updated.maintenanceVatRate);
        }
      }

      return updated;
    });
  };

  const handleMaintenanceLockToggle = () => {
    setIsMaintenanceGrossLocked(prev => {
      const next = !prev;
      setFormData(current => {
        if (!current.hasMaintenance) {
          return current;
        }

        if (next) {
          return {
            ...current,
            maintenanceGrossAmount: calculateGrossFromNet(
              current.maintenanceNetAmount,
              current.maintenanceVatRate,
            ),
          };
        }

        return {
          ...current,
          maintenanceNetAmount: calculateNetFromGross(
            current.maintenanceGrossAmount,
            current.maintenanceVatRate,
          ),
        };
      });
      return next;
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

            <div className="mb-8">
              <h3 className="text-md font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">Utrzymanie i Abonamenty</h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
                  <input
                    type="checkbox"
                    name="hasMaintenance"
                    checked={formData.hasMaintenance}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">Opłata za utrzymanie</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">Włączenie odblokowuje konfigurację miesięcznej opłaty abonamentowej.</span>
                  </div>
                </label>

                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 transition-opacity ${formData.hasMaintenance ? 'opacity-100' : 'opacity-60'}`}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kwota Netto (PLN)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="maintenanceNetAmount"
                      value={formData.maintenanceNetAmount}
                      onChange={handleChange}
                      disabled={!formData.hasMaintenance || !isMaintenanceGrossLocked}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stawka VAT (%)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="maintenanceVatRate"
                      value={formData.maintenanceVatRate}
                      onChange={handleChange}
                      disabled={!formData.hasMaintenance}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kwota Brutto (PLN)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        name="maintenanceGrossAmount"
                        value={formData.maintenanceGrossAmount}
                        onChange={handleChange}
                        disabled={!formData.hasMaintenance || isMaintenanceGrossLocked}
                        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800"
                      />
                      <button
                        type="button"
                        onClick={handleMaintenanceLockToggle}
                        disabled={!formData.hasMaintenance}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-gray-600 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-800"
                        title={isMaintenanceGrossLocked ? 'Brutto liczone automatycznie z netto' : 'Netto liczone od stałej kwoty brutto'}
                        aria-label={isMaintenanceGrossLocked ? 'Brutto liczone automatycznie z netto' : 'Netto liczone od stałej kwoty brutto'}
                      >
                        {isMaintenanceGrossLocked ? <Lock size={16} /> : <LockOpen size={16} />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {isMaintenanceGrossLocked
                        ? 'Tryb automatyczny: zmiana netto lub VAT przelicza brutto.'
                        : 'Tryb ryczałtowy: stałe brutto przelicza netto po zmianie VAT.'}
                    </p>
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
  const [maintenanceEntries, setMaintenanceEntries] = useState<MaintenanceEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'work' | 'settlements' | 'maintenance' | 'status' | 'youtrack' | 'estimation' | 'notes' | '__status_placeholder__'>('dashboard');
  const [isExecutiveSettlementReportOpen, setIsExecutiveSettlementReportOpen] = useState(false);
  const [isFinancialDataVisible, setIsFinancialDataVisible] = useState(false);
  const [burnUpRangeMode, setBurnUpRangeMode] = useState<'halfYear' | 'full' | 'custom'>('halfYear');
  const [burnUpVisibleRange, setBurnUpVisibleRange] = useState<{ start: string; end: string } | null>(null);
  const [burnUpSelectionStart, setBurnUpSelectionStart] = useState<string | null>(null);
  const [burnUpSelectionEnd, setBurnUpSelectionEnd] = useState<string | null>(null);
  const [collapsedSettlementSections, setCollapsedSettlementSections] = useState<Record<string, boolean>>({});
  const { orders } = useOrders(selectedProject?.id);

  useEffect(() => {
    if (typeof window === 'undefined' || !selectedProject) return;

    const storedTab = sessionStorage.getItem(`pcc_dashboard_active_tab:${selectedProject.id}`);
    if (!storedTab) {
      setActiveTab('dashboard');
      return;
    }

    const allowedTabs = ['dashboard', 'orders', 'work', 'settlements', 'maintenance', 'status', 'youtrack', 'estimation', 'notes'];
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

  useEffect(() => {
    let isMounted = true;

    const loadMaintenanceEntries = async () => {
      if (!selectedProject?.hasMaintenance || typeof window === 'undefined' || !window.electron || typeof window.electron.getMaintenanceEntries !== 'function') {
        if (isMounted) {
          setMaintenanceEntries([]);
        }
        return;
      }

      try {
        const result = await window.electron.getMaintenanceEntries(selectedProject.id);
        if (isMounted) {
          setMaintenanceEntries(result);
        }
      } catch {
        if (isMounted) {
          setMaintenanceEntries([]);
        }
      }
    };

    void loadMaintenanceEntries();

    return () => {
      isMounted = false;
    };
  }, [selectedProject?.id, selectedProject?.hasMaintenance]);

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

  const nonMaintenanceWorkItems = workItems.filter((item) => !item.isMaintenance);
  const maintenanceWorkItems = workItems.filter((item) => item.isMaintenance);

  // Calculate YouTrack hours by category for order work only
  const youtrackHours: Record<string, number> = {
    'Programistyczne': 0,
    'Obsługa projektu': 0,
    'Inne': 0
  };
  const maintenanceHoursByCategory: Record<string, number> = {
    'Programistyczne': 0,
    'Obsługa projektu': 0,
    'Inne': 0
  };
  
  nonMaintenanceWorkItems.forEach(item => {
    const cat = item.category || 'Inne';
    if (youtrackHours[cat] !== undefined) {
      youtrackHours[cat] += (item.minutes || 0) / 60;
    } else {
      youtrackHours[cat] = (item.minutes || 0) / 60;
    }
  });

  maintenanceWorkItems.forEach(item => {
    const cat = item.category || 'Inne';
    if (maintenanceHoursByCategory[cat] !== undefined) {
      maintenanceHoursByCategory[cat] += (item.minutes || 0) / 60;
    } else {
      maintenanceHoursByCategory[cat] = (item.minutes || 0) / 60;
    }
  });

  const youtrackTotal = youtrackHours['Programistyczne'] + youtrackHours['Obsługa projektu'] + youtrackHours['Inne'];
  const maintenanceWorkedHours = maintenanceWorkItems.reduce((sum, item) => sum + (item.minutes || 0) / 60, 0);
  const totalProjectHoursByCategory: Record<string, number> = {
    'Programistyczne': youtrackHours['Programistyczne'] + maintenanceHoursByCategory['Programistyczne'],
    'Obsługa projektu': youtrackHours['Obsługa projektu'] + maintenanceHoursByCategory['Obsługa projektu'],
    'Inne': youtrackHours['Inne'] + maintenanceHoursByCategory['Inne'],
  };
  const maintenanceContractNetValue = maintenanceEntries.reduce((sum, entry) => sum + (entry.netAmount || 0), 0);
  const maintenanceAvailableHours = selectedProject.rateNetto > 0
    ? maintenanceContractNetValue / selectedProject.rateNetto
    : 0;
  const totalProjectAvailableHours = totalHoursUsed + maintenanceAvailableHours;
  const totalProjectWorkedHours = youtrackTotal + maintenanceWorkedHours;
  const maxScale = Math.max(
    selectedProject.maxHours || 1,
    totalHoursUsed,
    youtrackTotal,
    maintenanceAvailableHours,
    maintenanceWorkedHours,
    totalProjectAvailableHours,
    totalProjectWorkedHours,
  );
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
  const maintenanceDifferenceHours = maintenanceAvailableHours - maintenanceWorkedHours;
  const totalProjectDifferenceHours = totalProjectAvailableHours - totalProjectWorkedHours;
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
  const maintenanceProgPct = maintenanceWorkedHours > 0 ? (maintenanceHoursByCategory['Programistyczne'] / maintenanceWorkedHours) * 100 : 0;
  const maintenanceObsPct = maintenanceWorkedHours > 0 ? (maintenanceHoursByCategory['Obsługa projektu'] / maintenanceWorkedHours) * 100 : 0;
  const maintenanceInPct = maintenanceWorkedHours > 0 ? (maintenanceHoursByCategory['Inne'] / maintenanceWorkedHours) * 100 : 0;
  const totalProjectProgPct = totalProjectWorkedHours > 0 ? (totalProjectHoursByCategory['Programistyczne'] / totalProjectWorkedHours) * 100 : 0;
  const totalProjectObsPct = totalProjectWorkedHours > 0 ? (totalProjectHoursByCategory['Obsługa projektu'] / totalProjectWorkedHours) * 100 : 0;
  const totalProjectInPct = totalProjectWorkedHours > 0 ? (totalProjectHoursByCategory['Inne'] / totalProjectWorkedHours) * 100 : 0;
  const formatHoursWithUnit = (hours: number) => `${formatOrderHours(hours)} h`;
  const formatShareLabel = (hours: number, pct: number) => `${pct.toFixed(0)}% · ${formatHoursWithUnit(hours)}`;
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
  const workedOrdersNetValue = youtrackTotal * selectedProject.rateNetto;
  const workedOrdersGrossValue = youtrackTotal * selectedProject.rateBrutto;
  const maintenanceContractGrossValue = maintenanceEntries.reduce((sum, entry) => sum + (entry.grossAmount || 0), 0);
  const maintenanceWorkedNetValue = maintenanceWorkedHours * selectedProject.rateNetto;
  const maintenanceWorkedGrossValue = maintenanceWorkedHours * selectedProject.rateBrutto;
  const maintenanceDifferenceNetValue = maintenanceDifferenceHours * selectedProject.rateNetto;
  const maintenanceDifferenceGrossValue = maintenanceDifferenceHours * selectedProject.rateBrutto;
  const totalProjectAvailableNetValue = contractedNetValue + maintenanceContractNetValue;
  const totalProjectAvailableGrossValue = contractedGrossValue + maintenanceContractGrossValue;
  const totalProjectWorkedNetValue = totalProjectWorkedHours * selectedProject.rateNetto;
  const totalProjectWorkedGrossValue = totalProjectWorkedHours * selectedProject.rateBrutto;
  const totalProjectDifferenceNetValue = totalProjectDifferenceHours * selectedProject.rateNetto;
  const totalProjectDifferenceGrossValue = totalProjectDifferenceHours * selectedProject.rateBrutto;
  const maintenanceDashboardSections = selectedProject.hasMaintenance ? [
    {
      key: 'orders',
      title: 'Zlecenia',
      subtitle: 'Część projektowa rozliczana standardowo przez rejestr zleceń.',
      headerValue: `${formatOrderHours(totalHoursUsed)} h`,
      headerNote: `${formatOrderHours(settledHours)} h rozliczone · ${formatOrderHours(contractedHours)} h zakontraktowane`,
      tone: 'border-sky-100 bg-sky-50/70 dark:border-sky-900/40 dark:bg-sky-950/20',
      accent: 'text-sky-700 dark:text-sky-300',
      titleClassName: 'text-sky-800 dark:text-sky-200',
      items: [
        {
          label: 'Wykorzystane',
          hours: totalHoursUsed,
          note: 'Rozliczone + zakontraktowane w zleceniach.',
          amountNet: contractedNetValue,
          amountGross: contractedGrossValue,
        },
        {
          label: 'Przepracowane',
          hours: youtrackTotal,
          note: 'Logi YouTrack bez pozycji oznaczonych jako utrzymanie.',
          amountNet: workedOrdersNetValue,
          amountGross: workedOrdersGrossValue,
        },
        {
          label: hoursDifference >= 0 ? 'Różnica' : 'Nadwyżka pracy',
          hours: Math.abs(hoursDifference),
          note: hoursDifferenceLabel,
          amountNet: Math.abs(hoursDifferenceNet),
          amountGross: Math.abs(hoursDifferenceGross),
        },
      ],
    },
    {
      key: 'maintenance',
      title: 'Utrzymanie',
      subtitle: 'Abonament i praca rozliczana w ramach wpisów utrzymaniowych.',
      headerValue: `${formatOrderHours(maintenanceAvailableHours)} h`,
      headerNote: `${maintenanceEntries.length} mies. · ${formatOrderHours(maintenanceWorkedHours)} h wykorzystane`,
      tone: 'border-fuchsia-100 bg-fuchsia-50/70 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/20',
      accent: 'text-fuchsia-700 dark:text-fuchsia-300',
      titleClassName: 'text-fuchsia-800 dark:text-fuchsia-200',
      items: [
        {
          label: 'Do wykorzystania',
          hours: maintenanceAvailableHours,
          note: 'Pula godzin wynikająca z wpisów utrzymania.',
          amountNet: maintenanceContractNetValue,
          amountGross: maintenanceContractGrossValue,
        },
        {
          label: 'Przepracowane',
          hours: maintenanceWorkedHours,
          note: 'Logi oznaczone w rejestrze pracy jako utrzymanie.',
          amountNet: maintenanceWorkedNetValue,
          amountGross: maintenanceWorkedGrossValue,
        },
        {
          label: maintenanceDifferenceHours >= 0 ? 'Pozostało' : 'Przekroczono',
          hours: Math.abs(maintenanceDifferenceHours),
          note: maintenanceDifferenceHours >= 0 ? 'Godziny, które można jeszcze wykorzystać w ramach utrzymania.' : 'Praca przekroczyła obecną pulę utrzymania.',
          amountNet: Math.abs(maintenanceDifferenceNetValue),
          amountGross: Math.abs(maintenanceDifferenceGrossValue),
        },
      ],
    },
    {
      key: 'total',
      title: 'Razem',
      subtitle: 'Łączne ujęcie zleceń i utrzymania dla całego projektu.',
      headerValue: `${formatOrderHours(totalProjectAvailableHours)} h`,
      headerNote: `${formatOrderHours(totalProjectWorkedHours)} h przepracowane łącznie`,
      tone: 'border-emerald-100 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20',
      accent: 'text-emerald-700 dark:text-emerald-300',
      titleClassName: 'text-emerald-800 dark:text-emerald-200',
      items: [
        {
          label: 'Do wykorzystania',
          hours: totalProjectAvailableHours,
          note: 'Zlecenia + pula wynikająca z utrzymania.',
          amountNet: totalProjectAvailableNetValue,
          amountGross: totalProjectAvailableGrossValue,
        },
        {
          label: 'Przepracowane',
          hours: totalProjectWorkedHours,
          note: 'Całość pracy zleceń i utrzymania według YouTrack.',
          amountNet: totalProjectWorkedNetValue,
          amountGross: totalProjectWorkedGrossValue,
        },
        {
          label: totalProjectDifferenceHours >= 0 ? 'Pozostało' : 'Przekroczono',
          hours: Math.abs(totalProjectDifferenceHours),
          note: totalProjectDifferenceHours >= 0 ? 'Zapas godzin na poziomie całego projektu.' : 'Łączna praca przekroczyła dostępną pulę projektu.',
          amountNet: Math.abs(totalProjectDifferenceNetValue),
          amountGross: Math.abs(totalProjectDifferenceGrossValue),
        },
      ],
    },
  ] : [];
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
  const burnUpTrendData = buildBurnUpTrendData({
    orders: orders.filter((order) => !isCancelledOrder(order)),
    workItems: selectedProject.hasMaintenance ? nonMaintenanceWorkItems : workItems,
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
  const filteredWorkItems = workItems.filter((item) =>
    doesDateOverlapRange(item.date.split('T')[0], effectiveBurnUpRange)
  );
  const filteredOrderWorkItems = filteredWorkItems.filter((item) => !item.isMaintenance);
  const filteredMaintenanceWorkItems = filteredWorkItems.filter((item) => item.isMaintenance);
  const filteredMaintenanceEntries = maintenanceEntries.filter((entry) =>
    doesMaintenanceEntryOverlapRange(entry.month, effectiveBurnUpRange)
  );
  const filteredOrders = orders.filter((order) =>
    doesOrderOverlapRange(order, effectiveBurnUpRange, new Date())
  );
  const filteredSettledOrders = filteredOrders.filter(isSettledOrder);
  const filteredPendingSettlementOrders = filteredOrders.filter(isPendingSettlementOrder);
  const filteredCancelledOrders = filteredOrders.filter(isCancelledOrder);
  const filteredSettledHours = filteredSettledOrders.reduce((sum, order) => sum + getOrderHoursTotal(order), 0);
  const filteredPendingSettlementHours = filteredPendingSettlementOrders.reduce((sum, order) => sum + getOrderHoursTotal(order), 0);
  const filteredContractedTotalHours = filteredSettledHours + filteredPendingSettlementHours;
  const filteredYoutrackHours: Record<string, number> = {
    'Programistyczne': 0,
    'Obsługa projektu': 0,
    'Inne': 0,
  };
  const filteredMaintenanceYoutrackHours: Record<string, number> = {
    'Programistyczne': 0,
    'Obsługa projektu': 0,
    'Inne': 0,
  };
  filteredOrderWorkItems.forEach((item) => {
    const category = item.category || 'Inne';
    if (filteredYoutrackHours[category] !== undefined) {
      filteredYoutrackHours[category] += (item.minutes || 0) / 60;
    } else {
      filteredYoutrackHours[category] = (item.minutes || 0) / 60;
    }
  });
  filteredMaintenanceWorkItems.forEach((item) => {
    const category = item.category || 'Inne';
    if (filteredMaintenanceYoutrackHours[category] !== undefined) {
      filteredMaintenanceYoutrackHours[category] += (item.minutes || 0) / 60;
    } else {
      filteredMaintenanceYoutrackHours[category] = (item.minutes || 0) / 60;
    }
  });
  const filteredYoutrackTotal = Object.values(filteredYoutrackHours).reduce((sum, value) => sum + value, 0);
  const filteredMaintenanceYoutrackTotal = Object.values(filteredMaintenanceYoutrackHours).reduce((sum, value) => sum + value, 0);
  const filteredWorkedNetValue = filteredYoutrackTotal * selectedProject.rateNetto;
  const filteredWorkedGrossValue = filteredYoutrackTotal * selectedProject.rateBrutto;
  const filteredContractedNetValue = filteredContractedTotalHours * selectedProject.rateNetto;
  const filteredContractedGrossValue = filteredContractedTotalHours * selectedProject.rateBrutto;
  const filteredMaintenanceContractNetValue = filteredMaintenanceEntries.reduce((sum, entry) => sum + (entry.netAmount || 0), 0);
  const filteredMaintenanceContractGrossValue = filteredMaintenanceEntries.reduce((sum, entry) => sum + (entry.grossAmount || 0), 0);
  const filteredMaintenanceAvailableHours = selectedProject.rateNetto > 0
    ? filteredMaintenanceContractNetValue / selectedProject.rateNetto
    : 0;
  const filteredMaintenanceWorkedNetValue = filteredMaintenanceYoutrackTotal * selectedProject.rateNetto;
  const filteredMaintenanceWorkedGrossValue = filteredMaintenanceYoutrackTotal * selectedProject.rateBrutto;
  const filteredMaintenanceDifferenceHours = filteredMaintenanceAvailableHours - filteredMaintenanceYoutrackTotal;
  const filteredMaintenanceDifferenceNetValue = filteredMaintenanceDifferenceHours * selectedProject.rateNetto;
  const filteredMaintenanceDifferenceGrossValue = filteredMaintenanceDifferenceHours * selectedProject.rateBrutto;
  const filteredTotalWorkedHours = filteredYoutrackTotal + filteredMaintenanceYoutrackTotal;
  const filteredTotalWorkedNetValue = filteredWorkedNetValue + filteredMaintenanceWorkedNetValue;
  const filteredTotalWorkedGrossValue = filteredWorkedGrossValue + filteredMaintenanceWorkedGrossValue;
  const filteredTotalAvailableHours = filteredContractedTotalHours + filteredMaintenanceAvailableHours;
  const filteredTotalAvailableNetValue = filteredContractedNetValue + filteredMaintenanceContractNetValue;
  const filteredTotalAvailableGrossValue = filteredContractedGrossValue + filteredMaintenanceContractGrossValue;
  const filteredTotalDifferenceHours = filteredTotalAvailableHours - filteredTotalWorkedHours;
  const filteredTotalDifferenceNetValue = filteredTotalAvailableNetValue - filteredTotalWorkedNetValue;
  const filteredTotalDifferenceGrossValue = filteredTotalAvailableGrossValue - filteredTotalWorkedGrossValue;
  const filteredPendingNetValue = filteredPendingSettlementHours * selectedProject.rateNetto;
  const filteredPendingGrossValue = filteredPendingSettlementHours * selectedProject.rateBrutto;
  const filteredSettledNetValue = filteredSettledHours * selectedProject.rateNetto;
  const filteredSettledGrossValue = filteredSettledHours * selectedProject.rateBrutto;
  const filteredProfitabilityHours = filteredContractedTotalHours - filteredYoutrackTotal;
  const filteredProfitabilityNetValue = filteredProfitabilityHours * selectedProject.rateNetto;
  const filteredProfitabilityGrossValue = filteredProfitabilityHours * selectedProject.rateBrutto;
  const filteredProfitabilityPct = filteredContractedTotalHours > 0
    ? (filteredProfitabilityHours / filteredContractedTotalHours) * 100
    : 0;
  const filteredOrderTaskCount = new Set(filteredOrderWorkItems.map((item) => item.issueId).filter(Boolean)).size;
  const filteredMaintenanceTaskCount = new Set(filteredMaintenanceWorkItems.map((item) => item.issueId).filter(Boolean)).size;
  const filteredTotalTaskCount = new Set(filteredWorkItems.map((item) => item.issueId).filter(Boolean)).size;
  const filteredInProgressOrders = filteredPendingSettlementOrders.filter(isInProgressPendingOrder);
  const filteredHandedOverPendingOrders = filteredPendingSettlementOrders.filter(isHandedOverPendingOrder);
  const filteredSettlementRows = [
    settlementRows[0],
    {
      label: 'Zakontraktowane',
      value: formatOrderHours(filteredContractedTotalHours),
      amountNet: filteredContractedNetValue,
      amountGross: filteredContractedGrossValue,
      note: 'Suma godzin ze zleceń nachodzących na wybrany zakres dat.',
      tone: 'text-indigo-700 dark:text-indigo-300',
    },
    {
      label: 'Rozliczone',
      value: formatOrderHours(filteredSettledHours),
      amountNet: filteredSettledNetValue,
      amountGross: filteredSettledGrossValue,
      note: 'Zlecenia rozliczone, których oś czasu nachodzi na wybrany zakres dat.',
      tone: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      label: 'Do rozliczenia',
      value: formatOrderHours(filteredPendingSettlementHours),
      amountNet: filteredPendingNetValue,
      amountGross: filteredPendingGrossValue,
      note: 'Zlecenia oczekujące na odbiór w wybranym zakresie dat.',
      tone: 'text-amber-700 dark:text-amber-300',
    },
    settlementRows[4],
  ];
  const filteredMaintenanceSettlementRows = selectedProject.hasMaintenance ? [
    {
      label: 'Pula utrzymania',
      value: formatOrderHours(filteredMaintenanceAvailableHours),
      amountNet: filteredMaintenanceContractNetValue,
      amountGross: filteredMaintenanceContractGrossValue,
      note: `${filteredMaintenanceEntries.length} mies. utrzymania w wybranym zakresie dat.`,
      tone: 'text-fuchsia-700 dark:text-fuchsia-300',
    },
    {
      label: 'Przepracowane w utrzymaniu',
      value: formatOrderHours(filteredMaintenanceYoutrackTotal),
      amountNet: filteredMaintenanceWorkedNetValue,
      amountGross: filteredMaintenanceWorkedGrossValue,
      note: 'Logi YouTrack oznaczone jako utrzymanie w wybranym zakresie dat.',
      tone: 'text-violet-700 dark:text-violet-300',
    },
    {
      label: filteredMaintenanceDifferenceHours >= 0 ? 'Pozostało w utrzymaniu' : 'Przekroczono utrzymanie',
      value: formatOrderHours(filteredMaintenanceDifferenceHours),
      amountNet: filteredMaintenanceDifferenceNetValue,
      amountGross: filteredMaintenanceDifferenceGrossValue,
      note: filteredMaintenanceDifferenceHours >= 0
        ? 'Pozostała pula godzin wynikająca z wpisów utrzymania w wybranym zakresie.'
        : 'Praca utrzymaniowa przekroczyła pulę wynikającą z wpisów utrzymania w wybranym zakresie.',
      tone: filteredMaintenanceDifferenceHours >= 0
        ? 'text-emerald-700 dark:text-emerald-300'
        : 'text-red-700 dark:text-red-300',
    },
  ] : [];
  const filteredProfitabilityRows = [
    {
      label: 'Zakontraktowane godziny',
      value: formatOrderHours(filteredContractedTotalHours),
      note: 'Suma godzin zakontraktowanych w zleceniach widocznych w wybranym zakresie.',
      financialNote: `Netto ${formatCurrencyValue(filteredContractedNetValue)} zł, brutto ${formatCurrencyValue(filteredContractedGrossValue)} zł.`,
      tone: 'text-indigo-700 dark:text-indigo-300',
    },
    {
      label: 'Przepracowane w zleceniach',
      value: formatOrderHours(filteredYoutrackTotal),
      note: 'Logi YouTrack z wybranego zakresu dat, bez zadań oznaczonych jako utrzymanie.',
      financialNote: `Netto ${formatCurrencyValue(filteredWorkedNetValue)} zł, brutto ${formatCurrencyValue(filteredWorkedGrossValue)} zł.`,
      tone: 'text-violet-700 dark:text-violet-300',
    },
    {
      label: 'Zysk na różnicy godzin',
      value: formatOrderHours(filteredProfitabilityHours),
      note: 'Różnica zakontraktowane - przepracowane dla części zleceniowej w wybranym zakresie.',
      financialNote: `Netto ${formatCurrencyValue(filteredProfitabilityNetValue)} zł, brutto ${formatCurrencyValue(filteredProfitabilityGrossValue)} zł.`,
      tone: filteredProfitabilityHours >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
    },
  ];
  const filteredSettlementBreakdownSections = selectedProject.hasMaintenance ? [
    {
      key: 'orders',
      title: 'Zlecenia',
      tone: 'border-sky-100 bg-sky-50/70 dark:border-sky-900/40 dark:bg-sky-950/20',
      items: [
        {
          label: 'Zadania w ramach zleceń',
          value: filteredOrderTaskCount.toString(),
          suffix: 'zad.',
          note: 'Unikalne zadania YouTrack bez oznaczenia utrzymania.',
          amountNet: undefined,
          amountGross: undefined,
          tone: 'text-gray-900 dark:text-white',
        },
        {
          label: 'Godziny zakontraktowane',
          value: formatOrderHours(filteredContractedTotalHours),
          suffix: 'h',
          note: 'Zlecenia nachodzące na wybrany zakres dat.',
          amountNet: filteredContractedNetValue,
          amountGross: filteredContractedGrossValue,
          tone: 'text-gray-900 dark:text-white',
        },
        {
          label: 'Godziny przepracowane',
          value: formatOrderHours(filteredYoutrackTotal),
          suffix: 'h',
          note: 'Logi wykonane w ramach zadań zleceniowych.',
          amountNet: filteredWorkedNetValue,
          amountGross: filteredWorkedGrossValue,
          tone: 'text-gray-900 dark:text-white',
        },
        {
          label: filteredProfitabilityHours >= 0 ? 'Różnica godzin' : 'Przekroczenie godzin',
          value: formatOrderHours(filteredProfitabilityHours),
          suffix: 'h',
          note: filteredProfitabilityHours >= 0
            ? 'Pozostała różnica między pulą zleceń a przepracowanymi godzinami zleceniowymi.'
            : 'Praca zleceniowa przekroczyła zakontraktowaną pulę godzin w wybranym zakresie.',
          amountNet: filteredProfitabilityNetValue,
          amountGross: filteredProfitabilityGrossValue,
          tone: filteredProfitabilityHours >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
        },
      ],
    },
    {
      key: 'maintenance',
      title: 'Utrzymanie',
      tone: 'border-fuchsia-100 bg-fuchsia-50/70 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/20',
      items: [
        {
          label: 'Zadania utrzymaniowe',
          value: filteredMaintenanceTaskCount.toString(),
          suffix: 'zad.',
          note: 'Unikalne zadania YouTrack oznaczone jako utrzymanie.',
          amountNet: undefined,
          amountGross: undefined,
          tone: 'text-gray-900 dark:text-white',
        },
        {
          label: 'Godziny z utrzymania',
          value: formatOrderHours(filteredMaintenanceAvailableHours),
          suffix: 'h',
          note: `${filteredMaintenanceEntries.length} mies. utrzymania w wybranym zakresie.`,
          amountNet: filteredMaintenanceContractNetValue,
          amountGross: filteredMaintenanceContractGrossValue,
          tone: 'text-gray-900 dark:text-white',
        },
        {
          label: 'Przepracowane w utrzymaniu',
          value: formatOrderHours(filteredMaintenanceYoutrackTotal),
          suffix: 'h',
          note: 'Logi wykonane w ramach zadań utrzymaniowych.',
          amountNet: filteredMaintenanceWorkedNetValue,
          amountGross: filteredMaintenanceWorkedGrossValue,
          tone: 'text-gray-900 dark:text-white',
        },
        {
          label: filteredMaintenanceDifferenceHours >= 0 ? 'Różnica godzin' : 'Przekroczenie godzin',
          value: formatOrderHours(filteredMaintenanceDifferenceHours),
          suffix: 'h',
          note: filteredMaintenanceDifferenceHours >= 0
            ? 'Pozostała pula godzin z utrzymania po odjęciu pracy utrzymaniowej.'
            : 'Praca utrzymaniowa przekroczyła pulę godzin wynikającą z wpisów utrzymania.',
          amountNet: filteredMaintenanceDifferenceNetValue,
          amountGross: filteredMaintenanceDifferenceGrossValue,
          tone: filteredMaintenanceDifferenceHours >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
        },
      ],
    },
    {
      key: 'total',
      title: 'Razem',
      tone: 'border-emerald-100 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20',
      items: [
        {
          label: 'Zadania łącznie',
          value: filteredTotalTaskCount.toString(),
          suffix: 'zad.',
          note: 'Wszystkie unikalne zadania widoczne w wybranym zakresie.',
          amountNet: undefined,
          amountGross: undefined,
          tone: 'text-gray-900 dark:text-white',
        },
        {
          label: 'Godziny do wykorzystania',
          value: formatOrderHours(filteredTotalAvailableHours),
          suffix: 'h',
          note: 'Zlecenia + pula godzin wynikająca z wpisów utrzymania.',
          amountNet: filteredTotalAvailableNetValue,
          amountGross: filteredTotalAvailableGrossValue,
          tone: 'text-gray-900 dark:text-white',
        },
        {
          label: 'Godziny przepracowane',
          value: formatOrderHours(filteredTotalWorkedHours),
          suffix: 'h',
          note: 'Łączna praca wykonana w zleceniach i utrzymaniu.',
          amountNet: filteredTotalWorkedNetValue,
          amountGross: filteredTotalWorkedGrossValue,
          tone: 'text-gray-900 dark:text-white',
        },
        {
          label: filteredTotalDifferenceHours >= 0 ? 'Różnica godzin' : 'Przekroczenie godzin',
          value: formatOrderHours(filteredTotalDifferenceHours),
          suffix: 'h',
          note: filteredTotalDifferenceHours >= 0
            ? 'Pozostała łączna pula godzin dla zleceń i utrzymania w wybranym zakresie.'
            : 'Łączna praca przekroczyła dostępną pulę zleceń i utrzymania w wybranym zakresie.',
          amountNet: filteredTotalDifferenceNetValue,
          amountGross: filteredTotalDifferenceGrossValue,
          tone: filteredTotalDifferenceHours >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
        },
      ],
    },
  ] : [];
  const filteredAuthorHours = Object.entries(
    filteredWorkItems.reduce<Record<string, number>>((acc, item) => {
      const authorName = item.authorName || 'Nieznana osoba';
      acc[authorName] = (acc[authorName] || 0) + ((item.minutes || 0) / 60);
      return acc;
    }, {})
  )
    .map(([name, hours]) => ({ name, hours }))
    .sort((a, b) => b.hours - a.hours);
  const visibleBurnUpTrendData = (() => {
    if (!effectiveBurnUpRange) return burnUpTrendData;
    return alignBurnUpTrendDataToRange(
      burnUpTrendData,
      effectiveBurnUpRange,
    );
  })();
  const burnUpSummary = summarizeBurnUpTrendData(visibleBurnUpTrendData);
  const burnUpEstimateCeiling = burnUpSummary.estimateCeiling;
  const burnUpActualCeiling = burnUpSummary.actualCeiling;
  const burnUpDeltaHours = burnUpSummary.deltaHours;
  const burnUpMarginChange = burnUpSummary.marginChange;
  const burnUpTrendRatio = burnUpSummary.trendRatio;
  const burnUpRollingTrendRatio = burnUpSummary.rollingTrendRatio;
  const burnUpTrendTone = burnUpSummary.trendTone;
  const burnUpMarginChangeTone = burnUpSummary.marginChangeTone;
  const burnUpMarginDirectionLabel = burnUpSummary.marginDirectionLabel;
  const burnUpTrendBadgeTone = burnUpSummary.trendBadgeTone;
  const burnUpHoursDomain = burnUpSummary.hoursDomain;
  const burnUpMarginDomain = burnUpSummary.marginDomain;
  const shouldShowBurnUpMarginZeroLine = burnUpSummary.shouldShowMarginZeroLine;
  const maintenanceBurnUpTrendData = selectedProject.hasMaintenance
    ? buildMaintenanceBurnUpTrendData({
      maintenanceEntries,
      workItems: maintenanceWorkItems,
      rateNetto: selectedProject.rateNetto,
    })
    : [];
  const visibleMaintenanceBurnUpTrendData = (() => {
    if (!effectiveBurnUpRange) return maintenanceBurnUpTrendData;
    return alignBurnUpTrendDataToRange(
      maintenanceBurnUpTrendData,
      effectiveBurnUpRange,
    );
  })();
  const maintenanceBurnUpSummary = summarizeBurnUpTrendData(visibleMaintenanceBurnUpTrendData);
  const maintenanceBurnUpEstimateCeiling = maintenanceBurnUpSummary.estimateCeiling;
  const maintenanceBurnUpActualCeiling = maintenanceBurnUpSummary.actualCeiling;
  const maintenanceBurnUpDeltaHours = maintenanceBurnUpSummary.deltaHours;
  const maintenanceBurnUpMarginChange = maintenanceBurnUpSummary.marginChange;
  const maintenanceBurnUpTrendRatio = maintenanceBurnUpSummary.trendRatio;
  const maintenanceBurnUpRollingTrendRatio = maintenanceBurnUpSummary.rollingTrendRatio;
  const maintenanceBurnUpTrendTone = maintenanceBurnUpSummary.trendTone;
  const maintenanceBurnUpMarginChangeTone = maintenanceBurnUpSummary.marginChangeTone;
  const maintenanceBurnUpMarginDirectionLabel = maintenanceBurnUpSummary.marginDirectionLabel;
  const maintenanceBurnUpTrendBadgeTone = maintenanceBurnUpSummary.trendBadgeTone;
  const maintenanceBurnUpHoursDomain = maintenanceBurnUpSummary.hoursDomain;
  const maintenanceBurnUpMarginDomain = maintenanceBurnUpSummary.marginDomain;
  const shouldShowMaintenanceBurnUpMarginZeroLine = maintenanceBurnUpSummary.shouldShowMarginZeroLine;
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
  const toggleSettlementSection = (sectionKey: string) => {
    setCollapsedSettlementSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };
  const isSettlementSectionCollapsed = (sectionKey: string) => Boolean(collapsedSettlementSections[sectionKey]);

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
            Zlecenia
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
          {selectedProject.hasMaintenance && (
            <button
              onClick={() => setActiveTab('maintenance')}
              className={`pb-3 border-b-2 transition-colors ${activeTab === 'maintenance' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Utrzymanie
            </button>
          )}
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
                      <h3 className="font-bold sm:text-lg">
                        {selectedProject.hasMaintenance ? 'Utrzymanie, Zlecenia vs Praca' : 'Zlecenia vs Praca'}
                      </h3>
                    </div>
                    <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${hoursDifferenceTone}`}>
                      {hoursDifference > 0 ? '+' : ''}{hoursDifferencePct.toFixed(1)}% · {hoursDifference > 0 ? '+' : ''}{hoursDifference.toFixed(1)} h · {hoursDifferenceLabel}
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <div className="flex justify-between text-sm mb-1.5 font-medium">
                        <span className="text-gray-600 dark:text-gray-400">Wykorzystane w zleceniach (Rozliczone + Zakontraktowane)</span>
                        <span className="text-gray-900 dark:text-white font-bold">{totalHoursUsed.toFixed(1)} <span className="text-gray-500 font-normal">h</span></span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${Math.min(100, (totalHoursUsed / maxScale) * 100)}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1.5 font-medium">
                        <span className="text-gray-600 dark:text-gray-400">Przepracowane w zleceniach (YouTrack bez utrzymania)</span>
                        <span className="text-gray-900 dark:text-white font-bold">{youtrackTotal.toFixed(1)} <span className="text-gray-500 font-normal">h</span></span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden flex">
                        <div className="bg-violet-500 h-full transition-all duration-1000" style={{ width: `${(youtrackHours['Programistyczne'] / maxScale) * 100}%` }} title={`Programistyczne: ${formatShareLabel(youtrackHours['Programistyczne'], progPct)}`}></div>
                        <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(youtrackHours['Obsługa projektu'] / maxScale) * 100}%` }} title={`Obsługa projektu: ${formatShareLabel(youtrackHours['Obsługa projektu'], obsPct)}`}></div>
                        <div className="bg-amber-500 h-full transition-all duration-1000" style={{ width: `${(youtrackHours['Inne'] / maxScale) * 100}%` }} title={`Inne: ${formatShareLabel(youtrackHours['Inne'], inPct)}`}></div>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs font-medium text-gray-500">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-violet-500"></div> Programistyczne ({formatShareLabel(youtrackHours['Programistyczne'], progPct)})</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></div> Obsługa projektu ({formatShareLabel(youtrackHours['Obsługa projektu'], obsPct)})</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500"></div> Inne ({formatShareLabel(youtrackHours['Inne'], inPct)})</div>
                      </div>
                    </div>

                    {selectedProject.hasMaintenance && (
                      <>
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">Rozliczenie utrzymania</p>
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${maintenanceDifferenceHours >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                              {maintenanceDifferenceHours >= 0 ? 'Pozostało ' : 'Przekroczono '}
                              {Math.abs(maintenanceDifferenceHours).toFixed(1)} h
                            </span>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <div className="flex justify-between text-sm mb-1.5 font-medium">
                                <span className="text-gray-600 dark:text-gray-400">Do wykorzystania w utrzymaniu</span>
                                <span className="text-gray-900 dark:text-white font-bold">{maintenanceAvailableHours.toFixed(1)} <span className="text-gray-500 font-normal">h</span></span>
                              </div>
                              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div className="bg-fuchsia-500 h-full transition-all duration-1000" style={{ width: `${Math.min(100, (maintenanceAvailableHours / maxScale) * 100)}%` }}></div>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-sm mb-1.5 font-medium">
                                <span className="text-gray-600 dark:text-gray-400">Wykorzystano w utrzymaniu</span>
                                <span className="text-gray-900 dark:text-white font-bold">{maintenanceWorkedHours.toFixed(1)} <span className="text-gray-500 font-normal">h</span></span>
                              </div>
                              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden flex">
                                <div className="bg-violet-500 h-full transition-all duration-1000" style={{ width: `${(maintenanceHoursByCategory['Programistyczne'] / maxScale) * 100}%` }} title={`Programistyczne: ${formatShareLabel(maintenanceHoursByCategory['Programistyczne'], maintenanceProgPct)}`}></div>
                                <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(maintenanceHoursByCategory['Obsługa projektu'] / maxScale) * 100}%` }} title={`Obsługa projektu: ${formatShareLabel(maintenanceHoursByCategory['Obsługa projektu'], maintenanceObsPct)}`}></div>
                                <div className="bg-amber-500 h-full transition-all duration-1000" style={{ width: `${(maintenanceHoursByCategory['Inne'] / maxScale) * 100}%` }} title={`Inne: ${formatShareLabel(maintenanceHoursByCategory['Inne'], maintenanceInPct)}`}></div>
                              </div>
                              <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs font-medium text-gray-500">
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-violet-500"></div> Programistyczne ({formatShareLabel(maintenanceHoursByCategory['Programistyczne'], maintenanceProgPct)})</div>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></div> Obsługa projektu ({formatShareLabel(maintenanceHoursByCategory['Obsługa projektu'], maintenanceObsPct)})</div>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500"></div> Inne ({formatShareLabel(maintenanceHoursByCategory['Inne'], maintenanceInPct)})</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">Cały projekt: zlecenia + utrzymanie</p>
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${totalProjectDifferenceHours >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                              {totalProjectDifferenceHours >= 0 ? 'Pozostało ' : 'Przekroczono '}
                              {Math.abs(totalProjectDifferenceHours).toFixed(1)} h
                            </span>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <div className="flex justify-between text-sm mb-1.5 font-medium">
                                <span className="text-gray-600 dark:text-gray-400">Do wykorzystania w całym projekcie</span>
                                <span className="text-gray-900 dark:text-white font-bold">{totalProjectAvailableHours.toFixed(1)} <span className="text-gray-500 font-normal">h</span></span>
                              </div>
                              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div className="bg-sky-500 h-full transition-all duration-1000" style={{ width: `${Math.min(100, (totalProjectAvailableHours / maxScale) * 100)}%` }}></div>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-sm mb-1.5 font-medium">
                                <span className="text-gray-600 dark:text-gray-400">Wykorzystano w całym projekcie</span>
                                <span className="text-gray-900 dark:text-white font-bold">{totalProjectWorkedHours.toFixed(1)} <span className="text-gray-500 font-normal">h</span></span>
                              </div>
                              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden flex">
                                <div className="bg-violet-500 h-full transition-all duration-1000" style={{ width: `${(totalProjectHoursByCategory['Programistyczne'] / maxScale) * 100}%` }} title={`Programistyczne: ${formatShareLabel(totalProjectHoursByCategory['Programistyczne'], totalProjectProgPct)}`}></div>
                                <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(totalProjectHoursByCategory['Obsługa projektu'] / maxScale) * 100}%` }} title={`Obsługa projektu: ${formatShareLabel(totalProjectHoursByCategory['Obsługa projektu'], totalProjectObsPct)}`}></div>
                                <div className="bg-amber-500 h-full transition-all duration-1000" style={{ width: `${(totalProjectHoursByCategory['Inne'] / maxScale) * 100}%` }} title={`Inne: ${formatShareLabel(totalProjectHoursByCategory['Inne'], totalProjectInPct)}`}></div>
                              </div>
                              <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs font-medium text-gray-500">
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-violet-500"></div> Programistyczne ({formatShareLabel(totalProjectHoursByCategory['Programistyczne'], totalProjectProgPct)})</div>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></div> Obsługa projektu ({formatShareLabel(totalProjectHoursByCategory['Obsługa projektu'], totalProjectObsPct)})</div>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500"></div> Inne ({formatShareLabel(totalProjectHoursByCategory['Inne'], totalProjectInPct)})</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
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

                  {selectedProject.hasMaintenance && (
                    <div className="col-span-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Podział projektu</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Zlecenia, utrzymanie i łączny obraz projektu.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                        {maintenanceDashboardSections.map((section) => (
                          <div key={section.key} className={`rounded-2xl border p-5 ${section.tone}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className={`inline-flex rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-[0.26em] shadow-sm dark:border-white/10 dark:bg-white/10 ${section.titleClassName}`}>{section.title}</p>
                                <h5 className="mt-2 text-xl font-black text-gray-900 dark:text-white">{section.headerValue}</h5>
                                <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{section.headerNote}</p>
                              </div>
                              <div className={`mt-1 h-3 w-3 rounded-full shadow-sm ${section.accent === 'text-sky-700 dark:text-sky-300' ? 'bg-sky-500' : section.accent === 'text-fuchsia-700 dark:text-fuchsia-300' ? 'bg-fuchsia-500' : 'bg-emerald-500'}`}></div>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{section.subtitle}</p>

                            <div className="mt-5 space-y-3">
                              {section.items.map((item) => (
                                <div key={`${section.key}-${item.label}`} className="rounded-xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-gray-900/30">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{item.label}</p>
                                    <p className="text-lg font-black text-gray-900 dark:text-white">
                                      {formatOrderHours(item.hours)} <span className="text-sm font-medium text-gray-500 dark:text-gray-400">h</span>
                                    </p>
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{item.note}</p>
                                  {isFinancialDataVisible && (
                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800/70">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Netto</p>
                                        <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{formatCurrencyValue(item.amountNet)} zł</p>
                                      </div>
                                      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800/70">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Brutto</p>
                                        <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{formatCurrencyValue(item.amountGross)} zł</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
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
                  <div className="mt-5 flex flex-col gap-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="min-w-[150px] flex-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200/90 dark:text-emerald-100/80">
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
                          className="mt-2 w-full rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-sm font-medium text-gray-700 outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-gray-200"
                        />
                      </label>
                      <label className="min-w-[150px] flex-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200/90 dark:text-emerald-100/80">
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
                          className="mt-2 w-full rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-sm font-medium text-gray-700 outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-gray-200"
                        />
                      </label>
                      <button
                        onClick={applyLastHalfYearBurnUpRange}
                        className={`h-[42px] rounded-xl px-4 text-sm font-semibold transition ${
                          burnUpRangeMode === 'halfYear'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'border border-white/70 bg-white/90 text-gray-600 hover:bg-white dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-900'
                        }`}
                      >
                        Ostatnie pół roku
                      </button>
                      <button
                        onClick={applyFullBurnUpRange}
                        className={`h-[42px] rounded-xl px-4 text-sm font-semibold transition ${
                          burnUpRangeMode === 'full'
                            ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                            : 'border border-white/70 bg-white/90 text-gray-600 hover:bg-white dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-900'
                        }`}
                      >
                        Całość
                      </button>
                    </div>
                    <p className="text-xs font-medium text-emerald-100/80 dark:text-emerald-100/70">
                      Filtry ustawiają wspólny zakres dat dla zestawień i wykresów widocznych niżej w zakładce `Rozliczenia`.
                    </p>
                  </div>
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

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => toggleSettlementSection('settlement-overview')}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1 text-left"
              >
                <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Podstawowe rozliczenie</h4>
                <ChevronDown size={18} className={`text-gray-400 transition-transform ${isSettlementSectionCollapsed('settlement-overview') ? '-rotate-90' : 'rotate-0'}`} />
              </button>
              {!isSettlementSectionCollapsed('settlement-overview') && (
                <div className="mt-4 space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                    {filteredSettlementRows.map((row) => (
                      <div key={row.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900/30">
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
                  {selectedProject.hasMaintenance && (
                    <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/40 p-4 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/10">
                      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-fuchsia-500 dark:text-fuchsia-300">Utrzymanie</p>
                          <h5 className="mt-1 text-lg font-black tracking-tight text-fuchsia-900 dark:text-fuchsia-100">Podsumowanie utrzymania w wybranym zakresie</h5>
                        </div>
                        <p className="text-sm leading-5 text-fuchsia-700 dark:text-fuchsia-200">
                          Wartości poniżej pokazują pulę godzin z abonamentu i jej wykorzystanie po aktywnych filtrach dat.
                        </p>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                        {filteredMaintenanceSettlementRows.map((row) => (
                          <div key={row.label} className="rounded-2xl border border-fuchsia-100 bg-white p-5 shadow-sm dark:border-fuchsia-900/40 dark:bg-gray-900/40">
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-fuchsia-400 dark:text-fuchsia-300">{row.label}</p>
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
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedProject.hasMaintenance && (
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => toggleSettlementSection('settlement-breakdown')}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1 text-left"
                >
                  <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Podział zlecenia / utrzymanie / razem</h4>
                  <ChevronDown size={18} className={`text-gray-400 transition-transform ${isSettlementSectionCollapsed('settlement-breakdown') ? '-rotate-90' : 'rotate-0'}`} />
                </button>
                {!isSettlementSectionCollapsed('settlement-breakdown') && (
                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                    {filteredSettlementBreakdownSections.map((section) => (
                      <div key={section.key} className={`rounded-2xl border p-5 shadow-sm ${section.tone}`}>
                        <h4 className="text-sm font-black uppercase tracking-[0.22em] text-gray-900 dark:text-white">{section.title}</h4>
                        <div className="mt-4 space-y-3">
                          {section.items.map((item) => (
                            <div key={`${section.key}-${item.label}`} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/30">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</p>
                                <p className={`text-xl font-black ${item.tone}`}>
                                  {item.value} <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">{item.suffix}</span>
                                </p>
                              </div>
                              <p className="mt-2 text-sm leading-5 text-gray-500 dark:text-gray-400">{item.note}</p>
                              {isFinancialDataVisible && item.amountNet !== undefined && item.amountGross !== undefined && (
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                  <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800/70">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Netto</p>
                                    <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{formatCurrencyValue(item.amountNet)} zł</p>
                                  </div>
                                  <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800/70">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Brutto</p>
                                    <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{formatCurrencyValue(item.amountGross)} zł</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => toggleSettlementSection('settlement-burnup')}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="max-w-3xl">
                  <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Wykres zleceń, logów i trendu w ramach zleceń</h4>
                  <h3 className="mt-2 text-2xl font-black text-gray-900 dark:text-white">Narastająco: godziny zleceń vs. godziny zalogowane w ramach zleceń</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    Główne linie pokazują, jak w czasie narastają godziny zakontraktowane w zleceniach oraz godziny rzeczywiście zalogowane przez zespół w części zleceniowej. Zakres analizy jest wspólny dla całej części rozliczeniowej poniżej i ustawisz go w filtrach powyżej.
                  </p>
                </div>
                <ChevronDown size={18} className={`mt-1 shrink-0 text-gray-400 transition-transform ${isSettlementSectionCollapsed('settlement-burnup') ? '-rotate-90' : 'rotate-0'}`} />
              </button>
              <div className={isSettlementSectionCollapsed('settlement-burnup') ? 'hidden' : 'block'}>
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
                          Linie są pokazane schodkowo, żeby było widać dyskretne przyrosty: zlecenia budują plan godzin w czasie, a logi z YouTrack pokazują rzeczywiste narastanie przepracowanych godzin.
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
                            domain={burnUpHoursDomain}
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickFormatter={(value) => `${Math.round(Number(value))}h`}
                          />
                          <YAxis yAxisId="increments" hide />
                          <Tooltip content={<BurnUpTrendTooltip />} />
                          <Legend verticalAlign="top" height={42} wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                          <Bar yAxisId="increments" dataKey="dailyEstimate" name="Przyrost godzin zleceń" fill="rgba(59,130,246,0.18)" stroke="none" barSize={10} isAnimationActive={false} />
                          <Area yAxisId="hours" dataKey="favorableBase" stackId="planBuffer" fill="transparent" stroke="none" isAnimationActive={false} legendType="none" />
                          <Area yAxisId="hours" dataKey="favorableGap" stackId="planBuffer" name="Bufor względem logów" fill="rgba(16,185,129,0.22)" stroke="none" isAnimationActive={false} />
                          <Area yAxisId="hours" dataKey="overrunBase" stackId="actualOverrun" fill="transparent" stroke="none" isAnimationActive={false} legendType="none" />
                          <Area yAxisId="hours" dataKey="overrunGap" stackId="actualOverrun" name="Przekroczenie logów nad zleceniami" fill="rgba(239,68,68,0.18)" stroke="none" isAnimationActive={false} />
                          <Line yAxisId="hours" type="stepAfter" dataKey="cumulativeEstimate" name="Godziny zleceń narastająco" stroke="#4f46e5" strokeWidth={3} dot={false} isAnimationActive={false} />
                          <Line yAxisId="hours" type="stepAfter" dataKey="cumulativeActual" name="Godziny zalogowane narastająco" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={false} />
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
                          <h3 className="mt-2 text-2xl font-black text-gray-900 dark:text-white">Trend relacji i marży godzinowej</h3>
                          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                            Schodkowe linie pokazują narastająco godziny zleceń i logów, a osobna linia marży godzinowej pokazuje, czy bufor między nimi rośnie, czy maleje w czasie. Im wyżej nad zerem przebiega marża, tym większy zapas godzin w zleceniach.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className={`inline-flex rounded-2xl px-4 py-3 text-sm font-bold ${burnUpTrendBadgeTone}`}>
                            {burnUpTrendRatio !== null ? `Bieżąca relacja: ${burnUpTrendRatio.toFixed(2)}` : 'Brak danych trendu'}
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm dark:bg-gray-900/80">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Zmiana marży w zakresie</p>
                            <p className={`mt-1 text-base font-black ${burnUpMarginChangeTone}`}>
                              {burnUpMarginChange !== null ? `${burnUpMarginChange > 0 ? '+' : ''}${formatOrderHours(burnUpMarginChange)} h` : 'brak'}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{burnUpMarginDirectionLabel}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 h-[360px] min-w-0">
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
                              width={56}
                              domain={burnUpHoursDomain}
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              tickFormatter={(value) => `${Math.round(Number(value))}h`}
                            />
                            <YAxis
                              yAxisId="margin"
                              orientation="right"
                              axisLine={false}
                              tickLine={false}
                              width={72}
                              domain={burnUpMarginDomain}
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              tickFormatter={(value) => `${Math.round(Number(value))}h`}
                            />
                            <Tooltip
                              formatter={(value: number | string | undefined, name?: string) => {
                                const numericValue = Number(value);
                                return [Number.isFinite(numericValue) ? `${formatOrderHours(numericValue)} h` : 'brak', name ?? 'Trend'];
                              }}
                              labelFormatter={(label) => {
                                const date = new Date(`${label}T00:00:00`);
                                return `Data: ${Number.isNaN(date.getTime()) ? label : format(date, 'dd.MM.yyyy')}`;
                              }}
                            />
                            <Legend verticalAlign="top" height={38} wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                            <Area yAxisId="hours" dataKey="favorableBase" stackId="trendPlanBuffer" fill="transparent" stroke="none" isAnimationActive={false} legendType="none" />
                            <Area yAxisId="hours" dataKey="favorableGap" stackId="trendPlanBuffer" name="Bufor względem logów" fill="rgba(16,185,129,0.18)" stroke="none" isAnimationActive={false} />
                            <Area yAxisId="hours" dataKey="overrunBase" stackId="trendActualOverrun" fill="transparent" stroke="none" isAnimationActive={false} legendType="none" />
                            <Area yAxisId="hours" dataKey="overrunGap" stackId="trendActualOverrun" name="Przekroczenie logów nad zleceniami" fill="rgba(239,68,68,0.16)" stroke="none" isAnimationActive={false} />
                            <Line yAxisId="hours" type="stepAfter" dataKey="cumulativeEstimate" name="Godziny zleceń narastająco" stroke="#4f46e5" strokeWidth={3} dot={false} isAnimationActive={false} />
                            <Line yAxisId="hours" type="stepAfter" dataKey="cumulativeActual" name="Godziny zalogowane narastająco" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={false} />
                            {shouldShowBurnUpMarginZeroLine && (
                              <ReferenceLine yAxisId="margin" y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                            )}
                            <Line yAxisId="margin" type="monotone" dataKey="deltaHours" name="Marża godzinowa (zlecenia - logi)" stroke="#f59e0b" strokeWidth={2.5} dot={false} isAnimationActive={false} />
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
            </div>

            {selectedProject.hasMaintenance && (
              <div className="rounded-2xl border border-fuchsia-100 bg-white p-6 shadow-sm dark:border-fuchsia-900/30 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => toggleSettlementSection('settlement-burnup-maintenance')}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="max-w-3xl">
                    <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-fuchsia-500 dark:text-fuchsia-300">Wykres utrzymania, logów i trendu w ramach utrzymania</h4>
                    <h3 className="mt-2 text-2xl font-black text-gray-900 dark:text-white">Narastająco: godziny utrzymania vs. godziny zalogowane w ramach utrzymania</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                      Ta karta pokazuje osobno narastanie godzin wynikających z wpisów utrzymania oraz logów oznaczonych jako utrzymaniowe. Zakres analizy jest wspólny dla całej części rozliczeniowej poniżej i ustawisz go w filtrach powyżej.
                    </p>
                  </div>
                  <ChevronDown size={18} className={`mt-1 shrink-0 text-gray-400 transition-transform ${isSettlementSectionCollapsed('settlement-burnup-maintenance') ? '-rotate-90' : 'rotate-0'}`} />
                </button>
                <div className={isSettlementSectionCollapsed('settlement-burnup-maintenance') ? 'hidden' : 'block'}>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                      Powiększ: przeciągnij myszą po wykresie, aby zaznaczyć zakres dat.
                    </p>
                  </div>

                  {visibleMaintenanceBurnUpTrendData.length > 0 ? (
                    <>
                      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
                        <div className="rounded-2xl bg-fuchsia-50 p-4 dark:bg-fuchsia-950/30">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-fuchsia-500 dark:text-fuchsia-300">Godziny utrzymania narastająco</p>
                          <p className="mt-2 text-2xl font-black text-fuchsia-700 dark:text-fuchsia-200">{formatOrderHours(maintenanceBurnUpEstimateCeiling)} h</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-500 dark:text-emerald-300">Godziny zalogowane narastająco</p>
                          <p className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-200">{formatOrderHours(maintenanceBurnUpActualCeiling)} h</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/60">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Różnica godzin</p>
                          <p className={`mt-2 text-2xl font-black ${maintenanceBurnUpTrendTone}`}>{formatOrderHours(maintenanceBurnUpDeltaHours)} h</p>
                        </div>
                        <div className={`rounded-2xl p-4 ${maintenanceBurnUpTrendBadgeTone}`}>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em]">Relacja utrzymania do logów / trend 30 dni</p>
                          <p className="mt-2 text-2xl font-black">
                            {maintenanceBurnUpTrendRatio !== null ? maintenanceBurnUpTrendRatio.toFixed(2) : 'brak'}
                            <span className="ml-2 text-sm font-semibold opacity-80">
                              {maintenanceBurnUpRollingTrendRatio !== null ? `30d: ${maintenanceBurnUpRollingTrendRatio.toFixed(2)}` : '30d: brak'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50/70 p-5 dark:border-gray-700 dark:bg-gray-900/30">
                        <div className="flex flex-col gap-2">
                          <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Narastanie godzin utrzymania</h4>
                          <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
                            Linie są pokazane schodkowo, żeby było widać dyskretne przyrosty: wpisy utrzymania budują plan godzin w czasie, a logi utrzymaniowe pokazują rzeczywiste narastanie przepracowanych godzin.
                          </p>
                        </div>
                        <div className="mt-5 h-[420px] min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                              data={visibleMaintenanceBurnUpTrendData}
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
                                domain={maintenanceBurnUpHoursDomain}
                                tick={{ fill: '#64748b', fontSize: 11 }}
                                tickFormatter={(value) => `${Math.round(Number(value))}h`}
                              />
                              <YAxis yAxisId="increments" hide />
                              <Tooltip
                                content={(
                                  <BurnUpTrendTooltip
                                    estimateLabel="Godziny utrzymania narastająco"
                                    actualLabel="Godziny zalogowane narastająco"
                                    dailyEstimateLabel="Przyrost utrzymania w dniu"
                                    dailyEstimateItemsLabel="Miesiące utrzymania w przyroście"
                                  />
                                )}
                              />
                              <Legend verticalAlign="top" height={42} wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                              <Bar yAxisId="increments" dataKey="dailyEstimate" name="Przyrost godzin utrzymania" fill="rgba(217,70,239,0.18)" stroke="none" barSize={10} isAnimationActive={false} />
                              <Area yAxisId="hours" dataKey="favorableBase" stackId="maintenancePlanBuffer" fill="transparent" stroke="none" isAnimationActive={false} legendType="none" />
                              <Area yAxisId="hours" dataKey="favorableGap" stackId="maintenancePlanBuffer" name="Bufor względem logów utrzymania" fill="rgba(16,185,129,0.22)" stroke="none" isAnimationActive={false} />
                              <Area yAxisId="hours" dataKey="overrunBase" stackId="maintenanceActualOverrun" fill="transparent" stroke="none" isAnimationActive={false} legendType="none" />
                              <Area yAxisId="hours" dataKey="overrunGap" stackId="maintenanceActualOverrun" name="Przekroczenie logów nad utrzymaniem" fill="rgba(239,68,68,0.18)" stroke="none" isAnimationActive={false} />
                              <Line yAxisId="hours" type="stepAfter" dataKey="cumulativeEstimate" name="Godziny utrzymania narastająco" stroke="#d946ef" strokeWidth={3} dot={false} isAnimationActive={false} />
                              <Line yAxisId="hours" type="stepAfter" dataKey="cumulativeActual" name="Godziny zalogowane narastająco" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={false} />
                              {burnUpSelectionRange && (
                                <ReferenceArea
                                  yAxisId="hours"
                                  x1={burnUpSelectionRange.start}
                                  x2={burnUpSelectionRange.end}
                                  strokeOpacity={0}
                                  fill="rgba(217,70,239,0.14)"
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
                            <h3 className="mt-2 text-2xl font-black text-gray-900 dark:text-white">Trend relacji i marży godzinowej utrzymania</h3>
                            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                              Schodkowe linie pokazują narastająco godziny utrzymania i logów utrzymaniowych, a osobna linia marży godzinowej pokazuje, czy bufor między nimi rośnie, czy maleje w czasie. Im wyżej nad zerem przebiega marża, tym większy zapas godzin w utrzymaniu.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className={`inline-flex rounded-2xl px-4 py-3 text-sm font-bold ${maintenanceBurnUpTrendBadgeTone}`}>
                              {maintenanceBurnUpTrendRatio !== null ? `Bieżąca relacja: ${maintenanceBurnUpTrendRatio.toFixed(2)}` : 'Brak danych trendu'}
                            </div>
                            <div className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm dark:bg-gray-900/80">
                              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Zmiana marży w zakresie</p>
                              <p className={`mt-1 text-base font-black ${maintenanceBurnUpMarginChangeTone}`}>
                                {maintenanceBurnUpMarginChange !== null ? `${maintenanceBurnUpMarginChange > 0 ? '+' : ''}${formatOrderHours(maintenanceBurnUpMarginChange)} h` : 'brak'}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{maintenanceBurnUpMarginDirectionLabel}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 h-[360px] min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                              data={visibleMaintenanceBurnUpTrendData}
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
                                width={56}
                                domain={maintenanceBurnUpHoursDomain}
                                tick={{ fill: '#64748b', fontSize: 11 }}
                                tickFormatter={(value) => `${Math.round(Number(value))}h`}
                              />
                              <YAxis
                                yAxisId="margin"
                                orientation="right"
                                axisLine={false}
                                tickLine={false}
                                width={72}
                                domain={maintenanceBurnUpMarginDomain}
                                tick={{ fill: '#64748b', fontSize: 11 }}
                                tickFormatter={(value) => `${Math.round(Number(value))}h`}
                              />
                              <Tooltip
                                formatter={(value: number | string | undefined, name?: string) => {
                                  const numericValue = Number(value);
                                  return [Number.isFinite(numericValue) ? `${formatOrderHours(numericValue)} h` : 'brak', name ?? 'Trend'];
                                }}
                                labelFormatter={(label) => {
                                  const date = new Date(`${label}T00:00:00`);
                                  return `Data: ${Number.isNaN(date.getTime()) ? label : format(date, 'dd.MM.yyyy')}`;
                                }}
                              />
                              <Legend verticalAlign="top" height={38} wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                              <Area yAxisId="hours" dataKey="favorableBase" stackId="maintenanceTrendPlanBuffer" fill="transparent" stroke="none" isAnimationActive={false} legendType="none" />
                              <Area yAxisId="hours" dataKey="favorableGap" stackId="maintenanceTrendPlanBuffer" name="Bufor względem logów utrzymania" fill="rgba(16,185,129,0.18)" stroke="none" isAnimationActive={false} />
                              <Area yAxisId="hours" dataKey="overrunBase" stackId="maintenanceTrendActualOverrun" fill="transparent" stroke="none" isAnimationActive={false} legendType="none" />
                              <Area yAxisId="hours" dataKey="overrunGap" stackId="maintenanceTrendActualOverrun" name="Przekroczenie logów nad utrzymaniem" fill="rgba(239,68,68,0.16)" stroke="none" isAnimationActive={false} />
                              <Line yAxisId="hours" type="stepAfter" dataKey="cumulativeEstimate" name="Godziny utrzymania narastająco" stroke="#d946ef" strokeWidth={3} dot={false} isAnimationActive={false} />
                              <Line yAxisId="hours" type="stepAfter" dataKey="cumulativeActual" name="Godziny zalogowane narastająco" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={false} />
                              {shouldShowMaintenanceBurnUpMarginZeroLine && (
                                <ReferenceLine yAxisId="margin" y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                              )}
                              <Line yAxisId="margin" type="monotone" dataKey="deltaHours" name="Marża godzinowa (utrzymanie - logi)" stroke="#f59e0b" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                              {burnUpSelectionRange && (
                                <ReferenceArea
                                  x1={burnUpSelectionRange.start}
                                  x2={burnUpSelectionRange.end}
                                  strokeOpacity={0}
                                  fill="rgba(217,70,239,0.14)"
                                />
                              )}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="mt-6 rounded-2xl border border-dashed border-fuchsia-200 bg-fuchsia-50/70 px-6 py-8 text-sm leading-7 text-fuchsia-700 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/10 dark:text-fuchsia-200">
                      Brak wystarczających danych do zbudowania wykresów utrzymania, logów i trendu. Wymagane są wpisy utrzymania z kwotą albo logi pracy oznaczone jako utrzymaniowe.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSettlementSection('settlement-table')}
                  className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 text-left dark:border-gray-800"
                >
                  <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Tabela rozliczeń</h4>
                  <ChevronDown size={18} className={`text-gray-400 transition-transform ${isSettlementSectionCollapsed('settlement-table') ? '-rotate-90' : 'rotate-0'}`} />
                </button>
                <div className={`grid grid-cols-1 gap-4 p-4 sm:p-5 ${isSettlementSectionCollapsed('settlement-table') ? 'hidden' : ''}`}>
                  {filteredSettlementRows.map((row) => (
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
                  <button
                    type="button"
                    onClick={() => toggleSettlementSection('settlement-profitability')}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Zyskowność projektu</h4>
                    <ChevronDown size={18} className={`text-gray-400 transition-transform ${isSettlementSectionCollapsed('settlement-profitability') ? '-rotate-90' : 'rotate-0'}`} />
                  </button>
                  <div className={`mt-4 space-y-4 ${isSettlementSectionCollapsed('settlement-profitability') ? 'hidden' : ''}`}>
                    {filteredProfitabilityRows.map((row) => (
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
                  <div className={`mt-5 rounded-2xl border p-4 ${filteredProfitabilityHours >= 0 ? 'border-emerald-100 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/20' : 'border-red-100 bg-red-50 dark:border-red-900/30 dark:bg-red-900/20'} ${isSettlementSectionCollapsed('settlement-profitability') ? 'hidden' : ''}`}>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Marża godzinowa</p>
                    <p className={`mt-2 text-3xl font-black ${filteredProfitabilityHours >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                      {filteredProfitabilityPct.toFixed(1)}%
                    </p>
                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                      {filteredProfitabilityHours >= 0
                        ? 'Dodatnia różnica oznacza, że zakontraktowano więcej godzin niż rzeczywiście przepracowano, więc projekt utrzymuje dodatnią zyskowność godzinową.'
                        : 'Ujemna różnica oznacza, że przepracowano więcej godzin niż zakontraktowano, więc projekt generuje stratę na godzinach.'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => toggleSettlementSection('settlement-authors')}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Osoby pracujące w projekcie</h4>
                    <ChevronDown size={18} className={`text-gray-400 transition-transform ${isSettlementSectionCollapsed('settlement-authors') ? '-rotate-90' : 'rotate-0'}`} />
                  </button>
                  <div className={`mt-5 space-y-4 ${isSettlementSectionCollapsed('settlement-authors') ? 'hidden' : ''}`}>
                    {filteredAuthorHours.length > 0 ? filteredAuthorHours.map((author) => {
                      const sharePct = filteredYoutrackTotal > 0 ? (author.hours / filteredYoutrackTotal) * 100 : 0;
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
                  <button
                    type="button"
                    onClick={() => toggleSettlementSection('settlement-status')}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Status zleceń</h4>
                    <ChevronDown size={18} className={`text-gray-400 transition-transform ${isSettlementSectionCollapsed('settlement-status') ? '-rotate-90' : 'rotate-0'}`} />
                  </button>
                  <div className={`mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 ${isSettlementSectionCollapsed('settlement-status') ? 'hidden' : ''}`}>
                    <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-900/20">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">W trakcie</p>
                      <p className="mt-2 text-3xl font-black text-amber-800 dark:text-amber-200">{filteredInProgressOrders.length}</p>
                      <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">Mają datę od, bez przekazania i bez odbioru</p>
                    </div>
                    <div className="rounded-2xl bg-sky-50 p-4 dark:bg-sky-900/20">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Po protokole przekazania</p>
                      <p className="mt-2 text-3xl font-black text-sky-800 dark:text-sky-200">{filteredHandedOverPendingOrders.length}</p>
                      <p className="mt-1 text-xs text-sky-700/80 dark:text-sky-300/80">Mają przekazanie, nadal bez odbioru</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-800/70">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">Anulowane</p>
                      <p className="mt-2 text-3xl font-black text-slate-800 dark:text-slate-100">{filteredCancelledOrders.length}</p>
                      <p className="mt-1 text-xs text-slate-600/80 dark:text-slate-300/80">Nie mają uzupełnionej żadnej daty</p>
                    </div>
                  </div>
                </div>

                <div className={`rounded-2xl border p-6 shadow-sm ${remainingInContract >= 0 ? 'border-fuchsia-100 bg-fuchsia-50 dark:border-fuchsia-900/30 dark:bg-fuchsia-900/20' : 'border-red-100 bg-red-50 dark:border-red-900/30 dark:bg-red-900/20'}`}>
                  <button
                    type="button"
                    onClick={() => toggleSettlementSection('settlement-conclusion')}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Wniosek</h4>
                    <ChevronDown size={18} className={`text-gray-400 transition-transform ${isSettlementSectionCollapsed('settlement-conclusion') ? '-rotate-90' : 'rotate-0'}`} />
                  </button>
                  <p className={`mt-4 text-2xl font-black ${remainingInContract >= 0 ? 'text-fuchsia-700 dark:text-fuchsia-300' : 'text-red-700 dark:text-red-300'} ${isSettlementSectionCollapsed('settlement-conclusion') ? 'hidden' : ''}`}>
                    {remainingInContract >= 0 ? 'Umowa mieści się w limicie' : 'Umowa jest przekroczona'}
                  </p>
                  <p className={`mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300 ${isSettlementSectionCollapsed('settlement-conclusion') ? 'hidden' : ''}`}>
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

        {activeTab === 'maintenance' && selectedProject.hasMaintenance && (
          <MaintenanceView project={selectedProject} />
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
  const [ppOrderId, setPpOrderId] = useState<string | null>(null);
  const [poOrderId, setPoOrderId] = useState<string | null>(null);

  if (!selectedProject) return null;

  const ppOrder = ppOrderId ? orders.find(order => order.id === ppOrderId) || null : null;
  const poOrder = poOrderId ? orders.find(order => order.id === poOrderId) || null : null;

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

  const handleSavePpFlow = async (orderId: string, flow: NonNullable<Order['ppFlow']>) => {
    await updateOrder(orderId, { ppFlow: flow });
  };

  const handleApplyPpHandoverDate = async (orderId: string, handoverDate: string) => {
    await updateOrder(orderId, { handoverDate });
  };

  const handleSavePoFlow = async (orderId: string, flow: NonNullable<Order['poFlow']>) => {
    await updateOrder(orderId, { poFlow: flow });
  };

  const handleApplyPoAcceptanceDate = async (orderId: string, acceptanceDate: string) => {
    await updateOrder(orderId, { acceptanceDate });
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
            <Briefcase className="text-indigo-500" /> Zlecenia
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
                    <tr key={order.id} className={`${getOrderRegistryRowClassName(order)} transition`}>
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
                        <button
                          type="button"
                          onClick={() => setPpOrderId(order.id)}
                          className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-lg transition mr-1 border border-indigo-100 dark:border-indigo-800/60"
                          title="Protokół Przekazania"
                          aria-label={`Protokół Przekazania dla zlecenia ${order.orderNumber}`}
                        >
                          PP
                        </button>
                        <button
                          type="button"
                          onClick={() => setPoOrderId(order.id)}
                          className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 rounded-lg transition mr-1 border border-emerald-100 dark:border-emerald-800/60"
                          title="Protokół Odbioru"
                          aria-label={`Protokół Odbioru dla zlecenia ${order.orderNumber}`}
                        >
                          PO
                        </button>
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
      <OrderProtocolFlowModal
        isOpen={Boolean(ppOrder)}
        order={ppOrder}
        onClose={() => setPpOrderId(null)}
        onSave={handleSavePpFlow}
        onApplyProtocolDate={handleApplyPpHandoverDate}
        protocolType="PP"
      />
      <OrderProtocolFlowModal
        isOpen={Boolean(poOrder)}
        order={poOrder}
        onClose={() => setPoOrderId(null)}
        onSave={handleSavePoFlow}
        onApplyProtocolDate={handleApplyPoAcceptanceDate}
        protocolType="PO"
      />
    </div>
  );
};

const OrderProtocolFlowModal = ({
  isOpen,
  order,
  onClose,
  onSave,
  onApplyProtocolDate,
  protocolType,
}: {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onSave: (orderId: string, flow: OrderProtocolFlow) => Promise<void>;
  onApplyProtocolDate: (orderId: string, protocolDate: string) => Promise<void>;
  protocolType: 'PP' | 'PO';
}) => {
  const { projects } = useProjectContext();
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftSteps, setDraftSteps] = useState(() => normalizeOrderProtocolFlow(getOrderFlowByType(order, protocolType)).steps);
  const [isSaving, setIsSaving] = useState(false);
  const [isVariablesSectionExpanded, setIsVariablesSectionExpanded] = useState(false);
  const [protocolDate, setProtocolDate] = useState('');
  const [isApplyingProtocolDate, setIsApplyingProtocolDate] = useState(false);
  const [emailTemplateData, setEmailTemplateData] = useState<OrderProtocolEmailTemplateData | OrderAcceptanceEmailTemplateData | null>(null);
  const [isEmailTemplateLoading, setIsEmailTemplateLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [customVariableDrafts, setCustomVariableDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen || !order) {
      setIsEditMode(false);
      setDraftSteps([]);
      setIsSaving(false);
      setIsVariablesSectionExpanded(false);
      setProtocolDate('');
      setIsApplyingProtocolDate(false);
      setEmailTemplateData(null);
      setIsEmailTemplateLoading(false);
      setCopiedField(null);
      setCustomVariableDrafts({});
      return;
    }

    setIsEditMode(false);
    setDraftSteps(normalizeOrderProtocolFlow(getOrderFlowByType(order, protocolType)).steps);
    setIsSaving(false);
    setIsVariablesSectionExpanded(false);
    setProtocolDate(suggestOrderProtocolDate(order, protocolType));
    setIsApplyingProtocolDate(false);
  }, [isOpen, order, protocolType]);

  useEffect(() => {
    if (!isOpen || !order) return;

    let isCancelled = false;

    const loadEmailTemplate = async () => {
      setIsEmailTemplateLoading(true);
      try {
        if (!window.electron) {
          if (!isCancelled) {
            const fallbackTemplateData = createOrderEmailTemplateData(order.projectId, protocolType);
            setEmailTemplateData(fallbackTemplateData);
            setCustomVariableDrafts(fallbackTemplateData.emailTemplate.variables || {});
          }
          return;
        }

        const savedTemplate = protocolType === 'PP'
          ? await window.electron.getOrderProtocolEmailTemplate?.(order.projectId)
          : await window.electron.getOrderAcceptanceEmailTemplate?.(order.projectId);
        if (!isCancelled) {
          const loadedTemplateData = createOrderEmailTemplateData(order.projectId, protocolType, savedTemplate);
          setEmailTemplateData(loadedTemplateData);
          setCustomVariableDrafts(loadedTemplateData.emailTemplate.variables || {});
        }
      } catch (error) {
        console.error(`Błąd pobierania szablonu e-mail ${protocolType}:`, error);
        if (!isCancelled) {
          const fallbackTemplateData = createOrderEmailTemplateData(order.projectId, protocolType);
          setEmailTemplateData(fallbackTemplateData);
          setCustomVariableDrafts(fallbackTemplateData.emailTemplate.variables || {});
        }
      } finally {
        if (!isCancelled) {
          setIsEmailTemplateLoading(false);
        }
      }
    };

    void loadEmailTemplate();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, order, protocolType]);

  useEffect(() => {
    if (!isOpen || !order || !emailTemplateData || isEmailTemplateLoading) return;
    const electronApi = window.electron;
    const saveTemplate = protocolType === 'PP'
      ? electronApi?.saveOrderProtocolEmailTemplate
      : electronApi?.saveOrderAcceptanceEmailTemplate;
    if (!saveTemplate) return;

    const timer = setTimeout(() => {
      void saveTemplate({
        projectId: order.projectId,
        data: {
          ...emailTemplateData,
          projectId: order.projectId,
          emailTemplate: {
            ...emailTemplateData.emailTemplate,
            variables: {
              ...(emailTemplateData.emailTemplate?.variables || {}),
              ...customVariableDrafts,
            },
          },
          lastModified: new Date().toISOString(),
        },
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [customVariableDrafts, emailTemplateData, isEmailTemplateLoading, isOpen, order, protocolType]);

  if (!isOpen || !order) return null;

  const project = projects.find((item) => item.id === order.projectId) || null;
  const projectEmailTemplate = emailTemplateData?.emailTemplate || createEmptyEmailTemplate();
  const customVariableValues = customVariableDrafts;
  const variableOverrides = {
    data: protocolDate || suggestOrderProtocolDate(order, protocolType),
    ...customVariableValues,
  };
  const availableVariables = getOrderProtocolVariableDefinitions(order, project, protocolType, variableOverrides)
    .slice()
    .sort((left, right) => left.token.localeCompare(right.token, 'pl', { sensitivity: 'base' }));
  const normalizedFlow = normalizeOrderProtocolFlow(getOrderFlowByType(order, protocolType));
  const persistedSteps = normalizedFlow.steps;
  const completedStepIds = normalizedFlow.completedStepIds;
  const stepsToRender = isEditMode ? draftSteps : persistedSteps;
  const protocolLabels = getOrderProtocolLabels(protocolType);
  const availableFunctions = [
    {
      signature: '{{slownie(wartosc_brutto)}}',
      description: 'Zamienia kwotę na polski zapis słowny z jednostkami zł i gr.',
    },
    {
      signature: '{{slownie(wartosc_netto)}}',
      description: 'Działa tak samo dla wartości netto zlecenia.',
    },
  ].slice().sort((left, right) => left.signature.localeCompare(right.signature, 'pl', { sensitivity: 'base' }));
  const knownVariableKeys = new Set(
    availableVariables.flatMap((variable) => [variable.token, ...(variable.aliases || [])]).map(item => normalizeTemplateVariableKey(item))
  );
  const customVariableFields = Array.from(
    new Map(
      [
        ...stepsToRender.flatMap((step) => [
          ...extractTemplateVariableReferences(step.description || ''),
          ...extractTemplateVariableReferences(step.linkLabel || ''),
          ...extractTemplateVariableReferences(step.linkUrl || ''),
        ]),
        ...extractTemplateVariableReferences(projectEmailTemplate.to || ''),
        ...extractTemplateVariableReferences(projectEmailTemplate.cc || ''),
        ...extractTemplateVariableReferences(projectEmailTemplate.subject || ''),
        ...extractTemplateVariableReferences(projectEmailTemplate.body || ''),
      ]
        .map((token) => token.trim())
        .filter(Boolean)
        .filter((token) => !knownVariableKeys.has(normalizeTemplateVariableKey(token)))
        .map((token) => [normalizeTemplateVariableKey(token), token])
    ).values()
  ).sort((left, right) => left.localeCompare(right, 'pl', { sensitivity: 'base' }));

  const handleOpenEditMode = () => {
    setDraftSteps((current) => {
      if (current.length > 0) {
        return current;
      }

      return persistedSteps.length > 0 ? persistedSteps : [createOrderProtocolStep()];
    });
    setIsEditMode(true);
  };

  const handleStepChange = (stepId: string, field: 'description' | 'linkUrl' | 'linkLabel', value: string) => {
    setDraftSteps(prev => prev.map(step => (
      step.id === stepId
        ? { ...step, [field]: value }
        : step
    )));
  };

  const handleAddStep = () => {
    setDraftSteps(prev => [...prev, createOrderProtocolStep()]);
  };

  const handleRemoveStep = (stepId: string) => {
    setDraftSteps(prev => prev.filter(step => step.id !== stepId));
  };

  const handleMoveStep = (stepId: string, direction: 'up' | 'down') => {
    setDraftSteps(prev => {
      const index = prev.findIndex(step => step.id === stepId);
      if (index < 0) return prev;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      const [movedStep] = next.splice(index, 1);
      next.splice(targetIndex, 0, movedStep);
      return next;
    });
  };

  const handleCancelEdit = () => {
    setDraftSteps(persistedSteps);
    setIsEditMode(false);
  };

  const handleSaveFlow = async () => {
    setIsSaving(true);
    try {
      const cleanedSteps = draftSteps
        .map(step => ({
          ...step,
          description: step.description.trim(),
          linkUrl: step.linkUrl?.trim() || '',
          linkLabel: step.linkLabel?.trim() || '',
        }))
        .filter(step => step.description || step.linkUrl || step.linkLabel);

      await onSave(order.id, {
        steps: cleanedSteps,
        completedStepIds: completedStepIds.filter(stepId => cleanedSteps.some(step => step.id === stepId)),
        updatedAt: new Date().toISOString(),
      });
      setIsEditMode(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenExternal = async (url: string) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    const normalizedUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;

    if (window.electron?.openExternal) {
      await window.electron.openExternal(normalizedUrl);
      return;
    }

    window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
  };

  const updateProjectEmailTemplate = (updates: Partial<EmailTemplate>) => {
    setEmailTemplateData(prev => createOrderEmailTemplateData(order.projectId, protocolType, {
      ...(prev || { projectId: order.projectId }),
      emailTemplate: {
        ...(prev?.emailTemplate || createEmptyEmailTemplate()),
        ...updates,
        variables: {
          ...(prev?.emailTemplate?.variables || {}),
          ...(updates.variables || {}),
        },
      },
      lastModified: new Date().toISOString(),
    }));
  };

  const handleCopyEmailField = async (text: string, id: string) => {
    await navigator.clipboard.writeText(resolveOrderProtocolTemplate(text, order, project, protocolType, variableOverrides));
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyTemplateSnippet = async (snippet: string, id: string) => {
    await navigator.clipboard.writeText(snippet);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  function handleCustomVariableChange(token: string, value: string) {
    setCustomVariableDrafts((current) => ({
      ...current,
      [token]: value,
    }));
  }

  const handleApplyProtocolDate = async () => {
    if (!protocolDate) {
      return;
    }

    setIsApplyingProtocolDate(true);
    try {
      await onApplyProtocolDate(order.id, protocolDate);
    } finally {
      setIsApplyingProtocolDate(false);
    }
  };

  const handleToggleStepCompleted = async (stepId: string, isCompleted: boolean) => {
    const nextCompletedStepIds = isCompleted
      ? [...new Set([...completedStepIds, stepId])]
      : completedStepIds.filter(id => id !== stepId);

    await onSave(order.id, {
      steps: persistedSteps,
      completedStepIds: nextCompletedStepIds,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-800">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Briefcase className="text-indigo-500" size={20} />
              {protocolType} dla zlecenia {order.orderNumber}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {order.title}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenEditMode}
              className={`p-2.5 rounded-xl border transition ${
                isEditMode
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                  : 'border-gray-200 bg-white text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-indigo-300 dark:hover:border-indigo-700'
              }`}
              title={`Edycja flow ${protocolLabels.protocolNameLower}`}
              aria-label={`Edytuj flow ${protocolLabels.protocolNameLower}`}
            >
              <Edit2 size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition"
              aria-label={`Zamknij modal ${protocolLabels.protocolNameLower}`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Data dla zmiennej <code>{`{{data}}`}</code></h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Ta data jest używana w krokach <code>{protocolType}</code>, w treści e-mail oraz w akcji uzupełnienia pola daty protokołu.
                  </p>
                </div>
                <div className="w-full md:w-64">
                  <input
                    type="date"
                    value={protocolDate}
                    onChange={(event) => setProtocolDate(event.target.value)}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
              </div>

              {customVariableFields.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Dodatkowe zmienne wykryte w flow</h3>
                  <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
                    Te pola pojawiają się automatycznie, gdy w krokach lub szablonie wpiszesz nową zmienną typu <code>{`{{twoja_zmienna}}`}</code>.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {customVariableFields.map((token) => (
                      <DynamicProtocolVariableField
                        key={token}
                        token={token}
                        value={customVariableValues[token] || ''}
                        onChange={handleCustomVariableChange}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-950/20 p-4">
            <button
              type="button"
              onClick={() => setIsVariablesSectionExpanded(current => !current)}
              className="w-full flex items-center justify-between gap-3 text-left"
              aria-expanded={isVariablesSectionExpanded}
            >
              <div>
                <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Dostępne zmienne i funkcje</h3>
                <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-1">
                  Rozwiń, gdy potrzebujesz sprawdzić listę tokenów i składnię funkcji szablonu.
                </p>
              </div>
              <ChevronDown size={18} className={`text-indigo-500 transition-transform ${isVariablesSectionExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isVariablesSectionExpanded && (
              <>
                <div className="flex flex-wrap gap-2 mt-4">
                  {availableVariables.map(variable => (
                    <button
                      type="button"
                      key={variable.token}
                      onClick={() => void handleCopyTemplateSnippet(`{{${variable.token}}}`, `token:${variable.token}`)}
                      className="group inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-gray-900 dark:text-indigo-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/30"
                      title={variable.value ? `Aktualna wartość: ${variable.value}. Kliknij, aby skopiować {{${variable.token}}}.` : `Kliknij, aby skopiować {{${variable.token}}}.`}
                    >
                      {`{{${variable.token}}}`}
                      {copiedField === `token:${variable.token}` ? (
                        <span className="text-[10px] font-bold text-emerald-500">Skopiowano</span>
                      ) : (
                        <Copy size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-indigo-200/80 bg-white/80 p-4 dark:border-indigo-900/60 dark:bg-gray-900/40">
                  <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">Dostępne funkcje</h4>
                  <div className="mt-3 space-y-2">
                    {availableFunctions.map((item) => (
                      <button
                        type="button"
                        key={item.signature}
                        onClick={() => void handleCopyTemplateSnippet(item.signature, `function:${item.signature}`)}
                        className="group flex w-full items-start justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-left transition hover:border-indigo-300 hover:bg-indigo-100/70 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/30"
                        title={`Kliknij, aby skopiować ${item.signature}`}
                      >
                        <div className="min-w-0">
                          <code className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">{item.signature}</code>
                          <p className="mt-1 text-xs text-indigo-700/80 dark:text-indigo-300/80">{item.description}</p>
                        </div>
                        <div className="shrink-0 pt-0.5 text-indigo-500 dark:text-indigo-300">
                          {copiedField === `function:${item.signature}` ? (
                            <span className="text-[10px] font-bold text-emerald-500">Skopiowano</span>
                          ) : (
                            <Copy size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-3">
                  Zmienne są podstawiane z pól formularza zlecenia oraz z bieżącej daty <code>{`{{data}}`}</code>. Funkcje możesz łączyć z dostępnymi tokenami wewnątrz nawiasów.
                </p>
              </>
            )}
          </section>

          {isEditMode ? (
            <section className="space-y-4">
              {draftSteps.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Flow nie ma jeszcze żadnych kroków. Dodaj pierwszy krok, aby zdefiniować proces <code>{protocolType}</code> dla tego zlecenia.
                </div>
              ) : (
                draftSteps.map((step, index) => (
                  <div key={step.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">Krok {index + 1}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Możesz dodać opis oraz opcjonalny link z etykietą.</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveStep(step.id, 'up')}
                          className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:text-gray-300 dark:hover:text-indigo-300 dark:hover:border-indigo-700 transition"
                          title="Przesuń krok wyżej"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveStep(step.id, 'down')}
                          className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:text-gray-300 dark:hover:text-indigo-300 dark:hover:border-indigo-700 transition"
                          title="Przesuń krok niżej"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(step.id)}
                          className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-600 hover:border-red-300 dark:text-gray-300 dark:hover:text-red-300 dark:hover:border-red-700 transition"
                          title="Usuń krok"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Etykieta linku</label>
                        <input
                          type="text"
                          value={step.linkLabel || ''}
                          onChange={(event) => handleStepChange(step.id, 'linkLabel', event.target.value)}
                          placeholder="np. SharePoint - nowy protokół"
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link</label>
                        <input
                          type="text"
                          value={step.linkUrl || ''}
                          onChange={(event) => handleStepChange(step.id, 'linkUrl', event.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Opis kroku</label>
                      <textarea
                        value={step.description}
                        onChange={(event) => handleStepChange(step.id, 'description', event.target.value)}
                        rows={4}
                        placeholder="Opisz czynność. Możesz używać zmiennych, np. {{nr}}, {{tytul}}, {{data}}."
                        className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                      />
                      {step.description && (
                        <div className="mt-2 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                          {renderResolvedTemplateWithHighlightedValues(step.description, order, project, protocolType)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              <button
                type="button"
                onClick={handleAddStep}
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 text-indigo-700 dark:border-indigo-700 dark:text-indigo-300 px-4 py-2.5 text-sm font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
              >
                <Plus size={16} />
                Dodaj krok
              </button>
            </section>
          ) : (
            <section className="space-y-4">
              {stepsToRender.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Brak zdefiniowanego flow {protocolType}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Użyj ikony edycji w prawym górnym rogu, aby dodać kroki dla {protocolLabels.protocolNameLower} tego zlecenia.
                  </p>
                </div>
              ) : (
                stepsToRender.map((step, index) => {
                  const resolvedDescription = resolveOrderProtocolTemplate(step.description || '', order, project, protocolType, variableOverrides);
                  const resolvedLinkLabel = resolveOrderProtocolTemplate(step.linkLabel || '', order, project, protocolType, variableOverrides);
                  const resolvedLinkUrl = resolveOrderProtocolTemplate(step.linkUrl || '', order, project, protocolType, variableOverrides);
                  const isCompleted = completedStepIds.includes(step.id);

                  return (
                    <div
                      key={step.id}
                      className={`rounded-2xl border bg-white dark:bg-gray-800/60 shadow-sm transition-all ${
                        isCompleted
                          ? 'border-emerald-200 dark:border-emerald-800/60 p-3'
                          : 'border-gray-200 dark:border-gray-700 p-5'
                      }`}
                    >
                      <div className={`flex gap-4 ${isCompleted ? 'items-center' : 'items-start'}`}>
                        <div className={`w-9 h-9 rounded-full text-white text-sm font-bold flex items-center justify-center shrink-0 ${isCompleted ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                          {index + 1}
                        </div>
                        <div className={`min-w-0 flex-1 ${isCompleted ? 'space-y-0' : 'space-y-3'}`}>
                          {!isCompleted && resolvedLinkUrl && (
                            <button
                              type="button"
                              onClick={() => void handleOpenExternal(resolvedLinkUrl)}
                              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition"
                            >
                              <ExternalLink size={15} />
                              <span className="truncate">{resolvedLinkLabel || 'Otwórz link'}</span>
                            </button>
                          )}
                          {isCompleted ? (
                            <div className="flex items-center gap-3 min-w-0">
                              <p className="text-sm leading-6 text-gray-600 dark:text-gray-300 truncate">
                                {resolvedDescription || 'Brak opisu kroku.'}
                              </p>
                              {resolvedLinkUrl && (
                                <button
                                  type="button"
                                  onClick={() => void handleOpenExternal(resolvedLinkUrl)}
                                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition"
                                >
                                  <ExternalLink size={12} />
                                  <span>{resolvedLinkLabel || 'Link'}</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm leading-6 text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                              {resolvedDescription ? renderResolvedTemplateWithHighlightedValues(step.description || '', order, project, protocolType, variableOverrides) : 'Brak opisu kroku.'}
                            </p>
                          )}
                        </div>
                        <label
                          className={`shrink-0 inline-flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                            isCompleted
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-emerald-300'
                              : 'bg-white border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 dark:hover:text-emerald-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20'
                          } ${isCompleted ? 'w-10 h-10' : 'w-10 h-10 mt-0.5'}`}
                          title="Wykonane"
                          aria-label={`Oznacz krok ${index + 1} jako wykonany`}
                        >
                          <input
                            type="checkbox"
                            checked={isCompleted}
                            onChange={(event) => void handleToggleStepCompleted(step.id, event.target.checked)}
                            className="sr-only"
                          />
                          <CheckCircle size={18} className={isCompleted ? '' : 'opacity-55'} />
                        </label>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          )}

          <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 mt-6">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-700 pb-4">
              <Mail className="text-indigo-500" size={18} />
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm">Szablon wiadomości E-mail</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Zapisywany w ramach projektu i podstawiany zmiennymi z bieżącego zlecenia.</p>
              </div>
            </div>

            {isEmailTemplateLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="animate-spin text-indigo-500 mr-2" size={18} />
                Wczytywanie szablonu e-mail...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'to', label: 'DO:', value: projectEmailTemplate.to || '' },
                    { id: 'cc', label: 'DW:', value: projectEmailTemplate.cc || '' },
                  ].map(field => (
                    <div key={field.id} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{field.label}</label>
                        <div className="flex items-center gap-2">
                          {copiedField === field.id && (
                            <span className="text-[10px] text-emerald-500 font-bold animate-in fade-in slide-in-from-right-1">Skopiowano!</span>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleCopyEmailField(field.value, field.id)}
                            className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                            title="Kopiuj z podstawieniem zmiennych"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={field.value}
                        onChange={event => updateProjectEmailTemplate({ [field.id]: event.target.value } as Partial<EmailTemplate>)}
                        className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-sm outline-none transition-shadow w-full dark:text-white"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Temat:</label>
                    <div className="flex items-center gap-2">
                      {copiedField === 'subject' && (
                        <span className="text-[10px] text-emerald-500 font-bold animate-in fade-in slide-in-from-right-1">Skopiowano!</span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCopyEmailField(projectEmailTemplate.subject || '', 'subject')}
                        className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                        title="Kopiuj z podstawieniem zmiennych"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={projectEmailTemplate.subject || ''}
                    onChange={event => updateProjectEmailTemplate({ subject: event.target.value })}
                    className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-sm outline-none transition-shadow font-medium w-full dark:text-white"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Treść wiadomości:</label>
                    <div className="flex items-center gap-2">
                      {copiedField === 'body' && (
                        <span className="text-[10px] text-emerald-500 font-bold animate-in fade-in slide-in-from-right-1">Skopiowano treść!</span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCopyEmailField(projectEmailTemplate.body || '', 'body')}
                        className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"
                        title="Kopiuj treść z podstawieniem zmiennych"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={projectEmailTemplate.body || ''}
                    onChange={event => updateProjectEmailTemplate({ body: event.target.value })}
                    rows={6}
                    className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm outline-none font-sans leading-relaxed resize-none transition-shadow w-full dark:text-white"
                  />
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Ostatni krok</p>
                <h3 className="mt-1 text-base font-semibold text-gray-900 dark:text-white">{protocolLabels.applySectionTitle}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Zapisze datę <strong>{protocolDate || '-'}</strong> do pola <code>{protocolLabels.orderDateFieldLabel}</code> w zleceniu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleApplyProtocolDate()}
                disabled={!protocolDate || isApplyingProtocolDate || getOrderProtocolDateValue(order, protocolType) === protocolDate}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isApplyingProtocolDate ? 'Zapisywanie daty...' : getOrderProtocolDateValue(order, protocolType) === protocolDate ? protocolLabels.currentDateCta : protocolLabels.applyDateCta}
              </button>
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3 shrink-0 bg-gray-50/70 dark:bg-gray-900/70 rounded-b-3xl">
          {isEditMode ? (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
                disabled={isSaving}
              >
                Anuluj edycję
              </button>
              <button
                type="button"
                onClick={() => void handleSaveFlow()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm disabled:opacity-60"
                disabled={isSaving}
              >
                {isSaving ? 'Zapisywanie...' : 'Zapisz flow'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
            >
              Zamknij
            </button>
          )}
        </div>
      </div>
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

const createOrderProtocolStep = (overrides?: {
  id?: string;
  description?: string;
  linkUrl?: string;
  linkLabel?: string;
}) => ({
  id: overrides?.id || createClientId(),
  description: overrides?.description || '',
  linkUrl: overrides?.linkUrl || '',
  linkLabel: overrides?.linkLabel || '',
});

const getOrderFlowByType = (order: Order | null | undefined, protocolType: 'PP' | 'PO') =>
  protocolType === 'PP' ? order?.ppFlow : order?.poFlow;

const getOrderProtocolDateValue = (order: Order, protocolType: 'PP' | 'PO') =>
  protocolType === 'PP' ? order.handoverDate || '' : order.acceptanceDate || '';

const getOrderProtocolLabels = (protocolType: 'PP' | 'PO') => (
  protocolType === 'PP'
    ? {
        protocolNameLower: 'protokołu przekazania',
        applySectionTitle: 'Uzupełnij datę przekazania',
        orderDateFieldLabel: 'Data przekazania',
        applyDateCta: 'Uzupełnij datę przekazania',
        currentDateCta: 'Data przekazania jest aktualna',
      }
    : {
        protocolNameLower: 'protokołu odbioru',
        applySectionTitle: 'Uzupełnij datę odbioru',
        orderDateFieldLabel: 'Data odbioru',
        applyDateCta: 'Uzupełnij datę odbioru',
        currentDateCta: 'Data odbioru jest aktualna',
      }
);

const normalizeOrderProtocolFlow = (flow?: OrderProtocolFlow | null) => ({
  steps: Array.isArray(flow?.steps)
    ? flow.steps.map(step => createOrderProtocolStep(step))
    : [],
  completedStepIds: Array.isArray(flow?.completedStepIds)
    ? flow.completedStepIds.filter((stepId): stepId is string => typeof stepId === 'string' && stepId.trim().length > 0)
    : [],
  updatedAt: flow?.updatedAt,
});

const createEmptyEmailTemplate = (): EmailTemplate => ({
  to: '',
  cc: '',
  subject: '',
  body: '',
  variables: {},
});

const createOrderProtocolEmailTemplateData = (
  projectId: string,
  template?: Partial<OrderProtocolEmailTemplateData> | null,
): OrderProtocolEmailTemplateData => ({
  projectId,
  emailTemplate: {
    ...createEmptyEmailTemplate(),
    ...(template?.emailTemplate || {}),
    variables: {
      ...createEmptyEmailTemplate().variables,
      ...(template?.emailTemplate?.variables || {}),
    },
  },
  lastModified: template?.lastModified || new Date().toISOString(),
});

const createOrderAcceptanceEmailTemplateData = (
  projectId: string,
  template?: Partial<OrderAcceptanceEmailTemplateData> | null,
): OrderAcceptanceEmailTemplateData => ({
  projectId,
  emailTemplate: {
    ...createEmptyEmailTemplate(),
    ...(template?.emailTemplate || {}),
    variables: {
      ...createEmptyEmailTemplate().variables,
      ...(template?.emailTemplate?.variables || {}),
    },
  },
  lastModified: template?.lastModified || new Date().toISOString(),
});

const createOrderEmailTemplateData = (
  projectId: string,
  protocolType: 'PP' | 'PO',
  template?: Partial<OrderProtocolEmailTemplateData> | Partial<OrderAcceptanceEmailTemplateData> | null,
) => (
  protocolType === 'PP'
    ? createOrderProtocolEmailTemplateData(projectId, template as Partial<OrderProtocolEmailTemplateData> | null)
    : createOrderAcceptanceEmailTemplateData(projectId, template as Partial<OrderAcceptanceEmailTemplateData> | null)
);

const createMaintenanceSettlementEmailTemplateData = (
  projectId: string,
  template?: Partial<MaintenanceSettlementEmailTemplateData> | null,
): MaintenanceSettlementEmailTemplateData => ({
  projectId,
  emailTemplate: {
    ...createEmptyEmailTemplate(),
    ...(template?.emailTemplate || {}),
    variables: {
      ...createEmptyEmailTemplate().variables,
      ...(template?.emailTemplate?.variables || {}),
    },
  },
  lastModified: template?.lastModified || new Date().toISOString(),
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
const formatNullableNumber = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';
const toCalendarDateString = (value?: string) => {
  if (!value) return '';
  return value.includes('T') ? value.split('T')[0] : value;
};
const normalizeTemplateVariableKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const suggestOrderProtocolDate = (order: Order, protocolType: 'PP' | 'PO' = 'PP') =>
  getOrderProtocolDateValue(order, protocolType)
  || order.scheduleTo
  || order.scheduleFrom
  || format(new Date(), 'yyyy-MM-dd');

const getOrderProtocolVariableDefinitions = (
  order: Order,
  project: Project | null | undefined,
  protocolType: 'PP' | 'PO' = 'PP',
  overrides?: Partial<Record<string, string>>,
) => {
  const totalHours = order.items.reduce((sum, item) => sum + (Number(item.hours) || 0), 0);
  const productNames = order.items.map(item => item.name.trim()).filter(Boolean);
  const resolvedDate = overrides?.data || suggestOrderProtocolDate(order, protocolType);
  const totalNetValue = totalHours * (project?.rateNetto || 0);
  const totalGrossValue = totalHours * (project?.rateBrutto || 0);
  const totalNetValueWords = formatCurrencyAmountInWords(formatCurrencyValue(totalNetValue));
  const totalGrossValueWords = formatCurrencyAmountInWords(formatCurrencyValue(totalGrossValue));
  const taskTypeNames = (project?.taskTypes || []).map(taskType => taskType.name.trim()).filter(Boolean);
  const stakeholderNames = (project?.stakeholders || []).map(stakeholder => stakeholder.name.trim()).filter(Boolean);
  const stakeholderDetails = (project?.stakeholders || [])
    .map(stakeholder => [stakeholder.name, stakeholder.role].filter(Boolean).join(' - ').trim())
    .filter(Boolean);

  return [
    { token: 'projekt_id', aliases: ['projectId'], value: project?.id || order.projectId || '' },
    { token: 'kod_projektu', aliases: ['projectCode', 'code'], value: project?.code || '' },
    { token: 'nazwa_projektu', aliases: ['projectName', 'name'], value: project?.name || '' },
    { token: 'nr_umowy', aliases: ['contractNo', 'contractNumber'], value: project?.contractNo || '' },
    { token: 'przedmiot_umowy', aliases: ['contractSubject'], value: project?.contractSubject || '' },
    { token: 'projekt_data_od', aliases: ['projectDateFrom'], value: project?.dateFrom || '' },
    { token: 'projekt_data_do', aliases: ['projectDateTo'], value: project?.dateTo || '' },
    { token: 'min_godzin', aliases: ['projectMinHours', 'minHours'], value: formatNullableNumber(project?.minHours) },
    { token: 'max_godzin', aliases: ['projectMaxHours', 'maxHours'], value: formatNullableNumber(project?.maxHours) },
    { token: 'stawka_netto', aliases: ['projectRateNetto', 'rateNetto'], value: formatNullableNumber(project?.rateNetto) },
    { token: 'stawka_brutto', aliases: ['projectRateBrutto', 'rateBrutto'], value: formatNullableNumber(project?.rateBrutto) },
    { token: 'stawka_vat', aliases: ['projectVatRate', 'vatRate'], value: formatNullableNumber(project?.vatRate) },
    { token: 'czy_utrzymanie', aliases: ['hasMaintenance'], value: project ? (project.hasMaintenance ? 'TAK' : 'NIE') : '' },
    { token: 'utrzymanie_kwota_netto', aliases: ['maintenanceNetAmount'], value: formatNullableNumber(project?.maintenanceNetAmount) },
    { token: 'utrzymanie_stawka_vat', aliases: ['maintenanceVatRate'], value: formatNullableNumber(project?.maintenanceVatRate) },
    { token: 'utrzymanie_kwota_brutto', aliases: ['maintenanceGrossAmount'], value: formatNullableNumber(project?.maintenanceGrossAmount) },
    { token: 'cel_marzy_proc', aliases: ['targetProfitPct', 'targetProfitPercent'], value: formatNullableNumber(project?.targetProfitPct) },
    { token: 'youtrack_query', aliases: ['youtrackQuery'], value: project?.youtrackQuery || '' },
    { token: 'google_doc_link', aliases: ['googleDocLink'], value: project?.googleDocLink || '' },
    { token: 'typy_zadan', aliases: ['taskTypes', 'taskTypeNames'], value: taskTypeNames.join(', ') },
    { token: 'liczba_typow_zadan', aliases: ['taskTypesCount'], value: String(taskTypeNames.length) },
    { token: 'interesariusze', aliases: ['stakeholders', 'stakeholderNames'], value: stakeholderNames.join(', ') },
    { token: 'interesariusze_szczegoly', aliases: ['stakeholderDetails'], value: stakeholderDetails.join(', ') },
    { token: 'liczba_interesariuszy', aliases: ['stakeholdersCount'], value: String((project?.stakeholders || []).length) },
    { token: 'nr', aliases: ['orderNumber', 'numer'], value: order.orderNumber || '' },
    { token: 'tytul', aliases: ['tytuł', 'title'], value: order.title || '' },
    { token: 'priorytet', aliases: ['priority'], value: order.priority || '' },
    { token: 'opis_problemu', aliases: ['problemDescription', 'opisproblemu'], value: order.problemDescription || '' },
    { token: 'stan_oczekiwany', aliases: ['expectedStateDescription', 'opisstanuoczekiwanego'], value: order.expectedStateDescription || '' },
    { token: 'lokalizacja', aliases: ['location'], value: order.location || '' },
    { token: 'metodyka_wymagana', aliases: ['methodologyRequired'], value: order.methodologyRequired ? 'TAK' : 'NIE' },
    { token: 'zakres_metodyki', aliases: ['methodologyScope'], value: order.methodologyScope || '' },
    { token: 'data_realizacji_od', aliases: ['scheduleFrom'], value: order.scheduleFrom || '' },
    { token: 'data_realizacji_do', aliases: ['scheduleTo'], value: order.scheduleTo || '' },
    { token: 'data_przekazania', aliases: ['handoverDate'], value: order.handoverDate || '' },
    { token: 'data_odbioru', aliases: ['acceptanceDate'], value: order.acceptanceDate || '' },
    { token: 'system_modul', aliases: ['systemModule', 'modul'], value: order.systemModule || '' },
    { token: 'uwagi', aliases: ['notes'], value: order.notes || '' },
    { token: 'data_utworzenia', aliases: ['createdAt'], value: toCalendarDateString(order.createdAt) },
    { token: 'data', aliases: ['dzis', 'today'], value: resolvedDate },
    { token: 'produkty', aliases: ['items'], value: productNames.join(', ') },
    { token: 'liczba_pozycji', aliases: ['itemsCount'], value: String(order.items.length) },
    { token: 'suma_godzin', aliases: ['totalHours'], value: formatOrderHours(totalHours) },
    { token: 'wartosc_netto', aliases: ['netValue', 'orderNetValue'], value: formatCurrencyValue(totalNetValue) },
    { token: 'wartosc_brutto', aliases: ['grossValue', 'orderGrossValue'], value: formatCurrencyValue(totalGrossValue) },
    { token: 'wartosc_netto_slownie', aliases: ['netValueWords', 'orderNetValueWords'], value: totalNetValueWords },
    { token: 'wartosc_brutto_slownie', aliases: ['grossValueWords', 'orderGrossValueWords'], value: totalGrossValueWords },
  ];
};

const getMaintenanceSettlementVariableDefinitions = (
  entry: MaintenanceEntry,
  project: Project,
  overrides?: Partial<Record<string, string>>,
) => {
  const [yearValue, monthValue] = entry.month.split('-');
  const year = Number(yearValue);
  const monthIndex = Number(monthValue);
  const monthDate = year && monthIndex ? new Date(year, monthIndex - 1, 1) : null;
  const monthStart = monthDate ? format(monthDate, 'yyyy-MM-dd') : '';
  const monthEnd = monthDate ? format(new Date(year, monthIndex, 0), 'yyyy-MM-dd') : '';
  const settlementDate = overrides?.data
    || monthEnd
    || format(new Date(), 'yyyy-MM-dd');

  return [
    { token: 'kod_projektu', aliases: ['projectCode'], value: project.code || '' },
    { token: 'nazwa_projektu', aliases: ['projectName'], value: project.name || '' },
    { token: 'nr_umowy', aliases: ['contractNo'], value: project.contractNo || '' },
    { token: 'miesiac', aliases: ['month'], value: entry.month || '' },
    { token: 'miesiac_nazwa', aliases: ['monthName'], value: monthDate ? formatMaintenanceMonth(entry.month) : entry.month || '' },
    { token: 'poczatek_miesiaca', aliases: ['monthStart', 'startOfMonth'], value: monthStart },
    { token: 'koniec_miesiaca', aliases: ['monthEnd', 'endOfMonth'], value: monthEnd },
    { token: 'rok', aliases: ['year'], value: yearValue || '' },
    { token: 'kwota_netto', aliases: ['netAmount'], value: formatCurrencyValue(Number(entry.netAmount) || 0) },
    { token: 'stawka_vat', aliases: ['vatRate'], value: (Number(entry.vatRate) || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    { token: 'kwota_brutto', aliases: ['grossAmount'], value: formatCurrencyValue(Number(entry.grossAmount) || 0) },
    { token: 'uwagi', aliases: ['notes'], value: entry.notes || '' },
    { token: 'data_utworzenia', aliases: ['createdAt'], value: toCalendarDateString(entry.createdAt) },
    { token: 'data_aktualizacji', aliases: ['updatedAt'], value: toCalendarDateString(entry.updatedAt) },
    { token: 'data', aliases: ['settlementDate', 'today'], value: settlementDate },
  ];
};

const buildOrderProtocolVariableMap = (
  order: Order,
  project: Project | null | undefined,
  protocolType: 'PP' | 'PO' = 'PP',
  overrides?: Partial<Record<string, string>>,
) => {
  const map: Record<string, string> = {};

  getOrderProtocolVariableDefinitions(order, project, protocolType, overrides).forEach(({ token, aliases, value }) => {
    [token, ...(aliases || [])].forEach(alias => {
      map[normalizeTemplateVariableKey(alias)] = value;
    });
  });

  Object.entries(overrides || {}).forEach(([token, value]) => {
    const normalizedToken = normalizeTemplateVariableKey(token);
    if (normalizedToken) {
      map[normalizedToken] = String(value ?? '');
    }
  });

  return map;
};

const buildMaintenanceSettlementVariableMap = (
  entry: MaintenanceEntry,
  project: Project,
  overrides?: Partial<Record<string, string>>,
) => {
  const map: Record<string, string> = {};

  getMaintenanceSettlementVariableDefinitions(entry, project, overrides).forEach(({ token, aliases, value }) => {
    [token, ...(aliases || [])].forEach(alias => {
      map[normalizeTemplateVariableKey(alias)] = value;
    });
  });

  Object.entries(overrides || {}).forEach(([token, value]) => {
    const normalizedToken = normalizeTemplateVariableKey(token);
    if (normalizedToken) {
      map[normalizedToken] = String(value ?? '');
    }
  });

  return map;
};

const POLISH_NUMBER_UNITS = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
const POLISH_NUMBER_TEENS = ['dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
const POLISH_NUMBER_TENS = ['', 'dziesięć', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
const POLISH_NUMBER_HUNDREDS = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];
const POLISH_NUMBER_GROUPS: [string, string, string][] = [
  ['', '', ''],
  ['tysiąc', 'tysiące', 'tysięcy'],
  ['milion', 'miliony', 'milionów'],
  ['miliard', 'miliardy', 'miliardów'],
];

const getPolishPluralForm = (value: number, forms: [string, string, string]) => {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (value === 1) return forms[0];
  if (mod100 >= 12 && mod100 <= 14) return forms[2];
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 10 && mod100 <= 19)) return forms[1];
  return forms[2];
};

const convertTripletToPolishWords = (value: number) => {
  if (value === 0) return '';

  const hundreds = Math.floor(value / 100);
  const tensUnits = value % 100;
  const tens = Math.floor(tensUnits / 10);
  const units = tensUnits % 10;
  const parts: string[] = [];

  if (hundreds > 0) {
    parts.push(POLISH_NUMBER_HUNDREDS[hundreds]);
  }

  if (tensUnits >= 10 && tensUnits < 20) {
    parts.push(POLISH_NUMBER_TEENS[tensUnits - 10]);
  } else {
    if (tens > 0) {
      parts.push(POLISH_NUMBER_TENS[tens]);
    }
    if (units > 0) {
      parts.push(POLISH_NUMBER_UNITS[units]);
    }
  }

  return parts.join(' ').trim();
};

const convertIntegerToPolishWords = (value: number) => {
  if (!Number.isFinite(value) || value === 0) return 'zero';

  const parts: string[] = [];
  let remaining = Math.floor(Math.abs(value));
  let groupIndex = 0;

  while (remaining > 0) {
    const triplet = remaining % 1000;
    if (triplet > 0) {
      const groupForms = POLISH_NUMBER_GROUPS[groupIndex] || ['', '', ''];
      const words = convertTripletToPolishWords(triplet);

      if (groupIndex === 1 && triplet === 1) {
        parts.unshift(groupForms[0]);
      } else {
        const groupWord = groupForms[0] ? getPolishPluralForm(triplet, groupForms) : '';
        parts.unshift([words, groupWord].filter(Boolean).join(' ').trim());
      }
    }

    remaining = Math.floor(remaining / 1000);
    groupIndex += 1;
  }

  const normalized = parts.filter(Boolean).join(' ').trim();
  return value < 0 ? `minus ${normalized}` : normalized;
};

const normalizeCurrencyStringToNumber = (value: string) => {
  const normalized = value.replace(/\s/g, '').replace(/\u00a0/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCurrencyAmountInWords = (value: string) => {
  const numericValue = normalizeCurrencyStringToNumber(value);
  if (numericValue === null) return '';

  const absoluteValue = Math.abs(numericValue);
  const zlotyValue = Math.floor(absoluteValue);
  const groszValue = Math.round((absoluteValue - zlotyValue) * 100);
  const carryToZloty = groszValue === 100 ? 1 : 0;
  const normalizedZlotyValue = zlotyValue + carryToZloty;
  const normalizedGroszValue = carryToZloty ? 0 : groszValue;
  const zlotyWords = convertIntegerToPolishWords(normalizedZlotyValue);
  const zlotyLabel = getPolishPluralForm(normalizedZlotyValue, ['złoty', 'złote', 'złotych']);
  const groszLabel = getPolishPluralForm(normalizedGroszValue, ['grosz', 'grosze', 'groszy']);
  const amountInWords = `${zlotyWords} ${zlotyLabel} ${String(normalizedGroszValue).padStart(2, '0')}/100 ${groszLabel}`;

  return numericValue < 0 ? `minus ${amountInWords}` : amountInWords;
};

const unwrapTemplateExpression = (value: string) => {
  const trimmedValue = value.trim();
  const wrappedMatch = trimmedValue.match(/^\{\{\s*(.+?)\s*\}\}$/);
  return wrappedMatch ? wrappedMatch[1].trim() : trimmedValue;
};

const isUnresolvedTemplateValue = (value: string) => /^\{\{.+\}\}$/.test(value.trim());

const extractTemplateVariableReferences = (template: string) => {
  const references: string[] = [];
  const matches = template.matchAll(/{{\s*([^}]+)\s*}}/g);

  for (const match of matches) {
    const expression = unwrapTemplateExpression(match[1] || '');
    const functionMatch = expression.match(/^slownie\s*\((.*)\)$/i);
    if (functionMatch) {
      const nestedExpression = unwrapTemplateExpression(functionMatch[1] || '');
      if (nestedExpression) {
        references.push(...extractTemplateVariableReferences(`{{${nestedExpression}}}`));
      }
      continue;
    }

    if (expression) {
      references.push(expression);
    }
  }

  return references;
};

const resolveTemplateExpression = (rawExpression: string, variableMap: Record<string, string>) => {
  const expression = String(rawExpression).trim();
  const functionMatch = expression.match(/^slownie\s*\((.*)\)$/i);

  if (functionMatch) {
    const argumentExpression = unwrapTemplateExpression(functionMatch[1]);
    const normalizedArgument = normalizeTemplateVariableKey(argumentExpression);
    const directArgumentValue = Object.prototype.hasOwnProperty.call(variableMap, normalizedArgument)
      ? variableMap[normalizedArgument]
      : argumentExpression;
    const recursivelyResolvedArgument = resolveTemplateExpression(argumentExpression, variableMap);
    const argumentValue = isUnresolvedTemplateValue(recursivelyResolvedArgument)
      ? directArgumentValue
      : recursivelyResolvedArgument;
    const amountInWords = formatCurrencyAmountInWords(argumentValue);
    return amountInWords || `{{${expression}}}`;
  }

  const normalizedToken = normalizeTemplateVariableKey(expression);
  return Object.prototype.hasOwnProperty.call(variableMap, normalizedToken)
    ? variableMap[normalizedToken]
    : `{{${expression}}}`;
};

const resolveTemplateFunctions = (template: string, variableMap: Record<string, string>) =>
  template.replace(/{{\s*(slownie\s*\((?:[^()]|\([^()]*\))*\))\s*}}/gi, (_match, rawExpression) =>
    resolveTemplateExpression(String(rawExpression), variableMap)
  );

const resolveOrderProtocolTemplate = (
  template: string,
  order: Order,
  project: Project | null | undefined,
  protocolType: 'PP' | 'PO' = 'PP',
  overrides?: Partial<Record<string, string>>,
) => {
  const variableMap = buildOrderProtocolVariableMap(order, project, protocolType, overrides);
  const templateWithResolvedFunctions = resolveTemplateFunctions(template, variableMap);
  return templateWithResolvedFunctions.replace(/{{\s*([^{}]+?)\s*}}/g, (_match, rawToken) => resolveTemplateExpression(rawToken, variableMap));
};

const ResolvedTemplateToken = ({
  resolvedValue,
}: {
  resolvedValue: string;
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(resolvedValue);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="group inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-bold text-gray-900 transition hover:bg-indigo-100/80 hover:font-extrabold dark:text-white dark:hover:bg-indigo-900/30"
      title={`Kliknij, aby skopiować ${resolvedValue}`}
    >
      <span>{resolvedValue}</span>
      {isCopied ? (
        <span className="text-[10px] font-bold text-emerald-500">Skopiowano</span>
      ) : (
        <Copy size={11} className="opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
};

const DynamicProtocolVariableField = ({
  token,
  value,
  onChange,
}: {
  token: string;
  value: string;
  onChange: (token: string, value: string) => void;
}) => {
  return (
    <div className="relative z-20 block pointer-events-auto">
      <label
        htmlFor={`dynamic-protocol-variable-${token}`}
        className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-200"
      >
        {`{{${token}}}`}
      </label>
      <input
        id={`dynamic-protocol-variable-${token}`}
        type="text"
        value={value}
        onChange={(event) => onChange(token, event.target.value)}
        placeholder={`Wpisz wartość dla {{${token}}}`}
        autoComplete="off"
        spellCheck={false}
        className="relative z-20 block w-full pointer-events-auto rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-amber-400 dark:border-amber-900/60 dark:bg-gray-900 dark:text-white dark:focus:ring-amber-500"
      />
    </div>
  );
};

const renderResolvedTemplateWithHighlightedValues = (
  template: string,
  order: Order,
  project: Project | null | undefined,
  protocolType: 'PP' | 'PO' = 'PP',
  overrides?: Partial<Record<string, string>>,
) => {
  const variableMap = buildOrderProtocolVariableMap(order, project, protocolType, overrides);
  const segments = template.split(/(\{\{[^}]+\}\})/g);

  return segments.map((segment, index) => {
    const match = segment.match(/^\{\{\s*([^}]+)\s*\}\}$/);
    if (match) {
      const resolvedValue = resolveTemplateExpression(match[1], variableMap);

      return (
        <ResolvedTemplateToken key={`${segment}-${index}`} resolvedValue={resolvedValue} />
      );
    }

    return <React.Fragment key={`${segment}-${index}`}>{segment}</React.Fragment>;
  });
};

const normalizeMaintenanceSettlementFlow = (flow?: MaintenanceEntry['settlementFlow'] | null): OrderProtocolFlow => ({
  steps: Array.isArray(flow?.steps)
    ? flow.steps.map(step => createOrderProtocolStep(step))
    : [],
  completedStepIds: Array.isArray(flow?.completedStepIds)
    ? flow.completedStepIds.filter((stepId): stepId is string => typeof stepId === 'string' && stepId.trim().length > 0)
    : [],
  updatedAt: flow?.updatedAt,
});

const resolveMaintenanceSettlementTemplate = (
  template: string,
  entry: MaintenanceEntry,
  project: Project,
  overrides?: Partial<Record<string, string>>,
) => {
  const variableMap = buildMaintenanceSettlementVariableMap(entry, project, overrides);
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_match, rawToken) => {
    const normalizedToken = normalizeTemplateVariableKey(rawToken);
    return Object.prototype.hasOwnProperty.call(variableMap, normalizedToken)
      ? variableMap[normalizedToken]
      : `{{${String(rawToken).trim()}}}`;
  });
};

const renderResolvedMaintenanceSettlementTemplate = (
  template: string,
  entry: MaintenanceEntry,
  project: Project,
  overrides?: Partial<Record<string, string>>,
) => {
  const variableMap = buildMaintenanceSettlementVariableMap(entry, project, overrides);
  const segments = template.split(/(\{\{[^}]+\}\})/g);

  return segments.map((segment, index) => {
    const match = segment.match(/^\{\{\s*([^}]+)\s*\}\}$/);
    if (match) {
      const resolvedValue = resolveTemplateExpression(match[1], variableMap);

      return (
        <ResolvedTemplateToken key={`${segment}-${index}`} resolvedValue={resolvedValue} />
      );
    }

    return <React.Fragment key={`${segment}-${index}`}>{segment}</React.Fragment>;
  });
};

const parseCalendarDate = (value?: string) => {
  if (!value?.trim()) return null;
  const normalizedValue = value.includes('T') ? value : `${value}T00:00:00`;
  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

const MaintenanceView = ({ project }: { project: Project }) => {
  const [entries, setEntries] = useState<MaintenanceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MaintenanceEntry | null>(null);
  const [settlementEntryId, setSettlementEntryId] = useState<string | null>(null);

  const loadEntries = async () => {
    if (!window.electron) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electron.getMaintenanceEntries(project.id);
      setEntries(result);
    } catch (err: any) {
      setError(err.message || 'Nie udało się pobrać wpisów utrzymania.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadEntries();
  }, [project.id]);

  const openCreateModal = () => {
      setEditingEntry(null);
      setIsModalOpen(true);
  };

  const openEditModal = (entry: MaintenanceEntry) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  const handleSave = async (entry: MaintenanceEntry) => {
    if (!window.electron) return;

    await window.electron.saveMaintenanceEntry(entry);
    setIsModalOpen(false);
    setEditingEntry(null);
    await loadEntries();
  };

  const handleDelete = async (entryId: string) => {
    if (!window.electron) return;
    if (!window.confirm('Czy na pewno chcesz usunąć ten wpis utrzymania?')) {
      return;
    }

    await window.electron.deleteMaintenanceEntry(entryId);
    if (editingEntry?.id === entryId) {
      setEditingEntry(null);
      setIsModalOpen(false);
    }
    await loadEntries();
  };

  const handleSaveSettlementFlow = async (entryId: string, flow: OrderProtocolFlow) => {
    const entry = entries.find((item) => item.id === entryId);
    if (!window.electron || !entry) return;

    await window.electron.saveMaintenanceEntry({
      ...entry,
      settlementFlow: flow,
      updatedAt: new Date().toISOString(),
    });

    await loadEntries();
  };

  const totalNet = entries.reduce((sum, entry) => sum + entry.netAmount, 0);
  const totalGross = entries.reduce((sum, entry) => sum + entry.grossAmount, 0);
  const settlementEntry = entries.find((entry) => entry.id === settlementEntryId) || null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
            <DollarSign className="text-indigo-500" /> Utrzymanie
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ewidencja miesięcy rozliczanych w ramach opłaty utrzymaniowej dla projektu: {project.code}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm"
        >
          <Plus size={16} /> Dodaj miesiąc
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Miesięcy</p>
          <p className="mt-3 text-3xl font-black text-gray-900 dark:text-white">{entries.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Suma netto</p>
          <p className="mt-3 text-3xl font-black text-gray-900 dark:text-white">{formatCurrencyValue(totalNet)} zł</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Suma brutto</p>
          <p className="mt-3 text-3xl font-black text-gray-900 dark:text-white">{formatCurrencyValue(totalGross)} zł</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900/50 rounded-full flex items-center justify-center mb-4">
              <DollarSign size={28} className="text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Brak wpisów utrzymania</h3>
            <p className="text-gray-500 dark:text-gray-400">Dodaj pierwszy miesiąc rozliczeniowy dla opłaty utrzymaniowej.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">Miesiąc</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Netto</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">VAT</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Brutto</th>
                  <th className="px-6 py-4">Uwagi</th>
                  <th className="px-6 py-4 text-center">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                      {formatMaintenanceMonth(entry.month)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap text-gray-700 dark:text-gray-200">
                      {formatCurrencyValue(entry.netAmount)} zł
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap text-gray-500 dark:text-gray-400">
                      {entry.vatRate.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap font-medium text-indigo-600 dark:text-indigo-400">
                      {formatCurrencyValue(entry.grossAmount)} zł
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {entry.notes?.trim() ? entry.notes : <span className="text-gray-400 dark:text-gray-500">Brak uwag</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSettlementEntryId(entry.id)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition"
                          title="Rozliczenie miesiąca"
                          aria-label={`Rozliczenie miesiąca ${formatMaintenanceMonth(entry.month)}`}
                        >
                          <FileText size={16} />
                        </button>
                        <button onClick={() => openEditModal(entry)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => void handleDelete(entry.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition">
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MaintenanceEntryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEntry(null);
        }}
        project={project}
        entryToEdit={editingEntry}
        onSave={handleSave}
        onDelete={handleDelete}
      />
      <MaintenanceSettlementFlowModal
        isOpen={Boolean(settlementEntry)}
        entry={settlementEntry}
        project={project}
        onClose={() => setSettlementEntryId(null)}
        onSave={handleSaveSettlementFlow}
      />
    </div>
  );
};

const MaintenanceEntryModal = ({
  isOpen,
  onClose,
  project,
  entryToEdit,
  onSave,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  entryToEdit: MaintenanceEntry | null;
  onSave: (entry: MaintenanceEntry) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
}) => {
  const [formData, setFormData] = useState<MaintenanceEntry>(() => createMaintenanceDraft(project));
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (entryToEdit) {
      setFormData(entryToEdit);
      return;
    }
      setFormData(createMaintenanceDraft(project));
  }, [entryToEdit, isOpen, project.id]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = event.target;
    const nextValue = type === 'number' ? parseFloat(value) || 0 : value;

    setFormData((prev) => {
      const updated = { ...prev, [name]: nextValue, updatedAt: new Date().toISOString() };

      if (name === 'netAmount' || name === 'vatRate') {
        updated.grossAmount = calculateGrossFromNet(
          name === 'netAmount' ? Number(nextValue) : prev.netAmount,
          name === 'vatRate' ? Number(nextValue) : prev.vatRate,
        );
      } else if (name === 'grossAmount') {
        updated.netAmount = calculateNetFromGross(Number(nextValue), prev.vatRate);
      }

      return updated;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!formData.month) {
      setError('Wybierz miesiąc rozliczeniowy.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        ...formData,
        projectId: project.id,
        notes: formData.notes?.trim() || '',
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd zapisu wpisu utrzymania.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-left">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[95vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {entryToEdit ? 'Edytuj wpis utrzymania' : 'Dodaj miesiąc utrzymania'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Miesiąc *</label>
                <input
                  required
                  type="month"
                  name="month"
                  value={formData.month}
                  onChange={handleChange}
                  onKeyDown={handleDateInputTabNavigation}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-100">
                <p className="font-semibold">Projekt</p>
                <p className="mt-1">{project.code} · {project.name}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kwota netto</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="netAmount"
                  value={formData.netAmount}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">VAT (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="vatRate"
                  value={formData.vatRate}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kwota brutto</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="grossAmount"
                  value={formData.grossAmount}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Uwagi</label>
              <textarea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={5}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-y"
                placeholder="Opcjonalny opis, np. zakres abonamentu, numer faktury, uwagi rozliczeniowe..."
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between gap-3 shrink-0">
            <div>
              {entryToEdit && (
                <button
                  type="button"
                  onClick={() => void onDelete(entryToEdit.id)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  Usuń wpis
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                Anuluj
              </button>
              <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition flex items-center justify-center min-w-[140px]">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (entryToEdit ? 'Zapisz zmiany' : 'Dodaj wpis')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const MaintenanceSettlementFlowModal = ({
  isOpen,
  entry,
  project,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  entry: MaintenanceEntry | null;
  project: Project;
  onClose: () => void;
  onSave: (entryId: string, flow: OrderProtocolFlow) => Promise<void>;
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftSteps, setDraftSteps] = useState(() => normalizeMaintenanceSettlementFlow(entry?.settlementFlow).steps);
  const [isSaving, setIsSaving] = useState(false);
  const [isVariablesSectionExpanded, setIsVariablesSectionExpanded] = useState(false);
  const [emailTemplateData, setEmailTemplateData] = useState<MaintenanceSettlementEmailTemplateData | null>(null);
  const [isEmailTemplateLoading, setIsEmailTemplateLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !entry) {
      setIsEditMode(false);
      setDraftSteps([]);
      setIsSaving(false);
      setIsVariablesSectionExpanded(false);
      setEmailTemplateData(null);
      setIsEmailTemplateLoading(false);
      setCopiedField(null);
      return;
    }

    setIsEditMode(false);
    setDraftSteps(normalizeMaintenanceSettlementFlow(entry.settlementFlow).steps);
    setIsSaving(false);
    setIsVariablesSectionExpanded(false);
    setCopiedField(null);
  }, [entry, isOpen]);

  useEffect(() => {
    if (!isOpen || !entry) return;

    let isCancelled = false;

    const loadEmailTemplate = async () => {
      setIsEmailTemplateLoading(true);
      try {
        if (!window.electron?.getMaintenanceSettlementEmailTemplate) {
          if (!isCancelled) {
            setEmailTemplateData(createMaintenanceSettlementEmailTemplateData(project.id));
          }
          return;
        }

        const savedTemplate = await window.electron.getMaintenanceSettlementEmailTemplate(project.id);
        if (!isCancelled) {
          setEmailTemplateData(createMaintenanceSettlementEmailTemplateData(project.id, savedTemplate));
        }
      } catch (error) {
        console.error('Błąd pobierania szablonu e-mail rozliczenia miesiąca:', error);
        if (!isCancelled) {
          setEmailTemplateData(createMaintenanceSettlementEmailTemplateData(project.id));
        }
      } finally {
        if (!isCancelled) {
          setIsEmailTemplateLoading(false);
        }
      }
    };

    void loadEmailTemplate();

    return () => {
      isCancelled = true;
    };
  }, [entry, isOpen, project.id]);

  useEffect(() => {
    if (!isOpen || !entry || !emailTemplateData || isEmailTemplateLoading) return;
    const electronApi = window.electron;
    if (!electronApi?.saveMaintenanceSettlementEmailTemplate) return;

    const timer = setTimeout(() => {
      void electronApi.saveMaintenanceSettlementEmailTemplate({
        projectId: project.id,
        data: {
          ...emailTemplateData,
          projectId: project.id,
          lastModified: new Date().toISOString(),
        },
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [emailTemplateData, entry, isEmailTemplateLoading, isOpen, project.id]);

  if (!isOpen || !entry) return null;

  const normalizedFlow = normalizeMaintenanceSettlementFlow(entry.settlementFlow);
  const persistedSteps = normalizedFlow.steps || [];
  const completedStepIds = normalizedFlow.completedStepIds || [];
  const stepsToRender = isEditMode ? draftSteps : persistedSteps;
  const projectEmailTemplate = emailTemplateData?.emailTemplate || createEmptyEmailTemplate();
  const availableVariables = getMaintenanceSettlementVariableDefinitions(entry, project);

  const handleOpenEditMode = () => {
    setDraftSteps((current) => {
      if (current.length > 0) {
        return current;
      }

      return persistedSteps.length > 0 ? persistedSteps : [createOrderProtocolStep()];
    });
    setIsEditMode(true);
  };

  const handleStepChange = (stepId: string, field: 'description' | 'linkUrl' | 'linkLabel', value: string) => {
    setDraftSteps(prev => prev.map(step => (
      step.id === stepId
        ? { ...step, [field]: value }
        : step
    )));
  };

  const handleAddStep = () => {
    setDraftSteps(prev => [...prev, createOrderProtocolStep()]);
  };

  const handleRemoveStep = (stepId: string) => {
    setDraftSteps(prev => prev.filter(step => step.id !== stepId));
  };

  const handleMoveStep = (stepId: string, direction: 'up' | 'down') => {
    setDraftSteps(prev => {
      const index = prev.findIndex(step => step.id === stepId);
      if (index < 0) return prev;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      const [movedStep] = next.splice(index, 1);
      next.splice(targetIndex, 0, movedStep);
      return next;
    });
  };

  const handleCancelEdit = () => {
    setDraftSteps(persistedSteps);
    setIsEditMode(false);
  };

  const handleSaveFlow = async () => {
    setIsSaving(true);
    try {
      const cleanedSteps = draftSteps
        .map(step => ({
          ...step,
          description: step.description.trim(),
          linkUrl: step.linkUrl?.trim() || '',
          linkLabel: step.linkLabel?.trim() || '',
        }))
        .filter(step => step.description || step.linkUrl || step.linkLabel);

      await onSave(entry.id, {
        steps: cleanedSteps,
        completedStepIds: completedStepIds.filter(stepId => cleanedSteps.some(step => step.id === stepId)),
        updatedAt: new Date().toISOString(),
      });
      setIsEditMode(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStepCompleted = async (stepId: string, isCompleted: boolean) => {
    const nextCompletedStepIds = isCompleted
      ? [...new Set([...completedStepIds, stepId])]
      : completedStepIds.filter(id => id !== stepId);

    await onSave(entry.id, {
      steps: persistedSteps,
      completedStepIds: nextCompletedStepIds,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleOpenExternal = async (url: string) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    const normalizedUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;

    if (window.electron?.openExternal) {
      await window.electron.openExternal(normalizedUrl);
      return;
    }

    window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
  };

  const updateProjectEmailTemplate = (updates: Partial<EmailTemplate>) => {
    setEmailTemplateData(prev => createMaintenanceSettlementEmailTemplateData(project.id, {
      ...(prev || {}),
      emailTemplate: {
        ...(prev?.emailTemplate || createEmptyEmailTemplate()),
        ...updates,
      },
      lastModified: new Date().toISOString(),
    }));
  };

  const handleCopyEmailField = async (value: string, fieldId: string) => {
    const resolvedValue = resolveMaintenanceSettlementTemplate(value, entry, project);
    try {
      await navigator.clipboard.writeText(resolvedValue);
      setCopiedField(fieldId);
      window.setTimeout(() => setCopiedField(current => (current === fieldId ? null : current)), 1500);
    } catch (error) {
      console.error('Błąd kopiowania pola e-mail rozliczenia miesiąca:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-800">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="text-indigo-500" size={20} />
              Rozliczenie miesiąca {formatMaintenanceMonth(entry.month)}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {project.code} · {project.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenEditMode}
              className={`p-2.5 rounded-xl border transition ${
                isEditMode
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                  : 'border-gray-200 bg-white text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-indigo-300 dark:hover:border-indigo-700'
              }`}
              title="Edycja flow rozliczenia miesiąca"
              aria-label="Edytuj flow rozliczenia miesiąca"
            >
              <Edit2 size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-white"
              aria-label="Zamknij modal rozliczenia miesiąca"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="rounded-2xl border border-indigo-100 bg-indigo-50/70 dark:border-indigo-900/40 dark:bg-indigo-950/20 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300">Miesiąc</p>
                <p className="mt-2 text-base font-black text-gray-900 dark:text-white">{formatMaintenanceMonth(entry.month)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300">Netto</p>
                <p className="mt-2 text-base font-black text-gray-900 dark:text-white">{formatCurrencyValue(entry.netAmount)} zł</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300">VAT</p>
                <p className="mt-2 text-base font-black text-gray-900 dark:text-white">{entry.vatRate.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300">Brutto</p>
                <p className="mt-2 text-base font-black text-gray-900 dark:text-white">{formatCurrencyValue(entry.grossAmount)} zł</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setIsVariablesSectionExpanded(prev => !prev)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm">Zmienne</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Zmiennych możesz używać w krokach flow i w szablonie wiadomości e-mail.
                </p>
              </div>
              <ChevronDown size={18} className={`text-gray-400 transition-transform ${isVariablesSectionExpanded ? 'rotate-180' : ''}`} />
            </button>

            {isVariablesSectionExpanded && (
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                {availableVariables.map((variable) => (
                  <div key={variable.token} className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">{`{{${variable.token}}}`}</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white break-words">{variable.value || 'brak wartości'}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {isEditMode ? (
            <section className="space-y-4">
              {draftSteps.map((step, index) => (
                <div key={step.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Krok rozliczenia</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleMoveStep(step.id, 'up')}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:text-gray-300 dark:hover:text-indigo-300 dark:hover:border-indigo-700 transition"
                        title="Przesuń krok wyżej"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStep(step.id, 'down')}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:text-gray-300 dark:hover:text-indigo-300 dark:hover:border-indigo-700 transition"
                        title="Przesuń krok niżej"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(step.id)}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-600 hover:border-red-300 dark:text-gray-300 dark:hover:text-red-300 dark:hover:border-red-700 transition"
                        title="Usuń krok"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Etykieta linku</label>
                      <input
                        type="text"
                        value={step.linkLabel || ''}
                        onChange={(event) => handleStepChange(step.id, 'linkLabel', event.target.value)}
                        placeholder="np. Dokument rozliczenia w SharePoint"
                        className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link</label>
                      <input
                        type="text"
                        value={step.linkUrl || ''}
                        onChange={(event) => handleStepChange(step.id, 'linkUrl', event.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Opis kroku</label>
                    <textarea
                      value={step.description}
                      onChange={(event) => handleStepChange(step.id, 'description', event.target.value)}
                      rows={4}
                      placeholder="Opisz czynność. Możesz używać zmiennych, np. {{miesiac_nazwa}}, {{kwota_brutto}}, {{data}}."
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                    />
                    {step.description && (
                      <div className="mt-2 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                        {renderResolvedMaintenanceSettlementTemplate(step.description, entry, project)}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddStep}
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 text-indigo-700 dark:border-indigo-700 dark:text-indigo-300 px-4 py-2.5 text-sm font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
              >
                <Plus size={16} />
                Dodaj krok
              </button>
            </section>
          ) : (
            <section className="space-y-4">
              {stepsToRender.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Brak zdefiniowanego flow rozliczenia miesiąca</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Użyj ikony edycji w prawym górnym rogu, aby dodać kroki dla wybranego miesiąca utrzymania.
                  </p>
                </div>
              ) : (
                stepsToRender.map((step, index) => {
                  const resolvedDescription = resolveMaintenanceSettlementTemplate(step.description || '', entry, project);
                  const resolvedLinkLabel = resolveMaintenanceSettlementTemplate(step.linkLabel || '', entry, project);
                  const resolvedLinkUrl = resolveMaintenanceSettlementTemplate(step.linkUrl || '', entry, project);
                  const isCompleted = completedStepIds.includes(step.id);

                  return (
                    <div
                      key={step.id}
                      className={`rounded-2xl border bg-white dark:bg-gray-800/60 shadow-sm transition-all ${
                        isCompleted
                          ? 'border-emerald-200 dark:border-emerald-800/60 p-3'
                          : 'border-gray-200 dark:border-gray-700 p-5'
                      }`}
                    >
                      <div className={`flex gap-4 ${isCompleted ? 'items-center' : 'items-start'}`}>
                        <div className={`w-9 h-9 rounded-full text-white text-sm font-bold flex items-center justify-center shrink-0 ${isCompleted ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                          {index + 1}
                        </div>
                        <div className={`min-w-0 flex-1 ${isCompleted ? 'space-y-0' : 'space-y-3'}`}>
                          {!isCompleted && resolvedLinkUrl && (
                            <button
                              type="button"
                              onClick={() => void handleOpenExternal(resolvedLinkUrl)}
                              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition"
                            >
                              <ExternalLink size={15} />
                              <span className="truncate">{resolvedLinkLabel || 'Otwórz link'}</span>
                            </button>
                          )}
                          {isCompleted ? (
                            <div className="flex items-center gap-3 min-w-0">
                              <p className="text-sm leading-6 text-gray-600 dark:text-gray-300 truncate">
                                {resolvedDescription || 'Brak opisu kroku.'}
                              </p>
                              {resolvedLinkUrl && (
                                <button
                                  type="button"
                                  onClick={() => void handleOpenExternal(resolvedLinkUrl)}
                                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition"
                                >
                                  <ExternalLink size={12} />
                                  <span>{resolvedLinkLabel || 'Link'}</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm leading-6 text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                              {resolvedDescription ? renderResolvedMaintenanceSettlementTemplate(step.description || '', entry, project) : 'Brak opisu kroku.'}
                            </p>
                          )}
                        </div>
                        <label
                          className={`shrink-0 inline-flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                            isCompleted
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-emerald-300'
                              : 'bg-white border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 dark:hover:text-emerald-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20'
                          } ${isCompleted ? 'w-10 h-10' : 'w-10 h-10 mt-0.5'}`}
                          title="Wykonane"
                          aria-label={`Oznacz krok ${index + 1} jako wykonany`}
                        >
                          <input
                            type="checkbox"
                            checked={isCompleted}
                            onChange={(event) => void handleToggleStepCompleted(step.id, event.target.checked)}
                            className="sr-only"
                          />
                          <CheckCircle size={18} className={isCompleted ? '' : 'opacity-55'} />
                        </label>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          )}

          <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-700 pb-4">
              <Mail className="text-indigo-500" size={18} />
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm">Szablon wiadomości E-mail</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Zapisywany w ramach projektu i podstawiany zmiennymi z bieżącego miesiąca utrzymania.</p>
              </div>
            </div>

            {isEmailTemplateLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="animate-spin text-indigo-500 mr-2" size={18} />
                Wczytywanie szablonu e-mail...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'to', label: 'DO:', value: projectEmailTemplate.to || '' },
                    { id: 'cc', label: 'DW:', value: projectEmailTemplate.cc || '' },
                  ].map(field => (
                    <div key={field.id} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{field.label}</label>
                        <div className="flex items-center gap-2">
                          {copiedField === field.id && (
                            <span className="text-[10px] text-emerald-500 font-bold animate-in fade-in slide-in-from-right-1">Skopiowano!</span>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleCopyEmailField(field.value, field.id)}
                            className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                            title="Kopiuj z podstawieniem zmiennych"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={field.value}
                        onChange={event => updateProjectEmailTemplate({ [field.id]: event.target.value } as Partial<EmailTemplate>)}
                        className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-sm outline-none transition-shadow w-full dark:text-white"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Temat:</label>
                    <div className="flex items-center gap-2">
                      {copiedField === 'subject' && (
                        <span className="text-[10px] text-emerald-500 font-bold animate-in fade-in slide-in-from-right-1">Skopiowano!</span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCopyEmailField(projectEmailTemplate.subject || '', 'subject')}
                        className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                        title="Kopiuj z podstawieniem zmiennych"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={projectEmailTemplate.subject || ''}
                    onChange={event => updateProjectEmailTemplate({ subject: event.target.value })}
                    className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-sm outline-none transition-shadow font-medium w-full dark:text-white"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Treść wiadomości:</label>
                    <div className="flex items-center gap-2">
                      {copiedField === 'body' && (
                        <span className="text-[10px] text-emerald-500 font-bold animate-in fade-in slide-in-from-right-1">Skopiowano treść!</span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCopyEmailField(projectEmailTemplate.body || '', 'body')}
                        className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"
                        title="Kopiuj treść z podstawieniem zmiennych"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={projectEmailTemplate.body || ''}
                    onChange={event => updateProjectEmailTemplate({ body: event.target.value })}
                    rows={6}
                    className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm outline-none font-sans leading-relaxed resize-none transition-shadow w-full dark:text-white"
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3 shrink-0 bg-gray-50/70 dark:bg-gray-900/70 rounded-b-3xl">
          {isEditMode ? (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
                disabled={isSaving}
              >
                Anuluj edycję
              </button>
              <button
                type="button"
                onClick={() => void handleSaveFlow()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm disabled:opacity-60"
                disabled={isSaving}
              >
                {isSaving ? 'Zapisywanie...' : 'Zapisz flow'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
            >
              Zamknij
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
const getDateKey = (date: Date) => format(date, 'yyyy-MM-dd');
const getComparableDateKey = (value?: string) => {
  const date = parseCalendarDate(value);
  return date ? getDateKey(date) : null;
};
const getOrderRegistryRowClassName = (order: Order) => {
  const todayKey = getDateKey(new Date());
  const scheduleToKey = getComparableDateKey(order.scheduleTo);
  const handoverDateKey = getComparableDateKey(order.handoverDate);
  const acceptanceDateKey = getComparableDateKey(order.acceptanceDate);

  if (handoverDateKey === todayKey && !acceptanceDateKey) {
    return 'bg-amber-300/70 dark:bg-amber-700/45 hover:bg-amber-300 dark:hover:bg-amber-700/60';
  }

  if (handoverDateKey && handoverDateKey < todayKey && !acceptanceDateKey) {
    return 'bg-sky-300/70 dark:bg-sky-700/45 hover:bg-sky-300 dark:hover:bg-sky-700/60';
  }

  if (scheduleToKey && scheduleToKey < todayKey && !handoverDateKey) {
    return 'bg-red-300/70 dark:bg-red-700/45 hover:bg-red-300 dark:hover:bg-red-700/60';
  }

  if (scheduleToKey && scheduleToKey > todayKey) {
    return 'bg-emerald-300/70 dark:bg-emerald-700/45 hover:bg-emerald-300 dark:hover:bg-emerald-700/60';
  }

  return 'hover:bg-gray-50 dark:hover:bg-gray-800/50';
};
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
const doesDateOverlapRange = (
  date: string,
  range: { start: string; end: string } | null,
) => {
  if (!range) return true;
  return date >= range.start && date <= range.end;
};
const doesMaintenanceEntryOverlapRange = (
  month: string,
  range: { start: string; end: string } | null,
) => {
  if (!range) return true;
  if (!month?.trim()) return false;

  const [yearValue, monthValue] = month.split('-');
  const year = Number(yearValue);
  const monthIndex = Number(monthValue);
  if (!year || !monthIndex || monthIndex < 1 || monthIndex > 12) {
    return false;
  }

  const monthStart = getDateKey(new Date(year, monthIndex - 1, 1));
  const monthEnd = getDateKey(new Date(year, monthIndex, 0));
  return monthStart <= range.end && monthEnd >= range.start;
};
const getOrderDistributionRange = (order: Order, fallbackEndDate: Date) => {
  const timelineRange = getOrderTimelineRange(order, fallbackEndDate);
  if (timelineRange) {
    return timelineRange;
  }

  const candidateDates = [
    parseCalendarDate(order.scheduleFrom),
    parseCalendarDate(order.scheduleTo),
    parseCalendarDate(order.handoverDate),
    parseCalendarDate(order.acceptanceDate),
  ].filter((date): date is Date => Boolean(date));

  if (candidateDates.length === 0) {
    return null;
  }

  return {
    startDate: getMinDate(candidateDates),
    endDate: getMaxDate(candidateDates),
  };
};
const getDateRangeOverlapRatio = (
  sourceRange: { startDate: Date; endDate: Date },
  filterRange: { start: string; end: string },
) => {
  const filterStart = parseCalendarDate(filterRange.start);
  const filterEnd = parseCalendarDate(filterRange.end);
  if (!filterStart || !filterEnd) {
    return 0;
  }

  const overlapStart = sourceRange.startDate.getTime() > filterStart.getTime()
    ? sourceRange.startDate
    : filterStart;
  const overlapEnd = sourceRange.endDate.getTime() < filterEnd.getTime()
    ? sourceRange.endDate
    : filterEnd;

  if (overlapStart.getTime() > overlapEnd.getTime()) {
    return 0;
  }

  const sourceDays = getDaysDiffInclusive(sourceRange.startDate, sourceRange.endDate);
  const overlapDays = getDaysDiffInclusive(overlapStart, overlapEnd);
  return overlapDays / sourceDays;
};
const getFilteredOrderForRange = (
  order: Order,
  range: { start: string; end: string } | null,
  fallbackEndDate: Date,
) => {
  if (!range) {
    return order;
  }

  const datedItems = order.items.filter((item) => item.date && item.date.trim().length > 0);
  if (datedItems.length > 0) {
    const filteredItems = datedItems.filter((item) => doesDateOverlapRange(item.date, range));
    if (filteredItems.length === 0) {
      return null;
    }

    return {
      ...order,
      items: filteredItems,
    };
  }

  const distributionRange = getOrderDistributionRange(order, fallbackEndDate);
  if (!distributionRange) {
    return null;
  }

  const overlapRatio = getDateRangeOverlapRatio(distributionRange, range);
  if (overlapRatio <= 0) {
    return null;
  }

  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      hours: Number(((Number(item.hours) || 0) * overlapRatio).toFixed(4)),
    })),
  };
};
const getOrderTimelineEndDate = (order: Order, fallbackEndDate: Date) =>
  parseCalendarDate(order.scheduleTo)
  || parseCalendarDate(order.acceptanceDate)
  || parseCalendarDate(order.handoverDate)
  || fallbackEndDate;
const getOrderTimelineRange = (order: Order, fallbackEndDate: Date) => {
  const scheduleFrom = parseCalendarDate(order.scheduleFrom);
  const candidateEndDates = [
    parseCalendarDate(order.scheduleTo),
    parseCalendarDate(order.acceptanceDate),
    parseCalendarDate(order.handoverDate),
  ].filter((date): date is Date => Boolean(date));
  const fallbackEnd = candidateEndDates[0] || fallbackEndDate;
  const computedEnd = getOrderTimelineEndDate(order, fallbackEnd);

  if (!scheduleFrom || !computedEnd) {
    return null;
  }

  if (scheduleFrom.getTime() <= computedEnd.getTime()) {
    return {
      startDate: scheduleFrom,
      endDate: computedEnd,
    };
  }

  const normalizedStartDate = candidateEndDates.length > 0
    ? getMinDate([...candidateEndDates, scheduleFrom])
    : scheduleFrom;
  const normalizedEndDate = getMaxDate([scheduleFrom, computedEnd]);

  return {
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
  };
};
const getOrderAnalysisRange = (order: Order) => {
  const candidateDates = [
    parseCalendarDate(order.scheduleFrom),
    parseCalendarDate(order.scheduleTo),
    parseCalendarDate(order.handoverDate),
    parseCalendarDate(order.acceptanceDate),
    ...order.items
      .map((item) => parseCalendarDate(item.date))
      .filter((date): date is Date => Boolean(date)),
    parseCalendarDate(order.createdAt),
  ].filter((date): date is Date => Boolean(date));

  if (candidateDates.length === 0) {
    return null;
  }

  return {
    startDate: getMinDate(candidateDates),
    endDate: getMaxDate(candidateDates),
  };
};
const doesOrderOverlapRange = (
  order: Order,
  range: { start: string; end: string } | null,
  fallbackEndDate: Date,
) => {
  if (!range) return true;

  const timelineRange = getOrderAnalysisRange(order) || getOrderTimelineRange(order, fallbackEndDate);
  if (!timelineRange) {
    return false;
  }

  const orderStart = getDateKey(timelineRange.startDate);
  const orderEnd = getDateKey(timelineRange.endDate);
  return orderStart <= range.end && orderEnd >= range.start;
};

type BurnUpTrendPoint = {
  date: string;
  shortLabel: string;
  dailyEstimate: number;
  dailyEstimateOrderNumbers: string[];
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
}: {
  orders: Order[];
  workItems: Array<{ date: string; minutes: number }>;
}) => {
  const today = parseCalendarDate(format(new Date(), 'yyyy-MM-dd')) || new Date();
  const relevantOrders = orders
    .map((order) => {
      const timelineRange = getOrderTimelineRange(order, today);
      const totalHours = getOrderHoursTotal(order);

      if (!timelineRange || totalHours <= 0) {
        return null;
      }

      return {
        orderNumber: order.orderNumber,
        startDate: timelineRange.startDate,
        endDate: timelineRange.endDate,
        totalHours,
      };
    })
    .filter((order): order is { orderNumber: string; startDate: Date; endDate: Date; totalHours: number } => Boolean(order));

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
  const dailyEstimateOrderNumbersMap = new Map<string, Set<string>>();
  const dailyActualMap = new Map<string, number>();

  relevantOrders.forEach((order) => {
    const durationDays = getDaysDiffInclusive(order.startDate, order.endDate);
    const dailyEstimate = order.totalHours / durationDays;
    for (let offset = 0; offset < durationDays; offset += 1) {
      const dateKey = getDateKey(addDays(order.startDate, offset));
      dailyEstimateMap.set(dateKey, (dailyEstimateMap.get(dateKey) || 0) + dailyEstimate);
      const existingOrderNumbers = dailyEstimateOrderNumbersMap.get(dateKey) || new Set<string>();
      existingOrderNumbers.add(order.orderNumber);
      dailyEstimateOrderNumbersMap.set(dateKey, existingOrderNumbers);
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
    const dailyEstimateOrderNumbers = Array.from(dailyEstimateOrderNumbersMap.get(dateKey) || []).sort((a, b) => a.localeCompare(b, 'pl'));
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
      dailyEstimateOrderNumbers,
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

const alignBurnUpTrendDataToRange = (
  points: BurnUpTrendPoint[],
  range: { start: string; end: string } | null,
) => {
  if (!range || points.length === 0) {
    return points;
  }

  const rangeStart = parseCalendarDate(range.start);
  const rangeEnd = parseCalendarDate(range.end);

  if (!rangeStart || !rangeEnd) {
    return points;
  }

  const pointsByDate = new Map(points.map((point) => [point.date, point]));
  const normalizedPoints: BurnUpTrendPoint[] = [];
  let previousPoint: BurnUpTrendPoint | null = null;

  for (
    let cursor = new Date(rangeStart);
    cursor.getTime() <= rangeEnd.getTime();
    cursor = addDays(cursor, 1)
  ) {
    const dateKey = getDateKey(cursor);
    const existingPoint = pointsByDate.get(dateKey);

    if (existingPoint) {
      normalizedPoints.push(existingPoint);
      previousPoint = existingPoint;
      continue;
    }

    const cumulativeEstimate = previousPoint?.cumulativeEstimate || 0;
    const cumulativeActual = previousPoint?.cumulativeActual || 0;
    const deltaHours = cumulativeEstimate - cumulativeActual;
    const minBandBase = Math.min(cumulativeEstimate, cumulativeActual);

    normalizedPoints.push({
      date: dateKey,
      shortLabel: format(cursor, 'dd.MM'),
      dailyEstimate: 0,
      dailyEstimateOrderNumbers: [],
      dailyActual: 0,
      cumulativeEstimate,
      cumulativeActual,
      deltaHours,
      deltaPct: cumulativeActual > 0 ? (deltaHours / cumulativeActual) * 100 : null,
      trendRatio: previousPoint?.trendRatio ?? null,
      rollingTrendRatio: previousPoint?.rollingTrendRatio ?? null,
      regressionTrendRatio: previousPoint?.regressionTrendRatio ?? null,
      favorableBase: minBandBase,
      favorableGap: Math.max(cumulativeEstimate - cumulativeActual, 0),
      overrunBase: minBandBase,
      overrunGap: Math.max(cumulativeActual - cumulativeEstimate, 0),
    });
  }

  return normalizedPoints;
};

const summarizeBurnUpTrendData = (points: BurnUpTrendPoint[]) => {
  const firstPoint = points[0] || null;
  const latestPoint = points[points.length - 1] || null;
  const latestTrendPoint = [...points]
    .reverse()
    .find((point) => point.trendRatio !== null || point.rollingTrendRatio !== null) || null;
  const estimateCeiling = latestPoint?.cumulativeEstimate || 0;
  const actualCeiling = latestPoint?.cumulativeActual || 0;
  const deltaHours = latestPoint?.deltaHours || 0;
  const marginChange = firstPoint && latestPoint
    ? latestPoint.deltaHours - firstPoint.deltaHours
    : null;
  const trendRatio = latestTrendPoint?.trendRatio ?? null;
  const rollingTrendRatio = latestTrendPoint?.rollingTrendRatio ?? null;
  const trendTone = deltaHours >= 0
    ? 'text-emerald-700 dark:text-emerald-300'
    : 'text-red-700 dark:text-red-300';
  const marginChangeTone = marginChange === null
    ? 'text-slate-600 dark:text-slate-300'
    : marginChange > 0
      ? 'text-emerald-700 dark:text-emerald-300'
      : marginChange < 0
        ? 'text-red-700 dark:text-red-300'
        : 'text-slate-600 dark:text-slate-300';
  const marginDirectionLabel = marginChange === null
    ? 'Brak zmiany marży'
    : marginChange > 0
      ? 'Marża rośnie'
      : marginChange < 0
        ? 'Marża maleje'
        : 'Marża stabilna';
  const trendBadgeTone = trendRatio === null
    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300'
    : trendRatio >= 1
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  const hoursValues = points.flatMap((point) => [
    point.cumulativeEstimate,
    point.cumulativeActual,
  ]);
  const hoursMin = hoursValues.length > 0 ? Math.min(...hoursValues) : 0;
  const hoursMax = hoursValues.length > 0 ? Math.max(...hoursValues) : 0;
  const hoursPadding = hoursMin === hoursMax
    ? Math.max(Math.abs(hoursMax) * 0.03, 1)
    : Math.max((hoursMax - hoursMin) * 0.04, 0.5);
  const hoursDomain: [number, number] = [hoursMin - hoursPadding, hoursMax + hoursPadding];
  const marginValues = points.map((point) => point.deltaHours);
  const marginMin = marginValues.length > 0 ? Math.min(...marginValues) : 0;
  const marginMax = marginValues.length > 0 ? Math.max(...marginValues) : 0;
  const marginPadding = marginMin === marginMax
    ? Math.max(Math.abs(marginMax) * 0.03, 1)
    : Math.max((marginMax - marginMin) * 0.04, 0.5);
  const marginDomain: [number, number] = [marginMin - marginPadding, marginMax + marginPadding];

  return {
    estimateCeiling,
    actualCeiling,
    deltaHours,
    marginChange,
    trendRatio,
    rollingTrendRatio,
    trendTone,
    marginChangeTone,
    marginDirectionLabel,
    trendBadgeTone,
    hoursDomain,
    marginDomain,
    shouldShowMarginZeroLine: marginDomain[0] <= 0 && marginDomain[1] >= 0,
  };
};

const getMaintenanceMonthRange = (month: string) => {
  if (!month?.trim()) return null;

  const [yearValue, monthValue] = month.split('-');
  const year = Number(yearValue);
  const monthIndex = Number(monthValue);
  if (!year || !monthIndex || monthIndex < 1 || monthIndex > 12) {
    return null;
  }

  return {
    startDate: new Date(year, monthIndex - 1, 1),
    endDate: new Date(year, monthIndex, 0),
  };
};

const buildMaintenanceBurnUpTrendData = ({
  maintenanceEntries,
  workItems,
  rateNetto,
}: {
  maintenanceEntries: MaintenanceEntry[];
  workItems: Array<{ date: string; minutes: number }>;
  rateNetto: number;
}) => {
  if (rateNetto <= 0) {
    return [] as BurnUpTrendPoint[];
  }

  const today = parseCalendarDate(format(new Date(), 'yyyy-MM-dd')) || new Date();
  const relevantEntries = maintenanceEntries
    .map((entry) => {
      const monthRange = getMaintenanceMonthRange(entry.month);
      const totalHours = (entry.netAmount || 0) / rateNetto;

      if (!monthRange || totalHours <= 0) {
        return null;
      }

      return {
        periodLabel: formatMaintenanceMonth(entry.month),
        startDate: monthRange.startDate,
        endDate: monthRange.endDate,
        totalHours,
      };
    })
    .filter((entry): entry is { periodLabel: string; startDate: Date; endDate: Date; totalHours: number } => Boolean(entry));

  const actualEntries = workItems
    .map((item) => ({
      date: parseCalendarDate(item.date),
      hours: (item.minutes || 0) / 60,
    }))
    .filter((entry): entry is { date: Date; hours: number } => Boolean(entry.date));

  const boundaryDates = [
    ...relevantEntries.flatMap((entry) => [entry.startDate, entry.endDate]),
    ...actualEntries.map((entry) => entry.date),
  ];

  if (boundaryDates.length === 0) {
    return [] as BurnUpTrendPoint[];
  }

  const startDate = getMinDate(boundaryDates);
  const endDate = getMaxDate([new Date(), ...boundaryDates]);
  const dailyEstimateMap = new Map<string, number>();
  const dailyEstimateOrderNumbersMap = new Map<string, Set<string>>();
  const dailyActualMap = new Map<string, number>();

  relevantEntries.forEach((entry) => {
    const durationDays = getDaysDiffInclusive(entry.startDate, entry.endDate);
    const dailyEstimate = entry.totalHours / durationDays;
    for (let offset = 0; offset < durationDays; offset += 1) {
      const dateKey = getDateKey(addDays(entry.startDate, offset));
      dailyEstimateMap.set(dateKey, (dailyEstimateMap.get(dateKey) || 0) + dailyEstimate);
      const existingLabels = dailyEstimateOrderNumbersMap.get(dateKey) || new Set<string>();
      existingLabels.add(entry.periodLabel);
      dailyEstimateOrderNumbersMap.set(dateKey, existingLabels);
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
    const dailyEstimateOrderNumbers = Array.from(dailyEstimateOrderNumbersMap.get(dateKey) || []).sort((a, b) => a.localeCompare(b, 'pl'));
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
      dailyEstimateOrderNumbers,
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
  estimateLabel = 'Godziny zleceń narastająco',
  actualLabel = 'Godziny zalogowane narastająco',
  dailyEstimateLabel = 'Przyrost zleceń w dniu',
  dailyEstimateItemsLabel = 'Zlecenia w przyroście',
}: {
  active?: boolean;
  payload?: Array<{ payload: BurnUpTrendPoint }>;
  label?: string;
  estimateLabel?: string;
  actualLabel?: string;
  dailyEstimateLabel?: string;
  dailyEstimateItemsLabel?: string;
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
          <span className="text-gray-500 dark:text-gray-400">{estimateLabel}</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-300">{formatOrderHours(point.cumulativeEstimate)} h</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500 dark:text-gray-400">{actualLabel}</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-300">{formatOrderHours(point.cumulativeActual)} h</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500 dark:text-gray-400">{dailyEstimateLabel}</span>
          <span className="font-bold text-sky-600 dark:text-sky-300">{formatOrderHours(point.dailyEstimate)} h</span>
        </div>
        {point.dailyEstimateOrderNumbers.length > 0 && (
          <div className="rounded-xl bg-sky-50 px-3 py-2 dark:bg-sky-950/30">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">{dailyEstimateItemsLabel}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-sky-800 dark:text-sky-200">
              {point.dailyEstimateOrderNumbers.join(', ')}
            </p>
          </div>
        )}
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

const scheduledTaskTypeOptions: { value: GlobalScheduleType; label: string }[] = [
  { value: 'daily', label: 'Codziennie' },
  { value: 'weekdays', label: 'Codziennie oprócz sobót i niedziel' },
  { value: 'weekly', label: 'Raz w tygodniu' },
  { value: 'monthly', label: 'Raz w miesiącu' },
  { value: 'custom', label: 'Niestandardowe data i godzina' },
];

const scheduledTaskDayOptions = [
  { value: 1, label: 'Poniedziałek' },
  { value: 2, label: 'Wtorek' },
  { value: 3, label: 'Środa' },
  { value: 4, label: 'Czwartek' },
  { value: 5, label: 'Piątek' },
  { value: 6, label: 'Sobota' },
  { value: 0, label: 'Niedziela' },
];

const createScheduledTaskDraft = (): ScheduledTask => {
  const now = new Date().toISOString();

  return {
    id: createClientId(),
    name: 'Nowe zadanie harmonogramu',
    isActive: true,
    actionType: 'email',
    schedule: {
      type: 'daily',
      time: '22:00',
      dayOfWeek: 1,
      dayOfMonth: 1,
      dateTime: '',
    },
    emailTemplate: createEmptyEmailTemplate(),
    contentSources: [],
    createdAt: now,
    updatedAt: now,
  };
};

const GlobalSchedulerSection = () => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [dailyHubs, setDailyHubs] = useState<DailyHub[]>([]);
  const [dailySectionsByHub, setDailySectionsByHub] = useState<Record<string, DailySection[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDailyConfigLoading, setIsDailyConfigLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  const getScheduleRangeLabel = (scheduleType: GlobalScheduleType) => {
    switch (scheduleType) {
      case 'daily':
      case 'weekdays':
      case 'custom':
        return 'dzisiaj';
      case 'weekly':
        return 'ostatnie 7 dni';
      case 'monthly':
        return 'ostatnie 30 dni';
      default:
        return 'aktualny zakres';
    }
  };

  const sortDailySections = (sections: DailySection[]) => (
    [...sections].sort((left, right) => left.orderIndex - right.orderIndex || left.name.localeCompare(right.name, 'pl'))
  );

  const ensureDailySectionsLoaded = async (hubId: string) => {
    if (!hubId) return [];
    if (dailySectionsByHub[hubId]) return dailySectionsByHub[hubId];
    if (!window.electron?.getDailySections) return [];

    const loadedSections = sortDailySections(await window.electron.getDailySections(hubId) || []);
    setDailySectionsByHub((current) => ({ ...current, [hubId]: loadedSections }));
    return loadedSections;
  };

  const loadDailyConfig = async () => {
    if (!window.electron?.getDailyHubs) {
      setDailyHubs([]);
      return;
    }

    setIsDailyConfigLoading(true);
    try {
      const loadedHubs = await window.electron.getDailyHubs();
      setDailyHubs([...(loadedHubs || [])].sort((left, right) => left.name.localeCompare(right.name, 'pl')));
    } catch (loadError: any) {
      setError(loadError?.message || 'Nie udało się pobrać konfiguracji Daily.');
    } finally {
      setIsDailyConfigLoading(false);
    }
  };

  const loadTasks = async () => {
    if (!window.electron?.getScheduledTasks) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const loadedTasks = await window.electron.getScheduledTasks();
      setTasks(loadedTasks || []);

      const hubIdsToLoad = Array.from(new Set((loadedTasks || [])
        .flatMap((task) => (task.contentSources || [])
          .filter((source) => source.type === 'daily' && source.hubId)
          .map((source) => source.hubId))));

      for (const hubId of hubIdsToLoad) {
        await ensureDailySectionsLoaded(hubId);
      }
    } catch (loadError: any) {
      setError(loadError?.message || 'Nie udało się pobrać globalnego harmonogramu.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDailyConfig();
    void loadTasks();
  }, []);

  const updateTask = (taskId: string, updater: (current: ScheduledTask) => ScheduledTask) => {
    setTasks((currentTasks) => currentTasks.map((task) => (
      task.id === taskId
        ? {
            ...updater(task),
            updatedAt: new Date().toISOString(),
          }
        : task
    )));
  };

  const handleSaveTask = async (task: ScheduledTask) => {
    if (!window.electron?.saveScheduledTask) return;

    setPendingTaskId(task.id);
    setError('');
    try {
      await window.electron.saveScheduledTask({
        ...task,
        updatedAt: new Date().toISOString(),
      });
      await loadTasks();
    } catch (saveError: any) {
      setError(saveError?.message || 'Nie udało się zapisać zadania harmonogramu.');
    } finally {
      setPendingTaskId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.electron?.deleteScheduledTask) return;

    const shouldDelete = window.confirm('Czy usunąć wybrane zadanie harmonogramu?');
    if (!shouldDelete) return;

    setPendingTaskId(taskId);
    setError('');
    try {
      await window.electron.deleteScheduledTask(taskId);
      await loadTasks();
    } catch (deleteError: any) {
      setError(deleteError?.message || 'Nie udało się usunąć zadania harmonogramu.');
    } finally {
      setPendingTaskId(null);
    }
  };

  const handleRunTaskNow = async (taskId: string) => {
    if (!window.electron?.runScheduledTaskNow) return;

    setPendingTaskId(taskId);
    setError('');
    try {
      await window.electron.runScheduledTaskNow(taskId);
      await loadTasks();
    } catch (runError: any) {
      setError(runError?.message || 'Nie udało się wykonać zadania harmonogramu.');
      await loadTasks();
    } finally {
      setPendingTaskId(null);
    }
  };

  const handleAddDailySource = (taskId: string) => {
    updateTask(taskId, (current) => ({
      ...current,
      contentSources: [
        ...(current.contentSources || []),
        {
          id: createClientId(),
          type: 'daily',
          hubId: '',
          sectionIds: [],
        },
      ],
    }));
  };

  const handleRemoveContentSource = (taskId: string, sourceId: string) => {
    updateTask(taskId, (current) => ({
      ...current,
      contentSources: (current.contentSources || []).filter((source) => source.id !== sourceId),
    }));
  };

  const handleDailySourceHubChange = async (taskId: string, sourceId: string, hubId: string) => {
    const loadedSections = hubId ? await ensureDailySectionsLoaded(hubId) : [];

    updateTask(taskId, (current) => ({
      ...current,
      contentSources: (current.contentSources || []).map((source) => (
        source.id === sourceId
          ? {
              ...source,
              hubId,
              sectionIds: loadedSections.map((section) => section.id),
            }
          : source
      )),
    }));
  };

  const handleDailySectionToggle = (taskId: string, sourceId: string, sectionId: string, isChecked: boolean) => {
    updateTask(taskId, (current) => ({
      ...current,
      contentSources: (current.contentSources || []).map((source) => {
        if (source.id !== sourceId || source.type !== 'daily') {
          return source;
        }

        const nextIds = new Set(source.sectionIds);
        if (isChecked) {
          nextIds.add(sectionId);
        } else {
          nextIds.delete(sectionId);
        }

        return {
          ...source,
          sectionIds: Array.from(nextIds),
        };
      }),
    }));
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Globalny harmonogram</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-6">
            Zadania wykonują się, gdy aplikacja jest uruchomiona, także po schowaniu do traya. Pierwszy typ akcji to automatyczna wysyłka e-mail.
          </p>
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Jeśli Google było autoryzowane wcześniej, po dodaniu harmonogramu e-mail może być potrzebne wylogowanie i ponowna autoryzacja, aby nadać uprawnienie Gmail Send.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTasks((current) => [createScheduledTaskDraft(), ...current])}
          className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
        >
          <Plus size={16} />
          Nowe zadanie
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          Wczytywanie harmonogramu...
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-5 py-6 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Brak zdefiniowanych zadań. Dodaj pierwszy harmonogram, odbiorców, tytuł oraz źródła treści wiadomości.
            </div>
          ) : tasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-5 space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nazwa zadania</span>
                    <input
                      type="text"
                      value={task.name}
                      onChange={(event) => updateTask(task.id, (current) => ({ ...current, name: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </label>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Typ akcji</span>
                    <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <Mail size={15} className="text-indigo-500" />
                      Wysyłka wiadomości e-mail
                    </div>
                  </div>
                </div>

                <label className="inline-flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={task.isActive}
                    onChange={(event) => updateTask(task.id, (current) => ({ ...current, isActive: event.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Aktywne
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <label className="block xl:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tryb harmonogramu</span>
                  <select
                    value={task.schedule.type}
                    onChange={(event) => updateTask(task.id, (current) => ({
                      ...current,
                      schedule: {
                        ...current.schedule,
                        type: event.target.value as GlobalScheduleType,
                      },
                    }))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {scheduledTaskTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                {task.schedule.type === 'custom' ? (
                  <label className="block xl:col-span-2">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Data i godzina</span>
                    <input
                      type="datetime-local"
                      value={task.schedule.dateTime || ''}
                      onChange={(event) => updateTask(task.id, (current) => ({
                        ...current,
                        schedule: {
                          ...current.schedule,
                          dateTime: event.target.value,
                        },
                      }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </label>
                ) : (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Godzina</span>
                      <input
                        type="time"
                        value={task.schedule.time || '22:00'}
                        onChange={(event) => updateTask(task.id, (current) => ({
                          ...current,
                          schedule: {
                            ...current.schedule,
                            time: event.target.value,
                          },
                        }))}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </label>

                    {task.schedule.type === 'weekly' && (
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Dzień tygodnia</span>
                        <select
                          value={task.schedule.dayOfWeek ?? 1}
                          onChange={(event) => updateTask(task.id, (current) => ({
                            ...current,
                            schedule: {
                              ...current.schedule,
                              dayOfWeek: Number(event.target.value),
                            },
                          }))}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          {scheduledTaskDayOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                    )}

                    {task.schedule.type === 'monthly' && (
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Dzień miesiąca</span>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={task.schedule.dayOfMonth ?? 1}
                          onChange={(event) => updateTask(task.id, (current) => ({
                            ...current,
                            schedule: {
                              ...current.schedule,
                              dayOfMonth: Math.min(31, Math.max(1, Number(event.target.value) || 1)),
                            },
                          }))}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </label>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/70 dark:bg-indigo-950/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Źródła treści wiadomości</h4>
                    <p className="mt-1 text-xs leading-5 text-indigo-700/80 dark:text-indigo-300/80">
                      Wybierasz tutaj zadania, których wynik ma zostać dołączony do wiadomości. Zakres dla tego harmonogramu to {getScheduleRangeLabel(task.schedule.type)}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddDailySource(task.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-gray-800 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
                  >
                    <Plus size={15} />
                    Dodaj Daily
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {(task.contentSources || []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-indigo-200 dark:border-indigo-900/40 bg-white/70 dark:bg-gray-900/40 px-4 py-4 text-sm text-indigo-800/80 dark:text-indigo-200/80">
                      Brak wybranych źródeł. Dodaj `Daily`, jeśli wynik ma zostać automatycznie wstawiony do wiadomości.
                    </div>
                  ) : (
                    (task.contentSources || []).map((source, sourceIndex) => {
                      const dynamicSections = source.type === 'daily' && source.hubId
                        ? (dailySectionsByHub[source.hubId] || [])
                        : [];

                      return (
                        <div key={source.id} className="rounded-xl border border-indigo-200/80 dark:border-indigo-900/40 bg-white/90 dark:bg-gray-900/50 p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="grid flex-1 grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="rounded-lg border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/70 dark:bg-indigo-950/20 px-3 py-2.5">
                                <span className="block text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Typ źródła</span>
                                <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-indigo-950 dark:text-indigo-100">
                                  <Mail size={15} className="text-indigo-500" />
                                  Wyślij Daily #{sourceIndex + 1}
                                </div>
                              </div>

                              <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Wybór Daily</span>
                                <select
                                  value={source.hubId}
                                  onChange={(event) => void handleDailySourceHubChange(task.id, source.id, event.target.value)}
                                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                  <option value="">Wybierz zdefiniowane Daily</option>
                                  {dailyHubs.map((hub) => (
                                    <option key={hub.id} value={hub.id}>{hub.name}</option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveContentSource(task.id, source.id)}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/20"
                            >
                              <Trash2 size={14} />
                              Usuń źródło
                            </button>
                          </div>

                          <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                            Sekcja <span className="font-semibold">Aktywności</span> jest zawsze dołączana. Poniżej zaznaczasz tylko dodatkowe sekcje dynamiczne z wybranego Daily.
                          </div>

                          {source.hubId ? (
                            <div className="mt-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Dodatkowe sekcje do wysłania</p>
                              {dynamicSections.length === 0 ? (
                                <div className="mt-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                  {isDailyConfigLoading ? 'Wczytywanie sekcji Daily...' : 'To Daily nie ma jeszcze zdefiniowanych sekcji dynamicznych.'}
                                </div>
                              ) : (
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {dynamicSections.map((section) => (
                                    <label key={section.id} className="inline-flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-3 text-sm text-gray-700 dark:text-gray-200">
                                      <input
                                        type="checkbox"
                                        checked={source.sectionIds.includes(section.id)}
                                        onChange={(event) => handleDailySectionToggle(task.id, source.id, section.id, event.target.checked)}
                                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <span className="flex-1">
                                        <span className="block font-medium text-gray-900 dark:text-white">{section.name}</span>
                                        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                                          {section.respectDates ? 'Uwzględnia tylko elementy z aktywnością w zakresie dat.' : 'Uwzględnia wszystkie aktualnie widoczne elementy tej sekcji.'}
                                        </span>
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">DO</span>
                  <input
                    type="text"
                    value={task.emailTemplate.to}
                    onChange={(event) => updateTask(task.id, (current) => ({
                      ...current,
                      emailTemplate: { ...current.emailTemplate, to: event.target.value },
                    }))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">DW</span>
                  <input
                    type="text"
                    value={task.emailTemplate.cc}
                    onChange={(event) => updateTask(task.id, (current) => ({
                      ...current,
                      emailTemplate: { ...current.emailTemplate, cc: event.target.value },
                    }))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tytuł wiadomości</span>
                <input
                  type="text"
                  value={task.emailTemplate.subject}
                  onChange={(event) => updateTask(task.id, (current) => ({
                    ...current,
                    emailTemplate: { ...current.emailTemplate, subject: event.target.value },
                  }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Treść wiadomości / wstęp przed raportem</span>
                <textarea
                  rows={7}
                  value={task.emailTemplate.body}
                  onChange={(event) => updateTask(task.id, (current) => ({
                    ...current,
                    emailTemplate: { ...current.emailTemplate, body: event.target.value },
                  }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </label>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <div>Ostatnie wykonanie: {task.lastRunAt ? new Date(task.lastRunAt).toLocaleString('pl-PL') : 'jeszcze nie uruchomiono'}</div>
                  <div>Status: {task.lastRunStatus === 'success' ? 'sukces' : task.lastRunStatus === 'error' ? 'błąd' : 'brak'}</div>
                  {task.lastRunError ? <div className="text-red-500 dark:text-red-400">Błąd: {task.lastRunError}</div> : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id)}
                    disabled={pendingTaskId === task.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/20 disabled:opacity-60"
                  >
                    <Trash2 size={15} />
                    Usuń
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRunTaskNow(task.id)}
                    disabled={pendingTaskId === task.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-gray-800 dark:text-emerald-400 dark:hover:bg-emerald-950/20 disabled:opacity-60"
                  >
                    {pendingTaskId === task.id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    Wykonaj teraz
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveTask(task)}
                    disabled={pendingTaskId === task.id}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {pendingTaskId === task.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                    Zapisz zadanie
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-6xl max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SettingsIcon size={20} className="text-indigo-500" />
            Ustawienia Główne
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Google Cloud (Docs API)</h3>
              <div className="space-y-4">
                <GoogleAuthSection clientId={settings?.googleClientId || ''} clientSecret={settings?.googleClientSecret || ''} />
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
              <GlobalSchedulerSection />
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
