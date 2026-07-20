// Wizard step 4 — export. One tab per release-bundle document; each tab shows an
// editable/previewable view with its own Download button. Datasheet/healthsheet,
// Croissant (with dataset-name field), PROV-O (builder + SHACL), assessment
// report, conformance report, and (for Plan/Prepare) a to-do action plan.

import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAssessment } from '../state/assessment.jsx';
import { templateForRecord } from '../lib/pathway.js';
import { generateDatasheet } from '../generators/datasheet.js';
import { generateTodo } from '../generators/todo.js';
import {
  generateCroissant,
  effectiveCroissant,
  CROISSANT_CONTEXT,
  CROISSANT_CONFORMS_TO,
} from '../generators/croissant.js';
import { effectiveProvo } from '../generators/provo.js';
import { validateCroissant } from '../lib/croissantValidation.js';
import { validateProvo } from '../lib/provoValidation.js';
import { validationResults } from '../lib/validation.js';
import { buildAssessmentReport, buildConformanceReport } from '../lib/report.js';
import { validateProvoShacl, serializeReport, provoToTurtle } from '../lib/shacl.js';
import ProvenanceBuilder from '../components/ProvenanceBuilder.jsx';
import ImportAssessment from '../components/ImportAssessment.jsx';

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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

const editorClass = 'mt-2 w-full rounded-none border border-line p-3 font-mono text-xs';
const previewClass = 'mt-2 max-h-[28rem] overflow-auto rounded-none border border-line bg-surface-2 p-3 font-mono text-xs whitespace-pre-wrap';

export default function ExportPage() {
  const { state, dispatch } = useAssessment();
  const navigate = useNavigate();

  const [tab, setTab] = useState('datasheet');
  const [datasheet, setDatasheet] = useState(() => (state.pathway ? generateDatasheet(state) : ''));
  const [todo, setTodo] = useState(() => (state.pathway ? generateTodo(state) : ''));
  const [croissantText, setCroissantText] = useState(() =>
    state.pathway ? JSON.stringify(effectiveCroissant(state), null, 2) : '',
  );
  const [overrideText, setOverrideText] = useState(() =>
    state.pathway ? JSON.stringify(effectiveProvo(state), null, 2) : '',
  );
  const [rdfFormat, setRdfFormat] = useState('jsonld');
  const [shacl, setShacl] = useState(null);

  const croissantParse = tryParse(croissantText);
  useEffect(() => {
    if (croissantParse.value && typeof croissantParse.value === 'object') {
      dispatch({ type: 'SET_CROISSANT', croissant: croissantParse.value });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [croissantText]);

  if (!state.pathway) return <Navigate to="/" replace />;

  const croissantResult = croissantParse.value ? validateCroissant(croissantParse.value) : null;
  const provoDoc = effectiveProvo(state);
  const provoResult = validateProvo(provoDoc);
  const provoJson = JSON.stringify(provoDoc, null, 2);
  const overrideActive = Boolean(state.provo);

  const template = templateForRecord(state);
  const datasheetName = template === 'healthsheet' ? 'healthsheet.md' : 'datasheet.md';
  const rdfExt = rdfFormat === 'turtle' ? 'ttl' : 'jsonld';
  const rdfMime = rdfFormat === 'turtle' ? 'text/turtle' : 'application/ld+json';
  const showProvenance = state.pathway === 'B' || state.pathway === 'C';
  const showTodo = state.stage === 'plan' || state.stage === 'prepare';

  const bundleOpts = () => {
    const croissant = effectiveCroissant(state);
    return { results: validationResults(state, { croissant, provo: provoDoc }), croissant };
  };

  const setDatasetField = (patch) => {
    const nextDataset = { ...state.dataset, ...patch };
    dispatch({ type: 'SET_DATASET', dataset: patch });
    const c = generateCroissant({ ...state, dataset: nextDataset });
    dispatch({ type: 'SET_CROISSANT', croissant: c });
    setCroissantText(JSON.stringify(c, null, 2));
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
      <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
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
              <DownloadBtn onClick={() => download('croissant.json', croissantText, 'application/ld+json')}>
                Download
              </DownloadBtn>
            </div>

            {/* Dataset details — the name field lives here */}
            <div className="mt-3 border border-line bg-surface-2 p-3">
              <p className="text-xs text-muted">
                Dataset details populate the descriptor. A{' '}
                <span className="font-medium text-ink">name</span> is required for it to validate.
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

            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted">
                To make it <span className="font-medium text-ink">directly loadable</span>, add a{' '}
                <code className="font-mono">distribution</code> and a{' '}
                <code className="font-mono">recordSet</code>.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'SET_CROISSANT', croissant: EXAMPLE_CROISSANT });
                    setCroissantText(JSON.stringify(EXAMPLE_CROISSANT, null, 2));
                  }}
                  className="text-xs text-muted underline"
                >
                  Load example
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const c = generateCroissant(state);
                    dispatch({ type: 'SET_CROISSANT', croissant: c });
                    setCroissantText(JSON.stringify(c, null, 2));
                  }}
                  className="text-xs text-muted underline"
                >
                  Regenerate from answers
                </button>
              </div>
            </div>

            <textarea value={croissantText} onChange={(e) => setCroissantText(e.target.value)} rows={16} className={editorClass} spellCheck={false} />
            <div className="mt-2 text-xs">
              {croissantParse.error ? (
                <p className="text-bad">Invalid JSON: {croissantParse.error}</p>
              ) : croissantResult?.valid ? (
                <p className="text-ok">✓ Valid{croissantResult.loadable ? ' and directly loadable' : ' (metadata only)'}.</p>
              ) : (
                <p className="text-bad">× {croissantResult?.errors[0]}</p>
              )}
            </div>
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
                <span className={`text-xs ${provoResult.valid ? 'text-ok' : 'text-bad'}`}>
                  {provoResult.valid ? '✓ well-formed' : '× not well-formed'} · {provoResult.variableEntityCount} variables ·{' '}
                  {provoResult.derivationIntact ? 'lineage intact' : 'lineage incomplete'}
                </span>
              </div>

              <div className="mt-3">
                <p className="mb-2 text-xs text-muted">
                  Deep validation checks the record against a formal PROV-O SHACL shape (the same
                  structural rules a downstream tool applies when it ingests lineage), catching
                  problems like a missing agent or a broken derivation chain before you publish
                  rather than after.
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
                  Which automated checks passed (read-only). The RDF/SHACL form is under the
                  Provenance tab (Deep validate).
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

      {/* Assessment file — save/resume the whole record (the source of the tabs above) */}
      <div className="mt-10 border-t border-line pt-5">
        <h3 className="text-sm font-semibold">Assessment file</h3>
        <p className="mt-1 max-w-[70ch] text-xs text-muted">
          Save the whole assessment (every answer, dataset details, and your Croissant/PROV-O edits)
          to a file to resume later or share, or load one to continue where you left off.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <DownloadBtn onClick={exportAssessment}>Export assessment (.json)</DownloadBtn>
          <ImportAssessment className="rounded-none border border-line px-4 py-2 text-sm hover:bg-idle-bg">
            Import assessment…
          </ImportAssessment>
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
