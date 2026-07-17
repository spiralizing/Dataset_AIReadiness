# AI-Readiness Assessment

An interactive, browser-based tool that helps researchers assess whether their datasets are ready for publication, community sharing, or AI/ML training. The app implements the tiered assessment framework from *A practical AI-readiness assessment for Research Data* (González-Espinoza, 2026), combining the seven pre-model dimensions of the Bridge2AI Standards Working Group, the Data Readiness Levels of Lawrence, and the FAIR Maturity Indicators.

🔗 **Live app:** https://<your-username>.github.io/ai-readiness-assessment/

## What it does

The tool walks a researcher through a structured self-assessment of their dataset across seven dimensions — FAIRness, Provenance, Characterization, Ethics, Pre-model Explainability, Sustainability, and Computability — and three readiness levels (L1 Accessible, L2 Faithful, L3 Task-ready). The required criteria for each dimension depend on where the researcher intends to publish or use the dataset.

At the end of the assessment, the app generates:

- a machine-readable **assessment report** (JSON)
- a **datasheet** or **healthsheet** in Markdown (Gebru et al. 2021; Rostamzadeh et al. 2022)
- a **Croissant** JSON-LD descriptor for ML-framework consumption (MLCommons 2024)
- a **PROV-O** JSON-LD provenance record (W3C 2013)
- a release-ready bundle combining all of the above

## Audience pathways

The audience selector drives which criteria are required vs. optional. A researcher picks one pathway at the start:

| Pathway | Tier | Use case |
|---|---|---|
| **A — Accessible** | L1 | Publishing on Figshare, an institutional repository, GitHub, or as paper supplementary material. DOI + basic metadata. Croissant descriptor **recommended** (not required) — including one at L1 makes the dataset trivially upgradable to L2 later and ML-loadable today. |
| **B — Faithful** | L2 | Publishing on Hugging Face, Kaggle, OpenML, or Dataverse. ML-ready metadata expected; Croissant descriptor required. |
| **C — Task-ready** | L3 | Dataset intended to support model training in regulated or sensitive domains (biomedical, clinical, institutional human-subjects). Full provenance, bias audit, ethics-as-metadata, model-card linkage. |

Pathway C includes a **sub-selector** that refines the Ethics column and pre-fills candidate deposition targets under FAIRness:

- *General* (default) — standard L3 ethics evidence. Targets: PhysioNet, NIH Data Commons, generalist repositories with controlled-access tier.
- *Clinical / health* — swaps in the healthsheet template, surfaces IRB protocol ID and HIPAA de-identification method. Targets: **CHoRUS** (Bridge2AI Clinical Care Grand Challenge), PhysioNet, MIMIC-style controlled-access repositories.
- *Genomic / functional-genomics* — surfaces consent type, dbGaP accession, re-identification risk. Targets: **CM4AI** (Bridge2AI Cell Maps for AI Grand Challenge), dbGaP, GenBank for non-restricted derivatives.
- *Voice / public-health biomarker* — surfaces speaker consent, demographic representation audit, and accent / language coverage. Target: **Bridge2AI-Voice** (Voice as a Biomarker of Health Grand Challenge).
- *Salutogenesis / multi-modal precision health* — surfaces multi-modal alignment provenance, longitudinal consent, and modality-specific de-identification. Target: **AI-READI** (Artificial Intelligence Ready and Equitable Atlas for Diabetes Insights Grand Challenge).
- *Institutional / human-subjects* — surfaces IRB and tiered-access policy. Targets: institutional Dataverse instances with restricted-access tier, ICPSR for social-science human-subjects data.

The four Bridge2AI Grand Challenges (CM4AI, CHoRUS, Bridge2AI-Voice, AI-READI) are named explicitly in Clark et al. [1] as the originating context for the seven-dimension framework, so aligning Pathway C deposition targets to them keeps the assessment criteria and the candidate repositories consistent.

## How it works

The assessment matrix (7 dimensions × 3 levels) is encoded as a JSON schema separate from the UI. Each criterion has a `requirement_type` of `required` or `optional`. The audience pathway sets the required threshold per dimension; optional criteria are recorded as "additional strengths" without affecting the tier verdict.

The review screen shows a 7×3 heatmap. A cell turns green only when all its required criteria are satisfied. Unmet criteria surface inline remediation hints with section references back to the source paper.

## Features

