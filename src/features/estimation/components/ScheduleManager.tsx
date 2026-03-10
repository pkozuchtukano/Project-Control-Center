import React from 'react';
import type { Estimation } from '../../../App';
import { Plus, X, Calendar, List } from 'lucide-react';
import { generateId } from '../services/EstimationService';

interface ScheduleManagerProps {
  estimation: Estimation;
  setEstimation: React.Dispatch<React.SetStateAction<Estimation | null>>;
}

export const ScheduleManager: React.FC<ScheduleManagerProps> = ({ estimation, setEstimation }) => {
  
  const toggleMode = () => {
    setEstimation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        scheduleMode: prev.scheduleMode === 'simple' ? 'milestones' : 'simple'
      };
    });
  };

  const handleSimpleChange = (field: 'start' | 'end', value: string) => {
    setEstimation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        scheduleData: {
          ...prev.scheduleData,
          simple: { ...prev.scheduleData.simple, [field]: value }
        }
      };
    });
  };

  const updateMilestone = (id: string, field: 'name' | 'date', value: string) => {
    setEstimation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        scheduleData: {
          ...prev.scheduleData,
          milestones: prev.scheduleData.milestones.map(m => m.id === id ? { ...m, [field]: value } : m)
        }
      };
    });
  };

  const addMilestone = () => {
    setEstimation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        scheduleData: {
          ...prev.scheduleData,
          milestones: [...prev.scheduleData.milestones, { id: generateId(), name: 'Nowy etap', date: '' }]
        }
      };
    });
  };

  const removeMilestone = (id: string) => {
    setEstimation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        scheduleData: {
          ...prev.scheduleData,
          milestones: prev.scheduleData.milestones.filter(m => m.id !== id)
        }
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
        <button
          onClick={() => estimation.scheduleMode !== 'simple' && toggleMode()}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${estimation.scheduleMode === 'simple' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          <Calendar size={16} /> Uproszczony
        </button>
        <button
          onClick={() => estimation.scheduleMode !== 'milestones' && toggleMode()}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${estimation.scheduleMode === 'milestones' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          <List size={16} /> Kroki Milowe
        </button>
      </div>

      {estimation.scheduleMode === 'simple' ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Data rozpoczęcia</label>
            <input
              type="date"
              value={estimation.scheduleData.simple.start}
              onChange={e => handleSimpleChange('start', e.target.value)}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Data zakończenia</label>
            <input
              type="date"
              value={estimation.scheduleData.simple.end}
              onChange={e => handleSimpleChange('end', e.target.value)}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="space-y-3">
            {estimation.scheduleData.milestones.map(m => (
              <div key={m.id} className="flex gap-2 group">
                <input
                  value={m.name}
                  onChange={e => updateMilestone(m.id, 'name', e.target.value)}
                  placeholder="Etap..."
                  className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="date"
                  value={m.date}
                  onChange={e => updateMilestone(m.id, 'date', e.target.value)}
                  className="w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]"
                />
                <button
                  onClick={() => removeMilestone(m.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-rose-500 transition"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addMilestone}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-200 dark:border-indigo-900/50 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition"
          >
            <Plus size={14} /> DODAJ KROK
          </button>
        </div>
      )}
    </div>
  );
};
