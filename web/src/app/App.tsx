import { Navigate, Route, Routes } from 'react-router-dom';
import { IndexProvider } from './IndexProvider';
import { CommandPalette } from '../components/CommandPalette';
import { Sidebar } from '../components/Sidebar';
import { Toaster } from '../components/Toaster';
import { AdoptPage } from '../pages/AdoptPage';
import { AgentsPage } from '../pages/AgentsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SkillDetailPage } from '../pages/SkillDetailPage';
import { SkillsPage } from '../pages/SkillsPage';
import { TrashPage } from '../pages/TrashPage';

export function App() {
  return (
    <IndexProvider>
      <Toaster>
        <div style={{ display: 'flex', height: '100%' }}>
          <Sidebar />
          <main style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 28px 72px' }}>
              <Routes>
                <Route path="/" element={<Navigate to="/skills" replace />} />
                <Route path="/skills" element={<SkillsPage />} />
                <Route path="/skills/:id" element={<SkillDetailPage />} />
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
