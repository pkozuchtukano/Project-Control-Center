import React, { useState } from 'react';
import { X, ExternalLink, Calendar, User, Clock, MessageSquare, History, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { type IssueWithHistory } from '../../../services/youtrackApi';
import { useProjectContext } from '../../../context/ProjectContext';

interface FormattedContentProps {
  text: string;
  youtrackBaseUrl: string;
  youtrackToken: string;
  attachments?: any[];
}

const FormattedContent = ({ text, youtrackBaseUrl, youtrackToken, attachments }: FormattedContentProps) => {
  if (!text) return null;

  // Split by markdown image pattern: ![alt](url){attr}
  const parts = text.split(/(!\[.*?\]\(.*?\)(?:\{.*?\})?)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)(?:\{(.*?)\})?/);
        if (imgMatch) {
          const alt = imgMatch[1];
          let url = imgMatch[2];
          const attr = imgMatch[3] || '';

          const attachment = attachments?.find(a => 
            url.includes(a.name) || (a.id && url.includes(a.id)) || url === a.name
          );

          if (attachment?.url) {
            url = attachment.url;
          }

          let finalUrl = url;
          if (url.startsWith('/') && youtrackBaseUrl) {
            finalUrl = `${youtrackBaseUrl}${url}`;
          }

          if (finalUrl.includes('/api/')) {
             const separator = finalUrl.includes('?') ? '&' : '?';
             finalUrl = `${finalUrl}${separator}access_token=${youtrackToken}`;
          }

          let customWidth: string | undefined = undefined;
          if (attr) {
            const widthMatch = attr.match(/width=(\d+%?)/);
            if (widthMatch) {
              customWidth = widthMatch[1];
            }
          }

          return (
            <div key={i} className="my-4 group/img relative inline-block max-w-full">
              <img 
                src={finalUrl} 
                alt={alt} 
                className="rounded-lg border dark:border-gray-800 h-auto shadow-sm hover:shadow-md transition-shadow cursor-zoom-in bg-gray-50 dark:bg-gray-800/20"
                style={{ 
                  minHeight: '40px', 
                  minWidth: '40px',
                  width: customWidth || 'auto',
                  maxWidth: '100%'
                }}
                onClick={() => window.electron?.openExternal(finalUrl)}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-md text-[10px] text-white rounded opacity-0 group-hover/img:opacity-100 transition-opacity">
                 Kliknij, aby otworzyć oryginał
              </span>
            </div>
          );
        }

        return (
          <p key={i} className="whitespace-pre-wrap break-words">
            {part}
          </p>
        );
      })}
    </div>
  );
};

interface DailyIssueDetailsModalProps {
  issue: IssueWithHistory;
  isOpen: boolean;
  onClose: () => void;
  dateFrom: string;
  dateTo: string;
}

