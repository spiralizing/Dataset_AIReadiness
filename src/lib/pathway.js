// Pure pathway/verdict logic over the matrix schema. No React, no DOM — unit
// tested directly. Cumulative semantics are already encoded per-criterion in
// `required_in_pathways` (L1 -> A,B,C; L2 -> B,C; L3 -> C), so these helpers
// derive everything from that field and never re-implement the level ladder.
//
// NOTE: `isCriterionSatisfied` here is the *claimed* check — a criterion counts
// as satisfied when it has a meaningful answer. Phase 2 will tighten `automated`
// criteria so they count only when their validator passes; the signature stays
// the same so callers do not change.

import matrix from '../schema/matrix.json';
import pathwaysData from '../schema/pathways.json';
import { isUpcoming } from './stages.js';

export const ALL_CRITERIA = matrix.criteria;
export const LEVELS = matrix.levels;
export const PATHWAYS = pathwaysData.pathways;

// The 21 cell texts of the paper's assessment matrix, keyed dimension -> level.
// Rendered wherever the matrix itself is shown, so the wording and the criteria
// that operationalise it come from one file.
export const CELLS = matrix.cells;
export const cellText = (dimension, level) => CELLS?.[dimension]?.[level] ?? '';

// Criteria whose requirement the cell text does not name, with the attribution
// saying where in the paper they come from. This is the crosswalk a reader needs
// when the criterion count (larger) is compared with the cell count (21).
export const beyondCellCriteria = () => ALL_CRITERIA.filter((c) => c.beyond_cell);

export const getPathway = (id) => PATHWAYS.find((p) => p.id === id) ?? null;
export const subDomainsForC = () => getPathway('C')?.sub_domains ?? [];
export const getSubDomain = (subId) =>
  subDomainsForC().find((s) => s.id === subId) ?? null;

// Pathway C sub-domain overlays. Each overlay entry declares its own `dimension`
// and `level`, so a sub-domain is not confined to Ethics: the biomedical
// sub-domains overlay Ethics only, `materials` also overlays FAIRness,
// Provenance, and Characterization. Empty for A/B or when no sub-domain is set.
export const overlaysFor = (pathway, subId) =>
  pathway === 'C' && subId ? (getSubDomain(subId)?.overlay ?? []) : [];

// Overlays that belong to one matrix cell (dimension × level).
const overlaysForCell = (pathway, subId, dimension, level) =>
  overlaysFor(pathway, subId).filter((o) => o.dimension === dimension && o.level === level);

// A sub-domain may reword a base criterion via `label_overrides` — a map of
// criterion id -> { label?, remediation? }. Rewording is not the same as adding:
// the criterion, its id, and its verdict semantics are untouched, only the words
// the researcher reads. Used where a general criterion is right in substance but
// wrong in vocabulary (compute cost is core-hours and a machine name in
// materials, not a cloud bill).
const labelOverridesFor = (pathway, subId) =>
  (pathway === 'C' && subId ? getSubDomain(subId)?.label_overrides : null) ?? {};

export const applyLabelOverrides = (criterion, pathway, subId) => {
  const patch = labelOverridesFor(pathway, subId)[criterion?.id];
  return patch ? { ...criterion, ...patch } : criterion;
};

const withOverrides = (criteria, pathway, subId) => {
  const map = labelOverridesFor(pathway, subId);
  if (Object.keys(map).length === 0) return criteria;
  return criteria.map((c) => (map[c.id] ? { ...c, ...map[c.id] } : c));
};

// Documentation template for a record: 'healthsheet' for Pathway C sub-domains
// that declare it (clinical), else 'datasheet'.
export const templateForRecord = (record) =>
  record?.pathway === 'C' && record.sub_domain
    ? (getSubDomain(record.sub_domain)?.template ?? 'datasheet')
    : 'datasheet';

export const isRequiredForPathway = (criterion, pathway) =>
  Array.isArray(criterion.required_in_pathways) &&
  criterion.required_in_pathways.includes(pathway);

