import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRecommend } from '@/api/ai';
import { useSaveRules } from '@/api/rules';
import { useApply, useDiffPreview } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DiffPreview } from '@/components/DiffPreview';
export function AiRecommendPanel({ projectId, initialRules }) {
    const { t } = useTranslation();
    const [projectHint, setProjectHint] = useState(initialRules?.projectHint ?? '');
    const [includesText, setIncludesText] = useState((initialRules?.includes ?? []).join(', '));
    const [excludesText, setExcludesText] = useState((initialRules?.excludes ?? []).join(', '));
    const [keywordsText, setKeywordsText] = useState((initialRules?.keywords ?? []).join(', '));
    const [aiGuidance, setAiGuidance] = useState(initialRules?.aiGuidance ?? '');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [diffOpen, setDiffOpen] = useState(false);
    const recommend = useRecommend();
    const saveRules = useSaveRules();
    const diffMut = useDiffPreview();
    const applyMut = useApply();
    const toList = (s) => s.split(',').map(x => x.trim()).filter(Boolean);
    async function runRecommend() {
        const data = await recommend.mutateAsync({
            projectId,
            projectHint,
            includes: toList(includesText),
            excludes: toList(excludesText),
            keywords: toList(keywordsText),
            aiGuidance: aiGuidance || undefined,
        });
        setSelectedIds(new Set(data.picks.map(p => p.skill.id)));
    }
    function togglePick(id) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    }
    async function saveAndPreview() {
        const rules = {
            version: 1,
            projectHint,
            includes: toList(includesText),
            excludes: toList(excludesText),
            keywords: toList(keywordsText),
            aiGuidance: aiGuidance || undefined,
            lastAppliedSkills: Array.from(selectedIds),
        };
        await saveRules.mutateAsync({ projectId, rules });
        await diffMut.mutateAsync({ projectId, skillIds: Array.from(selectedIds) });
        setDiffOpen(true);
    }
    async function confirmApply() {
        await applyMut.mutateAsync({ projectId, skillIds: Array.from(selectedIds) });
        setDiffOpen(false);
    }
    return (_jsxs("div", { className: "grid grid-cols-1 gap-6 lg:grid-cols-2", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "block text-sm", children: [_jsx("span", { className: "font-medium text-ink-900", children: t('ai.panel.projectHint') }), _jsx("textarea", { className: "mt-1 w-full rounded-md bg-white p-3 text-sm text-ink-900 shadow-ring-light transition-all hover:shadow-border", rows: 3, value: projectHint, onChange: e => setProjectHint(e.target.value), placeholder: t('ai.panel.projectHintPlaceholder') })] }), _jsxs("label", { className: "block text-sm", children: [_jsx("span", { className: "font-medium text-ink-900", children: t('ai.panel.keywords') }), _jsx(Input, { value: keywordsText, onChange: e => setKeywordsText(e.target.value), placeholder: t('ai.panel.keywordsPlaceholder') })] }), _jsxs("label", { className: "block text-sm", children: [_jsx("span", { className: "font-medium text-ink-900", children: t('ai.panel.includes') }), _jsx(Input, { value: includesText, onChange: e => setIncludesText(e.target.value) })] }), _jsxs("label", { className: "block text-sm", children: [_jsx("span", { className: "font-medium text-ink-900", children: t('ai.panel.excludes') }), _jsx(Input, { value: excludesText, onChange: e => setExcludesText(e.target.value) })] }), _jsxs("label", { className: "block text-sm", children: [_jsx("span", { className: "font-medium text-ink-900", children: t('ai.panel.aiGuidance') }), _jsx("textarea", { className: "mt-1 w-full rounded-md bg-white p-3 text-sm text-ink-900 shadow-ring-light transition-all hover:shadow-border", rows: 3, value: aiGuidance, onChange: e => setAiGuidance(e.target.value), placeholder: t('ai.panel.aiGuidancePlaceholder') })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { onClick: runRecommend, disabled: recommend.isPending || projectHint.trim().length === 0, children: recommend.isPending ? t('ai.panel.generating') : t('ai.panel.generate') }), _jsx(Button, { variant: "secondary", onClick: saveAndPreview, disabled: selectedIds.size === 0, children: t('ai.panel.saveAndPreview') })] }), recommend.error && _jsx("p", { className: "text-xs text-ship-red", children: recommend.error.message })] }), _jsxs("div", { children: [_jsxs("h3", { className: "mb-2 font-mono text-xs font-medium uppercase tracking-tight text-ink-500", children: [t('ai.panel.recommendations'), " ", _jsx("span", { className: "ml-1 text-ink-400", children: recommend.data?.picks.length ?? 0 })] }), recommend.data?.warnings.length ? (_jsx("div", { className: "mb-3 rounded-lg bg-badge-yellow-bg p-3 shadow-ring-light", children: _jsx("p", { className: "text-sm font-medium text-badge-yellow-text", children: recommend.data.warnings.join(' · ') }) })) : null, _jsx("div", { className: "space-y-2", children: recommend.data?.picks.map(p => (_jsxs("label", { className: "flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3 text-sm shadow-ring-light transition-all hover:shadow-border", children: [_jsx("input", { type: "checkbox", className: "mt-1", checked: selectedIds.has(p.skill.id), onChange: () => togglePick(p.skill.id) }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-medium text-ink-900", children: p.skill.name }), _jsx(Badge, { variant: "secondary", children: p.skill.pluginName ?? p.skill.source })] }), _jsx("p", { className: "mt-0.5 text-xs text-ink-500", children: p.skill.description }), _jsx("p", { className: "mt-1 text-xs italic text-ink-600", children: t('ai.panel.why', { reason: p.reason }) })] })] }, p.skill.id))) })] }), _jsx(Dialog, { open: diffOpen, onOpenChange: setDiffOpen, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('projectDetail.diff.reviewChanges') }) }), diffMut.data && _jsx(DiffPreview, { diff: diffMut.data }), _jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [_jsx(DialogClose, { asChild: true, children: _jsx(Button, { variant: "secondary", children: t('common.cancel') }) }), _jsx(Button, { onClick: confirmApply, disabled: applyMut.isPending, children: applyMut.isPending ? t('common.applying') : t('common.apply') })] })] }) })] }));
}
