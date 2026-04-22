import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SkillsPage } from './pages/SkillsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoomLogo } from './components/ui/loom-icon';
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
  const { t } = useTranslation();
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-ink-900">
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
            <div className="flex items-center gap-8">
              <NavLink to="/" className="flex items-center" aria-label={t('nav.ariaLogo')}>
                <LoomLogo size="md" />
              </NavLink>
              <nav className="flex items-center gap-5">
                <NavItem to="/">{t('nav.projects')}</NavItem>
                <NavItem to="/skills">{t('nav.skills')}</NavItem>
                <NavItem to="/settings">{t('nav.settings')}</NavItem>
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
