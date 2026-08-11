// Wizard step 4 — export. One tab per release-bundle document; each tab shows an
// editable/previewable view with its own Download button. Datasheet/healthsheet,
// Croissant (with dataset-name field), PROV-O (builder + SHACL), assessment
// report, conformance report, and (for Plan/Prepare) a to-do action plan.

import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAssessment } from '../state/assessment.jsx';
import { templateForRecord } from '../lib/pathway.js';
import { generateDatasheet } from '../generators/datasheet.js';
import { generateTodo } from '../generators/todo.js';
import {
  effectiveCroissant,
  withTemplateEntries,
  declaredMime,
  CROISSANT_CONTEXT,
  CROISSANT_CONFORMS_TO,
} from '../generators/croissant.js';
import { effectiveProvo } from '../generators/provo.js';
import { validateCroissant } from '../lib/croissantValidation.js';
import { validateProvo } from '../lib/provoValidation.js';
import { validationResults } from '../lib/validation.js';
import { buildAssessmentReport, buildConformanceReport } from '../lib/report.js';
import { validateProvoShacl, serializeReport, provoToTurtle } from '../lib/shacl.js';
import { DEGREES, croissantDegrees, provoDegrees, getDegree } from '../lib/actionability.js';
import { generateCollectionGuide } from '../generators/collectionGuide.js';
import { download, guideFilename } from '../lib/download.js';
import CroissantBuilder from '../components/CroissantBuilder.jsx';
import ProvenanceBuilder from '../components/ProvenanceBuilder.jsx';

