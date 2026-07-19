// Machine-readable assessment report — the JSON artifact in the release bundle.
// Pure function: wraps the record with the computed verdict and generation
// metadata. Kept separate from the datasheet (human-readable) generator.

import { pathwayVerdict, requiredCriteria } from './pathway.js';
import { validationResults, AUTOMATED_WITH_VALIDATOR } from './validation.js';
import { isUpcoming } from './stages.js';
import { generateCroissant } from '../generators/croissant.js';
import { validateCroissant } from './croissantValidation.js';

export const REPORT_VERSION = 'assessment_report_v0';
export const CONFORMANCE_VERSION = 'conformance_report_v0';

export function buildAssessmentReport(record, opts = {}) {
  const { pathway, sub_domain: subDomain, started_at, answers = {} } = record;
  const now = opts.now ?? new Date().toISOString();
  const results = opts.results ?? validationResults(record);
  const verdict = pathwayVerdict(pathway, answers, subDomain, results, record.stage);

  return {
    schema_version: REPORT_VERSION,
    generated_at: now,
    pathway,
    sub_domain: subDomain ?? null,
    started_at: started_at ?? null,
    verdict: {
      met: verdict.met,
      required_count: verdict.requiredCount,
      satisfied_count: verdict.satisfiedCount,
      bottlenecks: verdict.bottlenecks,
    },
    answers,
  };
}

// The conformance report — the machine-readable record of which automated
// checks passed, plus the Croissant validation detail. Named .json for now; the
// RDF/JSON-LD form (a SHACL validation report) arrives with Phase 4.
export function buildConformanceReport(record, opts = {}) {
  const { pathway, sub_domain: subDomain } = record;
  const now = opts.now ?? new Date().toISOString();
  const croissant = opts.croissant ?? generateCroissant(record);
  const croissantResult = validateCroissant(croissant);
  const results = opts.results ?? validationResults(record, { croissant });

  const checks = requiredCriteria(pathway, subDomain)
    .filter((c) => c.verification === 'automated' && !isUpcoming(c, record.stage))
    .map((c) => {
      const hasValidator = AUTOMATED_WITH_VALIDATOR.has(c.id);
      const res = results[c.id];
      const status = !hasValidator ? 'pending' : res?.ok ? 'pass' : 'fail';
      return {
        criterion: c.id,
        label: c.label,
        status,
        message: hasValidator ? (res?.message ?? '') : 'validator pending (Phase 4)',
      };
    });

  const count = (s) => checks.filter((c) => c.status === s).length;

  return {
    schema_version: CONFORMANCE_VERSION,
    generated_at: now,
    pathway,
    sub_domain: subDomain ?? null,
    croissant: {
      valid: croissantResult.valid,
      loadable: croissantResult.loadable,
      errors: croissantResult.errors,
      warnings: croissantResult.warnings,
    },
    checks,
    summary: {
      automated: checks.length,
      pass: count('pass'),
      fail: count('fail'),
      pending: count('pending'),
    },
  };
}
