import { useState, useEffect } from 'react';
import { format, startOfMonth } from 'date-fns';
import {
    BarChart3, Trello, RefreshCw,
    AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';
import { type Project, useProjectContext } from '../../../App';
import { useWorkRegistry } from '../hooks/useWorkRegistry';
import { YouTrackTable } from './YouTrackTable';
import { StatisticsView } from './StatisticsView';
import { syncWorkItems, type SyncProgress } from '../services/youtrackSync';
import { ProjectLinksDropdown } from '../../project-links/components/ProjectLinksMain';

interface Props {
    project: Project;
    settings: { youtrackBaseUrl: string; youtrackToken: string } | null;
}

export const WorkRegistryMain = ({ project, settings }: Props) => {
    const { updateProject } = useProjectContext();
    const { workItems, isLoading, error, setCategory, setCategoriesBulk, refresh } = useWorkRegistry(project);
    const [activeTab, setActiveTab] = useState<'stats' | 'youtrack'>('stats');
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
    const [projectQuery, setProjectQuery] = useState(project.youtrackQuery || project.code || '');
    const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-01'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

    useEffect(() => {
        setProjectQuery(project.youtrackQuery || project.code || '');
    }, [project.id, project.youtrackQuery, project.code]);

    const openSyncModal = () => {
        let defaultFrom = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        if (workItems && workItems.length > 0) {
            const latestItem = workItems.reduce((latest, current) =>
                current.date > latest.date ? current : latest
            );
            defaultFrom = latestItem.date.split('T')[0];
        }

        setDateFrom(defaultFrom);
        setDateTo(format(new Date(), 'yyyy-MM-dd'));
        setIsSyncModalOpen(true);
    };

    const handleSync = async () => {
        if (!settings?.youtrackBaseUrl || !settings?.youtrackToken) {
            alert('Skonfiguruj YouTrack w ustawieniach głównych przed synchronizacją.');
            return;
        }

        if (projectQuery !== project.youtrackQuery) {
            await updateProject(project.id, { youtrackQuery: projectQuery });
        }

        await syncWorkItems(
            project.id,
            projectQuery,
            dateFrom,
            dateTo,
            settings.youtrackBaseUrl,
            settings.youtrackToken,
            (progress) => {
                setSyncProgress(progress);
                if (progress.status === 'completed') {
                    refresh();
                    setTimeout(() => setSyncProgress(null), 3000);
                }
            }
        );
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
            {/* Header / Sub-navigation */}
            <div className="flex flex-col gap-4 border-b border-gray-200 dark:border-gray-800 mb-6 bg-white dark:bg-gray-800 p-3 px-6 rounded-2xl shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${activeTab === 'stats'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                    >
                        <BarChart3 size={18} />
                        Statystyka
                    </button>
                    <button
                        onClick={() => setActiveTab('youtrack')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${activeTab === 'youtrack'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                    >
                        <Trello size={18} />
                        YouTrack
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <ProjectLinksDropdown project={project} visibleInTab="work" />
                    {syncProgress && syncProgress.status === 'syncing' ? (
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                <Loader2 size={14} className="animate-spin" />
                                Synchronizacja: {syncProgress.currentMonth}
                            </div>
                            <div className="w-48 bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-indigo-500 h-full transition-all duration-300"
                                    style={{ width: `${(syncProgress.currentChunk / syncProgress.totalChunks) * 100}%` }}
                                />
                            </div>
                        </div>
                    ) : syncProgress && syncProgress.status === 'completed' ? (
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-bold animate-in zoom-in duration-300">
                            <CheckCircle2 size={18} />
                            Zsynchronizowano
                        </div>
                    ) : (
                        <button
                            onClick={openSyncModal}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition-all border border-indigo-100 dark:border-indigo-800"
                        >
                            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                            Aktualizuj z YouTrack
                        </button>
                    )}
                </div>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-700 dark:text-red-400">
                    <AlertCircle size={20} />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center p-20 gap-4">
                        <Loader2 size={40} className="text-indigo-500 animate-spin" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Ładowanie rejestru pracy...</p>
                    </div>
                ) : activeTab === 'stats' ? (
                    <StatisticsView items={workItems} />
                ) : (
                    <YouTrackTable
                        items={workItems}
                        onSetCategory={setCategory}
                        onSetCategoriesBulk={setCategoriesBulk}
                        youtrackBaseUrl={settings?.youtrackBaseUrl}
                    />
                )}
            </div>

            {/* Sync Modal */}
            {isSyncModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            Synchronizacja YouTrack
                        </h3>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Kod YouTrack</label>
                                <input type="text" value={projectQuery} onChange={e => setProjectQuery(e.target.value)} placeholder="Kod..." className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Data Od</label>
                                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Data Do</label>
                                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsSyncModalOpen(false)}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                            >
                                Anuluj
                            </button>
                            <button
                                onClick={() => {
                                    setIsSyncModalOpen(false);
                                    handleSync();
                                }}
                                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-md shadow-indigo-200 dark:shadow-none"
                            >
                                Rozpocznij
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
