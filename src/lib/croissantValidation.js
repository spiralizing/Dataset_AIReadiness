// Croissant validation — a sound, offline subset of the reference `mlcroissant`
// checks. "Sound subset" means: hard errors are things mlcroissant would also
// reject, so a descriptor that passes here is never falsely rejected relative to
// mlcroissant. Recommended-but-accepted issues are reported as warnings, not
// errors. Authoritative validation (Pyodide-loaded `mlcroissant`) is deferred.
//
// Implemented in plain JS (no zod/ajv dependency) since the emitted subset is
// small; the { valid, errors, warnings, loadable } interface is stable, so a
// schema library can be swapped in later without changing callers.

import { CROISSANT_CONFORMS_TO } from '../generators/croissant.js';

const isNonEmpty = (v) => typeof v === 'string' && v.trim() !== '';

export function validateCroissant(desc) {
  const errors = [];
  const warnings = [];

  if (!desc || typeof desc !== 'object') {
    return { valid: false, errors: ['Descriptor is not an object.'], warnings: [], loadable: false };
  }

  // --- hard structural checks (mlcroissant would also fail these) ---
  if (!desc['@context'] || typeof desc['@context'] !== 'object') errors.push('Missing @context.');
  if (desc['@type'] !== 'sc:Dataset') errors.push('@type must be "sc:Dataset".');
  if (desc.conformsTo !== CROISSANT_CONFORMS_TO) {
    errors.push(`conformsTo must be "${CROISSANT_CONFORMS_TO}".`);
  }
  if (!isNonEmpty(desc.name)) errors.push('name is required and must be non-empty.');

  // --- recommended (warnings, not rejections) ---
  if (!isNonEmpty(desc.description)) warnings.push('description is recommended.');
  if (!isNonEmpty(desc.license)) warnings.push('license is recommended.');
  if (!isNonEmpty(desc.url)) warnings.push('url is recommended.');

  const distribution = Array.isArray(desc.distribution) ? desc.distribution : [];
  const recordSet = Array.isArray(desc.recordSet) ? desc.recordSet : [];
  if (distribution.length === 0) warnings.push('distribution is empty (no files declared).');
  if (recordSet.length === 0) warnings.push('recordSet is empty (no record sets declared).');

  // --- referential integrity (hard) ---
  const ids = [];
  const distIds = new Set();
  for (const d of distribution) {
    if (isNonEmpty(d?.['@id'])) {
      ids.push(d['@id']);
      distIds.add(d['@id']);
    } else {
      errors.push('A distribution entry is missing @id.');
    }
    if (!isNonEmpty(d?.encodingFormat)) {
      warnings.push(`distribution ${d?.['@id'] ?? '(no id)'} is missing encodingFormat.`);
    }
  }
  for (const rs of recordSet) {
    if (isNonEmpty(rs?.['@id'])) ids.push(rs['@id']);
    else errors.push('A recordSet entry is missing @id.');
    const fields = Array.isArray(rs?.field) ? rs.field : [];
    if (fields.length === 0) warnings.push(`recordSet ${rs?.['@id'] ?? '(no id)'} has no fields.`);
    for (const f of fields) {
      if (isNonEmpty(f?.['@id'])) ids.push(f['@id']);
      else errors.push(`A field in recordSet ${rs?.['@id'] ?? '(no id)'} is missing @id.`);
      const srcId = f?.source?.fileObject?.['@id'];
      if (srcId !== undefined && !distIds.has(srcId)) {
        errors.push(
          `field ${f?.['@id'] ?? '(no id)'} source references undeclared distribution "${srcId}".`,
        );
      }
    }
  }

  const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dupes.length) errors.push(`duplicate @id(s): ${dupes.join(', ')}.`);

  const valid = errors.length === 0;
  const loadable =
    valid &&
    distribution.length > 0 &&
    recordSet.some((rs) => Array.isArray(rs.field) && rs.field.length > 0);

  return { valid, errors, warnings, loadable };
}
