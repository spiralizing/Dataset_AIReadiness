// App shell: header, top navigation, and the routed outlet. Kept intentionally
// minimal — the wizard steps render inside <Outlet />.

import { NavLink, Outlet } from 'react-router-dom';

const linkClass = ({ isActive }) =>
  `px-3 py-1.5 rounded text-sm transition-colors ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">AI-Readiness Assessment</h1>
            <p className="text-xs text-slate-500">
              Tiered self-assessment for research datasets
            </p>
          </div>
          <nav className="flex gap-1">
            <NavLink to="/" end className={linkClass}>
              Audience
            </NavLink>
            <NavLink to="/review" className={linkClass}>
              Review
            </NavLink>
            <NavLink to="/export" className={linkClass}>
              Export
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-4xl px-6 py-8 text-xs text-slate-400">
        Proof-of-concept tool for the AI-readiness framework. Runs entirely in
        your browser; nothing is uploaded.
      </footer>
    </div>
  );
}
