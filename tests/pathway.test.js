// Unit tests for the Phase-1 foundation: dimension helpers, pathway/verdict
// logic, and the assessment reducer. Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { DIMENSIONS, slugify, dimensionBySlug } from '../src/lib/dimensions.js';
import {
  criteriaForPathway,
  recommendedForPathway,
  isCriterionSatisfied,
  cellStatus,
  pathwayVerdict,
  getPathway,
  subDomainsForC,
  overlaysFor,
  criteriaForDimension,
  recommendedForDimension,
} from '../src/lib/pathway.js';
import { reducer, emptyRecord, RECORD_VERSION } from '../src/state/assessment.jsx';
import { STAGES, getStage } from '../src/lib/stages.js';

// Build an answers map that satisfies every criterion in `criteria`.
const satisfyAll = (criteria) =>
  Object.fromEntries(
    criteria.map((c) => [c.id, { value: c.evidence_type === 'boolean' ? true : 'x' }]),
  );

// ---- dimensions -----------------------------------------------------------

test('DIMENSIONS lists the seven Bridge2AI dimensions', () => {
  assert.equal(DIMENSIONS.length, 7);
});

test('slugify and dimensionBySlug round-trip every dimension', () => {
  for (const d of DIMENSIONS) {
    assert.equal(dimensionBySlug(slugify(d)), d);
  }
  assert.equal(slugify('Pre-model Explainability'), 'pre-model-explainability');
  assert.equal(dimensionBySlug('no-such-dimension'), null);
});

// ---- pathway membership (cumulative) --------------------------------------

test('criteriaForPathway respects cumulative counts (A=16, B=32, C=53)', () => {
  assert.equal(criteriaForPathway('A').length, 16);
  assert.equal(criteriaForPathway('B').length, 32);
  assert.equal(criteriaForPathway('C').length, 53);
});

test('Pathway A is pure L1; Pathway B is L1+L2 only', () => {
  assert.ok(criteriaForPathway('A').every((c) => c.level === 'L1'));
  assert.ok(criteriaForPathway('B').every((c) => c.level === 'L1' || c.level === 'L2'));
});

test('Croissant descriptor is recommended (not required) in Pathway A', () => {
  const rec = recommendedForPathway('A').map((c) => c.id);
  assert.ok(rec.includes('fairness.l2.croissant_descriptor'));
  assert.ok(!criteriaForPathway('A').some((c) => c.id === 'fairness.l2.croissant_descriptor'));
});

// ---- satisfaction ---------------------------------------------------------

test('isCriterionSatisfied: boolean needs true; others need a non-empty value', () => {
  const boolC = { evidence_type: 'boolean' };
  const textC = { evidence_type: 'text' };
  assert.equal(isCriterionSatisfied(boolC, { value: true }), true);
  assert.equal(isCriterionSatisfied(boolC, { value: false }), false);
  assert.equal(isCriterionSatisfied(boolC, undefined), false);
  assert.equal(isCriterionSatisfied(textC, { value: 'documented' }), true);
  assert.equal(isCriterionSatisfied(textC, { value: '   ' }), false);
  assert.equal(isCriterionSatisfied(textC, { value: '' }), false);
});

// ---- cell status ----------------------------------------------------------

test('cellStatus: not-required above the pathway, unmet when empty, met when satisfied', () => {
  assert.equal(cellStatus('FAIRness', 'L3', 'A', {}), 'not-required');
  assert.equal(cellStatus('FAIRness', 'L1', 'A', {}), 'unmet');
  const answers = satisfyAll(criteriaForPathway('A'));
  assert.equal(cellStatus('FAIRness', 'L1', 'A', answers), 'met');
});

// ---- verdict --------------------------------------------------------------

test('pathwayVerdict: unmet with no answers, met when all required satisfied', () => {
  const empty = pathwayVerdict('A', {});
  assert.equal(empty.met, false);
  assert.equal(empty.requiredCount, 16);
  assert.equal(empty.satisfiedCount, 0);
  assert.ok(empty.bottlenecks.length > 0);

  const full = pathwayVerdict('A', satisfyAll(criteriaForPathway('A')));
  assert.equal(full.met, true);
  assert.equal(full.satisfiedCount, 16);
  assert.deepEqual(full.bottlenecks, []);
});

