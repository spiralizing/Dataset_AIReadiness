// Render test for the Export deep link. The behaviour spans three places — the
// criterion's tab id, the <Link> that builds the URL, and Export reading the
// query param — so a unit test on any one of them would pass while the link
// still went nowhere. Kept for the same reason as depositionField.test.jsx.
//
// Note the app mounts HashRouter, so `/export?tab=croissant` renders as
// `#/export?tab=croissant`; useSearchParams reads the query inside the hash.
//
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const record = {
  schema_version: 'assessment_record_v0',
  stage: 'upgrade',
  pathway: 'C',
  sub_domain: 'materials',
  started_at: '2026-08-07T00:00:00Z',
  answers: {},
  dataset: { name: 'ds', description: '', version: '' },
  croissant: null,
  croissant_model: { files: [], recordSets: [] },
  provo: null,
  provenance: { sources: [], steps: [] },
};
globalThis.localStorage = { getItem: () => JSON.stringify(record), setItem: () => {} };

const { AssessmentProvider } = await import('../src/state/assessment.jsx');
const { default: DimensionPage } = await import('../src/routes/DimensionPage.jsx');
const { default: ExportPage } = await import('../src/routes/Export.jsx');

test('descriptor-driven criteria link to the Export tab that completes them', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/dimension/fairness']}>
      <AssessmentProvider>
        <Routes>
          <Route path="/dimension/:slug" element={<DimensionPage />} />
        </Routes>
      </AssessmentProvider>
    </MemoryRouter>,
  );
  assert.ok(html.includes('href="/export?tab=croissant"'), 'Croissant criteria should deep-link');
  assert.ok(html.includes('Validated from the Croissant descriptor'));
});

test('Export opens the tab named in the query param', () => {
  const at = (entry) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={[entry]}>
        <AssessmentProvider>
          <ExportPage />
        </AssessmentProvider>
      </MemoryRouter>,
    );

  assert.ok(at('/export?tab=croissant').includes('Build the descriptor (files and columns)'));
  assert.ok(at('/export?tab=provo').includes('Build provenance (steps)'));
  // No param, or an unknown one, falls back to the datasheet tab.
  assert.ok(at('/export').includes('# Dataset datasheet'));
  assert.ok(at('/export?tab=nonsense').includes('# Dataset datasheet'));
});
