import { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar as CalendarIcon, RefreshCw, AlertCircle } from 'lucide-react';
import { useProjectContext } from '../../../context/ProjectContext';
import type { DailySection, DailyComment } from '../../../types';
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
  const [sections, setSections] = useState<DailySection[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [issueStates, setIssueStates] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  
  const smartRange = useMemo(() => getSmartDateRange(), []);
  const [dateFrom, setDateFrom] = useState(smartRange.from);
  const [dateTo, setDateTo] = useState(smartRange.to);

  // Filters
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [showOnlyCommented, setShowOnlyCommented] = useState(false);

  const { data: issues, isLoading, error: fetchError, fetchHistory } = useYouTrack();

  const loadLocalData = async () => {
    if (!window.electron) return;
    try {
      // Get sections
      const loadedSections = await window.electron.getDailySections(hubId);
      
      const fixedAktywnosci: DailySection = {
        id: 'fixed_aktywnosci',
        hubId,
        name: 'Aktywności',
        youtrackStatuses: '*', // Special value to show all issues
        orderIndex: -1
      };

      setSections([fixedAktywnosci, ...loadedSections]);

      // Get local comments
      const loadedComments = await window.electron?.getDailyComments();
      const loadedStates = await window.electron?.getDailyIssueStates();

      if (loadedComments) {
        const commentMap: Record<string, string> = {};
        loadedComments.forEach((c: DailyComment) => {
          commentMap[c.issueId] = c.content;
        });
        setComments(commentMap);
      }
      
      if (loadedStates) {
        setIssueStates(loadedStates);
      }
    } catch (err) {
      console.error('DailyBoard: Error loading local data:', err);
    }
  };

  const syncYouTrack = async () => {
    if (!settings?.youtrackBaseUrl || !settings?.youtrackToken) return;
    setIsSyncing(true);
    try {
      await fetchHistory(
        settings.youtrackBaseUrl, 
        settings.youtrackToken, 
        projectCodes, 
        dateFrom, 
        dateTo, 
        'Aktywności'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadLocalData();
  }, [hubId]);

  const uniqueProjects = useMemo(() => {
    const pSet = new Set<string>();
    issues.forEach((i: IssueWithHistory) => {
        if (i.project?.shortName) pSet.add(i.project.shortName);
    });
    return Array.from(pSet).sort();
  }, [issues]);

  const uniqueAssignees = useMemo(() => {
    const aMap = new Map<string, { name: string; projects: Set<string> }>();
    issues.forEach((i: IssueWithHistory) => {
      const assignee = (i as any).assignee;
      if (assignee) {
        const id = assignee.id || assignee.login;
        const name = assignee.fullName || assignee.name;
        const projectShortName = i.project?.shortName;
        
        if (!aMap.has(id)) {
          aMap.set(id, { name, projects: new Set() });
        }
        if (projectShortName) {
          aMap.get(id)!.projects.add(projectShortName);
        }
      }
    });
    return Array.from(aMap.entries()).sort((a,b) => a[1].name.localeCompare(b[1].name));
  }, [issues]);

  const filteredIssues = useMemo(() => {
    return (issues as IssueWithHistory[]).filter(i => {
      const issueProject = i.project?.shortName;
      if (selectedProject && issueProject !== selectedProject) return false;
      
      const assignee = (i as any).assignee;
      const assigneeId = assignee?.id || assignee?.login;
      if (selectedAssignee && assigneeId !== selectedAssignee) return false;
      
      if (showOnlyCommented && !comments[i.idReadable]) return false;
      return true;
    });
  }, [issues, selectedProject, selectedAssignee, showOnlyCommented, comments]);

  const handleSaveIssueState = async (issueId: string, isCollapsed: boolean) => {
    setIssueStates(prev => ({ ...prev, [issueId]: isCollapsed }));
    await window.electron?.saveDailyIssueState({ issueId, isCollapsed });
  };

  if (isLoading && issues.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center">
          <Loader2 className="animate-spin text-indigo-500 mx-auto mb-4" size={40} />
          <p className="text-gray-500 font-medium">Ładowanie tablicy Daily...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ERROR MESSAGE */}
      {fetchError && (
        <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle size={18} />
          <p className="font-medium">Błąd YouTrack: {fetchError}</p>
        </div>
      )}

      {/* FILTERS BAR */}
      <div className="px-6 py-3 bg-white dark:bg-gray-900 border-b dark:border-gray-800 flex flex-col gap-3">
        {/* ROW 1: PROJECTS, SYNC, DATES */}
        <div className="flex items-center justify-between gap-4">
          {/* LEFT: PROJECTS */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Projekty:</span>
             <div className="flex items-center gap-1.5">
               <button onClick={() => setSelectedProject(null)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${!selectedProject ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>WSZYSTKIE</button>
               {uniqueProjects.map(p => (
                 <button key={p} onClick={() => setSelectedProject(p)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${selectedProject === p ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{p}</button>
               ))}
             </div>
          </div>

          {/* RIGHT: SYNC & DATES */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={syncYouTrack}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${isSyncing ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'}`}
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Pobieranie...' : 'Pobierz dane'}
            </button>

            <button
              onClick={() => setShowOnlyCommented(!showOnlyCommented)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${showOnlyCommented ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-800 dark:text-indigo-400' : 'bg-white dark:bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              {showOnlyCommented ? 'Tylko skomentowane' : 'Wszystkie aktywności'}
            </button>

            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700"></div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
              <CalendarIcon size={14} className="text-gray-400" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent text-xs font-bold font-mono outline-none dark:text-white" />
              <span className="text-gray-400 text-xs">→</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent text-xs font-bold font-mono outline-none dark:text-white" />
            </div>
          </div>
        </div>

        {/* ROW 2: ASSIGNEES */}
        <div className="flex items-center gap-3 py-1 border-t border-gray-50 dark:border-gray-800/50">
           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Osoby:</span>
           <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
             <button onClick={() => setSelectedAssignee(null)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${!selectedAssignee ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>WSZYSCY</button>
             {uniqueAssignees.map(([id, info]) => {
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

      {/* BOARD AREA */}
      <div className="flex-1 overflow-auto bg-gray-50/50 dark:bg-gray-950/50 scrollbar-thin scroll-smooth">
        <div className="flex items-start gap-6 px-6 py-6 min-w-max min-h-full">
          {sections.map((section) => (
            <DailySectionColumn 
              key={section.id} 
              section={section} 
              issues={filteredIssues.filter(i => {
                if (section.id === 'fixed_aktywnosci') return true;
                const statuses = section.youtrackStatuses.split(',').map(s => s.trim().toLowerCase());
                // i.state is provided by useYouTrack (IssueWithHistory)
                return statuses.includes(i.state?.toLowerCase() || '');
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
              forceCollapsed={section.id !== 'fixed_aktywnosci'}
            />
          ))}
        </div>
      </div>

    </div>
  );
};
