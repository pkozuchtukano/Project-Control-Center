export type Project = {
  id: string;
  code: string;
  name: string;
  youtrackQuery: string;
};

export type ProjectLink = {
  id: string;
  projectId: string;
  name: string;
  url: string;
  visibleInTabs: string[];
  createdAt: string;
  updatedAt: string;
};

export type DailyHub = {
  id: string;
  name: string;
  description: string;
  projectCodes: string;
};

export type DailySection = {
  id: string;
  hubId: string;
  name: string;
  youtrackStatuses: string;
  orderIndex: number;
  respectDates: boolean;
};

export type DailyComment = {
  issueId: string;
  content: string;
  lastModified: string;
};

export type DailyIssueState = {
  issueId: string;
  isCollapsed: boolean;
  updatedAt: string;
};

export type StatusStoryComment = {
  id: string;
  author: string;
  timestamp: number;
  text: string;
  source: 'youtrack-comment' | 'work-item' | 'daily-note';
};

export type StatusRelatedIssue = {
  issueReadableId: string;
  title: string;
};

export type StatusStory = {
  id: string;
  issueId: string;
  issueReadableId: string;
  issueUrl: string;
  title: string;
  parentIssueId?: string | null;
  parentIssueReadableId?: string | null;
  parentIssueTitle?: string | null;
  childIssueReadableIds?: string[];
  childIssues?: StatusRelatedIssue[];
  startedAt: string;
  updatedAt: string;
  technicalSummary: string;
  comments: StatusStoryComment[];
  dailyNote?: string;
  projectCode?: string;
  stateName?: string;
  assigneeName?: string | null;
};

export type StatusReport = {
  id: string;
  projectId: string;
  title: string;
  dateFrom: string;
  dateTo: string;
  content: string;
  stories: StatusStory[];
  createdAt: string;
  updatedAt: string;
};

export type AppSettings = {
  firebaseConfigured: boolean;
  youtrackBaseUrlDetected: boolean;
  lastConnectionStatus?: 'idle' | 'success' | 'error';
  lastConnectionMessage?: string;
};
