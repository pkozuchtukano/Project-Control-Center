import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, type User } from 'firebase/auth';
import {
  getFirestore, collection, doc, updateDoc,
  onSnapshot, query, addDoc, deleteDoc
} from 'firebase/firestore';
import {
  differenceInDays, isAfter, parseISO
} from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid
} from 'recharts';
import {
  LayoutDashboard, Plus, Briefcase,
  Clock, AlertTriangle,
  Edit2, X, Moon, Sun, Loader2, BarChart as BarChartIcon
} from 'lucide-react';

// ==========================================
// CONFIG & CONSTANTS
// ==========================================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dummy",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dummy",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dummy",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "dummy",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "dummy"
};

const APP_ID = 'project-control-center';
const PROJECTS_PATH = `artifacts/${APP_ID}/public/data/projects`;

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
  createdAt: string;
};

// ==========================================
// SERVICES
// ==========================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const getProjectCollection = () => collection(db, PROJECTS_PATH);
const getOrderCollection = (projectId: string) => collection(db, `${PROJECTS_PATH}/${projectId}/orders`);

// ==========================================
// HOOKS
// ==========================================

export const useOrders = (projectId: string | undefined) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(getOrderCollection(projectId));
    const unsubscribe = onSnapshot(q, (querySnapshot: any) => {
      const loadedOrders: Order[] = [];
      querySnapshot.forEach((doc: any) => {
        loadedOrders.push({ id: doc.id, ...doc.data() } as Order);
      });
      // Sort desc by order creation
      loadedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(loadedOrders);
      setIsLoading(false);
    }, (err: any) => {
      console.error("Firestore Orders Error:", err);
      setError("Błąd pobierania zleceń.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [projectId]);

  const addOrder = async (order: Omit<Order, 'id'>) => {
    if (!projectId) return;
    try {
      await addDoc(getOrderCollection(projectId), order);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const updateOrder = async (id: string, updates: Partial<Order>) => {
    if (!projectId) return;
    try {
      const docRef = doc(db, `${PROJECTS_PATH}/${projectId}/orders`, id);
      await updateDoc(docRef, updates);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const deleteOrder = async (id: string) => {
    if (!projectId) return;
    try {
      const docRef = doc(db, `${PROJECTS_PATH}/${projectId}/orders`, id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  return { orders, isLoading, error, addOrder, updateOrder, deleteOrder };
};
type ProjectContextType = {
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (p: Project | null) => void;
  isLoading: boolean;
  error: string | null;
  addProject: (p: Omit<Project, 'id'>) => Promise<void>;
  updateProject: (id: string, p: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  user: User | null;
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let unsubscribeProjects: () => void;

    const initAuth = async () => {
      try {
        const userCredential = await signInAnonymously(auth);
        setUser(userCredential.user);

        // Setup real-time listener for projects
        const q = query(getProjectCollection());
        unsubscribeProjects = onSnapshot(q, (querySnapshot: any) => {
          const loadedProjects: Project[] = [];
          querySnapshot.forEach((doc: any) => {
            loadedProjects.push({ id: doc.id, ...doc.data() } as Project);
          });
          setProjects(loadedProjects);
          // Update selected project if it exists
          if (selectedProject) {
            const updatedSelected = loadedProjects.find((p: Project) => p.id === selectedProject.id);
            if (updatedSelected) setSelectedProject(updatedSelected);
          }
          setIsLoading(false);
        }, (err: any) => {
          console.error("Firestore Error:", err);
          setError("Błąd pobierania danych. Upewnij się, że masz poprawną konfigurację Firebase.");
          setIsLoading(false);
        });

      } catch (err: any) {
        console.error("Auth Error:", err);
        setError("Błąd autentykacji. Sprawdź bazę i konfigurację.");
        setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      unsubscribeProjects && unsubscribeProjects();
    };
  }, []);

  const addProject = async (project: Omit<Project, 'id'>) => {
    if (!user) return;
    try {
      await addDoc(getProjectCollection(), project);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    if (!user) return;
    try {
      const docRef = doc(db, PROJECTS_PATH, id);
      await updateDoc(docRef, updates);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const deleteProject = async (id: string) => {
    if (!user) return;
    try {
      const docRef = doc(db, PROJECTS_PATH, id);
      if (selectedProject?.id === id) setSelectedProject(null);
      await deleteDoc(docRef);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  return (
    <ProjectContext.Provider value={{
      projects, selectedProject, setSelectedProject,
      isLoading, error, addProject, updateProject, deleteProject, user
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

const Sidebar = ({ isDark, toggleDark, onOpenModal }: {
  isDark: boolean,
  toggleDark: () => void,
  onOpenModal: () => void
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
        <button onClick={toggleDark} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
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
    minHours: 0, maxHours: 0, rateNetto: 0, rateBrutto: 0, vatRate: 23
  });
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
        vatRate: projectToEdit.vatRate !== undefined ? projectToEdit.vatRate : 23
      });
    } else {
      setFormData({
        code: '', name: '', contractNo: '', contractSubject: '',
        dateFrom: '', dateTo: '',
        minHours: 0, maxHours: 0, rateNetto: 0, rateBrutto: 0, vatRate: 23
      });
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
      if (projectToEdit) {
        await updateProject(projectToEdit.id, formData);
      } else {
        await addProject(formData);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {projectToEdit ? 'Edytuj Projekt' : 'Nowy Projekt'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

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

          <div className="mt-8 flex justify-end gap-3">
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders'>('dashboard');

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

  const chartData = [
    { name: 'Min', Godziny: selectedProject.minHours, fill: '#6366f1' },
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
        </div>

        {activeTab === 'dashboard' ? (
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
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <Briefcase className="text-indigo-500" size={20} /> Wszystkie informacje
                </h3>
                <div className="grid grid-cols-2 gap-y-8 gap-x-6">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Status Umowy</p>
                    <div className="flex items-center gap-2 font-medium">
                      {isOverdue ? <><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-red-600 dark:text-red-400">Zakończona</span></>
                        : <><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-emerald-600 dark:text-emerald-400">Aktywna</span></>}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Stawka Godzinowa (Netto)</p>
                    <p className="font-bold text-gray-900 dark:text-white sm:text-lg">{selectedProject.rateNetto.toLocaleString('pl-PL')} <span className="text-sm text-gray-500">PLN</span></p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Budżet Min (Netto)</p>
                    <div className="flex items-end gap-2 text-gray-900 dark:text-white font-bold sm:text-xl">
                      {budgetMin.toLocaleString('pl-PL')} <span className="text-sm text-gray-500 font-normal pb-0.5">PLN</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Budżet Max (Netto)</p>
                    <div className="flex items-end gap-2 text-gray-900 dark:text-white font-bold sm:text-xl">
                      {budgetMax.toLocaleString('pl-PL')} <span className="text-sm text-gray-500 font-normal pb-0.5">PLN</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Prognoza wartości (Brutto MAX)</p>
                    <p className="text-xs text-gray-500 mt-0.5">W tym 23% VAT</p>
                  </div>
                  <p className="font-bold text-xl text-indigo-600 dark:text-indigo-400">
                    {(budgetMax * 1.23).toLocaleString('pl-PL')} PLN
                  </p>
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
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }} dy={10} />
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
        ) : (
          <OrdersRegistryPlaceholder projectId={selectedProject.id} />
        )}
      </div>
    </div>
  );
};

const OrdersRegistryView = ({ projectId }: { projectId: string }) => {
  const { projects } = useProjectContext();
  const project = projects.find(p => p.id === projectId);
  const { orders, isLoading, addOrder, updateOrder, deleteOrder } = useOrders(projectId);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
          <p className="text-sm text-gray-500 dark:text-gray-400">Zarządzaj zleceniami do umowy {project.contractNo || project.code}</p>
        </div>
        <button onClick={handleOpenModal} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm">
          <Plus size={16} /> Nowe Zlecenie
        </button>
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
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-4">Nr Zlecenia</th>
                  <th className="px-6 py-4">Tytuł</th>
                  <th className="px-6 py-4">Priorytet</th>
                  <th className="px-6 py-4 text-center">Data od-do</th>
                  <th className="px-6 py-4 text-right">Suma Godzin</th>
                  <th className="px-6 py-4 text-right">Kwota Netto</th>
                  <th className="px-6 py-4 text-center">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {orders.map(order => {
                  const totalHours = order.items.reduce((sum, item) => sum + (Number(item.hours) || 0), 0);
                  const total = totalHours * project.rateNetto;
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{order.orderNumber}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{order.title}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.priority === 'wysoki' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            order.priority === 'normalny' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                          {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-500">
                        {order.scheduleFrom || '-'} do {order.scheduleTo || '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500">{totalHours}h</td>
                      <td className="px-6 py-4 text-right font-medium text-indigo-600 dark:text-indigo-400">{total.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN</td>
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
            </table>
          </div>
        )}
      </div>

      <OrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} project={project} orderToEdit={editingOrder} onSave={handleSave} />
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
  const totalAmount = totalHours * (project?.rateNetto || 0);

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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priorytet zlecenia</label>
                <select name="priority" value={formData.priority} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition">
                  <option value="niski">Niski</option>
                  <option value="normalny">Normalny</option>
                  <option value="wysoki">Wysoki</option>
                </select>
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
                      <th className="py-3 px-4 w-32 text-right">Stawka za h</th>
                      <th className="py-3 px-4 w-36 text-right">Kwota</th>
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
                        <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                          {project?.rateNetto.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                        </td>
                        <td className="py-2 px-4 text-right font-bold text-gray-900 dark:text-gray-200 whitespace-nowrap">
                          {((item.hours || 0) * (project?.rateNetto || 0)).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
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
                      <td className="py-4 px-4 text-right text-indigo-600 dark:text-indigo-400 text-lg whitespace-nowrap">{totalAmount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</td>
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
      <Sidebar isDark={isDark} toggleDark={toggleDark} onOpenModal={handleOpenModal} />
      <DashboardView onEdit={handleEditProject} />

      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectToEdit={editingProject}
      />
    </div>
  );
};
