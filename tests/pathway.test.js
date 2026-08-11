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
  requiredCriteria,
} from '../src/lib/pathway.js';
import { reducer, emptyRecord, RECORD_VERSION } from '../src/state/assessment.jsx';
import { STAGES, getStage, isLocked, isUpcoming } from '../src/lib/stages.js';

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

test('criteriaForPathway respects cumulative counts (A=16, B=33, C=55)', () => {
  assert.equal(criteriaForPathway('A').length, 16);
  assert.equal(criteriaForPathway('B').length, 33);
  assert.equal(criteriaForPathway('C').length, 55);
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
  assert.equal(subDomainsForC().length, 6);
});

test('overlaysFor is empty except for Pathway C with a sub-domain', () => {
  assert.deepEqual(overlaysFor('A', 'clinical'), []);
  assert.deepEqual(overlaysFor('C', null), []);
  assert.equal(overlaysFor('C', 'clinical').length, 3);
  assert.equal(overlaysFor('C', 'materials').length, 6);
});

test('criteriaForDimension merges each overlay into the dimension it declares', () => {
  // Base Ethics required for C = 2 (L1) + 1 (L2) + 5 (L3) = 8.
  assert.equal(criteriaForDimension('Ethics', 'C', 'general').length, 8);
  const clinical = criteriaForDimension('Ethics', 'C', 'clinical');
  // Stated relative to the base, like the materials assertions below, so adding a
  // base criterion does not look like an overlay regression.
  assert.equal(clinical.length, criteriaForDimension('Ethics', 'C', 'general').length + 3);
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
  assert.equal(criteriaForDimension('Ethics', 'C', 'materials').length, 9);
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

// ---- overlays are stage-aware, like every other criterion ------------------

test('overlays lock and defer with the lifecycle stage, uniformly across sub-domains', () => {
  const byId = (subId) => Object.fromEntries(overlaysFor('C', subId).map((o) => [o.id, o]));
  const materials = byId('materials');
  const clinical = byId('clinical');

  // Upgrade (published dataset): acquisition and curation are fixed. The
  // a-priori provenance argument in code — a published dataset cannot retro-fit
  // its run graph, so this is a limitation to document, not a gap to fix.
  assert.ok(isLocked(materials['provenance.l3.materials.apriori_capture'], 'upgrade'));
  assert.ok(isLocked(materials['characterization.l3.materials.acquisition_parameters'], 'upgrade'));
  assert.ok(isLocked(clinical['ethics.l3.clinical.irb_protocol_id'], 'upgrade'));
  assert.ok(isLocked(clinical['ethics.l3.clinical.hipaa_method'], 'upgrade'));
  // Governance and documentation stay actionable after publication.
  assert.ok(!isLocked(materials['ethics.l3.materials.source_data_licensing'], 'upgrade'));
  assert.ok(!isLocked(materials['fairness.l3.materials.encoding_standard'], 'upgrade'));
  assert.ok(!isLocked(clinical['ethics.l3.clinical.dua_template'], 'upgrade'));

  // Prepare (collected, not yet published): only acquisition is fixed.
  assert.ok(isLocked(clinical['ethics.l3.clinical.irb_protocol_id'], 'prepare'));
  assert.ok(!isLocked(clinical['ethics.l3.clinical.hipaa_method'], 'prepare'));

  // Plan (still collecting): nothing is locked, and post-acquisition work is
  // upcoming rather than an outstanding failure.
  assert.ok(!isLocked(materials['provenance.l3.materials.apriori_capture'], 'plan'));
  assert.ok(!isUpcoming(materials['provenance.l3.materials.apriori_capture'], 'plan'));
  assert.ok(isUpcoming(materials['ethics.l3.materials.source_data_licensing'], 'plan'));
});

test('upcoming overlays drop out of the Plan-stage verdict', () => {
  const required = requiredCriteria('C', 'materials');
  const planCount = pathwayVerdict('C', {}, 'materials', undefined, 'plan').requiredCount;
  const upgradeCount = pathwayVerdict('C', {}, 'materials', undefined, 'upgrade').requiredCount;

  assert.ok(planCount < upgradeCount, 'Plan should require fewer criteria than Upgrade');
  assert.equal(upgradeCount, required.length, 'nothing is upcoming once published');
  // The two acquisition-stage materials overlays are due while planning.
  const planIds = requiredCriteria('C', 'materials')
    .filter((c) => !isUpcoming(c, 'plan'))
    .map((c) => c.id);
  assert.ok(planIds.includes('provenance.l3.materials.apriori_capture'));
  assert.ok(planIds.includes('characterization.l3.materials.acquisition_parameters'));
});

test('label_overrides reword a base criterion without changing its identity', () => {
  const find = (subId) =>
    criteriaForDimension('Sustainability', 'C', subId).find(
      (c) => c.id === 'sustainability.l3.compute_cost_reported',
    );
  const base = find('general');
  const materials = find('materials');

  assert.match(materials.label, /core-hours/);
  assert.notEqual(materials.label, base.label);
  // Everything that decides behaviour is untouched — same id, same evidence type,
  // same pathway membership, so the verdict cannot diverge between sub-domains.
  assert.equal(materials.id, base.id);
  assert.equal(materials.evidence_type, base.evidence_type);
  assert.equal(materials.verification, base.verification);
  assert.deepEqual(materials.required_in_pathways, base.required_in_pathways);
  assert.equal(
    requiredCriteria('C', 'materials').length,
    requiredCriteria('C', 'general').length + overlaysFor('C', 'materials').length,
  );
  // requiredCriteria carries the reworded copy too, so the datasheet and todo agree.
  assert.match(
    requiredCriteria('C', 'materials').find((c) => c.id === base.id).label,
    /core-hours/,
  );
});
