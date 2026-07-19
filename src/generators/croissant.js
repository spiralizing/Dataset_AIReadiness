// Croissant 1.0 descriptor generator. Builds a JSON-LD scaffold from the
// assessment answers. Fields the readiness checklist does not collect (dataset
// name, description, file distribution, record-set fields) are left empty on
// purpose: the user completes them in the export editor, and validation
// (croissantValidation.js) gates the `fairness.l2.croissant_descriptor`
// criterion — so the criterion cannot go green from generation alone.

import vocabularies from '../schema/vocabularies.json';

export const CROISSANT_CONTEXT = {
  '@language': 'en',
  '@vocab': 'https://schema.org/',
  cr: 'http://mlcommons.org/croissant/',
  rai: 'http://mlcommons.org/croissant/RAI/',
  dct: 'http://purl.org/dc/terms/',
  sc: 'https://schema.org/',
};

export const CROISSANT_CONFORMS_TO = 'http://mlcommons.org/croissant/1.0';

const licenseUrl = (id) => {
  const v = (vocabularies.vocabularies.licenses?.values ?? []).find((x) => x.id === id);
  return v?.url ?? id; // fall back to the id when no canonical URL is bundled
};

const doiUrl = (value) => {
  const s = String(value ?? '').trim();
  return /^10\.\d{4,9}\/\S+$/.test(s) ? `https://doi.org/${s}` : s;
};

const raiFromAnswers = (a) => {
  const rai = {};
  const scope = a('characterization.l3.scope_declared');
  const limitations = a('characterization.l3.limitations_declared');
  const coverage = a('characterization.l3.coverage_analysis');
  if (scope && String(scope).trim()) rai['rai:dataUseCases'] = String(scope).trim();
  if (limitations && String(limitations).trim()) rai['rai:dataLimitations'] = String(limitations).trim();
  if (coverage && String(coverage).trim()) rai['rai:dataCollection'] = String(coverage).trim();
  return rai;
};

export function generateCroissant(record) {
  const { pathway, answers = {}, dataset = {} } = record;
  const a = (id) => answers[id]?.value;

  const license = a('fairness.l1.license_explicit');
  const persistentId = a('fairness.l1.persistent_id');
  const landing = a('fairness.l1.landing_page');

  const desc = {
    '@context': CROISSANT_CONTEXT,
    '@type': 'sc:Dataset',
    conformsTo: CROISSANT_CONFORMS_TO,
    name: (dataset.name ?? '').trim(), // from the Dataset details form on Export
    description: (dataset.description ?? '').trim(),
    version: (dataset.version ?? '').trim(),
    distribution: [], // no file list collected — user adds cr:FileObject entries
    recordSet: [], // no variable list collected — user adds cr:RecordSet fields
  };

  if (license) desc.license = licenseUrl(license);
  if (landing) desc.url = landing;
  else if (persistentId) desc.url = doiUrl(persistentId);
  if (persistentId) desc.citeAs = persistentId;

  // Pathway C scaffolds the Responsible-AI annotations from the answers.
  if (pathway === 'C') Object.assign(desc, raiFromAnswers(a));

  return desc;
}

// The descriptor to validate/export: the user-edited one if present, else the
// scaffold generated from answers.
export const effectiveCroissant = (record) =>
  record?.croissant && typeof record.croissant === 'object'
    ? record.croissant
    : generateCroissant(record);

