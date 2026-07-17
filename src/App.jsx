// Route table. HashRouter is configured in main.jsx so deep links work on
// GitHub Pages without server-side rewrites. Wizard flow:
//   audience (/) -> dimension (/dimension/:slug) -> review -> export
// The route components are stubs in increment 2 and are fleshed out in
// increments 3-4.

import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import AudienceSelector from './routes/AudienceSelector.jsx';
import DimensionPage from './routes/DimensionPage.jsx';
import Review from './routes/Review.jsx';
// Imported as ExportPage to avoid shadowing the `export` keyword when read.
import ExportPage from './routes/Export.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<AudienceSelector />} />
        <Route path="dimension/:slug" element={<DimensionPage />} />
        <Route path="review" element={<Review />} />
        <Route path="export" element={<ExportPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
