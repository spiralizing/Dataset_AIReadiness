// Wizard step 2 — one data-driven page per dimension. Renders the required
// criteria (grouped by level, including Pathway-C ethics overlays) and any
// recommended-but-not-required criteria, then Back/Next navigation. A single
// component serves all seven dimensions; the schema drives what appears.

import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { DIMENSIONS, dimensionBySlug, slugify } from '../lib/dimensions.js';
import { criteriaForDimension, recommendedForDimension } from '../lib/pathway.js';
import { isUpcoming } from '../lib/stages.js';
import { validationResults } from '../lib/validation.js';
import { effectiveCroissant, generateCroissant } from '../generators/croissant.js';
import { useAssessment } from '../state/assessment.jsx';
import CriterionField from '../components/CriterionField.jsx';

const LEVEL_NAMES = {
  L1: 'L1 — Accessible',
  L2: 'L2 — Faithful',
  L3: 'L3 — Task-ready',
};

const STAGE_HINT = {
  plan: 'Planning: decide and document these before/while you collect; everything is still in your control.',
  prepare: 'Preparing: report and finalize. Acquisition decisions are fixed; document them as-is.',
  upgrade: 'Upgrade: add documentation and governance. Acquisition and curation are fixed; unmet locked items become limitations.',
};

export default function DimensionPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = useAssessment();

  if (!state.pathway) return <Navigate to="/" replace />;
  const dimension = dimensionBySlug(slug);
  if (!dimension) return <Navigate to="/" replace />;

  const idx = DIMENSIONS.indexOf(dimension);
  const allRequired = criteriaForDimension(dimension, state.pathway, state.sub_domain);
  const required = allRequired.filter((c) => !isUpcoming(c, state.stage));
  const upcoming = allRequired.filter((c) => isUpcoming(c, state.stage));
  const recommended = recommendedForDimension(dimension, state.pathway);
  const results = validationResults(state, { croissant: effectiveCroissant(state) });

  const byLevel = { L1: [], L2: [], L3: [] };
  for (const c of required) byLevel[c.level].push(c);

  const setAnswer = (id, patch) => dispatch({ type: 'SET_ANSWER', id, ...patch });

  // Set the dataset name inline (from the L2 Croissant criterion) so its "name
  // is required" check clears without visiting Export. Update the name on the
  // effective descriptor, preserving any distribution/recordSet already present.
  const setDatasetName = (name) => {
    dispatch({ type: 'SET_DATASET', dataset: { name } });
    const base = state.croissant ?? generateCroissant(state);
    dispatch({ type: 'SET_CROISSANT', croissant: { ...base, name } });
  };

  // Inline name input for the Croissant descriptor criterion (id below), so the
  // "name is required and must be non-empty" check is fixable in place.
  const extraFor = (c) =>
    c.id === 'fairness.l2.croissant_descriptor' ? (
      <label className="block text-xs text-muted">
        Dataset name
        <input
          type="text"
          value={state.dataset?.name ?? ''}
          onChange={(e) => setDatasetName(e.target.value)}
          placeholder="e.g. VA fracture-risk cohort"
          className="mt-1 w-full rounded-none border border-line px-2 py-1 text-sm text-ink"
        />
        <span className="mt-1 block text-[11px] text-muted">
          Adding a name here completes the Croissant descriptor&rsquo;s required title.
        </span>
      </label>
    ) : undefined;

  const prev = idx > 0 ? `/dimension/${slugify(DIMENSIONS[idx - 1])}` : '/';
  const isLast = idx === DIMENSIONS.length - 1;
  const next = isLast ? '/review' : `/dimension/${slugify(DIMENSIONS[idx + 1])}`;

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{dimension}</h2>
        <span className="text-xs text-muted">
          Dimension {idx + 1} of {DIMENSIONS.length}
        </span>
      </div>

      {state.stage && STAGE_HINT[state.stage] && (
        <p className="mt-1 text-xs text-muted">{STAGE_HINT[state.stage]}</p>
      )}

      {['L1', 'L2', 'L3'].map(
        (lvl) =>
          byLevel[lvl].length > 0 && (
            <div key={lvl} className="mt-6">
              <h3 className="text-sm font-semibold text-muted">{LEVEL_NAMES[lvl]}</h3>
              <div className="mt-2 grid gap-3">
                {byLevel[lvl].map((c) => (
                  <CriterionField
                    key={c.id}
                    criterion={c}
                    answer={state.answers[c.id]}
                    onChange={(patch) => setAnswer(c.id, patch)}
                    result={results[c.id]}
                    stage={state.stage}
                    extra={extraFor(c)}
                  />
                ))}
              </div>
            </div>
          ),
      )}

      {upcoming.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-info">Upcoming: plan for later</h3>
          <p className="mt-1 text-xs text-muted">
            Not due while collecting; you'll complete these when preparing to publish.
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-muted">
            {upcoming.map((c) => (
              <li key={c.id}>{c.label}</li>
            ))}
          </ul>
        </div>
      )}

      {recommended.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-info">
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
                stage={state.stage}
                extra={extraFor(c)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={() => navigate(prev)}
          className="rounded-none border border-line px-4 py-2 text-sm hover:bg-idle-bg"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => navigate(next)}
          className="rounded-none bg-brand-btn px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
        >
          {isLast ? 'Review →' : 'Next →'}
        </button>
      </div>
    </section>
  );
}
