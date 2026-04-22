import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { DiffPreview } from '@/components/DiffPreview';
import { AiRecommendPanel } from '@/components/AiRecommendPanel';
import { RulesEditor } from '@/components/RulesEditor';
import { useRules } from '@/api/rules';
import { useSkills } from '@/api/skills';
import { useProjects, useManifest, useDiffPreview, useApply, useUnapply } from '@/api/projects';
function group(skills) {
    const out = {};
    for (const s of skills) {
        const k = s.source === 'plugin' ? `plugin · ${s.pluginName ?? '(unknown)'}` : s.source;
        (out[k] ??= []).push(s);
    }
    return out;
}
export function ProjectDetailPage() {
    const { t } = useTranslation();
    const { id } = useParams();
    const { data: projects } = useProjects();
    const project = projects?.find(p => p.id === id);
    const { data: manifestRes } = useManifest(id);
    const { data: skillsRes } = useSkills();
    const { data: rulesRes } = useRules(id);
    const diffMut = useDiffPreview();
    const applyMut = useApply();
    const unapplyMut = useUnapply();
    const [selected, setSelected] = useState(new Set());
    const [q, setQ] = useState('');
    const [diffOpen, setDiffOpen] = useState(false);
    const manifest = manifestRes?.manifest ?? null;
    const appliedIds = new Set((manifest?.skills ?? []).map(s => s.id));
    const filteredSkills = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (skillsRes?.skills ?? []).filter(s => !needle || s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle));
    }, [skillsRes, q]);
    const groups = useMemo(() => group(filteredSkills), [filteredSkills]);
    function toggle(idS) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(idS))
                next.delete(idS);
            else
                next.add(idS);
            return next;
        });
    }
    async function previewApply() {
        if (!id)
            return;
        const desiredIds = Array.from(new Set([...selected, ...appliedIds]));
        await diffMut.mutateAsync({ projectId: id, skillIds: desiredIds });
        setDiffOpen(true);
    }
    async function confirmApply() {
        if (!id || !diffMut.data)
            return;
        const desired = new Set();
        for (const s of diffMut.data.toAdd)
            desired.add(s.id);
        for (const s of diffMut.data.toKeep)
            desired.add(s.id);
        await applyMut.mutateAsync({ projectId: id, skillIds: Array.from(desired) });
        setDiffOpen(false);
        setSelected(new Set());
    }
    if (!project)
        return _jsx("p", { className: "text-sm text-ink-500", children: t('projectDetail.loadingProject') });
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx(Link, { to: "/", className: "text-xs text-ink-500 hover:text-ink-900 transition-colors", children: t('projectDetail.backShort') }), _jsxs("div", { className: "mt-3 flex items-start justify-between gap-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-semibold leading-tight tracking-heading text-ink-900", style: { fontSize: '32px' }, children: project.name }), _jsx("p", { className: "mt-1.5 truncate font-mono text-xs text-ink-500", children: project.path })] }), _jsx("div", { className: "flex items-center gap-2", children: manifest ? (_jsxs(_Fragment, { children: [_jsx(Badge, { variant: "info", children: t('projectDetail.status.appliedCount', { count: manifest.skills.length }) }), _jsx(Badge, { variant: manifest.method === 'copy' ? 'warning' : 'secondary', children: manifest.method })] })) : (_jsx(Badge, { variant: "secondary", children: t('projectDetail.status.notInitialized') })) })] })] }), _jsxs(Tabs, { defaultValue: "applied", children: [_jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "applied", children: t('projectDetail.tabs.applied', { count: manifest?.skills.length ?? 0 }) }), _jsx(TabsTrigger, { value: "add", children: t('projectDetail.tabs.addSkills') }), _jsx(TabsTrigger, { value: "ai", children: t('projectDetail.tabs.aiRecommend') }), _jsx(TabsTrigger, { value: "rules", children: t('projectDetail.tabs.rulesAndSync') })] }), _jsx(TabsContent, { value: "applied", children: manifest?.skills.length ? (_jsx("div", { className: "overflow-hidden rounded-lg bg-white shadow-border", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]", children: [_jsx("th", { className: "px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-tight text-ink-500", children: t('projectDetail.applied.columns.name') }), _jsx("th", { className: "px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-tight text-ink-500", children: t('projectDetail.applied.columns.linkedAs') }), _jsx("th", { className: "px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-tight text-ink-500", children: t('projectDetail.applied.columns.source') }), _jsx("th", { className: "px-4 py-3" })] }) }), _jsx("tbody", { children: manifest.skills.map((s, i) => (_jsxs("tr", { className: i > 0 ? 'shadow-[inset_0_1px_0_rgba(0,0,0,0.06)]' : '', children: [_jsx("td", { className: "px-4 py-3 font-medium text-ink-900", children: s.name }), _jsx("td", { className: "px-4 py-3 font-mono text-xs text-ink-500", children: s.linkedAs }), _jsx("td", { className: "px-4 py-3 font-mono text-xs text-ink-500", title: s.sourceDir, children: _jsx("span", { className: "block max-w-xs truncate", children: s.sourceDir }) }), _jsx("td", { className: "px-4 py-3 text-right", children: _jsx(Button, { size: "sm", variant: "ghost", onClick: () => { if (confirm(t('projectDetail.applied.removeConfirm', { name: s.name })) && id)
                                                            unapplyMut.mutate({ projectId: id, skillIds: [s.id] }); }, className: "text-ink-500 hover:text-ship-red hover:bg-white", children: t('common.remove') }) })] }, s.id))) })] }) })) : (_jsxs("div", { className: "rounded-lg bg-white py-16 text-center shadow-border", children: [_jsx("p", { className: "text-base text-ink-900", children: t('projectDetail.applied.empty.headline') }), _jsx("p", { className: "mt-1 text-sm text-ink-500", children: t('projectDetail.applied.empty.description') })] })) }), _jsx(TabsContent, { value: "add", children: _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx(Input, { placeholder: t('common.search'), value: q, onChange: e => setQ(e.target.value), className: "w-80" }), _jsx(Button, { onClick: previewApply, disabled: selected.size === 0 || diffMut.isPending, children: diffMut.isPending ? t('projectDetail.add.computingDiff') : t('projectDetail.add.preview', { count: selected.size }) })] }), Object.entries(groups).map(([key, skills]) => (_jsxs("section", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-baseline gap-3", children: [_jsx("h3", { className: "font-mono text-xs font-medium uppercase tracking-tight text-ink-500", children: key }), _jsx("span", { className: "text-xs text-ink-400", children: skills.length })] }), _jsx("div", { className: "grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3", children: skills.map(s => {
                                                const applied = appliedIds.has(s.id);
                                                const checked = selected.has(s.id) || applied;
                                                return (_jsxs("label", { className: `flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3 text-sm shadow-ring-light transition-all hover:shadow-border ${applied ? 'opacity-60' : ''}`, children: [_jsx("input", { type: "checkbox", className: "mt-1", checked: checked, onChange: () => toggle(s.id), disabled: applied }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("span", { className: "truncate font-medium text-ink-900", children: s.name }), applied && _jsx("span", { className: "text-[10px] font-mono uppercase text-ink-400", children: t('projectDetail.add.appliedLabel') })] }), _jsx("p", { className: "mt-0.5 line-clamp-2 text-xs text-ink-500", children: s.description })] })] }, s.id));
                                            }) })] }, key)))] }) }), _jsx(TabsContent, { value: "ai", children: id && _jsx(AiRecommendPanel, { projectId: id, initialRules: rulesRes?.rules ?? null }) }), _jsx(TabsContent, { value: "rules", children: id && _jsx(RulesEditor, { projectId: id }) })] }), _jsx(Dialog, { open: diffOpen, onOpenChange: setDiffOpen, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('projectDetail.diff.reviewChanges') }) }), diffMut.data && _jsx(DiffPreview, { diff: diffMut.data }), diffMut.data?.missing && diffMut.data.missing.length > 0 && (_jsx("p", { className: "mt-3 text-xs text-ship-red", children: t('projectDetail.diff.unknownIds', { ids: diffMut.data.missing.join(', ') }) })), _jsxs("div", { className: "mt-6 flex justify-end gap-2", children: [_jsx(DialogClose, { asChild: true, children: _jsx(Button, { variant: "secondary", children: t('common.cancel') }) }), _jsx(Button, { onClick: confirmApply, disabled: applyMut.isPending, children: applyMut.isPending ? t('common.applying') : t('common.apply') })] })] }) })] }));
}
