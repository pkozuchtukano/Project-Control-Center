import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, ArrowUp, MessageSquare } from 'lucide-react';
import { useProjectContext } from '../../../context/ProjectContext';
import type { DailySection } from '../../../types';
import { getSmartDateRange } from '../utils/dailyUtils';
import { DailySectionColumn } from './DailySectionColumn';
import { useYouTrack } from '../../../hooks/useYouTrack';
import type { IssueWithHistory } from '../../../services/youtrackApi';

interface DailyBoardProps {
  hubId: string;
  projectCodes: string;
}

export const DailyBoard = ({ hubId, projectCodes }: DailyBoardProps) => {
  const { settings } = useProjectContext();
  const boardRef = useRef<HTMLDivElement>(null);
  
  // Dates logic (Smart Date Range)
  const { from: initialFrom, to: initialTo } = useMemo(() => getSmartDateRange(), []);
  const [dateFrom] = useState(initialFrom);
  const [dateTo] = useState(initialTo);

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [showOnlyCommented, setShowOnlyCommented] = useState(false);
  const [isGlobalExpanded, setIsGlobalExpanded] = useState(false);

  const { data: issues, isLoading, error: fetchError, fetchHistory } = useYouTrack();

  const [comments, setComments] = useState<Record<string, string>>({});
  const [issueStates, setIssueStates] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('daily_collapsed_sections');
    return saved ? JSON.parse(saved) : { fixed_aktywnosci: false };
  });

  const [dynamicSections, setDynamicSections] = useState<DailySection[]>([]);

  // Load configuration and data
  useEffect(() => {
    const loadConfig = async () => {
      if (window.electron) {
        const sections = await window.electron.getDailySections(hubId);
        setDynamicSections(sections);
      }
    };
    loadConfig();
  }, [hubId]);

  useEffect(() => {
    const loadData = async () => {
      if (window.electron) {
        const savedComments = (await window.electron.getDailyComments()) as Record<string, string>;
        const savedStates = (await window.electron.getDailyIssueStates()) as Record<string, boolean>;
        setComments(savedComments);
        setIssueStates(savedStates);
      }
    };
    loadData();
  }, []);

  const sections = useMemo<DailySection[]>(() => {
    const fixed: DailySection = { 
      id: 'fixed_aktywnosci', 
      hubId, 
      name: 'Aktywności', 
      youtrackStatuses: '', 
      orderIndex: -1 
    };
    return [fixed, ...dynamicSections];
  }, [hubId, dynamicSections]);

  useEffect(() => {
    localStorage.setItem('daily_collapsed_sections', JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  const projects = useMemo(() => {
    const foundCodes = new Set<string>();
    issues.forEach((i: IssueWithHistory) => {
      if (i.project?.shortName) {
        foundCodes.add(i.project.shortName.toUpperCase());
      }
    });
    
    const configuredCodes = projectCodes.split(',').map(p => p.trim().toUpperCase());
    
    // Default to first project if none selected
    if (!selectedProject && configuredCodes.length > 0) {
      const firstProject = configuredCodes.find(code => foundCodes.has(code));
      if (firstProject) setSelectedProject(firstProject);
    }
    
    return configuredCodes.filter(code => foundCodes.has(code));
  }, [issues, projectCodes, selectedProject]);

  const uniqueAssignees = useMemo(() => {
    const aMap = new Map<string, { name: string; projects: Set<string> }>();
    let hasUnassigned = false;
    const unassignedProjects = new Set<string>();

    issues.forEach((i: IssueWithHistory) => {
      const assignee = (i as any).assignee;
      const projectShortName = i.project?.shortName;

      if (assignee) {
        const id = assignee.id || assignee.login;
        const name = assignee.fullName || assignee.name;
        
        if (!aMap.has(id)) {
          aMap.set(id, { name, projects: new Set() });
        }
        if (projectShortName) {
          aMap.get(id)!.projects.add(projectShortName);
        }
      } else {
        hasUnassigned = true;
        if (projectShortName) {
          unassignedProjects.add(projectShortName);
        }
      }
    });

    const sortedList = Array.from(aMap.entries()).sort((a,b) => a[1].name.localeCompare(b[1].name));
    
    if (hasUnassigned) {
      return [...sortedList, ['__unassigned__', { name: 'Nieprzypisane', projects: unassignedProjects }]] as [string, { name: string; projects: Set<string> }][];
    }
    
    return sortedList;
  }, [issues]);

  const filteredIssues = useMemo(() => {
    return (issues as IssueWithHistory[]).filter(i => {
      const issueProject = i.project?.shortName;
      if (selectedProject && issueProject !== selectedProject) return false;
      
      const assignee = (i as any).assignee;
      const assigneeId = assignee?.id || assignee?.login;
      
      if (selectedAssignee) {
        if (selectedAssignee === '__unassigned__') {
          if (assignee) return false;
        } else if (assigneeId !== selectedAssignee) {
          return false;
        }
      }
      
      if (showOnlyCommented && !comments[i.idReadable]) return false;
      return true;
    });
  }, [issues, selectedProject, selectedAssignee, showOnlyCommented, comments]);

  const handleFetchHistory = async () => {
    if (!settings?.youtrackBaseUrl || !settings?.youtrackToken) return;
    await fetchHistory(
      settings.youtrackBaseUrl,
      settings.youtrackToken,
      projectCodes,
      dateFrom,
      dateTo,
      'Aktywności',
      [],
      '',
      false
    );
  };

  useEffect(() => {
    handleFetchHistory();
  }, [projectCodes, dateFrom, dateTo, settings]);

  const toggleAllSections = () => {
    const isAnySectionCollapsed = sections.some((s: any) => s.id !== 'fixed_aktywnosci' && collapsedSections[s.id]);
    const newState: Record<string, boolean> = {};
    if (isAnySectionCollapsed) {
      sections.forEach((s: any) => {
        newState[s.id] = false;
      });
    } else {
      sections.forEach((s: any) => {
        newState[s.id] = s.id !== 'fixed_aktywnosci';
      });
    }
    setCollapsedSections(newState);
  };

  const scrollToTop = () => {
    boardRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveIssueState = async (issueId: string, isCollapsed: boolean) => {
    setIssueStates(prev => ({ ...prev, [issueId]: isCollapsed }));
    await window.electron?.saveDailyIssueState({ issueId, isCollapsed });
  };

  const syncYouTrack = async () => {
    setIsSyncing(true);
    try {
      await handleFetchHistory();
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading && issues.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-950/50 min-h-[400px]">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Synchronizacja z YouTrack...</p>
      </div>
    );
  }

  if (fetchError && issues.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-950/50 min-h-[400px]">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Błąd pobierania danych</h3>
        <p className="text-gray-500 mb-6 text-center max-w-md">{fetchError}</p>
        <button onClick={() => handleFetchHistory()} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center gap-2">
          <RefreshCw size={18} />
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden relative">
      <div className="flex flex-col gap-4 px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20">
         <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {projects.map(code => (
                <button
                  key={code}
                  onClick={() => setSelectedProject(selectedProject === code ? null : code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap border shadow-sm ${
                    selectedProject === code 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-200 dark:shadow-none translate-y-[-1px]' 
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
               <button
                  onClick={() => setShowOnlyCommented(!showOnlyCommented)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${showOnlyCommented ? 'bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400 shadow-sm' : 'bg-white dark:bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  {showOnlyCommented ? <MessageSquare size={14} fill="currentColor" /> : <MessageSquare size={14} />}
                  Notatki
                </button>

                <button
                  onClick={() => setIsGlobalExpanded(!isGlobalExpanded)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isGlobalExpanded ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  {isGlobalExpanded ? 'Zwiń' : 'Rozwiń'}
                </button>

                <button
                  onClick={syncYouTrack}
                  disabled={isSyncing}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${isSyncing ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'}`}
                >
                  {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw size={14} />}
                  Pobierz dane
                </button>
            </div>
         </div>

         <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Osoby:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
              <button onClick={() => setSelectedAssignee(null)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${!selectedAssignee ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>WSZYSCY</button>
              {uniqueAssignees.map(([id, info]: any) => {
                const isHighlighted = selectedProject ? info.projects.has(selectedProject) : true;
                return (
                  <button 
                    key={id} 
                    onClick={() => setSelectedAssignee(id)} 
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5
                      ${selectedAssignee === id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}
                      ${isHighlighted ? 'ring-1 ring-amber-400/50' : 'opacity-40'}
                    `}
                  >
                    {info.name}
                    {isHighlighted && selectedProject && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></div>}
                  </button>
                );
              })}
            </div>
         </div>
      </div>

      <div 
        ref={boardRef}
        className="flex-1 overflow-auto bg-gray-50/50 dark:bg-gray-950/50 scrollbar-thin scroll-smooth"
      >
        <div className="flex items-start gap-6 px-6 py-6 min-w-max min-h-full">
          {sections.map((section) => (
            <DailySectionColumn 
              key={section.id} 
              section={section} 
              issues={filteredIssues.filter(i => {
                const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
                const toTime = new Date(`${dateTo}T23:59:59`).getTime();

                if (section.id === 'fixed_aktywnosci') {
                  return i.timeline?.some((a: any) => a.timestamp >= fromTime && a.timestamp <= toTime);
                }
                
                const statuses = section.youtrackStatuses.split(',').map(s => s.trim().toLowerCase());
                const currentState = typeof i.state === 'string' ? i.state : i.state?.name;
                return statuses.includes(currentState?.toLowerCase() || '');
              })}
              comments={comments}
              issueStates={issueStates}
              onCommentSave={(issueId: string, content: string) => {
                setComments({...comments, [issueId]: content});
                window.electron?.saveDailyComment({issueId, content});
              }}
              onSaveIssueState={handleSaveIssueState}
              onAssigneeFilter={setSelectedAssignee}
              dateFrom={dateFrom}
              dateTo={dateTo}
              isGlobalExpanded={isGlobalExpanded}
              columnCollapsed={!!collapsedSections[section.id]}
              onToggleColumnCollapse={() => setCollapsedSections(prev => ({
                ...prev,
                [section.id]: !prev[section.id]
              }))}
            />
          ))}
          
          <div className="flex flex-col items-center justify-start w-10 shrink-0 pt-2">
            <button 
              onClick={toggleAllSections}
              className="p-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 text-gray-300 dark:text-gray-600 hover:text-indigo-600 hover:border-indigo-600 transition-all shadow-sm group opacity-40 hover:opacity-100"
              title={sections.some(s => s.id !== 'fixed_aktywnosci' && collapsedSections[s.id]) ? "Rozwiń wszystkie sekcje" : "Zwiń sekcje"}
            >
              {sections.some(s => s.id !== 'fixed_aktywnosci' && collapsedSections[s.id]) ? (
                <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              ) : (
                <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              )}
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 p-2 rounded-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 text-gray-300 dark:text-gray-600 hover:text-indigo-600 hover:border-indigo-600 transition-all shadow-lg z-50 opacity-40 hover:opacity-100 backdrop-blur-sm"
        title="Przewiń do góry"
      >
        <ArrowUp size={20} />
      </button>

    </div>
  );
};
