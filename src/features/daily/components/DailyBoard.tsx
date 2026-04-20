import { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, ArrowUp, MessageSquare, Bot } from 'lucide-react';
import { useProjectContext } from '../../../context/ProjectContext';
import type { DailySection } from '../../../types';
import { getSmartDateRange } from '../utils/dailyUtils';
import { DailySectionColumn } from './DailySectionColumn';
import { useYouTrack } from '../../../hooks/useYouTrack';
import type { IssueWithHistory } from '../../../services/youtrackApi';

const formatIsoDateTime = (value?: number | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const anonymizeDisplayName = (value?: string | null) => {
  if (!value) return null;
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

const normalizeForAnalysis = (value?: string | null) => (value || '').toLowerCase();

const classifyExecutionStage = (sectionName: string, stateName?: string | null) => {
  const haystack = `${normalizeForAnalysis(sectionName)} ${normalizeForAnalysis(stateName)}`;

  if (/(test.*klient|klient.*test|uat|akceptac|odbior|po stronie klienta)/.test(haystack)) {
    return 'testing_client';
  }
  if (/(test.*u nas|u nas.*test|internal test|qa|testing|testy wewn|weryfikacja)/.test(haystack)) {
    return 'testing_internal';
  }
  if (/(in progress|w trakcie|realiz|development|implement|do zrobienia|analiz)/.test(haystack)) {
    return 'in_progress';
  }
  if (/(blocked|blok|waiting|oczekiwanie)/.test(haystack)) {
    return 'blocked';
  }
  if (/(done|resolved|zakończ|gotowe|wdrożone)/.test(haystack)) {
    return 'done';
  }

  return 'other';
};

const buildNextStepHints = ({
  sectionName,
  stateName,
  hasActivityInRange,
  hasPmNote,
  dueDate,
}: {
  sectionName: string;
  stateName?: string | null;
  hasActivityInRange: boolean;
  hasPmNote: boolean;
  dueDate?: number | null;
}) => {
  const stage = classifyExecutionStage(sectionName, stateName);
  const hints: string[] = [];

  if (stage === 'in_progress') {
    hints.push('Zweryfikować, czy do domknięcia prac potrzebne są dodatkowe decyzje, doprecyzowanie lub przekazanie dalej na testy.');
  }
  if (stage === 'testing_internal') {
    hints.push('Sprawdzić wynik testów wewnętrznych i zdecydować, czy zadanie można przekazać na testy klienta albo do wdrożenia.');
  }
  if (stage === 'testing_client') {
    hints.push('Monitorować feedback klienta, zebrać uwagi i przygotować decyzję: poprawka, akceptacja albo zamknięcie.');
  }
  if (stage === 'blocked') {
    hints.push('Ustalić blokadę i właściciela odblokowania, aby zadanie mogło wrócić do realizacji.');
  }
  if (!hasActivityInRange) {
    hints.push('Brak świeżej aktywności w wybranym zakresie dat. Warto potwierdzić, czy temat nadal jest aktywny.');
  }
  if (hasPmNote) {
    hints.push('Uwzględnić notatkę PM przy ocenie ryzyk, zależności i kolejnych kroków.');
  }
  if (dueDate) {
    hints.push('Sprawdzić termin i priorytet względem pozostałych zadań w sekcji.');
  }

  return Array.from(new Set(hints));
};

const pruneJson = (value: unknown): unknown => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    const next = value
      .map((item) => pruneJson(item))
      .filter((item) => item !== undefined);
    return next.length ? next : undefined;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, pruneJson(item)] as const)
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return value;
};

interface DailyBoardProps {
  hubId: string;
  projectCodes: string;
}

