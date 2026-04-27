import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DailySection } from '../../../types';
import { DailyIssueCard } from './DailyIssueCard';

interface DailySectionColumnProps {
  section: DailySection;
  issues: any[];
  activityIssueIds: Set<string>;
  comments: Record<string, string>;
  skippedInAiIssues: Record<string, boolean>;
  issueStates: Record<string, boolean>;
  onCommentSave: (issueId: string, content: string) => void;
  onToggleSkipInAi: (issueId: string, skipInAi: boolean) => void;
  onSaveIssueState: (issueId: string, isCollapsed: boolean) => void;
  onAssigneeFilter: (assignee: string | null) => void;
  dateFrom: string;
  dateTo: string;
  columnCollapsed?: boolean;
  onToggleColumnCollapse?: () => void;
  isGlobalExpanded?: boolean;
  isMinimalView?: boolean;
  isWideExpanded?: boolean;
  onToggleWide?: () => void;
}

export const DailySectionColumn = ({ 
  section, issues, activityIssueIds, comments, skippedInAiIssues, issueStates, 
  onCommentSave, onToggleSkipInAi, onSaveIssueState, 
  onAssigneeFilter, dateFrom, dateTo,
  columnCollapsed = false, onToggleColumnCollapse,
  isGlobalExpanded = false,
  isMinimalView = false,
  isWideExpanded = false,
  onToggleWide
}: DailySectionColumnProps) => {
  const isActivitySection = section.id === 'fixed_aktywnosci';
  const columnWidthClass = columnCollapsed
    ? 'w-12'
    : isWideExpanded
      ? 'w-full min-w-full'
      : 'w-80';
  const issueListClass = isWideExpanded
    ? 'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 pb-4 animate-in fade-in slide-in-from-top-2 duration-300'
    : 'space-y-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-300';

  return (
    <div className={`flex flex-col shrink-0 transition-all duration-300 ${columnWidthClass} group/col relative`}>
      <div 
        className={`sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm -mx-2 px-2 pb-4 mb-2 ${isWideExpanded ? '' : 'cursor-pointer hover:text-indigo-600'} transition-colors`}
        onClick={isWideExpanded ? undefined : onToggleColumnCollapse}
        title={columnCollapsed ? 'Rozwiń kolumnę' : 'Zwiń kolumnę'}
      >
        <div className="flex items-center gap-2">
          {columnCollapsed ? (
            <div className="flex flex-col items-center gap-4 py-2">
              <ChevronRight size={18} className="text-gray-400" />
              <h3 className="font-bold text-gray-700 dark:text-gray-300 text-[10px] uppercase tracking-wider [writing-mode:vertical-lr] rotate-180 whitespace-nowrap">
                {section.name}
              </h3>
              <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {issues.length}
              </span>
            </div>
          ) : (
            <>
              <ChevronDown size={18} className="text-gray-400 shrink-0" />
              <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wider truncate flex-1">
                {section.name}
              </h3>
              <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {issues.length}
              </span>
              {onToggleWide && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleWide();
                  }}
                  className={`ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                    isWideExpanded
                      ? 'border-indigo-200 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 dark:border-indigo-700'
                      : 'border-gray-200 bg-white text-gray-400 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-700'
                  }`}
                  title={isWideExpanded ? 'Wróć do normalnych sekcji' : 'Rozwiń sekcję na całą szerokość'}
                >
                  {isWideExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!columnCollapsed && (
        <div className={issueListClass}>
          {issues.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center bg-white/30 dark:bg-gray-900/10 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Brak</p>
            </div>
          ) : (
            issues.map(issue => {
              const storedState = issueStates[issue.idReadable];
              const autoCollapsed = isActivitySection ? false : activityIssueIds.has(issue.idReadable);
              let resolvedCollapsed = storedState !== undefined ? storedState : autoCollapsed;
              if (isActivitySection) {
                resolvedCollapsed = storedState ?? false;
              } else if (isGlobalExpanded) {
                resolvedCollapsed = false;
              }
              return (
                <DailyIssueCard 
                  key={issue.idReadable} 
                  issue={issue} 
                  localComment={comments[issue.idReadable] || ''}
                  skipInAi={!!skippedInAiIssues[issue.idReadable]}
                  isCollapsed={resolvedCollapsed}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onAssigneeFilter={onAssigneeFilter}
                  isMinimalView={isMinimalView}
                  onSaveComment={(content: string) => onCommentSave(issue.idReadable, content)}
                  onToggleSkipInAi={(skipInAi: boolean) => onToggleSkipInAi(issue.idReadable, skipInAi)}
                  onToggleCollapse={(collapsed: boolean) => onSaveIssueState(issue.idReadable, collapsed)}
                  showState={isActivitySection}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
