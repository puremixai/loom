import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useTranslation } from 'react-i18next';
import { useRules, useSaveRules } from '@/api/rules';
import { apiFetch } from '@/api/client';
import { useApply, useDiffPreview } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { DiffPreview } from '@/components/DiffPreview';
function toYaml(rules) {
    if (!rules) {
        return `version: 1
projectHint: ""
includes: []
excludes: []
keywords: []
aiGuidance: ""
`;
    }
    const out = [];
    out.push(`version: 1`);
    out.push(`projectHint: ${JSON.stringify(rules.projectHint ?? '')}`);
    out.push(`includes:`);
    (rules.includes ?? []).forEach(x => out.push(`  - ${JSON.stringify(x)}`));
    out.push(`excludes:`);
    (rules.excludes ?? []).forEach(x => out.push(`  - ${JSON.stringify(x)}`));
    out.push(`keywords:`);
    (rules.keywords ?? []).forEach(x => out.push(`  - ${JSON.stringify(x)}`));
    if (rules.aiGuidance)
        out.push(`aiGuidance: ${JSON.stringify(rules.aiGuidance)}`);
    return out.join('\n');
}
export function RulesEditor({ projectId }) {
    const { t } = useTranslation();
    const { data: rulesRes } = useRules(projectId);
    const [text, setText] = useState('');
    const [err, setErr] = useState(null);
    const [syncResult, setSyncResult] = useState(null);
    const [diffOpen, setDiffOpen] = useState(false);
    const saveMut = useSaveRules();
    const diffMut = useDiffPreview();
    const applyMut = useApply();
    useEffect(() => { setText(toYaml(rulesRes?.rules ?? null)); }, [rulesRes]);
    async function save() {
        setErr(null);
        try {
            const yaml = (await import('js-yaml')).default;
            const parsed = yaml.load(text);
            await saveMut.mutateAsync({ projectId, rules: parsed });
        }
        catch (e) {
            setErr(e.message);
        }
    }
    async function runSync() {
        setErr(null);
        try {
            const data = await apiFetch(`/api/projects/${projectId}/sync`, { method: 'POST' });
            setSyncResult(data);
            await diffMut.mutateAsync({ projectId, skillIds: data.desiredIds });
            setDiffOpen(true);
        }
        catch (e) {
            setErr(e.message);
        }
    }
    async function confirmApply() {
        if (!syncResult)
            return;
        await applyMut.mutateAsync({ projectId, skillIds: syncResult.desiredIds });
        setDiffOpen(false);
    }
    return (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "h-96 overflow-hidden rounded-lg shadow-border", children: _jsx(Editor, { language: "yaml", theme: "vs-dark", value: text, onChange: (v) => setText(v ?? ''), options: { minimap: { enabled: false }, fontSize: 13 } }) }), err && _jsx("p", { className: "text-xs text-ship-red", children: err }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { onClick: save, disabled: saveMut.isPending, children: saveMut.isPending ? t('common.saving') : t('rules.saveRules') }), _jsx(Button, { variant: "secondary", onClick: runSync, children: t('rules.syncByRules') })] }), _jsx(Dialog, { open: diffOpen, onOpenChange: setDiffOpen, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('rules.syncPreview') }) }), diffMut.data && _jsx(DiffPreview, { diff: diffMut.data }), syncResult?.warnings.length ? (_jsx("div", { className: "mt-3 rounded-lg bg-badge-yellow-bg p-3 shadow-ring-light", children: _jsx("p", { className: "text-sm font-medium text-badge-yellow-text", children: syncResult.warnings.join(' · ') }) })) : null, _jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [_jsx(DialogClose, { asChild: true, children: _jsx(Button, { variant: "secondary", children: t('common.cancel') }) }), _jsx(Button, { onClick: confirmApply, disabled: applyMut.isPending, children: applyMut.isPending ? t('common.applying') : t('common.apply') })] })] }) })] }));
}
