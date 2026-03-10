import { useEffect, useState, useCallback, useMemo } from 'react';
import { Users, FileText, Send, CheckCircle2, Trash2, Loader2, FileDown, Sparkles, LogIn, LogOut, Key } from 'lucide-react';
import { type Project, type MeetingNoteData, type Stakeholder } from '../../../App';
import { Editor } from './Editor';
import { format } from 'date-fns';
import { exportNoteToWord } from '../services/wordExportService';

interface MeetingNotesMainProps {
  project: Project;
}

export const MeetingNotesMain = ({ project }: MeetingNotesMainProps) => {
  const [data, setData] = useState<MeetingNoteData>({
    projectId: project.id,
    titleTemplate: `Notatka ze spotkania w dniu {{data}}`,
    lastMeetingTitle: '',
    stakeholders: project.stakeholders || [],
    content: '',
    variables: {},
    lastModified: new Date().toISOString()
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [googleAuth, setGoogleAuth] = useState<{ isAuthenticated: boolean, hasCredentials: boolean }>({ isAuthenticated: false, hasCredentials: false });
  const [showAuthInput, setShowAuthInput] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (window.electron) {
          const savedData = await window.electron.getMeetingNotes(project.id);
          if (savedData) {
            const merged = mergeStakeholders(project.stakeholders || [], savedData.stakeholders || []);
            setData({
              ...savedData,
              stakeholders: merged
            });
          } else {
            // Initial state from project
            setData(prev => ({
              ...prev,
              stakeholders: (project.stakeholders || []).map(s => ({ ...s, isPresent: true }))
            }));
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
    return projectS.map(ps => {
      const saved = savedS.find(ss => ss.id === ps.id);
      return { ...ps, isPresent: saved ? saved.isPresent : true };
    });
  };

  // Template Logic
  const detectedVariables = useMemo(() => {
    const text = `${data.titleTemplate} ${data.content}`;
    const matches = Array.from(text.matchAll(/\{\{([^}]+)\}\}/g));
    const vars = new Set<string>();
    for (const match of matches) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  }, [data.titleTemplate, data.content]);

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
    let result = text;
    const vars = data.variables || {};
    detectedVariables.forEach(v => {
      const val = vars[v] || '';
      result = result.split(`{{${v}}}`).join(val);
    });
    return result;
  };

  // Auto-fill dates for templates
  useEffect(() => {
    let changed = false;
    const newVars = { ...(data.variables || {}) };
    detectedVariables.forEach(v => {
      if (newVars[v] === undefined || newVars[v] === '') {
        if (v.toLowerCase().includes('data')) {
          newVars[v] = format(new Date(), 'dd.MM.yyyy');
          changed = true;
        }
      }
    });
    if (changed) {
      setData(prev => ({ ...prev, variables: newVars }));
    }
  }, [detectedVariables]);

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

  const handleEditorChange = (content: string) => {
    setData(prev => ({ ...prev, content }));
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

        const replacedContent = replaceVariables(data.content);
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
      setData(prev => ({ ...prev, content: '' }));
    }
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
            onClick={clearNote}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Wyczyść notatkę"
          >
            <Trash2 size={20} />
          </button>
          
          <button
            onClick={() => exportNoteToWord(project, {
              ...data,
              content: replaceVariables(data.content),
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
        {/* LEFT COLUMN: EDITOR */}
        <div className="lg:col-span-3 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest pl-1">Tytuł spotkania / Nagłówek</label>
            <input
              value={data.titleTemplate}
              onChange={e => setData(prev => ({ ...prev, titleTemplate: e.target.value }))}
              placeholder="np. Daily PRJ-01 - 2026-03-10"
              className="w-full text-lg font-bold bg-white dark:bg-gray-800 border-none rounded-xl p-4 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
            />
          </div>

          <Editor content={data.content} onChange={handleEditorChange} stakeholders={project.stakeholders} />

          {/* GOOGLE AUTH INPUT */}
          {showAuthInput && (
            <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-6 animate-in slide-in-from-top duration-300">
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
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-6 animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-amber-500" />
                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Uzupełnij zmienne z szablonu</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {detectedVariables.map(v => {
                  const isDate = v.toLowerCase().includes('data');
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
                      <button
                        key={s.id}
                        onClick={() => togglePresence(s.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${
                          s.isPresent
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-300'
                            : 'bg-gray-50 border-gray-100 text-gray-400 dark:bg-gray-900/50 dark:border-gray-800 dark:text-gray-600 grayscale'
                        }`}
                      >
                        <div className="flex flex-col items-start text-left">
                          <span className="text-sm font-bold truncate max-w-[140px]">{s.name}</span>
                          <span className="text-[10px] font-medium opacity-70 uppercase tracking-tight">{s.role}</span>
                        </div>
                        {s.isPresent ? <CheckCircle2 size={18} /> : <div className="w-[18px] h-[18px] border-2 border-current rounded-full opacity-20" />}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-1">Wykonawca</h4>
                    {data.stakeholders.filter(s => s.company === 'contractor').length === 0 && (
                       <p className="text-xs text-gray-400 italic px-1">Brak osób</p>
                    )}
                    {data.stakeholders.filter(s => s.company === 'contractor').map(s => (
                      <button
                        key={s.id}
                        onClick={() => togglePresence(s.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${
                          s.isPresent
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-300'
                            : 'bg-gray-50 border-gray-100 text-gray-400 dark:bg-gray-900/50 dark:border-gray-800 dark:text-gray-600 grayscale'
                        }`}
                      >
                        <div className="flex flex-col items-start text-left">
                          <span className="text-sm font-bold truncate max-w-[140px]">{s.name}</span>
                          <span className="text-[10px] font-medium opacity-70 uppercase tracking-tight">{s.role}</span>
                        </div>
                        {s.isPresent ? <CheckCircle2 size={18} /> : <div className="w-[18px] h-[18px] border-2 border-current rounded-full opacity-20" />}
                      </button>
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
    </div>
  );
};
