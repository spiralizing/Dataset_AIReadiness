// Wizard step 0 — lifecycle intake. The overview and the seven dimensions are
// presented as a compact horizontal carousel so the (required) starting-point
// selector stays near the top of the page.

import { Link, useNavigate } from 'react-router-dom';
import { STAGES } from '../lib/stages.js';
import { useAssessment } from '../state/assessment.jsx';
import Carousel from '../components/Carousel.jsx';

const STEPS = [
  ['1', 'Set your context', "Say where you are in the lifecycle and your publishing pathway. That fixes the requirement tier."],
  ['2', 'Assess seven dimensions', 'Answer a short form per dimension. Criteria validate live; a matrix shows met, unmet, or upcoming.'],
  ['3', 'Export the bundle', 'Download the datasheet, Croissant descriptor, PROV-O record, and a conformance report.'],
];

const DOC_LAYERS = [
  ['Datasheet / data card', 'Human-readable disclosure', 'What is it, and how should it be used?'],
  ['Croissant descriptor', 'ML-ready packaging · JSON-LD', 'How does an ML pipeline load it?'],
  ['PROV-O record', 'Operation-level lineage · JSON-LD', 'How was it produced?'],
];

const DIMENSIONS = [
  ['FAIRness', 'Findable, accessible, interoperable, and reusable — the dataset as a published artifact.'],
  ['Provenance', 'Sources, transformations, and versions: how the data came to be.'],
  ['Characterization', 'Distributions, coverage, missingness, and known limitations of the sample.'],
  ['Ethics', 'Consent, privacy, de-identification, licensing, and legitimate use.'],
  ['Pre-model Explainability', 'Variable meanings, units, encodings, and traceability to source.'],
  ['Sustainability', 'Long-term access, governance, and the compute cost of using the data.'],
  ['Computability', 'Machine-actionable schema and metadata for direct ingestion by ML pipelines.'],
];

function Node({ tone, icon, label, sub }) {
  const tones = {
    closed: 'border-warn-line bg-warn-bg',
    ready: 'border-ok-line bg-ok-bg',
  };
  return (
    <div className={`flex-1 border p-3 text-center ${tones[tone]}`}>
      <div className="text-2xl leading-none" aria-hidden="true">
        {icon}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-ink">{label}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </div>
  );
}

function Slide({ children }) {
  return <div className="h-full border border-line bg-surface p-6">{children}</div>;
}

const Eyebrow = ({ children }) => (
  <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{children}</span>
);

