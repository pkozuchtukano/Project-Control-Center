import axios from 'axios';

type ProxyConfig = {
  baseUrl: string;
  token: string;
};

type HandlerResponse = {
  statusCode: number;
  body: string;
};

const buildHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

const makeRequest = async <T>(url: string, params: Record<string, unknown>, token: string) => {
  const response = await axios.get<T>(url, { headers: buildHeaders(token), params });
  return response.data;
};

const buildQuery = (body: Record<string, unknown>) => {
  const tabName = typeof body.tabName === 'string' ? body.tabName : '';
  const projectName = typeof body.projectName === 'string' ? body.projectName : '';
  const dateFrom = typeof body.dateFrom === 'string' ? body.dateFrom : '';
  const dateTo = typeof body.dateTo === 'string' ? body.dateTo : '';
  const tab = typeof body.tab === 'string' ? body.tab : '';
  const customStatuses = Array.isArray(body.customStatuses) ? body.customStatuses.filter((entry): entry is string => typeof entry === 'string') : [];
  const includeFilters = body.includeFilters === true;
  const isZakonczone = tabName.toLowerCase() === 'zakoñczone';

  if (customStatuses.length > 0) {
    const stateFilter = customStatuses.map((entry) => `{${entry}}`).join(', ');
    if (tab === 'Aktywnoœci') {
      return `project: ${projectName} updated: ${dateFrom} .. ${dateTo} or project: ${projectName} State: ${stateFilter}`;
    }
    let query = `project: ${projectName} State: ${stateFilter}`;
    if (includeFilters || (isZakonczone && body.includeFilters !== false)) {
      query += ` updated: ${dateFrom} .. ${dateTo}`;
    }
    return query;
  }

  if (tab === 'Do zrobienia') {
    return `project: ${projectName} State: {To Do}`;
  }

  return `project: ${projectName} updated: ${dateFrom} .. ${dateTo}`;
};

const parseBody = (rawBody?: string | null) => {
  if (!rawBody) return {} as Record<string, unknown>;
  return JSON.parse(rawBody) as Record<string, unknown>;
};

