// Wizard step 2 — one data-driven page per dimension. Renders the required
// criteria (grouped by level, including Pathway-C ethics overlays) and any
// recommended-but-not-required criteria, then Back/Next navigation. A single
// component serves all seven dimensions; the schema drives what appears.

import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { DIMENSIONS, dimensionBySlug, slugify } from '../lib/dimensions.js';
import { criteriaForDimension, recommendedForDimension } from '../lib/pathway.js';
import { validationResults } from '../lib/validation.js';
import { effectiveCroissant } from '../generators/croissant.js';
import { useAssessment } from '../state/assessment.jsx';
import CriterionField from '../components/CriterionField.jsx';

const LEVEL_NAMES = {
  L1: 'L1 — Accessible',
  L2: 'L2 — Faithful',
  L3: 'L3 — Task-ready',
};

export default function DimensionPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = useAssessment();

  if (!state.pathway) return <Navigate to="/" replace />;
  const dimension = dimensionBySlug(slug);
  if (!dimension) return <Navigate to="/" replace />;

  const idx = DIMENSIONS.indexOf(dimension);
  const required = criteriaForDimension(dimension, state.pathway, state.sub_domain);
  const recommended = recommendedForDimension(dimension, state.pathway);
  const results = validationResults(state, { croissant: effectiveCroissant(state) });

  const byLevel = { L1: [], L2: [], L3: [] };
  for (const c of required) byLevel[c.level].push(c);

  const setAnswer = (id, patch) => dispatch({ type: 'SET_ANSWER', id, ...patch });

  const prev = idx > 0 ? `/dimension/${slugify(DIMENSIONS[idx - 1])}` : '/';
  const isLast = idx === DIMENSIONS.length - 1;
  const next = isLast ? '/review' : `/dimension/${slugify(DIMENSIONS[idx + 1])}`;

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{dimension}</h2>
        <span className="text-xs text-slate-500">
          Dimension {idx + 1} of {DIMENSIONS.length}
        </span>
      </div>

      {['L1', 'L2', 'L3'].map(
        (lvl) =>
          byLevel[lvl].length > 0 && (
            <div key={lvl} className="mt-6">
              <h3 className="text-sm font-semibold text-slate-500">{LEVEL_NAMES[lvl]}</h3>
              <div className="mt-2 grid gap-3">
                {byLevel[lvl].map((c) => (
                  <CriterionField
                    key={c.id}
                    criterion={c}
                    answer={state.answers[c.id]}
                    onChange={(patch) => setAnswer(c.id, patch)}
                    result={results[c.id]}
                  />
                ))}
              </div>
            </div>
          ),
      )}

      {recommended.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-sky-700">
            Recommended (not required for this pathway)
          </h3>
          <div className="mt-2 grid gap-3">
            {recommended.map((c) => (
              <CriterionField
                key={c.id}
                criterion={c}
                answer={state.answers[c.id]}
                onChange={(patch) => setAnswer(c.id, patch)}
                requirement="recommended"
                result={results[c.id]}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={() => navigate(prev)}
          className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => navigate(next)}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {isLast ? 'Review →' : 'Next →'}
        </button>
      </div>
    </section>
  );
}
