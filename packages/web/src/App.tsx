import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { SkillsPage } from './pages/SkillsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { cn } from '@/lib/utils';

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'text-sm font-medium transition-colors',
          isActive ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900',
        )
      }
    >
      {children}
    </NavLink>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-ink-900">
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
            <div className="flex items-center gap-8">
              <NavLink to="/" className="font-mono text-xs font-medium uppercase tracking-tight text-ink-900">
                Skill Manager
              </NavLink>
              <nav className="flex items-center gap-5">
                <NavItem to="/">Projects</NavItem>
                <NavItem to="/skills">Skills</NavItem>
                <NavItem to="/settings">Settings</NavItem>
              </nav>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-content px-6 py-10">
          <Routes>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
