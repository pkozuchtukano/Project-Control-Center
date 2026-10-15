const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

function loadStatus(request = async () => []) {
  const cache = new Map();
  const load = filename => {
    const absolute = path.resolve(__dirname, '..', filename);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} };
    cache.set(absolute, module);
    const compiled = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    vm.runInNewContext(compiled, {
      module, exports: module.exports, crypto, console, Date, Set, Map,
      window: { electron: { fetchYouTrack: request } },
      require: name => name.startsWith('.')
        ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(absolute), `${name}.ts`)))
        : require(name)
    });
    return module.exports;
  };
  return {
    utils: load('src/features/status/utils/statusUtils.ts'),
    agenda: load('src/features/status/utils/agendaUtils.ts'),
    api: load('src/services/youtrackApi.ts')
  };
}
const stamp = value => new Date(value).getTime();
const author = { name: 'Anna', login: 'anna' };
const issue = (id, timeline = [], parent) => ({
  id, idReadable: `PCC-${id}`, summary: `Task ${id}`, description: 'Description',
  created: stamp('2026-09-01T10:00:00'), updated: stamp('2026-10-15T10:00:00'),
  state: { name: 'In Progress' }, assignee: author,
  links: parent ? [{ direction: 'INWARD', linkType: { name: 'Subtask' }, issues: [{ id: parent, idReadable: `PCC-${parent}`, summary: `Task ${parent}` }] }] : [],
  timeline
});
const change = (id, date, type = 'field-change') => ({ id, timestamp: stamp(date), type, author, field: 'State', removed: 'To Do', added: 'In Progress', text: 'A comment' });
const ids = items => Array.from(items, item => item.id);

test('sources require actual activity; Daily alone is context and end-of-day milliseconds count', () => {
  const { utils } = loadStatus();
  const result = utils.buildStatusStories([
    issue('1'), issue('2', [change('event', '2026-10-10T23:59:59.999', 'comment')]),
    issue('3', [change('outside', '2026-10-11T00:00:00')]),
    issue('4', [change('description', '2026-10-08T10:00:00', 'description-change')])
  ], { 'PCC-1': 'Old Daily note' }, 'https://yt.example', '2026-10-08', '2026-10-10');
  assert.deepEqual(ids(result).sort(), ['2', '4']);
  assert.equal(result.find(story => story.id === '2').activityCount, 1);
  assert.equal(result.find(story => story.id === '4').comments[0].source, 'description-change');
});

test('inactive parents remain context, deep subtasks survive and unrelated inactive tasks are excluded', () => {
  const { utils, agenda } = loadStatus();
  const result = utils.buildStatusStories([
    issue('1'), issue('2', [], '1'), issue('3', [change('event', '2026-10-09T10:00:00')], '2'), issue('4')
  ], {}, 'https://yt.example', '2026-10-08', '2026-10-10');
  assert.deepEqual(ids(result), ['1', '2', '3']);
  assert.equal(result[0].isContextOnly, true);
  assert.equal(result[2].isContextOnly, false);
  const missingParent = agenda.buildSourceTree(result.slice(2));
  assert.equal(missingParent.length, 2);
  assert.equal(missingParent[1].issueReadableId, 'PCC-2');
});

test('all source text and field changes remain available, with dated authors and one Daily note', () => {
  const { utils } = loadStatus();
  const input = issue('1', Array.from({ length: 6 }, (_, index) => change(String(index), '2026-10-09T10:00:00')));
  input.description = 'Long description. '.repeat(100);
  const [story] = utils.buildStatusStories([input], { 'PCC-1': 'Unique Daily context' }, 'https://yt.example', '2026-10-08', '2026-10-10');
  assert.equal(story.activityCount, 6);
  assert.equal(story.description, input.description.trim());
  const html = utils.buildStatusStoryHtml(story);
  assert.equal(html.split('Unique Daily context').length - 1, 1);
  assert.ok(html.includes('Anna'));
  assert.ok(html.includes('2026'));
});

