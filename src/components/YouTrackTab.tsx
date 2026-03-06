import { useState, useEffect } from 'react';
import { useYouTrack } from '../hooks/useYouTrack';
import { useProjectContext, type Project, TaskTypeIconMap } from '../App';
import { format } from 'date-fns';
import { RefreshCw, Loader2, AlertCircle, MessageSquare, Calendar, Clock, ChevronDown, X, ZoomIn, ZoomOut, FileDown, BrainCircuit, Plus, Trash2, Pencil, Code } from 'lucide-react';
import { type ActivityItem, formatMinutesToDuration, fetchIssuesActivity } from '../services/youtrackApi';
import { AuthenticatedImage } from './AuthenticatedImage';

export const YouTrackTab = ({ project }: { project: Project }) => {
    const { settings, updateProject } = useProjectContext();

    const [projectQuery, setProjectQuery] = useState(project.youtrackQuery || project.code || '');
    const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [useCache, setUseCache] = useState(true);
    const [hasFetched, setHasFetched] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [excludedIssues, setExcludedIssues] = useState<Set<string>>(new Set());

    // Load excluded issue IDs from DB on mount
    useEffect(() => {
        const loadExcluded = async () => {
            try {
                if (window.electron?.getExcludedIssues) {
                    const ids: string[] = await window.electron.getExcludedIssues();
                    setExcludedIssues(new Set(ids));
                }
            } catch (e) {
                console.error('Failed to load excluded issues:', e);
            }
        };
        loadExcluded();
    }, []);

    const toggleExclusion = async (idReadable: string) => {
        const willExclude = !excludedIssues.has(idReadable);
        setExcludedIssues(prev => {
            const next = new Set(prev);
            if (willExclude) next.add(idReadable); else next.delete(idReadable);
            return next;
        });
        try {
            if (window.electron?.setIssueExcluded) {
                await window.electron.setIssueExcluded(idReadable, willExclude);
            }
        } catch (e) {
            console.error('Failed to save exclusion:', e);
        }
    };

    type YoutrackCustomTab = { id: string; projectId: string; name: string; statuses: string[]; includeFilters?: boolean; orderIndex?: number };
    const [customTabs, setCustomTabs] = useState<YoutrackCustomTab[]>([]);
    const [activeTab, setActiveTab] = useState<string>('Aktywności'); // 'Aktywności' or customTab.id
    const [showAddTabModal, setShowAddTabModal] = useState(false);
    const [newTabName, setNewTabName] = useState('');
    const [newTabStatuses, setNewTabStatuses] = useState(''); // comma-separated
    const [newTabIncludeFilters, setNewTabIncludeFilters] = useState(false);
    const [editingTabId, setEditingTabId] = useState<string | null>(null);
    const [draggedTabIdx, setDraggedTabIdx] = useState<number | null>(null);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

    const { data, issueTaskTypes, setIssueTaskType, isLoading, error, fetchHistory, loadFromCache, clearData } = useYouTrack();

    // Load custom tabs from DB on mount / project change
    useEffect(() => {
        const loadTabs = async () => {
            try {
                if (window.electron?.getYoutrackTabs) {
                    let tabs = await window.electron.getYoutrackTabs(project.id);
                    if (!tabs.find(t => t.name.toLowerCase() === 'zakończone')) {
                        const zTab = { id: 'fixed_zakonczone', projectId: project.id, name: 'Zakończone', statuses: [], includeFilters: true, orderIndex: -1 };
                        tabs = [zTab, ...tabs];
                        try {
                            if (window.electron?.saveYoutrackTab) await window.electron.saveYoutrackTab(zTab);
                        } catch(e) {}
                    }
                    // Fix missing orderIndex
                    tabs = tabs.map((t, i) => ({ ...t, orderIndex: t.orderIndex ?? i }));
                    tabs.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
                    setCustomTabs(tabs);
                }
            } catch (e) { console.error('Failed to load custom tabs:', e); }
        };
        loadTabs();
        setActiveTab('Aktywności'); // reset to default tab when project changes
        clearData();
        setHasFetched(false);
        setProjectQuery(project.youtrackQuery || project.code || '');
    }, [project.id, project.youtrackQuery, project.code, clearData]);

    const saveNewTab = async () => {
        if (!newTabName.trim() || !newTabStatuses.trim()) return;
        const statuses = newTabStatuses.split(',').map(s => s.trim()).filter(Boolean);
        const id = editingTabId || `tab_${Date.now()}`;
        const tab: YoutrackCustomTab = { id, projectId: project.id, name: newTabName.trim(), statuses, includeFilters: newTabIncludeFilters };

        if (editingTabId) {
            setCustomTabs(prev => prev.map(t => t.id === editingTabId ? tab : t));
        } else {
            setCustomTabs(prev => [...prev, tab]);
        }

        setShowAddTabModal(false);
        setEditingTabId(null);
        setNewTabName('');
        setNewTabStatuses('');
        setNewTabIncludeFilters(false);

        try {
            if (window.electron?.saveYoutrackTab) await window.electron.saveYoutrackTab(tab);
        } catch (e) { console.error('Failed to save tab:', e); }

        if (!editingTabId || activeTab === editingTabId) {
            setActiveTab(id);
            handleFetch(true, projectQuery, id, statuses);
        }
    };

    const handleEditTab = (tab: YoutrackCustomTab) => {
        setEditingTabId(tab.id);
        setNewTabName(tab.name);
        setNewTabStatuses(tab.statuses.join(', '));
        setNewTabIncludeFilters(tab.includeFilters || false);
        setShowAddTabModal(true);
    };

    const deleteCustomTab = async (tabId: string) => {
        setCustomTabs(prev => prev.filter(t => t.id !== tabId));
        if (activeTab === tabId) setActiveTab('Aktywności');
        try {
            if (window.electron?.deleteYoutrackTab) await window.electron.deleteYoutrackTab(tabId);
        } catch (e) { console.error('Failed to delete tab:', e); }
    };

    const handleDragStart = (idx: number) => setDraggedTabIdx(idx);
    
    const handleDragOver = (e: React.DragEvent) => e.preventDefault();
    
    const handleDrop = async (dropIdx: number) => {
        if (draggedTabIdx === null || draggedTabIdx === dropIdx) return;
        
        const newTabs = [...customTabs];
        const [draggedTab] = newTabs.splice(draggedTabIdx, 1);
        newTabs.splice(dropIdx, 0, draggedTab);
        
        const updatedTabs = newTabs.map((tab, idx) => ({ ...tab, orderIndex: idx }));
        setCustomTabs(updatedTabs);
        setDraggedTabIdx(null);
        
        try {
            if (window.electron?.reorderYoutrackTabs) {
                await window.electron.reorderYoutrackTabs(updatedTabs.map(t => ({ id: t.id, orderIndex: t.orderIndex as number })));
            }
        } catch (err) {
            console.error('Błąd zapisywania kolejności:', err);
        }
    };

    // Lightbox state
    const [lightboxImage, setLightboxImage] = useState<{ src: string, alt: string } | null>(null);
    const [lightboxScale, setLightboxScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    const handleFetch = (forceRefresh = false, currentQuery = projectQuery, currentTabId = activeTab, currentStatuses?: string[]) => {
        if (!settings?.youtrackBaseUrl || !settings?.youtrackToken) return;
        setHasFetched(true);

        if (currentQuery !== project.youtrackQuery) {
            updateProject(project.id, { youtrackQuery: currentQuery });
        }

        const isActivityTab = currentTabId === 'Aktywności';
        const isZakonczonePlain = currentTabId === 'Zakończone' || currentTabId === 'fixed_zakonczone';

        let tabObj = isActivityTab ? null : customTabs.find(t => t.id === currentTabId);

        // If it's the fixed Zakończone tab but not found by ID, try finding by name
        if (!tabObj && isZakonczonePlain) {
            tabObj = customTabs.find(t => t.name.toLowerCase() === 'zakończone');
        }

        const statuses = currentStatuses ?? tabObj?.statuses;
        const tabName = tabObj?.name || (isZakonczonePlain ? 'Zakończone' : undefined);
        const tabParam: 'Aktywności' | 'Do zrobienia' = isActivityTab ? 'Aktywności' : 'Do zrobienia';

        if (!forceRefresh && useCache) {
            const loaded = loadFromCache(currentQuery, dateFrom, dateTo, tabParam, statuses, tabName, tabObj?.includeFilters);
            if (loaded) return;
        }

        fetchHistory(settings.youtrackBaseUrl, settings.youtrackToken, currentQuery, dateFrom, dateTo, tabParam, statuses, tabName, tabObj?.includeFilters);
    };

    // Anonymization helpers
    const anonymizeName = (name: string): string => {
        if (!name) return name;
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0][0] + '.';
        return parts[0][0] + '. ' + parts[1].substring(0, 3) + '.';
    };

    const anonymizeLogin = (login: string): string => {
        if (!login) return login;
        const parts = login.split('.');
        if (parts.length < 2) return login;
        return parts[0] + '.' + parts[1][0];
    };

    const anonymizeEmail = (email: string): string => {
        if (!email || !email.includes('@')) return email;
        const [local, domain] = email.split('@');
        const parts = local.split('.');
        const anonLocal = parts.map(p => p[0]).join('.');
        return anonLocal + '@' + domain;
    };

    const anonymizePerson = (person: any): any => {
        if (!person) return person;
        return {
            ...(person.name !== undefined ? { name: anonymizeName(person.name) } : {}),
            ...(person.login !== undefined ? { login: anonymizeLogin(person.login) } : {}),
            ...(person.email !== undefined ? { email: anonymizeEmail(person.email) } : {}),
        };
    };

    const serializeIssues = (issues: typeof data) => issues.map(issue => ({
        id: issue.idReadable,
        internalId: issue.id,
        summary: issue.summary,
        description: issue.description || null,
        state: issue.state || null,
        resolved: issue.resolved ? new Date(issue.resolved).toISOString() : null,
        created: (issue as any).created ? new Date((issue as any).created).toISOString() : null,
        updated: (issue as any).updated ? new Date((issue as any).updated).toISOString() : null,
        reporter: anonymizePerson((issue as any).reporter) || null,
        assignee: anonymizePerson((issue as any).assignee) || null,
        dueDate: issue.dueDate ? new Date(issue.dueDate).toISOString() : null,
        estimation: issue.estimation || null,
        spentTime: issue.spentTime || null,
        tags: (issue as any).tags || [],
        links: (issue as any).links || [],
        attachments: (issue.attachments || []).map((a: any) => ({ name: a.name, url: a.url, mimeType: a.mimeType, size: a.size })),
        customFields: ((issue as any).rawCustomFields || []).map((f: any) => ({
            name: f.name,
            value: f.value?.presentation || f.value?.name || f.value
        })),
        timeline: issue.timeline.map((item: any) => ({
            type: item.type,
            id: item.id,
            timestamp: new Date(item.timestamp).toISOString(),
            author: anonymizePerson(item.author),
            ...(item.type === 'comment' ? { text: item.text } : {}),
            ...(item.type === 'field-change' ? { field: item.field, from: item.removed, to: item.added } : {}),
            ...(item.type === 'description-change' ? { field: item.field, from: item.removed?.substring(0, 200), to: item.added?.substring(0, 200) } : {}),
            ...(item.type === 'work-item' ? {
                dateStr: item.dateStr,
                durationMinutes: item.minutes,
                durationFormatted: (() => { const h = Math.floor((item.minutes || 0) / 60); const m = (item.minutes || 0) % 60; return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`; })(),
                workType: item.workItemType || null,
                comments: item.workComments || []
            } : {}),
        }))
    }));

    const makeSummary = (issues: typeof data) => ({
        totalIssues: issues.length,
        resolvedIssues: issues.filter(i => i.resolved).length,
        openIssues: issues.filter(i => !i.resolved).length,
        totalLoggedMinutes: issues.reduce((acc, i) => acc + (i.spentTime?.minutes || 0), 0),
        totalLoggedHours: Math.round(issues.reduce((acc, i) => acc + (i.spentTime?.minutes || 0), 0) / 60 * 10) / 10,
        totalEstimatedMinutes: issues.reduce((acc, i) => acc + (i.estimation?.minutes || 0), 0),
        authors: [...new Set(issues.flatMap(i => i.timeline.map((t: any) => anonymizeName(t.author?.name || t.author?.login || '')).filter(Boolean)))],
    });

    const handleExportJson = async () => {
        if (!settings?.youtrackBaseUrl || !settings?.youtrackToken) return;
        setIsExporting(true);
        try {
            // Fetch default 'Aktywności' (date-based)
            const activityIssues = await fetchIssuesActivity(settings.youtrackBaseUrl, settings.youtrackToken, projectQuery, dateFrom, dateTo, 'Aktywności');

            // Fetch all custom tabs (status-based). Ensure permanent "Zakończone" is included.
            const allTabsToFetch = [...customTabs];
            if (!allTabsToFetch.find(t => t.name.toLowerCase() === 'zakończone')) {
                allTabsToFetch.push({ id: 'fixed_zakonczone', projectId: project.id, name: 'Zakończone', statuses: [] });
            }

            const customTabsData = await Promise.all(allTabsToFetch.map(async tab => {
                const issues = await fetchIssuesActivity(settings.youtrackBaseUrl, settings.youtrackToken, projectQuery, dateFrom, dateTo, 'Do zrobienia', tab.statuses, tab.name);
                return { tab, issues };
            }));

            // Filter out excluded issues from all
            const filteredActivity = activityIssues.filter(i => !excludedIssues.has(i.idReadable));
            const filteredCustom = customTabsData.map(ct => ({
                ...ct,
                issues: ct.issues.filter(i => !excludedIssues.has(i.idReadable))
            }));

            // Merge for global summary: deduplicate by id
            const allById = new Map<string, any>();
            filteredActivity.forEach(i => allById.set(i.id, i));
            filteredCustom.forEach(ct => ct.issues.forEach(i => {
                if (!allById.has(i.id)) allById.set(i.id, i);
            }));
            const allIssues = Array.from(allById.values());

            const exportPayload: any = {
                exportInfo: {
                    generatedAt: new Date().toISOString(),
                    generatedAtLocal: new Date().toLocaleString('pl-PL'),
                    project: projectQuery,
                    dateFrom,
                    dateTo,
                    totalIssues: allIssues.length,
                    description: `Pełny eksport danych YouTrack z projektu "${projectQuery}" za okres ${dateFrom} - ${dateTo}. Zawiera aktywności oraz ${customTabs.length} dedykowanych zakładek. Przygotowany do analizy AI.`
                },
                summary: makeSummary(allIssues),
                aktywnosci: {
                    description: `Zadania zaktualizowane w przedziale ${dateFrom} - ${dateTo}`,
                    ...makeSummary(filteredActivity),
                    issues: serializeIssues(filteredActivity),
                }
            };

            // Add custom tabs to payload
            filteredCustom.forEach(ct => {
                const safeName = ct.tab.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                exportPayload[safeName] = {
                    name: ct.tab.name,
                    statuses: ct.tab.statuses,
                    ...makeSummary(ct.issues),
                    issues: serializeIssues(ct.issues),
                };
            });

            exportPayload.allIssues = serializeIssues(allIssues);

            const json = JSON.stringify(exportPayload, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `youtrack-export-${projectQuery.replace(/[^a-zA-Z0-9]/g, '_')}-${dateFrom}-${dateTo}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Błąd eksportu JSON:', err);
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        setProjectQuery(project.youtrackQuery || project.code || '');
        setHasFetched(false); // Resetujemy stan pobierania gdy zmieniamy projekt
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id, project.youtrackQuery, project.code]); // Reload when changing projects

    useEffect(() => {
        if (projectQuery) {
            localStorage.setItem(`yt_query_${project.id}`, projectQuery);
        }
    }, [projectQuery, project.id]);

    useEffect(() => {
        if (hasFetched || activeTab !== 'Aktywności') {
            handleFetch(false, projectQuery, activeTab);
        }
    }, [activeTab]);

    // Lightbox handlers
    const openLightbox = (src: string, alt: string) => {
        setLightboxImage({ src, alt });
        setLightboxScale(1);
        setDragPos({ x: 0, y: 0 });
    };

    const closeLightbox = () => setLightboxImage(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeLightbox();
        };
        if (lightboxImage) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxImage]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY * -0.001;
        const newScale = Math.min(Math.max(0.5, lightboxScale + delta), 4);
        setLightboxScale(newScale);
    };

    const renderTextWithImages = (text: string, attachments: { name: string, url: string }[] = []) => {
        if (!text) return null;

        // Dopasowuje Markdown: ![alt](url) LUB tag HTML: <img ... src="url" ...>
        // UWAGA: dodano obsługę `src='url'` i `src="url"` oraz upewniono się, że wyciągamy sam link. Dodano wyłapywanie i ignorowanie atrybutów YouTrackowych jak {width=70%} po URL-u w markdownie.
        const regex = /(?:!\[([^\]]*)\]\(([^)]+)\)(?:\{[^}]*\})?)|(?:<img\b[^>]*src=(?:"|')([^"']+)(?:"|')[^>]*>(?:<\/img>)?)/gi;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
            }

            let alt = '';
            let url = '';

            if (match[2]) {
                // Format Markdown ![alt](url)
                alt = match[1] || '';
                url = match[2];
            } else if (match[3]) {
                // Format tagu HTML <img src="url"> LUB <img src='url'>
                url = match[3];
                // Spróbuj wyciągnąć atrybut alt
                const altMatch = match[0].match(/alt=(?:"|')([^"']+)(?:"|')/i);
                if (altMatch) {
                    alt = altMatch[1];
                }
            }

            if (url) {
                // YouTrack formals HTML tags like `<img src="...&amp;updated=...">` 
                // Browsers decode `&amp;` automatically when parsing HTML, but our regex extracts it literally.
                // We must unescape it to `&` so the `fetch` signature remains valid.
                let decodedUrl = url.replace(/&amp;/g, '&');

                // Jeśli YouTrack podaje jako src tylko nazwę obrazka (np: image.png), to znak, że jest to Markdown odwołujący się do załącznika w API
                if (!decodedUrl.includes('/') && !decodedUrl.startsWith('http')) {
                    const attachment = attachments.find(a => a.name === decodedUrl);
                    if (attachment && attachment.url) {
                        decodedUrl = attachment.url;
                    }
                }

                // Często YouTrack zwraca adresy względne np `/api/files/...` - w takiej sytuacji musimy wkleić z przodu prawidłowy BaseURL z ustawień.
                if (decodedUrl.startsWith('/')) {
                    decodedUrl = `${settings?.youtrackBaseUrl?.replace(/\/$/, '') || ''}${decodedUrl}`;
                }

                // Dodano wywołanie pełnoekranowego Lightboxa na kliknięcie
                parts.push(
                    <div
                        key={`img-wrap-${match.index}`}
                        className="my-3 inline-block cursor-zoom-in transition-transform hover:scale-[1.02]"
                        onClick={() => openLightbox(decodedUrl, alt)}
                    >
                        <AuthenticatedImage
                            src={decodedUrl}
                            alt={alt}
                            className="max-h-[500px] object-contain rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
                        />
                    </div>
                );
            }

            lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
            parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
        }

        return parts.length > 0 ? parts : text;
    };

    const getFieldChangeText = (item: ActivityItem) => {
        const fname = item.field?.toLowerCase() || '';

        const newSpan = <span className="text-emerald-600 dark:text-emerald-400 font-medium">{item.added}</span>;
        const oldSpan = <span className="text-red-500/80 mr-1">{item.removed}</span>;

        if (fname.includes('state') || fname.includes('status')) {
            return <span>zmieniono status na {newSpan}</span>;
        } else if (fname.includes('type') || fname.includes('typ') && !fname.includes('priority')) {
            return <span>zmieniono typ zadania na {newSpan}</span>;
        } else if (fname.includes('priority') || fname.includes('priorytet')) {
            return <span>zmieniono priorytet na {newSpan}</span>;
        } else if (fname.includes('assignee') || fname.includes('przypisany')) {
            if (item.removed && item.removed !== 'Brak' && item.removed !== 'Unassigned') {
                return <span>przekazano zadanie do {newSpan}</span>;
            } else {
                return <span>przypisano zadanie do {newSpan}</span>;
            }
        } else if (fname.includes('estimation') || fname.includes('estymacja')) {
            if (item.added === 'Brak' && (item.removed === 'Brak' || !item.removed)) {
                return null; // Zwrócenie nulla sprawi, że filtr to odrzuci w renderTimelineGroup
            } else if (item.added === 'Brak' && item.removed !== 'Brak') {
                return <span>Usunięto estymację</span>;
            } else if (item.removed && item.removed !== 'Brak' && item.added !== 'Brak') {
                return <span>zmieniono estymację z {oldSpan} na {newSpan}</span>;
            } else {
                return <span>wyestymowano zadanie na: {newSpan}</span>;
            }
        } else if (fname.includes('due date') || fname.includes('termin')) {
            const formatDate = (val: string | any[] | undefined) => {
                const strVal = String(val);
                if (strVal === 'Brak' || !strVal) return 'Brak';
                const dateNum = Number(strVal);
                return isNaN(dateNum) ? strVal : format(new Date(dateNum), 'dd.MM.yyyy');
            };
            const oldFormatted = <span className="text-red-500/80 mr-1">{formatDate(item.removed)}</span>;
            const newFormatted = <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatDate(item.added)}</span>;
            return <span>zmieniono termin z {oldFormatted} na {newFormatted}</span>;
        } else {
            return <span>zmieniono {item.field} z {oldSpan} =&gt; {newSpan}</span>;
        }
    };

    const renderTimelineGroup = (group: any, idx: number, issue: any) => {
        if (group.items.length === 1) {
            const item = group.items[0];
            if (item.type === 'comment') {
                const content = typeof item.text === 'string' ? item.text : JSON.stringify(item.text);
                return (
                    <div key={idx} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 shadow-sm mb-3 latest:mb-0">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-sm text-blue-800 dark:text-blue-400">{group.authorName}:</span>
                            <span className="text-xs text-gray-500 font-medium">{group.timeStr}</span>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md">Komentarz</span>
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {renderTextWithImages(content, issue?.attachments || [])}
                        </div>
                    </div>
                );
            }
            if (item.type === 'description-change') {
                return (
                    <div key={item.id} className="text-sm text-gray-800 dark:text-gray-200 py-1.5 border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                        <span className="font-medium text-gray-500 mr-2">{group.timeStr}</span>
                        <span className="font-semibold text-blue-800 dark:text-blue-400">{group.authorName}:</span> zaktualizowano treść zadania. Zmieniono:
                        <div className="mt-1 text-xs text-gray-500 bg-gray-50 dark:bg-gray-900 p-2 rounded">
                            <span className="line-through text-red-500/80 mr-2">{renderTextWithImages(item.removed || 'Brak', [])}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">=&gt; {renderTextWithImages(item.added || 'Brak', [])}</span>
                        </div>
                    </div>
                );
            }
        }

        const actionTexts = group.items.map((item: ActivityItem, idx: number) => {
            if (item.type === 'field-change') return <span key={idx}>{getFieldChangeText(item)}</span>;
            if (item.type === 'work-item') {
                const mins = item.minutes || 0;
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                const durationStr = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;

                let commentsNode = null;
                if (item.workComments && item.workComments.length > 0) {
                    const combined = item.workComments.filter(c => c.trim() !== '').join(', ');
                    if (combined) {
                        commentsNode = <span className="text-gray-500 dark:text-gray-400 italic ml-1">("{combined}")</span>;
                    }
                }

                return <span key={idx}>zarejestrowano pracę <span className="text-emerald-600 dark:text-emerald-400 font-medium">{durationStr}</span>{commentsNode}</span>;
            }
            if (item.type === 'issue-created') return <span key={idx}>dodano zadanie</span>;
            return null;
        }).filter(Boolean);

        return (
            <div key={group.key + group.items.length} className="text-sm text-gray-800 dark:text-gray-200 py-1.5 border-b border-gray-100 dark:border-gray-800/50 last:border-0 leading-relaxed">
                <span className="font-medium text-gray-500 mr-2">{group.timeStr}</span>
                {actionTexts.length > 0 && <span className="font-semibold text-blue-800 dark:text-blue-400">{group.authorName}:</span>}
                {actionTexts.length > 0 ? (
                    <span className="ml-1">
                        {actionTexts.map((action: any, i: number) => (
                            <span key={i}>
                                {action}
                                {i < actionTexts.length - 1 ? ', ' : ''}
                            </span>
                        ))}
                    </span>
                ) : ''}
            </div>
        );
    };

    if (!settings?.youtrackBaseUrl || !settings?.youtrackToken) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <AlertCircle size={48} className="text-orange-400 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Brak Konfiguracji YouTrack</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">Przejdź do Ustawień Głównych (ikona zębatki w panelu bocznym) i wprowadź adres Base URL oraz Permanent Token do platformy YouTrack.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">

            {/* FILTERS PANEL */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Projekty (np. PMS, CBCP)</label>
                        <input type="text" value={projectQuery} onChange={e => setProjectQuery(e.target.value)} placeholder="Projekty..." className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Od</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Do</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={useCache} onChange={() => setUseCache(!useCache)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                        Używaj cache
                    </label>
                    <button
                        onClick={() => handleFetch(true, projectQuery, activeTab)}
                        disabled={isLoading}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        {isLoading ? "Pobieranie..." : "Pobierz dane"}
                    </button>
                    <button
                        onClick={handleExportJson}
                        disabled={isExporting || !settings?.youtrackBaseUrl || !settings?.youtrackToken}
                        title="Eksportuj do JSON (do analizy AI)"
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                        {isExporting ? 'Eksportowanie...' : 'Eksport JSON'}
                    </button>
                </div>
            </div>

            {/* ERROR MESSAGE */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-start gap-3 border border-red-100 dark:border-red-800/50">
                    <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                    <div className="font-medium">Wystąpił błąd: <span className="font-normal block mt-1">{error}</span></div>
                </div>
            )}

            {/* TABBAR */}
            <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-gray-800 px-2 lg:px-4 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('Aktywności')}
                    className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors duration-200 whitespace-nowrap ${activeTab === 'Aktywności'
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                >
                    Aktywności
                </button>

                {customTabs.map((tab, idx) => (
                    <div 
                        key={tab.id} 
                        className={`relative group/tab flex-shrink-0 transition-opacity ${draggedTabIdx === idx ? 'opacity-30' : 'opacity-100'}`}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(idx)}
                    >
                        <button
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors duration-200 whitespace-nowrap cursor-grab active:cursor-grabbing ${tab.name.toLowerCase() !== 'zakończone' ? 'pr-12' : 'pr-8'} ${activeTab === tab.id
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                        >
                            {tab.name}
                        </button>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover/tab:opacity-100 transition-opacity bg-white/80 dark:bg-gray-800/80 px-1 rounded">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleEditTab(tab); }}
                                className="p-1 text-gray-400 hover:text-indigo-500"
                                title="Edytuj"
                            >
                                <Pencil size={14} />
                            </button>
                            {tab.name.toLowerCase() !== 'zakończone' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteCustomTab(tab.id); }}
                                    className="p-1 text-gray-400 hover:text-red-500"
                                    title="Usuń"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                <button
                    onClick={() => {
                        setEditingTabId(null);
                        setNewTabName('');
                        setNewTabStatuses('');
                        setNewTabIncludeFilters(false);
                        setShowAddTabModal(true);
                    }}
                    className="p-2 ml-2 text-gray-400 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Dodaj nową zakładkę"
                >
                    <Plus size={20} />
                </button>
            </div>

            {/* RESULTS LIST */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-20 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                {!isLoading && data.length === 0 && !error && hasFetched && (
                    <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                        <p className="text-gray-500 dark:text-gray-400">Brak aktywności w wybranym przedziale czasowym dla projektu: <strong>{projectQuery}</strong>.</p>
                    </div>
                )}

                {!isLoading && data.length === 0 && !error && !hasFetched && (
                    <div className="text-center p-12 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                        <MessageSquare size={48} className="text-gray-300 dark:text-gray-600 mb-4 mx-auto" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-200 mb-2">Platforma YouTrack</h3>
                        <p className="text-gray-500 dark:text-gray-400">Naciśnij "Pobierz dane", aby wczytać aktywność w wybranym przedziale.</p>
                    </div>
                )}

                {[...data].sort((a, b) => {
                    const aTime = a.timeline.length > 0 ? a.timeline[0].timestamp : Number.MAX_SAFE_INTEGER;
                    const bTime = b.timeline.length > 0 ? b.timeline[0].timestamp : Number.MAX_SAFE_INTEGER;
                    return aTime - bTime;
                }).map(issue => {
                    const isExcluded = excludedIssues.has(issue.idReadable);
                    const isDropdownOpen = openDropdownId === issue.idReadable;
                    return (
                        <details open={!isExcluded} key={issue.id} className={`group bg-white dark:bg-gray-800 rounded-2xl shadow-sm border outline-none transition-opacity ${isExcluded ? 'opacity-50 border-red-200 dark:border-red-900/50' : 'border-gray-100 dark:border-gray-800'} relative ${isDropdownOpen ? 'z-40' : 'z-10'}`}>
                            <summary className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-start justify-between cursor-pointer select-none outline-none group-open:bg-gray-50/80 dark:group-open:bg-gray-800/80 transition-colors rounded-2xl group-open:rounded-b-none group-open:rounded-t-2xl">
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-3 mb-1">
                                        <a
                                            href={`${settings.youtrackBaseUrl}/issue/${issue.idReadable}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {issue.idReadable}
                                        </a>

                                        {issue.state && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                                                {issue.state}
                                            </span>
                                        )}

                                        {(issue as any).assignee?.name && (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50 flex items-center gap-1">
                                                <span className="font-normal opacity-80">Realizuje:</span>
                                                {(issue as any).assignee.name}
                                            </span>
                                        )}

                                        {issue.dueDate && (() => {
                                            const now = new Date();
                                            now.setHours(0, 0, 0, 0);
                                            const due = new Date(issue.dueDate);
                                            due.setHours(0, 0, 0, 0);

                                            const MS_PER_DAY = 1000 * 60 * 60 * 24;
                                            const remainingDays = Math.round((due.getTime() - now.getTime()) / MS_PER_DAY);

                                            let colorClass = "text-gray-500 dark:text-gray-400";
                                            let iconColorClass = "text-gray-400";

                                            if (remainingDays <= 1) {
                                                colorClass = "text-red-600 dark:text-red-400 font-bold";
                                                iconColorClass = "text-red-500 dark:text-red-400";
                                            } else if (remainingDays <= 2) {
                                                colorClass = "text-yellow-600 dark:text-yellow-400 font-bold";
                                                iconColorClass = "text-yellow-500 dark:text-yellow-400";
                                            }

                                            return (
                                                <span className={`text-xs flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${colorClass}`}>
                                                    <Calendar size={12} className={iconColorClass} />
                                                    Termin: {format(due, 'dd.MM.yyyy')}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <ChevronDown size={20} className="text-gray-400 transition-transform group-open:-rotate-180 flex-shrink-0" />
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight flex-1">{issue.summary}</h3>
                                        
                                        {/* Wybór rodzaju zadania */}
                                        {project.taskTypes && project.taskTypes.length > 0 && (() => {
                                            const currentTypeId = issueTaskTypes[issue.idReadable] || project.taskTypes[0].id;
                                            const currentType = project.taskTypes.find(t => t.id === currentTypeId);
                                            const CurrentIcon = currentType ? (TaskTypeIconMap[currentType.icon] || Code) : Code;
                                            
                                            // Handle saving the default type lazily if the user hasn't explicitly set it
                                            const handleSelectType = (e: React.MouseEvent, typeId: string) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setIssueTaskType(issue.idReadable, typeId);
                                                setOpenDropdownId(null);
                                            };

                                            return (
                                                <div className="relative ml-auto shrink-0 flex items-center">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setOpenDropdownId(prev => prev === issue.idReadable ? null : issue.idReadable);
                                                        }}
                                                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
                                                        style={currentType ? { color: currentType.color, borderColor: currentType.color } : undefined}
                                                        title="Rodzaj zadania"
                                                    >
                                                        <CurrentIcon size={14} />
                                                        <span>{currentType ? currentType.name : 'Typ'}</span>
                                                        <ChevronDown size={12} className="opacity-50" />
                                                    </button>

                                                    {openDropdownId === issue.idReadable && (
                                                        <>
                                                            {/* Backdrop do zamknięcia kliknięciem na zewnątrz (prosty trick zamiast nasłuchiwaczy) */}
                                                            <div 
                                                                className="fixed inset-0 z-10" 
                                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenDropdownId(null); }} 
                                                            />
                                                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-20 animate-in fade-in slide-in-from-top-2 focus:outline-none overflow-hidden">
                                                                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 mb-1">
                                                                    Zmień rodzaj
                                                                </div>
                                                                {project.taskTypes.map(tt => {
                                                                    const Icon = TaskTypeIconMap[tt.icon] || Code;
                                                                    const isSelected = tt.id === currentTypeId;
                                                                    return (
                                                                        <button
                                                                            key={tt.id}
                                                                            onClick={(e) => handleSelectType(e, tt.id)}
                                                                            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition hover:bg-gray-50 dark:hover:bg-gray-700 ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                                                                        >
                                                                            <Icon size={14} style={{ color: tt.color }} />
                                                                            <span className="truncate">{tt.name}</span>
                                                                            {isSelected && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* TTIME TRACKING & PROGRESS BAR */}
                                    {(issue.estimation || issue.spentTime) && (
                                        <div className="mt-3 bg-gray-100/50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200/50 dark:border-gray-700/50">
                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm mb-2">
                                                {issue.estimation && (
                                                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                                                        <span className="font-medium">Estymacja:</span>
                                                        <span className="font-bold">{issue.estimation.presentation}</span>
                                                    </div>
                                                )}
                                                {issue.spentTime && (
                                                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                                        <Clock size={14} />
                                                        <span className="font-medium">Przepracowano:</span>
                                                        <span className="font-bold">{issue.spentTime.presentation}</span>
                                                    </div>
                                                )}
                                                {issue.estimation && issue.spentTime && issue.estimation.minutes > 0 && (
                                                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                                                        <span className="font-medium">Pozostało:</span>
                                                        <span className="font-bold">
                                                            {Math.max(0, issue.estimation.minutes - issue.spentTime.minutes) === 0
                                                                ? '0m'
                                                                : formatMinutesToDuration(Math.max(0, issue.estimation.minutes - issue.spentTime.minutes))}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* PROGRESS BAR */}
                                            {issue.estimation && issue.estimation.minutes > 0 && (
                                                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1 flex">
                                                    {(() => {
                                                        const estMin = issue.estimation.minutes;
                                                        const spentMin = issue.spentTime ? issue.spentTime.minutes : 0;
                                                        let percent = Math.round((spentMin / estMin) * 100);

                                                        // Kolor paska: zielony jeśli ok, pomarańczowy jeśli blisko, czerwony jeśli przekroczony
                                                        let bgClass = "bg-emerald-500";
                                                        if (percent > 100) {
                                                            bgClass = "bg-red-500";
                                                            percent = 100;
                                                        } else if (percent > 85) {
                                                            bgClass = "bg-orange-500";
                                                        }

                                                        return (
                                                            <div
                                                                className={`h-full ${bgClass} transition-all duration-500`}
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {issue.resolved && (
                                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 flex-shrink-0 ml-4 mt-1">
                                        Rozwiązane
                                    </span>
                                )}
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleExclusion(issue.idReadable); }}
                                    title={isExcluded ? 'Włącz analizę AI (zadanie będzie w eksporcie)' : 'Wyklucz z analizy AI (zadanie nie pojawi się w eksporcie JSON)'}
                                    className={`ml-3 mt-1 p-1.5 rounded-lg flex-shrink-0 transition-all ${isExcluded
                                        ? 'bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60'
                                        : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 hover:bg-violet-100 hover:text-violet-500 dark:hover:bg-violet-900/30 dark:hover:text-violet-400'
                                        }`}
                                >
                                    <BrainCircuit size={15} />
                                </button>
                            </summary>

                            {/* ISSUE BODY */}
                            <div className="px-5 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                                {issue.description ? (
                                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                        {renderTextWithImages(issue.description, issue.attachments || [])}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">Brak opisu zadania.</p>
                                )}
                            </div>

                            <div className="p-4 bg-gray-50/30 dark:bg-gray-900/20 rounded-b-2xl">
                                {issue.timeline.length > 0 ? (
                                    <div className="space-y-1">
                                        {(() => {
                                            const groupedItems: any[] = [];
                                            let currentGroup: any = null;

                                            issue.timeline.forEach(item => {
                                                const isDateOnly = item.type === 'work-item' || item.type === 'issue-created';
                                                const timeStr = format(new Date(item.timestamp), isDateOnly ? 'dd.MM.yyyy' : 'dd.MM.yyyy HH:mm');
                                                const authorName = item.author.name || item.author.login;
                                                const groupKey = `${timeStr}-${authorName}`;

                                                if (
                                                    currentGroup &&
                                                    currentGroup.key === groupKey &&
                                                    item.type !== 'comment' &&
                                                    item.type !== 'description-change' &&
                                                    currentGroup.items[0].type !== 'comment' &&
                                                    currentGroup.items[0].type !== 'description-change'
                                                ) {
                                                    currentGroup.items.push(item);
                                                } else {
                                                    currentGroup = {
                                                        key: groupKey,
                                                        timeStr,
                                                        authorName,
                                                        items: [item]
                                                    };
                                                    groupedItems.push(currentGroup);
                                                }
                                            });

                                            const dFrom = new Date(dateFrom); dFrom.setHours(0, 0, 0, 0);
                                            const dTo = new Date(dateTo); dTo.setHours(23, 59, 59, 999);
                                            const fromTime = dFrom.getTime();
                                            const toTime = dTo.getTime();

                                            const historyInRange: any[] = [];
                                            const historyOutRange: any[] = [];
                                            const alwaysVisible: any[] = [];

                                            groupedItems.forEach(group => {
                                                if (activeTab !== 'Aktywności') {
                                                    // Na innych zakładkach pokazujemy zawsze komentarze ORAZ wpisy o przepracowanym czasie na wierzchu
                                                    if (group.items.some((i: any) => i.type === 'comment' || i.type === 'work-item')) {
                                                        alwaysVisible.push(group);
                                                    } else {
                                                        historyOutRange.push(group);
                                                    }
                                                } else {
                                                    const groupTime = group.items[0].timestamp;
                                                    if (groupTime >= fromTime && groupTime <= toTime) {
                                                        historyInRange.push(group);
                                                    } else {
                                                        historyOutRange.push(group);
                                                    }
                                                }
                                            });

                                            return (
                                                <>
                                                    {activeTab !== 'Aktywności' && alwaysVisible.length > 0 && (
                                                        <div className="space-y-1 mb-4">
                                                            {alwaysVisible.map((group, idx) => (
                                                                <div key={`vis-${idx}`}>{renderTimelineGroup(group, idx, issue)}</div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {historyOutRange.length > 0 && (() => {
                                                        // Sortujemy by wyciagnac pierwsza i ostatnia date po ewentualnym rozłożeniu
                                                        const sortedOutRange = [...historyOutRange].sort((a, b) => a.items[0].timestamp - b.items[0].timestamp);
                                                        const firstItemTimestamp = sortedOutRange[0].items[0].timestamp;
                                                        const lastGroup = sortedOutRange[sortedOutRange.length - 1];
                                                        const lastItemTimestamp = lastGroup.items[lastGroup.items.length - 1].timestamp;

                                                        const firstDateStr = format(new Date(firstItemTimestamp), 'dd.MM.yyyy');
                                                        const lastDateStr = format(new Date(lastItemTimestamp), 'dd.MM.yyyy');
                                                        const rangeStr = firstDateStr === lastDateStr ? firstDateStr : `${firstDateStr} - ${lastDateStr}`;

                                                        return (
                                                            <details className="group mb-4 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800/50 overflow-hidden">
                                                                <summary className="flex items-center justify-between cursor-pointer p-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none outline-none">
                                                                    <span>{activeTab === 'Aktywności' ? 'Starsza historia' : 'Historia zmian zadania'} ({historyOutRange.length} wpisów{activeTab === 'Aktywności' ? ' poza przedziałem' : ''}) <span className="opacity-75 font-normal ml-1">({rangeStr})</span></span>
                                                                    <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
                                                                </summary>
                                                                <div className="p-3 pt-0 space-y-1">
                                                                    {sortedOutRange.map((group, idx) => (
                                                                        <div key={`out-${idx}`}>{renderTimelineGroup(group, idx, issue)}</div>
                                                                    ))}
                                                                </div>
                                                            </details>
                                                        );
                                                    })()}

                                                    {activeTab === 'Aktywności' && (
                                                        <div className="space-y-1">
                                                            {historyInRange.length > 0 ? historyInRange.map((group, idx) => (
                                                                <div key={`in-${idx}`}>{renderTimelineGroup(group, idx + historyOutRange.length, issue)}</div>
                                                            )) : (
                                                                <p className="text-sm text-gray-400 dark:text-gray-500 italic py-2">Brak aktywności obok tego zadania w wybranym przedziale {format(dFrom, 'dd.MM')} - {format(dTo, 'dd.MM')}.</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 dark:text-gray-500 italic p-2">Nie wykryto wpisów w historii.</p>
                                )}
                            </div>
                        </details>
                    );
                })}

                {isLoading && data.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-12">
                        <Loader2 size={32} className="animate-spin text-indigo-500 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Synchronizacja danych z YouTrack...</p>
                    </div>
                )}
            </div>

            {/* LIGHTBOX MODAL */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeLightbox();
                    }}
                    onWheel={handleWheel}
                    onMouseMove={(e) => {
                        if (isDragging) {
                            setDragPos({
                                x: dragPos.x + (e.clientX - startPos.x),
                                y: dragPos.y + (e.clientY - startPos.y)
                            });
                            setStartPos({ x: e.clientX, y: e.clientY });
                        }
                    }}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                >
                    <button
                        onClick={closeLightbox}
                        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-50 focus:outline-none"
                    >
                        <X size={24} />
                    </button>

                    <div className="absolute bottom-6 flex items-center gap-4 px-4 py-2 bg-black/50 rounded-full text-white backdrop-blur-md z-50 border border-white/10">
                        <button onClick={(e) => { e.stopPropagation(); setLightboxScale(s => Math.max(0.5, s - 0.25)); }} className="p-1.5 hover:bg-white/20 rounded-full transition-colors"><ZoomOut size={20} /></button>
                        <span className="text-sm font-medium w-12 text-center">{Math.round(lightboxScale * 100)}%</span>
                        <button onClick={(e) => { e.stopPropagation(); setLightboxScale(s => Math.min(4, s + 0.25)); }} className="p-1.5 hover:bg-white/20 rounded-full transition-colors"><ZoomIn size={20} /></button>
                    </div>

                    <div
                        className="relative transition-transform duration-75 ease-out cursor-grab active:cursor-grabbing max-w-[90vw] max-h-[90vh] flex items-center justify-center"
                        style={{
                            transform: `translate(${dragPos.x}px, ${dragPos.y}px) scale(${lightboxScale})`
                        }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                            setStartPos({ x: e.clientX, y: e.clientY });
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <AuthenticatedImage
                            src={lightboxImage.src}
                            alt={lightboxImage.alt}
                            className="max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl pointer-events-none"
                        />
                    </div>
                </div>
            )}

            {/* ADD / EDIT TAB MODAL */}
            {showAddTabModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                {editingTabId ? <Pencil size={24} className="text-indigo-500" /> : <Plus size={24} className="text-indigo-500" />}
                                {editingTabId ? 'Edytuj zakładkę' : 'Dodaj nową zakładkę'}
                            </h3>
                            <button onClick={() => { setShowAddTabModal(false); setEditingTabId(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Nazwa zakładki</label>
                                <input
                                    type="text"
                                    value={newTabName}
                                    onChange={e => setNewTabName(e.target.value)}
                                    disabled={!!editingTabId && newTabName.toLowerCase() === 'zakończone'}
                                    placeholder="np. Na teście"
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm disabled:opacity-60"
                                />
                                {newTabName.toLowerCase() === 'zakończone' && (
                                    <p className="text-[10px] text-indigo-500 mt-1 italic font-medium">Ta zakładka automatycznie uwzględnia filtr daty.</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Statusy z YouTrack (oddzielone przecinkiem)</label>
                                <textarea
                                    value={newTabStatuses}
                                    onChange={e => setNewTabStatuses(e.target.value)}
                                    placeholder="np. Test, Ready to Test, Verified"
                                    rows={3}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm resize-none"
                                />
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 italic leading-tight mb-4">
                                    Statusy muszą dokładnie odpowiadać nazwom z YouTrack. System pobierze zadania posiadające którykolwiek z podanych statusów.
                                </p>
                            </div>
                            <div>
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={newTabIncludeFilters}
                                            onChange={e => setNewTabIncludeFilters(e.target.checked)}
                                            className="peer sr-only"
                                        />
                                        <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-colors"></div>
                                        <svg className="absolute w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Uwzględniaj filtry (Data Od - Do)</span>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight block mt-0.5">
                                            Jeśli zaznaczone, zakładka pobierze tylko zadania zmienione w wybranym przedziale czasu.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                            <button
                                onClick={() => { setShowAddTabModal(false); setEditingTabId(null); }}
                                className="px-5 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                            >
                                Anuluj
                            </button>
                            <button
                                onClick={saveNewTab}
                                disabled={!newTabName.trim() || !newTabStatuses.trim()}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                            >
                                {editingTabId ? 'Zapisz zmiany' : 'Dodaj zakładkę'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
