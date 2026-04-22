import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkills } from '@/api/skills';
import { useSkillTree } from '@/hooks/useSkillTree';
import { SkillTree } from '@/components/SkillTree';
import { SkillCard } from '@/components/SkillCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SourceUpdatesBanner } from '@/components/SourceUpdatesBanner';
export function SkillsPage() {
    const { t } = useTranslation();
    const [q, setQ] = useState('');
    const { data, isLoading, refetch, isFetching } = useSkills();
    const skills = data?.skills ?? [];
    const treeResult = useSkillTree(skills);
    const { visibleSkills, tree, selectedKey } = treeResult;
    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle)
            return visibleSkills;
        return visibleSkills.filter((s) => s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle));
    }, [visibleSkills, q]);
    const currentLabel = selectedKey === tree.key ? t('skills.allSkills') : selectedKey.split('/').pop();
    return (_jsxs("div", { className: "flex gap-8", children: [_jsx("aside", { className: "hidden md:block", children: _jsx(SkillTree, { ...treeResult }) }), _jsxs("div", { className: "flex-1 space-y-6", children: [_jsxs("div", { className: "flex items-end justify-between gap-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-semibold leading-tight tracking-heading text-ink-900", style: { fontSize: '32px' }, children: currentLabel }), _jsxs("p", { className: "mt-1.5 text-sm text-ink-500", children: [t('skills.countOf', { filtered: filtered.length, total: skills.length }), q.trim() && _jsxs(_Fragment, { children: [" ", t('skills.matching', { query: q.trim() })] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { placeholder: t('common.search'), value: q, onChange: e => setQ(e.target.value), className: "w-80" }), _jsx(Button, { variant: "secondary", onClick: () => refetch(), disabled: isFetching, children: isFetching ? t('skills.refreshing') : t('common.refresh') })] })] }), _jsx(SourceUpdatesBanner, {}), isLoading && _jsx("p", { className: "text-sm text-ink-500", children: t('common.loading') }), data?.warnings.length ? (_jsxs("div", { className: "rounded-lg bg-badge-yellow-bg p-4 shadow-ring-light", children: [_jsx("p", { className: "text-sm font-medium text-badge-yellow-text", children: t('skills.parseWarningTitle', { count: data.warnings.length }) }), _jsx("p", { className: "mt-1 font-mono text-xs text-badge-yellow-text/80", children: data.warnings[0] })] })) : null, !isLoading && filtered.length === 0 && (_jsxs("div", { className: "rounded-lg bg-white py-16 text-center shadow-border", children: [_jsx("p", { className: "text-base text-ink-900", children: t('skills.empty.headline') }), _jsx("p", { className: "mt-1 text-sm text-ink-500", children: t('skills.empty.description') })] })), _jsx("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3", children: filtered.map(s => _jsx(SkillCard, { skill: s }, s.id)) })] })] }));
}
