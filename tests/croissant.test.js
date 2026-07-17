// Unit tests for the Croissant generator. Validation tests come with 2.3.
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { generateCroissant, CROISSANT_CONFORMS_TO } from '../src/generators/croissant.js';

test('generateCroissant emits a Croissant 1.0 scaffold with context and conformsTo', () => {
  const desc = generateCroissant({ pathway: 'A', answers: {} });
  assert.equal(desc['@type'], 'sc:Dataset');
  assert.equal(desc.conformsTo, CROISSANT_CONFORMS_TO);
  assert.ok(desc['@context'] && desc['@context'].cr, 'context with cr prefix present');
  // Uncollected fields left empty so validation can flag them.
  assert.equal(desc.name, '');
  assert.deepEqual(desc.distribution, []);
  assert.deepEqual(desc.recordSet, []);
});

test('generateCroissant maps license to its URL and derives url/citeAs from answers', () => {
  const desc = generateCroissant({
    pathway: 'A',
    answers: {
      'fairness.l1.license_explicit': { value: 'CC-BY-4.0' },
      'fairness.l1.persistent_id': { value: '10.5281/zenodo.123' },
    },
  });
  assert.match(desc.license, /creativecommons\.org\/licenses\/by\/4\.0/);
  assert.equal(desc.url, 'https://doi.org/10.5281/zenodo.123');
  assert.equal(desc.citeAs, '10.5281/zenodo.123');
});

test('landing page takes precedence over DOI for url', () => {
  const desc = generateCroissant({
    pathway: 'A',
    answers: {
      'fairness.l1.landing_page': { value: 'https://example.org/ds' },
      'fairness.l1.persistent_id': { value: '10.5281/zenodo.123' },
    },
  });
  assert.equal(desc.url, 'https://example.org/ds');
});

test('Pathway C scaffolds Responsible-AI annotations from answers', () => {
  const desc = generateCroissant({
    pathway: 'C',
    sub_domain: 'general',
    answers: {
      'characterization.l3.scope_declared': { value: 'Intended for X; not for clinical decisions.' },
      'characterization.l3.limitations_declared': { value: 'Selection bias in cohort.' },
    },
  });
  assert.equal(desc['rai:dataUseCases'], 'Intended for X; not for clinical decisions.');
  assert.equal(desc['rai:dataLimitations'], 'Selection bias in cohort.');
});

test('Pathway A does not add rai annotations', () => {
  const desc = generateCroissant({ pathway: 'A', answers: {} });
  assert.ok(!Object.keys(desc).some((k) => k.startsWith('rai:')));
});
