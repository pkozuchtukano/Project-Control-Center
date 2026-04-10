import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Users, FileText, Send, CheckCircle2, Trash2, Loader2, FileDown, Sparkles, LogIn, LogOut, Key, ChevronUp, ChevronDown, Mail, Copy, Edit2, Plus, X, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import type { Project, MeetingNoteData, Stakeholder, OrderProtocolFlow, OrderProtocolStep } from '../../../types';
import { format } from 'date-fns';
import { exportNoteToWord } from '../services/wordExportService';
import { parseDateVariable } from '../../../utils/dateParsing';
import { ProjectLinksDropdown } from '../../project-links/components/ProjectLinksMain';
import { Editor } from './Editor';

interface MeetingNotesMainProps {
  project: Project;
}

const createMeetingNoteStep = (): OrderProtocolStep => ({
  id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `meeting-note-step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  description: '',
  linkUrl: '',
  linkLabel: '',
});

const stripHtmlToText = (value: string) => {
  if (!value.trim()) return '';

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(value, 'text/html');
    const blocks = Array.from(doc.body.querySelectorAll('p, li, h1, h2, h3, h4'))
      .map((element) => (element.textContent || '').replace(/\u00a0/g, ' ').trim())
      .filter(Boolean);

    if (blocks.length > 0) {
      return blocks.join('\n\n');
    }

    return (doc.body.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r/g, '')
      .trim();
  }

  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};

const createMeetingNotesFlowFromContent = (content: string): OrderProtocolFlow => {
  const plainText = stripHtmlToText(content);
  const blocks = plainText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const steps = (blocks.length > 0 ? blocks : plainText ? [plainText] : [])
    .map((description) => ({
      ...createMeetingNoteStep(),
      description,
    }));

  return {
    steps,
    completedStepIds: [],
  };
};

const normalizeMeetingNotesFlow = (flow?: OrderProtocolFlow | null): OrderProtocolFlow => ({
  steps: Array.isArray(flow?.steps)
    ? flow.steps.map((step) => ({
        id: step.id || createMeetingNoteStep().id,
        description: step.description || '',
        linkUrl: step.linkUrl || '',
        linkLabel: step.linkLabel || '',
      }))
    : [],
  completedStepIds: Array.isArray(flow?.completedStepIds)
    ? flow.completedStepIds.filter((stepId) => flow?.steps?.some((step) => step.id === stepId))
    : [],
  updatedAt: flow?.updatedAt,
});

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildMeetingNotesFlowHtml = (
  flow: OrderProtocolFlow | undefined,
  replaceVariables: (text: string) => string,
) => {
  const normalizedFlow = normalizeMeetingNotesFlow(flow);
  const visibleSteps = normalizedFlow.steps
    .map((step) => ({
      ...step,
      description: replaceVariables(step.description || '').trim(),
      linkLabel: replaceVariables(step.linkLabel || '').trim(),
      linkUrl: replaceVariables(step.linkUrl || '').trim(),
    }))
    .filter((step) => step.description || step.linkLabel || step.linkUrl);

  if (visibleSteps.length === 0) {
    return '';
  }

  const items = visibleSteps.map((step) => {
    const descriptionHtml = step.description
      ? `<div>${escapeHtml(step.description).replace(/\n/g, '<br/>')}</div>`
      : '';
    const linkHtml = step.linkUrl
      ? `<div><a href="${escapeHtml(step.linkUrl)}">${escapeHtml(step.linkLabel || step.linkUrl)}</a></div>`
      : '';

    return `<li>${descriptionHtml}${linkHtml}</li>`;
  });

  return `<ol>${items.join('')}</ol>`;
};

const extractTemplateVariables = (meetingNoteData: MeetingNoteData, steps?: OrderProtocolStep[]) => {
  const emailTemplate = meetingNoteData.emailTemplate || { to: '', cc: '', subject: '', body: '' };
  const flowSteps = steps || meetingNoteData.flow?.steps || [];
  const text = [
    meetingNoteData.titleTemplate,
    meetingNoteData.content,
    emailTemplate.to,
    emailTemplate.cc,
    emailTemplate.subject,
    emailTemplate.body,
    ...flowSteps.flatMap((step) => [step.description, step.linkLabel || '', step.linkUrl || '']),
  ].join(' ');
  const matches = Array.from(text.matchAll(/\{\{([^}]+)\}\}/g));
  const variables = new Set<string>();

  for (const match of matches) {
    variables.add(match[1]);
  }

  return Array.from(variables);
};

const applyCurrentDateVariables = (meetingNoteData: MeetingNoteData): MeetingNoteData => {
  const refreshedVariables = { ...(meetingNoteData.variables || {}) };

  extractTemplateVariables(meetingNoteData).forEach((variableName) => {
    const parsedDate = parseDateVariable(variableName);
    if (parsedDate) {
      refreshedVariables[variableName] = parsedDate;
    }
  });

  return {
    ...meetingNoteData,
    variables: refreshedVariables
  };
};

export const MeetingNotesMain = ({ project }: MeetingNotesMainProps) => {
  const [data, setData] = useState<MeetingNoteData>({
    projectId: project.id,
    titleTemplate: `Notatka ze spotkania w dniu {{data}}`,
    lastMeetingTitle: '',
    stakeholders: project.stakeholders || [],
    content: '',
    flow: { steps: [], completedStepIds: [] },
    variables: {},
    lastModified: new Date().toISOString()
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [googleAuth, setGoogleAuth] = useState<{ isAuthenticated: boolean, hasCredentials: boolean }>({ isAuthenticated: false, hasCredentials: false });
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showAuthInput, setShowAuthInput] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isFlowEditMode, setIsFlowEditMode] = useState(false);
  const [draftFlowSteps, setDraftFlowSteps] = useState<OrderProtocolStep[]>([]);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const shouldFocusEditorAfterResetRef = useRef(false);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (window.electron) {
          const savedData = await window.electron.getMeetingNotes(project.id);
          if (savedData) {
            const merged = mergeStakeholders(project.stakeholders || [], savedData.stakeholders || []);
            const restoredFlow = savedData.flow
              ? normalizeMeetingNotesFlow(savedData.flow)
              : createMeetingNotesFlowFromContent(savedData.content || '');
            setData(applyCurrentDateVariables({
              ...savedData,
              stakeholders: merged,
              flow: restoredFlow,
            }));
            setDraftFlowSteps(restoredFlow.steps);
          } else {
            // Initial state from project
            setData(prev => applyCurrentDateVariables({
              ...prev,
              stakeholders: (project.stakeholders || []).map(s => ({ ...s, isPresent: true })),
              flow: { steps: [], completedStepIds: [] },
            }));
            setDraftFlowSteps([]);
          }
        }
      } catch (error) {
        console.error('Error loading meeting notes:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
    checkGoogleStatus();
  }, [project.id, project.stakeholders]);

  const checkGoogleStatus = async () => {
    if (window.electron?.getGoogleAuthStatus) {
      const status = await window.electron.getGoogleAuthStatus();
      setGoogleAuth(status);
    }
  };

  const handleGoogleLogin = async () => {
    if (!window.electron) return;
    try {
      const url = await window.electron.getGoogleAuthUrl();
      window.open(url, '_blank');
      setShowAuthInput(true);
    } catch (error) {
      alert('Błąd pobierania URL autoryzacji: ' + error);
    }
  };

  const handleAuthorize = async () => {
    if (!window.electron || !authCode) return;
    setIsAuthenticating(true);
    try {
      await window.electron.authorizeGoogle(authCode);
      await checkGoogleStatus();
      setShowAuthInput(false);
      setAuthCode('');
      alert('Autoryzacja pomyślna!');
    } catch (error) {
      alert('Błąd autoryzacji: ' + error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogout = async () => {
    if (!window.electron) return;
    if (confirm('Czy na pewno chcesz wylogować się z Google?')) {
      await window.electron.logoutGoogle();
      await checkGoogleStatus();
    }
  };

  const mergeStakeholders = (projectS: Stakeholder[], savedS: Stakeholder[]) => {
    const merged = savedS
      .filter(ss => projectS.some(ps => ps.id === ss.id))
      .map(ss => {
        const ps = projectS.find(p => p.id === ss.id)!;
        return { ...ps, isPresent: ss.isPresent };
      });
    const newS = projectS
      .filter(ps => !savedS.some(ss => ss.id === ps.id))
      .map(ps => ({ ...ps, isPresent: true }));
    return [...merged, ...newS];
  };

  // Template Logic
  const normalizedFlow = useMemo(() => normalizeMeetingNotesFlow(data.flow), [data.flow]);
  const persistedSteps = normalizedFlow.steps;
  const completedStepIds = normalizedFlow.completedStepIds || [];
  const flowStepsForVariables = isFlowEditMode ? draftFlowSteps : persistedSteps;
  const detectedVariables = useMemo(() => {
    return extractTemplateVariables(data, flowStepsForVariables);
  }, [data, flowStepsForVariables]);

  useEffect(() => {
    if (!isFlowEditMode) {
      setDraftFlowSteps(persistedSteps);
    }
  }, [isFlowEditMode, persistedSteps]);

  const updateVariable = (name: string, value: string) => {
    setData(prev => ({
      ...prev,
      variables: {
        ...(prev.variables || {}),
        [name]: value
      }
    }));
  };

  const replaceVariables = (text: string) => {
    const vars = data.variables || {};
    return text.replace(/{{\s*([^}]+)\s*}}/g, (_match, rawVariable) => vars[String(rawVariable).trim()] || '');
  };

  const resolveMeetingNotesContent = () => {
    return replaceVariables(data.content);
  };

  // Auto-fill dates for templates
  useEffect(() => {
    let changed = false;
    const newVars = { ...(data.variables || {}) };
    detectedVariables.forEach(v => {
      if (newVars[v] === undefined || newVars[v] === '') {
        const parsedDate = parseDateVariable(v);
        if (parsedDate) {
          newVars[v] = parsedDate;
          changed = true;
        }
      }
    });
    if (changed) {
      setData(prev => ({ ...prev, variables: newVars }));
    }
  }, [detectedVariables, data.variables]);

  // Auto-save logic
  const handleSave = useCallback(async (currentData: MeetingNoteData) => {
    if (!window.electron) return;
    setIsSaving(true);
    try {
      await window.electron.saveMeetingNotes({
        projectId: project.id,
        data: { ...currentData, lastModified: new Date().toISOString() }
      });
      setLastSaved(new Date());
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [project.id]);

  // Debounced auto-save effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoading) {
        handleSave(data);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [data, handleSave, isLoading]);

  const togglePresence = (id: string) => {
    setData(prev => ({
      ...prev,
      stakeholders: prev.stakeholders.map(s => s.id === id ? { ...s, isPresent: !s.isPresent } : s)
    }));
  };

  const handleOpenFlowEditMode = () => {
    setDraftFlowSteps(persistedSteps.length > 0 ? persistedSteps : [createMeetingNoteStep()]);
    setIsFlowEditMode(true);
  };

  const handleFlowStepChange = (stepId: string, field: 'description' | 'linkUrl' | 'linkLabel', value: string) => {
    setDraftFlowSteps((current) => current.map((step) => (
      step.id === stepId
        ? { ...step, [field]: value }
        : step
    )));
  };

  const handleAddFlowStep = () => {
    setDraftFlowSteps((current) => [...current, createMeetingNoteStep()]);
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

  const handleCancelFlowEdit = () => {
    setDraftFlowSteps(persistedSteps);
    setIsFlowEditMode(false);
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

    setData((prev) => ({
      ...prev,
      flow: {
        steps: cleanedSteps,
        completedStepIds: completedStepIds.filter((stepId) => cleanedSteps.some((step) => step.id === stepId)),
        updatedAt: new Date().toISOString(),
      },
    }));
    setIsFlowEditMode(false);
  };

  const handleToggleFlowStepCompleted = (stepId: string, isCompleted: boolean) => {
    setData((prev) => {
      const currentFlow = normalizeMeetingNotesFlow(prev.flow);
      const nextCompletedStepIds = isCompleted
        ? [...new Set([...currentFlow.completedStepIds || [], stepId])]
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

  const renderResolvedFlowText = (text: string) => {
    const segments = text.split(/(\{\{[^}]+\}\})/g);

    return segments.map((segment, index) => {
      const match = segment.match(/^\{\{\s*([^}]+)\s*\}\}$/);
      if (match) {
        const resolved = replaceVariables(segment);
        return (
          <strong key={`${segment}-${index}`} className="font-bold text-gray-900 dark:text-white">
            {resolved}
          </strong>
        );
      }

      return <span key={`${segment}-${index}`}>{segment}</span>;
    });
  };

  const handleEditorChange = (content: string) => {
    setData(prev => ({ ...prev, content }));
  };

  const moveStakeholder = (e: React.MouseEvent, id: string, direction: 'up' | 'down') => {
    e.stopPropagation();
    setData(prev => {
      const arr = [...prev.stakeholders];
      const index = arr.findIndex(s => s.id === id);
      if (index === -1) return prev;
      
      const company = arr[index].company;
      let targetIndex = -1;
      
      if (direction === 'up') {
        for (let i = index - 1; i >= 0; i--) {
          if (arr[i].company === company) {
            targetIndex = i;
            break;
          }
        }
      } else {
        for (let i = index + 1; i < arr.length; i++) {
          if (arr[i].company === company) {
            targetIndex = i;
            break;
          }
        }
      }

      if (targetIndex !== -1) {
        const temp = arr[index];
        arr[index] = arr[targetIndex];
        arr[targetIndex] = temp;
      }
      
      return { ...prev, stakeholders: arr };
    });
  };

  const syncWithGoogleDocs = async () => {
    if (!project.googleDocLink) {
      alert('Brak linku do Google Docs w ustawieniach projektu!');
      return;
    }

    if (!confirm('Czy na pewno chcesz dopisać aktualną notatkę do Google Docs?')) return;

    setIsSaving(true);
    try {
      const participants = data.stakeholders
        .filter(s => s.isPresent)
        .map(s => `${s.name} (${s.role})`);

      if (window.electron) {
        // Double check auth
        const status = await window.electron.getGoogleAuthStatus();
        if (!status.isAuthenticated) {
          if (confirm('Nie jesteś zalogowany do Google. Czy chcesz zalogować się teraz?')) {
            handleGoogleLogin();
          }
          return;
        }

        const replacedContent = resolveMeetingNotesContent();
        const replacedTitle = replaceVariables(data.titleTemplate);
        
        const res = await window.electron.appendGoogleDoc({
          docLink: project.googleDocLink,
          content: replacedContent,
          title: replacedTitle,
          participants
        });

        if (res.success) {
          alert('Notatka została pomyślnie dopisana do dokumentu.');
        }
      }
    } catch (error) {
      alert('Błąd synchronizacji: ' + error);
    } finally {
      setIsSaving(false);
    }
  };

  const clearNote = () => {
    if (confirm('Czy na pewno chcesz wyczyścić treść aktualnej notatki?')) {
      setData(prev => ({
        ...prev,
        content: '',
        flow: {
          steps: [],
          completedStepIds: [],
          updatedAt: new Date().toISOString(),
        },
      }));
      setDraftFlowSteps([]);
      setIsFlowEditMode(false);
    }
  };

  const createNewNote = () => {
    if (confirm('Czy utworzy\u0107 now\u0105 notatk\u0119 na bazie obecnego uk\u0142adu? Tre\u015b\u0107 zostanie wyczyszczona, daty od\u015bwie\u017cone, a flow wr\u00f3ci do stanu pocz\u0105tkowego.')) {
      setData(prev => {
        const currentFlow = normalizeMeetingNotesFlow(prev.flow);
        const nextData = applyCurrentDateVariables({
          ...prev,
          content: '',
          flow: {
            ...currentFlow,
            completedStepIds: [],
            updatedAt: new Date().toISOString(),
          },
        });

        return {
          ...nextData,
          lastModified: new Date().toISOString(),
        };
      });
      setDraftFlowSteps(persistedSteps);
      setIsFlowEditMode(false);
      shouldFocusEditorAfterResetRef.current = true;
      setEditorResetKey((current) => current + 1);
    }
  };

  const handleCreateNewNote = () => {
    if (confirm('Czy utworzyć nową notatkę na bazie obecnego układu? Treść zostanie wyczyszczona, daty odświeżone, a flow wróci do stanu początkowego.')) {
      setData(prev => {
        const currentFlow = normalizeMeetingNotesFlow(prev.flow);
        const nextData = applyCurrentDateVariables({
          ...prev,
          content: '<p></p>',
          flow: {
            ...currentFlow,
            completedStepIds: [],
            updatedAt: new Date().toISOString(),
          },
        });

        return {
          ...nextData,
          lastModified: new Date().toISOString(),
        };
      });
      setDraftFlowSteps(persistedSteps);
      setIsFlowEditMode(false);
      setEditorResetKey((current) => current + 1);
    }
  };

  const startNewNote = () => {
    setData(prev => {
      const currentFlow = normalizeMeetingNotesFlow(prev.flow);
      const nextData = applyCurrentDateVariables({
        ...prev,
        content: '<p></p>',
        flow: {
          ...currentFlow,
          completedStepIds: [],
          updatedAt: new Date().toISOString(),
        },
      });

      return {
        ...nextData,
        lastModified: new Date().toISOString(),
      };
    });
    setDraftFlowSteps(persistedSteps);
    setIsFlowEditMode(false);
    shouldFocusEditorAfterResetRef.current = true;
    setEditorResetKey((current) => current + 1);
  };

  const handleCopyEmailField = async (text: string, id: string) => {
    const processed = replaceVariables(text);
    await navigator.clipboard.writeText(processed);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const updateEmailTemplate = (updates: Partial<NonNullable<MeetingNoteData['emailTemplate']>>) => {
    setData(prev => ({
      ...prev,
      emailTemplate: {
        ...(prev.emailTemplate || { to: '', cc: '', subject: '', body: '', variables: {} }),
        ...updates
      }
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-indigo-500" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="text-indigo-500" size={24} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notatki ze Spotkania</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Prowadź notatki i synchronizuj je z Google Docs</p>
        </div>
        
          <div className="flex flex-wrap items-center gap-2">
            <ProjectLinksDropdown project={project} visibleInTab="notes" />
            <div className="flex flex-col items-end mr-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
              {isSaving ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Zapisywanie...
                </>
              ) : lastSaved ? (
                <>
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  Zapisano: {format(lastSaved, 'HH:mm:ss')}
                </>
              ) : null}
              </div>
            </div>

            <button
              onClick={startNewNote}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40 rounded-xl text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition shadow-sm"
              title="Nowa notatka"
            >
              <Plus size={18} />
              Nowa notatka
            </button>
           
            <button
              onClick={() => exportNoteToWord(project, {
              ...data,
              content: resolveMeetingNotesContent(),
              titleTemplate: replaceVariables(data.titleTemplate)
            })}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
          >
            <FileDown size={18} className="text-blue-500" />
            Eksport do Word
          </button>
          
          <button
            onClick={syncWithGoogleDocs}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow-md shadow-indigo-200 dark:shadow-none"
          >
            <Send size={18} />
            Wyślij do Google Docs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LEFT COLUMN: FLOW */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="order-3 space-y-2">
            <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest pl-1">Tytuł spotkania / Nagłówek</label>
            <input
              value={data.titleTemplate}
              onChange={e => setData(prev => ({ ...prev, titleTemplate: e.target.value }))}
              placeholder="np. Daily PRJ-01 - 2026-03-10"
              className="w-full text-lg font-bold bg-white dark:bg-gray-800 border-none rounded-xl p-4 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
            />
          </div>

          <section className="order-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/60">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-700">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="text-indigo-500" size={18} />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Flow notatki</h3>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Lista ustaleń i działań jest prowadzona jako uporządkowany flow analogiczny do `PP/PO`.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isFlowEditMode ? (
                  <>
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
                      Zapisz flow
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenFlowEditMode}
                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                  >
                    <Edit2 size={16} />
                    Edytuj flow
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {isFlowEditMode ? (
                <>
                  {draftFlowSteps.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                      Flow nie ma jeszcze żadnych kroków. Dodaj pierwszy krok, aby zdefiniować proces notatki.
                    </div>
                  )}

                  {draftFlowSteps.map((step, index) => (
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
                            onClick={() => handleMoveFlowStep(step.id, 'up')}
                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:text-gray-300 dark:hover:text-indigo-300 dark:hover:border-indigo-700 transition"
                            title="Przesuń wyżej"
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveFlowStep(step.id, 'down')}
                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:text-gray-300 dark:hover:text-indigo-300 dark:hover:border-indigo-700 transition"
                            title="Przesuń niżej"
                          >
                            <ArrowDown size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFlowStep(step.id)}
                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-600 hover:border-red-300 dark:text-gray-300 dark:hover:text-red-300 dark:hover:border-red-700 transition"
                            title="Usuń krok"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Etykieta linku</label>
                          <input
                            type="text"
                            value={step.linkLabel || ''}
                            onChange={(event) => handleFlowStepChange(step.id, 'linkLabel', event.target.value)}
                            placeholder="np. Link do ustalenia"
                            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link</label>
                          <input
                            type="text"
                            value={step.linkUrl || ''}
                            onChange={(event) => handleFlowStepChange(step.id, 'linkUrl', event.target.value)}
                            placeholder="https://..."
                            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Opis kroku</label>
                        <textarea
                          value={step.description}
                          onChange={(event) => handleFlowStepChange(step.id, 'description', event.target.value)}
                          rows={4}
                          placeholder="Opisz czynność. Możesz używać zmiennych, np. {{data}}."
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                        />
                        {step.description && (
                          <div className="mt-2 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                            {renderResolvedFlowText(step.description)}
                          </div>
                        )}
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
                  const resolvedLinkUrl = replaceVariables(step.linkUrl || '').trim();

                  return (
                    <div
                      key={step.id}
                      className={`rounded-2xl border shadow-sm transition-all ${
                        isCompleted
                          ? 'border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800/60 dark:bg-emerald-900/10'
                          : 'border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/40'
                      }`}
                    >
                      <div className={`flex gap-4 ${isCompleted ? 'items-center' : 'items-start'}`}>
                        <div className={`w-9 h-9 rounded-full text-white text-sm font-bold flex items-center justify-center shrink-0 ${isCompleted ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                          {index + 1}
                        </div>

                        <div className={`min-w-0 flex-1 ${isCompleted ? 'space-y-0' : 'space-y-3'}`}>
                          {!isCompleted && resolvedLinkUrl && (
                            <a
                              href={resolvedLinkUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition"
                            >
                              <ExternalLink size={15} />
                              <span className="truncate">{replaceVariables(step.linkLabel || step.linkUrl || '') || 'Otwórz link'}</span>
                            </a>
                          )}
                          <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                            Krok {index + 1}
                          </div>
                          {isCompleted ? (
                            <div className="flex items-center gap-3 min-w-0">
                              <p className="text-sm leading-6 text-gray-600 dark:text-gray-300 truncate">
                                {replaceVariables(step.description || '') || 'Brak opisu kroku.'}
                              </p>
                              {resolvedLinkUrl && (
                                <a
                                  href={resolvedLinkUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition"
                                >
                                  <ExternalLink size={12} />
                                  <span>{replaceVariables(step.linkLabel || step.linkUrl || '') || 'Link'}</span>
                                </a>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm leading-6 text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                              {step.description ? renderResolvedFlowText(step.description) : 'Brak opisu kroku.'}
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
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Flow notatki jest pusty.</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Włącz edycję i dodaj pierwszy krok, ustalenie albo zadanie ze spotkania.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="order-4 space-y-2">
            <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest pl-1">Treść notatki</label>
            <Editor
              key={`meeting-notes-editor-${editorResetKey}`}
              content={data.content}
              onChange={handleEditorChange}
              stakeholders={project.stakeholders}
              onEditorReady={(editor) => {
                if (!editor || !shouldFocusEditorAfterResetRef.current) return;

                shouldFocusEditorAfterResetRef.current = false;
                requestAnimationFrame(() => {
                  editor.commands.focus('end');
                });
              }}
            />
          </section>

          <div className="order-5 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-700 pb-4">
              <Mail className="text-indigo-500" size={18} />
              <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm">{'Szablon wiadomo\u015bci E-mail'}</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'to', label: 'DO:', val: data.emailTemplate?.to || '' },
                  { id: 'cc', label: 'DW:', val: data.emailTemplate?.cc || '' },
                ].map(field => (
                  <div key={field.id} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{field.label}</label>
                      <div className="flex items-center gap-2">
                        {copiedField === field.id && (
                          <span className="text-[10px] text-emerald-500 font-bold animate-in fade-in slide-in-from-right-1">Skopiowano!</span>
                        )}
                        <button
                          onClick={() => handleCopyEmailField(field.val, field.id)}
                          className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                          title="Kopiuj z podstawieniem zmiennych"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={field.val}
                      onChange={e => updateEmailTemplate({ [field.id]: e.target.value })}
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
                      onClick={() => handleCopyEmailField(data.emailTemplate?.subject || '', 'subject')}
                      className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                      title="Kopiuj z podstawieniem zmiennych"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={data.emailTemplate?.subject || ''}
                  onChange={e => updateEmailTemplate({ subject: e.target.value })}
                  className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-sm outline-none transition-shadow font-medium w-full dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{'Tre\u015b\u0107 wiadomo\u015bci:'}</label>
                  <div className="flex items-center gap-2">
                    {copiedField === 'body' && (
                      <span className="text-[10px] text-emerald-500 font-bold animate-in fade-in slide-in-from-right-1">{'Skopiowano tre\u015b\u0107!'}</span>
                    )}
                    <button
                      onClick={() => handleCopyEmailField(data.emailTemplate?.body || '', 'body')}
                      className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"
                      title={'Kopiuj tre\u015b\u0107 z danymi'}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <textarea
                  value={data.emailTemplate?.body || ''}
                  onChange={e => updateEmailTemplate({ body: e.target.value })}
                  rows={6}
                  className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm outline-none font-sans leading-relaxed resize-none transition-shadow w-full dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* GOOGLE AUTH INPUT */}
          {showAuthInput && (
            <div className="order-6 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-6 animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-2 mb-4">
                <Key size={16} className="text-indigo-500" />
                <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-400 uppercase tracking-wider">Wprowadź kod autoryzacji z przeglądarki</h3>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={authCode}
                  onChange={e => setAuthCode(e.target.value)}
                  placeholder="Wklej kod tutaj..."
                  className="flex-1 bg-white dark:bg-gray-800 border-indigo-200/50 dark:border-indigo-900/50 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 dark:text-white"
                />
                <button
                  onClick={handleAuthorize}
                  disabled={isAuthenticating || !authCode}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {isAuthenticating ? <Loader2 className="animate-spin" size={18} /> : 'Zatwierdź'}
                </button>
                <button
                  onClick={() => setShowAuthInput(false)}
                  className="px-4 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-medium"
                >
                  Anuluj
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 italic px-1">
                Po zalogowaniu się w oknie Google, skopiuj wyświetlony kod i wklej go powyżej.
              </p>
            </div>
          )}

          {/* TEMPLATE VARIABLES UI */}
          {detectedVariables.length > 0 && (
            <div className="order-1 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-6 animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-amber-500" />
                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Uzupełnij zmienne z szablonu</h3>
              </div>
              <p className="text-[10px] text-amber-700/80 mb-4 px-1 leading-relaxed">
                Składnia dat wspiera np. <strong>{`{{data}}`}</strong> dla dziś, a także: <strong>{`{{data+3d}}`}</strong> (+3 dni), <strong>{`{{data-1w}}`}</strong> (-1 tydzień), <strong>{`{{data+2m}}`}</strong> (+2 miesiące).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {detectedVariables.map(v => {
                  const isDate = parseDateVariable(v) !== null;
                  const value = data.variables?.[v] || '';
                  
                  return (
                    <div key={v} className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-amber-600/70 dark:text-amber-500/70 uppercase tracking-widest px-1">{v}</label>
                      {isDate ? (
                        <input
                          type="date"
                          value={value.split('.').reverse().join('-') || ''}
                          onChange={e => {
                            const val = e.target.value;
                            if (val) {
                              const [y, m, d] = val.split('-');
                              updateVariable(v, `${d}.${m}.${y}`);
                            } else {
                              updateVariable(v, '');
                            }
                          }}
                          className="w-full bg-white dark:bg-gray-800 border-amber-200/50 dark:border-amber-900/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400 dark:text-white transition"
                        />
                      ) : (
                        <input
                          type="text"
                          value={value}
                          onChange={e => updateVariable(v, e.target.value)}
                          placeholder={`Wpisz: ${v}`}
                          className="w-full bg-white dark:bg-gray-800 border-amber-200/50 dark:border-amber-900/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400 dark:text-white transition"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: STAKEHOLDERS & INFO */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <Users className="text-indigo-500" size={18} />
              <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm">Lista obecności</h3>
            </div>
            
            <div className="space-y-4">
              {data.stakeholders.length === 0 ? (
                <p className="text-xs text-center text-gray-400 py-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl leading-relaxed">
                  Brak przypisanych osób.<br/>Dodaj je w ustawieniach projektu.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-1">Zamawiający</h4>
                    {data.stakeholders.filter(s => s.company === 'customer').length === 0 && (
                       <p className="text-xs text-gray-400 italic px-1">Brak osób</p>
                    )}
                    {data.stakeholders.filter(s => s.company === 'customer').map(s => (
                      <div
                        key={s.id}
                        className={`w-full flex items-center justify-between p-2 rounded-xl transition-all border ${
                          s.isPresent
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-300'
                            : 'bg-gray-50 border-gray-100 text-gray-400 dark:bg-gray-900/50 dark:border-gray-800 dark:text-gray-600 grayscale'
                        }`}
                      >
                        <button className="flex-1 flex flex-col items-start text-left px-1 outline-none" onClick={() => togglePresence(s.id)}>
                          <span className="text-sm font-bold truncate max-w-[140px]">{s.name}</span>
                          <span className="text-[10px] font-medium opacity-70 uppercase tracking-tight">{s.role}</span>
                        </button>
                        <div className="flex items-center gap-2">
                          {s.isPresent ? <CheckCircle2 size={18} className="cursor-pointer" onClick={() => togglePresence(s.id)} /> : <div className="w-[18px] h-[18px] border-2 border-current rounded-full opacity-20 cursor-pointer" onClick={() => togglePresence(s.id)} />}
                          <div className="flex flex-col border-l border-current/10 pl-2">
                            <button onClick={(e) => moveStakeholder(e, s.id, 'up')} className="hover:text-indigo-600 transition p-0.5" title="Przesuń w górę">
                              <ChevronUp size={14} />
                            </button>
                            <button onClick={(e) => moveStakeholder(e, s.id, 'down')} className="hover:text-indigo-600 transition p-0.5" title="Przesuń w dół">
                              <ChevronDown size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-1">Wykonawca</h4>
                    {data.stakeholders.filter(s => s.company === 'contractor').length === 0 && (
                       <p className="text-xs text-gray-400 italic px-1">Brak osób</p>
                    )}
                    {data.stakeholders.filter(s => s.company === 'contractor').map(s => (
                      <div
                        key={s.id}
                        className={`w-full flex items-center justify-between p-2 rounded-xl transition-all border ${
                          s.isPresent
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-300'
                            : 'bg-gray-50 border-gray-100 text-gray-400 dark:bg-gray-900/50 dark:border-gray-800 dark:text-gray-600 grayscale'
                        }`}
                      >
                        <button className="flex-1 flex flex-col items-start text-left px-1 outline-none" onClick={() => togglePresence(s.id)}>
                          <span className="text-sm font-bold truncate max-w-[140px]">{s.name}</span>
                          <span className="text-[10px] font-medium opacity-70 uppercase tracking-tight">{s.role}</span>
                        </button>
                        <div className="flex items-center gap-2">
                          {s.isPresent ? <CheckCircle2 size={18} className="cursor-pointer" onClick={() => togglePresence(s.id)} /> : <div className="w-[18px] h-[18px] border-2 border-current rounded-full opacity-20 cursor-pointer" onClick={() => togglePresence(s.id)} />}
                          <div className="flex flex-col border-l border-current/10 pl-2">
                            <button onClick={(e) => moveStakeholder(e, s.id, 'up')} className="hover:text-indigo-600 transition p-0.5" title="Przesuń w górę">
                              <ChevronUp size={14} />
                            </button>
                            <button onClick={(e) => moveStakeholder(e, s.id, 'down')} className="hover:text-indigo-600 transition p-0.5" title="Przesuń w dół">
                              <ChevronDown size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* GOOGLE DOCS LINK BOX */}
          <div className={`rounded-2xl p-6 shadow-sm border ${project.googleDocLink ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-800' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30'}`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm">Dokument Google</h4>
              <div className="flex gap-1">
                {googleAuth.isAuthenticated ? (
                  <button onClick={handleGoogleLogout} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Wyloguj z Google">
                    <LogOut size={14} />
                  </button>
                ) : (
                  <button onClick={handleGoogleLogin} className="p-1 text-indigo-500 hover:text-indigo-600 transition-colors" title="Zaloguj do Google">
                    <LogIn size={14} />
                  </button>
                )}
              </div>
            </div>
            {project.googleDocLink ? (
              <div className="space-y-3">
                <a 
                  href={project.googleDocLink} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xs text-indigo-500 hover:text-indigo-600 font-medium break-all underline underline-offset-4 block"
                >
                  Otwórz dokument projektu ↗
                </a>
                {!googleAuth.isAuthenticated && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/20 p-2 rounded-lg italic">
                    Wymagane zalogowanie, aby móc synchronizować notatki.
                  </p>
                )}
                {googleAuth.isAuthenticated && (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 size={10} /> Połączono z Google Docs
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Brak skonfigurowanego linku. Dodaj go w edycji projektu.</p>
            )}
          </div>
        </div>
      </div>

      {/* EMAIL TEMPLATE UI */}
      <div className="hidden">
        <div className="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-700 pb-4">
          <Mail className="text-indigo-500" size={18} />
          <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm">Szablon wiadomości E-mail</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: 'to', label: 'DO:', val: data.emailTemplate?.to || '' },
              { id: 'cc', label: 'DW:', val: data.emailTemplate?.cc || '' },
            ].map(field => (
              <div key={field.id} className="flex flex-col gap-1">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{field.label}</label>
                  <div className="flex items-center gap-2">
                    {copiedField === field.id && (
                      <span className="text-[10px] text-emerald-500 font-bold animate-in fade-in slide-in-from-right-1">Skopiowano!</span>
                    )}
                    <button
                      onClick={() => handleCopyEmailField(field.val, field.id)}
                      className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                      title="Kopiuj z podstawieniem zmiennych"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={field.val}
                  onChange={e => updateEmailTemplate({ [field.id]: e.target.value })}
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
                  onClick={() => handleCopyEmailField(data.emailTemplate?.subject || '', 'subject')}
                  className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                  title="Kopiuj z podstawieniem zmiennych"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>
            <input
              type="text"
              value={data.emailTemplate?.subject || ''}
              onChange={e => updateEmailTemplate({ subject: e.target.value })}
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
                  onClick={() => handleCopyEmailField(data.emailTemplate?.body || '', 'body')}
                  className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"
                  title="Kopiuj treść z danymi"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <textarea
              value={data.emailTemplate?.body || ''}
              onChange={e => updateEmailTemplate({ body: e.target.value })}
              rows={6}
              className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm outline-none font-sans leading-relaxed resize-none transition-shadow w-full dark:text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
