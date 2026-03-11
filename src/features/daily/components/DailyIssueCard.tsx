import { useState, useEffect, useMemo, useRef } from 'react';
import { ExternalLink, User, MessageSquare, Eye, EyeOff, RefreshCw, Edit2 } from 'lucide-react';
import { useProjectContext } from '../../../context/ProjectContext';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface DailyIssueCardProps {
  issue: any;
  localComment: string;
  isCollapsed: boolean;
  dateFrom: string;
  dateTo: string;
  onAssigneeFilter: (assignee: string | null) => void;
  onSaveComment: (content: string) => void;
  onToggleCollapse: (isCollapsed: boolean) => void;
}

export const DailyIssueCard = ({ issue, localComment, isCollapsed, dateFrom, dateTo, onAssigneeFilter, onSaveComment, onToggleCollapse }: DailyIssueCardProps) => {
  const { settings } = useProjectContext();
  const [commentText, setCommentText] = useState(localComment);
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setCommentText(localComment);
  }, [localComment]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    onSaveComment(commentText);
    setIsSaved(true);
    setIsEditing(false);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const youtrackUrl = settings?.youtrackBaseUrl 
    ? `${settings.youtrackBaseUrl}/issue/${issue.idReadable}`
    : '#';

  const handleOpenYouTrack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.electron && youtrackUrl !== '#') {
      window.electron.openExternal(youtrackUrl);
    }
  };

  const handleAssigneeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (issue.assignee) {
      const id = issue.assignee.id || issue.assignee.login;
      onAssigneeFilter(id);
    }
  };

  // Helper to format minutes (e.g., 90 -> 1h 30m)
  const formatMins = (mins: number) => {
    if (!mins) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim();
  };

  // Filter timeline and aggregate work logs
  const { filteredTimeline, workLogsByAuthor, periodTotalMins } = useMemo(() => {
    if (!issue.timeline) return { filteredTimeline: [], workLogsByAuthor: {}, periodTotalMins: 0 };
    
    const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
    const toTime = new Date(`${dateTo}T23:59:59`).getTime();

    const logs: Record<string, number> = {};
    let total = 0;

    const timeline = issue.timeline.filter((item: any) => {
      const isDateInRange = item.timestamp >= fromTime && item.timestamp <= toTime;
      if (!isDateInRange) return false;

      if (item.type === 'work-item') {
        const authorName = item.author.name;
        logs[authorName] = (logs[authorName] || 0) + (item.minutes || 0);
        total += (item.minutes || 0);
        return false; // Don't show work items in history list, we aggregate them
      }

      if (item.type === 'comment') return true;
      if (item.type === 'field-change' && (item.field.toLowerCase() === 'state' || item.field.toLowerCase() === 'status')) return true;
      
      return false;
    });

    return { filteredTimeline: timeline, workLogsByAuthor: logs, periodTotalMins: total };
  }, [issue.timeline, dateFrom, dateTo]);

  // Progress Bar Data
  const spentMins = issue.spentTime?.minutes || 0;
  const estimationMins = issue.estimation?.minutes || 0;
  const progressPercent = estimationMins > 0 ? Math.min((spentMins / estimationMins) * 100, 100) : 0;
  const isOverLimit = spentMins > estimationMins && estimationMins > 0;
  const isNearLimit = !isOverLimit && estimationMins > 0 && spentMins >= estimationMins * 0.8;

  const progressColorClass = isOverLimit 
    ? 'bg-red-500' 
    : isNearLimit 
      ? 'bg-orange-500' 
      : 'bg-emerald-500';

  const progressTextClass = isOverLimit 
    ? 'text-red-600 dark:text-red-400' 
    : isNearLimit 
      ? 'text-orange-600 dark:text-orange-400' 
      : 'text-emerald-600 dark:text-emerald-500';

  // COLLAPSED VIEW (ONE LINE)
  if (isCollapsed) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all px-2.5 py-1.5 flex items-center justify-between gap-3 group opacity-20 hover:opacity-100">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <a 
            href={youtrackUrl}
            onClick={handleOpenYouTrack}
            className="text-[10px] font-mono font-bold text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1 shrink-0"
          >
            {issue.idReadable}
          </a>
          <h4 className="text-[10px] font-medium text-gray-600 dark:text-gray-400 truncate">
            {issue.summary}
          </h4>
        </div>
        
        <div className="flex items-center gap-2 shrink-0 text-gray-400">
          {periodTotalMins > 0 && (
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1 rounded">
              +{formatMins(periodTotalMins)}
            </span>
          )}
          {localComment && <MessageSquare size={10} className="text-amber-500" />}
          {issue.assignee && (
            <div 
              className="flex items-center gap-1 cursor-pointer hover:text-indigo-500 hover:underline transition-all"
              onClick={handleAssigneeClick}
              title={`Filtruj zadania dla: ${issue.assignee.fullName || issue.assignee.name}`}
            >
              <User size={10} />
              <span className="text-[10px] font-medium max-w-[60px] truncate">
                {issue.assignee.fullName || issue.assignee.name}
              </span>
            </div>
          )}
          {onToggleCollapse && (
            <button 
              onClick={() => onToggleCollapse(false)}
              className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-gray-50 dark:bg-gray-800 rounded"
              title="Pokaż kartę"
            >
              <Eye size={12} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // NORMAL FULL VIEW
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all overflow-hidden group/card relative">
      {/* HEADER: ID & Project */}
      <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between border-b dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
            {issue.project?.shortName || 'PRJ'}
          </span>
          <a 
            href={youtrackUrl}
            onClick={handleOpenYouTrack}
            className="text-[10px] font-mono font-bold text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-1"
          >
            {issue.idReadable} <ExternalLink size={10} />
          </a>
        </div>
        <div className="flex items-center gap-1.5">
           {issue.assignee ? (
             <div 
               className="flex items-center gap-1 text-gray-400 hover:text-indigo-500 hover:underline cursor-pointer transition-all" 
               title={`Filtruj zadania dla: ${issue.assignee.fullName || issue.assignee.name}`}
               onClick={handleAssigneeClick}
             >
                <User size={10} />
                <span className="text-[10px] font-medium max-w-[120px] truncate">{issue.assignee.fullName || issue.assignee.name}</span>
             </div>
           ) : (
             <span className="text-[10px] text-gray-300 italic">Nieprzypisane</span>
           )}
           <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-1"></div>
           
           <button 
             onClick={() => setIsEditing(!isEditing)}
             className={`p-1 transition-colors ${localComment ? 'text-amber-500 hover:text-amber-600' : 'text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 opacity-0 group-hover/card:opacity-100'}`}
             title="Brudnopis PM"
           >
             <Edit2 size={12} />
           </button>

            {onToggleCollapse && (
              <button 
                onClick={() => onToggleCollapse(true)}
                className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors opacity-0 group-hover/card:opacity-100"
                title="Zwiń kartę"
              >
                <EyeOff size={12} />
              </button>
            )}
        </div>
      </div>

      <div className="p-3">
        {/* SUMMARY */}
        <h4 className="text-xs font-bold text-gray-800 dark:text-gray-100 mb-1 leading-snug line-clamp-2">
          {issue.summary}
        </h4>

        {/* DEADLINE */}
        {issue.dueDate && (
          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold text-[10px] uppercase tracking-wider mb-2">
            <span>Deadline:</span>
            <span>{format(new Date(issue.dueDate), 'd MMMM yyyy', { locale: pl })}</span>
          </div>
        )}

        {/* PROGRESS BAR */}
        {(spentMins > 0 || estimationMins > 0) && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-[9px] font-bold mb-1">
              <span className={progressTextClass}>
                {issue.spentTime?.presentation || formatMins(spentMins)}
              </span>
              <span className="text-gray-400">
                {issue.estimation?.presentation || formatMins(estimationMins)}
              </span>
            </div>
            <div className="h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${progressColorClass}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* WORK LOGS FOR PERIOD */}
        {Object.keys(workLogsByAuthor).length > 0 && (
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
            {Object.entries(workLogsByAuthor).map(([author, mins]) => (
              <div key={author} className="flex items-center gap-1 text-[10px]">
                <span className="text-gray-500 font-medium">{author}:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatMins(mins as number)}</span>
              </div>
            ))}
          </div>
        )}

        {/* PM SCRATCHPAD (IF EDITING OR HAS CONTENT) */}
        {(isEditing || localComment) && (
          <div className={`mb-3 p-2 rounded-lg border transition-all ${isEditing ? 'bg-amber-50/50 border-amber-200 ring-1 ring-amber-100 dark:bg-amber-900/10 dark:border-amber-900/50' : 'bg-amber-50/30 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/20'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-tighter flex items-center gap-1">
                <MessageSquare size={10} /> Brudnopis PM
              </span>
              {isSaved && <span className="text-[9px] text-emerald-500 font-bold animate-pulse">Zapisano!</span>}
            </div>
            
            {isEditing ? (
              <textarea
                ref={textareaRef}
                className="w-full min-h-[60px] text-[11px] bg-transparent border-none focus:ring-0 outline-none resize-none dark:text-gray-300 placeholder:italic placeholder:text-gray-400/50"
                placeholder="Wpisz notatkę..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onBlur={() => {
                  if (commentText !== localComment) handleSave();
                  else setIsEditing(false);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSave();
                  }
                  if (e.key === 'Escape') {
                    setCommentText(localComment);
                    setIsEditing(false);
                  }
                }}
              />
            ) : (
              <p 
                onClick={() => setIsEditing(true)}
                className="text-[11px] text-gray-700 dark:text-gray-400 italic cursor-pointer hover:text-gray-900 dark:hover:text-gray-200"
              >
                {localComment}
              </p>
            )}
          </div>
        )}

        {/* ACTIVITY HISTORY (COMMENTS & STATUS CHANGES) */}
        {filteredTimeline.length > 0 && (
          <div className="space-y-1.5 bg-gray-50/50 dark:bg-gray-800/30 p-2 rounded-lg border border-gray-100/50 dark:border-gray-800/50">
            {filteredTimeline.map((item: any, idx: number) => (
              <div key={idx} className="text-[10px] leading-relaxed">
                {item.type === 'comment' ? (
                  <div className="text-gray-600 dark:text-gray-400">
                    <span className="font-bold text-gray-800 dark:text-gray-200">{item.author.name}:</span> {item.text}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                    <RefreshCw size={8} />
                    <span>{item.removed}</span>
                    <span className="text-gray-400">→</span>
                    <span>{item.added}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
