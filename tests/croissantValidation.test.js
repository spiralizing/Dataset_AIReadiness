// Unit tests for Croissant validation (structural + referential). Run: npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { validateCroissant } from '../src/lib/croissantValidation.js';
import {
  generateCroissant,
  CROISSANT_CONTEXT,
  CROISSANT_CONFORMS_TO,
} from '../src/generators/croissant.js';

// A minimal complete, loadable descriptor.
const goodDescriptor = () => ({
  '@context': CROISSANT_CONTEXT,
  '@type': 'sc:Dataset',
  conformsTo: CROISSANT_CONFORMS_TO,
  name: 'example-dataset',
  description: 'A dataset.',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  url: 'https://example.org/ds',
  version: '1.0.0',
  distribution: [
    { '@type': 'cr:FileObject', '@id': 'data.parquet', encodingFormat: 'application/vnd.apache.parquet' },
  ],
  recordSet: [
    {
      '@type': 'cr:RecordSet',
      '@id': 'records',
      field: [
        {
          '@type': 'cr:Field',
          '@id': 'records/id',
          dataType: 'sc:Integer',
          source: { fileObject: { '@id': 'data.parquet' } },
        },
      ],
    },
  ],
});

test('a generated scaffold is not valid (name/distribution/recordSet incomplete)', () => {
  const res = validateCroissant(generateCroissant({ pathway: 'A', answers: {} }));
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => /name is required/.test(e)));
});

test('a complete descriptor is valid and loadable', () => {
  const res = validateCroissant(goodDescriptor());
  assert.equal(res.valid, true, res.errors.join('; '));
  assert.equal(res.loadable, true);
});

test('referential integrity: field source must resolve to a declared distribution', () => {
  const d = goodDescriptor();
  d.recordSet[0].field[0].source.fileObject['@id'] = 'missing.parquet';
  const res = validateCroissant(d);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => /undeclared distribution/.test(e)));
});

test('duplicate @id is a hard error', () => {
  const d = goodDescriptor();
  d.recordSet[0]['@id'] = 'data.parquet'; // collides with the FileObject id
  const res = validateCroissant(d);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => /duplicate @id/.test(e)));
});

test('valid-but-not-loadable: metadata-only descriptor passes with warnings', () => {
  const d = goodDescriptor();
  d.distribution = [];
  d.recordSet = [];
  const res = validateCroissant(d);
  assert.equal(res.valid, true); // no hard errors — mlcroissant would accept metadata
  assert.equal(res.loadable, false); // but not directly loadable
  assert.ok(res.warnings.some((w) => /distribution is empty/.test(w)));
});

test('wrong conformsTo and @type are hard errors', () => {
  const res = validateCroissant({ '@context': {}, '@type': 'sc:Thing', conformsTo: 'x', name: 'n' });
  assert.ok(res.errors.some((e) => /@type must be/.test(e)));
  assert.ok(res.errors.some((e) => /conformsTo must be/.test(e)));
});
