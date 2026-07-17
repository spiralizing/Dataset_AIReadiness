// Unit tests for the PID/format grounding predicates. Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  isDoi,
  isArk,
  isPersistentId,
  isOrcid,
  isRor,
  isSpdxLicense,
  isOpenFormat,
  isWellFormedUri,
} from '../src/lib/grounding.js';

test('isDoi accepts bare and URL forms, rejects non-DOIs', () => {
  assert.ok(isDoi('10.5281/zenodo.123').ok);
  assert.ok(isDoi('https://doi.org/10.1038/s41597-022-01712-9').ok);
  assert.ok(!isDoi('zenodo.123').ok);
  assert.ok(!isDoi('').ok);
});

test('isArk and isPersistentId', () => {
  assert.ok(isArk('ark:/12345/abcde').ok);
  assert.ok(isPersistentId('10.5281/zenodo.123').ok);
  assert.ok(isPersistentId('ark:/12345/x').ok);
  assert.ok(!isPersistentId('not-an-id').ok);
});

test('isOrcid validates the MOD 11-2 checksum', () => {
  assert.ok(isOrcid('0000-0002-1825-0097').ok); // canonical valid example
  assert.ok(isOrcid('https://orcid.org/0000-0002-1825-0097').ok);
  assert.ok(!isOrcid('0000-0002-1825-0098').ok); // wrong check digit
  assert.ok(!isOrcid('0000-0002-1825').ok); // malformed
});

test('isRor syntax check', () => {
  assert.ok(isRor('https://ror.org/042nb2s44').ok); // MIT
  assert.ok(!isRor('https://ror.org/xyz').ok);
  assert.ok(!isRor('042nb2s44').ok);
});

test('isSpdxLicense checks the bundled vocabulary', () => {
  assert.ok(isSpdxLicense('CC-BY-4.0').ok);
  assert.ok(isSpdxLicense('MIT').ok);
  assert.ok(!isSpdxLicense('Made-up-1.0').ok);
});

test('isOpenFormat checks the bundled format vocabularies', () => {
  assert.ok(isOpenFormat('Parquet').ok);
  assert.ok(!isOpenFormat('DOCX').ok);
});

test('isWellFormedUri', () => {
  assert.ok(isWellFormedUri('https://example.org/dataset').ok);
  assert.ok(!isWellFormedUri('not a uri').ok);
});
