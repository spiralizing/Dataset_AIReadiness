// Unit tests for the collection guide. The property that matters most is that
// the worksheet is derived from the schema and scales with the pathway — a
// hand-maintained guide would drift, and the whole point is that it cannot.
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  buildCollectionGuide,
  generateCollectionGuide,
  whatToRecord,
  hasCollectionHint,
  citationHref,
  captureKind,
} from '../src/generators/collectionGuide.js';
import { requiredCriteria, ALL_CRITERIA, subDomains } from '../src/lib/pathway.js';

const FIXED = '2026-08-07T00:00:00Z';
const rec = (pathway, subDomain = null, extra = {}) => ({
  pathway,
  sub_domain: subDomain,
  stage: 'plan',
  dataset: { name: 'alpha_quartz_xrd' },
  answers: {},
  ...extra,
});

test('the worksheet scales with the pathway and covers every required criterion', () => {
  const count = (r) => buildCollectionGuide(r, { now: FIXED }).meta.total;
  const a = count(rec('A'));
  const b = count(rec('B'));
  const c = count(rec('C', 'general'));

  assert.equal(a, requiredCriteria('A', null).length);
  assert.equal(b, requiredCriteria('B', null).length);
  assert.equal(c, requiredCriteria('C', 'general').length);
  assert.ok(a < b && b < c, `expected A < B < C, got ${a}/${b}/${c}`);

  // Nothing is silently dropped: every required criterion lands in exactly one group.
  const g = buildCollectionGuide(rec('C', 'materials'), { now: FIXED });
  const ids = g.groups.flatMap((x) => x.rows.map((r) => r.id));
  assert.equal(new Set(ids).size, ids.length, 'a criterion appears in two stage groups');
  assert.deepEqual(
    [...ids].sort(),
    requiredCriteria('C', 'materials').map((c2) => c2.id).sort(),
  );
});

test('a sub-domain overlay extends the guide with no code change', () => {
  const general = buildCollectionGuide(rec('C', 'general'), { now: FIXED });
  const materials = buildCollectionGuide(rec('C', 'materials'), { now: FIXED });
  assert.equal(materials.meta.total, general.meta.total + 6);

  const ids = materials.groups.flatMap((g) => g.rows.map((r) => r.id));
  assert.ok(ids.includes('provenance.l3.materials.apriori_capture'));
  // And the overlay's own hint is what the worksheet shows.
  const row = materials.groups
    .flatMap((g) => g.rows)
    .find((r) => r.id === 'provenance.l3.materials.apriori_capture');
  assert.match(row.record, /engine that writes the graph/);
});

test('rows are grouped by lifecycle stage, in the order the work happens', () => {
  const g = buildCollectionGuide(rec('C', 'materials'), { now: FIXED });
  const order = g.groups.map((x) => x.stage);
  const expected = ['acquisition', 'curation', 'documentation', 'governance', 'release'];
  assert.deepEqual(order, expected.filter((s) => order.includes(s)));

  // The acquisition group is the one that matters: unrecoverable once the run ends.
  const acq = g.groups.find((x) => x.stage === 'acquisition');
  const acqIds = acq.rows.map((r) => r.id);
  assert.ok(acqIds.includes('characterization.l3.materials.acquisition_parameters'));
  assert.ok(acqIds.includes('provenance.l3.materials.apriori_capture'));
});

test('every L3 criterion and overlay carries a collection hint', () => {
  // L3 first was the deliberate scope; this locks it so a new L3 criterion cannot
  // be added without one.
  for (const c of ALL_CRITERIA.filter((x) => x.level === 'L3')) {
    assert.ok(hasCollectionHint(c), `${c.id} has no collection_hint`);
  }
  for (const sub of subDomains()) {
    for (const o of sub.overlay) {
      assert.ok(hasCollectionHint(o), `overlay ${o.id} has no collection_hint`);
    }
  }
});

