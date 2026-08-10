# AI-Readiness Assessment & Documentation builder

An interactive, browser-based tool that helps researchers assess whether their datasets are ready for publication, community sharing, or AI/ML training. The app implements the tiered assessment framework from *A framework for assessing and documenting research data for machine learning reuse* (González-Espinoza et al., 2026), combining the seven pre-model dimensions of the Bridge2AI Standards Working Group, the Data Readiness Levels of Lawrence, and the FAIR Maturity Indicators.

🔗 **Live app:** https://spiralizing.github.io/Dataset_AIReadiness/

## What it does

The tool walks a researcher through a structured self-assessment of their dataset across seven dimensions — FAIRness, Provenance, Characterization, Ethics, Pre-model Explainability, Sustainability, and Computability — and three readiness levels (L1 Accessible, L2 Faithful, L3 Task-ready). The required criteria for each dimension depend on where the researcher intends to publish or use the dataset.

At the end of the assessment, the app generates:

- a machine-readable **assessment report** (JSON)
- a **datasheet** or **healthsheet** in Markdown (Gebru et al. 2021; Rostamzadeh et al. 2022)
- a **Croissant** JSON-LD descriptor for ML-framework consumption (MLCommons 2024)
- a **PROV-O** JSON-LD provenance record (W3C 2013)
- a release-ready bundle combining all of the above

