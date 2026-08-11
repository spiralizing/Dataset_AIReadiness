// Machine-readable assessment report — the JSON artifact in the release bundle.
// Pure function: wraps the record with the computed verdict and generation
// metadata. Kept separate from the datasheet (human-readable) generator.

import { pathwayVerdict, requiredCriteria } from './pathway.js';
import { validationResults, AUTOMATED_WITH_VALIDATOR } from './validation.js';
import { isUpcoming } from './stages.js';
import { generateCroissant } from '../generators/croissant.js';
import { effectiveProvo } from '../generators/provo.js';
import { validateCroissant } from './croissantValidation.js';
import { validateProvo } from './provoValidation.js';
import { artifactDegrees, DEGREES } from './actionability.js';
import { citeThisWorkShort } from './thisWork.js';

// One-line citation of the framework this tool implements, embedded in every
// machine-readable report so downstream consumers can attribute it.
const FRAMEWORK = citeThisWorkShort();

export const REPORT_VERSION = 'assessment_report_v0';
// v1 adds `ladder`: the degree of machine-actionability reached by each generated
// artifact, in the paper's vocabulary. Additive — every v0 key is unchanged.
export const CONFORMANCE_VERSION = 'conformance_report_v1';

export function buildAssessmentReport(record, opts = {}) {
  const { pathway, sub_domain: subDomain, started_at, answers = {} } = record;
  const now = opts.now ?? new Date().toISOString();
  const results = opts.results ?? validationResults(record);
  const verdict = pathwayVerdict(pathway, answers, subDomain, results, record.stage);

  return {
    schema_version: REPORT_VERSION,
    generated_at: now,
    framework: FRAMEWORK,
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
  const provo = opts.provo ?? effectiveProvo(record);
  const provoResult = validateProvo(provo);
  const results = opts.results ?? validationResults(record, { croissant });

  // Degrees of machine-actionability per artifact. `opts.shacl` is threaded
  // through when the user has run Deep validate, so a report downloaded after
  // that pass records the SHACL verdict rather than "not run".
  const ladder = artifactDegrees({
    croissant,
    croissantResult,
    provo,
    provoResult,
    shacl: opts.shacl,
  });

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
    framework: FRAMEWORK,
    pathway,
    sub_domain: subDomain ?? null,
    croissant: {
      valid: croissantResult.valid,
      loadable: croissantResult.loadable,
      errors: croissantResult.errors,
      warnings: croissantResult.warnings,
    },
    ladder: {
      // The rungs and their certifying checks travel with the report, so a
      // consumer reads the verdict without holding the paper.
      degrees: DEGREES,
      croissant: ladder.croissant,
      provo: ladder.provo,
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