test('source statuses add inactive tasks while every type of period activity bypasses unchecked statuses', () => {
  const { utils, agenda } = loadStatus();
  const withState = (id, state, events = []) => ({ ...issue(id, events), state: { name: state } });
  const all = utils.buildStatusStories([
    withState('comment', 'Closed', [change('comment', '2026-10-09T10:00:00', 'comment')]),
    withState('field', 'Closed', [change('field', '2026-10-09T10:00:00')]),
    withState('description', 'Closed', [change('description', '2026-10-09T10:00:00', 'description-change')]),
    withState('work', 'Closed', [change('work', '2026-10-09T10:00:00', 'work-item')]),
    withState('created', 'Closed', [change('created', '2026-10-09T10:00:00', 'issue-created')]),
    withState('inactive-open', 'Open'), withState('inactive-closed', 'Closed'),
    withState('outside-period', 'Closed', [change('outside', '2026-10-11T10:00:00', 'comment')]),
    withState('daily-only', 'Closed'),
    { ...withState('external', 'Open'), statusScopeMember: false }
  ], { 'PCC-daily-only': 'Undated Daily context' }, 'https://yt.example', '2026-10-08', '2026-10-10', true);
  const activeIds = ['comment', 'created', 'description', 'field', 'work'];
  assert.deepEqual(ids(agenda.filterStatusSources(all, '', [])).sort(), activeIds);
  assert.deepEqual(ids(agenda.filterStatusSources(all, '', ['Open'])).sort(), [...activeIds, 'inactive-open'].sort());
  const closed = ids(agenda.filterStatusSources(all, '', ['Closed']));
  assert.ok(closed.includes('inactive-closed'));
  assert.ok(!closed.includes('inactive-open'));
  assert.ok(!ids(agenda.filterStatusSources(all, '', ['Open', 'Closed'])).includes('external'));
  assert.notEqual(agenda.statusSourceFilterKey('project-A'), agenda.statusSourceFilterKey('project-B'));
});

test('source search covers task content and activity, keeps ancestors and omits unrelated siblings', () => {
  const { utils, agenda } = loadStatus();
  const child = issue('child', [change('comment', '2026-10-09T10:00:00', 'comment')], 'parent');
  child.summary = 'Zażółć gęślą jaźń';
  child.description = 'Database migration';
  child.assignee = { name: 'Piotr', login: 'piotr' };
  child.timeline[0].text = 'Unique meeting decision';
  const all = utils.buildStatusStories([
    issue('parent'), child, issue('sibling', [], 'parent')
  ], {}, 'https://yt.example', '2026-10-08', '2026-10-10', true);
  for (const query of ['PCC-child', 'zazolc gesla', 'migration', 'Piotr', 'unique decision', 'Anna', 'in progress']) {
    assert.deepEqual(ids(agenda.filterStatusSources(all, query, [])), ['parent', 'child'], query);
  }
  assert.equal(agenda.filterStatusSources(all, 'not present', []).length, 0);
  assert.deepEqual(ids(agenda.filterStatusSources(all, 'PCC-parent', [])), []);
  const cycle = [{ ...all[0], parentIssueReadableId: 'PCC-child' }, all[1]];
  assert.equal(agenda.filterStatusSources(cycle, 'PCC-child', []).length, 2);
});

