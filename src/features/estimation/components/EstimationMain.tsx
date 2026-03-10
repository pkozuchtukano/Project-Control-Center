import React, { useState, useEffect } from 'react';
import type { Project, Estimation } from '../../../App';
import { Loader2, Calculator, Save, Copy, RotateCcw } from 'lucide-react';
import { EstimationTable } from './EstimationTable';
import { ScheduleManager } from './ScheduleManager';
import { createDefaultEstimation, formatEstimationToHTML, formatScheduleToHTML } from '../services/EstimationService';

interface EstimationMainProps {
  project: Project | null;
}

export const EstimationMain: React.FC<EstimationMainProps> = ({ project }) => {
  const [estimation, setEstimation] = useState<Estimation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBrutto, setIsBrutto] = useState(true);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const skipNextSave = React.useRef(true);

  useEffect(() => {
    const loadEstimation = async () => {
      if (!project) return;
      setIsLoading(true);
      skipNextSave.current = true;
      try {
        const data = await window.electron?.getEstimation(project.id);
        if (data) {
          setEstimation(data);
          setLastSaved(data.lastModified);
        } else {
          const defaultValue = createDefaultEstimation(project.id);
          setEstimation(defaultValue);
        }
      } catch (error) {
        console.error('Error loading estimation:', error);
        alert('Błąd podczas ładowania wyceny.');
      } finally {
        setIsLoading(false);
      }
    };

    loadEstimation();
  }, [project?.id]);

  // Auto-save logic
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const timer = setTimeout(() => {
      handleSave();
    }, 1500); // 1.5s debounce

    return () => clearTimeout(timer);
  }, [estimation]);

  const handleSave = async (updatedEstimation?: Estimation) => {
    const toSave = updatedEstimation || estimation;
    if (!project || !toSave) return;
    
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      await window.electron?.saveEstimation({ 
        projectId: project.id, 
        data: { ...toSave, lastModified: now } 
      });
      setLastSaved(now);
    } catch (error) {
      console.error('Error saving estimation:', error);
      // Don't alert on auto-save to avoid interrupting typing, just log
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyTable = async () => {
    if (!estimation || !project) return;
    const html = formatEstimationToHTML(estimation, project.rateNetto, isBrutto);
    await window.electron?.writeClipboardHtml(html);
    alert('Tabela wyceny skopiowana do schowka (HTML).');
  };

  const handleCopySchedule = async () => {
    if (!estimation) return;
    const html = formatScheduleToHTML(estimation);
    await window.electron?.writeClipboardHtml(html);
    alert('Harmonogram skopiowany do schowka (HTML).');
  };

  const handleReset = () => {
    if (project && confirm('Czy na pewno chcesz zresetować wycenę do domyślnych wartości?')) {
      const defaultValue = createDefaultEstimation(project.id);
      setEstimation(defaultValue);
      handleSave(defaultValue);
    }
  };

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-500">
        <Calculator size={48} className="mb-4 opacity-20" />
        <p>Wybierz projekt z listy po lewej, aby przygotować wycenę.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  if (!estimation) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
            <Calculator className="text-indigo-500" /> Wycena i Harmonogram
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Przygotuj ofertę dla projektu: {project.code}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
              {isSaving ? (
                <span className="text-indigo-500 flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" /> Zapisywanie...
                </span>
              ) : lastSaved ? (
                <span className="text-emerald-500 flex items-center gap-1">
                  <Save size={12} /> Zapisano
                </span>
              ) : null}
            </div>
            {lastSaved && !isSaving && (
              <span className="text-[10px] text-gray-400">
                {new Date(lastSaved).toLocaleTimeString()}
              </span>
            )}
          </div>

          <button
            onClick={handleReset}
            className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
            title="Resetuj do domyślnych"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ESTIMATION TABLE */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
              <h3 className="font-bold text-gray-900 dark:text-white">Kalkulator Roboczogodzin</h3>
              <button
                onClick={handleCopyTable}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition"
              >
                <Copy size={14} /> Kopiuj
              </button>
            </div>
            <EstimationTable 
              estimation={estimation} 
              setEstimation={setEstimation} 
              project={project}
              isBrutto={isBrutto}
              setIsBrutto={setIsBrutto}
            />
          </div>
        </div>

        {/* SCHEDULE & SUMMARY */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
              <h3 className="font-bold text-gray-900 dark:text-white">Harmonogram</h3>
              <button
                onClick={handleCopySchedule}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition"
              >
                <Copy size={14} /> Kopiuj
              </button>
            </div>
            <div className="p-6">
              <ScheduleManager 
                estimation={estimation} 
                setEstimation={setEstimation} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
