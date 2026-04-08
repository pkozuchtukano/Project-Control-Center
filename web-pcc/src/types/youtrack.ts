export interface YouTrackUser {
  name: string;
  login: string;
  fullName?: string;
}

export interface YouTrackColor {
  background: string;
  foreground: string;
}

export interface YouTrackAttachment {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface YouTrackIssueLink {
  direction?: string;
  linkType?: {
    name?: string;
    outwardName?: string;
    inwardName?: string;
  };
  issues?: {
    id: string;
    idReadable: string;
    summary?: string;
  }[];
}

export interface ActivityItem {
  type: 'issue-created' | 'comment' | 'field-change' | 'description-change' | 'work-item';
  id: string;
  timestamp: number;
  author: YouTrackUser;
  field?: string;
  added?: string | unknown[];
  removed?: string | unknown[];
  text?: string;
  minutes?: number;
  dateStr?: string;
  workComments?: string[];
  workItemType?: string;
}

export interface IssueWithHistory {
  id: string;
  idReadable: string;
  summary: string;
  description?: string;
  resolved?: number | null;
  updated?: number;
  created?: number;
  dueDate?: number | null;
  reporter?: YouTrackUser;
  assignee?: YouTrackUser | null;
  project?: {
    id: string;
    shortName: string;
  };
  estimation?: {
    presentation: string;
    minutes: number;
  } | null;
  spentTime?: {
    presentation: string;
    minutes: number;
  } | null;
  state?: {
    name: string;
    color: YouTrackColor;
  } | null;
  type?: {
    name: string;
    color: YouTrackColor;
  } | null;
  priority?: {
    name: string;
    color: YouTrackColor;
  } | null;
  attachments?: YouTrackAttachment[];
  links?: YouTrackIssueLink[];
  timeline: ActivityItem[];
  rawCustomFields?: unknown[];
}
