import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
export function SkillCard({ skill, selected, onToggle }) {
    return (_jsxs(Card, { role: onToggle ? 'button' : undefined, onClick: onToggle ? () => onToggle(skill) : undefined, className: selected ? 'ring-2 ring-ink-900' : undefined, children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsx(CardTitle, { children: skill.name }), _jsx(Badge, { variant: "secondary", children: skill.pluginName ?? skill.source })] }) }), _jsx(CardContent, { className: "text-sm text-ink-600", children: skill.description })] }));
}