const EXAMPLE_CROISSANT = {
  '@context': CROISSANT_CONTEXT,
  '@type': 'sc:Dataset',
  conformsTo: CROISSANT_CONFORMS_TO,
  name: 'example-tabular-dataset',
  description: 'A small placeholder tabular dataset, shown as a template to adapt.',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  url: 'https://example.org/datasets/example',
  citeAs: '10.5281/zenodo.0000000',
  version: '1.0.0',
  distribution: [
    {
      '@type': 'cr:FileObject',
      '@id': 'data.parquet',
      name: 'data.parquet',
      contentUrl: 'https://example.org/datasets/example/data.parquet',
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

const tryParse = (text) => {
  try {
    return { value: JSON.parse(text), error: null };
  } catch (e) {
    return { value: null, error: e.message };
  }
};

const DownloadBtn = ({ onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-none bg-brand-btn px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
  >
    {children}
  </button>
);

// The actionability ladder for one artifact: five rungs, each with the check that
// certifies it. Rendered as a row so the distance between "it parses" and "a tool
// can act on it" is visible at a glance — the point of the ladder. `executable` is
// always out-of-scope here, and is shown greyed rather than hidden, because a
// reader needs to know it was not checked rather than assume it passed.
const DEGREE_TONE = {
  pass: 'border-ok-line bg-ok-bg text-ok',
  fail: 'border-warn-line bg-warn-bg text-warn',
  'out-of-scope': 'border-dashed border-line bg-surface-2 text-faint',
};
const DEGREE_MARK = { pass: '✓', fail: '×', 'out-of-scope': '–' };

const DegreeLadder = ({ degrees, artifact }) => {
  const attained = degrees.attained ? getDegree(degrees.attained)?.label : null;
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
          Machine-actionability
        </span>
        <span className="text-xs text-muted">
          {attained ? (
            <>
              {artifact} reaches <span className="font-medium text-ink">{attained}</span>
            </>
          ) : (
            <span className="text-warn">{artifact} is not yet well-formed</span>
          )}
        </span>
      </div>
      <ol className="mt-2 flex flex-wrap gap-1.5">
        {DEGREES.map((d) => {
          const r = degrees[d.id];
          return (
            <li
              key={d.id}
              title={`${d.check} — ${r.message}`}
              className={`border px-2 py-1 text-[0.7rem] ${DEGREE_TONE[r.status]}`}
            >
              <span aria-hidden="true">{DEGREE_MARK[r.status]}</span> {d.label}
            </li>
          );
        })}
      </ol>
      <ul className="mt-2 space-y-0.5 text-xs text-muted">
        {DEGREES.filter((d) => degrees[d.id].status !== 'pass').map((d) => (
          <li key={d.id}>
            <span className="font-medium text-ink">{d.label}:</span> {degrees[d.id].message}
          </li>
        ))}
      </ul>
    </div>
  );
};

const editorClass = 'mt-2 w-full rounded-none border border-line p-3 font-mono text-xs';
const previewClass = 'mt-2 max-h-[28rem] overflow-auto rounded-none border border-line bg-surface-2 p-3 font-mono text-xs whitespace-pre-wrap';

export default function ExportPage() {
  const { state, dispatch } = useAssessment();
  const navigate = useNavigate();

  // `?tab=croissant` opens a specific document directly, so criteria elsewhere in
  // the wizard can link to the artifact that completes them instead of telling
  // the user to go and find it.
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') ?? 'datasheet');
  const [datasheet, setDatasheet] = useState(() => (state.pathway ? generateDatasheet(state) : ''));
  const [todo, setTodo] = useState(() => (state.pathway ? generateTodo(state) : ''));
  const [croissantOverrideText, setCroissantOverrideText] = useState(() =>
    state.pathway ? JSON.stringify(effectiveCroissant(state), null, 2) : '',
  );
  const [overrideText, setOverrideText] = useState(() =>
    state.pathway ? JSON.stringify(effectiveProvo(state), null, 2) : '',
  );
  const [rdfFormat, setRdfFormat] = useState('jsonld');
  const [shacl, setShacl] = useState(null);

  if (!state.pathway) return <Navigate to="/" replace />;

  // The descriptor is generated from answers unless a raw override is set, which
  // only an explicit "Edit raw" action does. Before this, the editor mirrored
  // itself into state on every keystroke, so the override was always on and
  // nothing generated could ever take effect.
  const croissantOverride = Boolean(state.croissant);
  const croissantDoc = effectiveCroissant(state);
  const croissantJson = JSON.stringify(croissantDoc, null, 2);
  // While overriding, validate what is actually in the editor (so a syntax error
  // is visible); otherwise validate the generated descriptor.
  const croissantParse = croissantOverride
    ? tryParse(croissantOverrideText)
    : { value: croissantDoc, error: null };
  const croissantResult = croissantParse.value
    ? validateCroissant(croissantParse.value, { expectedMime: declaredMime(state) })
    : null;

  const provoDoc = effectiveProvo(state);
  const provoResult = validateProvo(provoDoc);
  const provoJson = JSON.stringify(provoDoc, null, 2);
  const overrideActive = Boolean(state.provo);

  // Ladder positions for both machine-actionable artifacts. The PROV ladder folds
  // in the SHACL report once Deep validate has run, so the referential rung moves
  // from "not certified" to conforming (or fails) in place.
  const croissantLadder = croissantDegrees(croissantParse.value, croissantResult, {
    parseError: croissantParse.error,
  });
  const provoLadder = provoDegrees(provoDoc, provoResult, {
    shacl: shacl && !shacl.loading && !shacl.error ? shacl : undefined,
  });

  const template = templateForRecord(state);
  const datasheetName = template === 'healthsheet' ? 'healthsheet.md' : 'datasheet.md';
  const rdfExt = rdfFormat === 'turtle' ? 'ttl' : 'jsonld';
  const rdfMime = rdfFormat === 'turtle' ? 'text/turtle' : 'application/ld+json';
  const showProvenance = state.pathway === 'B' || state.pathway === 'C';
  const showTodo = state.stage === 'plan' || state.stage === 'prepare';

  const bundleOpts = () => {
    const croissant = effectiveCroissant(state);
    return {
      results: validationResults(state, { croissant, provo: provoDoc }),
      croissant,
      provo: provoDoc,
      // Present only after Deep validate, so a report generated before it records
      // the referential rung as uncertified rather than claiming conformance.
      shacl: shacl && !shacl.loading && !shacl.error ? shacl : undefined,
    };
  };

  // Dataset details feed generateCroissant, so no descriptor write is needed —
  // except while a raw override is active, where the derived path is bypassed and
  // the name the user just typed would otherwise never reach the descriptor.
  const setDatasetField = (patch) => {
    dispatch({ type: 'SET_DATASET', dataset: patch });
    if (croissantOverride && patch.name !== undefined) {
      const next = { ...state.croissant, name: patch.name };
      dispatch({ type: 'SET_CROISSANT', croissant: next });
      setCroissantOverrideText(JSON.stringify(next, null, 2));
    }
  };

  // Take over the descriptor by hand, starting from whatever is current.
  const startCroissantOverride = (from = croissantDoc) => {
    dispatch({ type: 'SET_CROISSANT', croissant: from });
    setCroissantOverrideText(JSON.stringify(from, null, 2));
  };

  // Hand back to the generated descriptor. Destructive while hand-authored files
  // or record sets exist, so confirm in that case.
  const clearCroissantOverride = () => {
    const desc = state.croissant;
    const hasHandwork =
      (Array.isArray(desc?.distribution) && desc.distribution.length > 0) ||
      (Array.isArray(desc?.recordSet) && desc.recordSet.length > 0);
    if (hasHandwork) {
      const ok = window.confirm(
        'Discard your raw edits?\n\nThe descriptor returns to the one generated from your assessment answers, and the files and record sets you added here are lost.',
      );
      if (!ok) return;
    }
    dispatch({ type: 'SET_CROISSANT', croissant: null });
    setCroissantOverrideText(croissantJson);
  };

  // Add one cr:FileObject + one cr:RecordSet, seeded from the declared format (so
  // a materials record gets CIF, not Parquet). Additive — the name, license, DOI,
  // and RAI annotations derived from the answers are preserved. Since these live
  // in the descriptor rather than the answers, adding them takes over the
  // descriptor by hand; tier 2 moves this onto the builder model instead.
  const insertTemplate = () => {
    const base = croissantParse.value ?? croissantDoc;
    startCroissantOverride(withTemplateEntries(base, state));
  };

  // Save the whole assessment record to a file so it can be resumed or shared.
  // (The exported document tabs above are derived artifacts; this is the source.)
  const exportAssessment = () => {
    const slug =
      (state.dataset?.name ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'assessment';
    download(`${slug}-ai-readiness.json`, JSON.stringify(state, null, 2), 'application/json');
  };

  // Clear everything and begin a fresh documentation. Confirm first: this wipes
  // answers, dataset details, and any Croissant/PROV-O edits (and localStorage).
  const startNew = () => {
    const ok = window.confirm(
      'Start a new dataset documentation?\n\nThis clears all current answers, the dataset details, and any Croissant or PROV-O edits. This cannot be undone.',
    );
    if (!ok) return;
    dispatch({ type: 'RESET' });
    navigate('/');
  };

  const downloadProvo = async () => {
    if (rdfFormat === 'turtle') download('prov.ttl', await provoToTurtle(provoDoc), 'text/turtle');
    else download('prov.jsonld', provoJson, 'application/ld+json');
  };

  const runDeepValidate = async () => {
    setShacl({ loading: true });
    try {
      setShacl({ loading: false, ...(await validateProvoShacl(provoDoc)) });
    } catch (e) {
      setShacl({ loading: false, error: e.message });
    }
  };

  const downloadShaclReport = async () => {
    if (!shacl?.dataset) return;
    download(`conformance-report.${rdfExt}`, await serializeReport(shacl.dataset, rdfFormat), rdfMime);
  };

  const TABS = [
    { id: 'datasheet', label: datasheetName },
    { id: 'croissant', label: 'croissant.json' },
    ...(showProvenance ? [{ id: 'provo', label: 'provenance' }] : []),
    { id: 'report', label: 'assessment-report.json' },
    { id: 'conformance', label: 'conformance-report.json' },
    ...(showTodo ? [{ id: 'todo', label: 'todo.md' }] : []),
  ];
  const active = TABS.some((t) => t.id === tab) ? tab : 'datasheet';

  const tabClass = (id) =>
    `-mb-px whitespace-nowrap border-b-2 pb-2 text-sm transition-colors ${
      active === id ? 'border-accent font-medium text-ink' : 'border-transparent text-muted hover:text-ink'
    }`;

  return (
    <section>
      <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
        Step 4 · Release bundle
      </span>
      <h2 className="mt-1 text-xl font-semibold">Export</h2>
      <p className="mt-2 text-sm text-muted">
        Open a document to review and edit it, then download. Reports reflect your current answers
        and validation.
      </p>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={tabClass(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {/* Datasheet / healthsheet */}
        {active === 'datasheet' && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{datasheetName}</h3>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setDatasheet(generateDatasheet(state))} className="text-xs text-muted underline">
                  Regenerate
                </button>
                <DownloadBtn onClick={() => download(datasheetName, datasheet, 'text/markdown')}>
                  Download
                </DownloadBtn>
              </div>
            </div>
            <textarea value={datasheet} onChange={(e) => setDatasheet(e.target.value)} rows={20} className={editorClass} spellCheck={false} />
          </div>
        )}

        {/* Croissant */}
        {active === 'croissant' && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">croissant.json</h3>
              <DownloadBtn onClick={() => download('croissant.json', croissantJson, 'application/ld+json')}>
                Download
              </DownloadBtn>
            </div>

            {/* Dataset details — the name field lives here */}
            <div className="mt-3 border border-line bg-surface-2 p-3">
              <p className="text-xs text-muted">
                Dataset details populate the descriptor. A{' '}
                <span className="font-medium text-ink">name</span> is required for it to validate.
                {croissantOverride && (
                  <>
                    {' '}
                    While you are editing the descriptor by hand, only the name is carried across —
                    clear the raw edits below to have every field applied again.
                  </>
                )}
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-muted">
                  Name
                  <input
                    value={state.dataset?.name ?? ''}
                    onChange={(e) => setDatasetField({ name: e.target.value })}
                    placeholder="e.g. VA fracture-risk cohort"
                    className="mt-1 w-full rounded-none border border-line bg-surface px-2 py-1 text-sm text-ink"
                  />
                </label>
                <label className="text-xs text-muted">
                  Version
                  <input
                    value={state.dataset?.version ?? ''}
                    onChange={(e) => setDatasetField({ version: e.target.value })}
                    placeholder="e.g. 1.0.0"
                    className="mt-1 w-full rounded-none border border-line bg-surface px-2 py-1 text-sm text-ink"
                  />
                </label>
                <label className="text-xs text-muted sm:col-span-2">
                  Description
                  <textarea
                    value={state.dataset?.description ?? ''}
                    onChange={(e) => setDatasetField({ description: e.target.value })}
                    rows={2}
                    placeholder="One or two sentences describing the dataset."
                    className="mt-1 w-full rounded-none border border-line bg-surface px-2 py-1 text-sm text-ink"
                  />
                </label>
              </div>
            </div>

            {/* The builder owns distribution + recordSet. A raw override bypasses
                the generator entirely, so it would silently ignore the builder —
                say so rather than showing a form that does nothing. */}
            {croissantOverride ? (
              <p className="mt-4 border border-warn-line bg-warn-bg p-3 text-xs text-warn">
                You are editing the descriptor by hand, so the file and column builder is inactive.
                Discard the raw edits below to use it again.
              </p>
            ) : (
              <CroissantBuilder />
            )}

            <DegreeLadder degrees={croissantLadder} artifact="This descriptor" />

            {/* Validator output — errors, warnings, and what "directly loadable"
                is still missing. Sits directly under the builder so the effect of
                a change is visible without opening the raw descriptor. */}
            <div className="mt-3 text-xs">
              {!croissantResult ? (
                <p className="text-bad">
                  {croissantParse.error
                    ? `Invalid JSON: ${croissantParse.error}`
                    : 'The descriptor is empty — it must be a JSON object.'}
                </p>
              ) : (
                <>
                  <p className={croissantResult.valid ? 'text-ok' : 'text-bad'}>
                    {croissantResult.valid
                      ? croissantResult.loadable
                        ? '✓ Valid and directly loadable.'
                        : '✓ Valid — metadata only; declare files and fields to make it directly loadable.'
                      : `× Not valid: ${croissantResult.errors.length} problem(s) to fix.`}
                  </p>

                  {croissantResult.errors.length > 0 && (
                    <ul className="mt-1 list-inside list-disc text-bad">
                      {croissantResult.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}

                  {croissantResult.warnings.length > 0 && (
                    <>
                      <p className="mt-2 font-medium text-warn">
                        Recommended, but not blocking validity:
                      </p>
                      <ul className="mt-1 list-inside list-disc text-warn">
                        {croissantResult.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  {croissantResult.valid && !croissantResult.loadable && (
                    <p className="mt-2 text-muted">
                      <span className="font-medium text-ink">Directly loadable</span> needs at least
                      one{' '}
                      {croissantOverride ? (
                        <>
                          <code className="font-mono">distribution</code> entry and one{' '}
                          <code className="font-mono">recordSet</code> carrying at least one{' '}
                          <code className="font-mono">field</code>
                        </>
                      ) : (
                        'file, and one record set with at least one column, in the builder above'
                      )}
                      . This is what the{' '}
                      <span className="font-mono">computability.l3.direct_ml_load</span> criterion
                      checks.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* The raw descriptor. Secondary now that the builder writes it, so it
                is collapsed by default — except while overriding, when it is the
                editor rather than a preview. */}
            <details className="mt-4 border border-line bg-surface p-3" open={croissantOverride}>
              <summary className="cursor-pointer text-xs font-semibold text-ink">
                Descriptor (raw JSON-LD){' '}
                <span className="font-normal text-faint">
                  {croissantOverride ? '· edited by hand' : '· generated from your answers'}
                </span>
              </summary>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[0.7rem] text-muted">
                  {croissantOverride
                    ? 'Your edits are the descriptor now; the builder and the dataset details no longer regenerate it.'
                    : 'Rebuilt from your answers and the builder as you go. Editing by hand takes it over — reversible at any time.'}
                </p>
                <div className="flex shrink-0 gap-3">
                  {/* Only offered while overriding — otherwise the builder's own
                      "Start from a template" is the right entry point. */}
                  {croissantOverride ? (
                    <>
                      <button type="button" onClick={insertTemplate} className="text-xs text-muted underline">
                        Insert a template file + record set
                      </button>
                      <button type="button" onClick={clearCroissantOverride} className="text-xs text-bad underline">
                        Discard raw edits
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startCroissantOverride()}
                      className="text-xs text-muted underline"
                    >
                      Edit by hand
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={croissantOverride ? croissantOverrideText : croissantJson}
                readOnly={!croissantOverride}
                onChange={(e) => {
                  setCroissantOverrideText(e.target.value);
                  const p = tryParse(e.target.value);
                  if (p.value && typeof p.value === 'object') {
                    dispatch({ type: 'SET_CROISSANT', croissant: p.value });
                  }
                }}
                rows={16}
                className={editorClass}
                spellCheck={false}
              />

              {/* Key-level reference, for reading or hand-editing the JSON. Kept
                  here rather than beside the builder: the builder explains itself
                  in its own terms, this explains the serialization. */}
              <details className="mt-3 border border-line bg-surface-2 p-3">
                <summary className="cursor-pointer text-xs font-medium text-ink">
                  What the builder writes into <code className="font-mono">distribution</code> and{' '}
                  <code className="font-mono">recordSet</code>
                </summary>
              <dl className="mt-3 space-y-3 text-xs">
                <div>
                  <dt className="font-medium text-ink">
                    <code className="font-mono">distribution[]</code> — one{' '}
                    <code className="font-mono">cr:FileObject</code> per file you ship
                  </dt>
                  <dd className="mt-1 text-muted">
                    <code className="font-mono">@id</code> (a stable string — this is what fields
                    point at) · <code className="font-mono">name</code> ·{' '}
                    <code className="font-mono">contentUrl</code> (where the file resolves) ·{' '}
                    <code className="font-mono">encodingFormat</code> (media type, e.g.{' '}
                    <code className="font-mono">text/csv</code>,{' '}
                    <code className="font-mono">application/x-hdf5</code>,{' '}
                    <code className="font-mono">chemical/x-cif</code>) ·{' '}
                    <code className="font-mono">sha256</code> (optional but recommended — lets a
                    consumer verify integrity)
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-ink">
                    <code className="font-mono">recordSet[]</code> — one{' '}
                    <code className="font-mono">cr:RecordSet</code> per table or collection
                  </dt>
                  <dd className="mt-1 text-muted">
                    <code className="font-mono">@id</code> ·{' '}
                    <code className="font-mono">name</code> ·{' '}
                    <code className="font-mono">field[]</code> (the columns)
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-ink">
                    <code className="font-mono">field[]</code> — one{' '}
                    <code className="font-mono">cr:Field</code> per column or variable
                  </dt>
                  <dd className="mt-1 text-muted">
                    <code className="font-mono">@id</code> (convention:{' '}
                    <code className="font-mono">recordset/field</code>) ·{' '}
                    <code className="font-mono">name</code> ·{' '}
                    <code className="font-mono">dataType</code> (
                    <code className="font-mono">sc:Text</code>,{' '}
                    <code className="font-mono">sc:Integer</code>,{' '}
                    <code className="font-mono">sc:Float</code>,{' '}
                    <code className="font-mono">sc:Boolean</code>,{' '}
                    <code className="font-mono">sc:Date</code>) ·{' '}
                    <code className="font-mono">source.fileObject.@id</code> plus{' '}
                    <code className="font-mono">source.extract.column</code> (which file, which
                    column)
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted">
                <span className="font-medium text-ink">The rule people trip on:</span> a field&apos;s{' '}
                <code className="font-mono">source.fileObject.@id</code> must match the{' '}
                <code className="font-mono">@id</code> of a declared distribution entry, and no two{' '}
                <code className="font-mono">@id</code>s anywhere may repeat. The builder cannot break
                either one — it derives every <code className="font-mono">@id</code> and offers only
                declared files — but hand-edits can, so both are checked.
              </p>
              <p className="mt-2 text-xs text-muted">
                Reference:{' '}
                <a
                  href="https://docs.mlcommons.org/croissant/docs/croissant-spec.html"
                  target="_blank"
                  rel="noreferrer"
                  className="text-link underline"
                >
                  Croissant 1.0 specification
                </a>{' '}
                ·{' '}
                <a
                  href="https://github.com/mlcommons/croissant"
                  target="_blank"
                  rel="noreferrer"
                  className="text-link underline"
                >
                  MLCommons Croissant tooling
                </a>
              </p>
              </details>

              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted">
                  See a complete example descriptor (read-only)
                </summary>
                <pre className={previewClass}>{JSON.stringify(EXAMPLE_CROISSANT, null, 2)}</pre>
              </details>
            </details>
          </div>
        )}

        {/* Provenance */}
        {active === 'provo' && showProvenance && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Provenance (PROV-O)</h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted">
                  RDF format
                  <select value={rdfFormat} onChange={(e) => setRdfFormat(e.target.value)} className="rounded-none border border-line px-2 py-1">
                    <option value="jsonld">JSON-LD</option>
                    <option value="turtle">Turtle</option>
                  </select>
                </label>
                <DownloadBtn onClick={downloadProvo}>Download prov.{rdfExt}</DownloadBtn>
              </div>
            </div>

            <div className="mt-2">
              <ProvenanceBuilder />
            </div>

            <div className="mt-4 border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">PROV-O record</h3>
                <span className="text-xs text-muted">
                  {provoResult.variableEntityCount} variables ·{' '}
                  <span className={provoResult.derivationIntact ? 'text-ok' : 'text-warn'}>
                    {provoResult.derivationIntact ? 'lineage intact' : 'lineage incomplete'}
                  </span>
                </span>
              </div>

              <DegreeLadder degrees={provoLadder} artifact="This record" />

              <div className="mt-3">
                <p className="mb-2 text-xs text-muted">
                  Deep validation checks the record against a formal PROV-O SHACL shape (the same
                  structural rules a downstream tool applies when it ingests lineage), catching
                  problems like a missing agent or a broken derivation chain while you can still fix
                  them.
                </p>
                <button type="button" onClick={runDeepValidate} className="rounded-none bg-brand-btn px-3 py-1.5 text-sm font-medium text-surface hover:opacity-90">
                  {shacl?.loading ? 'Validating…' : 'Deep validate (SHACL)'}
                </button>
                {shacl && !shacl.loading && (
                  <div className="mt-2 text-sm">
                    {shacl.error ? (
                      <p className="text-bad">Error: {shacl.error}</p>
                    ) : (
                      <>
                        <p className={shacl.conforms ? 'text-ok' : 'text-bad'}>
                          {shacl.conforms ? '✓ Conforms to the PROV-O profile.' : `× ${shacl.results.length} violation(s):`}
                        </p>
                        {!shacl.conforms && (
                          <ul className="mt-1 list-inside list-disc text-xs text-muted">
                            {shacl.results.map((r, i) => (
                              <li key={i}>[{r.severity}] {r.message}</li>
                            ))}
                          </ul>
                        )}
                        <button type="button" onClick={downloadShaclReport} className="mt-2 rounded-none border border-line px-3 py-1.5 text-xs hover:bg-idle-bg">
                          Download conformance-report.{rdfExt}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-muted">
                  Preview / advanced: raw JSON-LD {overrideActive ? '(override active)' : ''}
                </summary>
                <textarea
                  value={overrideActive ? overrideText : provoJson}
                  readOnly={!overrideActive}
                  onChange={(e) => {
                    setOverrideText(e.target.value);
                    const p = tryParse(e.target.value);
                    if (p.value && typeof p.value === 'object') dispatch({ type: 'SET_PROVO', provo: p.value });
                  }}
                  rows={12}
                  className={editorClass}
                  spellCheck={false}
                />
                {overrideActive ? (
                  <button type="button" onClick={() => dispatch({ type: 'SET_PROVO', provo: null })} className="mt-1 text-xs text-bad underline">
                    Clear override (return to builder)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOverrideText(provoJson);
                      dispatch({ type: 'SET_PROVO', provo: provoDoc });
                    }}
                    className="mt-1 text-xs text-muted underline"
                  >
                    Edit raw (override the builder)
                  </button>
                )}
              </details>
            </div>
          </div>
        )}

        {/* Assessment report */}
        {active === 'report' &&
          (() => {
            const json = JSON.stringify(buildAssessmentReport(state, bundleOpts()), null, 2);
            return (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">assessment-report.json</h3>
                  <DownloadBtn onClick={() => download('assessment-report.json', json, 'application/json')}>
                    Download
                  </DownloadBtn>
                </div>
                <p className="mt-1 text-xs text-muted">Generated from your answers and validation (read-only).</p>
                <pre className={previewClass}>{json}</pre>
              </div>
            );
          })()}

        {/* Conformance report (structural JSON) */}
        {active === 'conformance' &&
          (() => {
            const json = JSON.stringify(buildConformanceReport(state, bundleOpts()), null, 2);
            return (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">conformance-report.json</h3>
                  <DownloadBtn onClick={() => download('conformance-report.json', json, 'application/json')}>
                    Download
                  </DownloadBtn>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Which automated checks passed, and how far up the machine-actionability ladder
                  each generated artifact reaches (read-only). The RDF/SHACL form is under the
                  Provenance tab (Deep validate).
                </p>

                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <DegreeLadder degrees={croissantLadder} artifact="croissant.json" />
                  <DegreeLadder degrees={provoLadder} artifact="prov.jsonld" />
                </div>
                <p className="mt-3 border-l-2 border-line pl-3 text-xs text-muted">
                  <span className="font-medium text-ink">Executable</span> is the one rung this tool
                  does not certify: it would mean round-tripping each artifact through the tool that
                  will consume it, and dereferencing every identifier over the network. Both are out
                  of reach offline, so the report names the check that would certify the rung and
                  marks it out-of-scope.
                </p>
                <pre className={previewClass}>{json}</pre>
              </div>
            );
          })()}

        {/* To-do action plan */}
        {active === 'todo' && showTodo && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">todo.md</h3>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setTodo(generateTodo(state, bundleOpts()))} className="text-xs text-muted underline">
                  Regenerate
                </button>
                <DownloadBtn onClick={() => download('todo.md', todo, 'text/markdown')}>Download</DownloadBtn>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">Action plan of what remains, for a dataset still being collected or prepared.</p>
            <textarea value={todo} onChange={(e) => setTodo(e.target.value)} rows={20} className={editorClass} spellCheck={false} />
          </div>
        )}

      </div>

      {/* Collection guide — guidance rather than a release-bundle document, so it
          sits outside the tabs and carries its own action colour. */}
      <div className="mt-10 border-t border-line pt-5">
        <h3 className="text-sm font-semibold">Collection guide</h3>
        <p className="mt-1 max-w-[70ch] text-xs text-muted">
          What to write down while the work is happening, so these documents are fillable later:
          the four forms a record passes through, the six questions, and a worksheet of every
          observation this pathway asks for, grouped by the stage at which it is still capturable.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => download(guideFilename(state), generateCollectionGuide(state), 'text/markdown')}
            className="rounded-none bg-guide-btn px-4 py-2 text-sm font-medium text-guide-btn-fg hover:opacity-90"
          >
            Download collection guide (.md)
          </button>
          <Link to="/guide" className="text-xs text-link underline">
            or read it here, and save it as a PDF
          </Link>
        </div>
      </div>

      {/* Assessment file — save/resume the whole record (the source of the tabs above) */}
      <div className="mt-10 border-t border-line pt-5">
        <h3 className="text-sm font-semibold">Assessment file</h3>
        <p className="mt-1 max-w-[70ch] text-xs text-muted">
          Save the whole assessment (every answer, dataset details, and your Croissant/PROV-O edits)
          to a file: an archival record of what was assessed, against which schema version, and when.
          Work in progress is kept in this browser as you go, so you can close the tab and return to
          it.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <DownloadBtn onClick={exportAssessment}>Export assessment (.json)</DownloadBtn>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button type="button" onClick={() => navigate('/review')} className="rounded-none border border-line px-4 py-2 text-sm hover:bg-idle-bg">
          ← Back to review
        </button>
        <button
          type="button"
          onClick={startNew}
          className="rounded-none border border-bad-line px-4 py-2 text-sm text-bad hover:bg-bad-bg"
        >
          Start new documentation
        </button>
      </div>
    </section>
  );
}