- **Wizard flow** — audience selector → seven dimension pages → review/scorecard → export
- **Prefilled options** drawn from controlled vocabularies in the source paper: licenses (CC-BY, CC0, ODbL), formats (Parquet, HDF5, NetCDF, Zarr, DICOM, NIfTI), repositories by tier — L1 (Figshare, Zenodo, institutional, GitHub), L2 (Hugging Face, Kaggle, OpenML, Dataverse, Dryad), L3 generic (PhysioNet, NIH Data Commons, dbGaP, ICPSR, GenBank), L3 Bridge2AI Grand Challenges (CM4AI, CHoRUS, Bridge2AI-Voice, AI-READI). "Custom" entry always available.
- **Binary checkmark heatmap** — pass/fail per cell, optional-criteria list below the heatmap
- **Three template generators** — Croissant, PROV-O, datasheet/healthsheet — all editable in-app before download
- **Inlined seeded examples** — six reference datasets shipped with the bundle:
  - Tabular Zenodo dataset (Pathway A)
  - Hugging Face dataset with Croissant descriptor (Pathway B)
  - BIDS neuroimaging dataset
  - Synthetic MIMIC-shaped clinical dataset (Pathway C → Clinical, CHoRUS-aligned)
  - Synthetic CM4AI-style cell-mapping dataset (Pathway C → Genomic)
  - High-energy physics ROOT example (illustrates FAIR-for-models linkage)
- **Schema import/export** — labs can ship domain-tuned variants without forking the codebase
- **Offline-capable** — once loaded, the app runs entirely in the browser with no external runtime calls

## Tech stack

- **React** + **Vite** for the static bundle
- **Tailwind CSS** for styling
- **zod** for JSON-Schema validation of user inputs (also used to validate generated Croissant descriptors against the bundled MLCommons schema)
- **HashRouter** for deep links on GitHub Pages without server-side rewrites
- Plain-JS JSON-LD construction (no Node runtime required at load time)
- **`localStorage`** for resumable in-progress assessments, plus **file export/import** for portability and sharing across browsers, devices, and sessions. `localStorage` is a prototype-grade choice (private-browsing tabs disable it, and it is per-origin/per-browser); the durable, shareable artifact is the exported JSON profile

## Repository structure

```
ai-readiness-assessment/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── routes/
│   │   ├── AudienceSelector.jsx
│   │   ├── DimensionPage.jsx
│   │   ├── Review.jsx
│   │   └── Export.jsx
│   ├── components/
│   │   ├── Heatmap.jsx
│   │   ├── CriterionField.jsx
│   │   ├── PathwayCard.jsx
│   │   └── EditablePreview.jsx
│   ├── schema/
│   │   ├── matrix.json          # 7×3 assessment matrix
│   │   ├── pathways.json        # A / B / C with sub-domains
│   │   └── vocabularies.json    # licenses, formats, repositories
│   ├── generators/
│   │   ├── croissant.js
│   │   ├── prov-o.js
│   │   └── datasheet.js
│   ├── examples/                # inlined seeded examples
│   │   ├── zenodo-tabular.json
│   │   ├── hf-croissant.json
│   │   ├── bids-neuroimaging.json
│   │   ├── synthetic-mimic.json
│   │   ├── synthetic-cm4ai.json
│   │   └── hep-root.json
│   └── styles/
│       └── tailwind.css
├── tests/
│   ├── generators.test.js
│   └── matrix.test.js
├── index.html
├── vite.config.js
├── package.json
├── tailwind.config.js
├── .github/
│   └── workflows/
│       └── deploy.yml           # gh-pages deployment
└── README.md
```

## Getting started

### Run locally

```bash
git clone https://github.com/<your-username>/ai-readiness-assessment.git
cd ai-readiness-assessment
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
2. Update `base` in `vite.config.js` to match your repo name (e.g., `/ai-readiness-assessment/`).
3. Push to `main`.

## Customizing the assessment

The assessment matrix lives at `src/schema/matrix.json`. Each entry describes one criterion:

```json
{
  "dimension": "FAIRness",
  "level": "L2",
  "id": "fairness.l2.croissant_present",
  "requirement_type": "required",
  "evidence_type": "boolean",
  "label": "Croissant descriptor present",
  "prefilled_options": null,
  "references": ["Akhtar2024", "Clark2026"],
  "remediation": "Generate a Croissant descriptor using the in-app tool."
}
```

To create a domain-tuned variant (e.g., a high-energy-physics profile), copy `matrix.json`, edit, and load it via the **Import schema** option in the app. Forking the repo is not required.

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

The full bibliography from the source paper is reproduced in [`docs/REFERENCES.md`](docs/REFERENCES.md).

## License

The application code is released under the MIT License. The assessment framework it implements is documented in the source paper cited above; see that paper for attribution requirements when adapting the framework itself.

## Citation

If you use this tool in your research, please cite both the source framework and the implementation:

```bibtex
@misc{gonzalez2026airready,
  title  = {A practical AI-readiness assessment for Research Data:
            A review and tiered framework},
  author = {González-Espinoza, Alfredo},
  year   = {2026},
  institution = {Carnegie Mellon University, University Libraries}
}

@software{airready_app_2026,
  title  = {AI-Readiness Assessment App},
  author = {González-Espinoza, Alfredo},
  year   = {2026},
  url    = {https://github.com/<your-username>/ai-readiness-assessment}
}
```

## Contributing

Issues and pull requests are welcome. For substantive changes to the assessment matrix itself, please open an issue first describing the rationale and the source it derives from — the matrix is intended to track the published framework, and divergences should be documented.

## Contact

Alfredo González-Espinoza · agonzal3@andrew.cmu.edu · Carnegie Mellon University Libraries
