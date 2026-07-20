// Round-trip tests for the assessment import/export path. Export is
// JSON.stringify(state); import is a LOAD dispatch. These lock the reducer
// behaviour the ImportAssessment component and the Export "Export assessment"
// button depend on. Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { reducer, emptyRecord, RECORD_VERSION } from '../src/state/assessment.jsx';

test('export -> import reproduces the record (deep round-trip)', () => {
  const record = {
    ...emptyRecord(),
    stage: 'prepare',
    pathway: 'C',
    sub_domain: 'clinical',
    answers: { 'ethics.l1.de_identification_applied': { value: true, notes: 'safe harbor' } },
    dataset: { name: 'Cohort X', description: 'desc', version: '1.0.0' },
  };

  // Simulate: write to file, read it back, LOAD it.
  const serialized = JSON.stringify(record);
  const loaded = reducer(emptyRecord(), { type: 'LOAD', record: JSON.parse(serialized) });

  assert.deepEqual(loaded, record);
  assert.equal(loaded.schema_version, RECORD_VERSION);
});

test('LOAD backfills missing keys from the empty record', () => {
  // An older/partial export lacking newer fields still yields a complete record.
  const partial = { schema_version: RECORD_VERSION, pathway: 'A' };
  const loaded = reducer(emptyRecord(), { type: 'LOAD', record: partial });

  assert.equal(loaded.pathway, 'A');
  assert.deepEqual(loaded.dataset, { name: '', description: '', version: '' });
  assert.deepEqual(loaded.answers, {});
  assert.deepEqual(loaded.provenance, { sources: [], steps: [] });
});

test('RESET clears back to an empty record', () => {
  const dirty = { ...emptyRecord(), pathway: 'B', dataset: { name: 'x' } };
  assert.deepEqual(reducer(dirty, { type: 'RESET' }), emptyRecord());
});