test('no row borrows remediation text; each declares a capture moment or its absence', () => {
  // The regression this replaces: whatToRecord used to fall back to `remediation`
  // for 32 of 72 criteria, printing reviewer-voice text ("Mint a DOI … before
  // publishing") in a worksheet about what to write down beforehand. Both halves of
  // the invariant matter — that every row says something, and that what it says was
  // written for this document.
  for (const c of ALL_CRITERIA) {
    assert.notEqual(
      captureKind(c),
      'fallback',
      `${c.id} declares neither collection_hint nor no_capture, so the guide borrows its remediation`,
    );
    assert.notEqual(whatToRecord(c), c.remediation, `${c.id} is showing remediation text`);
  }

  // A criterion assigned by the repository at deposit says so, rather than being
  // given a capture instruction it cannot honour.
  const pid = ALL_CRITERIA.find((c) => c.id === 'fairness.l1.persistent_id');
  assert.equal(captureKind(pid), 'none');
  assert.match(whatToRecord(pid), /Assigned by the repository at deposit/);

  // And every rendered row still has something to say.
  const g = buildCollectionGuide(rec('A'), { now: FIXED });
  for (const row of g.groups.flatMap((x) => x.rows)) {
    assert.ok(row.record.length > 0, `${row.id} has nothing to record`);
    assert.ok(['record', 'none'].includes(row.recordKind), `${row.id}: ${row.recordKind}`);
  }
});

test('answered criteria are marked as recorded', () => {
  const answered = rec('C', 'general', {
    answers: { 'characterization.l3.scope_declared': { value: 'Phase identification.' } },
  });
  const g = buildCollectionGuide(answered, { now: FIXED });
  const row = g.groups.flatMap((x) => x.rows).find((r) => r.id === 'characterization.l3.scope_declared');
  assert.equal(row.satisfied, true);
  assert.ok(g.meta.recorded > 0);
});

test('the ontology section applies at L3 only', () => {
  assert.equal(buildCollectionGuide(rec('A'), { now: FIXED }).ontology.applies, false);
  assert.equal(buildCollectionGuide(rec('B'), { now: FIXED }).ontology.applies, false);
  assert.equal(buildCollectionGuide(rec('C', 'general'), { now: FIXED }).ontology.applies, true);

  const md = generateCollectionGuide(rec('C', 'general'), { now: FIXED });
  assert.ok(md.includes('Binding terms to shared vocabularies'));
  assert.ok(!generateCollectionGuide(rec('A'), { now: FIXED }).includes('Binding terms'));
});

test('the Markdown carries the ladder, the questions, the log, and the burden list', () => {
  const md = generateCollectionGuide(rec('C', 'materials'), { now: FIXED });
  for (const needle of [
    '# What to collect — alpha_quartz_xrd',
    'From notes to machine-actionable',
    'Paper notebook',
    'Electronic lab notebook',
    'Structured capture',
    'standards optional',
    'standards are the point',
    'Semi-automated and automated laboratories',
    'Still out of reach',
    '## The six questions',
    '| **who** |',
    '## Per-run log',
    '## Worksheet',
    'While collecting or running',
    'Making this less burdensome',
    'Let the workflow engine write it',
  ]) {
    assert.ok(md.includes(needle), `missing from the guide: ${needle}`);
  }
  // Worksheet rows are checkboxes. Note a few can already be ticked with no
  // answers at all: the generated PROV-O scaffold contains a curation activity,
  // so provenance.l3.activity_per_step validates on its own. The guide reports
  // what the tool actually knows, not what the user has typed.
  assert.ok(md.includes('- [ ] **'));
  const g = buildCollectionGuide(rec('C', 'materials'), { now: FIXED });
  assert.ok(g.meta.recorded < g.meta.total, 'an empty record cannot be fully recorded');
  const manual = g.groups
    .flatMap((x) => x.rows)
    .find((r) => r.id === 'characterization.l3.materials.acquisition_parameters');
  assert.equal(manual.satisfied, false);
});

test('the guide carries the same layer-inputs mapping the intro card renders', () => {
  // Both read guidance.documentation_inputs. A second copy would drift, which is
  // why the content sits in schema rather than inline in the component.
  const g = buildCollectionGuide(rec('C', 'materials'), { now: FIXED });
  assert.equal(g.documentationInputs.layers.length, 3);
  assert.deepEqual(
    g.documentationInputs.layers.map((l) => l.layer),
    ['Datasheet / data card', 'Croissant descriptor', 'PROV-O record'],
  );
  assert.ok(g.documentationInputs.grounding.schemes.includes('ORCID'));

  const md = generateCollectionGuide(rec('C', 'materials'), { now: FIXED });
  assert.ok(md.includes('## What builds each layer'));
  assert.ok(md.includes('**PROV-O record** is built from:'));
  assert.ok(md.includes('Run log or ELN entries'));
  assert.ok(md.includes('**Grounded by:**'));
});

