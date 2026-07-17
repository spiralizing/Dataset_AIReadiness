// Unit tests for the conformance report. Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { buildConformanceReport, CONFORMANCE_VERSION } from '../src/lib/report.js';

const FIXED = '2026-07-16T00:00:00.000Z';

test('Pathway A: 5 automated checks, all fail on empty answers', () => {
  const rep = buildConformanceReport({ pathway: 'A', sub_domain: null, answers: {} }, { now: FIXED });
  assert.equal(rep.schema_version, CONFORMANCE_VERSION);
  assert.equal(rep.summary.automated, 5); // persistent_id, landing_page, license, open_format, loadable
  assert.equal(rep.summary.pass, 0);
  assert.equal(rep.summary.fail, 5);
  assert.equal(rep.summary.pending, 0);
  assert.equal(rep.croissant.valid, false);
});

test('Pathway A: valid answers flip checks to pass', () => {
  const record = {
    pathway: 'A',
    sub_domain: null,
    answers: {
      'fairness.l1.persistent_id': { value: '10.5281/zenodo.123' },
      'fairness.l1.landing_page': { value: 'https://example.org/ds' },
      'fairness.l1.license_explicit': { value: 'CC-BY-4.0' },
      'sustainability.l1.open_format': { value: 'Parquet' },
    },
  };
  const rep = buildConformanceReport(record, { now: FIXED });
  assert.equal(rep.summary.pass, 5); // the 4 grounded + loadable (cross-refs format)
  assert.equal(rep.summary.fail, 0);
});

test('Pathway C: 13 automated checks, none pending after Phase 3', () => {
  const rep = buildConformanceReport({ pathway: 'C', sub_domain: 'general', answers: {} }, { now: FIXED });
  assert.equal(rep.summary.automated, 13);
  assert.equal(rep.summary.pending, 0);
  // The generated PROV scaffold is well-formed, so prov_record_present passes
  // even on empty answers; the completion-dependent checks fail.
  const byId = Object.fromEntries(rep.checks.map((c) => [c.criterion, c.status]));
  assert.equal(byId['provenance.l3.prov_record_present'], 'pass');
  assert.equal(byId['provenance.l3.entity_per_variable'], 'fail');
  assert.equal(byId['explainability.l3.feature_lineage_intact'], 'fail');
});