test('continuation keeps edited content, deduplicates tasks and notes and preserves archived objects', () => {
  const { agenda } = loadStatus();
  const source = { ...issue('1'), issueReadableId: 'PCC-1', issueId: '1', title: 'Original', issueUrl: 'https://yt.example/issue/PCC-1', comments: [] };
  const old = { id: 'old', title: 'My title', summaryHtml: '<p>Edited short text</p>', detailsHtml: '<p>Edited details</p>', source };
  const note = { id: 'note', title: 'Decision', summaryHtml: '<p>Wait</p>', detailsHtml: '' };
  const report = { id: 'report-A', title: 'Previous meeting', projectId: 'project-A', agenda: [old, note] };
  const first = agenda.mergeAgenda([], report.agenda, report);
  const second = agenda.mergeAgenda(first, report.agenda, report);
  assert.equal(second.length, 2);
  assert.equal(second[0].summaryHtml, old.summaryHtml);
  assert.equal(second[0].detailsHtml, old.detailsHtml);
  assert.equal(second[0].originReportId, report.id);
  assert.equal(old.originReportId, undefined);
  const refreshed = agenda.refreshAgendaSources(second, [{ ...source, stateName: 'Done', assigneeName: 'Piotr' }]);
  assert.equal(refreshed[0].source.stateName, 'Done');
  assert.equal(refreshed[0].title, 'My title');
  assert.equal(refreshed[0].summaryHtml, old.summaryHtml);
  assert.equal(second[0].source.stateName, undefined);
  assert.notEqual(agenda.statusDraftKey('project-A'), agenda.statusDraftKey('project-B'));
});

test('ordering moves whole parent groups and reorders children within their parent', () => {
  const { agenda } = loadStatus();
  const card = (id, parent) => ({ id, title: id, summaryHtml: '', detailsHtml: '', source: { issueReadableId: id, parentIssueReadableId: parent } });
  const input = [card('P1'), card('C1', 'P1'), card('G1', 'C1'), card('C2', 'P1'), card('P2'), card('C3', 'P2')];
  assert.deepEqual(ids(agenda.moveAgenda(input, 'P1', 'P2')), ['P2', 'C3', 'P1', 'C1', 'G1', 'C2']);
  assert.deepEqual(ids(agenda.moveAgenda(input, 'C1', 'C2')), ['P1', 'C2', 'C1', 'G1', 'P2', 'C3']);
  assert.deepEqual(ids(agenda.moveAgenda(input, 'C1', 'C3')), ids(input));
  assert.deepEqual(ids(agenda.orderAgenda([input[1], input[0], input[2]])), ['P1', 'C1', 'G1']);
  assert.equal(agenda.orderAgenda([card('A', 'B'), card('B', 'A')]).length, 2);
});

test('per-task meeting notes survive save, continuation and source refresh independently of descriptions', () => {
  const { agenda } = loadStatus();
  const card = id => ({
    id, title: id, summaryHtml: '<p>Prepared summary</p>', detailsHtml: '<p>Prepared details</p>',
    source: { issueReadableId: id, issueUrl: `https://yt.example/issue/${id}` }
  });
  const items = [card('PCC-1'), card('PCC-2')];
  items[0] = { ...items[0], meetingNotesHtml: '<p><strong>Decision:</strong> discuss next week.</p>' };
  const saved = JSON.parse(JSON.stringify({ id: 'meeting-A', title: 'Meeting', agenda: items, content: agenda.buildAgendaHtml(items) }));
  const restored = agenda.getReportAgenda(saved);
  assert.equal(restored[0].meetingNotesHtml, items[0].meetingNotesHtml);
  assert.equal(restored[1].meetingNotesHtml, undefined);
  const carried = agenda.mergeAgenda([], restored, saved);
  const refreshed = agenda.refreshAgendaSources(carried, [{ ...items[0].source, stateName: 'Done' }]);
  assert.equal(refreshed[0].meetingNotesHtml, items[0].meetingNotesHtml);
  assert.equal(refreshed[0].summaryHtml, items[0].summaryHtml);
  assert.equal(refreshed[0].detailsHtml, items[0].detailsHtml);
  const revised = refreshed.map(item => item.source.issueReadableId === 'PCC-1' ? { ...item, meetingNotesHtml: '<p>New decision</p>' } : item);
  assert.equal(restored[0].meetingNotesHtml, items[0].meetingNotesHtml);
  const html = agenda.buildAgendaHtml(revised);
  assert.ok(html.includes('<h3>Notatki ze spotkania</h3><p>New decision</p>'));
  assert.equal(html.split('Notatki ze spotkania').length - 1, 1);
  assert.ok(!agenda.buildAgendaHtml([{ ...items[1], meetingNotesHtml: '<p></p>' }]).includes('Notatki ze spotkania'));
});

