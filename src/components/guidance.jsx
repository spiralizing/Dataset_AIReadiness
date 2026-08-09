// Presentational blocks over src/schema/guidance.json, shared by the intro cards
// on the start page and by the generated collection guide.
//
// They live here rather than inline in StartingPoint because both surfaces must
// show the same thing: the cards are the short version a reader meets first, the
// guide is the printable long version, and two implementations of the ladder
// would diverge the way the app and the preprint figure already did once.

import { Fragment } from 'react';
import guidance from '../schema/guidance.json';

// The four forms an experimental record passes through, as a horizontal strip
// with the intervention that reaches each one. Scrolls rather than wraps: the
// left-to-right progression is the content, so wrapping would misrepresent it.
export function LadderStrip({ className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="flex min-w-[40rem] items-stretch gap-1">
        {guidance.ladder.map((r) => (
          <Fragment key={r.rung}>
            {r.via && (
              <div className="flex w-24 shrink-0 flex-col items-center justify-center px-1">
                <span className="text-lg leading-none text-accent" aria-hidden="true">→</span>
                <span className="mt-1 text-center text-[0.65rem] leading-tight text-muted">{r.via}</span>
              </div>
            )}
            <div className={`flex-1 border p-3 text-center ${r.tone}`}>
              <div className="text-2xl leading-none" aria-hidden="true">{r.icon}</div>
              <div className="mt-1 text-xs font-semibold text-ink">{r.rung}</div>
              <div className="mt-0.5 text-[0.65rem] leading-tight text-muted">{r.kind}</div>
              <div className="mt-2 border-t border-line pt-1 text-[0.65rem] font-medium text-ink">
                {r.obligation}
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// Where the record is written by machine the progression is bypassed entirely.
export function AutomationNote({ className = '' }) {
  const a = guidance.automation;
  return (
    <div className={`border border-dashed border-accent bg-surface-2 p-3 ${className}`}>
      <div className="flex items-baseline gap-2">
        <span className="text-base leading-none" aria-hidden="true">{a.icon}</span>
        <span className="text-xs font-semibold text-ink">{a.title}</span>
      </div>
      <p className="mt-1 text-xs text-muted">{a.text}</p>
      <p className="mt-1 font-mono text-[0.65rem] text-faint">{a.examples}</p>
    </div>
  );
}

// One block per form: the record as it looks, what it buys, what it withholds.
// `slice` renders a contiguous subset, so the start page can split the four forms
// across two cards without either one becoming an outlier in height. Omitted, all
// four render, which is what the printable guide wants.
export function LadderDetail({ className = '', slice }) {
  const forms = slice ? guidance.ladder.slice(slice[0], slice[1]) : guidance.ladder;
  return (
    <div className={`grid gap-2 ${className}`}>
      {forms.map((r) => (
        <div key={r.rung} className="break-inside-avoid border border-line p-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-base leading-none" aria-hidden="true">{r.icon}</span>
            <span className="text-sm font-semibold text-ink">{r.rung}</span>
            <span className="text-[0.7rem] text-muted">{r.obligation}</span>
          </div>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap border border-line bg-surface p-2 font-mono text-[0.7rem] text-ink">
            {r.sample}
          </pre>
          <p className="mt-2 text-xs text-muted">
            <span className="font-medium text-ink">Gains:</span> {r.gains}{' '}
            <span className="font-medium text-ink">Still out of reach:</span> {r.out_of_reach}
          </p>
          <p className="mt-1 text-xs text-muted">
            <span className="font-medium text-ink">Standards:</span> {r.standards}
          </p>
        </div>
      ))}
    </div>
  );
}

// The six wh-questions and the artifact each answer lands in.
export function WhQuestions({ className = '' }) {
  return (
    <div className={`grid gap-2 ${className}`}>
      {guidance.wh_questions.map((w) => (
        <div key={w.q} className="break-inside-avoid border border-line bg-surface-2 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-accent">{w.q}</span>
            <span className="text-[0.7rem] italic text-muted">{w.lands}</span>
          </div>
          <p className="mt-1 text-xs text-muted">{w.record}</p>
        </div>
      ))}
    </div>
  );
}

// What already exists in a lab or a repo, mapped onto the layer it populates,
// over a band of the identifier and vocabulary schemes that ground all three.
export function DocumentationInputs({ className = '' }) {
  const { layers, grounding } = guidance.documentation_inputs;
  return (
    <div className={className}>
      <div className="grid gap-3 sm:grid-cols-3">
        {layers.map((l) => (
          <div key={l.layer} className="flex flex-col break-inside-avoid">
            <div className={`border p-2 text-center text-sm font-semibold text-ink ${l.tone}`}>
              {l.layer}
            </div>
            <span className="my-1 text-center text-lg leading-none text-accent" aria-hidden="true">↑</span>
            <ul className="grid gap-1">
              {l.sources.map((s) => (
                <li key={s} className="border border-line bg-surface px-2 py-1 text-[0.7rem] text-muted">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-center gap-16 text-lg leading-none text-accent" aria-hidden="true">
        <span>↑</span>
        <span>↑</span>
        <span>↑</span>
      </div>

      <div className="mt-1 border border-dashed border-line bg-surface-2 p-3 text-center">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
          {grounding.label}
        </span>
        <p className="mt-1 font-mono text-xs text-ink">{grounding.schemes.join(' · ')}</p>
        <p className="mt-1 text-[0.7rem] text-muted">{grounding.note}</p>
      </div>
    </div>
  );
}
