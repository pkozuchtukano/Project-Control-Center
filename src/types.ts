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
};

export type DailyComment = {
  issueId: string;
  content: string;
  lastModified: string;
};
