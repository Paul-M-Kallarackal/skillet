import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { IndexProvider } from './IndexProvider';
import { CommandPalette } from '../components/CommandPalette';
import { Sidebar } from '../components/Sidebar';
import { Toaster } from '../components/Toaster';
import { AdoptPage } from '../pages/AdoptPage';
import { AgentsPage } from '../pages/AgentsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SkillsPage } from '../pages/SkillsPage';
import { TrashPage } from '../pages/TrashPage';
import { DiscoverPage } from '../pages/DiscoverPage';
const SkillDetailPage = lazy(() => import('../pages/SkillDetailPage').then((module) => ({ default: module.SkillDetailPage })));

export function App() {
  return (
    <IndexProvider>
      <Toaster>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <div className="app-shell">
          <Sidebar />
          <main className="app-main" id="main-content" tabIndex={-1}>
            <div className="app-content">
              <Routes>
                <Route path="/" element={<Navigate to="/skills" replace />} />
                <Route path="/skills" element={<SkillsPage />} />
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/skills/:id" element={<Suspense fallback={<div className="empty-state" role="status">Loading skill editor…</div>}><SkillDetailPage /></Suspense>} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/adopt" element={<AdoptPage />} />
                <Route path="/trash" element={<TrashPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </div>
          </main>
        </div>
        <CommandPalette />
      </Toaster>
    </IndexProvider>
  );
}
