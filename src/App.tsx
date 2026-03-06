import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  differenceInDays, isAfter, parseISO
} from 'date-fns';

declare global {
  interface Window {
    electron?: {
      readDb: () => Promise<{ projects: Project[], orders: Order[], settings?: Settings }>;
      writeDb: (data: { projects: Project[], orders: Order[], settings?: Settings }) => Promise<{ success: boolean }>;
      fetchYouTrack: (options: any) => Promise<any>;
      getExcludedIssues: () => Promise<string[]>;
      setIssueExcluded: (id: string, excluded: boolean) => Promise<{ success: boolean }>;
      getYoutrackTabs: (projectId: string) => Promise<{ id: string; projectId: string; name: string; statuses: string[]; includeFilters?: boolean; orderIndex?: number }[]>;
      saveYoutrackTab: (tab: { id: string; projectId: string; name: string; statuses: string[]; includeFilters?: boolean; orderIndex?: number }) => Promise<{ success: boolean }>;
      deleteYoutrackTab: (id: string) => Promise<{ success: boolean }>;
      reorderYoutrackTabs: (tabs: { id: string; orderIndex: number }[]) => Promise<{ success: boolean }>;
      getIssueTaskTypes: (issueIds: string[]) => Promise<Record<string, string>>;
      setIssueTaskType: (issueId: string, taskTypeId: string) => Promise<{ success: boolean }>;
    }
  }
}
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid
} from 'recharts';
import {
  LayoutDashboard, Plus, Briefcase,
  Clock, AlertTriangle,
  Edit2, X, Moon, Sun, Loader2, BarChart as BarChartIcon, Info, FileText, Printer,
  Layers, FileSpreadsheet, Activity, DollarSign, Settings as SettingsIcon,
  Code, PenTool, Database, Monitor, Headphones, Terminal,
  Wrench, Bug, Palette, Server, Cpu, Globe, Key, Lock, Network, Shield, Smartphone, 
  Wifi, Search, Map, Calendar, Image as ImageIcon, Video, FileSearch, HelpCircle, 
  ShoppingCart, Zap, Heart, Star, Flag, Box, Crosshair, Music, Book
} from 'lucide-react';

// ==========================================
// CONFIG & CONSTANTS
// ==========================================
import { YouTrackTab } from './components/YouTrackTab';

export type TaskType = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

export const TaskTypeIconMap: Record<string, React.ElementType> = {
  Code, Terminal, PenTool, Database, Monitor, Headphones, Briefcase, Layers,
  Wrench, Bug, Palette, Server, Cpu, Globe, Key, Lock, Network, Shield, Smartphone, 
  Wifi, Search, Map, Calendar, ImageIcon, Video, FileSearch, HelpCircle, 
  ShoppingCart, Zap, Heart, Star, Flag, Box, Crosshair, Music, Book
};

export type Project = {
  id: string;
  code: string;
  name: string;
  contractNo: string;
  contractSubject?: string;
  dateFrom: string;
  dateTo: string;
  minHours: number;
  maxHours: number;
  rateNetto: number;
  rateBrutto: number;
  vatRate: number;
  youtrackQuery?: string;
  taskTypes?: TaskType[];
};

export type OrderItem = {
  id: string;
  name: string;
  date: string;
  hours: number;
};

export type Order = {
  id: string;
  projectId: string;
  orderNumber: string;
  title: string;
  priority: 'wysoki' | 'normalny' | 'niski';
  problemDescription: string;
  expectedStateDescription: string;
  items: OrderItem[];
  location: string;
  methodologyRequired: boolean;
  methodologyScope: string;
  scheduleFrom: string;
  scheduleTo: string;
  handoverDate?: string;
  acceptanceDate?: string;
  systemModule: string;
  notes?: string;
  createdAt: string;
};

export type Settings = {
  youtrackBaseUrl: string;
  youtrackToken: string;
};

// ==========================================
// SERVICES & HOOKS
// ==========================================

