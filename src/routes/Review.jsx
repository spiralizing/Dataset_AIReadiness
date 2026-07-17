// Wizard step 3 — 7×3 heatmap, per-pathway verdict, bottleneck dimensions, and
// a recommended-but-unmet panel. Cells and verdict come from the pure helpers
// in lib/pathway.js and are overlay-aware for Pathway C.

import { Navigate, Link, useNavigate } from 'react-router-dom';
import { DIMENSIONS, LEVELS, slugify } from '../lib/dimensions.js';
import {
  cellStatus,
  pathwayVerdict,
  recommendedForPathway,
  isCriterionSatisfied,
} from '../lib/pathway.js';
import { validationResults } from '../lib/validation.js';
import { effectiveCroissant } from '../generators/croissant.js';
import { useAssessment } from '../state/assessment.jsx';

const CELL = {
  met: { cls: 'bg-emerald-500 text-white', glyph: '✓' },
  unmet: { cls: 'bg-rose-100 text-rose-700', glyph: '×' },
  'not-required': { cls: 'bg-slate-100 text-slate-300', glyph: '–' },
};

export default function Review() {
  const { state } = useAssessment();
  const navigate = useNavigate();
  if (!state.pathway) return <Navigate to="/" replace />;

  const { pathway, sub_domain: subDomain, answers } = state;
  const results = validationResults(state, { croissant: effectiveCroissant(state) });
  const verdict = pathwayVerdict(pathway, answers, subDomain, results);
  const recommendedUnmet = recommendedForPathway(pathway).filter(
    (c) => !isCriterionSatisfied(c, answers[c.id], results),
  );

  return (
    <section>
      <h2 className="text-xl font-semibold">Review</h2>

      {/* Verdict banner */}
      <div
        className={`mt-3 rounded-lg border p-4 ${
          verdict.met ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'
        }`}
      >
        <p className="text-sm font-semibold">
          {verdict.met
            ? `Meets Pathway ${pathway}.`
            : `Does not yet meet Pathway ${pathway}.`}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {verdict.satisfiedCount}/{verdict.requiredCount} required criteria satisfied.
          {verdict.bottlenecks.length > 0 && (
            <>
              {' '}Bottleneck dimensions:{' '}
              {verdict.bottlenecks.map((d, i) => (
                <span key={d}>
                  {i > 0 && ', '}
                  <Link className="underline" to={`/dimension/${slugify(d)}`}>
                    {d}
                  </Link>
                </span>
              ))}
              .
            </>
          )}
        </p>
      </div>

      {/* Heatmap */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="text-left font-medium text-slate-500"></th>
              {LEVELS.map((l) => (
                <th key={l.id} className="px-2 text-center text-xs font-medium text-slate-500">
                  {l.id} · {l.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIMENSIONS.map((dim) => (
              <tr key={dim}>
                <td className="whitespace-nowrap pr-2 text-slate-700">
                  <Link className="hover:underline" to={`/dimension/${slugify(dim)}`}>
                    {dim}
                  </Link>
                </td>
                {LEVELS.map((l) => {
                  const status = cellStatus(dim, l.id, pathway, answers, subDomain, results);
                  const c = CELL[status];
                  return (
                    <td key={l.id} className="text-center">
                      <div
                        className={`mx-auto flex h-8 w-full items-center justify-center rounded ${c.cls}`}
                        title={`${dim} / ${l.id}: ${status}`}
                      >
                        {c.glyph}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex gap-4 text-xs text-slate-500">
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-emerald-500 align-middle" />met</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-rose-100 align-middle" />unmet</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-slate-100 align-middle" />not required</span>
      </div>

      {/* Recommended-but-unmet */}
      {recommendedUnmet.length > 0 && (
        <div className="mt-6 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <h3 className="text-sm font-semibold text-sky-800">Recommended extras not yet added</h3>
          <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
            {recommendedUnmet.map((c) => (
              <li key={c.id}>{c.label}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={() => navigate(`/dimension/${slugify(DIMENSIONS[DIMENSIONS.length - 1])}`)}
          className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => navigate('/export')}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Export →
        </button>
      </div>
    </section>
  );
}
