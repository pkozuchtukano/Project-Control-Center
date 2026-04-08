import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, firestore, firebaseConfigured } from '@/lib/firebase';
import { readLocalJson, writeLocalJson } from '@/lib/storage';
import { defaultSeed } from '@/seed/defaultSeed';
import type {
  AppSettings,
  DailyComment,
  DailyHub,
  DailyIssueState,
  DailySection,
  Project,
  ProjectLink,
  StatusReport,
} from '@/types/domain';

const localKeys = {
  projects: 'pcc-web-projects',
  links: 'pcc-web-project-links',
  hubs: 'pcc-web-daily-hubs',
  sections: 'pcc-web-daily-sections',
  comments: 'pcc-web-daily-comments',
  states: 'pcc-web-daily-issue-states',
  reports: 'pcc-web-status-reports',
  settings: 'pcc-web-settings',
};

const ensureLocalSeed = () => {
  if (!readLocalJson<Project[] | null>(localKeys.projects, null)) writeLocalJson(localKeys.projects, defaultSeed.projects);
  if (!readLocalJson<DailyHub[] | null>(localKeys.hubs, null)) writeLocalJson(localKeys.hubs, defaultSeed.dailyHubs);
  if (!readLocalJson<DailySection[] | null>(localKeys.sections, null)) writeLocalJson(localKeys.sections, defaultSeed.dailySections);
};

const getOwnerUid = () => auth?.currentUser?.uid || null;

const isFirestorePermissionError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === 'permission-denied' || candidate.message?.toLowerCase().includes('insufficient permissions') === true;
};

