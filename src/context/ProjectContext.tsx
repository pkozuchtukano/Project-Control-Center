import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { differenceInDays, parseISO, isAfter } from 'date-fns';
import type { 
  Project, Order, Settings, DailyHub
} from '../types';
import { getEnvSettingsOrNull } from '../config/env';

export type ProjectContextType = {
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
  importOrders: (orders: Order[]) => Promise<void>;
  
  // Daily Hubs Management
  dailyHubs: DailyHub[];
  refreshDailyHubs: () => Promise<void>;
  saveDailyHub: (hub: DailyHub) => Promise<void>;
  deleteDailyHub: (id: string) => Promise<void>;
};

export const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const SELECTED_PROJECT_STORAGE_KEY = 'pcc_selected_project_id';

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [dailyHubs, setDailyHubs] = useState<DailyHub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncDb = async (newProjects: Project[], newOrders: Order[]) => {
    const resolvedSettings = getEnvSettingsOrNull();
    try {
      if (!window.electron) {
        localStorage.setItem('pcc_projects', JSON.stringify(newProjects));
        localStorage.setItem('pcc_orders', JSON.stringify(newOrders));
        localStorage.removeItem('pcc_settings');
      } else {
        await window.electron.writeDb({ projects: newProjects, orders: newOrders });
      }
      setProjects(newProjects);
      setOrders(newOrders);
      setSettings(resolvedSettings);
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
          const storedProjects = localStorage.getItem('pcc_projects');
          const storedOrders = localStorage.getItem('pcc_orders');

          if (storedProjects) setProjects(JSON.parse(storedProjects));
          localStorage.removeItem('pcc_settings');
          setSettings(getEnvSettingsOrNull());

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
        setSettings(data.settings || getEnvSettingsOrNull());

        const loadedOrders = data.orders || [];
        loadedOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(loadedOrders);

        if (window.electron) {
          const hubs = await window.electron.getDailyHubs();
          setDailyHubs(hubs);
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error("Local DB Error:", err);
        setError("Błąd pobierania danych z lokalnego pliku JSON.");
        setIsLoading(false);
      }
    };
    initDb();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!selectedProject) {
      sessionStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
      return;
    }

    sessionStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, selectedProject.id);
  }, [selectedProject]);

  useEffect(() => {
    if (typeof window === 'undefined' || projects.length === 0) return;

    const storedProjectId = sessionStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
    if (!storedProjectId) return;

    const matchingProject = projects.find((project) => project.id === storedProjectId);
    if (!matchingProject) {
      sessionStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
      return;
    }

    if (!selectedProject || selectedProject.id !== matchingProject.id) {
      setSelectedProject(matchingProject);
      return;
    }

    if (selectedProject !== matchingProject) {
      setSelectedProject(matchingProject);
    }
  }, [projects, selectedProject]);

  const refreshDailyHubs = async () => {
    if (window.electron) {
      const hubs = await window.electron.getDailyHubs();
      setDailyHubs(hubs);
    }
  };

  const saveDailyHub = async (hub: DailyHub) => {
    if (window.electron) {
      await window.electron.saveDailyHub(hub);
      await refreshDailyHubs();
    }
  };

  const deleteDailyHub = async (id: string) => {
    if (window.electron) {
      await window.electron.deleteDailyHub(id);
      await refreshDailyHubs();
    }
  };

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
    const updatedOrders = orders.filter(o => o.projectId !== id);
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

  const updateSettings = async (_newSettings: Settings) => {
    setSettings(getEnvSettingsOrNull());
  };

  const importOrders = async (ordersToImport: Order[]) => {
    try {
      if (window.electron) {
        await window.electron.importOrders({ orders: ordersToImport, projectId: selectedProject?.id || '' });
        const data = await window.electron.readDb();
        setOrders(data.orders || []);
      } else {
        const updated = [...orders];
        ordersToImport.forEach(o => {
           if (!updated.find(existing => existing.id === o.id)) {
             updated.push(o);
           }
        });
        await syncDb(projects, updated);
      }
    } catch (err: any) {
      console.error(err);
      setError("Błąd importu zleceń: " + err.message);
    }
  };

  return (
    <ProjectContext.Provider value={{
      projects, orders, settings, selectedProject, setSelectedProject,
      isLoading, error, addProject, updateProject, deleteProject,
      addOrder, updateOrder, deleteOrder, updateSettings, importOrders,
      dailyHubs, refreshDailyHubs, saveDailyHub, deleteDailyHub
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
  const { orders: allOrders, isLoading, error, addOrder, updateOrder, deleteOrder, importOrders } = useProjectContext();
  const orders = projectId ? allOrders.filter(o => o.projectId === projectId) : [];
  return { orders, isLoading, error, addOrder, updateOrder, deleteOrder, importOrders };
};

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
  const [isDark, setIsDark] = useState(true);

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