test('legacy reports retain their complete edited content and new exports retain collapsible details', () => {
  const { agenda } = loadStatus();
  const html = '<h2>Earlier edited report</h2><p>Keep everything.</p>';
  const legacy = agenda.getReportAgenda({ id: 'legacy', title: 'Earlier', content: html });
  assert.equal(legacy[0].summaryHtml, html);
  assert.ok(agenda.buildAgendaHtml([{ ...legacy[0], detailsHtml: '<p>Extra</p>' }]).includes('<details>'));
});

test('Status fetch stays project-scoped, includes later updates, paginates activity and uses log event dates', async () => {
  const requests = [];
  const raw = { ...issue('1'), timeline: undefined };
  const events = Array.from({ length: 101 }, (_, index) => ({ id: String(index), category: { id: 'CommentsCategory' }, author, timestamp: stamp('2026-10-09T10:00:00'), added: [{ text: `Comment ${index}` }] }));
  events.push({ id: 'work', category: { id: 'WorkItemCategory' }, author, timestamp: stamp('2026-10-09T11:00:00'), added: [{ date: stamp('2026-09-01T00:00:00'), duration: { minutes: 60 }, text: 'Logged late' }] });
  const { api } = loadStatus(async request => {
    requests.push(request);
    if (request.url.endsWith('/issues')) return [raw];
    if (request.url.endsWith('/activities')) return events.slice(request.params.$skip, request.params.$skip + request.params.$top);
    throw new Error('Unexpected URL');
  });
  const result = await api.fetchIssuesActivity('https://yt.example', 'token', 'PCC', '2026-10-08', '2026-10-10', 'Aktywności', undefined, '', false, { additionalIssueIds: [] });
  assert.match(requests[0].params.query, /^\(project: PCC\) and \(updated: 2026-10-08 \.\. \d{4}-\d{2}-\d{2}\)$/);
  assert.ok(requests[0].params.query.match(/ \.\. (\d{4}-\d{2}-\d{2})/)[1] >= '2026-10-15');
  assert.equal(result[0].timeline.length, 102);
  assert.equal(result[0].timeline.find(event => event.type === 'work-item').timestamp, stamp('2026-10-09T11:00:00'));
  assert.equal(result[0].statusScopeMember, true);
  assert.equal(requests.filter(request => request.url.endsWith('/activities')).length, 2);
});

test('incomplete history fails explicitly rather than reporting no activity', async () => {
  const { api } = loadStatus(async request => {
    if (request.url.endsWith('/issues')) return [issue('1')];
    throw new Error('History unavailable');
  });
  await assert.rejects(api.fetchIssuesActivity('https://yt.example', 'token', 'PCC', '2026-10-08', '2026-10-10', 'Aktywności', undefined, '', false, { additionalIssueIds: [] }), /PCC-1/);
});