export const handleYouTrackRequest = async (rawBody: string | undefined, config: ProxyConfig): Promise<HandlerResponse> => {
  try {
    if (!config.baseUrl || !config.token) {
      return { statusCode: 500, body: JSON.stringify({ message: 'Brak konfiguracji YouTrack po stronie serwera.' }) };
    }

    const body = parseBody(rawBody);
    if (body.action === 'healthcheck') {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, baseUrlDetected: Boolean(config.baseUrl), message: 'Konfiguracja YouTrack jest dostêpna.' }),
      };
    }

    const apiBase = `${config.baseUrl.replace(/\/$/, '')}/api`;
    const issueFields = 'id,idReadable,summary,resolved,description,created,updated,reporter(name,login,fullName),assignee(name,login,fullName),project(id,shortName),customFields(name,value(presentation,name,login,email,id,minutes,color(id,background,foreground))),attachments(id,name,url,mimeType,size),links(direction,linkType(name,outwardName,inwardName),issues(id,idReadable,summary))';

    const issues = await makeRequest<Record<string, unknown>[]>(`${apiBase}/issues`, {
      query: buildQuery(body),
      fields: issueFields,
      $top: 100,
      $skip: 0,
    }, config.token);

    const hydrated = await Promise.all(
      issues.map(async (issue) => {
        const issueId = typeof issue.id === 'string' ? issue.id : '';
        const activities = await makeRequest<Record<string, unknown>[]>(`${apiBase}/issues/${issueId}/activities`, {
          categories: 'CommentsCategory,IssueCreatedCategory,ProjectCategory,IssueResolvedCategory,CustomFieldCategory,SummaryCategory,DescriptionCategory,WorkItemCategory,AttachmentCategory,TagsCategory',
          fields: 'id,timestamp,author(name,login,email),category(id),added(name,text,presentation,duration(minutes,presentation),date,type(name),author(name,login,email)),removed(name,text,presentation,duration(minutes,presentation),date,type(name),author(name,login,email)),field(customField(name),name),targetMember,text',
        }, config.token);

        const timeline: Record<string, unknown>[] = [];
        const workAggregator: Record<string, Record<string, unknown>> = {};

        activities.forEach((activity) => {
          const category = activity.category as { id?: string } | undefined;
          const categoryId = category?.id;
          const author = (activity.author as Record<string, unknown> | undefined) || { name: 'System', login: 'system' };
          const added = Array.isArray(activity.added) ? activity.added as Record<string, unknown>[] : [];

          if (categoryId === 'IssueCreatedCategory') {
            timeline.push({ type: 'issue-created', id: activity.id, timestamp: activity.timestamp, author });
          }

          const firstAdded = added[0];
          const firstAddedText = typeof firstAdded?.text === 'string' ? firstAdded.text : '';
          if (categoryId === 'CommentsCategory' && firstAddedText) {
            timeline.push({ type: 'comment', id: activity.id, timestamp: activity.timestamp, author, text: firstAddedText });
          }

          if (categoryId === 'WorkItemCategory') {
            const workItem = firstAdded;
            const duration = workItem?.duration as { minutes?: number } | undefined;
            if (!duration?.minutes) {
              return;
            }
            const actualAuthor = (workItem.author as Record<string, unknown> | undefined) || author;
            const rawDate = typeof workItem.date === 'number' ? workItem.date : undefined;
            const dateStr = rawDate ? new Date(rawDate).toISOString().split('T')[0] : new Date(Number(activity.timestamp) || Date.now()).toISOString().split('T')[0];
            const authorKey = typeof actualAuthor.login === 'string' ? actualAuthor.login : typeof actualAuthor.name === 'string' ? actualAuthor.name : 'system';
            const tempId = `work-${authorKey}-${dateStr}`;
            if (!workAggregator[tempId]) {
              workAggregator[tempId] = {
                type: 'work-item',
                id: tempId,
                timestamp: rawDate ?? Number(activity.timestamp) ?? Date.now(),
                author: actualAuthor,
                minutes: 0,
                dateStr,
                workComments: [],
                workItemType: (workItem.type as { name?: string } | undefined)?.name,
              };
            }
            workAggregator[tempId].minutes = Number(workAggregator[tempId].minutes || 0) + duration.minutes;
            if (typeof workItem.text === 'string' && workItem.text) {
              const comments = workAggregator[tempId].workComments as string[];
              comments.push(workItem.text);
            }
          }

          if (categoryId === 'CustomFieldCategory' || categoryId === 'ProjectCategory' || categoryId === 'IssueResolvedCategory') {
            const field = activity.field as { customField?: { name?: string }; name?: string } | undefined;
            const fieldName = field?.customField?.name || field?.name || 'Pole';
            const normalizeValue = (value: unknown) => {
              if (Array.isArray(value) && value.length > 0) {
                const first = value[0] as Record<string, unknown>;
                return String(first?.presentation || first?.name || first?.text || JSON.stringify(first));
              }
              if (value && typeof value === 'object') {
                const cast = value as Record<string, unknown>;
                return String(cast.presentation || cast.name || cast.text || JSON.stringify(cast));
              }
              return value ? String(value) : 'Brak';
            };
            if (fieldName.toLowerCase() === 'spent time') {
              return;
            }
            timeline.push({
              type: 'field-change',
              id: activity.id,
              timestamp: activity.timestamp,
              author,
              field: fieldName,
              added: normalizeValue(activity.added),
              removed: normalizeValue(activity.removed),
            });
          }
        });

        Object.values(workAggregator).forEach((entry) => timeline.push(entry));
        timeline.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

        let dueDate: number | null = null;
        let estimation: { presentation: string; minutes: number } | null = null;
        let spentTime: { presentation: string; minutes: number } | null = null;
        let state: { name: string; color: { background: string; foreground: string } } | null = null;
        let type: { name: string; color: { background: string; foreground: string } } | null = null;
        let assignee = (issue.assignee as Record<string, unknown> | null) || null;
        let priority: { name: string; color: { background: string; foreground: string } } | null = null;

        const customFields = Array.isArray(issue.customFields) ? issue.customFields as Array<{ name?: string; value?: unknown }> : [];
        customFields.forEach((field) => {
          const name = String(field?.name || '').toLowerCase();
          const value = field.value as Record<string, unknown> | number | null | undefined;
          if (name === 'due date' && value) {
            dueDate = typeof value === 'number' ? value : new Date(String((value as Record<string, unknown>).presentation || value)).getTime();
          }
          if (name.includes('estimation') && value) {
            const objectValue = value as Record<string, unknown>;
            estimation = { presentation: String(objectValue.presentation || objectValue.minutes || value), minutes: Number(objectValue.minutes || value) || 0 };
          }
          if (name === 'spent time' && value) {
            const objectValue = value as Record<string, unknown>;
            spentTime = { presentation: String(objectValue.presentation || objectValue.minutes || value), minutes: Number(objectValue.minutes || value) || 0 };
          }
          if ((name === 'state' || name === 'status') && value) {
            const objectValue = value as Record<string, unknown>;
            state = { name: String(objectValue.name || objectValue.presentation || value), color: (objectValue.color as { background: string; foreground: string } | undefined) || { background: '#e5e7eb', foreground: '#111827' } };
          }
          if ((name === 'type' || name === 'typ') && value) {
            const objectValue = value as Record<string, unknown>;
            type = { name: String(objectValue.name || objectValue.presentation || value), color: (objectValue.color as { background: string; foreground: string } | undefined) || { background: '#e5e7eb', foreground: '#111827' } };
          }
          if (name === 'assignee' && value) {
            const resolvedUser = Array.isArray(value) ? value[0] : value;
            const userRecord = resolvedUser as Record<string, unknown> | undefined;
            assignee = userRecord ? { name: userRecord.name || userRecord.login, login: userRecord.login, fullName: userRecord.fullName } : assignee;
          }
          if (name === 'priority' && value) {
            const objectValue = value as Record<string, unknown>;
            priority = { name: String(objectValue.name || objectValue.presentation || value), color: (objectValue.color as { background: string; foreground: string } | undefined) || { background: '#e5e7eb', foreground: '#111827' } };
          }
        });

        return { ...issue, dueDate, estimation, spentTime, state, type, assignee, priority, timeline };
      })
    );

    return { statusCode: 200, body: JSON.stringify(hydrated) };
  } catch (error) {
    const message = axios.isAxiosError(error) ? error.message : error instanceof Error ? error.message : 'Nieznany b³¹d';
    return { statusCode: 500, body: JSON.stringify({ message }) };
  }
};
