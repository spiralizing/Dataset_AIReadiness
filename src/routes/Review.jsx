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
  requiredCriteria,
} from '../lib/pathway.js';
import guidance from '../schema/guidance.json';
import { validationResults } from '../lib/validation.js';
import { effectiveCroissant } from '../generators/croissant.js';
import { getStage, isUpcoming } from '../lib/stages.js';
import { useAssessment } from '../state/assessment.jsx';

const CELL = {
  met: { cls: 'bg-ok-bg text-ok', glyph: '✓' },
  unmet: { cls: 'bg-bad-bg text-bad', glyph: '×' },
  upcoming: { cls: 'bg-info-bg text-info', glyph: '⋯' },
  'not-required': { cls: 'bg-idle-bg text-idle', glyph: '–' },
};

export default function Review() {
  const { state } = useAssessment();
  const navigate = useNavigate();
  if (!state.pathway) return <Navigate to="/" replace />;

  const { pathway, sub_domain: subDomain, answers } = state;
  const results = validationResults(state, { croissant: effectiveCroissant(state) });
  const verdict = pathwayVerdict(pathway, answers, subDomain, results, state.stage);
  const recommendedUnmet = recommendedForPathway(pathway).filter(
    (c) => !isCriterionSatisfied(c, answers[c.id], results),
  );

  // How much of this assessment a validator can settle, and how much rests on a
  // declaration or a judgement. The heatmap alone reads as though every tick were
  // the same kind of fact; these three are not interchangeable, and the split is
  // worth seeing before the verdict is taken as a measurement.
  const due = requiredCriteria(pathway, subDomain).filter((c) => !isUpcoming(c, state.stage));
  const byMode = guidance.verification_modes.modes.map((m) => {
    const of = due.filter((c) => c.verification === m.id);
    return {
      ...m,
      total: of.length,
      satisfied: of.filter((c) => isCriterionSatisfied(c, answers[c.id], results)).length,
    };
  }).filter((m) => m.total > 0);

  return (
    <section>
      <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
        Step 3 · Review
      </span>
      <h2 className="mt-1 text-xl font-semibold">Review</h2>
      {getStage(state.stage) && (
        <p className="mt-1 text-xs text-muted">Starting point: {getStage(state.stage).title}</p>
      )}

      {/* Verdict banner */}
      <div
        className={`mt-3 rounded-none border p-4 ${
          verdict.met ? 'border-ok-line bg-ok-bg' : 'border-bad-line bg-bad-bg'
        }`}
      >
        <p className="text-sm font-semibold">
          {verdict.met
            ? `Meets Pathway ${pathway}.`
            : `Does not yet meet Pathway ${pathway}.`}
        </p>
        <p className="mt-1 text-sm text-muted">
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
              <th className="text-left font-medium text-muted"></th>
              {LEVELS.map((l) => (
                <th key={l.id} className="px-2 text-center text-xs font-medium text-muted">
                  {l.id} · {l.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIMENSIONS.map((dim) => (
              <tr key={dim}>
                <td className="whitespace-nowrap pr-2 text-ink">
                  <Link className="hover:underline" to={`/dimension/${slugify(dim)}`}>
                    {dim}
                  </Link>
                </td>
                {LEVELS.map((l) => {
                  const status = cellStatus(dim, l.id, pathway, answers, subDomain, results, state.stage);
                  const c = CELL[status];
                  return (
                    <td key={l.id} className="text-center">
                      <div
                        className={`mx-auto flex h-8 w-full items-center justify-center rounded-none ${c.cls}`}
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

      <div className="mt-3 flex gap-4 text-xs text-muted">
        <span><span className="mr-1 inline-block h-3 w-3 rounded-none bg-ok-bg0 align-middle" />met</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-none bg-bad-bg align-middle" />unmet</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-none bg-info-bg align-middle" />upcoming</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-none bg-idle-bg align-middle" />not required</span>
      </div>

      <div className="mt-6 border border-line bg-surface-2 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">How these are confirmed</h3>
          <span className="text-xs text-faint">{due.length} criteria due at this stage</span>
        </div>
        <p className="mt-1 text-xs text-muted">{guidance.verification_modes.lead}</p>
        <dl className="mt-3 grid gap-2">
          {byMode.map((m) => (
            <div key={m.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <dt className="shrink-0">
                <span className={`px-1.5 py-0.5 text-[0.65rem] font-medium ${m.tone}`}>{m.label}</span>
              </dt>
              <dd className="shrink-0 font-mono text-xs tabular-nums text-ink">
                {m.satisfied}/{m.total}
              </dd>
              <dd className="min-w-0 flex-1 text-xs text-muted">{m.definition}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs italic text-faint">{guidance.verification_modes.note}</p>
      </div>

      {/* Recommended-but-unmet */}
      {recommendedUnmet.length > 0 && (
        <div className="mt-6 rounded-none border border-info-line bg-info-bg p-4">
          <h3 className="text-sm font-semibold text-info">Recommended extras not yet added</h3>
          <ul className="mt-2 list-inside list-disc text-sm text-muted">
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
          className="rounded-none border border-line px-4 py-2 text-sm hover:bg-idle-bg"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => navigate('/export')}
          className="rounded-none bg-brand-btn px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
        >
          Export →
        </button>
      </div>
    </section>
  );
}
