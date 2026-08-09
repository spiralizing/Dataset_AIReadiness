// Collection guide — what to write down, and when, so the assessment and its
// artifacts are fillable later. The complement of todo.js: that one lists what is
// still *unmet*, this one lists what has to be *observed*, including for criteria
// already answered.
//
// Two design choices worth stating:
//
//   * Schema-driven. The worksheet walks requiredCriteria(pathway, subDomain), so
//     adding a criterion or a sub-domain overlay extends the guide with no edit
//     here. A hand-written guide would drift within one release.
//
//   * Grouped by lifecycle_stage, not by dimension. A collection guide is read in
//     the order the work happens — what to capture while acquiring, while curating,
//     at deposit — and a dimension is a property of the criterion, not of the
//     moment you can still act on it. The dimension travels along as a tag.
//
// `collection_hint` is the observation to record; `remediation` is how to close a
// gap. Criteria without a hint (L1/L2 at present) fall back to remediation, so the
// guide is complete from day one and improves as hints are written.

import { getPathway, requiredCriteria, isCriterionSatisfied, LEVELS, PATHWAYS } from '../lib/pathway.js';
import { getStage } from '../lib/stages.js';
import { validationResults } from '../lib/validation.js';
import { citeThisWorkShort } from '../lib/thisWork.js';
import guidance from '../schema/guidance.json';

// Which pathways require a given level. A pathway requires every level up to and
// including its own, so this is derived from the ladder rather than restated:
// L1 -> A,B,C; L2 -> B,C; L3 -> C. Same cumulative rule matrix.test.js enforces.
const LEVEL_ORDER = ['L1', 'L2', 'L3'];
const pathwaysRequiring = (levelId) =>
  PATHWAYS.filter((p) => LEVEL_ORDER.indexOf(p.level) >= LEVEL_ORDER.indexOf(levelId)).map((p) => p.id);

// The legend for the level tags on worksheet rows. Structure (id, name, DRL band)
// comes from the matrix; the sentence explaining each comes from guidance.json.
const levelLegend = () =>
  LEVELS.map((l) => ({
    ...l,
    meaning: guidance.levels.meaning[l.id],
    requiredIn: pathwaysRequiring(l.id),
  }));

// Order the work actually happens in.
const STAGE_ORDER = ['acquisition', 'curation', 'documentation', 'governance', 'release'];

const STAGE_TITLES = {
  acquisition: 'While collecting or running',
  curation: 'While cleaning, transforming, or de-identifying',
  documentation: 'While writing it up',
  governance: 'Before you commit to an access arrangement',
  release: 'At deposit',
};

const STAGE_NOTES = {
  acquisition:
    'The only rows that become unrecoverable. Everything here describes a moment that will not come back — once the run is over, the instrument settings, the operator, and the consent wording either were written down or were not.',
  curation:
    'Each transformation is invisible in the released file unless recorded as it is applied.',
  documentation: 'Always actionable, including long after publication.',
  governance:
    'Decide these early even though you can revisit them: consent wording and repository choice constrain each other.',
  release: 'Assigned or fixed at deposit; nothing to capture beforehand beyond the intent.',
};

// What to write down for a criterion: the collection hint when one exists, else
// the remediation text as a serviceable stand-in.
export const whatToRecord = (criterion) =>
  criterion?.collection_hint ?? criterion?.remediation ?? '';

export const hasCollectionHint = (criterion) => Boolean(criterion?.collection_hint);

// The vocabulary or format constraint on an answer, where the schema declares one.
const constraintFor = (criterion) => {
  if (criterion.evidence_type === 'controlled_vocabulary') {
    return `choose from a controlled list (${criterion.vocabulary_key ?? 'scoped to your pathway'})`;
  }
  if (criterion.evidence_type === 'identifier') return 'an identifier (DOI, ORCID, accession)';
  if (criterion.evidence_type === 'uri') return 'a resolvable URL';
  if (criterion.evidence_type === 'file') return 'a file or a link to one';
  if (criterion.evidence_type === 'boolean') return 'yes or no';
  return 'free text';
};

// The structured guide model. Rendering (Markdown here, print later) reads this.
export function buildCollectionGuide(record, opts = {}) {
  const { pathway, sub_domain: subDomain, stage, dataset = {}, answers = {} } = record;
  const results = opts.results ?? validationResults(record);
  const meta = getPathway(pathway);
  const stageObj = getStage(stage);

  const criteria = requiredCriteria(pathway, subDomain);
  const groups = STAGE_ORDER.map((s) => ({
    stage: s,
    title: STAGE_TITLES[s],
    note: STAGE_NOTES[s],
    rows: criteria
      .filter((c) => c.lifecycle_stage === s)
      .map((c) => ({
        id: c.id,
        label: c.label,
        dimension: c.dimension,
        level: c.level,
        record: whatToRecord(c),
        constraint: constraintFor(c),
        satisfied: isCriterionSatisfied(c, answers[c.id], results),
      })),
  })).filter((g) => g.rows.length > 0);

  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const recorded = groups.reduce((n, g) => n + g.rows.filter((r) => r.satisfied).length, 0);

  return {
    meta: {
      datasetName: dataset.name ?? '',
      pathway,
      pathwayName: meta?.name ?? '',
      level: meta?.level ?? '',
      subDomain: subDomain ?? null,
      stage: stageObj?.title ?? stage ?? null,
      generated: opts.now ?? new Date().toISOString(),
      total,
      recorded,
    },
    ladder: guidance.ladder,
    automation: guidance.automation,
    whQuestions: guidance.wh_questions,
    documentationInputs: guidance.documentation_inputs,
    levels: { lead: guidance.levels.lead, rows: levelLegend() },
    runLogFields: guidance.run_log_fields,
    // The ontology section is L3 material: below Pathway C nothing requires a
    // bound vocabulary, so it is offered as background rather than instruction.
    ontology: { applies: pathway === 'C', examples: guidance.ontology_examples },
    burden: guidance.burden_reduction,
    groups,
  };
}

