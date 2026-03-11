import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DailySection } from '../../../types';
import { DailyIssueCard } from './DailyIssueCard';

interface DailySectionColumnProps {
  section: DailySection;
  issues: any[];
  comments: Record<string, string>;
  issueStates: Record<string, boolean>;
  onCommentSave: (issueId: string, content: string) => void;
  onSaveIssueState: (issueId: string, isCollapsed: boolean) => void;
  onAssigneeFilter: (assignee: string | null) => void;
  dateFrom: string;
  dateTo: string;
  columnCollapsed?: boolean;
  onToggleColumnCollapse?: () => void;
  isGlobalExpanded?: boolean;
}

export const DailySectionColumn = ({ 
  section, issues, comments, issueStates, 
  onCommentSave, onSaveIssueState, 
  onAssigneeFilter, dateFrom, dateTo,
  columnCollapsed = false, onToggleColumnCollapse,
  isGlobalExpanded = false
}: DailySectionColumnProps) => {

  return (
    <div className={`flex flex-col shrink-0 transition-all duration-300 ${columnCollapsed ? 'w-12' : 'w-80'} group/col relative`}>
      <div 
        className={`sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm -mx-2 px-2 pb-4 mb-2 cursor-pointer hover:text-indigo-600 transition-colors`}
        onClick={onToggleColumnCollapse}
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
              <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wider truncate">
                {section.name}
              </h3>
              <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {issues.length}
              </span>
            </>
          )}
        </div>
      </div>

      {!columnCollapsed && (
        <div className="space-y-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {issues.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center bg-white/30 dark:bg-gray-900/10 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Brak</p>
            </div>
          ) : (
            issues.map(issue => (
              <DailyIssueCard 
                key={issue.idReadable} 
                issue={issue} 
                localComment={comments[issue.idReadable] || ''}
                isCollapsed={section.id === 'fixed_aktywnosci' ? (issueStates[issue.idReadable] ?? false) : (isGlobalExpanded ? false : (issueStates[issue.idReadable] ?? false))}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onAssigneeFilter={onAssigneeFilter}
                onSaveComment={(content: string) => onCommentSave(issue.idReadable, content)}
                onToggleCollapse={(isCollapsed: boolean) => onSaveIssueState(issue.idReadable, isCollapsed)}
                showState={section.id === 'fixed_aktywnosci'}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
