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

export const getPathway = (id) => PATHWAYS.find((p) => p.id === id) ?? null;
export const subDomainsForC = () => getPathway('C')?.sub_domains ?? [];
export const getSubDomain = (subId) =>
  subDomainsForC().find((s) => s.id === subId) ?? null;

// Pathway C ethics overlays live only in Ethics × L3; empty for A/B or no sub-domain.
export const ethicsOverlay = (pathway, subId) =>
  pathway === 'C' && subId ? (getSubDomain(subId)?.ethics_overlay ?? []) : [];

// Documentation template for a record: 'healthsheet' for Pathway C sub-domains
// that declare it (clinical, salutogenesis), else 'datasheet'.
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
  if (dimension === 'Ethics' && level === 'L3') {
    required = [...required, ...ethicsOverlay(pathway, subDomain)];
  }
  if (required.length === 0) return 'not-required';
  const active = required.filter((c) => !isUpcoming(c, stage));
  if (active.length === 0) return 'upcoming'; // entire cell deferred to a later stage
  return active.every((c) => isCriterionSatisfied(c, answers[c.id], results)) ? 'met' : 'unmet';
};

// All required criteria for a pathway, including Pathway-C ethics overlays for
// the chosen sub-domain. This is what the verdict and the datasheet iterate.
export const requiredCriteria = (pathway, subDomain) => [
  ...criteriaForPathway(pathway),
  ...ethicsOverlay(pathway, subDomain),
];

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
// Pathway C ethics overlays (appended after the base Ethics × L3 criteria).
export const criteriaForDimension = (dimension, pathway, subDomain) => {
  const base = ALL_CRITERIA.filter(
    (c) => c.dimension === dimension && isRequiredForPathway(c, pathway),
  );
  const overlays = dimension === 'Ethics' ? ethicsOverlay(pathway, subDomain) : [];
  return [...base, ...overlays];
};

// Recommended-but-not-required criteria for one dimension (e.g. Croissant at L1).
export const recommendedForDimension = (dimension, pathway) =>
  ALL_CRITERIA.filter(
    (c) =>
      c.dimension === dimension &&
      isRecommendedForPathway(c, pathway) &&
      !isRequiredForPathway(c, pathway),
  );
