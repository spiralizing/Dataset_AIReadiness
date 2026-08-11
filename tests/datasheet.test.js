// Unit tests for the Phase-1 export generators and the overlay-aware verdict.
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { pathwayVerdict, cellStatus, requiredCriteria, templateForRecord } from '../src/lib/pathway.js';
import { generateDatasheet } from '../src/generators/datasheet.js';
import { buildAssessmentReport, REPORT_VERSION } from '../src/lib/report.js';

const FIXED = '2026-07-16T00:00:00.000Z';

// ---- overlay-aware verdict ------------------------------------------------

test('requiredCriteria adds Pathway-C overlays for the chosen sub-domain', () => {
  assert.equal(requiredCriteria('A').length, 16);
  assert.equal(requiredCriteria('C', 'general').length, 55);
  assert.equal(requiredCriteria('C', 'clinical').length, 58); // 55 + 3 overlays
});

test('pathwayVerdict counts overlays for Pathway C clinical', () => {
  const v = pathwayVerdict('C', {}, 'clinical');
  assert.equal(v.requiredCount, 58);
  assert.equal(v.met, false);
});

test('cellStatus for Ethics×L3 includes overlays under Pathway C', () => {
  // Empty answers -> unmet; base Ethics L3 alone would also be unmet, so assert
  // that satisfying only base (not overlays) still leaves the cell unmet.
  const base = requiredCriteria('C', 'general').filter(
    (c) => c.dimension === 'Ethics' && c.level === 'L3',
  );
  const answers = Object.fromEntries(
    base.map((c) => [c.id, { value: c.evidence_type === 'boolean' ? true : 'x' }]),
  );
  assert.equal(cellStatus('Ethics', 'L3', 'C', answers, 'clinical'), 'unmet'); // overlays still empty
});

// ---- datasheet ------------------------------------------------------------

test('generateDatasheet renders header, sections, and not-provided placeholders', () => {
  const record = {
    pathway: 'A',
    sub_domain: null,
    answers: {
      'fairness.l1.persistent_id': { value: '10.5281/zenodo.123' },
    },
  };
  const md = generateDatasheet(record, { now: FIXED });
  assert.match(md, /^# Dataset datasheet/);
  assert.match(md, /Assessment pathway:\*\* A — Accessible \(L1\)/);
  assert.match(md, /## FAIRness/);
  assert.match(md, /Persistent identifier assigned[^\n]*10\.5281\/zenodo\.123/);
  assert.match(md, /_not provided_/); // unanswered criteria flagged
});

test('maintenance criteria render once, in their own section after the dimensions', () => {
  // Gebru's template has a Maintenance group, and a reader looks for it by name.
  // Versioning and long-term access are filed under FAIRness and Sustainability in
  // the matrix, so the generator regroups them — without printing them twice,
  // which is the failure mode the dimension-ordered layout exists to avoid.
  const md = generateDatasheet(
    {
      pathway: 'C',
      sub_domain: 'general',
      answers: {
        'sustainability.l2.maintenance_plan': { value: 'Annual refresh; superseded versions kept and marked deprecated; errata to the study inbox.' },
        'fairness.l3.versioned_release': { value: 'Concept DOI plus per-version DOIs on Zenodo.' },
      },
    },
    { now: FIXED },
  );

  const iMaint = md.indexOf('## Maintenance');
  assert.ok(iMaint > -1, 'no Maintenance section');
  assert.ok(iMaint > md.indexOf('## Ethics'), 'Maintenance should follow the dimension sections');

  for (const label of ['Maintenance stated', 'Versioned release', 'Long-term access plan']) {
    const hits = md.split(label).length - 1;
    assert.equal(hits, 1, `"${label}" appears ${hits} times, expected exactly once`);
  }
  assert.match(md, /Annual refresh/);
});

test('generateDatasheet orders Characterization before FAIRness before Ethics', () => {
  const md = generateDatasheet({ pathway: 'C', sub_domain: 'general', answers: {} }, { now: FIXED });
  const iChar = md.indexOf('## Characterization');
  const iFair = md.indexOf('## FAIRness');
  const iEthics = md.indexOf('## Ethics');
  assert.ok(iChar > -1 && iChar < iFair && iFair < iEthics);
});

// ---- healthsheet variant --------------------------------------------------

test('templateForRecord selects healthsheet only for the declaring sub-domains', () => {
  assert.equal(templateForRecord({ pathway: 'C', sub_domain: 'clinical' }), 'healthsheet');
  assert.equal(templateForRecord({ pathway: 'C', sub_domain: 'general' }), 'datasheet');
  assert.equal(templateForRecord({ pathway: 'A', sub_domain: null }), 'datasheet');
});

test('generateDatasheet emits a healthsheet title/preamble for clinical', () => {
  const md = generateDatasheet({ pathway: 'C', sub_domain: 'clinical', answers: {} }, { now: FIXED });
  assert.match(md, /^# Dataset healthsheet/);
  assert.match(md, /Healthsheet.*Rostamzadeh/);
});

test('generateDatasheet stays a datasheet for C general', () => {
  const md = generateDatasheet({ pathway: 'C', sub_domain: 'general', answers: {} }, { now: FIXED });
  assert.match(md, /^# Dataset datasheet/);
  assert.ok(!/healthsheet/i.test(md.split('\n')[0]));
});

// ---- lifecycle limitations ------------------------------------------------

test('Upgrade stage lists unmet locked (acquisition/curation) criteria as limitations', () => {
  const md = generateDatasheet(
    { pathway: 'C', sub_domain: 'general', stage: 'upgrade', answers: {} },
    { now: FIXED },
  );
  assert.match(md, /## Known limitations/);
  assert.match(md, /Consent basis recorded/); // acquisition criterion, unmet + locked
});

test('Plan stage produces no limitations section (nothing locked)', () => {
  const md = generateDatasheet(
    { pathway: 'C', sub_domain: 'general', stage: 'plan', answers: {} },
    { now: FIXED },
  );
  assert.ok(!/## Known limitations/.test(md));
});

// ---- assessment report ----------------------------------------------------

test('buildAssessmentReport wraps record with verdict and metadata', () => {
  const record = { pathway: 'A', sub_domain: null, started_at: FIXED, answers: {} };
  const report = buildAssessmentReport(record, { now: FIXED });
  assert.equal(report.schema_version, REPORT_VERSION);
  assert.equal(report.pathway, 'A');
  assert.equal(report.verdict.required_count, 16);
  assert.equal(report.verdict.satisfied_count, 0);
  assert.equal(report.verdict.met, false);
  assert.deepEqual(report.answers, {});
});