export const DailyIssueDetailsModal = ({ issue, isOpen, onClose, dateFrom, dateTo }: DailyIssueDetailsModalProps) => {
  const { settings } = useProjectContext();
  const [isDescExpanded, setIsDescExpanded] = useState(true);
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(true);
  const [showOlderHistory, setShowOlderHistory] = useState(false);

  if (!isOpen) return null;

  const youtrackBaseUrl = settings?.youtrackBaseUrl || '';
  const youtrackToken = settings?.youtrackToken || '';
  const youtrackUrl = youtrackBaseUrl ? `${youtrackBaseUrl}/issue/${issue.idReadable}` : '#';

  const handleOpenYouTrack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.electron && youtrackUrl !== '#') {
      window.electron.openExternal(youtrackUrl);
    }
  };

  const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
  const toTime = new Date(`${dateTo}T23:59:59`).getTime();

  const filterSupportedActivities = (activities: any[]) => {
    return (activities || []).filter(a => {
      if (a.type === 'comment') return true;
      if (a.type === 'work-item') return true;
      if (a.type === 'field-change') {
        return a.field && (a.added || a.removed);
      }
      return false;
    });
  };

  const periodActivities = filterSupportedActivities(issue.timeline?.filter(a => a.timestamp >= fromTime && a.timestamp <= toTime) || []);
  const olderActivities = filterSupportedActivities(issue.timeline?.filter(a => a.timestamp < fromTime) || []);

  const formatActivityDate = (ts: number) => {
    return format(new Date(ts), 'PPP p', { locale: pl });
  };

  const priorityInfo = issue.priority && issue.priority.name.toLowerCase() !== 'normal' ? {
      name: issue.priority.name,
      initial: issue.priority.name.charAt(0).toUpperCase(),
      color: issue.priority.color
  } : null;

  const typeInfo = issue.type ? {
      name: issue.type.name,
      initial: issue.type.name.charAt(0).toUpperCase(),
      color: issue.type.color
  } : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded text-xs font-bold tracking-wider">
              {issue.project?.shortName || 'PRJ'}
            </span>
            <a 
              href={youtrackUrl} 
              onClick={handleOpenYouTrack}
              className="font-mono text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-1"
            >
              {issue.idReadable} <ExternalLink size={14} />
            </a>
            {typeInfo && (
              <span 
                title={typeInfo.name}
                className="text-xs font-bold px-1.5 py-0.5 rounded shadow-sm border border-black/5"
                style={{ backgroundColor: typeInfo.color.background, color: typeInfo.color.foreground }}
              >
                {typeInfo.initial}
              </span>
            )}
            {issue.state && (
              <span 
                className="text-xs font-bold px-2 py-0.5 rounded shadow-sm"
                style={{ backgroundColor: issue.state.color?.background, color: issue.state.color?.foreground }}
              >
                {issue.state.name}
              </span>
            )}
            {priorityInfo && (
              <span 
                className="text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm"
                style={{ backgroundColor: priorityInfo.color.background, color: priorityInfo.color.foreground }}
              >
                {priorityInfo.name}
              </span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-400 dark:text-gray-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Title & Description */}
          <section className="space-y-4">
            <div 
              className="flex items-center justify-between cursor-pointer group/title"
              onClick={() => setIsDescExpanded(!isDescExpanded)}
            >
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white leading-tight group-hover:text-indigo-600 transition-colors">
                {issue.summary}
              </h2>
              <div className="text-gray-400 group-hover:text-indigo-600 transition-colors">
                {isDescExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
              </div>
            </div>
            
            {isDescExpanded && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border dark:border-gray-800 animate-in slide-in-from-top-2 duration-200">
                <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                  {issue.description ? (
                    <FormattedContent 
                      text={issue.description} 
                      youtrackBaseUrl={youtrackBaseUrl}
                      youtrackToken={youtrackToken}
                      attachments={issue.attachments}
                    />
                  ) : (
                    <p className="italic text-gray-400 text-sm">Brak opisu zadania.</p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Meta Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b dark:border-gray-800 pb-2 flex items-center gap-2">
                <User size={14} /> Przypisanie
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                  {issue.assignee?.name.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-sm font-bold dark:text-white">{issue.assignee?.fullName || issue.assignee?.name || 'Nieprzypisane'}</p>
                  <p className="text-[10px] text-gray-400 font-mono italic">{issue.assignee?.login || '-'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b dark:border-gray-800 pb-2 flex items-center gap-2">
                <Clock size={14} /> Estymacja i Czas
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Estymacja:</span>
                  <span className="font-bold dark:text-white">{issue.estimation?.presentation || 'Brak'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Przepracowano:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{issue.spentTime?.presentation || '0h'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b dark:border-gray-800 pb-2 flex items-center gap-2">
                <Calendar size={14} /> Terminy
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Utworzono:</span>
                  <span className="dark:text-gray-300">{issue.created ? format(new Date(issue.created), 'PP', { locale: pl }) : '-'}</span>
                </div>
                {issue.dueDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Termin (Due):</span>
                    <span className="font-bold text-amber-600">{format(new Date(issue.dueDate), 'PP', { locale: pl })}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline / Activity */}
          <section className="space-y-4">
            <div 
              className="flex items-center justify-between cursor-pointer group/section border-b dark:border-gray-800 pb-2"
              onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
            >
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 group-hover:text-indigo-500 transition-colors">
                <History size={14} /> Historia Aktywności {periodActivities.length > 0 && `(W wybranym okresie: ${periodActivities.length})`}
              </h3>
              <div className="text-gray-400 group-hover:text-indigo-600 transition-colors">
                {isTimelineExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
            
            {isTimelineExpanded && (
              <div className="relative border-l-2 border-gray-100 dark:border-gray-800 ml-3 pl-6 space-y-6 py-2 animate-in slide-in-from-top-2 duration-200">
                {olderActivities.length > 0 && (
                   <div className="pb-4 border-b border-dashed dark:border-gray-800 mb-6">
                      <button 
                        onClick={() => setShowOlderHistory(!showOlderHistory)}
                        className="text-[10px] font-black text-gray-400 hover:text-indigo-500 transition-colors uppercase tracking-[0.2em] flex items-center gap-2"
                      >
                        {showOlderHistory ? 'Zwiń starszą historię' : `+ Pokaż starszą historię (${olderActivities.length})`}
                        {showOlderHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>

                      {showOlderHistory && (
                        <div className="mt-6 space-y-6 animate-in slide-in-from-top-4 duration-300">
                          {olderActivities.map((activity) => (
                            <div key={activity.id} className="relative opacity-70 hover:opacity-100 transition-opacity">
                              <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-gray-600 ring-4 ring-white dark:ring-gray-900"></div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{activity.author.name}</span>
                                <span className="text-[10px] text-gray-400">• {formatActivityDate(activity.timestamp)}</span>
                              </div>
                              
                              <div className="text-sm bg-gray-50/50 dark:bg-gray-800/10 rounded-lg p-3 border border-dashed dark:border-gray-800">
                                {activity.type === 'comment' && (
                                  <div className="flex gap-2 text-gray-500 dark:text-gray-400 italic">
                                    <MessageSquare size={14} className="text-blue-400 shrink-0 mt-0.5" />
                                    <FormattedContent 
                                      text={activity.text || ''} 
                                      youtrackBaseUrl={youtrackBaseUrl}
                                      youtrackToken={youtrackToken}
                                      attachments={issue.attachments}
                                    />
                                  </div>
                                )}
                                {activity.type === 'field-change' && (
                                  <div className="space-y-1">
                                    <p className="font-bold text-xs text-gray-400 uppercase tracking-tighter">{activity.field}</p>
                                    <div className="flex items-center gap-2 text-[11px]">
                                      <span className="text-gray-400 line-through decoration-1">{activity.removed}</span>
                                      <span className="text-gray-400">→</span>
                                      <span className="text-gray-500 font-bold">{activity.added}</span>
                                    </div>
                                  </div>
                                )}
                                {activity.type === 'work-item' && (
                                  <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-gray-400" />
                                    <span className="font-bold text-gray-500">+{activity.minutes ? Math.floor(activity.minutes / 60) + 'h ' + (activity.minutes % 60) + 'm' : '0m'}</span>
                                    <span className="text-gray-500 dark:text-gray-400">({activity.workItemType || 'Praca'})</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                   </div>
                )}

                {periodActivities.map((activity) => (
                  <div key={activity.id} className="relative">
                    <div className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-gray-900"></div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-gray-900 dark:text-white">{activity.author.name}</span>
                      <span className="text-[10px] text-gray-400">• {formatActivityDate(activity.timestamp)}</span>
                    </div>
                    
                    <div className="text-sm bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3 border dark:border-gray-800/50">
                      {activity.type === 'comment' && (
                        <div className="flex gap-2">
                          <MessageSquare size={14} className="text-blue-500 shrink-0 mt-1" />
                          <div className="text-gray-600 dark:text-gray-300 italic flex-1">
                            <FormattedContent 
                              text={activity.text || ''} 
                              youtrackBaseUrl={youtrackBaseUrl}
                              youtrackToken={youtrackToken}
                              attachments={issue.attachments}
                            />
                          </div>
                        </div>
                      )}
                      {activity.type === 'field-change' && (
                        <div className="space-y-1">
                          <p className="font-bold text-xs text-gray-500 uppercase tracking-tighter">{activity.field}</p>
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="text-red-400 line-through decoration-1">{activity.removed}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-emerald-500 font-bold">{activity.added}</span>
                          </div>
                        </div>
                      )}
                      {activity.type === 'work-item' && (
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-emerald-500" />
                          <span className="font-bold text-emerald-600">+{activity.minutes ? Math.floor(activity.minutes / 60) + 'h ' + (activity.minutes % 60) + 'm' : '0m'}</span>
                          <span className="text-gray-500 dark:text-gray-400">({activity.workItemType || 'Praca'})</span>
                          {activity.workComments && activity.workComments.length > 0 && (
                            <p className="text-xs italic text-gray-400">— {activity.workComments.join(', ')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {periodActivities.length === 0 && (
                  <p className="text-sm text-gray-500 italic ml-4">Brak aktywności w wybranym zakresie dat.</p>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
