// Schema-validity tests for the AI-readiness matrix and pathways.
// Run with:  npm test   (vitest run)
//
// Ported to vitest: the test runner comes from 'vitest'; assertions stay on
// node:assert/strict so the logic is byte-identical to the pre-scaffold version.

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(__dirname, '..', 'src', 'schema');

const loadJson = async (name) =>
  JSON.parse(await readFile(join(schemaDir, name), 'utf8'));

const matrix = await loadJson('matrix.json');
const pathways = await loadJson('pathways.json');
const vocabularies = await loadJson('vocabularies.json');
const references = await loadJson('references.json');
const validators = await loadJson('validators.json');

const VALID_PATHWAYS = new Set(['A', 'B', 'C']);
const VALID_LEVELS = new Set(['L1', 'L2', 'L3']);
const VALID_EVIDENCE_TYPES = new Set([
  'boolean',
  'text',
  'uri',
  'identifier',
  'file',
  'controlled_vocabulary',
]);
const VALID_VERIFICATION = new Set(['automated', 'attested', 'manual']);
const VALID_LIFECYCLE_STAGE = new Set([
  'acquisition',
  'curation',
  'documentation',
  'governance',
  'release',
]);
const REQUIRED_DIMENSIONS = [
  'FAIRness',
  'Provenance',
  'Characterization',
  'Ethics',
  'Pre-model Explainability',
  'Sustainability',
  'Computability',
];

const cumulativeExpected = (level) => {
  if (level === 'L1') return ['A', 'B', 'C'];
  if (level === 'L2') return ['B', 'C'];
  if (level === 'L3') return ['C'];
  throw new Error(`unknown level ${level}`);
};

test('matrix declares the seven Bridge2AI dimensions and three levels', () => {
  assert.deepEqual(matrix.dimensions, REQUIRED_DIMENSIONS);
  assert.deepEqual(
    matrix.levels.map((l) => l.id),
    ['L1', 'L2', 'L3'],
  );
});

test('every dimension × level cell has at least one criterion', () => {
  const seen = new Set();
  for (const c of matrix.criteria) {
    seen.add(`${c.dimension}::${c.level}`);
  }
  for (const dim of REQUIRED_DIMENSIONS) {
    for (const lvl of ['L1', 'L2', 'L3']) {
      assert.ok(
        seen.has(`${dim}::${lvl}`),
        `missing criterion for cell ${dim} / ${lvl}`,
      );
    }
  }
});

test('every criterion has a unique id', () => {
  const ids = matrix.criteria.map((c) => c.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dupes, [], `duplicate criterion ids: ${dupes.join(', ')}`);
});

test('criterion ids follow the dimension.level.slug convention', () => {
  for (const c of matrix.criteria) {
    assert.match(
      c.id,
      /^[a-z_]+\.l[123]\.[a-z0-9_]+$/,
      `criterion id ${c.id} does not match dimension.level.slug`,
    );
  }
});

test('every criterion declares a known dimension, level, and evidence_type', () => {
  for (const c of matrix.criteria) {
    assert.ok(
      REQUIRED_DIMENSIONS.includes(c.dimension),
      `unknown dimension on ${c.id}: ${c.dimension}`,
    );
    assert.ok(VALID_LEVELS.has(c.level), `unknown level on ${c.id}: ${c.level}`);
    assert.ok(
      VALID_EVIDENCE_TYPES.has(c.evidence_type),
      `unknown evidence_type on ${c.id}: ${c.evidence_type}`,
    );
  }
});

test('every criterion declares a valid verification mode', () => {
  for (const c of matrix.criteria) {
    assert.ok(
      VALID_VERIFICATION.has(c.verification),
      `${c.id} has invalid or missing verification mode: ${c.verification}`,
    );
  }
});

test('every criterion declares a valid lifecycle_stage', () => {
  for (const c of matrix.criteria) {
    assert.ok(
      VALID_LIFECYCLE_STAGE.has(c.lifecycle_stage),
      `${c.id} has invalid or missing lifecycle_stage: ${c.lifecycle_stage}`,
    );
  }
});