// ---- pathways + dimension gathering + overlays ----------------------------

test('getPathway and subDomainsForC resolve schema metadata', () => {
  assert.equal(getPathway('A').name, 'Accessible');
  assert.equal(getPathway('Z'), null);
  assert.equal(subDomainsForC().length, 7);
});

test('overlaysFor is empty except for Pathway C with a sub-domain', () => {
  assert.deepEqual(overlaysFor('A', 'clinical'), []);
  assert.deepEqual(overlaysFor('C', null), []);
  assert.equal(overlaysFor('C', 'clinical').length, 3);
  assert.equal(overlaysFor('C', 'materials').length, 6);
});

test('criteriaForDimension merges each overlay into the dimension it declares', () => {
  // Base Ethics required for C = 2 (L1) + 1 (L2) + 4 (L3) = 7.
  assert.equal(criteriaForDimension('Ethics', 'C', 'general').length, 7);
  const clinical = criteriaForDimension('Ethics', 'C', 'clinical');
  assert.equal(clinical.length, 10); // 7 base + 3 clinical overlays
  assert.ok(clinical.some((c) => c.id === 'ethics.l3.clinical.irb_protocol_id'));
  // A biomedical sub-domain overlays Ethics only — other dimensions are untouched.
  assert.equal(criteriaForDimension('FAIRness', 'C', 'clinical').length,
    criteriaForDimension('FAIRness', 'C', 'general').length);
  // Materials overlays four dimensions: FAIRness ×3, Provenance ×1,
  // Characterization ×1, Ethics ×1.
  const fairBase = criteriaForDimension('FAIRness', 'C', 'general').length;
  assert.equal(criteriaForDimension('FAIRness', 'C', 'materials').length, fairBase + 3);
  assert.equal(criteriaForDimension('Provenance', 'C', 'materials').length,
    criteriaForDimension('Provenance', 'C', 'general').length + 1);
  assert.equal(criteriaForDimension('Characterization', 'C', 'materials').length,
    criteriaForDimension('Characterization', 'C', 'general').length + 1);
  assert.equal(criteriaForDimension('Ethics', 'C', 'materials').length, 8);
  // Overlays never leak into a dimension they do not declare.
  assert.equal(criteriaForDimension('Computability', 'C', 'materials').length,
    criteriaForDimension('Computability', 'C', 'general').length);
});

test('cellStatus counts a non-Ethics overlay in its own cell', () => {
  // FAIRness × L3 for materials is unmet until the three overlay criteria are answered.
  const base = criteriaForDimension('FAIRness', 'C', 'general').filter((c) => c.level === 'L3');
  const answers = satisfyAll(base);
  assert.equal(cellStatus('FAIRness', 'L3', 'C', answers, 'general', undefined, 'upgrade'), 'met');
  assert.equal(cellStatus('FAIRness', 'L3', 'C', answers, 'materials', undefined, 'upgrade'), 'unmet');
  const withOverlay = { ...answers, ...satisfyAll(overlaysFor('C', 'materials')) };
  assert.equal(cellStatus('FAIRness', 'L3', 'C', withOverlay, 'materials', undefined, 'upgrade'), 'met');
});

test('criteriaForDimension for Pathway A yields only that dimension L1 criteria', () => {
  const fair = criteriaForDimension('FAIRness', 'A', null);
  assert.equal(fair.length, 5);
  assert.ok(fair.every((c) => c.level === 'L1'));
});

test('recommendedForDimension surfaces Croissant at L1 in FAIRness', () => {
  const rec = recommendedForDimension('FAIRness', 'A').map((c) => c.id);
  assert.deepEqual(rec, ['fairness.l2.croissant_descriptor']);
});

// ---- stage-aware verdict (L.4b) -------------------------------------------

