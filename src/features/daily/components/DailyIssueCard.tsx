import { useState, useEffect, useMemo, useRef } from 'react';
import { ExternalLink, User, Eye, EyeOff, Edit2, MoreVertical } from 'lucide-react';
import { DailyIssueDetailsModal } from './DailyIssueDetailsModal';
import { useProjectContext } from '../../../context/ProjectContext';

interface DailyIssueCardProps {
  issue: any;
  localComment: string;
  isCollapsed: boolean;
  dateFrom: string;
  dateTo: string;
  onSaveComment: (content: string) => void;
  onToggleCollapse?: (isCollapsed: boolean) => void;
  onAssigneeFilter: (assignee: string | null) => void;
  showState?: boolean;
}

export const DailyIssueCard = ({ 
  issue, 
  localComment, 
  isCollapsed, 
  dateFrom,
  dateTo,
  onSaveComment, 
  onToggleCollapse,
  onAssigneeFilter,
  showState = true
}: DailyIssueCardProps) => {
  const [comment, setComment] = useState(localComment);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { settings } = useProjectContext();

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    setComment(localComment);
  }, [localComment]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [isEditing]);

  const handleSave = () => {
    onSaveComment(comment);
    setIsEditing(false);
  };

  const youtrackBaseUrl = settings?.youtrackBaseUrl || '';
  const youtrackUrl = youtrackBaseUrl ? `${youtrackBaseUrl}/issue/${issue.idReadable}` : '#';

  const handleOpenYouTrack = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.electron && youtrackUrl !== '#') {
      window.electron.openExternal(youtrackUrl);
    }
  };

  const handleAssigneeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (issue.assignee?.login) {
      onAssigneeFilter(issue.assignee.login);
    }
  };

  const formatMins = (m: number) => {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
  };

  const { spentTimeMins, estimationMins } = useMemo(() => {
    return {
      spentTimeMins: issue.spentTime?.minutes || 0,
      estimationMins: issue.estimation?.minutes || 0
    };
  }, [issue]);

  const progressPercent = useMemo(() => {
    if (!estimationMins) return 0;
    return Math.min(Math.round((spentTimeMins / estimationMins) * 100), 100);
  }, [spentTimeMins, estimationMins]);

  const progressColorClass = useMemo(() => {
    if (progressPercent >= 100) return 'bg-red-500';
    if (progressPercent >= 80) return 'bg-amber-500';
    return 'bg-emerald-500';
  }, [progressPercent]);

  const progressTextClass = useMemo(() => {
    if (progressPercent >= 100) return 'text-red-600 dark:text-red-500';
    if (progressPercent >= 80) return 'text-amber-600 dark:text-amber-500';
    return 'text-emerald-600 dark:text-emerald-500';
  }, [progressPercent]);

  // Priority Initial and Color
  const priorityInfo = useMemo(() => {
    if (!issue.priority || issue.priority.name === 'Normal') return null;
    const name = issue.priority.name;
    const initial = name.charAt(0).toUpperCase();
    return {
        initial,
        color: issue.priority.color
    };
  }, [issue.priority]);

  const typeInfo = useMemo(() => {
    if (!issue.type) return null;
    const name = issue.type.name;
    return {
        initial: name.charAt(0).toUpperCase(),
        color: issue.type.color,
        name
    };
  }, [issue.type]);

  const periodActivities = useMemo(() => {
    if (!issue.timeline) return [];
    const fTime = new Date(`${dateFrom}T00:00:00`).getTime();
    const tTime = new Date(`${dateTo}T23:59:59`).getTime();

    return issue.timeline.filter((a: any) => {
      if (a.timestamp < fTime || a.timestamp > tTime) return false;
      if (a.type === 'comment') return true;
      if (a.type === 'work-item') return true;
      if (a.type === 'field-change') return a.field && (a.added || a.removed);
      return false;
    });
  }, [issue.timeline, dateFrom, dateTo]);

  // COLLAPSED VIEW (ONE LINE)
  if (isCollapsed) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all px-2.5 py-1.5 flex items-center justify-between gap-3 group opacity-20 hover:opacity-100">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <a 
            href={youtrackUrl}
            onClick={handleOpenYouTrack}
            className="text-[10px] font-mono font-bold text-gray-400 hover:text-indigo-600 shrink-0"
          >
            {issue.idReadable}
          </a>
          
          <div className="flex items-center gap-1 shrink-0">
             {typeInfo && (
                <span 
                  title={typeInfo.name}
                  className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-black shadow-sm"
                  style={{ backgroundColor: typeInfo.color.background, color: typeInfo.color.foreground }}
                >
                  {typeInfo.initial}
                </span>
             )}
             {priorityInfo && (
              <span 
                className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-black shadow-sm"
                style={{ backgroundColor: priorityInfo.color.background, color: priorityInfo.color.foreground }}
              >
                {priorityInfo.initial}
              </span>
            )}
          </div>

          <span 
            className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate cursor-help"
            onClick={() => setIsDetailModalOpen(true)}
          >
            {issue.summary}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onToggleCollapse && (
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleCollapse(false); }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-400 transition-colors"
              title="Rozwiń"
            >
              <Eye size={14} />
            </button>
          )}
        </div>

        {isDetailModalOpen && (
          <DailyIssueDetailsModal 
            issue={issue}
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        )}
      </div>
    );
  }

  // FULL VIEW
  return (
    <div 
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-lg transition-all flex flex-col group overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gray-50/50 dark:bg-gray-800/30 px-3 py-2 border-b dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <a 
            href={youtrackUrl}
            onClick={handleOpenYouTrack}
            className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
          >
            {issue.idReadable}
          </a>
          
          <div className="flex items-center gap-1">
            {typeInfo && (
              <span 
                title={typeInfo.name}
                className="text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm border border-black/5"
                style={{ backgroundColor: typeInfo.color.background, color: typeInfo.color.foreground }}
              >
                {typeInfo.initial}
              </span>
            )}
            {priorityInfo && (
              <span 
                className="text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm border border-black/5"
                style={{ backgroundColor: priorityInfo.color.background, color: priorityInfo.color.foreground }}
              >
                {priorityInfo.initial}
              </span>
            )}
            {showState && issue.state && (
              <span 
                className="text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm opacity-80"
                style={{ backgroundColor: issue.state.color.background, color: issue.state.color.foreground }}
              >
                {issue.state.name}
              </span>
            )}
          </div>
        </div>

        {/* Triple Dot Menu */}
        <div className="flex items-center gap-1">
          <div className="relative group/menu">
            <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-gray-400">
              <MoreVertical size={14} />
            </button>
            <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20 overflow-hidden">
               <button 
                  onClick={() => setIsDetailModalOpen(true)}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
               >
                  <ExternalLink size={12} /> Szczegóły
               </button>
               {onToggleCollapse && (
                  <button 
                    onClick={() => onToggleCollapse(true)}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <EyeOff size={12} /> Zwiń kartę
                  </button>
               )}
            </div>
          </div>
        </div>
      </div>

      {/* Body - Click to Open Details */}
      <div 
        className="p-3 space-y-3 cursor-zoom-in hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors"
        onClick={() => setIsDetailModalOpen(true)}
      >
        <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight break-words">
          {issue.summary}
        </h4>

        {/* Time Progress */}
        {(estimationMins > 0 || spentTimeMins > 0) && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-end text-[10px]">
              <span className="text-gray-400 font-medium">Czas: {spentTimeMins > 0 ? formatMins(spentTimeMins) : '0m'} / {estimationMins > 0 ? formatMins(estimationMins) : '-'}</span>
              <span className={`font-black ${progressTextClass}`}>{progressPercent}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full ${progressColorClass} transition-all duration-500 rounded-full shadow-sm`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Activity Preview (Only for Aktywności column or if showState is true) */}
        {showState && periodActivities.length > 0 && (
          <div className="pt-2 border-t dark:border-gray-800/50 space-y-2">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Aktywność ({periodActivities.length})</span>
            <div className="space-y-1.5">
              {periodActivities.map((act: any, idx: number) => (
                <div key={idx} className="flex gap-2 items-start text-[11px] leading-tight">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-gray-700 dark:text-gray-300 mr-1">{act.author.name}:</span>
                    <span className="text-gray-500 dark:text-gray-400 italic break-words">
                      {act.type === 'comment' && act.text}
                      {act.type === 'field-change' && `${act.field}: ${act.added}`}
                      {act.type === 'work-item' && (
                        <>
                          Zalogowano {formatMins(act.minutes)}
                          {act.workComments && act.workComments.length > 0 && (
                            <span className="text-gray-400 dark:text-gray-500"> — {act.workComments.join(', ')}</span>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              ))}
              {periodActivities.length > 3 && false && (
                <p className="text-[9px] text-indigo-500 font-bold ml-3.5 italic">+ {periodActivities.length - 3} więcej (zobacz szczegóły)</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assignee & Footer */}
      <div className="px-3 pb-3 pt-1 flex items-center justify-between mt-auto">
        <div 
          className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-1 -ml-1 rounded-lg transition-colors overflow-hidden flex-1"
          onClick={handleAssigneeClick}
          title={`Filtruj po: ${issue.assignee?.name || 'Brak'}`}
        >
          <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-[10px] shrink-0">
            {issue.assignee?.name?.charAt(0).toUpperCase() || <User size={12} />}
          </div>
          <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 truncate">
            {issue.assignee?.name || 'Nieprzypisane'}
          </span>
        </div>
        
        <button 
          onClick={() => setIsEditing(true)}
          className={`shrink-0 p-1.5 rounded-lg transition-all ${localComment ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          title="Notatka PM"
        >
          <Edit2 size={14} />
        </button>
      </div>

      {/* Local Comment (Brudnopis) */}
      {localComment && !isEditing && (
        <div className="px-3 pb-3">
          <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100/50 dark:border-amber-800/30 rounded-lg p-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] font-black text-amber-600/70 dark:text-amber-500/50 uppercase tracking-widest">Brudnopis PM</span>
            </div>
            <p className="text-xs text-amber-900/80 dark:text-amber-200/70 leading-relaxed font-medium break-words">
              {localComment}
            </p>
          </div>
        </div>
      )}

      {/* Editing Overlay */}
      {isEditing && (
        <div className="absolute inset-0 z-30 bg-white dark:bg-gray-900 p-3 flex flex-col animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Edycja notatki</span>
          </div>
          <textarea
            ref={textareaRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="flex-1 w-full p-2 text-sm bg-gray-50 dark:bg-gray-800 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-medium dark:text-white"
            placeholder="Dodaj własne notatki PM dla tego zadania..."
          />
          <div className="flex gap-2 mt-3">
            <button 
              onClick={handleSave}
              className="flex-1 bg-indigo-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 dark:shadow-none"
            >
              Zapisz
            </button>
            <button 
              onClick={() => { setIsEditing(false); setComment(localComment); }}
              className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all font-mono"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {isDetailModalOpen && (
        <DailyIssueDetailsModal 
          issue={issue}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}
    </div>
  );
};
