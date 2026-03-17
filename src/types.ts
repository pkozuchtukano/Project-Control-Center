export type Stakeholder = {
  id: string;
  name: string;
  role: string;
  company: 'customer' | 'contractor';
  isPresent: boolean;
};

export type TaskType = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

export type Project = {
  id: string;
  code: string;
  name: string;
  contractNo: string;
  contractSubject?: string;
  dateFrom: string;
  dateTo: string;
  minHours: number;
  maxHours: number;
  rateNetto: number;
  rateBrutto: number;
  vatRate: number;
  targetProfitPct?: number;
  youtrackQuery?: string;
  taskTypes?: TaskType[];
  googleDocLink?: string;
  stakeholders?: Stakeholder[];
};

export type OrderItem = {
  id: string;
  name: string;
  date: string;
  hours: number;
};

export type Order = {
  id: string;
  projectId: string;
  orderNumber: string;
  title: string;
  priority: 'wysoki' | 'normalny' | 'niski';
  problemDescription: string;
  expectedStateDescription: string;
  items: OrderItem[];
  location: string;
  methodologyRequired: boolean;
  methodologyScope: string;
  scheduleFrom: string;
  scheduleTo: string;
  handoverDate?: string;
  acceptanceDate?: string;
  systemModule?: string;
  notes?: string;
  createdAt: string;
};

export type EstimationItem = {
  id: string;
  name: string;
  baseHours: number;
  multiplier: number;
  finalHours: number;
  isOverridden: boolean;
  rate?: number;
};

export type EmailTemplate = {
  to: string;
  cc: string;
  subject: string;
  body: string;
  variables: Record<string, string>;
};

export type Estimation = {
  projectId: string;
  items: EstimationItem[];
  scheduleMode: 'simple' | 'milestones';
  scheduleData: {
    simple: { start: string; end: string };
    milestones: { id: string; name: string; date: string }[];
  };
  emailTemplate?: EmailTemplate;
  lastModified: string;
};

export type MeetingNoteData = {
  projectId: string;
  titleTemplate: string;
  lastMeetingTitle: string;
  stakeholders: Stakeholder[];
  content: string; // Rich text / JSON
  variables?: Record<string, string>;
  emailTemplate?: EmailTemplate;
  lastModified: string;
};

export type Settings = {
  youtrackBaseUrl: string;
  youtrackToken: string;
  googleClientId?: string;
  googleClientSecret?: string;
};

// Daily Feature Types
export type DailyHub = {
  id: string;
  name: string;
  description: string;
  projectCodes: string; // Comma separated list
};

export type DailySection = {
  id: string;
  hubId: string;
  name: string;
  youtrackStatuses: string; // Comma separated list
  orderIndex: number;
  respectDates?: boolean;
};

export type DailyComment = {
  issueId: string;
  content: string;
  lastModified: string;
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
