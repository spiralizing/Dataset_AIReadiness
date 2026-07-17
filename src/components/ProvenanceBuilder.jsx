// Step-centric provenance builder. The user adds raw sources and then "adds
// steps" (curation/transformation activities); each step consumes inputs and
// produces outputs. generateProvo composes valid PROV-O from this model, so the
// structural + SHACL checks pass without hand-editing JSON.

import vocabularies from '../schema/vocabularies.json';
import { useAssessment } from '../state/assessment.jsx';

const ROLES = vocabularies.vocabularies.stakeholder_roles?.values ?? [];
const uid = (p) => `${p}-${crypto.randomUUID().slice(0, 8)}`;

export default function ProvenanceBuilder() {
  const { state, dispatch } = useAssessment();
  const model = state.provenance ?? { sources: [], steps: [] };
  const set = (next) => dispatch({ type: 'SET_PROVENANCE', provenance: next });

  const sources = model.sources ?? [];
  const steps = model.steps ?? [];

  const addSource = () => set({ ...model, sources: [...sources, { id: uid('src'), name: '' }] });
  const updateSource = (id, name) =>
    set({ ...model, sources: sources.map((s) => (s.id === id ? { ...s, name } : s)) });
  const removeSource = (id) => set({ ...model, sources: sources.filter((s) => s.id !== id) });

  const addStep = () =>
    set({
      ...model,
      steps: [...steps, { id: uid('step'), label: '', inputs: [], outputs: [], software: '', agentRole: '' }],
    });
  const updateStep = (id, patch) =>
    set({ ...model, steps: steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const removeStep = (id) => set({ ...model, steps: steps.filter((s) => s.id !== id) });

  // Entities selectable as inputs to step i: sources + outputs of earlier steps.
  const availableFor = (i) => [
    ...sources.map((s) => ({ id: s.id, name: s.name || s.id })),
    ...steps.slice(0, i).flatMap((st) => (st.outputs ?? []).map((o) => ({ id: o.id, name: o.name || o.id }))),
  ];

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold">Build provenance (steps)</h3>
      <p className="mt-1 text-xs text-slate-500">
        List raw sources, then add each curation/transformation step. Outputs of one step can be
        inputs to the next; lineage is recorded automatically.
      </p>

      {/* Sources */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-slate-500">Raw sources</h4>
        <div className="mt-2 space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="flex gap-2">
              <input
                value={s.name}
                onChange={(e) => updateSource(s.id, e.target.value)}
                placeholder="e.g. Raw EHR export"
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <button type="button" onClick={() => removeSource(s.id)} className="text-xs text-rose-600">
                remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addSource} className="mt-2 text-xs text-slate-600 underline">
          + Add source
        </button>
      </div>

      {/* Steps */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-slate-500">Steps</h4>
        <div className="mt-2 space-y-3">
          {steps.map((step, i) => {
            const available = availableFor(i);
            return (
              <div key={step.id} className="rounded border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={step.label}
                    onChange={(e) => updateStep(step.id, { label: e.target.value })}
                    placeholder={`Step ${i + 1} label (e.g. Cleaning)`}
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm font-medium"
                  />
                  <button type="button" onClick={() => removeStep(step.id)} className="text-xs text-rose-600">
                    remove step
                  </button>
                </div>

                {/* Inputs */}
                <div className="mt-2">
                  <span className="text-[11px] font-medium text-slate-500">Inputs used</span>
                  {available.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Add a source (or an earlier step's output) first.</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {available.map((e) => (
                        <label key={e.id} className="flex items-center gap-1 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={(step.inputs ?? []).includes(e.id)}
                            onChange={() =>
                              updateStep(step.id, {
                                inputs: (step.inputs ?? []).includes(e.id)
                                  ? step.inputs.filter((x) => x !== e.id)
                                  : [...(step.inputs ?? []), e.id],
                              })
                            }
                          />
                          {e.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Outputs */}
                <div className="mt-2">
                  <span className="text-[11px] font-medium text-slate-500">Outputs produced</span>
                  <div className="mt-1 space-y-1">
                    {(step.outputs ?? []).map((o) => (
                      <div key={o.id} className="flex gap-2">
                        <input
                          value={o.name}
                          onChange={(e) =>
                            updateStep(step.id, {
                              outputs: step.outputs.map((x) => (x.id === o.id ? { ...x, name: e.target.value } : x)),
                            })
                          }
                          placeholder="e.g. age (derived)"
                          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateStep(step.id, { outputs: step.outputs.filter((x) => x.id !== o.id) })
                          }
                          className="text-xs text-rose-600"
                        >
                          remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateStep(step.id, { outputs: [...(step.outputs ?? []), { id: uid('out'), name: '' }] })
                    }
                    className="mt-1 text-xs text-slate-600 underline"
                  >
                    + Add output
                  </button>
                </div>

                {/* Software + agent */}
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    value={step.software}
                    onChange={(e) => updateStep(step.id, { software: e.target.value })}
                    placeholder="software / versions (e.g. python 3.11)"
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                  <select
                    value={step.agentRole}
                    onChange={(e) => updateStep(step.id, { agentRole: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="">— responsible role —</option>
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={addStep} className="mt-2 text-xs text-slate-600 underline">
          + Add step
        </button>
      </div>
    </div>
  );
}
