// Resolution against the discipline-validator registry (schema/validators.json).
//
// Until now that registry was read only by its own tests: 14 validators and three
// community registries shipped in the bundle and no user could reach any of them.
// A criterion may name the tools whose report is its evidence, via a `validators`
// array of registry ids, and this module turns those ids into something renderable.
//
// `execution` is the field that decides what the tool can promise: only
// 'in-browser' validators could ever run inside the app and mark a criterion
// automated. 'cli' and 'web-service' ones are referenced, run elsewhere, and their
// outcome recorded as attested evidence — which is why the copy for those says run
// it rather than implying the app will.
//
// Selecting a validator by the *data* rather than by the criterion (declared format
// and sub-domain → applicable tools, the lookup the paper describes in §2.5) is a
// separate matcher; the registries below are its fallback for the long tail.

import registry from '../schema/validators.json';

export const ALL_VALIDATORS = registry.validators;
export const REGISTRIES = registry.registries;

const BY_ID = new Map(registry.validators.map((v) => [v.id, v]));

export const getValidator = (id) => BY_ID.get(id) ?? null;

// The validators a criterion names, resolved and in declared order. Unknown ids are
// dropped rather than rendered as a dead chip; matrix.test.js fails the build if one
// is ever introduced, so this is belt-and-braces for a hand-edited schema.
export const validatorsFor = (criterion) =>
  (criterion?.validators ?? []).map(getValidator).filter(Boolean);

// How the user is expected to obtain the report, phrased for each execution mode.
export const EXECUTION_NOTE = {
  'in-browser': 'runs in the app',
  cli: 'run locally',
  'web-service': 'hosted service',
};

export const executionNote = (validator) =>
  EXECUTION_NOTE[validator?.execution] ?? validator?.execution ?? '';