test('Ethics criteria are never automated (ethics adequacy is human-judged)', () => {
  for (const c of matrix.criteria) {
    if (c.dimension !== 'Ethics') continue;
    assert.notEqual(
      c.verification,
      'automated',
      `${c.id} is an Ethics criterion marked automated; ethics must be attested or manual`,
    );
  }
});

test('every required_in_pathways list contains only A, B, or C', () => {
  for (const c of matrix.criteria) {
    assert.ok(Array.isArray(c.required_in_pathways), `${c.id} missing required_in_pathways`);
    for (const p of c.required_in_pathways) {
      assert.ok(VALID_PATHWAYS.has(p), `${c.id} required_in_pathways has invalid value ${p}`);
    }
  }
});

test('cumulative semantics: L1→ABC, L2→BC, L3→C', () => {
  for (const c of matrix.criteria) {
    const expected = cumulativeExpected(c.level);
    assert.deepEqual(
      [...c.required_in_pathways].sort(),
      expected,
      `${c.id} (level ${c.level}) should be required in ${expected.join(',')} but is required in ${c.required_in_pathways.join(',')}`,
    );
  }
});

test('recommended_in_pathways (when present) only contains valid pathways and never overlaps required_in_pathways', () => {
  for (const c of matrix.criteria) {
    if (!c.recommended_in_pathways) continue;
    for (const p of c.recommended_in_pathways) {
      assert.ok(VALID_PATHWAYS.has(p), `${c.id} recommended_in_pathways has invalid value ${p}`);
      assert.ok(
        !c.required_in_pathways.includes(p),
        `${c.id} marks pathway ${p} both required and recommended`,
      );
    }
  }
});

test('controlled_vocabulary criteria reference an existing vocabulary_key', () => {
  for (const c of matrix.criteria) {
    if (c.evidence_type !== 'controlled_vocabulary') continue;
    assert.ok(c.vocabulary_key, `${c.id} is controlled_vocabulary but has no vocabulary_key`);
    assert.ok(
      Object.prototype.hasOwnProperty.call(vocabularies.vocabularies, c.vocabulary_key),
      `${c.id} references unknown vocabulary_key ${c.vocabulary_key}`,
    );
  }
});

test('vocabulary_scope, when present, names a supported resolver', () => {
  // A criterion may defer its option list to the pathway / sub-domain instead of
  // its static vocabulary_key. Only one resolver exists today; a typo here would
  // silently fall back to the static key, which is the bug this guards.
  const SUPPORTED = new Set(['deposition_targets']);
  for (const c of matrix.criteria) {
    if (c.vocabulary_scope === undefined) continue;
    assert.ok(
      SUPPORTED.has(c.vocabulary_scope),
      `${c.id} declares unsupported vocabulary_scope ${c.vocabulary_scope}`,
    );
    assert.equal(
      c.evidence_type,
      'controlled_vocabulary',
      `${c.id} declares vocabulary_scope but is not a controlled_vocabulary criterion`,
    );
  }
});

test('sub-domain deposition_targets_filter ids resolve in some repositories_* vocabulary', () => {
  const repoIds = new Set(
    Object.entries(vocabularies.vocabularies)
      .filter(([k]) => k.startsWith('repositories_'))
      .flatMap(([, v]) => v.values.map((x) => x.id)),
  );
  const c = pathways.pathways.find((p) => p.id === 'C');
  for (const sub of c.sub_domains) {
    for (const id of sub.deposition_targets_filter ?? []) {
      assert.ok(
        repoIds.has(id),
        `sub-domain ${sub.id} filter names ${id}, which is in no repositories_* vocabulary`,
      );
    }
  }
});

test('every references[] citation key resolves in references.json', () => {
  const known = new Set(Object.keys(references.citations));
  for (const c of matrix.criteria) {
    assert.ok(Array.isArray(c.references) && c.references.length > 0, `${c.id} has no references`);
    for (const r of c.references) {
      assert.ok(known.has(r), `${c.id} cites unknown reference ${r}`);
    }
  }
});

test('every criterion has a non-empty label and remediation', () => {
  for (const c of matrix.criteria) {
    assert.ok(typeof c.label === 'string' && c.label.length > 0, `${c.id} missing label`);
    assert.ok(
      typeof c.remediation === 'string' && c.remediation.length > 0,
      `${c.id} missing remediation`,
    );
  }
});