test('Plan stage drops upcoming (release-time) criteria from the verdict — no DOI required', () => {
  // Pathway A required = 16 (all L1). In Plan, only acquisition criteria are
  // active; the 3 acquisition L1 criteria remain, the rest are upcoming.
  const full = pathwayVerdict('A', {}, undefined, undefined, undefined);
  const plan = pathwayVerdict('A', {}, undefined, undefined, 'plan');
  assert.equal(full.requiredCount, 16);
  assert.equal(plan.requiredCount, 3); // source_documented, collection_window, consent_basis_recorded
});

test('Prepare stage defers release-time criteria (no DOI/landing/metadata) but keeps documentation', () => {
  // Pathway A L1 has 3 release-time criteria (persistent_id, landing_page,
  // metadata_machine_readable); they defer in Prepare -> 16 - 3 = 13.
  const prepare = pathwayVerdict('A', {}, undefined, undefined, 'prepare');
  assert.equal(prepare.requiredCount, 13);
  // FAIRness L1 still has active governance criteria (license, access) in Prepare,
  // so the cell is 'unmet' (not fully upcoming) even though the DOI itself defers.
  assert.equal(cellStatus('FAIRness', 'L1', 'A', {}, undefined, undefined, 'prepare'), 'unmet');
});

test('cellStatus returns "upcoming" for an all-deferred cell in Plan', () => {
  // FAIRness L1 is all documentation/governance -> all upcoming in Plan.
  assert.equal(cellStatus('FAIRness', 'L1', 'A', {}, undefined, undefined, 'plan'), 'upcoming');
  // Provenance L1 (source + collection window) is acquisition -> active in Plan.
  assert.equal(cellStatus('Provenance', 'L1', 'A', {}, undefined, undefined, 'plan'), 'unmet');
});

// ---- reducer --------------------------------------------------------------

test('reducer SET_PATHWAY stamps started_at and defaults sub_domain for C', () => {
  const s0 = emptyRecord();
  const a = reducer(s0, { type: 'SET_PATHWAY', pathway: 'A' });
  assert.equal(a.pathway, 'A');
  assert.equal(a.sub_domain, null);
  assert.ok(typeof a.started_at === 'string' && a.started_at.length > 0);

  const c = reducer(s0, { type: 'SET_PATHWAY', pathway: 'C' });
  assert.equal(c.sub_domain, 'general');
});

test('lifecycle stages: three defined; getStage resolves; reducer SET_STAGE stamps started_at', () => {
  assert.deepEqual(STAGES.map((s) => s.id), ['plan', 'prepare', 'upgrade']);
  assert.equal(getStage('upgrade').suggestedPathway, 'C');
  assert.equal(getStage('nope'), null);

  const s0 = emptyRecord();
  assert.equal(s0.stage, null);
  const s1 = reducer(s0, { type: 'SET_STAGE', stage: 'prepare' });
  assert.equal(s1.stage, 'prepare');
  assert.ok(typeof s1.started_at === 'string' && s1.started_at.length > 0);
});

test('reducer: emptyRecord seeds an empty provenance model; SET_PROVENANCE replaces it', () => {
  const s0 = emptyRecord();
  assert.deepEqual(s0.provenance, { sources: [], steps: [] });
  const model = {
    sources: [{ id: 's1', name: 'Raw EHR' }],
    steps: [{ id: 'st1', label: 'Cleaning', inputs: ['s1'], outputs: [{ id: 'o1', name: 'age' }], software: 'python', agentRole: 'data_steward' }],
  };
  const s1 = reducer(s0, { type: 'SET_PROVENANCE', provenance: model });
  assert.deepEqual(s1.provenance, model);
});

test('reducer SET_ANSWER merges value and notes; RESET clears', () => {
  let s = emptyRecord();
  s = reducer(s, { type: 'SET_ANSWER', id: 'x.l1.y', value: true });
  s = reducer(s, { type: 'SET_ANSWER', id: 'x.l1.y', notes: 'evidence link' });
  assert.deepEqual(s.answers['x.l1.y'], { value: true, notes: 'evidence link' });

  const reset = reducer(s, { type: 'RESET' });
  assert.equal(reset.schema_version, RECORD_VERSION);
  assert.deepEqual(reset.answers, {});
});