export const DailyBoard = ({ hubId, projectCodes }: DailyBoardProps) => {
  const { settings } = useProjectContext();
  const boardRef = useRef<HTMLDivElement>(null);

  const { from: initialFrom, to: initialTo } = useMemo(() => getSmartDateRange(), []);
  const loadSavedDateFrom = (fallbackFrom: string, currentDateTo: string) => {
    if (typeof window === 'undefined') return fallbackFrom;
    try {
      const saved = window.localStorage.getItem('daily_date_filters');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.dateFrom) {
          return parsed.dateFrom > currentDateTo ? currentDateTo : parsed.dateFrom;
        }
      }
    } catch {
      // ignore malformed entries and fall back to defaults
    }
    return fallbackFrom;
  };

  const [dateFrom, setDateFrom] = useState(() => loadSavedDateFrom(initialFrom, initialTo));
  const [dateTo, setDateTo] = useState(initialTo);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [showOnlyCommented, setShowOnlyCommented] = useState(false);
  const [isGlobalExpanded, setIsGlobalExpanded] = useState(false);
  const [isAiExporting, setIsAiExporting] = useState(false);
  const [isAiCopied, setIsAiCopied] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [skippedInAiIssues, setSkippedInAiIssues] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = window.localStorage.getItem('daily_ai_skipped_issues');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [issueStates, setIssueStates] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasLoadedActivities, setHasLoadedActivities] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('daily_collapsed_sections');
    return saved ? JSON.parse(saved) : { fixed_aktywnosci: false };
  });
  const [dynamicSections, setDynamicSections] = useState<DailySection[]>([]);

  const {
    data: activityIssues,
    isLoading: isActivityLoading,
    error: activityError,
    fetchHistory: fetchActivityHistory,
    clearData: clearActivityData
  } = useYouTrack();
  const {
    data: boardIssues,
    isLoading: isBoardLoading,
    error: boardError,
    fetchHistory: fetchBoardHistory,
    clearData: clearBoardData
  } = useYouTrack();

  const normalizeStatuses = (raw: string) => {
    if (!raw) return [];
    return raw
      .split(/[\n,;]/)
      .map(entry => entry.trim())
      .filter(Boolean)
      .map(entry => {
        const parenMatch = entry.match(/\(([^)]+)\)$/);
        const value = parenMatch ? parenMatch[1] : entry;
        return value.trim().toLowerCase();
      });
  };

  const boardStateFilters = useMemo(() => {
    const stateSet = new Set<string>();
    dynamicSections.forEach(section => {
      if (section.respectDates) return;
      normalizeStatuses(section.youtrackStatuses).forEach(state => stateSet.add(state));
    });
    return Array.from(stateSet);
  }, [dynamicSections]);

  const handleDateFromChange = (value: string) => {
    if (!value) return;
    if (value > dateTo) {
      setDateTo(value);
    }
    setDateFrom(value);
  };

  const handleDateToChange = (value: string) => {
    if (!value) return;
    if (value < dateFrom) {
      setDateFrom(value);
    }
    setDateTo(value);
  };

  const resetDateRange = () => {
    setDateFrom(initialFrom);
    setDateTo(initialTo);
  };

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
        const savedComments = (await window.electron.getDailyComments()) as unknown as Record<string, string>;
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('daily_ai_skipped_issues', JSON.stringify(skippedInAiIssues));
  }, [skippedInAiIssues]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('daily_date_filters', JSON.stringify({ dateFrom, dateTo }));
  }, [dateFrom, dateTo]);

  const combinedIssues = useMemo(() => {
    const merged = new Map<string, IssueWithHistory>();
    boardIssues.forEach(issue => merged.set(issue.id, issue));
    activityIssues.forEach(issue => {
      if (!merged.has(issue.id)) {
        merged.set(issue.id, issue);
      }
    });
    return Array.from(merged.values());
  }, [activityIssues, boardIssues]);

  const projects = useMemo(() => {
    const foundCodes = new Set<string>();
    combinedIssues.forEach((i: IssueWithHistory) => {
      if (i.project?.shortName) {
        foundCodes.add(i.project.shortName.toUpperCase());
      }
    });

    const configuredCodes = projectCodes.split(',').map(p => p.trim().toUpperCase());

    if (!selectedProject && configuredCodes.length > 0) {
      const firstProject = configuredCodes.find(code => foundCodes.has(code));
      if (firstProject) setSelectedProject(firstProject);
    }

    return configuredCodes.filter(code => foundCodes.has(code));
  }, [combinedIssues, projectCodes, selectedProject]);

  const uniqueAssignees = useMemo(() => {
    const aMap = new Map<string, { name: string; projects: Set<string> }>();
    let hasUnassigned = false;
    const unassignedProjects = new Set<string>();

    combinedIssues.forEach((i: IssueWithHistory) => {
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

    const sortedList = Array.from(aMap.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (hasUnassigned) {
      return [...sortedList, ['__unassigned__', { name: 'Nieprzypisane', projects: unassignedProjects }]] as [string, { name: string; projects: Set<string> }][];
    }

    return sortedList;
  }, [combinedIssues]);

  const filterIssues = (list: IssueWithHistory[]) =>
    list.filter(i => {
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

  const filteredActivityIssues = useMemo(
    () => filterIssues(activityIssues as IssueWithHistory[]),
    [activityIssues, selectedProject, selectedAssignee, showOnlyCommented, comments]
  );

  const filteredBoardIssues = useMemo(
    () => filterIssues(boardIssues as IssueWithHistory[]),
    [boardIssues, selectedProject, selectedAssignee, showOnlyCommented, comments]
  );

  const activityIssueIds = useMemo(() => {
    const ids = new Set<string>();
    const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
    const toTime = new Date(`${dateTo}T23:59:59`).getTime();
    filteredActivityIssues.forEach((issue: IssueWithHistory) => {
      if (issue.timeline?.some((a: any) => a.timestamp >= fromTime && a.timestamp <= toTime)) {
        ids.add(issue.idReadable);
      }
    });
    return ids;
  }, [filteredActivityIssues, dateFrom, dateTo]);

  const sectionIssuesMap = useMemo(() => {
    const map = new Map<string, IssueWithHistory[]>();

    sections.forEach((section) => {
      const sourceIssues = section.id === 'fixed_aktywnosci' ? filteredActivityIssues : filteredBoardIssues;
      const issues = sourceIssues.filter((issue) => {
        const hasTimelineInRange = activityIssueIds.has(issue.idReadable);

        if (section.id === 'fixed_aktywnosci') {
          return hasTimelineInRange;
        }

        const statuses = normalizeStatuses(section.youtrackStatuses);
        const currentState = typeof issue.state === 'string' ? issue.state : issue.state?.name;
        if (!statuses.includes((currentState || '').toLowerCase())) return false;
        if (section.respectDates) {
          return hasTimelineInRange;
        }
        return true;
      });

      map.set(section.id, issues);
    });

    return map;
  }, [sections, filteredActivityIssues, filteredBoardIssues, activityIssueIds]);

  const aiExportSummary = useMemo(() => {
    const boardSections = sections.filter((section) => section.id !== 'fixed_aktywnosci');
    const currentSectionByIssue = new Map<string, DailySection>();

    boardSections.forEach((section) => {
      (sectionIssuesMap.get(section.id) || []).forEach((issue) => {
        if (!currentSectionByIssue.has(issue.idReadable)) {
          currentSectionByIssue.set(issue.idReadable, section);
        }
      });
    });

    const allVisibleIssuesById = new Map<string, IssueWithHistory>();
    Array.from(sectionIssuesMap.values()).forEach((issues) => {
      issues.forEach((issue) => {
        if (skippedInAiIssues[issue.idReadable]) return;
        if (!allVisibleIssuesById.has(issue.idReadable)) {
          allVisibleIssuesById.set(issue.idReadable, issue);
        }
      });
    });

    const allVisibleIssues = Array.from(allVisibleIssuesById.values());

    const serializedIssues = allVisibleIssues.map((issue) => {
      const currentSection = currentSectionByIssue.get(issue.idReadable) || null;
      const stateName = typeof issue.state === 'string' ? issue.state : issue.state?.name || null;
      const stage = classifyExecutionStage(currentSection?.name || 'Aktywności', stateName);
      const pmNote = comments[issue.idReadable]?.trim() || null;
      const activitiesInRange = (issue.timeline || [])
        .filter((item) => item.timestamp >= new Date(`${dateFrom}T00:00:00`).getTime() && item.timestamp <= new Date(`${dateTo}T23:59:59`).getTime())
        .map((item) => ({
          type: item.type,
          timestamp: new Date(item.timestamp).toISOString(),
          author: anonymizeDisplayName(item.author?.name || item.author?.login || null),
          ...(item.type === 'comment' ? { text: item.text || '' } : {}),
          ...(item.type === 'field-change' ? { field: item.field || null, from: item.removed || null, to: item.added || null } : {}),
          ...(item.type === 'work-item'
            ? {
                minutes: item.minutes || 0,
                workType: item.workItemType || null,
                comments: item.workComments || [],
              }
            : {}),
        }));

      const relatedLinks = (issue.links || [])
        .map((link) => ({
          direction: link.direction || null,
          typeName: link.linkType?.name || link.linkType?.outwardName || link.linkType?.inwardName || null,
          issues: (link.issues || []).map((linkedIssue) => ({
            id: linkedIssue.idReadable,
            summary: linkedIssue.summary || null,
          })),
        }))
        .filter((link) => link.issues.length > 0);

      return {
        id: issue.idReadable,
        projectCode: issue.project?.shortName || null,
        summary: issue.summary,
        description: issue.description || null,
        currentSection: currentSection
          ? {
              id: currentSection.id,
              name: currentSection.name,
              respectDates: !!currentSection.respectDates,
              configuredStatuses: normalizeStatuses(currentSection.youtrackStatuses),
            }
          : null,
        state: stateName,
        executionStage: stage,
        ...(activityIssueIds.has(issue.idReadable) ? { isActiveInRange: true } : {}),
        ...(pmNote ? { hasPmNote: true, pmNote } : {}),
        assignee: anonymizeDisplayName(issue.assignee?.fullName || issue.assignee?.name || issue.assignee?.login || null),
        reporter: anonymizeDisplayName(issue.reporter?.name || issue.reporter?.login || null),
        priority: issue.priority?.name || null,
        type: issue.type?.name || null,
        createdAt: formatIsoDateTime(issue.created),
        updatedAt: formatIsoDateTime(issue.updated),
        resolvedAt: formatIsoDateTime(issue.resolved),
        dueDate: formatIsoDateTime(issue.dueDate),
        estimation: issue.estimation || null,
        spentTime: issue.spentTime || null,
        activitiesInRange,
        ...(activitiesInRange.length ? { activityCountInRange: activitiesInRange.length } : {}),
        ...(activitiesInRange.length ? { latestActivityAt: activitiesInRange[activitiesInRange.length - 1].timestamp } : {}),
        ...(relatedLinks.length ? { relatedLinks } : {}),
        nextStepHints: buildNextStepHints({
          sectionName: currentSection?.name || 'Aktywności',
          stateName,
          hasActivityInRange: activityIssueIds.has(issue.idReadable),
          hasPmNote: !!pmNote,
          dueDate: issue.dueDate,
        }),
      };
    });

    const serializedIssuesById = new Map<string, (typeof serializedIssues)[number]>(
      serializedIssues.map((issue) => [issue.id, issue])
    );

    const sectionSummaries = sections.map((section) => {
      const issues = (sectionIssuesMap.get(section.id) || []).filter((issue) => !skippedInAiIssues[issue.idReadable]);
      return {
        id: section.id,
        name: section.name,
        type: section.id === 'fixed_aktywnosci' ? 'activity' : 'board',
        respectDates: !!section.respectDates,
        configuredStatuses: normalizeStatuses(section.youtrackStatuses),
        issueCount: issues.length,
        issueIds: issues.map((issue) => issue.idReadable),
        issues: issues
          .map((issue) => serializedIssuesById.get(issue.idReadable))
          .filter((issue): issue is (typeof serializedIssues)[number] => Boolean(issue))
          .map((issue) => ({
            id: issue.id,
            summary: issue.summary,
            state: issue.state,
            executionStage: issue.executionStage,
            ...(issue.isActiveInRange ? { isActiveInRange: true } : {}),
            ...(issue.hasPmNote ? { hasPmNote: true } : {}),
          })),
      };
    });

    const stageBuckets = serializedIssues.reduce<Record<string, string[]>>((acc, issue) => {
      if (!acc[issue.executionStage]) {
        acc[issue.executionStage] = [];
      }
      acc[issue.executionStage].push(issue.id);
      return acc;
    }, {});

    return pruneJson({
      generatedAt: new Date().toISOString(),
      generatedAtLocal: new Date().toLocaleString('pl-PL'),
      hub: {
        id: hubId,
        projectCodes: projectCodes.split(',').map((item) => item.trim()).filter(Boolean),
      },
      filters: {
        dateFrom,
        dateTo,
        selectedProject,
        ...(selectedProject ? { selectedProject } : {}),
        ...(selectedAssignee ? { selectedAssignee: selectedAssignee === '__unassigned__' ? 'Nieprzypisane' : anonymizeDisplayName(selectedAssignee) } : {}),
        ...(showOnlyCommented ? { showOnlyCommented: true } : {}),
        ...(Object.values(skippedInAiIssues).some(Boolean)
          ? { skippedInAiIssueIds: Object.entries(skippedInAiIssues).filter(([, skipped]) => skipped).map(([issueId]) => issueId) }
          : {}),
      },
      summary: {
        visibleSections: sectionSummaries.length,
        visibleIssues: serializedIssues.length,
        activeIssuesInRange: serializedIssues.filter((issue) => issue.isActiveInRange).length,
        issuesWithPmNotes: serializedIssues.filter((issue) => issue.hasPmNote).length,
        executionStages: Object.fromEntries(Object.entries(stageBuckets).map(([key, value]) => [key, value.length])),
      },
      aiContext: {
        activeIssueIds: serializedIssues.filter((issue) => issue.isActiveInRange).map((issue) => issue.id),
        issuesInProgress: stageBuckets.in_progress || [],
        issuesOnInternalTesting: stageBuckets.testing_internal || [],
        issuesOnClientTesting: stageBuckets.testing_client || [],
        blockedIssues: stageBuckets.blocked || [],
        focusHints: [
          ...(stageBuckets.testing_client?.length ? ['Są zadania na testach klienta. Warto sprawdzić feedback i decyzje akceptacyjne.'] : []),
          ...(stageBuckets.testing_internal?.length ? ['Są zadania na testach wewnętrznych. Warto ocenić gotowość do przekazania dalej.'] : []),
          ...(stageBuckets.in_progress?.length ? ['Są zadania w realizacji. Warto wskazać najbliższe kroki i ewentualne blokery.'] : []),
          ...(serializedIssues.some((issue) => issue.hasPmNote) ? ['W eksporcie są notatki PM, które należy uwzględnić przy opisie ryzyk i dalszych działań.'] : []),
        ],
      },
      sections: sectionSummaries,
      issues: serializedIssues,
    }) as {
      generatedAt: string;
      generatedAtLocal: string;
      hub: { id: string; projectCodes: string[] };
      filters?: Record<string, unknown>;
      summary: Record<string, unknown>;
      aiContext?: Record<string, unknown>;
      sections: Array<Record<string, unknown>>;
      issues: Array<Record<string, unknown>>;
    };
  }, [sections, sectionIssuesMap, comments, skippedInAiIssues, activityIssueIds, dateFrom, dateTo, hubId, projectCodes, selectedProject, selectedAssignee, showOnlyCommented]);

  const fetchActivitiesFirst = async () => {
    if (!settings?.youtrackBaseUrl || !settings?.youtrackToken) return;
    if (!dateFrom || !dateTo) return;
    await fetchActivityHistory(
      settings.youtrackBaseUrl,
      settings.youtrackToken,
      projectCodes,
      dateFrom,
      dateTo,
      'Aktywności',
      undefined,
      '',
      false
    );
    setHasLoadedActivities(true);
  };

  const fetchBoardData = async () => {
    if (!settings?.youtrackBaseUrl || !settings?.youtrackToken) return;
    if (!dateFrom || !dateTo) return;
    await fetchBoardHistory(
      settings.youtrackBaseUrl,
      settings.youtrackToken,
      projectCodes,
      dateFrom,
      dateTo,
      'Aktywności',
      boardStateFilters.length ? boardStateFilters : undefined,
      '',
      false
    );
  };

  useEffect(() => {
    setHasLoadedActivities(false);
    clearActivityData();
    clearBoardData();
  }, [hubId, projectCodes, dateFrom, dateTo, boardStateFilters.join('|'), clearActivityData, clearBoardData]);

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

  const handleToggleSkipInAi = (issueId: string, skipInAi: boolean) => {
    setSkippedInAiIssues((prev) => ({
      ...prev,
      [issueId]: skipInAi,
    }));
  };

  const syncYouTrack = async () => {
    setIsSyncing(true);
    try {
      setHasLoadedActivities(false);
      await fetchActivitiesFirst();
      await fetchBoardData();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportToAi = async () => {
    if (!hasLoadedActivities || aiExportSummary.issues.length === 0) {
      window.alert('Najpierw kliknij `Pobierz dane`, aby przygotować eksport aktualnej tablicy.');
      return;
    }

    setIsAiExporting(true);
    setIsAiCopied(false);
    try {
      const json = JSON.stringify(aiExportSummary, null, 2);
      await navigator.clipboard.writeText(json);
      setIsAiCopied(true);
      window.setTimeout(() => setIsAiCopied(false), 2500);
    } finally {
      setIsAiExporting(false);
    }
  };

  if (isActivityLoading && activityIssues.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-950/50 min-h-[400px]">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Pobieranie aktywności z YouTrack...</p>
      </div>
    );
  }

  if (activityError && activityIssues.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-950/50 min-h-[400px]">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Błąd pobierania danych</h3>
        <p className="text-gray-500 mb-6 text-center max-w-md">{activityError}</p>
        <button onClick={() => syncYouTrack()} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center gap-2">
          <RefreshCw size={18} />
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden relative">
      <div className="flex flex-col gap-4 px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center justify-between gap-4 flex-wrap">
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

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
                aria-label="Data od"
                className="w-[120px] border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]"
              />
              <span className="text-xs font-semibold text-gray-400">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleDateToChange(e.target.value)}
                aria-label="Data do"
                className="w-[120px] border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
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
            <button
              onClick={handleExportToAi}
              disabled={isAiExporting || !hasLoadedActivities || aiExportSummary.issues.length === 0}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                isAiExporting || !hasLoadedActivities || aiExportSummary.issues.length === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
              }`}
            >
              {isAiExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot size={14} />}
              {isAiCopied ? 'Skopiowano do schowka' : 'Export do AI'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
          {!hasLoadedActivities && !isActivityLoading ? (
            <span>Kliknij `Pobierz dane`, aby załadować zgłoszenia dla bieżącego zakresu.</span>
          ) : !hasLoadedActivities || isActivityLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              Ładowanie aktywności...
            </span>
          ) : isBoardLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              Aktywności są już widoczne, trwa dociąganie pozostałych sekcji...
            </span>
          ) : boardError ? (
            <span className="text-amber-600 dark:text-amber-400">
              Aktywności załadowane, ale pozostałe sekcje nie zostały odświeżone.
            </span>
          ) : (
            <button
              type="button"
              onClick={resetDateRange}
              className="text-[11px] font-semibold text-gray-500 hover:text-indigo-600 transition-colors"
            >
              Inteligentny zakres
            </button>
          )}
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
              issues={sectionIssuesMap.get(section.id) || []}
              activityIssueIds={activityIssueIds}
              comments={comments}
              skippedInAiIssues={skippedInAiIssues}
              issueStates={issueStates}
              onCommentSave={(issueId: string, content: string) => {
                setComments({ ...comments, [issueId]: content });
                window.electron?.saveDailyComment({ issueId, content });
              }}
              onToggleSkipInAi={handleToggleSkipInAi}
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
              title={sections.some(s => s.id !== 'fixed_aktywnosci' && collapsedSections[s.id]) ? 'Rozwiń wszystkie sekcje' : 'Zwiń sekcje'}
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
