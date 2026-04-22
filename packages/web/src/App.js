import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SkillsPage } from './pages/SkillsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoomLogo } from './components/ui/loom-icon';
import { cn } from '@/lib/utils';
function NavItem({ to, children }) {
    return (_jsx(NavLink, { to: to, end: to === '/', className: ({ isActive }) => cn('text-sm font-medium transition-colors', isActive ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900'), children: children }));
}
export default function App() {
    const { t } = useTranslation();
    return (_jsx(BrowserRouter, { children: _jsxs("div", { className: "min-h-screen bg-white text-ink-900", children: [_jsx("header", { className: "sticky top-0 z-40 bg-white/90 backdrop-blur shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]", children: _jsx("div", { className: "mx-auto flex h-14 max-w-content items-center justify-between px-6", children: _jsxs("div", { className: "flex items-center gap-8", children: [_jsx(NavLink, { to: "/", className: "flex items-center", "aria-label": t('nav.ariaLogo'), children: _jsx(LoomLogo, { size: "md" }) }), _jsxs("nav", { className: "flex items-center gap-5", children: [_jsx(NavItem, { to: "/", children: t('nav.projects') }), _jsx(NavItem, { to: "/skills", children: t('nav.skills') }), _jsx(NavItem, { to: "/settings", children: t('nav.settings') })] })] }) }) }), _jsx("main", { className: "mx-auto max-w-content px-6 py-10", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(ProjectsPage, {}) }), _jsx(Route, { path: "/projects/:id", element: _jsx(ProjectDetailPage, {}) }), _jsx(Route, { path: "/skills", element: _jsx(SkillsPage, {}) }), _jsx(Route, { path: "/settings", element: _jsx(SettingsPage, {}) })] }) })] }) }));
}