test('the ladder has the four forms the preprint figure shows, with the ELN distinct', () => {
  // fig:capture-ladder in the paper separates a paper notebook from an ELN, and
  // an ELN from structured capture. The app collapsed the first two until now;
  // this locks the two artifacts to the same model.
  const g = buildCollectionGuide(rec('C', 'materials'), { now: FIXED });
  assert.deepEqual(
    g.ladder.map((r) => r.rung),
    ['Paper notebook', 'Electronic lab notebook', 'Structured capture', 'Machine-actionable'],
  );
  // Only the first form is reached without an intervention.
  assert.equal(g.ladder[0].via, null);
  for (const r of g.ladder.slice(1)) assert.ok(r.via && r.via.length > 0, `${r.rung} has no via`);
  // Every form carries an icon and states what it still withholds.
  for (const r of g.ladder) {
    assert.ok(r.icon && r.icon.length > 0, `${r.rung} has no icon`);
    assert.ok(r.gains && r.out_of_reach, `${r.rung} is missing gains/out_of_reach`);
  }
  // The automation shortcut, absent from the app before this.
  assert.match(g.automation.text, /real time/);
  assert.match(g.automation.examples, /AiiDA/);
});

test('the level legend explains the tags, and derives cumulative membership', () => {
  // The worksheet tags rows L1/L2/L3; without a legend those labels are unexplained.
  const g = buildCollectionGuide(rec('C', 'materials'), { now: FIXED });
  assert.deepEqual(g.levels.rows.map((l) => l.id), ['L1', 'L2', 'L3']);
  // Structure comes from the matrix, not restated here.
  assert.deepEqual(
    g.levels.rows.map((l) => [l.name, l.drl_band]),
    [['Accessible', 'C'], ['Faithful', 'B'], ['Task-ready', 'A']],
  );
  // Membership is derived from the pathway ladder, matching the cumulative rule
  // matrix.test.js enforces: L1 -> A,B,C; L2 -> B,C; L3 -> C.
  assert.deepEqual(g.levels.rows.map((l) => l.requiredIn), [['A', 'B', 'C'], ['B', 'C'], ['C']]);
  for (const l of g.levels.rows) assert.ok(l.meaning.length > 20, `${l.id} has no explanation`);

  const md = generateCollectionGuide(rec('C', 'materials'), { now: FIXED });
  assert.ok(md.includes('| Level | Name | DRL band | Required in | What it is for |'));
  assert.ok(md.includes('| **L3** | Task-ready | A | C |'));
});

test('the guide carries its sources, resolved and de-duplicated', () => {
  const g = buildCollectionGuide(rec('C', 'materials'), { now: FIXED });
  assert.ok(g.sources.length >= 8, `only ${g.sources.length} sources resolved`);
  assert.equal(new Set(g.sources.map((c) => c.key)).size, g.sources.length, 'duplicate sources');
  for (const c of g.sources) {
    assert.ok(c.authors && c.title && c.venue, `${c.key} is missing citation fields`);
    assert.ok(citationHref(c), `${c.key} has neither a DOI nor a URL`);
  }
  // Every key cited by a section appears in the consolidated list.
  const keys = new Set(g.sources.map((c) => c.key));
  for (const c of [...g.ladderRefs, ...g.whQuestionsRefs, ...g.documentationInputs.refs,
                   ...g.burden.flatMap((b) => b.refs)]) {
    assert.ok(keys.has(c.key), `${c.key} cited inline but absent from Sources`);
  }

  const md = generateCollectionGuide(rec('C', 'materials'), { now: FIXED });
  assert.ok(md.includes('## Sources'));
  assert.ok(md.includes('Kanza, S. et al. (2017)'), 'ELN source missing');
  assert.ok(md.includes('https://doi.org/10.3233/DS-210053'), 'RO-Crate DOI missing');
  assert.ok(md.includes('_Sources: '), 'no inline attribution');
});
