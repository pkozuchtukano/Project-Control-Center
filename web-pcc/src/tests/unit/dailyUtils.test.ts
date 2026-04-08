import assert from 'node:assert/strict';
import test from 'node:test';
import { getSmartDateRange, normalizeStatuses } from '../../features/daily/utils/dailyUtils';

test('normalizeStatuses normalizuje listê statusów', () => {
  assert.deepEqual(normalizeStatuses('In Progress, Code Review; Tests'), ['in progress', 'code review', 'tests']);
});

test('smart date range zwraca poprawny format', () => {
  const range = getSmartDateRange();
  assert.match(range.from, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(range.to, /^\d{4}-\d{2}-\d{2}$/);
});