export function generateCollectionGuide(record, opts = {}) {
  const g = buildCollectionGuide(record, opts);
  const L = [];
  const p = (s = '') => L.push(s);

  p(`# What to collect${g.meta.datasetName ? ` — ${g.meta.datasetName}` : ''}`);
  p();
  p(`- **Target pathway:** ${g.meta.pathway} — ${g.meta.pathwayName} (${g.meta.level})`);
  if (g.meta.subDomain) p(`- **Sub-domain:** ${g.meta.subDomain}`);
  if (g.meta.stage) p(`- **Starting point:** ${g.meta.stage}`);
  p(`- **Generated:** ${g.meta.generated}`);
  p(`- **Recorded so far:** ${g.meta.recorded} of ${g.meta.total}`);
  p();
  p('> A worksheet for the observations behind the assessment: what to write down, and when.');
  p(`> Implements the framework of ${citeThisWorkShort()}`);
  p();

  p('## From notes to machine-actionable');
  p();
  for (const r of g.ladder) {
    p(`### ${r.icon} ${r.rung} (${r.obligation})`);
    p();
    if (r.via) p(`_Reached by: ${r.via}._`);
    if (r.via) p();
    p('```');
    p(r.sample);
    p('```');
    p();
    p(`**Gains.** ${r.gains}`);
    p();
    p(`**Still out of reach.** ${r.out_of_reach}`);
    p();
    p(`**Standards.** ${r.standards}`);
    p();
  }
  p(`### ${g.automation.icon} ${g.automation.title}`);
  p();
  p(g.automation.text);
  p();
  p(`_${g.automation.examples}_`);
  p();
  p('Each form is cheap to produce while standing on the one before it. Retrofitting the one above, after the run is over, is where the cost lands.');
  p();

  p('## The six questions');
  p();
  p('| | Record | Lands in |');
  p('|---|---|---|');
  for (const w of g.whQuestions) p(`| **${w.q}** | ${w.record} | ${w.lands} |`);
  p();

  p('## What builds each layer');
  p();
  p('The records below are the raw material for the three released artifacts. Most of them already exist somewhere in a project; the work is routing them.');
  p();
  for (const l of g.documentationInputs.layers) {
    p(`**${l.layer}** is built from:`);
    p();
    for (const src of l.sources) p(`- ${src}`);
    p();
  }
  p(
    `**${g.documentationInputs.grounding.label}:** ${g.documentationInputs.grounding.schemes.join(' · ')}. ` +
      g.documentationInputs.grounding.note,
  );
  p();

  p('## Per-run log');
  p();
  p('Repeat once per run, sample, or job. Fill it as the work happens.');
  p();
  for (const f of g.runLogFields) p(`- [ ] ${f}: ______________________`);
  p();

  p('## Worksheet');
  p();
  p('Everything this pathway will ask for, in the order the work happens. Ticked rows are already recorded in the tool.');
  p();
  p(g.levels.lead);
  p();
  p('| Level | Name | DRL band | Required in | What it is for |');
  p('|---|---|---|---|---|');
  for (const l of g.levels.rows) {
    p(`| **${l.id}** | ${l.name} | ${l.drl_band} | ${l.requiredIn.join(', ')} | ${l.meaning} |`);
  }
  p();
  for (const grp of g.groups) {
    p(`### ${grp.title}`);
    p();
    p(`_${grp.note}_`);
    p();
    for (const r of grp.rows) {
      p(`- [${r.satisfied ? 'x' : ' '}] **${r.label}** _(${r.dimension} · ${r.level})_`);
      if (r.record) p(`  - ${r.record}`);
      p(`  - _Answer format: ${r.constraint}._`);
    }
    p();
  }

  if (g.ontology.applies) {
    p('## Binding terms to shared vocabularies');
    p();
    p('At L3 a field name is not enough: a consumer has to know what your column *means*, not just what you called it. Three worked examples.');
    p();
    for (const ex of g.ontology.examples) {
      p(`### ${ex.title}`);
      p();
      p(`**As collected.** \`${ex.as_collected}\``);
      p();
      p(`**The problem.** ${ex.problem}`);
      p();
      p(`**Machine-actionable.** ${ex.actionable}`);
      p();
      p(`**Why it matters.** ${ex.why}`);
      p();
    }
  }

  p('## Making this less burdensome');
  p();
  p('The first three remove the work. The rest reduce it. None of them decide what matters — that stays yours.');
  p();
  for (const b of g.burden) {
    p(`- **${b.title}** _(${b.effect} the work)_ — ${b.what}`);
    p(`  - ${b.examples}`);
  }
  p();

  return L.join('\n');
}
