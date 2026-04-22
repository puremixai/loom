import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAddProject, useProjects, useRemoveProject } from '@/api/projects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { LoomLogo } from '@/components/ui/loom-icon';
export function ProjectsPage() {
    const { t } = useTranslation();
    const { data, isLoading } = useProjects();
    const addMut = useAddProject();
    const removeMut = useRemoveProject();
    const [path, setPath] = useState('');
    const [name, setName] = useState('');
    const [open, setOpen] = useState(false);
    const [err, setErr] = useState(null);
    async function handleAdd() {
        try {
            setErr(null);
            await addMut.mutateAsync({ path: path.trim(), name: name.trim() || undefined });
            setPath('');
            setName('');
            setOpen(false);
        }
        catch (e) {
            setErr(e.message);
        }
    }
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { className: "flex items-end justify-between gap-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-semibold leading-tight tracking-heading text-ink-900", style: { fontSize: '32px' }, children: t('projects.title') }), _jsx("p", { className: "mt-1.5 text-sm text-ink-500", children: t('projects.subtitleCount', { count: data?.length ?? 0 }) })] }), _jsxs(Dialog, { open: open, onOpenChange: setOpen, children: [_jsx(DialogTrigger, { asChild: true, children: _jsx(Button, { children: t('projects.addButton') }) }), _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t('projects.addDialog.titleAlt') }) }), _jsxs("div", { className: "space-y-4", children: [_jsxs("label", { className: "block", children: [_jsx("span", { className: "text-sm font-medium text-ink-900", children: t('projects.addDialog.pathLabel') }), _jsx("p", { className: "mt-0.5 text-xs text-ink-500", children: t('projects.addDialog.pathHint') }), _jsx(Input, { className: "mt-2 font-mono text-xs", value: path, onChange: e => setPath(e.target.value), placeholder: t('projects.addDialog.pathPlaceholderShort') })] }), _jsxs("label", { className: "block", children: [_jsxs("span", { className: "text-sm font-medium text-ink-900", children: [t('projects.addDialog.nameLabel'), " ", _jsx("span", { className: "text-ink-400", children: t('projects.addDialog.nameOptional') })] }), _jsx(Input, { className: "mt-2", value: name, onChange: e => setName(e.target.value), placeholder: t('projects.addDialog.nameDefaultHint') })] }), err && _jsx("p", { className: "text-xs text-ship-red", children: err }), _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx(DialogClose, { asChild: true, children: _jsx(Button, { variant: "secondary", children: t('common.cancel') }) }), _jsx(Button, { onClick: handleAdd, disabled: addMut.isPending || path.trim().length === 0, children: addMut.isPending ? t('projects.addDialog.submitting') : t('projects.addDialog.submit') })] })] })] })] })] }), isLoading && _jsx("p", { className: "text-sm text-ink-500", children: t('common.loading') }), data?.length === 0 && !isLoading && (_jsxs("div", { className: "rounded-lg bg-white py-16 text-center shadow-border", children: [_jsx("div", { className: "flex justify-center mb-5", children: _jsx(LoomLogo, { size: "lg" }) }), _jsx("p", { className: "text-base text-ink-900", children: t('projects.empty.headlineAlt') }), _jsx("p", { className: "mt-1 text-sm text-ink-500", children: t('projects.empty.descriptionAlt') })] })), _jsx("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3", children: data?.map(p => (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsx(CardTitle, { children: _jsx(Link, { to: `/projects/${p.id}`, className: "hover:underline decoration-ink-400 underline-offset-4", children: p.name }) }), _jsx(Badge, { variant: p.status === 'ok' ? 'success' : 'destructive', children: p.status })] }) }), _jsxs(CardContent, { className: "space-y-3", children: [_jsx("p", { className: "truncate font-mono text-xs text-ink-500", title: p.path, children: p.path }), p.lastSyncedAt && (_jsx("p", { className: "text-xs text-ink-500", children: t('projects.lastSynced', { date: new Date(p.lastSyncedAt).toLocaleString() }) })), _jsx("div", { className: "pt-1", children: _jsx(Button, { size: "sm", variant: "ghost", onClick: () => { if (confirm(t('projects.removeConfirm', { name: p.name })))
                                            removeMut.mutate(p.id); }, className: "text-ink-500 hover:text-ship-red hover:bg-white", children: t('common.remove') }) })] })] }, p.id))) })] }));
}
