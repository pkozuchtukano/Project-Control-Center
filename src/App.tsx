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

// ==========================================
// SERVICES
// ==========================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const getProjectCollection = () => collection(db, PROJECTS_PATH);

// ==========================================
// HOOKS
// ==========================================
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1"><span className="text-gray-400 dark:text-gray-600 font-normal mr-2">Umowa:</span>{selectedProject.contractNo}</h1>
            <h2 className="text-xl text-gray-600 dark:text-gray-400 font-medium">{selectedProject.name}</h2>
          </div>
          <button
            onClick={() => onEdit(selectedProject)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
          >
            <Edit2 size={16} /> Edytuj szczegóły
          </button>
        </div>

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