export default function StartingPoint() {
  const { state, dispatch } = useAssessment();
  const navigate = useNavigate();

  const select = (s) => {
    dispatch({ type: 'SET_STAGE', stage: s.id });
    if (s.suggestedPathway && !state.pathway) {
      dispatch({ type: 'SET_PATHWAY', pathway: s.suggestedPathway });
    }
  };

  const canContinue = Boolean(state.stage);

  return (
    <section>
      <Carousel label="About this tool">
        {/* Overview */}
        <Slide>
          <Eyebrow>What this tool is for</Eyebrow>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
            Make a dataset AI-ready — plan it, prepare it, or upgrade it
          </h1>
          <p className="mt-3 max-w-[62ch] text-sm text-muted">
            Use it at any point in the lifecycle: while <span className="font-medium text-ink">planning</span>{' '}
            a dataset you&rsquo;re about to collect, while <span className="font-medium text-ink">preparing</span>{' '}
            a collected dataset to publish, or to <span className="font-medium text-ink">upgrade</span> one that
            is already published. A dataset can be fully{' '}
            <a
              href="https://doi.org/10.1038/sdata.2016.18"
              target="_blank"
              rel="noreferrer"
              className="text-link underline"
            >
              FAIR
            </a>{' '}
            and still be unfit to train a model on — this tool
            runs a tiered assessment and generates the machine-readable documentation needed for reuse by people
            and pipelines. Not publishing yet? It also exports a to-do plan of what to set up.
          </p>
          <div
            className="mt-4 flex items-center gap-3"
            role="img"
            aria-label="A FAIR-published but ML-closed dataset becomes AI-ready after it is assessed and documented"
          >
            <Node tone="closed" icon="🔒" label="FAIR-published" sub="findable & accessible — but ML-closed" />
            <div className="flex shrink-0 flex-col items-center text-[10px] uppercase tracking-wide text-faint">
              <span>assess</span>
              <span className="my-0.5 text-lg leading-none text-accent" aria-hidden="true">→</span>
              <span>document</span>
            </div>
            <Node tone="ready" icon="✓" label="AI-ready" sub="reusable by people & pipelines" />
          </div>
        </Slide>

        {/* Documentation layers */}
        <Slide>
          <Eyebrow>What you&rsquo;ll produce</Eyebrow>
          <h2 className="mt-1 text-xl font-semibold text-ink">The documentation layers</h2>
          <p className="mt-2 text-sm text-muted">
            Three machine-readable layers compose into an AI-ready dataset — each answers a
            different question, and none replaces the others.
          </p>
          <p className="mt-1 text-xs text-muted">
            Datasheets (
            <a href="https://doi.org/10.1145/3458723" target="_blank" rel="noreferrer" className="text-link underline">Gebru et al., 2021</a>
            ), Croissant (
            <a href="https://doi.org/10.1145/3650203.3663326" target="_blank" rel="noreferrer" className="text-link underline">Akhtar et al., 2024</a>
            ), PROV-O (
            <a href="https://www.w3.org/TR/prov-o/" target="_blank" rel="noreferrer" className="text-link underline">Lebo et al., 2013</a>
            ).
          </p>
          <div className="mt-4 grid gap-2">
            {DOC_LAYERS.map(([name, fmt, q]) => (
              <div
                key={name}
                className="flex items-center justify-between gap-3 border border-line bg-surface-2 p-3"
              >
                <div>
                  <div className="text-sm font-semibold text-ink">{name}</div>
                  <div className="text-[11px] text-muted">{fmt}</div>
                </div>
                <div className="max-w-[46%] text-right text-xs italic text-muted">{q}</div>
              </div>
            ))}
            <div className="mt-1 text-center text-xs font-semibold text-accent">
              together → an AI-ready dataset
            </div>
          </div>
        </Slide>

        {/* How it works */}
        <Slide>
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-1 text-xl font-semibold text-ink">Three steps</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {STEPS.map(([n, title, body]) => (
              <div key={n} className="border border-line bg-surface-2 p-4">
                <span className="grid h-6 w-6 place-items-center bg-accent text-xs font-bold text-white">
                  {n}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-xs text-muted">{body}</p>
              </div>
            ))}
          </div>
        </Slide>

        {/* Seven dimensions */}
        <Slide>
          <Eyebrow>What you&rsquo;ll assess</Eyebrow>
          <h2 className="mt-1 text-xl font-semibold text-ink">The seven dimensions</h2>
          <p className="mt-2 text-xs text-muted">
            Dimensions from Bridge2AI (
            <a href="https://doi.org/10.1101/2024.10.23.619844" target="_blank" rel="noreferrer" className="text-link underline">Clark et al., 2026</a>
            ); levels align to Data Readiness Levels (
            <a href="https://doi.org/10.48550/arXiv.1705.02245" target="_blank" rel="noreferrer" className="text-link underline">Lawrence, 2017</a>
            ) and the FAIR Maturity Indicators (
            <a href="https://doi.org/10.5334/dsj-2020-041" target="_blank" rel="noreferrer" className="text-link underline">Bahim et al., 2020</a>
            ). See{' '}
            <Link to="/references" className="text-link underline">all references</Link>.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {DIMENSIONS.map(([name, blurb]) => (
              <div key={name} className="border border-line bg-surface-2 p-3">
                <div className="text-sm font-semibold text-ink">{name}</div>
                <p className="mt-0.5 text-xs text-muted">{blurb}</p>
              </div>
            ))}
          </div>
        </Slide>
      </Carousel>

      <p className="mt-4 text-center text-xs text-muted">
        Prefer to see it filled in?{' '}
        <Link to="/examples" className="text-link underline">Load a worked example</Link>.
      </p>

      {/* Starting point — required before continuing */}
      <div className="mt-8 border border-accent bg-surface p-5">
        <span className="inline-flex items-center bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
          Start here
        </span>
        <h2 className="mt-3 text-xl font-semibold">Where are you in the dataset lifecycle?</h2>
        <p className="mt-2 text-sm text-muted">
          This tailors the guidance. It doesn&rsquo;t change which criteria apply — your audience
          (next step) does that — but it frames them for your situation.
        </p>
        <p className="mt-1 text-xs font-semibold text-accent">Required — choose one to continue.</p>

        <div className="mt-4 grid gap-3">
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => select(s)}
              aria-pressed={state.stage === s.id}
              className={`w-full border p-4 text-left transition-colors ${
                state.stage === s.id ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-muted'
              }`}
            >
              <span className="font-semibold">{s.title}</span>
              <p className="mt-1 text-sm text-muted">{s.question}</p>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => navigate('/audience')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              canContinue
                ? 'bg-brand-btn text-surface hover:opacity-90'
                : 'cursor-not-allowed bg-idle-bg text-idle'
            }`}
          >
            Continue →
          </button>
          {!canContinue && (
            <span className="text-xs text-muted">Select your starting point to continue.</span>
          )}
        </div>
      </div>
    </section>
  );
}
