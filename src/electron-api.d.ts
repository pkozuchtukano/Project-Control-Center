import type {
  DailyAiAnalysis,
  DailyComment,
  DailyHub,
  DailySection,
  GeminiGenerateRequest,
  GeminiGenerateResponse,
  MaintenanceEntry,
  MaintenanceInvoiceEmailTemplateData,
  MaintenanceSettlementEmailTemplateData,
  Order,
  OrderAcceptanceEmailTemplateData,
  OrderInvoiceEmailTemplateData,
  OrderProtocolEmailTemplateData,
  PendingSettlementEntry,
  Project,
  ProjectLink,
  ScheduledTask,
  ServiceEvent,
  ServiceObligation,
  ServiceTask,
  Settings,
  StatusReport,
} from './types';

declare global {
  interface Window {
    electron?: {
      readDb: () => Promise<{ projects: Project[], orders: Order[], settings?: Settings }>;
      writeDb: (data: { projects: Project[], orders: Order[] }) => Promise<{ success: boolean }>;
      fetchYouTrack: (options: any) => Promise<any>;
      getExcludedIssues: () => Promise<string[]>;
      setIssueExcluded: (id: string, excluded: boolean) => Promise<{ success: boolean }>;
      getYoutrackTabs: (projectId: string) => Promise<{ id: string; projectId: string; name: string; statuses: string[]; includeFilters?: boolean; orderIndex?: number }[]>;
      saveYoutrackTab: (tab: { id: string; projectId: string; name: string; statuses: string[]; includeFilters?: boolean; orderIndex?: number }) => Promise<{ success: boolean }>;
      deleteYoutrackTab: (id: string) => Promise<{ success: boolean }>;
      reorderYoutrackTabs: (tabs: { id: string; orderIndex: number }[]) => Promise<{ success: boolean }>;
      getIssueTaskTypes: (issueIds: string[]) => Promise<Record<string, string>>;
      setIssueTaskType: (issueId: string, taskTypeId: string) => Promise<{ success: boolean }>;
      getWorkItems: (projectId: string) => Promise<any[]>;
      getWorkRegistrySyncMeta: (projectId: string) => Promise<{ projectId: string; lastSyncDate: string; updatedAt: string } | null>;
      saveWorkRegistrySyncMeta: (data: { projectId: string; lastSyncDate: string }) => Promise<{ success: boolean }>;
      upsertWorkItems: (data: { items: any[], projectId: string }) => Promise<{ success: boolean }>;
      replaceWorkItemsForPeriod: (data: { items: any[], projectId: string, dateFrom: string, dateTo: string }) => Promise<{ success: boolean }>;
      getOrderItemTemplate: (projectId: string) => Promise<{ names?: string[]; items?: Array<{ name: string; roleId?: string; roleName?: string }>; lastDate?: string } | null>;
      saveOrderItemTemplate: (data: { projectId: string, data: { names: string[]; items: Array<{ name: string; roleId?: string; roleName?: string }>; lastDate: string } }) => Promise<{ success: boolean }>;
      getIssueCategories: () => Promise<Record<string, string>>;
      setIssueCategory: (data: { issueId: string, category: string }) => Promise<{ success: boolean }>;
      getIssueMaintenanceFlags: () => Promise<Record<string, boolean>>;
      setIssueMaintenanceFlag: (data: { issueId: string, isMaintenance: boolean }) => Promise<{ success: boolean }>;
      importOrders: (data: { orders: any[], projectId: string }) => Promise<{ success: boolean }>;
      getEstimation: (projectId: string) => Promise<any>;
      saveEstimation: (data: { projectId: string, data: any }) => Promise<{ success: boolean }>;
      getMeetingNotes: (projectId: string) => Promise<any>;
      saveMeetingNotes: (data: { projectId: string, data: any }) => Promise<{ success: boolean }>;
      getOrderProtocolEmailTemplate: (projectId: string) => Promise<OrderProtocolEmailTemplateData | null>;
      saveOrderProtocolEmailTemplate: (data: { projectId: string, data: OrderProtocolEmailTemplateData }) => Promise<{ success: boolean }>;
      getOrderAcceptanceEmailTemplate: (projectId: string) => Promise<OrderAcceptanceEmailTemplateData | null>;
      saveOrderAcceptanceEmailTemplate: (data: { projectId: string, data: OrderAcceptanceEmailTemplateData }) => Promise<{ success: boolean }>;
      getOrderInvoiceEmailTemplate: (projectId: string) => Promise<OrderInvoiceEmailTemplateData | null>;
      saveOrderInvoiceEmailTemplate: (data: { projectId: string, data: OrderInvoiceEmailTemplateData }) => Promise<{ success: boolean }>;
      getMaintenanceSettlementEmailTemplate: (projectId: string) => Promise<MaintenanceSettlementEmailTemplateData | null>;
      saveMaintenanceSettlementEmailTemplate: (data: { projectId: string, data: MaintenanceSettlementEmailTemplateData }) => Promise<{ success: boolean }>;
      getMaintenanceInvoiceEmailTemplate: (projectId: string) => Promise<MaintenanceInvoiceEmailTemplateData | null>;
      saveMaintenanceInvoiceEmailTemplate: (data: { projectId: string, data: MaintenanceInvoiceEmailTemplateData }) => Promise<{ success: boolean }>;
      getScheduledTasks: () => Promise<ScheduledTask[]>;
      saveScheduledTask: (data: ScheduledTask) => Promise<{ success: boolean }>;
      deleteScheduledTask: (id: string) => Promise<{ success: boolean }>;
      runScheduledTaskNow: (id: string) => Promise<{ success: boolean; task: ScheduledTask }>;
      getProjectLinks: (projectId: string) => Promise<ProjectLink[]>;
      saveProjectLink: (data: ProjectLink) => Promise<{ success: boolean }>;
      deleteProjectLink: (id: string) => Promise<{ success: boolean }>;
      getStatusReports: (projectId: string) => Promise<StatusReport[]>;
      saveStatusReport: (data: { projectId: string, data: StatusReport }) => Promise<{ success: boolean }>;
      deleteStatusReport: (id: string) => Promise<{ success: boolean }>;
      getMaintenanceEntries: (projectId: string) => Promise<MaintenanceEntry[]>;
      saveMaintenanceEntry: (data: MaintenanceEntry) => Promise<{ success: boolean }>;
      deleteMaintenanceEntry: (id: string) => Promise<{ success: boolean }>;
      getPendingSettlementEntries: (projectId: string) => Promise<PendingSettlementEntry[]>;
      savePendingSettlementEntry: (data: PendingSettlementEntry) => Promise<{ success: boolean }>;
      deletePendingSettlementEntry: (id: string) => Promise<{ success: boolean }>;
      getServiceOverview: (projectId: string) => Promise<{ obligations: ServiceObligation[]; tasks: ServiceTask[]; events: ServiceEvent[] }>;
      saveServiceObligation: (data: ServiceObligation) => Promise<{ success: boolean }>;
      deleteServiceObligation: (id: string) => Promise<{ success: boolean }>;
      saveServiceEvent: (data: ServiceEvent) => Promise<{ success: boolean }>;
      deleteServiceEvent: (id: string) => Promise<{ success: boolean }>;
      completeServiceTask: (id: string) => Promise<{ success: boolean }>;
      reopenServiceTask: (id: string) => Promise<{ success: boolean }>;
      exportServiceObligationTemplate: (data: { baseDate: string; endDate: string }) => Promise<{ success: boolean; canceled?: boolean; filePath?: string }>;
      readServiceObligationTemplate: () => Promise<{ canceled?: boolean; fileName?: string; obligations: Array<Partial<ServiceObligation>> }>;
      importServiceObligations: (data: { projectId: string; replaceExisting: boolean; obligations: Array<Partial<ServiceObligation>> }) => Promise<{ success: boolean; importedCount: number }>;
      onServiceAlerts: (callback: (payload: Array<{ taskId: string; projectId: string; projectCode?: string; projectName?: string; obligationCode?: string; title: string; dueDate: string; status: 'pending' | 'overdue' }>) => void) => void;
      offServiceAlerts: (callback: (payload: Array<{ taskId: string; projectId: string; projectCode?: string; projectName?: string; obligationCode?: string; title: string; dueDate: string; status: 'pending' | 'overdue' }>) => void) => void;
      writeClipboardHtml: (data: { html: string; text?: string; imageDataUrl?: string }) => Promise<{ success: boolean }>;
      askGemini: (data: GeminiGenerateRequest) => Promise<GeminiGenerateResponse>;
      exportDailyAiToClickUp: (data: { docUrl: string; title: string; content: string }) => Promise<{ success: boolean; mode: 'append' | 'create_page'; pageId?: string; docId: string; workspaceId: string; verified?: boolean }>;
      appendGoogleDoc: (data: { docLink: string, content: string, title: string, participants: string[] }) => Promise<{ success: boolean }>;
      getGoogleAuthStatus: () => Promise<{ isAuthenticated: boolean, hasCredentials: boolean }>;
      getGoogleAuthUrl: () => Promise<string>;
      authorizeGoogle: (code: string) => Promise<any>;
      logoutGoogle: () => Promise<void>;
      openExternal: (url: string) => Promise<{ success: boolean }>;
      exportDatabase: () => Promise<{ success: boolean; canceled?: boolean; fileName?: string; modifiedTime?: string | null }>;
      importDatabase: () => Promise<{ success: boolean; canceled?: boolean; fileName?: string; modifiedTime?: string | null }>;
      exportPdf: (options?: { defaultFileName?: string; password?: string }) => Promise<{ success: boolean; canceled?: boolean; filePath?: string }>;
      
      // Daily Handlers
      getDailyHubs: () => Promise<DailyHub[]>;
      saveDailyHub: (hub: DailyHub) => Promise<{ success: boolean }>;
      deleteDailyHub: (id: string) => Promise<{ success: boolean }>;
      getDailySections: (hubId: string) => Promise<DailySection[]>;
      saveDailySection: (section: DailySection) => Promise<{ success: boolean }>;
      deleteDailySection: (id: string) => Promise<{ success: boolean }>;
      reorderDailySections: (sections: { id: string, orderIndex: number }[]) => Promise<{ success: boolean }>;
      getDailyComments: () => Promise<DailyComment[]>;
      saveDailyComment: (data: { issueId: string, content: string }) => Promise<{ success: boolean }>;
      getDailyIssueStates: () => Promise<Record<string, boolean>>;
      saveDailyIssueState: (data: { issueId: string, isCollapsed: boolean }) => Promise<{ success: boolean }>;
      getDailyAiSkippedIssueStates: () => Promise<Record<string, boolean>>;
      saveDailyAiSkippedIssueState: (data: { issueId: string, skipInAi: boolean }) => Promise<{ success: boolean }>;
      getDailyAiAnalyses: (hubId: string) => Promise<DailyAiAnalysis[]>;
      saveDailyAiAnalysis: (data: DailyAiAnalysis) => Promise<{ success: boolean }>;
      deleteDailyAiAnalysis: (id: string) => Promise<{ success: boolean }>;
    }
  }
}

export {};
