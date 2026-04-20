import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { SkillsPage } from './pages/SkillsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <header className="border-b bg-white px-6 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <nav className="flex items-center gap-6">
            <Link to="/" className="text-lg font-bold">Skill Manager</Link>
            <Link to="/" className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300">Projects</Link>
            <Link to="/skills" className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300">Skills</Link>
            <Link to="/settings" className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300">Settings</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl p-6">
          <Routes>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/settings" element={<div>Settings (Task 23)</div>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