test('pathways A/B/C are declared with the expected level mapping', () => {
  const byId = Object.fromEntries(pathways.pathways.map((p) => [p.id, p]));
  assert.equal(byId.A?.level, 'L1');
  assert.equal(byId.B?.level, 'L2');
  assert.equal(byId.C?.level, 'L3');
  assert.equal(byId.A?.drl_band, 'C');
  assert.equal(byId.B?.drl_band, 'B');
  assert.equal(byId.C?.drl_band, 'A');
});

test('pathway deposition_targets_vocabulary keys resolve in vocabularies.json', () => {
  for (const p of pathways.pathways) {
    if (!p.deposition_targets_vocabulary) continue;
    assert.ok(
      Object.prototype.hasOwnProperty.call(vocabularies.vocabularies, p.deposition_targets_vocabulary),
      `pathway ${p.id} references unknown vocabulary ${p.deposition_targets_vocabulary}`,
    );
  }
});

test('Pathway C declares seven sub-domains including the resolved set', () => {
  const c = pathways.pathways.find((p) => p.id === 'C');
  assert.ok(c, 'Pathway C missing');
  assert.equal(c.sub_domains.length, 7, 'expected exactly seven Pathway C sub-domains');
  const ids = c.sub_domains.map((s) => s.id).sort();
  assert.deepEqual(
    ids,
    ['clinical', 'general', 'genomic', 'institutional', 'materials', 'salutogenesis', 'voice'],
    `unexpected sub-domain set: ${ids.join(', ')}`,
  );
  assert.ok(
    ids.includes(c.default_sub_domain),
    `default_sub_domain ${c.default_sub_domain} not in sub-domain list`,
  );
});

test('Pathway C overlays sit at L3, in a known dimension, and resolve their vocabulary and citations', () => {
  const c = pathways.pathways.find((p) => p.id === 'C');
  for (const sub of c.sub_domains) {
    assert.ok(Array.isArray(sub.overlay), `sub-domain ${sub.id} has no overlay array`);
    for (const o of sub.overlay) {
      assert.ok(
        REQUIRED_DIMENSIONS.includes(o.dimension),
        `overlay ${o.id} (sub-domain ${sub.id}) declares unknown dimension ${o.dimension}`,
      );
      assert.equal(o.level, 'L3', `overlay ${o.id} (sub-domain ${sub.id}) is not L3`);
      // Overlays declare a lifecycle stage like every matrix criterion, so the
      // stage-aware locked/upcoming logic treats them the same way. Uniform
      // across all sub-domains: a locked badge appearing under one discipline
      // and not another would read as a bug rather than a statement.
      assert.ok(
        VALID_LIFECYCLE_STAGE.has(o.lifecycle_stage),
        `overlay ${o.id} has invalid or missing lifecycle_stage: ${o.lifecycle_stage}`,
      );
      assert.deepEqual(o.required_in_pathways, ['C'], `overlay ${o.id} should be required only in Pathway C`);
      assert.ok(VALID_EVIDENCE_TYPES.has(o.evidence_type), `overlay ${o.id} evidence_type invalid`);
      if (o.verification !== undefined) {
        assert.ok(
          VALID_VERIFICATION.has(o.verification),
          `overlay ${o.id} has invalid verification mode: ${o.verification}`,
        );
      }
      // Same invariant as the matrix: ethics adequacy is human-judged, never automated.
      if (o.dimension === 'Ethics') {
        assert.notEqual(o.verification, 'automated', `overlay ${o.id} is an Ethics criterion marked automated`);
      }
      assert.ok(
        typeof o.label === 'string' && o.label.length > 0 &&
          typeof o.remediation === 'string' && o.remediation.length > 0,
        `overlay ${o.id} missing label or remediation`,
      );
      if (o.evidence_type === 'controlled_vocabulary') {
        assert.ok(
          Object.prototype.hasOwnProperty.call(vocabularies.vocabularies, o.vocabulary_key),
          `overlay ${o.id} references unknown vocabulary ${o.vocabulary_key}`,
        );
      }
      for (const r of o.references ?? []) {
        assert.ok(
          Object.prototype.hasOwnProperty.call(references.citations, r),
          `overlay ${o.id} cites unknown reference ${r}`,
        );
      }
    }
  }
});