const logFirestoreFallback = (operation: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[pccRepository] Firestore fallback for ${operation}: ${message}`);
};

const sortByField = <T>(items: T[], sortField?: string) => {
  if (!sortField) return items;
  return [...items].sort((left, right) => {
    const leftValue = (left as Record<string, unknown>)[sortField];
    const rightValue = (right as Record<string, unknown>)[sortField];
    if (typeof leftValue === 'string' && typeof rightValue === 'string') {
      return leftValue.localeCompare(rightValue, 'pl');
    }
    return String(leftValue ?? '').localeCompare(String(rightValue ?? ''), 'pl');
  });
};

const listCollection = async <T>(name: string, sortField?: string) => {
  const ownerUid = getOwnerUid();
  if (!firebaseConfigured || !firestore || !ownerUid) return [] as T[];
  try {
    const base = collection(firestore, name);
    const snapshot = await getDocs(query(base, where('ownerUid', '==', ownerUid)));
    return sortByField(snapshot.docs.map((entry) => entry.data() as T), sortField);
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      logFirestoreFallback(`read:${name}`, error);
      return [] as T[];
    }
    throw error;
  }
};

const upsert = async <T extends { id: string }>(name: string, item: T) => {
  const ownerUid = getOwnerUid();
  if (!firebaseConfigured || !firestore || !ownerUid) return false;
  try {
    await setDoc(doc(firestore, name, item.id), { ...item, ownerUid }, { merge: true });
    return true;
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      logFirestoreFallback(`write:${name}`, error);
      return false;
    }
    throw error;
  }
};

const remove = async (name: string, id: string) => {
  if (!firebaseConfigured || !firestore || !getOwnerUid()) return false;
  try {
    await deleteDoc(doc(firestore, name, id));
    return true;
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      logFirestoreFallback(`delete:${name}`, error);
      return false;
    }
    throw error;
  }
};

export const pccRepository = {
  async getProjects() {
    ensureLocalSeed();
    const remote = await listCollection<Project>('projects', 'code');
    return remote.length > 0 ? remote : readLocalJson<Project[]>(localKeys.projects, defaultSeed.projects);
  },

  async saveProject(project: Project) {
    await upsert('projects', project);
    const current = await this.getProjects();
    writeLocalJson(localKeys.projects, [...current.filter((item) => item.id !== project.id), project].sort((a, b) => a.code.localeCompare(b.code, 'pl')));
  },

  async getDailyHubs() {
    ensureLocalSeed();
    const remote = await listCollection<DailyHub>('dailyHubs', 'name');
    return remote.length > 0 ? remote : readLocalJson<DailyHub[]>(localKeys.hubs, defaultSeed.dailyHubs);
  },

  async saveDailyHub(hub: DailyHub) {
    await upsert('dailyHubs', hub);
    const current = await this.getDailyHubs();
    writeLocalJson(localKeys.hubs, [...current.filter((item) => item.id !== hub.id), hub].sort((a, b) => a.name.localeCompare(b.name, 'pl')));
  },

  async deleteDailyHub(id: string) {
    await remove('dailyHubs', id);
    const hubs = readLocalJson<DailyHub[]>(localKeys.hubs, []).filter((item) => item.id !== id);
    const sections = readLocalJson<DailySection[]>(localKeys.sections, []).filter((item) => item.hubId !== id);
    writeLocalJson(localKeys.hubs, hubs);
    writeLocalJson(localKeys.sections, sections);
  },

  async getDailySections(hubId: string) {
    ensureLocalSeed();
    const remote = await listCollection<DailySection>('dailySections');
    const base = remote.length > 0 ? remote : readLocalJson<DailySection[]>(localKeys.sections, defaultSeed.dailySections);
    return base.filter((item) => item.hubId === hubId).sort((a, b) => a.orderIndex - b.orderIndex);
  },

  async saveDailySection(section: DailySection) {
    await upsert('dailySections', section);
    const current = readLocalJson<DailySection[]>(localKeys.sections, defaultSeed.dailySections);
    writeLocalJson(localKeys.sections, [...current.filter((item) => item.id !== section.id), section]);
  },

  async deleteDailySection(id: string) {
    await remove('dailySections', id);
    writeLocalJson(localKeys.sections, readLocalJson<DailySection[]>(localKeys.sections, defaultSeed.dailySections).filter((item) => item.id !== id));
  },

  async getDailyComments() {
    const remote = await listCollection<Array<DailyComment & { id: string }>[number]>('dailyComments');
    const base = remote.length > 0 ? remote : readLocalJson<Array<DailyComment & { id?: string }>>(localKeys.comments, []);
    return base.reduce<Record<string, string>>((acc, item) => {
      acc[item.issueId] = item.content;
      return acc;
    }, {});
  },

  async saveDailyComment(comment: DailyComment) {
    await upsert('dailyComments', { ...comment, id: comment.issueId });
    const current = readLocalJson<Array<DailyComment & { id?: string }>>(localKeys.comments, []);
    writeLocalJson(localKeys.comments, [...current.filter((item) => item.issueId !== comment.issueId), comment]);
  },

  async getDailyIssueStates() {
    const remote = await listCollection<Array<DailyIssueState & { id: string }>[number]>('dailyIssueStates');
    const base = remote.length > 0 ? remote : readLocalJson<Array<DailyIssueState & { id?: string }>>(localKeys.states, []);
    return base.reduce<Record<string, boolean>>((acc, item) => {
      acc[item.issueId] = item.isCollapsed;
      return acc;
    }, {});
  },

  async saveDailyIssueState(state: DailyIssueState) {
    await upsert('dailyIssueStates', { ...state, id: state.issueId });
    const current = readLocalJson<Array<DailyIssueState & { id?: string }>>(localKeys.states, []);
    writeLocalJson(localKeys.states, [...current.filter((item) => item.issueId !== state.issueId), state]);
  },

  async getStatusReports(projectId: string) {
    const remote = await listCollection<StatusReport>('statusReports');
    const base = remote.length > 0 ? remote : readLocalJson<StatusReport[]>(localKeys.reports, []);
    return base.filter((item) => item.projectId === projectId).sort((a, b) => b.dateTo.localeCompare(a.dateTo) || b.updatedAt.localeCompare(a.updatedAt));
  },

  async saveStatusReport(report: StatusReport) {
    await upsert('statusReports', report);
    const current = readLocalJson<StatusReport[]>(localKeys.reports, []);
    writeLocalJson(localKeys.reports, [...current.filter((item) => item.id !== report.id), report]);
  },

  async deleteStatusReport(id: string) {
    await remove('statusReports', id);
    writeLocalJson(localKeys.reports, readLocalJson<StatusReport[]>(localKeys.reports, []).filter((item) => item.id !== id));
  },

  async getProjectLinks(projectId: string) {
    const remote = await listCollection<ProjectLink>('projectLinks');
    const base = remote.length > 0 ? remote : readLocalJson<ProjectLink[]>(localKeys.links, []);
    return base.filter((item) => item.projectId === projectId).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  },

  async saveProjectLink(link: ProjectLink) {
    await upsert('projectLinks', link);
    const current = readLocalJson<ProjectLink[]>(localKeys.links, []);
    writeLocalJson(localKeys.links, [...current.filter((item) => item.id !== link.id), link]);
  },

  async deleteProjectLink(id: string) {
    await remove('projectLinks', id);
    writeLocalJson(localKeys.links, readLocalJson<ProjectLink[]>(localKeys.links, []).filter((item) => item.id !== id));
  },

  async getSettings() {
    return readLocalJson<AppSettings>(localKeys.settings, {
      firebaseConfigured,
      youtrackBaseUrlDetected: false,
      lastConnectionStatus: 'idle',
    });
  },

  async saveSettings(settings: AppSettings) {
    writeLocalJson(localKeys.settings, settings);
  },
};
