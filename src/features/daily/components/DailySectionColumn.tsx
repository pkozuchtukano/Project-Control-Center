import { } from 'react';
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
  forceCollapsed?: boolean;
}

export const DailySectionColumn = ({ 
  section, issues, comments, issueStates, 
  onCommentSave, onSaveIssueState, 
  onAssigneeFilter, dateFrom, dateTo,
  forceCollapsed = false
}: DailySectionColumnProps) => {

  return (
    <div className="w-80 flex flex-col shrink-0 group/col relative">
      <div className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm -mx-2 px-2 pb-4 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wider">{section.name}</h3>
             <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full">{issues.length}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 pb-4">
        {issues.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center bg-white/30 dark:bg-gray-900/10 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Brak</p>
          </div>
        ) : (
          issues.map(issue => (
            <DailyIssueCard 
              key={issue.id} 
              issue={issue} 
              localComment={comments[issue.idReadable] || ''}
              isCollapsed={forceCollapsed ? true : (issueStates[issue.idReadable] || false)}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onAssigneeFilter={onAssigneeFilter}
              onSaveComment={(content: string) => onCommentSave(issue.idReadable, content)}
              onToggleCollapse={forceCollapsed ? undefined : (isCollapsed: boolean) => onSaveIssueState(issue.idReadable, isCollapsed)}
            />
          ))
        )}
      </div>

    </div>
  );
};
