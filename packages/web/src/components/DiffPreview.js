import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
export function DiffPreview({ diff }) {
    const { t } = useTranslation();
    const Section = ({ title, color, items, render }) => (_jsxs("div", { children: [_jsxs("div", { className: "mb-1 flex items-center gap-2", children: [_jsx(Badge, { variant: color, children: title }), _jsx("span", { className: "text-xs text-ink-500", children: items.length })] }), items.length === 0 ? (_jsx("p", { className: "text-xs text-ink-400 italic", children: t('diff.none') })) : (_jsx("ul", { className: "space-y-1 text-sm", children: items.map(x => _jsx("li", { children: render(x) }, x.id)) }))] }));
    return (_jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-3", children: [_jsx(Section, { title: t('diff.add'), color: "success", items: diff.toAdd, render: (s) => s.name }), _jsx(Section, { title: t('diff.keep'), color: "secondary", items: diff.toKeep, render: (s) => s.name }), _jsx(Section, { title: t('diff.remove'), color: "destructive", items: diff.toRemove, render: (e) => e.name })] }));
}
