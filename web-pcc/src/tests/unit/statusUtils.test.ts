import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDefaultStatusTitle, buildStatusStories } from '../../features/status/utils/statusUtils';

const issue = {
  id: '1',
  idReadable: 'PMS-1',
  summary: 'Test story',
  description: 'Opis',
  created: Date.now(),
  updated: Date.now(),
  project: { id: 'p1', shortName: 'PMS' },
  state: { name: 'In Progress', color: { background: '#fff', foreground: '#000' } },
  assignee: { name: 'Jan Kowalski', login: 'jkowalski' },
  timeline: [
    { type: 'comment', id: 'c1', timestamp: Date.now(), author: { name: 'Jan Kowalski', login: 'jkowalski' }, text: 'Komentarz statusowy' },
  ],
  links: [],
};

test('buildDefaultStatusTitle buduje polski tytuł', () => {
  assert.match(buildDefaultStatusTitle('PMS', '2026-04-08'), /^Status projektu PMS - \d{2}\.\d{2}\.\d{4}$/);
});

test('buildStatusStories tworzy co najmniej jedną historię', () => {
  const stories = buildStatusStories([issue] as any, { 'PMS-1': 'Notatka Daily' }, 'https://youtrack.example.com', '2026-04-01', '2026-04-08');
  assert.equal(stories.length, 1);
  assert.equal(stories[0].issueReadableId, 'PMS-1');
});

