// Wizard step 4 — release-bundle export. Datasheet/healthsheet, assessment
// report, editable+validated Croissant, builder-driven PROV-O (with a raw
// advanced override), conformance report, and on-demand SHACL deep validation.

import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAssessment } from '../state/assessment.jsx';
import { templateForRecord } from '../lib/pathway.js';
import { generateDatasheet } from '../generators/datasheet.js';
import { generateCroissant, effectiveCroissant } from '../generators/croissant.js';
import { effectiveProvo } from '../generators/provo.js';
import { validateCroissant } from '../lib/croissantValidation.js';
import { validateProvo } from '../lib/provoValidation.js';
import { validationResults } from '../lib/validation.js';
import { buildAssessmentReport, buildConformanceReport } from '../lib/report.js';
import { validateProvoShacl, serializeReport, provoToTurtle } from '../lib/shacl.js';
import ProvenanceBuilder from '../components/ProvenanceBuilder.jsx';

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

const tryParse = (text) => {
  try {
    return { value: JSON.parse(text), error: null };
  } catch (e) {
    return { value: null, error: e.message };
  }
};

export default function ExportPage() {
  const { state, dispatch } = useAssessment();
  const navigate = useNavigate();

  const [datasheet, setDatasheet] = useState(() => (state.pathway ? generateDatasheet(state) : ''));
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

  // PROV-O is derived from the builder (+ optional raw override), so it always
  // reflects the current model.
  const provoDoc = effectiveProvo(state);
  const provoResult = validateProvo(provoDoc);
  const provoJson = JSON.stringify(provoDoc, null, 2);
  const overrideActive = Boolean(state.provo);

  const template = templateForRecord(state);
  const datasheetName = template === 'healthsheet' ? 'healthsheet.md' : 'datasheet.md';
  const rdfExt = rdfFormat === 'turtle' ? 'ttl' : 'jsonld';
  const rdfMime = rdfFormat === 'turtle' ? 'text/turtle' : 'application/ld+json';
  const showProvenance = state.pathway === 'B' || state.pathway === 'C';

  const bundleOpts = () => {
    const croissant = effectiveCroissant(state);
    return { results: validationResults(state, { croissant, provo: provoDoc }), croissant };
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

  return (
    <section>
      <h2 className="text-xl font-semibold">Export</h2>
      <p className="mt-2 text-sm text-slate-600">
        Download the release bundle. The {template}, Croissant, and provenance are editable and
        live-validated; the reports reflect your current answers and validation.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => download(datasheetName, datasheet, 'text/markdown')} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          {datasheetName}
        </button>
        <button type="button" onClick={() => download('assessment-report.json', JSON.stringify(buildAssessmentReport(state, bundleOpts()), null, 2), 'application/json')} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
          assessment-report.json
        </button>
        <button type="button" onClick={() => download('croissant.json', croissantText, 'application/ld+json')} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
          croissant.json
        </button>
        {showProvenance && (
          <button type="button" onClick={downloadProvo} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
            prov.{rdfExt}
          </button>
        )}
        <button type="button" onClick={() => download('conformance-report.json', JSON.stringify(buildConformanceReport(state, bundleOpts()), null, 2), 'application/json')} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
          conformance-report.json
        </button>
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          RDF format
          <select value={rdfFormat} onChange={(e) => setRdfFormat(e.target.value)} className="rounded border border-slate-300 px-2 py-1">
            <option value="jsonld">JSON-LD</option>
            <option value="turtle">Turtle</option>
          </select>
        </label>
      </div>

      {/* Croissant */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-500">croissant.json (editable)</h3>
          <button
            type="button"
            onClick={() => {
              const c = generateCroissant(state);
              dispatch({ type: 'SET_CROISSANT', croissant: c });
              setCroissantText(JSON.stringify(c, null, 2));
            }}
            className="text-xs text-slate-500 underline"
          >
            Regenerate from answers
          </button>
        </div>
        <textarea value={croissantText} onChange={(e) => setCroissantText(e.target.value)} rows={12} className="mt-2 w-full rounded border border-slate-300 p-3 font-mono text-xs" spellCheck={false} />
        <div className="mt-2 text-xs">
          {croissantParse.error ? (
            <p className="text-rose-600">Invalid JSON: {croissantParse.error}</p>
          ) : croissantResult?.valid ? (
            <p className="text-emerald-700">✓ Valid{croissantResult.loadable ? ' and directly loadable' : ' (metadata only)'}.</p>
          ) : (
            <p className="text-rose-600">× {croissantResult?.errors[0]}</p>
          )}
        </div>
      </div>

      {/* Provenance (B/C) */}
      {showProvenance && (
        <>
          <ProvenanceBuilder />

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">PROV-O record</h3>
              <span className={`text-xs ${provoResult.valid ? 'text-emerald-700' : 'text-rose-600'}`}>
                {provoResult.valid ? '✓ well-formed' : '× not well-formed'} · {provoResult.variableEntityCount} variables ·{' '}
                {provoResult.derivationIntact ? 'lineage intact' : 'lineage incomplete'}
              </span>
            </div>

            <div className="mt-3">
              <button type="button" onClick={runDeepValidate} className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
                {shacl?.loading ? 'Validating…' : 'Deep validate (SHACL)'}
              </button>
              {shacl && !shacl.loading && (
                <div className="mt-2 text-sm">
                  {shacl.error ? (
                    <p className="text-rose-600">Error: {shacl.error}</p>
                  ) : (
                    <>
                      <p className={shacl.conforms ? 'text-emerald-700' : 'text-rose-700'}>
                        {shacl.conforms ? '✓ Conforms to the PROV-O profile.' : `× ${shacl.results.length} violation(s):`}
                      </p>
                      {!shacl.conforms && (
                        <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
                          {shacl.results.map((r, i) => (
                            <li key={i}>[{r.severity}] {r.message}</li>
                          ))}
                        </ul>
                      )}
                      <button type="button" onClick={downloadShaclReport} className="mt-2 rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-100">
                        Download conformance-report.{rdfExt}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-slate-500">
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
                className="mt-2 w-full rounded border border-slate-300 p-3 font-mono text-xs"
                spellCheck={false}
              />
              {overrideActive ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_PROVO', provo: null })}
                  className="mt-1 text-xs text-rose-600 underline"
                >
                  Clear override (return to builder)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOverrideText(provoJson);
                    dispatch({ type: 'SET_PROVO', provo: provoDoc });
                  }}
                  className="mt-1 text-xs text-slate-500 underline"
                >
                  Edit raw (override the builder)
                </button>
              )}
            </details>
          </div>
        </>
      )}

      {/* Datasheet */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-500">{datasheetName} (editable)</h3>
          <button type="button" onClick={() => setDatasheet(generateDatasheet(state))} className="text-xs text-slate-500 underline">
            Regenerate
          </button>
        </div>
        <textarea value={datasheet} onChange={(e) => setDatasheet(e.target.value)} rows={12} className="mt-2 w-full rounded border border-slate-300 p-3 font-mono text-xs" spellCheck={false} />
      </div>

      <div className="mt-6">
        <button type="button" onClick={() => navigate('/review')} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
          ← Back to review
        </button>
      </div>
    </section>
  );
}