Before any of that, it also produces a **collection guide**: what to write down while the work is happening, so those documents are fillable later. See [Collection guide](#collection-guide).

## Audience pathways

The audience selector drives which criteria are required vs. optional. A researcher picks one pathway at the start:

| Pathway | Tier | Use case |
|---|---|---|
| **A — Accessible** | L1 | Publishing on Figshare, an institutional repository, GitHub, or as paper supplementary material. DOI + basic metadata. Croissant descriptor **recommended** (not required) — including one at L1 makes the dataset trivially upgradable to L2 later and ML-loadable today. |
| **B — Faithful** | L2 | Publishing on Hugging Face, Kaggle, OpenML, or Dataverse. ML-ready metadata expected; Croissant descriptor required. |
| **C — Task-ready** | L3 | Dataset intended to support model training in a regulated, sensitive, or high-stakes reuse setting — biomedical, clinical, institutional human-subjects, or a physical-science discipline with its own encoding and provenance standards. Full provenance, bias audit, ethics-as-metadata, model-card linkage. |

Pathway C includes a **sub-selector** that adds discipline-specific L3 criteria and pre-fills candidate deposition targets under FAIRness. Each overlay declares the dimension it belongs to, so a sub-domain is not confined to Ethics — the biomedical sub-domains overlay Ethics only, because that is where their distinguishing evidence lives, while Materials science also overlays FAIRness, Provenance, and Characterization. Overlays are additive: no sub-domain removes or relaxes anything in the base matrix.

- *General* (default) — standard L3 ethics evidence. Targets: PhysioNet, NIH Data Commons, generalist repositories with controlled-access tier.
- *Clinical / health* — swaps in the healthsheet template, surfaces IRB protocol ID and HIPAA de-identification method. Targets: **CHoRUS** (Bridge2AI Clinical Care Grand Challenge), PhysioNet, MIMIC-style controlled-access repositories.
- *Genomic / functional-genomics* — surfaces consent type, dbGaP accession, re-identification risk. Targets: **CM4AI** (Bridge2AI Cell Maps for AI Grand Challenge), dbGaP, GenBank for non-restricted derivatives.
- *Voice / public-health biomarker* — surfaces speaker consent, demographic representation audit, and accent / language coverage. Target: **Bridge2AI-Voice** (Voice as a Biomarker of Health Grand Challenge).
- *Institutional / human-subjects* — surfaces IRB and tiered-access policy. Targets: institutional Dataverse instances with restricted-access tier, ICPSR for social-science human-subjects data.
- *Materials science (computational & experimental)* — the first non-biomedical sub-domain, and the one that motivated making overlays dimension-aware. Surfaces domain-repository deposition, discipline encoding (CIF for crystal structures, NeXus for neutron/X-ray/muon experiments, CML for molecules), shared-vocabulary interoperability (EMMO, OPTIMADE, NOMAD Metainfo), a-priori provenance capture (AiiDA, FireWorks/atomate, signac, Nextflow + nf-prov, CWLProv, Workflow-Run RO-Crate), per-run instrument or computational parameters, and — in place of consent — the licensing and redistribution terms of third-party source data. Targets: **NOMAD**, **Materials Cloud Archive**, OQMD, ICSD, with Zenodo/Figshare/Dryad marked explicitly as a generalist fallback. Validators referenced: checkCIF (IUCr), cnxvalidate, optimade-validator.

The four Bridge2AI Grand Challenges (CM4AI, CHoRUS, Bridge2AI-Voice, AI-READI) are named explicitly in Clark et al. [1] as the originating context for the seven-dimension framework, so aligning Pathway C deposition targets to them keeps the assessment criteria and the candidate repositories consistent. The Materials science sub-domain is the first extension beyond that biomedical origin: it demonstrates that the seven dimensions transfer to a discipline where the binding constraint is not consent but encoding, ontology mapping, and provenance-by-construction — captured as the workflow runs, because at high throughput it cannot be reconstructed afterward.

## How it works

The assessment matrix (7 dimensions × 3 levels) is encoded as a JSON schema separate from the UI. Each criterion declares which pathways require it (`required_in_pathways`) and, where relevant, which merely recommend it (`recommended_in_pathways`) — Croissant at L1 is the standing example. The audience pathway therefore sets the required threshold per dimension; recommended-but-unmet criteria are surfaced as "additional strengths" without affecting the tier verdict.

The review screen shows a 7×3 heatmap. A cell turns green only when all its required criteria are satisfied. Unmet criteria surface inline remediation hints with section references back to the source paper.

## Features

- **Wizard flow** — starting point → audience selector → seven dimension pages → review/scorecard → export, with the collection guide reachable at any time
- **Prefilled options** drawn from controlled vocabularies in the source paper: licenses (CC-BY, CC0, ODbL), formats (Parquet, HDF5, NetCDF, Zarr, DICOM, NIfTI), repositories by tier — L1 (Figshare, Zenodo, institutional, GitHub), L2 (Hugging Face, Kaggle, OpenML, Dataverse, Dryad), L3 generic (PhysioNet, NIH Data Commons, dbGaP, ICPSR, GenBank), L3 Bridge2AI Grand Challenges (CM4AI, CHoRUS, Bridge2AI-Voice, AI-READI). Discipline vocabularies extend the same mechanism — Materials science adds repositories (NOMAD, Materials Cloud, OQMD, ICSD), encoding standards (CIF, NeXus, CML), an interoperability layer (EMMO, OPTIMADE, NOMAD Metainfo), and provenance engines (AiiDA, FireWorks, signac, nf-prov, CWLProv). "Custom" entry always available.
- **Binary checkmark heatmap** — pass/fail per cell, optional-criteria list below the heatmap
- **Three template generators** — Croissant, PROV-O, datasheet/healthsheet. The datasheet is editable before download; the Croissant descriptor and PROV-O record are composed from their builders, with raw JSON-LD editing available as an explicit, reversible override
- **Inlined seeded examples** — seven reference datasets shipped with the bundle:
  - Tabular Zenodo dataset (Pathway A)
  - Hugging Face dataset with Croissant descriptor (Pathway B)
  - BIDS neuroimaging dataset
  - Synthetic MIMIC-shaped clinical dataset (Pathway C → Clinical, CHoRUS-aligned)
  - Synthetic CM4AI-style cell-mapping dataset (Pathway C → Genomic)
  - α-quartz XRD + DFT relaxation (Pathway C → Materials science; built through the Croissant builder)
  - High-energy physics ROOT example (illustrates FAIR-for-models linkage)
- **Collection guide** — a printable worksheet of what to observe and when, generated from the same criteria (see below)
- **Two authoring builders** — files and columns compose the Croissant descriptor; sources and steps compose the PROV-O record, so neither requires hand-written JSON-LD
- **Offline-capable** — once loaded, the app runs entirely in the browser with no external runtime calls

## Collection guide

The assessment asks for a Croissant descriptor and a provenance record. Neither is fillable unless
somebody wrote the right things down while the work was happening, and by the time the assessment is
run it is usually too late: instrument settings, operator, calibration state, and consent wording are
available at the moment of collection and progressively harder to recover after it.

The **Research data collection guide** (its own entry in the top navigation, or `/guide`) closes that
gap. It covers:

- **The four forms of a record** — paper notebook → electronic lab notebook → structured capture
  (templated ELN, LIMS, or an instrument export in a disciplinary format) → machine-actionable
  (Croissant and PROV-O, terms bound to shared vocabularies). One worked observation is carried
  through all four, with what each form gains, what it still withholds, and how strongly it obliges
  you to adopt a standard. Where acquisition is semi-automated or fully automated, the progression
  collapses: the engine writes the machine-actionable record in real time with the experiment.
- **The six questions** — who, what, when, where, why, how, and which artifact each answer lands in.
  This is why the tool emits more than one document: Croissant answers *what*, PROV-O answers
  *how it came to be*.
- **What builds each documentation layer** — the records a project already keeps, mapped onto the
  artifact they populate, over the identifier and vocabulary schemes (ORCID, ROR, RRID, PIDINST, DOI,
  SPDX, UCUM, LOINC/SNOMED, EMMO) that ground all three.
- **A per-run log template** and a **worksheet** of every observation the selected pathway will ask
  for, grouped by the lifecycle stage at which it is still capturable. The acquisition group comes
  first because it is the only one that becomes unrecoverable.
- **Binding terms to shared vocabularies** (Pathway C), with three worked examples, and a survey of
  the tools that reduce the burden: workflow engines that emit provenance as a by-product, formats
  that carry their own metadata, ELN/LIMS, identifier schemes, metadata templates, and repositories
  that parse structured metadata from raw output.

The worksheet is generated from the same criteria as the assessment, so adding a criterion or a
sub-domain overlay extends the guide with no separate edit. Criteria carry a `collection_hint` (what
to record, at the time) distinct from `remediation` (how to close a gap); L3 criteria and all
sub-domain overlays have one, and the rest fall back to their remediation text.

It is available three ways: **on screen**, as a **Markdown download**, and as a **PDF** through the
browser's print dialog. The PDF is a separate rendering rather than a print stylesheet over the web
page — serif body sized in points, numbered sections, a contents list, tables in place of coloured
chips, and a masthead and colophon so a page found on its own still says what it describes.

## Tech stack

- **React** + **Vite** for the static bundle
- **Tailwind CSS** for styling
- **zod** for JSON-Schema validation of user inputs (also used to validate generated Croissant descriptors against the bundled MLCommons schema)
- **HashRouter** for deep links on GitHub Pages without server-side rewrites
- Plain-JS JSON-LD construction (no Node runtime required at load time)
- **`localStorage`** for resumable in-progress assessments, plus a **JSON export** of the whole record as an archival artifact. `localStorage` is a prototype-grade choice (private-browsing tabs disable it, and it is per-origin/per-browser), so an assessment resumes in the same browser but does not travel between devices

## Repository structure

```
Dataset_AIReadiness/
├── index.html · vite.config.js · package.json
├── public/favicon.svg
├── src/
│   ├── main.jsx                     # React root + HashRouter + AssessmentProvider
│   ├── App.jsx                      # route table
│   ├── routes/
│   │   ├── StartingPoint.jsx        # lifecycle intake (index route)
│   │   ├── AudienceSelector.jsx     # pathway + Pathway-C sub-domain
│   │   ├── DimensionPage.jsx        # one page per dimension, schema-driven
│   │   ├── Review.jsx               # 7×3 heatmap + verdict
│   │   ├── Export.jsx               # tabbed release bundle
│   │   ├── Guide.jsx                # collection guide, readable and printable
│   │   ├── Examples.jsx · References.jsx
│   ├── components/
│   │   ├── Layout.jsx · Carousel.jsx · CriterionField.jsx
│   │   ├── guidance.jsx             # ladder / questions / layer-input blocks (shared)
│   │   ├── CollectionGuide.jsx      # the guide on screen
│   │   ├── CollectionGuidePrint.jsx # the guide as a paper document
│   │   ├── CroissantBuilder.jsx     # files + record sets -> Croissant
│   │   └── ProvenanceBuilder.jsx    # sources + steps -> PROV-O
│   ├── lib/
│   │   ├── dimensions.js · pathway.js · stages.js
│   │   ├── depositionTargets.js     # pathway/sub-domain-scoped repository options
│   │   ├── grounding.js · croissantValidation.js · provoValidation.js · validation.js
│   │   ├── shacl.js · report.js · thisWork.js · download.js
│   ├── generators/
│   │   └── croissant.js · provo.js · datasheet.js · todo.js · collectionGuide.js
│   ├── schema/
│   │   ├── matrix.json              # 7×3 assessment matrix
│   │   ├── pathways.json            # A / B / C; six Pathway-C sub-domains with L3 overlays
│   │   ├── vocabularies.json        # licenses, formats, repositories, discipline vocabularies
│   │   ├── validators.json          # discipline-validator registry
│   │   ├── references.json          # citation registry
│   │   └── guidance.json            # standing guidance prose (ladder, questions, examples)
│   ├── examples/build.js · index.js # seven correct-by-construction records
│   ├── shapes/provo.shapes.ttl      # SHACL profile for the PROV-O record
│   ├── assets/                      # CMU + TRDA logos
│   └── styles/tailwind.css
├── tests/                           # vitest: schema validity, generators, validators, examples
└── .github/workflows/deploy.yml     # build + test + gh-pages deploy
```

## Getting started

### Run locally

```bash
git clone https://github.com/spiralizing/Dataset_AIReadiness.git
cd Dataset_AIReadiness
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`.

### Build for production

```bash
npm run build
```

The static bundle is written to `dist/`.

### Deploy to GitHub Pages

The included workflow at `.github/workflows/deploy.yml` builds and deploys on every push to `main`. To enable:

1. In repo settings, set **Pages → Source** to `GitHub Actions`.
2. Push to `main`.

If you fork this under a different repository name, update `base` in `vite.config.js` to match it (currently `/Dataset_AIReadiness/`), or the built assets will 404.

## Customizing the assessment

The assessment matrix lives at `src/schema/matrix.json`. Each entry describes one criterion:

```json
{
  "id": "fairness.l2.croissant_descriptor",
  "dimension": "FAIRness",
  "level": "L2",
  "label": "Croissant 1.0 descriptor present and validates against the MLCommons schema",
  "evidence_type": "boolean",
  "verification": "automated",
  "lifecycle_stage": "documentation",
  "required_in_pathways": ["B", "C"],
  "recommended_in_pathways": ["A"],
  "references": ["Akhtar2024", "Clark2026"],
  "remediation": "Use the in-app Croissant generator. Including a descriptor at L1 makes the dataset directly ML-loadable today and trivially upgradable to L2."
}
```

`required_in_pathways` follows the cumulative ladder (L1 → A/B/C, L2 → B/C, L3 → C) and is
test-enforced. `verification` is `automated`, `attested`, or `manual`; `lifecycle_stage` drives
whether a criterion shows as active, locked, or upcoming given the researcher's starting point.
`evidence_type` selects the input widget, and `controlled_vocabulary` criteria name a
`vocabulary_key` resolved in `vocabularies.json`.

To create a domain-tuned variant (e.g., a high-energy-physics profile), edit `matrix.json` and rebuild. The schema files are plain JSON with no code references to individual criteria, so a discipline profile is a data change. (Loading a tuned schema at runtime, without a rebuild, is a possible future extension rather than a current feature.)

### Adding a discipline sub-domain

A discipline that needs extra L3 criteria is added as a Pathway C sub-domain in `src/schema/pathways.json`, without touching the base matrix. One entry supplies the label, the deposition-target vocabulary, the documentation template (`datasheet` or `healthsheet`), and an `overlay` array. Each overlay entry names the `dimension` it belongs to, so it is merged into that dimension's page, that cell of the heatmap, and the matching section of the generated datasheet — no component code changes. The overlay's `remediation` string is what the researcher reads as fill-in guidance, so it is where the concrete field names of the discipline's standards belong.

The supporting data lives alongside it: controlled vocabularies in `vocabularies.json` (referenced by `vocabulary_key`), any discipline validators in `validators.json`, and citations in `references.json` (every key in an overlay's `references` array must resolve there — `tests/matrix.test.js` enforces this, along with L3 scoping, id uniqueness against the base matrix, and vocabulary resolution). The Materials science sub-domain is the worked example of the full pattern.

## References

The framework, dimensions, and templates implemented here are drawn from:

1. Clark, T. et al. (2024–2026). *AI-readiness for Biomedical Data: Bridge2AI Recommendations.* bioRxiv 2024.10.23.619844 (multiple revisions; v5 dated 23 March 2026). doi:10.1101/2024.10.23.619844
2. Lawrence, N. D. (2017). *Data Readiness Levels.* arXiv:1705.02245 [cs.DB], 5 May 2017. doi:10.48550/arXiv.1705.02245
3. Bahim, C., Casorrán-Amilburu, C., Dekkers, M., Herczog, E., Loozen, N., Repanas, K., Russell, K., & Stall, S. (2020). *The FAIR Data Maturity Model: An Approach to Harmonise FAIR Assessments.* Data Science Journal 19(1): 41. doi:10.5334/dsj-2020-041
4. Wilkinson, M. D., Dumontier, M., Aalbersberg, IJ. J., et al. (2016). *The FAIR Guiding Principles for scientific data management and stewardship.* Scientific Data 3: 160018. doi:10.1038/sdata.2016.18
5. Akhtar, M., Benjelloun, O., Conforti, C., et al. (2024). *Croissant: A Metadata Format for ML-Ready Datasets.* In *Proceedings of the Eighth Workshop on Data Management for End-to-End Machine Learning (DEEM '24)*, Santiago, Chile, 9 June 2024, pp. 1–6. doi:10.1145/3650203.3663326
6. Lebo, T., Sahoo, S., & McGuinness, D. (eds.) (2013). *PROV-O: The PROV Ontology.* W3C Recommendation, 30 April 2013. https://www.w3.org/TR/prov-o/
7. Gebru, T., Morgenstern, J., Vecchione, B., Wortman Vaughan, J., Wallach, H., Daumé III, H., & Crawford, K. (2021). *Datasheets for Datasets.* Communications of the ACM 64(12): 86–92. doi:10.1145/3458723
8. Mitchell, M., Wu, S., Zaldivar, A., et al. (2019). *Model Cards for Model Reporting.* In *Proceedings of the Conference on Fairness, Accountability, and Transparency (FAT\* '19)*, Atlanta, GA, USA, 29–31 January 2019, pp. 220–229. doi:10.1145/3287560.3287596
9. Rostamzadeh, N., Mincu, D., Roy, S., et al. (2022). *Healthsheet: Development of a Transparency Artifact for Health Datasets.* In *Proceedings of the 2022 ACM Conference on Fairness, Accountability, and Transparency (FAccT '22)*, Seoul, Republic of Korea, 21–24 June 2022, pp. 1943–1961. doi:10.1145/3531146.3533239
10. Ravi, N., Chaturvedi, P., Huerta, E. A., et al. (2022). *FAIR principles for AI models with a practical application for accelerated high energy diffraction microscopy.* Scientific Data 9: 657. doi:10.1038/s41597-022-01712-9

The app's References page renders this list from `src/schema/references.json`, with resolvable DOI links.

### Materials science sub-domain

Most of the sources the Materials science overlay cites are now in the framework paper's bibliography and carry its reference number in the registry (Ghiringhelli et al. 2023 and Huber et al. 2020 among them). Five are cited only by the overlay and not by the paper. They are held in the same registry (`src/schema/references.json`, marked `source: "materials-guidance"` and carrying no `ref`) and render after the numbered list on the app's References page.

- Hall, S. R., Allen, F. H., & Brown, I. D. (1991). *The crystallographic information file (CIF): a new standard archive file for crystallography.* Acta Crystallographica A47(6): 655–685. doi:10.1107/S010876739101067X
- Andersen, C. W. et al. (2021). *OPTIMADE, an API for exchanging materials data.* Scientific Data 8: 217. doi:10.1038/s41597-021-00974-z
- European Materials Modelling Council (2021). *EMMO — Elementary Multiperspective Material Ontology.* https://emmo-repo.github.io/
- Pizzi, G., Cepellotti, A., Sabatini, R., Marzari, N., & Kozinsky, B. (2016). *AiiDA: automated interactive infrastructure and database for computational science.* Computational Materials Science 111: 218–230. doi:10.1016/j.commatsci.2015.09.013
- Ó Carragáin, E., Goble, C., Sefton, P., & Soiland-Reyes, S. (2019). *A lightweight approach to research object data packaging (RO-Crate).* BOSC 2019, ISMB/ECCB. doi:10.5281/zenodo.3250687

## License

The application code is released under the MIT License. The assessment framework it implements is documented in the source paper cited above; see that paper for attribution requirements when adapting the framework itself.

## Citation

Cite the **framework paper** when you use the tiered assessment model itself — the seven dimensions, the L1/L2/L3 levels, or the audience pathways — in a study or in your own tooling.

Cite the **software** when you use the app to produce artifacts you ship or publish: a datasheet or healthsheet, a Croissant descriptor, a PROV-O provenance record, a release bundle, or a machine-readable assessment report. In practice this is the more common case — the documentation builder is what most users take away, and datasets released with artifacts generated here should point back to it so the templates and vocabularies used are traceable.

```bibtex
@misc{gonzalez2026airready,
  title  = {A framework for assessing and documenting research data
            for machine learning reuse},
  author = {González-Espinoza, Alfredo and others},
  year   = {2026},
  institution = {Carnegie Mellon University, University Libraries}
}

@software{airready_app_2026,
  title   = {AI-Readiness Assessment and Documentation Builder:
             a browser-based generator for datasheets, Croissant
             descriptors, and PROV-O provenance records},
  author  = {González-Espinoza, Alfredo and others},
  year    = {2026},
  version = {0.1.0},
  url     = {https://github.com/spiralizing/Dataset_AIReadiness},
  note    = {Live app: https://spiralizing.github.io/Dataset_AIReadiness/}
}
```

The documentation artifacts the builder emits implement published templates and specifications that carry their own attribution: datasheets (Gebru et al. 2021), healthsheets (Rostamzadeh et al. 2022), Croissant (Akhtar et al. 2024), and PROV-O (W3C 2013). Cite those alongside this tool when the artifact itself is the object of discussion — see [References](#references).

## Contributing

Issues and pull requests are welcome. For substantive changes to the assessment matrix itself, please open an issue first describing the rationale and the source it derives from — the matrix is intended to track the published framework, and divergences should be documented.

## AI Disclosure Statement

This project was built using GitHub Co-pilot as autocomplete, Claude Code (Opus 4.8 in manual mode) for most of the webpage architecture, backend and documentation, and the chatbot version of Claude Opus 4.8 for the visual design. Everything generated with LLMs was planned prior execution and revised after generation, sometimes with iterated prompts, most of the content was edited before publishig. Not a single LLM-generated content was produced by using _zero-shot_ techniques or with Agents (automatic delegation). The authors of this project are thankful to Open Science and all the contributors of Open Source that made the training data for Large Language Models possible. 

## Contact

Alfredo González-Espinoza · agonzal3@andrew.cmu.edu · Carnegie Mellon University Libraries