export const isRecommendedForPathway = (criterion, pathway) =>
  Array.isArray(criterion.recommended_in_pathways) &&
  criterion.recommended_in_pathways.includes(pathway);

export const criteriaForPathway = (pathway) =>
  ALL_CRITERIA.filter((c) => isRequiredForPathway(c, pathway));

export const recommendedForPathway = (pathway) =>
  ALL_CRITERIA.filter(
    (c) => isRecommendedForPathway(c, pathway) && !isRequiredForPathway(c, pathway),
  );

// A criterion is satisfied when its validator passes (automated criteria with a
// result in `results`) or, otherwise, when it carries a meaningful answer.
// answer shape: { value, notes }. `results` (optional) is the map from
// validationResults(); automated criteria without a result fall back to claimed.
export const isCriterionSatisfied = (criterion, answer, results) => {
  if (criterion.verification === 'automated' && results && results[criterion.id]) {
    return Boolean(results[criterion.id].ok);
  }
  if (!answer) return false;
  const v = answer.value;
  if (criterion.evidence_type === 'boolean') return v === true;
  if (v === null || v === undefined) return false;
  return String(v).trim() !== '';
};

// Status of one matrix cell (dimension × level) for a pathway given answers.
// 'not-required' — no criterion in the cell is required for this pathway.
// 'met'          — every required criterion in the cell is satisfied.
// 'unmet'        — at least one required criterion is not satisfied.
export const cellStatus = (dimension, level, pathway, answers = {}, subDomain, results, stage) => {
  let required = ALL_CRITERIA.filter(
    (c) => c.dimension === dimension && c.level === level && isRequiredForPathway(c, pathway),
  );
  required = [...required, ...overlaysForCell(pathway, subDomain, dimension, level)];
  if (required.length === 0) return 'not-required';
  const active = required.filter((c) => !isUpcoming(c, stage));
  if (active.length === 0) return 'upcoming'; // entire cell deferred to a later stage
  return active.every((c) => isCriterionSatisfied(c, answers[c.id], results)) ? 'met' : 'unmet';
};

// All required criteria for a pathway, including Pathway-C sub-domain overlays.
// This is what the verdict and the datasheet iterate.
export const requiredCriteria = (pathway, subDomain) =>
  withOverrides([...criteriaForPathway(pathway), ...overlaysFor(pathway, subDomain)], pathway, subDomain);

// Overall verdict for a pathway. Bottlenecks are the dimensions with any unmet
// required criterion (the paper's min-across-dimensions view).
export const pathwayVerdict = (pathway, answers = {}, subDomain, results, stage) => {
  const required = requiredCriteria(pathway, subDomain).filter((c) => !isUpcoming(c, stage));
  const unmetByDimension = {};
  let satisfiedCount = 0;
  for (const c of required) {
    if (isCriterionSatisfied(c, answers[c.id], results)) {
      satisfiedCount += 1;
    } else {
      (unmetByDimension[c.dimension] ??= []).push(c.id);
    }
  }
  return {
    met: satisfiedCount === required.length,
    requiredCount: required.length,
    satisfiedCount,
    bottlenecks: Object.keys(unmetByDimension),
    unmetByDimension,
  };
};

// Required criteria for one dimension under a pathway, in level order, including
// any Pathway C sub-domain overlays scoped to that dimension (appended after the
// base criteria).
export const criteriaForDimension = (dimension, pathway, subDomain) => {
  const base = ALL_CRITERIA.filter(
    (c) => c.dimension === dimension && isRequiredForPathway(c, pathway),
  );
  const overlays = overlaysFor(pathway, subDomain).filter((o) => o.dimension === dimension);
  return withOverrides([...base, ...overlays], pathway, subDomain);
};

// Recommended-but-not-required criteria for one dimension (e.g. Croissant at L1).
export const recommendedForDimension = (dimension, pathway) =>
  ALL_CRITERIA.filter(
    (c) =>
      c.dimension === dimension &&
      isRecommendedForPathway(c, pathway) &&
      !isRequiredForPathway(c, pathway),
  );