test('Status can load all project states without fetching old inactive histories or losing later-edited activity', async () => {
  const requests = [];
  const metadata = (id, state, updated) => ({
    ...issue(id), updated: stamp(updated), timeline: undefined,
    customFields: [{ name: 'State', value: { name: state } }]
  });
  const raw = [metadata('active', 'Closed', '2026-10-15T10:00:00'), metadata('old-open', 'Open', '2026-09-01T10:00:00'), metadata('old-closed', 'Closed', '2026-09-01T10:00:00')];
  const { api, utils, agenda } = loadStatus(async request => {
    requests.push(request);
    if (request.url.endsWith('/issues')) return raw;
    if (request.url.endsWith('/issues/active/activities')) return [{
      id: 'comment', category: { id: 'CommentsCategory' }, author,
      timestamp: stamp('2026-10-09T10:00:00'), added: [{ text: 'Activity before a later edit' }]
    }];
    throw new Error('Inactive histories must not be fetched');
  });
  const issues = await api.fetchIssuesActivity('https://yt.example', 'token', 'PCC', '2026-10-08', '2026-10-10', 'Aktywności', undefined, '', false,
    { additionalIssueIds: [], includeInactive: true });
  assert.equal(requests[0].params.query, '(project: PCC)');
  assert.equal(requests.filter(request => request.url.endsWith('/activities')).length, 1);
  assert.equal(issues.find(item => item.id === 'old-open').state.name, 'Open');
  const sources = utils.buildStatusStories(issues, {}, 'https://yt.example', '2026-10-08', '2026-10-10', true);
  assert.deepEqual(ids(agenda.filterStatusSources(sources, '', ['Open'])).sort(), ['active', 'old-open']);
});

test('project mapping supports aliases, names and extra filters without a global query', () => {
  const { api } = loadStatus();
  assert.equal(api.buildStatusProjectScope('PMS, CBCP'), 'project: PMS, CBCP');
  assert.equal(api.buildStatusProjectScope('Long Project'), 'project: {Long Project}');
  assert.equal(api.buildStatusProjectScope('tag: meeting', 'PCC'), '(project: PCC) and (tag: meeting)');
  assert.equal(api.buildStatusProjectScope('project: ALIAS State: Open', 'PCC'), 'project: ALIAS State: Open');
  assert.throws(() => api.buildStatusProjectScope(''));
});

test('Status joins the project scope and date range with explicit operators, including grouped filters', async () => {
  const requests = [];
  const { api } = loadStatus(async request => {
    requests.push(request);
    return [];
  });
  const cases = [
    ['PFRON', '(project: PFRON)'],
    ['tag: meeting or tag: followup', '((project: PFRON) and (tag: meeting or tag: followup))'],
    ['project: PFRON or project: SUPPORT', '(project: PFRON or project: SUPPORT)'],
  ];
  for (const [mapping, scope] of cases) {
    await api.fetchIssuesActivity('https://yt.example', 'token', mapping, '2026-10-08', '2026-10-15', 'Aktywności', undefined, '', false,
      { additionalIssueIds: [], projectCode: 'PFRON' });
    const query = requests.at(-1).params.query;
    const dateEnd = query.match(/ \.\. (\d{4}-\d{2}-\d{2})\)$/)?.[1];
    assert.ok(dateEnd, 'The date range must be a complete grouped expression');
    assert.equal(query, `${scope} and (updated: 2026-10-08 .. ${dateEnd})`);
  }
});

test('a missing carried task is reported without hiding valid current sources', async () => {
  const missing = [];
  const { api } = loadStatus(async request => {
    if (request.url.endsWith('/issues')) return [issue('1')];
    if (request.url.endsWith('/activities')) return [];
    throw new Error('404 issue unavailable');
  });
  const result = await api.fetchIssuesActivity('https://yt.example', 'token', 'PCC', '2026-10-08', '2026-10-10', 'Aktywności', undefined, '', false,
    { additionalIssueIds: ['deleted'], onMissingIssue: id => missing.push(id) });
  assert.equal(result.length, 1);
  assert.deepEqual(missing, ['deleted']);
});

test('Daily callers retain their date upper bound and ordinary activity request', async () => {
  const requests = [];
  const { api } = loadStatus(async request => {
    requests.push(request);
    return request.url.endsWith('/issues') ? [issue('1')] : [];
  });
  await api.fetchIssuesActivity('https://yt.example', 'token', 'PCC', '2026-10-08', '2026-10-10');
  assert.equal(requests[0].params.query, 'project: PCC updated: 2026-10-08 .. 2026-10-10');
  assert.equal(requests[1].params.$skip, undefined);
});