type ProjectContextType = {
  projects: Project[];
  orders: Order[];
  selectedProject: Project | null;
  setSelectedProject: (p: Project | null) => void;
  isLoading: boolean;
  error: string | null;
  addProject: (p: Omit<Project, 'id'>) => Promise<void>;
  updateProject: (id: string, p: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addOrder: (o: Omit<Order, 'id'>) => Promise<void>;
  updateOrder: (id: string, o: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  settings: Settings | null;
  updateSettings: (s: Settings) => Promise<void>;
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncDb = async (newProjects: Project[], newOrders: Order[], newSettings?: Settings) => {
    const sToSave = newSettings !== undefined ? newSettings : settings;
    try {
      if (!window.electron) {
        console.warn("Aplikacja uruchomiona poza Electronem. Zapis do localStorage.");
        localStorage.setItem('pcc_projects', JSON.stringify(newProjects));
        localStorage.setItem('pcc_orders', JSON.stringify(newOrders));
        if (sToSave) localStorage.setItem('pcc_settings', JSON.stringify(sToSave));
      } else {
        await window.electron.writeDb({ projects: newProjects, orders: newOrders, settings: sToSave || undefined });
      }
      setProjects(newProjects);
      setOrders(newOrders);
      if (sToSave) setSettings(sToSave);
    } catch (err: any) {
      console.error(err);
      setError("Błąd zapisu do pliku: " + err.message);
      throw err;
    }
  };

  const generateId = () => {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  };

  useEffect(() => {
    const initDb = async () => {
      try {
        if (!window.electron) {
          console.warn("Aplikacja uruchomiona poza Electronem. Odczyt z localStorage.");
          const storedProjects = localStorage.getItem('pcc_projects');
          const storedOrders = localStorage.getItem('pcc_orders');
          const storedSettings = localStorage.getItem('pcc_settings');

          if (storedProjects) setProjects(JSON.parse(storedProjects));
          if (storedSettings) setSettings(JSON.parse(storedSettings));

          if (storedOrders) {
            const parsedOrders = JSON.parse(storedOrders);
            parsedOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setOrders(parsedOrders);
          }
          setIsLoading(false);
          return;
        }

        const data = await window.electron.readDb();
        setProjects(data.projects || []);
        if (data.settings) setSettings(data.settings);

        const loadedOrders = data.orders || [];
        loadedOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(loadedOrders);
        setIsLoading(false);
      } catch (err: any) {
        console.error("Local DB Error:", err);
        setError("Błąd pobierania danych z lokalnego pliku JSON.");
        setIsLoading(false);
      }
    };
    initDb();
  }, []);

  const addProject = async (p: Omit<Project, 'id'>) => {
    const newProject = { ...p, id: generateId() };
    await syncDb([...projects, newProject], orders);
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    const updated = projects.map(proj => proj.id === id ? { ...proj, ...updates } : proj);
    await syncDb(updated, orders);
    if (selectedProject?.id === id) {
      setSelectedProject({ ...selectedProject, ...updates });
    }
  };

  const deleteProject = async (id: string) => {
    const updated = projects.filter(proj => proj.id !== id);
    const updatedOrders = orders.filter(o => o.projectId !== id); // Cascade delete
    await syncDb(updated, updatedOrders);
    if (selectedProject?.id === id) setSelectedProject(null);
  };

  const addOrder = async (o: Omit<Order, 'id'>) => {
    const newOrder = { ...o, id: generateId() };
    await syncDb(projects, [newOrder, ...orders]);
  };

  const updateOrder = async (id: string, updates: Partial<Order>) => {
    const updated = orders.map(order => order.id === id ? { ...order, ...updates } : order);
    await syncDb(projects, updated);
  };

  const deleteOrder = async (id: string) => {
    const updated = orders.filter(order => order.id !== id);
    await syncDb(projects, updated);
  };

  const updateSettings = async (newSettings: Settings) => {
    await syncDb(projects, orders, newSettings);
  };

  return (
    <ProjectContext.Provider value={{
      projects, orders, settings, selectedProject, setSelectedProject,
      isLoading, error, addProject, updateProject, deleteProject,
      addOrder, updateOrder, deleteOrder, updateSettings
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjectContext = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProjectContext must be used within ProjectProvider');
  return context;
};

export const useOrders = (projectId: string | undefined) => {
  const { orders: allOrders, isLoading, error, addOrder, updateOrder, deleteOrder } = useProjectContext();
  const orders = projectId ? allOrders.filter(o => o.projectId === projectId) : [];
  return { orders, isLoading, error, addOrder, updateOrder, deleteOrder };
};

// Custom Hook for Analytics Calculations
export const useProjectCalculations = (project: Project | null) => {
  if (!project) return null;
  const today = new Date();

  const start = project.dateFrom ? parseISO(project.dateFrom) : today;
  const end = project.dateTo ? parseISO(project.dateTo) : today;

  const totalDays = project.dateFrom && project.dateTo ? differenceInDays(end, start) : 0;
  const daysPassed = project.dateFrom ? differenceInDays(today, start) : 0;

  let timeProgress = 0;
  if (totalDays > 0) {
    timeProgress = Math.max(0, Math.min(100, (daysPassed / totalDays) * 100));
  } else if (project.dateFrom && today >= start) {
    timeProgress = 100;
  }

  const isEndingSoon = project.dateTo ? differenceInDays(end, today) <= 14 && differenceInDays(end, today) > 0 : false;
  const isOverdue = project.dateTo ? isAfter(today, end) : false;

  return {
    timeProgress: Math.round(timeProgress),
    daysRemaining: project.dateTo ? differenceInDays(end, today) : 0,
    totalDays,
    daysPassed,
    isEndingSoon,
    isOverdue,
    budgetMin: project.minHours ? project.minHours * project.rateNetto : 0,
    budgetMax: project.maxHours ? project.maxHours * project.rateNetto : 0,
  };
};

export const useDarkMode = () => {
  const [isDark, setIsDark] = useState(true); // Default to dark mode per requirements

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  return { isDark, toggleDark: () => setIsDark(!isDark) };
};

// ==========================================
// COMPONENTS
// ==========================================

const Sidebar = ({ isDark, toggleDark, onOpenModal, onOpenSettings }: {
  isDark: boolean,
  toggleDark: () => void,
  onOpenModal: () => void,
  onOpenSettings: () => void
}) => {
  const { projects, selectedProject, setSelectedProject, isLoading } = useProjectContext();

  return (
    <aside className="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col h-screen h-full sticky top-0 transition-colors">
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
                onClick={() => setSelectedProject(p)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-3 ${selectedProject?.id === p.id
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-600 dark:text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
              >
                <Briefcase size={16} className={selectedProject?.id === p.id ? 'opacity-100' : 'opacity-50'} />
                <span className="truncate">{p.code}</span>
              </button>
            ))}
            {projects.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Brak projektów</p>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-gray-800">
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
    minHours: 0, maxHours: 0, rateNetto: 0, rateBrutto: 0, vatRate: 23,
    taskTypes: []
  });
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
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
        taskTypes: projectToEdit.taskTypes || []
      });
      setTaskTypes(projectToEdit.taskTypes || []);
    } else {
      setFormData({
        code: '', name: '', contractNo: '', contractSubject: '',
        dateFrom: '', dateTo: '',
        minHours: 0, maxHours: 0, rateNetto: 0, rateBrutto: 0, vatRate: 23,
        taskTypes: []
      });
      setTaskTypes([]);
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
        taskTypes: taskTypes.filter(t => t.name.trim() !== '')
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
                </div>
              </div>
            </div>
          </div>

          {/* Sekcja 2: Rodzaje zadań */}
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
  const { selectedProject } = useProjectContext();
  const calculations = useProjectCalculations(selectedProject);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'work' | 'settlements' | 'status' | 'youtrack'>('dashboard');
  const [isFinancialDataVisible, setIsFinancialDataVisible] = useState(false);
  const { orders } = useOrders(selectedProject?.id);

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

  const settledHours = orders?.filter(o => o.acceptanceDate).reduce((sum, order) => sum + order.items.reduce((s, item) => s + (Number(item.hours) || 0), 0), 0) || 0;
  const contractedHours = orders?.filter(o => !o.acceptanceDate).reduce((sum, order) => sum + order.items.reduce((s, item) => s + (Number(item.hours) || 0), 0), 0) || 0;
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

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-6xl mx-auto space-y-6">

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
        </div>

        {activeTab === 'dashboard' && (
          <>
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

                  {isFinancialDataVisible && (
                    <div className="col-span-2 grid grid-cols-2 gap-x-6 pt-4 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-300">
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
          <OrdersRegistryView projectId={selectedProject.id} />
        )}

        {activeTab === 'work' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 shadow-sm border border-gray-100 dark:border-gray-800 text-center flex flex-col items-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mb-4">
              <Layers size={28} className="text-indigo-400 dark:text-indigo-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Rejestr Pracy</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm">Moduł ewidencji i raportowania czasu pracy jest w przygotowaniu.</p>
          </div>
        )}

        {activeTab === 'settlements' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 shadow-sm border border-gray-100 dark:border-gray-800 text-center flex flex-col items-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-4">
              <FileSpreadsheet size={28} className="text-emerald-400 dark:text-emerald-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Rozliczenia</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm">Moduł fakturowania i rozliczeń finansowych projektu jest w przygotowaniu.</p>
          </div>
        )}

        {activeTab === 'status' && (
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

      </div>
    </div >
  );
};

const OrdersRegistryView = ({ projectId }: { projectId: string }) => {
  const { projects } = useProjectContext();
  const project = projects.find(p => p.id === projectId);
  const { orders, isLoading, addOrder, updateOrder, deleteOrder } = useOrders(projectId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  if (!project) return null;

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
          <p className="text-sm text-gray-500 dark:text-gray-400">Zarządzaj zleceniami dla: {project.code}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsReportModalOpen(true)} className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm">
            <FileText size={16} /> Raport Końcowy (CBCP)
          </button>
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
                  const total = totalHours * project.rateNetto;
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
                      <td className="px-6 py-4 text-right text-gray-500 whitespace-nowrap">{totalHours}h</td>
                      <td className="px-6 py-4 text-right leading-tight whitespace-nowrap">
                        <div className="text-indigo-600 dark:text-indigo-400 font-medium">
                          {(totalHours * project.rateBrutto).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                        </div>
                        <div className="text-[13px] text-gray-400 dark:text-gray-500 mt-0.5">
                          ({total.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł)
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => handleEdit(order)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition mr-1">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => { if (window.confirm('Czy na pewno chcesz usunąć to zlecenie?')) deleteOrder(order.id) }} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition">
                          <X size={16} />
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
                    {orders.reduce((sum, order) => sum + order.items.reduce((s, item) => s + (Number(item.hours) || 0), 0), 0)}h
                  </td>
                  <td className="px-6 py-4 text-right leading-tight whitespace-nowrap">
                    <div className="text-indigo-600 dark:text-indigo-400 text-base">
                      {(orders.reduce((sum, order) => sum + order.items.reduce((s, item) => s + (Number(item.hours) || 0), 0), 0) * project.rateBrutto).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                    </div>
                    <div className="text-sm text-gray-400 font-normal uppercase tracking-wider mt-0.5">
                      ({(orders.reduce((sum, order) => sum + order.items.reduce((s, item) => s + (Number(item.hours) || 0), 0), 0) * project.rateNetto).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł)
                    </div>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <OrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} project={project} orderToEdit={editingOrder} onSave={handleSave} />
      <ReportCbcpModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} project={project} orders={orders} />
    </div>
  );
};

const OrderModal = ({ isOpen, onClose, project, orderToEdit, onSave }: any) => {
  const [formData, setFormData] = useState<Omit<Order, 'id'>>({
    projectId: project?.id || '',
    orderNumber: '',
    title: '',
    priority: 'niski',
    problemDescription: '',
    expectedStateDescription: '',
    items: [{ id: Date.now().toString(), name: '', date: '', hours: 0 }],
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
    if (orderToEdit) {
      setFormData(orderToEdit);
    } else if (project) {
      setFormData({
        projectId: project.id,
        orderNumber: '',
        title: '',
        priority: 'niski',
        problemDescription: '',
        expectedStateDescription: '',
        items: [{ id: Date.now().toString(), name: '', date: '', hours: 0 }],
        location: 'zdalnie',
        methodologyRequired: false,
        methodologyScope: '',
        scheduleFrom: '',
        scheduleTo: '',
        systemModule: project.code,
        createdAt: new Date().toISOString()
      });
    }
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
      items: [...prev.items, { id: Date.now().toString(), name: '', date: '', hours: 0 }]
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Formularz zlecenia nr *</label>
                <input required name="orderNumber" value={formData.orderNumber} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tytuł zlecenia *</label>
                <input required name="title" value={formData.title} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition" />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data realizacji od</label>
                  <input type="date" name="scheduleFrom" value={formData.scheduleFrom} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data realizacji do</label>
                  <input type="date" name="scheduleTo" value={formData.scheduleTo} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data przekazania</label>
                  <input type="date" name="handoverDate" value={formData.handoverDate || ''} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data odbioru zlecenia</label>
                  <input type="date" name="acceptanceDate" value={formData.acceptanceDate || ''} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] focus:ring-2 focus:ring-indigo-500 outline-none" />
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
                          <input type="date" value={item.date} onChange={e => handleItemChange(item.id, 'date', e.target.value)} className="w-full rounded bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-500 dark:hover:border-gray-600 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 px-2 py-1.5 focus:ring-0 outline-none transition [color-scheme:light] dark:[color-scheme:dark]" />
                        </td>
                        <td className="py-2 px-4">
                          <input type="number" min="0" value={item.hours} onChange={e => handleItemChange(item.id, 'hours', parseFloat(e.target.value) || 0)} className="w-full rounded bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-500 dark:hover:border-gray-600 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 px-2 py-1.5 text-center focus:ring-0 outline-none transition" />
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
                      <td className="py-4 px-4 text-center text-indigo-600 dark:text-indigo-400 text-lg">{totalHours}</td>
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
        <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800/80 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
            Anuluj
          </button>
          <button type="submit" form="order-form" className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition">
            Zapisz Zlecenie
          </button>
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

  const filteredOrders = orders.filter(o => {
    const pFrom = periodFrom ? new Date(periodFrom) : new Date(0);
    const pTo = periodTo ? new Date(periodTo) : new Date(8640000000000000);
    // Include end of the day for the 'to' date
    pTo.setHours(23, 59, 59, 999);

    if (o.acceptanceDate) {
      const aDate = new Date(o.acceptanceDate);
      return aDate >= pFrom && aDate <= pTo;
    } else {
      const cDate = new Date(o.createdAt);
      return cDate >= pFrom && cDate <= pTo;
    }
  }).sort((a, b) => a.orderNumber.localeCompare(b.orderNumber, undefined, { numeric: true }));

  const realizedOrders = filteredOrders.filter(o => o.acceptanceDate);
  const remainingOrders = filteredOrders.length - realizedOrders.length;

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

      {/* HEADER CONTROLS (Nie drukuje się) */}
      <div className="no-print sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center z-10">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sporządzono:</label>
            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white outline-none focus:border-indigo-500" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Okres od:</label>
            <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white outline-none focus:border-indigo-500" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Do:</label>
            <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            Zamknij
          </button>
          <button onClick={() => window.print()} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm">
            <Printer size={16} /> Export PDF / Drukuj
          </button>
        </div>
      </div>

      {/* DOCUMENT TO PRINT */}
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
              Liczba zgłoszeń w raportowanym okresie <span className="border-b border-dotted border-black inline-block min-w-[40px] text-center">{filteredOrders.length}</span>
            </div>
            <div>
              Liczba zgłoszeń zrealizowanych w raportowanym okresie <span className="border-b border-dotted border-black inline-block min-w-[40px] text-center">{realizedOrders.length}</span>
            </div>
            <div>
              Liczba zgłoszeń pozostających w realizacji <span className="border-b border-dotted border-black inline-block min-w-[40px] text-center">{remainingOrders}</span>
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
            {filteredOrders.map(order => {
              const totalHours = order.items.reduce((s, item) => s + (Number(item.hours) || 0), 0);
              const itemsList = order.items.map(i => i.name).join(", ");
              return (
                <tr key={order.id}>
                  <td className="border border-black p-2 text-center whitespace-nowrap">{order.orderNumber}</td>
                  <td className="border border-black p-2">{order.title}</td>
                  <td className="border border-black p-2 text-xs">{itemsList}</td>
                  <td className="border border-black p-2 text-center text-xs">{order.systemModule || ''}</td>
                  <td className="border border-black p-2 text-center whitespace-nowrap">{order.scheduleFrom || order.createdAt.split('T')[0]}</td>
                  <td className="border border-black p-2 text-center whitespace-nowrap">{order.handoverDate || ''}</td>
                  <td className="border border-black p-2 text-center whitespace-nowrap">{order.acceptanceDate || ''}</td>
                  <td className="border border-black p-2 text-center whitespace-nowrap">{totalHours}h</td>
                </tr>
              )
            })}
            {filteredOrders.length === 0 && (
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

const SettingsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { settings, updateSettings } = useProjectContext();
  const [formData, setFormData] = useState<Settings>({ youtrackBaseUrl: '', youtrackToken: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        youtrackBaseUrl: settings.youtrackBaseUrl || '',
        youtrackToken: settings.youtrackToken || ''
      });
    }
  }, [settings, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateSettings(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

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

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">YouTrack Base URL</label>
              <input required name="youtrackBaseUrl" value={formData.youtrackBaseUrl} onChange={e => setFormData({ ...formData, youtrackBaseUrl: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="np. https://twojadomena.youtrack.cloud" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Permanent Token</label>
              <input type="password" required name="youtrackToken" value={formData.youtrackToken} onChange={e => setFormData({ ...formData, youtrackToken: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="Wprowadź token API" />
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
              Anuluj
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition flex items-center justify-center min-w-[120px]">
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Zapisz'}
            </button>
          </div>
        </form>
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

  const handleOpenModal = () => {
    setEditingProject(null);
    setIsModalOpen(true);
  };

  const handleEditProject = (p: Project) => {
    setEditingProject(p);
    setIsModalOpen(true);
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans transition-colors dark:bg-gray-950 dark:text-gray-100 overflow-hidden">
      <Sidebar isDark={isDark} toggleDark={toggleDark} onOpenModal={handleOpenModal} onOpenSettings={() => setIsSettingsOpen(true)} />
      <DashboardView onEdit={handleEditProject} />

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
