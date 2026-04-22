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
  hasMaintenance: boolean;
  maintenanceNetAmount: number;
  maintenanceVatRate: number;
  maintenanceGrossAmount: number;
  targetProfitPct?: number;
  youtrackQuery?: string;
  taskTypes?: TaskType[];
  googleDocLink?: string;
  pendingSettlementYoutrackUrl?: string;
  orderProtocolFlow?: OrderProtocolFlow;
  stakeholders?: Stakeholder[];
};

export type ProjectLink = {
  id: string;
  projectId: string;
  name: string;
  url: string;
  visibleInTabs?: string[];
  createdAt: string;
  updatedAt: string;
};

export type ServiceObligationKind = 'continuous' | 'recurring' | 'event';

export type ServiceScheduleType =
  | 'none'
  | 'fixed_date'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'
  | 'relative';

export type ServiceRelativeUnit = 'hours' | 'business_days' | 'calendar_days' | 'months';

export type ServiceTaskStatus = 'pending' | 'completed' | 'overdue' | 'canceled';

export type ServiceEventType =
  | 'incident'
  | 'security_patch'
  | 'audit'
  | 'consultation'
  | 'backup'
  | 'update'
  | 'migration'
  | 'other';

export type ServiceObligation = {
  id: string;
  projectId: string;
  code: string;
  title: string;
  description: string;
  kind: ServiceObligationKind;
  scheduleType: ServiceScheduleType;
  intervalValue?: number;
  relativeValue?: number;
  relativeUnit?: ServiceRelativeUnit;
  fixedDate?: string;
  anchorDate?: string;
  triggerLabel?: string;
  owner?: string;
  evidenceHint?: string;
  notes?: string;
  sourceRequirement?: string;
  requiresProtocol: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ServiceTask = {
  id: string;
  projectId: string;
  obligationId: string;
  title: string;
  description?: string;
  dueDate: string;
  status: ServiceTaskStatus;
  completedAt?: string;
  sourceType: 'schedule' | 'event';
  sourceEventId?: string;
  notes?: string;
  notifiedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceEvent = {
  id: string;
  projectId: string;
  obligationId?: string;
  eventType: ServiceEventType;
  title: string;
  occurredAt: string;
  dueDate?: string;
  reference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderItem = {
  id: string;
  name: string;
  date: string;
  hours: number;
};

export type OrderProtocolStep = {
  id: string;
  description: string;
  linkUrl?: string;
  linkLabel?: string;
};

export type OrderProtocolFlow = {
  steps: OrderProtocolStep[];
  completedStepIds?: string[];
  updatedAt?: string;
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
  ppFlow?: OrderProtocolFlow;
  poFlow?: OrderProtocolFlow;
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

export type GlobalScheduleType = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';

export type ScheduledTaskSchedule = {
  type: GlobalScheduleType;
  time: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  dateTime?: string;
};

export type ScheduledTaskAiSettings = {
  model?: string;
  temperature?: number | null;
  topP?: number | null;
  topK?: number | null;
  maxOutputTokens?: number | null;
  generationConfigText?: string;
  additionalRequestFieldsText?: string;
};

export type ScheduledTask = {
  id: string;
  name: string;
  isActive: boolean;
  actionType: 'email' | 'daily_ai';
  schedule: ScheduledTaskSchedule;
  emailTemplate: EmailTemplate;
  aiSystemInstruction?: string;
  aiSettings?: ScheduledTaskAiSettings;
  contentSources?: ScheduledTaskContentSource[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'error';
  lastRunError?: string;
};

export type ScheduledTaskDailyContentSource = {
  id: string;
  type: 'daily';
  hubId: string;
  sectionIds: string[];
};

export type ScheduledTaskContentSource = ScheduledTaskDailyContentSource;

export type OrderProtocolEmailTemplateData = {
  projectId: string;
  emailTemplate: EmailTemplate;
  lastModified: string;
};

export type OrderAcceptanceEmailTemplateData = {
  projectId: string;
  emailTemplate: EmailTemplate;
  lastModified: string;
};

export type MaintenanceSettlementEmailTemplateData = {
  projectId: string;
  emailTemplate: EmailTemplate;
  lastModified: string;
};

export type Estimation = {
  projectId: string;
  items: EstimationItem[];
  expectedHours?: number | null;
  scheduleMode: 'simple' | 'milestones';
  scheduleData: {
    simple: { start: string; end: string };
    milestones: { id: string; name: string; date: string }[];
  };
  emailTemplate?: EmailTemplate;
  flow?: OrderProtocolFlow;
  lastModified: string;
};

export type MeetingNoteData = {
  projectId: string;
  titleTemplate: string;
  lastMeetingTitle: string;
  stakeholders: Stakeholder[];
  content: string; // Rich text / JSON
  flow?: OrderProtocolFlow;
  variables?: Record<string, string>;
  emailTemplate?: EmailTemplate;
  lastModified: string;
};

export type Settings = {
  youtrackBaseUrl: string;
  youtrackToken: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleDriveSharedFolderLink?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  geminiApiBaseUrl?: string;
};

export type GeminiGenerateRequest = {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  generationConfig?: Record<string, unknown>;
  additionalRequestFields?: Record<string, unknown>;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
};

export type GeminiGenerateResponse = {
  text: string;
  model: string;
  usageMetadata?: Record<string, unknown>;
  finishReason?: string;
  responseId?: string;
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

export type DailyAiAnalysis = {
  id: string;
  hubId: string;
  projectCodes: string[];
  dateFrom: string;
  dateTo: string;
  originalContent: string;
  currentContent: string;
  issueTitles?: Record<string, string>;
  createdAt: string;
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

export type MaintenanceEntry = {
  id: string;
  projectId: string;
  month: string;
  netAmount: number;
  vatRate: number;
  grossAmount: number;
  notes?: string;
  settlementFlow?: OrderProtocolFlow;
  createdAt: string;
  updatedAt: string;
};

export type PendingSettlementEntry = {
  id: string;
  projectId: string;
  externalId: string;
  requester: string;
  requestDate: string;
  requestChannel: string;
  module: string;
  title: string;
  youtrackIssueUrl?: string;
  details: string;
  priority: 'wysoki' | 'normalny' | 'niski';
  teamEstimatedHours: number;
  marginPercent: number;
  estimatedHours: number;
  isEstimated: boolean;
  estimationDate?: string;
  isAccepted: boolean;
  acceptanceDate?: string;
  acceptedBy?: string;
  acceptanceChannel?: string;
  preAcceptanceWorkHours: number;
  preAcceptanceWorkDescription: string;
  isInProgress: boolean;
  isCompleted: boolean;
  isSentToSettlement: boolean;
  isSettled: boolean;
  evidenceImageDataUrl?: string;
  evidenceImageName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
