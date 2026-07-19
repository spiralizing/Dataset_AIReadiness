// Helpers to build worked-example assessment records that are correct by
// construction: every required criterion for the pathway gets a value that
// satisfies its check, plus a loadable Croissant and a provenance model so the
// descriptor-driven checks pass too. Examples then override a few fields for
// realism (or drop one to demonstrate a gap).

import vocabularies from '../schema/vocabularies.json';
import { requiredCriteria } from '../lib/pathway.js';
import { CROISSANT_CONTEXT, CROISSANT_CONFORMS_TO } from '../generators/croissant.js';

const RECORD_VERSION = 'assessment_record_v0';
const firstVocab = (key) => vocabularies.vocabularies[key]?.values?.[0]?.id ?? 'custom';

function sampleValue(c) {
  switch (c.evidence_type) {
    case 'boolean':
      return true;
    case 'identifier':
      return '10.5281/zenodo.1234567'; // valid DOI form (satisfies grounding)
    case 'uri':
      return 'https://example.org/dataset';
    case 'file':
      return 'evidence.pdf';
    case 'controlled_vocabulary':
      return firstVocab(c.vocabulary_key);
    default:
      return `Documented for the ${c.dimension} dimension.`;
  }
}

export function loadableCroissant({ name, description = '', license, url }) {
  return {
    '@context': CROISSANT_CONTEXT,
    '@type': 'sc:Dataset',
    conformsTo: CROISSANT_CONFORMS_TO,
    name,
    description,
    license: license ?? 'https://creativecommons.org/licenses/by/4.0/',
    url: url ?? 'https://example.org/dataset',
    version: '1.0.0',
    'rai:dataUseCases': 'Research use; not for clinical decision-making.',
    'rai:dataLimitations': 'Known selection effects — see the characterization record.',
    distribution: [
      {
        '@type': 'cr:FileObject',
        '@id': 'data.parquet',
        name: 'data.parquet',
        contentUrl: `${url ?? 'https://example.org/dataset'}/data.parquet`,
        encodingFormat: 'application/vnd.apache.parquet',
        sha256: '0'.repeat(64),
      },
    ],
    recordSet: [
      {
        '@type': 'cr:RecordSet',
        '@id': 'records',
        name: 'records',
        field: [
          {
            '@type': 'cr:Field',
            '@id': 'records/id',
            name: 'id',
            dataType: 'sc:Integer',
            source: { fileObject: { '@id': 'data.parquet' }, extract: { column: 'id' } },
          },
        ],
      },
    ],
  };
}

export function provModel({ sourceName = 'Raw source', outputName = 'derived variable' } = {}) {
  return {
    sources: [{ id: 'src1', name: sourceName }],
    steps: [
      {
        id: 'st1',
        label: 'Curation',
        inputs: ['src1'],
        outputs: [{ id: 'o1', name: outputName }],
        software: 'python 3.11',
        agentRole: 'data_steward',
      },
    ],
  };
}

// Build a fully-satisfying record for a pathway, with optional answer overrides
// and `drop` (criterion ids to leave unmet — to demonstrate a gap).
export function completeRecord({ pathway, subDomain = null, stage = 'upgrade', dataset, answers = {}, drop = [] }) {
  const base = {};
  for (const c of requiredCriteria(pathway, subDomain)) base[c.id] = { value: sampleValue(c) };

  const overrides = Object.fromEntries(
    Object.entries(answers).map(([k, v]) => [k, typeof v === 'object' && v !== null ? v : { value: v }]),
  );
  const merged = { ...base, ...overrides };
  for (const id of drop) delete merged[id];

  return {
    schema_version: RECORD_VERSION,
    stage,
    pathway,
    sub_domain: subDomain,
    started_at: null,
    dataset: {
      name: dataset.name,
      description: dataset.description ?? '',
      version: dataset.version ?? '1.0.0',
    },
    answers: merged,
    croissant: loadableCroissant(dataset),
    provo: null,
    provenance: provModel({ sourceName: dataset.sourceName, outputName: dataset.outputName }),
  };
}
