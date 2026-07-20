// The preprint this tool implements. Single source of truth so the home page,
// References page, and every generated output cite it identically. It is an
// unpublished manuscript in preparation, so there is no DOI/URL yet; the
// citation follows the APA form for an in-preparation work:
//   Author (Year). Title [Manuscript in preparation]. Publisher.

export const THIS_WORK = {
  authors: 'González-Espinoza, A.',
  year: 2026,
  title:
    'AI-readiness assessment for research data in academic environments: A review and tiered framework',
  shortTitle: 'AI-readiness assessment for research data',
  note: 'Manuscript in preparation',
  publisher: 'Carnegie Mellon University Libraries',
};

// Full library-standard citation — for the References page and home display.
export function citeThisWork(w = THIS_WORK) {
  return `${w.authors} (${w.year}). ${w.title} [${w.note}]. ${w.publisher}.`;
}

// Markdown variant with the title italicised.
export function citeThisWorkMarkdown(w = THIS_WORK) {
  return `${w.authors} (${w.year}). *${w.title}* [${w.note}]. ${w.publisher}.`;
}

// One-line short citation — for the exported files (datasheet, to-do, reports),
// where a compact attribution is wanted rather than the full reference.
export function citeThisWorkShort(w = THIS_WORK) {
  const last = w.authors.split(',')[0].trim();
  return `${last} (${w.year}), ${w.shortTitle} (preprint).`;
}
