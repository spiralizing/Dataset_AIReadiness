// Validation wiring: maps each automated criterion that has an offline
// validator to its check, and produces a per-criterion results map that the
// verdict logic consumes. The 8 criteria here are the Phase-2 Core set; the
// five PROV/lineage automated criteria have no validator yet (they need the
// PROV-O generator, Phase 4) and fall back to the claimed check via
// isCriterionSatisfied.

import { effectiveCroissant } from '../generators/croissant.js';
import { effectiveProvo } from '../generators/provo.js';
import { validateCroissant } from './croissantValidation.js';
import { validateProvo } from './provoValidation.js';
import { isPersistentId, isWellFormedUri, isSpdxLicense, isOpenFormat } from './grounding.js';

// Each check: (ctx) => { ok, message }. ctx = { value(id), croissant, croissantResult }.
const CHECKS = {
  'fairness.l1.persistent_id': (ctx) => isPersistentId(ctx.value('fairness.l1.persistent_id')),
  'fairness.l1.landing_page': (ctx) => isWellFormedUri(ctx.value('fairness.l1.landing_page')),
  'fairness.l1.license_explicit': (ctx) => isSpdxLicense(ctx.value('fairness.l1.license_explicit')),
  'sustainability.l1.open_format': (ctx) => isOpenFormat(ctx.value('sustainability.l1.open_format')),
  'computability.l1.loadable_standard_env': (ctx) => {
    const fmt = ctx.value('sustainability.l1.open_format');
    const r = isOpenFormat(fmt);
    return r.ok
      ? { ok: true, message: `Loadable (${fmt}).` }
      : { ok: false, message: 'No recognised open format declared (see Sustainability → open format).' };
  },
  'fairness.l2.croissant_descriptor': (ctx) =>
    ctx.croissantResult.valid
      ? { ok: true, message: 'Croissant descriptor validates.' }
      : { ok: false, message: ctx.croissantResult.errors[0] ?? 'Croissant descriptor is invalid.' },
  'computability.l3.direct_ml_load': (ctx) =>
    ctx.croissantResult.loadable
      ? { ok: true, message: 'Croissant descriptor is directly loadable.' }
      : { ok: false, message: 'Not directly loadable (descriptor needs distribution + record-set fields).' },
  'fairness.l3.responsible_ai_annotations': (ctx) => {
    const hasRai = Object.keys(ctx.croissant).some(
      (k) => k.startsWith('rai:') && String(ctx.croissant[k]).trim() !== '',
    );
    return hasRai
      ? { ok: true, message: 'Responsible-AI annotations present.' }
      : { ok: false, message: 'No Responsible-AI annotations in the Croissant descriptor.' };
  },
  // --- PROV-O structural checks (Phase 3; read the PROV-O record) ---
  'provenance.l3.prov_record_present': (ctx) =>
    ctx.provoResult.valid
      ? { ok: true, message: 'PROV-O record is well-formed.' }
      : { ok: false, message: ctx.provoResult.errors[0] ?? 'PROV-O record is invalid.' },
  'provenance.l3.entity_per_variable': (ctx) =>
    ctx.provoResult.variableEntityCount > 0
      ? { ok: true, message: `${ctx.provoResult.variableEntityCount} variable entit(y/ies).` }
      : { ok: false, message: 'No variable-level entities in the PROV-O record.' },
  'provenance.l3.activity_per_step': (ctx) =>
    ctx.provoResult.activityCount > 0
      ? { ok: true, message: 'Activity records parameters/software.' }
      : { ok: false, message: 'No activity records parameters/software.' },
  'provenance.l3.agents_with_roles': (ctx) =>
    ctx.provoResult.agentWithRoleCount > 0
      ? { ok: true, message: 'Agent(s) carry a role.' }
      : { ok: false, message: 'No agent carries a role (declare a stakeholder role).' },
  'explainability.l3.feature_lineage_intact': (ctx) =>
    ctx.provoResult.derivationIntact
      ? { ok: true, message: 'Every variable entity has a wasDerivedFrom edge.' }
      : { ok: false, message: 'Variable entities lack complete wasDerivedFrom lineage.' },
};

// Automated criteria that actually have an offline validator (the rest fall back
// to the claimed check and should be labelled "validator pending" in the UI).
export const AUTOMATED_WITH_VALIDATOR = new Set(Object.keys(CHECKS));

// Compute the validation results map for a record. `opts.croissant` lets the
// caller pass a user-edited descriptor; otherwise it is generated from answers.
export function validationResults(record, opts = {}) {
  const answers = record.answers ?? {};
  const value = (id) => answers[id]?.value;
  const croissant = opts.croissant ?? effectiveCroissant(record);
  const croissantResult = validateCroissant(croissant);
  const provo = opts.provo ?? effectiveProvo(record);
  const provoResult = validateProvo(provo);
  const ctx = { value, croissant, croissantResult, provo, provoResult };

  const results = {};
  for (const [id, fn] of Object.entries(CHECKS)) results[id] = fn(ctx);
  return results;
}
