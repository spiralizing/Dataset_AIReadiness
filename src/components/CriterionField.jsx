// One criterion input. Switches the widget on `evidence_type`, shows the
// `verification` mode (automated / attested / manual), the recommended tag when
// applicable, collapsible guidance, and an optional note / evidence-link field.
//
// Controlled by the parent: `answer` is { value, notes } from state; `onChange`
// receives a partial patch ({ value } or { notes }) that the reducer merges.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import vocabularies from '../schema/vocabularies.json';
import { isLocked } from '../lib/stages.js';
import { depositionTargets } from '../lib/depositionTargets.js';

const VERIFICATION_BADGE = {
  automated: { label: 'automated', cls: 'bg-ok-bg text-ok' },
  attested: { label: 'attested', cls: 'bg-warn-bg text-warn' },
  manual: { label: 'manual', cls: 'bg-idle-bg text-idle' },
};

const vocabValues = (key) => vocabularies.vocabularies[key]?.values ?? [];

// Option list for a controlled-vocabulary criterion. Most read their static
// `vocabulary_key`; a criterion declaring `vocabulary_scope` resolves its options
// from the pathway / sub-domain instead, so the deposition-target list matches
// where the researcher is actually depositing.
const optionsFor = (criterion, pathway, subDomain) =>
  criterion.vocabulary_scope === 'deposition_targets'
    ? depositionTargets(criterion, pathway, subDomain)
    : { values: vocabValues(criterion.vocabulary_key), recommended: [] };

// Automated criteria whose check reads a generated artifact rather than this
// field's own answer — their input is not meaningful here; they are completed on
// the Export page. Maps id -> the artifact that drives it, and the Export tab
// that artifact lives on so the pointer can be a link rather than an instruction.
const DESCRIPTOR_DRIVEN = {
  'fairness.l2.croissant_descriptor': ['Croissant descriptor', 'croissant'],
  'computability.l3.direct_ml_load': ['Croissant descriptor', 'croissant'],
  'fairness.l3.responsible_ai_annotations': ['Croissant descriptor', 'croissant'],
  'provenance.l3.prov_record_present': ['PROV-O record', 'provo'],
  'provenance.l3.entity_per_variable': ['PROV-O record', 'provo'],
  'provenance.l3.activity_per_step': ['PROV-O record', 'provo'],
  'explainability.l3.feature_lineage_intact': ['PROV-O record', 'provo'],
};

function StatusPill({ pending, result }) {
  if (pending) {
    return (
      <span className="rounded-none bg-idle-bg px-1.5 py-0.5 text-[0.65rem] font-medium text-muted">
        validator pending
      </span>
    );
  }
  if (result?.ok) {
    return (
      <span className="rounded-none bg-ok-bg px-1.5 py-0.5 text-[0.65rem] font-medium text-ok">
        ✓ validated
      </span>
    );
  }
  return (
    <span className="rounded-none bg-bad-bg px-1.5 py-0.5 text-[0.65rem] font-medium text-bad">
      × not valid
    </span>
  );
}

