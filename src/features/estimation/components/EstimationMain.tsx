import React, { useState, useEffect } from 'react';
import type { Project, Estimation, OrderProtocolFlow, OrderProtocolStep } from '../../../types';
import { FileSpreadsheet, Loader2, Calculator, Save, Copy, RotateCcw, Mail, Edit2, Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2, X, ExternalLink, ListChecks } from 'lucide-react';
import { EstimationTable } from './EstimationTable';
import { ScheduleManager } from './ScheduleManager';
import { EmailTemplateSection } from './EmailTemplateSection';
import { createDefaultEstimation, formatEstimationToHTML, formatScheduleToHTML, resolveEstimationTemplate } from '../services/EstimationService';
import { exportEstimationToExcel } from '../services/estimationExcelService';
import { ProjectLinksDropdown } from '../../project-links/components/ProjectLinksMain';

interface EstimationMainProps {
  project: Project | null;
}

const createEstimationFlowStep = (): OrderProtocolStep => ({
  id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `estimation-flow-step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  description: '',
  linkUrl: '',
  linkLabel: '',
});

const normalizeEstimationFlow = (flow?: OrderProtocolFlow | null): OrderProtocolFlow => {
  const steps = Array.isArray(flow?.steps)
    ? flow.steps.map((step) => ({
        id: step.id || createEstimationFlowStep().id,
        description: step.description || '',
        linkUrl: step.linkUrl || '',
        linkLabel: step.linkLabel || '',
      }))
    : [];

  return {
    steps,
    completedStepIds: Array.isArray(flow?.completedStepIds)
      ? flow.completedStepIds.filter((stepId) => steps.some((step) => step.id === stepId))
      : [],
    updatedAt: flow?.updatedAt,
  };
};

export const EstimationMain: React.FC<EstimationMainProps> = ({ project }) => {
  const [estimation, setEstimation] = useState<Estimation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBrutto, setIsBrutto] = useState(true);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'table' | 'schedule' | null>(null);
  const [isFlowEditMode, setIsFlowEditMode] = useState(false);
  const [draftFlowSteps, setDraftFlowSteps] = useState<OrderProtocolStep[]>([]);
  const skipNextSave = React.useRef(true);

  useEffect(() => {
    const loadEstimation = async () => {
      if (!project) return;
      setIsLoading(true);
      skipNextSave.current = true;
      try {
        const data = await window.electron?.getEstimation(project.id);
        if (data) {
          const normalizedData = {
            ...data,
            flow: normalizeEstimationFlow(data.flow),
          };
          setEstimation(normalizedData);
          setDraftFlowSteps(normalizedData.flow.steps);
          setLastSaved(data.lastModified);
        } else {
          const defaultValue = createDefaultEstimation(project.id);
          setEstimation(defaultValue);
          setDraftFlowSteps(normalizeEstimationFlow(defaultValue.flow).steps);
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

  const normalizedFlow = React.useMemo(() => normalizeEstimationFlow(estimation?.flow), [estimation?.flow]);
  const persistedSteps = normalizedFlow.steps;
  const completedStepIds = normalizedFlow.completedStepIds || [];
  const estimationVariableOverrides = estimation?.emailTemplate?.variables || {};

  useEffect(() => {
    if (!isFlowEditMode) {
      setDraftFlowSteps(persistedSteps);
    }
  }, [isFlowEditMode, persistedSteps]);

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
    await window.electron?.writeClipboardHtml({ html });
    setCopiedType('table');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopySchedule = async () => {
    if (!estimation) return;
    const html = formatScheduleToHTML(estimation);
    await window.electron?.writeClipboardHtml({ html });
    setCopiedType('schedule');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleExportExcel = () => {
    if (!estimation || !project) return;
    exportEstimationToExcel(estimation, project, isBrutto);
  };

  const handleReset = () => {
    if (project && confirm('Czy na pewno chcesz zresetować wycenę do domyślnych wartości?')) {
      const defaultValue = createDefaultEstimation(project.id);
      setEstimation(defaultValue);
      setDraftFlowSteps(normalizeEstimationFlow(defaultValue.flow).steps);
      setIsFlowEditMode(false);
      handleSave(defaultValue);
    }
  };

  const handleOpenFlowEditMode = () => {
    setDraftFlowSteps(persistedSteps.length > 0 ? persistedSteps : [createEstimationFlowStep()]);
    setIsFlowEditMode(true);
  };

  const handleCancelFlowEdit = () => {
    setDraftFlowSteps(persistedSteps);
    setIsFlowEditMode(false);
  };

  const handleFlowStepChange = (stepId: string, field: 'description' | 'linkUrl' | 'linkLabel', value: string) => {
    setDraftFlowSteps((current) => current.map((step) => (
      step.id === stepId
        ? { ...step, [field]: value }
        : step
    )));
  };

  const handleAddFlowStep = () => {
    setDraftFlowSteps((current) => [...current, createEstimationFlowStep()]);
  };

  const handleRemoveFlowStep = (stepId: string) => {
    setDraftFlowSteps((current) => current.filter((step) => step.id !== stepId));
  };

  const handleMoveFlowStep = (stepId: string, direction: 'up' | 'down') => {
    setDraftFlowSteps((current) => {
      const index = current.findIndex((step) => step.id === stepId);
      if (index < 0) return current;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      const [movedStep] = next.splice(index, 1);
      next.splice(targetIndex, 0, movedStep);
      return next;
    });
  };

  const handleSaveFlow = () => {
    const cleanedSteps = draftFlowSteps
      .map((step) => ({
        ...step,
        description: step.description.trim(),
        linkUrl: step.linkUrl?.trim() || '',
        linkLabel: step.linkLabel?.trim() || '',
      }))
      .filter((step) => step.description || step.linkUrl || step.linkLabel);

    setEstimation((prev) => prev
      ? {
          ...prev,
          flow: {
            steps: cleanedSteps,
            completedStepIds: completedStepIds.filter((stepId) => cleanedSteps.some((step) => step.id === stepId)),
            updatedAt: new Date().toISOString(),
          },
        }
      : prev);
    setIsFlowEditMode(false);
  };

  const handleToggleFlowStepCompleted = (stepId: string, isCompleted: boolean) => {
    setEstimation((prev) => {
      if (!prev) return prev;

      const currentFlow = normalizeEstimationFlow(prev.flow);
      const nextCompletedStepIds = isCompleted
        ? [...new Set([...(currentFlow.completedStepIds || []), stepId])]
        : (currentFlow.completedStepIds || []).filter((id) => id !== stepId);

      return {
        ...prev,
        flow: {
          ...currentFlow,
          completedStepIds: nextCompletedStepIds,
          updatedAt: new Date().toISOString(),
        },
      };
    });
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
          <ProjectLinksDropdown project={project} visibleInTab="estimation" />
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

          <div className="w-px h-8 bg-gray-100 dark:bg-gray-700 mx-1" />

          <button
            onClick={handleExportExcel}
            className="p-2 text-gray-400 hover:text-emerald-500 transition-colors"
            title="Eksportuj do Excel"
          >
            <FileSpreadsheet size={20} />
          </button>

          <button
            onClick={handleReset}
            className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
            title="Resetuj do domyślnych"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.55fr)] gap-6 items-start">
        {/* ESTIMATION TABLE */}
        <div className="order-2 xl:order-none xl:col-start-2 xl:row-start-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
              <h3 className="font-bold text-gray-900 dark:text-white">Kalkulator Roboczogodzin</h3>
              <div className="flex items-center gap-2">
                {copiedType === 'table' && (
                  <span className="text-xs text-emerald-500 font-bold animate-in fade-in slide-in-from-right-1">Skopiowano!</span>
                )}
                <button
                  onClick={handleCopyTable}
                  className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"
                  title="Kopiuj tabelę"
                >
                  <Copy size={16} />
                </button>
              </div>
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
        <div className="contents">
          <div className="order-3 xl:order-none xl:col-start-2 xl:row-start-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
              <h3 className="font-bold text-gray-900 dark:text-white">Harmonogram</h3>
              <div className="flex items-center gap-2">
                {copiedType === 'schedule' && (
                  <span className="text-xs text-emerald-500 font-bold animate-in fade-in slide-in-from-right-1">Skopiowano!</span>
                )}
                <button
                  onClick={handleCopySchedule}
                  className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"
                  title="Kopiuj harmonogram"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
            <div className="p-6">
              <ScheduleManager 
                estimation={estimation} 
                setEstimation={setEstimation} 
              />
            </div>
          </div>

          <div className="order-1 xl:order-none xl:col-start-1 xl:row-start-1 xl:row-span-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-4 bg-gray-50/50 dark:bg-gray-900/50">
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ListChecks className="text-indigo-500" size={18} />
                  Flow wyceny
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Kroki obsługi wyceny analogiczne do flow PP/PO.
                </p>
              </div>
              {isFlowEditMode ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancelFlowEdit}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <X size={16} />
                    Anuluj
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFlow}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    <CheckCircle2 size={16} />
                    Zapisz
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenFlowEditMode}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                >
                  <Edit2 size={16} />
                  Edytuj flow
                </button>
              )}
            </div>

            <div className="p-4 space-y-4">
              {isFlowEditMode ? (
                <>
                  {draftFlowSteps.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      Flow wyceny jest pusty. Dodaj pierwszy krok procesu.
                    </div>
                  )}

                  {draftFlowSteps.map((step, index) => (
                    <div key={step.id} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 space-y-4 dark:border-gray-700 dark:bg-gray-900/40">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                            {index + 1}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">Krok {index + 1}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Opis, opcjonalna etykieta i link.</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveFlowStep(step.id, 'up')}
                            className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
                            title="Przesuń wyżej"
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveFlowStep(step.id, 'down')}
                            className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
                            title="Przesuń niżej"
                          >
                            <ArrowDown size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFlowStep(step.id)}
                            className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-red-300 hover:text-red-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-red-700 dark:hover:text-red-300"
                            title="Usuń krok"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Etykieta linku</label>
                          <input
                            type="text"
                            value={step.linkLabel || ''}
                            onChange={(event) => handleFlowStepChange(step.id, 'linkLabel', event.target.value)}
                            placeholder="np. Oferta w CRM"
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Link</label>
                          <input
                            type="text"
                            value={step.linkUrl || ''}
                            onChange={(event) => handleFlowStepChange(step.id, 'linkUrl', event.target.value)}
                            placeholder="https://..."
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Opis kroku</label>
                        <textarea
                          value={step.description}
                          onChange={(event) => handleFlowStepChange(step.id, 'description', event.target.value)}
                          rows={3}
                          placeholder="Opisz czynność w procesie wyceny."
                          className="w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddFlowStep}
                    className="inline-flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/60 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                  >
                    <Plus size={16} />
                    Dodaj krok flow
                  </button>
                </>
              ) : persistedSteps.length > 0 ? (
                persistedSteps.map((step, index) => {
                  const isCompleted = completedStepIds.includes(step.id);
                  const linkUrl = resolveEstimationTemplate(step.linkUrl || '', estimation, project, estimationVariableOverrides).trim();
                  const linkLabel = resolveEstimationTemplate(step.linkLabel || '', estimation, project, estimationVariableOverrides).trim();
                  const description = resolveEstimationTemplate(step.description || '', estimation, project, estimationVariableOverrides);

                  return (
                    <div
                      key={step.id}
                      className={`rounded-2xl border shadow-sm transition-all ${
                        isCompleted
                          ? 'border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800/60 dark:bg-emerald-900/10'
                          : 'border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${isCompleted ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                            Krok {index + 1}
                          </div>
                          <p className={`whitespace-pre-wrap text-sm leading-6 ${isCompleted ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>
                            {description || 'Brak opisu kroku.'}
                          </p>
                          {linkUrl && (
                            <a
                              href={linkUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex max-w-full items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                            >
                              <ExternalLink size={15} className="shrink-0" />
                              <span className="truncate">{linkLabel || linkUrl}</span>
                            </a>
                          )}
                        </div>
                        <label
                          className={`inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-all ${
                            isCompleted
                              ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'border-gray-200 bg-white text-gray-400 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300'
                          }`}
                          title="Wykonane"
                        >
                          <input
                            type="checkbox"
                            checked={isCompleted}
                            onChange={(event) => handleToggleFlowStepCompleted(step.id, event.target.checked)}
                            className="sr-only"
                          />
                          <CheckCircle2 size={18} className={isCompleted ? '' : 'opacity-55'} />
                        </label>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center dark:border-gray-700 dark:bg-gray-900/40">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Flow wyceny jest pusty.</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Włącz edycję i dodaj kroki procesu wyceny.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* EMAIL TEMPLATE SECTION */}
      <div className="order-4 xl:order-none xl:col-start-2 xl:row-start-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Mail className="text-indigo-500" size={18} /> Szablon wiadomości E-mail
          </h3>
        </div>
        <EmailTemplateSection 
          estimation={estimation}
          project={project}
          flowSteps={isFlowEditMode ? draftFlowSteps : persistedSteps}
          setEstimation={setEstimation}
        />
      </div>
      </div>
    </div>
  );
};