test('sub-domain deposition_targets_vocabulary keys resolve in vocabularies.json', () => {
  const c = pathways.pathways.find((p) => p.id === 'C');
  for (const sub of c.sub_domains) {
    if (!sub.deposition_targets_vocabulary) continue;
    assert.ok(
      Object.prototype.hasOwnProperty.call(vocabularies.vocabularies, sub.deposition_targets_vocabulary),
      `sub-domain ${sub.id} references unknown vocabulary ${sub.deposition_targets_vocabulary}`,
    );
  }
});

test('Pathway C overlay ids are unique across all sub-domains and do not collide with matrix criterion ids', () => {
  const matrixIds = new Set(matrix.criteria.map((c) => c.id));
  const c = pathways.pathways.find((p) => p.id === 'C');
  const seen = new Set();
  for (const sub of c.sub_domains) {
    for (const o of sub.overlay) {
      assert.ok(!seen.has(o.id), `duplicate overlay id ${o.id}`);
      seen.add(o.id);
      assert.ok(!matrixIds.has(o.id), `overlay id ${o.id} collides with a matrix criterion id`);
    }
  }
});

test('format vocabularies pair mime with ext, and declare plausible media types', () => {
  const formatKeys = Object.keys(vocabularies.vocabularies).filter((k) => k.startsWith('formats_'));
  assert.ok(formatKeys.length > 0, 'no formats_* vocabularies found');
  for (const key of formatKeys) {
    for (const v of vocabularies.vocabularies[key].values) {
      const hasMime = v.mime !== undefined;
      const hasExt = v.ext !== undefined;
      // Either both facets are present (used together to seed a Croissant
      // distribution entry) or neither — e.g. a BIDS directory has no single
      // media type, so it declares nothing rather than half a pair.
      assert.equal(
        hasMime,
        hasExt,
        `${key}/${v.id} declares only one of mime/ext; they are used together`,
      );
      if (hasMime) {
        assert.match(v.mime, /^[a-z]+\/[a-zA-Z0-9.+-]+$/, `${key}/${v.id} mime is not a media type`);
        assert.match(v.ext, /^[a-z0-9.]+$/, `${key}/${v.id} ext is not a bare extension`);
      }
    }
  }
});

test('vocabulary entries each have a non-empty values array', () => {
  for (const [key, vocab] of Object.entries(vocabularies.vocabularies)) {
    assert.ok(Array.isArray(vocab.values) && vocab.values.length > 0, `vocabulary ${key} has no values`);
    const ids = vocab.values.map((v) => v.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(dupes, [], `vocabulary ${key} has duplicate ids: ${dupes.join(', ')}`);
  }
});

test('label_overrides target real criteria and only reword them', () => {
  const ids = new Set(matrix.criteria.map((c) => c.id));
  const c = pathways.pathways.find((p) => p.id === 'C');
  const REWORDABLE = new Set(['label', 'remediation']);
  for (const sub of c.sub_domains) {
    for (const [id, patch] of Object.entries(sub.label_overrides ?? {})) {
      assert.ok(ids.has(id), `sub-domain ${sub.id} overrides unknown criterion ${id}`);
      for (const key of Object.keys(patch)) {
        // Rewording only: an override must never change evidence_type,
        // required_in_pathways, verification, or anything else that would make a
        // criterion mean something different under one sub-domain.
        assert.ok(REWORDABLE.has(key), `sub-domain ${sub.id} override of ${id} changes ${key}`);
        assert.ok(typeof patch[key] === 'string' && patch[key].length > 0, `${id}.${key} is empty`);
      }
    }
  }
});

test('all five schema files carry the same version (they move in lockstep)', () => {
  // Versions diverged once (three files at 0.2.0, two at 0.1.0) and it made
  // "which schema is this record written against?" unanswerable. One version for
  // the set; 1.0.0 is cut when the criterion ids are considered stable.
  const versions = [matrix, pathways, vocabularies, references, validators].map((f) => f.version);
  assert.equal(new Set(versions).size, 1, `schema versions have diverged: ${versions.join(', ')}`);
  assert.match(versions[0], /^\d+\.\d+\.\d+$/);
});