export default function CriterionField({ criterion, answer, onChange, requirement = 'required', result, stage, extra, pathway, subDomain }) {
  const value = answer?.value ?? '';
  const notes = answer?.notes ?? '';
  const badge = VERIFICATION_BADGE[criterion.verification] ?? VERIFICATION_BADGE.manual;
  const automated = criterion.verification === 'automated';
  const pending = automated && !result;
  const [descriptorArtifact, descriptorTab] = DESCRIPTOR_DRIVEN[criterion.id] ?? [];
  const locked = isLocked(criterion, stage);

  return (
    <div className="rounded-none border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-ink">{criterion.label}</span>
        <div className="flex shrink-0 gap-1">
          {requirement === 'recommended' && (
            <span className="rounded-none bg-info-bg px-1.5 py-0.5 text-[0.65rem] font-medium text-info">
              recommended
            </span>
          )}
          {locked && (
            <span className="rounded-none bg-warn-bg px-1.5 py-0.5 text-[0.65rem] font-medium text-warn">
              locked
            </span>
          )}
          {automated && <StatusPill pending={pending} result={result} />}
          <span className={`rounded-none px-1.5 py-0.5 text-[0.65rem] font-medium ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
      </div>

      <div className="mt-3">
        {descriptorArtifact ? (
          <p className="text-xs text-muted">
            Validated from the {descriptorArtifact}; complete and check it on the{' '}
            <Link to={`/export?tab=${descriptorTab}`} className="text-link underline">
              Export page
            </Link>
            .
          </p>
        ) : (
          <FieldInput
            criterion={criterion}
            value={value}
            onValue={(v) => onChange({ value: v })}
            pathway={pathway}
            subDomain={subDomain}
          />
        )}
      </div>

      {extra && <div className="mt-3">{extra}</div>}

      {automated && result && !result.ok && (
        <p className="mt-1 text-xs text-bad">{result.message}</p>
      )}

      {locked && (
        <p className="mt-1 text-xs text-warn">
          Reflects a past {criterion.lifecycle_stage} decision. Record what was done; if it falls
          short, document it as a known limitation rather than a gap to fix.
        </p>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted">Guidance</summary>
        <p className="mt-1 text-xs text-muted">{criterion.remediation}</p>
      </details>

      {!descriptorArtifact && (
        <input
          type="text"
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder={
            criterion.verification === 'attested'
              ? 'Evidence link or note (optional)'
              : 'Note (optional)'
          }
          className="mt-2 w-full rounded-none border border-line px-2 py-1 text-xs"
        />
      )}
    </div>
  );
}

function FieldInput({ criterion, value, onValue, pathway, subDomain }) {
  const t = criterion.evidence_type;

  if (t === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onValue(e.target.checked)}
        />
        Yes
      </label>
    );
  }

  if (t === 'controlled_vocabulary') {
    const { values, recommended } = optionsFor(criterion, pathway, subDomain);
    return <VocabSelect values={values} recommended={recommended} value={value} onValue={onValue} />;
  }

  if (t === 'text') {
    return (
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        className="w-full rounded-none border border-line px-2 py-1 text-sm"
      />
    );
  }

  // uri | identifier | file
  const placeholder = t === 'uri' ? 'https://…' : t === 'file' ? 'file name or link' : 'identifier';
  return (
    <input
      type={t === 'uri' ? 'url' : 'text'}
      value={value}
      onChange={(e) => onValue(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-none border border-line px-2 py-1 text-sm"
    />
  );
}

function VocabSelect({ values, recommended = [], value, onValue }) {
  const ids = values.map((v) => v.id);
  const CUSTOM = '__custom__';
  const [custom, setCustom] = useState(Boolean(value) && !ids.includes(value));

  // When some options are recommended for the current sub-domain, group them so
  // the distinction is visible rather than implied by ordering alone.
  const rec = values.filter((v) => recommended.includes(v.id));
  const rest = values.filter((v) => !recommended.includes(v.id));
  const opt = (v) => (
    <option key={v.id} value={v.id}>
      {v.label}
    </option>
  );

  return (
    <div>
      <select
        value={custom ? CUSTOM : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setCustom(true);
            onValue('');
          } else {
            setCustom(false);
            onValue(e.target.value);
          }
        }}
        className="w-full rounded-none border border-line px-2 py-1 text-sm"
      >
        <option value="">— select —</option>
        {rec.length > 0 ? (
          <>
            <optgroup label="Recommended for this sub-domain">{rec.map(opt)}</optgroup>
            <optgroup label="Other options">{rest.map(opt)}</optgroup>
          </>
        ) : (
          values.map(opt)
        )}
        <option value={CUSTOM}>Custom…</option>
      </select>
      {custom && (
        <input
          type="text"
          value={value}
          onChange={(e) => onValue(e.target.value)}
          placeholder="Custom value"
          className="mt-2 w-full rounded-none border border-line px-2 py-1 text-sm"
        />
      )}
    </div>
  );
}
