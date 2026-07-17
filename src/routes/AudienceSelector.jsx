// Wizard step 1 — pathway selection (rendered from pathways.json), plus the
// Pathway-C sub-domain selector. Selection is stored in assessment state; the
// Continue button routes to the first dimension.

import { useNavigate } from 'react-router-dom';
import { PATHWAYS, subDomainsForC } from '../lib/pathway.js';
import { DIMENSIONS, slugify } from '../lib/dimensions.js';
import { useAssessment } from '../state/assessment.jsx';

const cardClass = (active) =>
  `w-full text-left rounded-lg border p-4 transition-colors ${
    active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'
  }`;

export default function AudienceSelector() {
  const { state, dispatch } = useAssessment();
  const navigate = useNavigate();
  const firstDimension = `/dimension/${slugify(DIMENSIONS[0])}`;

  return (
    <section>
      <h2 className="text-xl font-semibold">Choose your audience</h2>
      <p className="mt-2 text-sm text-slate-600">
        Your pathway sets which criteria are required. Pathways are cumulative — B
        includes all of A, and C includes all of A and B.
      </p>

      <div className="mt-4 grid gap-3">
        {PATHWAYS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => dispatch({ type: 'SET_PATHWAY', pathway: p.id })}
            className={cardClass(state.pathway === p.id)}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                Pathway {p.id} — {p.name}
              </span>
              <span className="text-xs text-slate-500">
                {p.level} · DRL {p.drl_band}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{p.tagline}</p>
          </button>
        ))}
      </div>

      {state.pathway === 'C' && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Sub-domain</h3>
          <p className="mt-1 text-xs text-slate-500">
            Refines the Ethics criteria and the datasheet template. Defaults to General.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {subDomainsForC().map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => dispatch({ type: 'SET_SUB_DOMAIN', sub_domain: s.id })}
                className={`text-left rounded border p-3 text-sm transition-colors ${
                  state.sub_domain === s.id
                    ? 'border-slate-900 ring-1 ring-slate-900'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                <span className="font-medium">{s.name}</span>
                <p className="mt-0.5 text-xs text-slate-500">{s.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {state.pathway && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => navigate(firstDimension)}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Continue →
          </button>
        </div>
      )}
    </section>
  );
}
