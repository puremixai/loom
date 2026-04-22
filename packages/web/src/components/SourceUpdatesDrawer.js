import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCheckSources, usePullSource } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
function fmtDuration(from, t) {
    const ms = Date.now() - new Date(from).getTime();
    const min = Math.floor(ms / 60_000);
    if (min < 1)
        return t('sources.duration.justNow');
    if (min < 60)
        return t('sources.duration.minAgo', { count: min });
    const h = Math.floor(min / 60);
    if (h < 24)
        return t('sources.duration.hAgo', { count: h });
    return t('sources.duration.dAgo', { count: Math.floor(h / 24) });
}
function pluginCmd(name) {
    return name ? `claude plugins update ${name}` : '';
}
function StatusRow({ s, onPull, pulling }) {
    const { t } = useTranslation();
    const isPlugin = s.ref.kind === 'plugin';
    return (_jsxs("div", { className: "rounded-lg bg-white p-4 shadow-ring-light", children: [_jsx("div", { className: "flex items-start justify-between gap-3", children: _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "truncate font-medium text-ink-900", children: s.ref.displayName }), _jsx(Badge, { variant: isPlugin ? 'info' : 'secondary', children: s.ref.kind }), s.dirty && _jsx(Badge, { variant: "warning", children: t('sources.status.dirty') })] }), s.behind > 0 && (_jsx("p", { className: "mt-1 text-xs text-ink-600", children: s.behind > 1
                                ? t('sources.status.commitBehindMany', { count: s.behind })
                                : t('sources.status.commitBehindOne', { count: s.behind }) })), s.ahead > 0 && (_jsx("p", { className: "mt-1 text-xs text-ink-600", children: s.ahead > 1
                                ? t('sources.status.commitAheadMany', { count: s.ahead })
                                : t('sources.status.commitAheadOne', { count: s.ahead }) })), s.lastCommit && (_jsxs("p", { className: "mt-1 line-clamp-2 text-xs italic text-ink-500", children: ["\"", s.lastCommit.subject, "\" \u2014 ", s.lastCommit.author, ", ", fmtDuration(s.lastCommit.date, t)] }))] }) }), s.error && _jsx("p", { className: "mt-2 font-mono text-xs text-ship-red", children: s.error }), s.behind > 0 && !s.error && (_jsx("div", { className: "mt-3 flex items-center gap-2", children: isPlugin ? (_jsxs(_Fragment, { children: [_jsx("pre", { className: "flex-1 overflow-x-auto rounded bg-ink-50 p-2 font-mono text-xs text-ink-900", children: pluginCmd(s.ref.pluginName) }), _jsx(Button, { size: "sm", variant: "secondary", onClick: () => navigator.clipboard.writeText(pluginCmd(s.ref.pluginName)), children: t('common.copy') })] })) : (_jsx(Button, { size: "sm", onClick: () => onPull(s.ref.gitRoot), disabled: pulling || s.dirty, children: pulling ? t('sources.pulling') : t('sources.pullButton') })) }))] }));
}
export function SourceUpdatesDrawer({ open, onOpenChange }) {
    const { t } = useTranslation();
    const check = useCheckSources();
    const pull = usePullSource();
    const [lastCheckedAt, setLastCheckedAt] = useState(null);
    const [activePull, setActivePull] = useState(null);
    useEffect(() => {
        if (!open)
            return;
        check.mutateAsync().then(() => setLastCheckedAt(new Date().toISOString())).catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
    const statuses = check.data?.statuses ?? [];
    const behind = statuses.filter(s => s.behind > 0 && !s.error);
    const upToDate = statuses.filter(s => s.behind === 0 && !s.error);
    const errors = statuses.filter(s => s.error);
    async function handlePull(gitRoot) {
        setActivePull(gitRoot);
        try {
            await pull.mutateAsync({ gitRoot });
            await check.mutateAsync();
            setLastCheckedAt(new Date().toISOString());
        }
        finally {
            setActivePull(null);
        }
    }
    return (_jsx(DialogPrimitive.Root, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogPrimitive.Portal, { children: [_jsx(DialogPrimitive.Overlay, { className: "fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-[1px]" }), _jsxs(DialogPrimitive.Content, { className: "fixed right-0 top-0 z-50 h-full w-full max-w-[480px] overflow-y-auto bg-white p-6 shadow-card-elevated", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx(DialogPrimitive.Title, { className: "text-[17px] font-semibold tracking-heading", children: t('sources.drawerTitle') }), _jsx(DialogPrimitive.Close, { className: "rounded-md p-1.5 text-ink-500 hover:bg-ink-50 hover:text-ink-900", children: _jsx(X, { className: "h-4 w-4" }) })] }), _jsxs("div", { className: "mb-4 flex items-center gap-3 text-xs text-ink-500", children: [_jsxs(Button, { size: "sm", variant: "secondary", onClick: () => check.mutate(), disabled: check.isPending, children: [_jsx(RefreshCw, { className: "h-3.5 w-3.5" }), _jsx("span", { className: "ml-1", children: check.isPending ? t('sources.checking') : t('sources.refreshNow') })] }), lastCheckedAt && _jsx("span", { children: t('sources.lastChecked', { time: fmtDuration(lastCheckedAt, t) }) })] }), check.error && _jsx("p", { className: "mb-3 font-mono text-xs text-ship-red", children: check.error.message }), _jsxs("div", { className: "space-y-5", children: [behind.length > 0 && (_jsxs("section", { children: [_jsx("h3", { className: "mb-2 font-mono text-xs font-medium uppercase tracking-tight text-ink-500", children: t('sources.behindUpstream', { count: behind.length }) }), _jsx("div", { className: "space-y-2", children: behind.map(s => (_jsx(StatusRow, { s: s, onPull: handlePull, pulling: activePull === s.ref.gitRoot }, s.ref.gitRoot))) })] })), upToDate.length > 0 && (_jsxs("section", { children: [_jsx("h3", { className: "mb-2 font-mono text-xs font-medium uppercase tracking-tight text-ink-500", children: t('sources.upToDateSection', { count: upToDate.length }) }), _jsx("ul", { className: "space-y-1 text-sm text-ink-600", children: upToDate.map(s => _jsxs("li", { className: "truncate", children: ["\u2713 ", s.ref.displayName] }, s.ref.gitRoot)) })] })), errors.length > 0 && (_jsxs("section", { children: [_jsx("h3", { className: "mb-2 font-mono text-xs font-medium uppercase tracking-tight text-ink-500", children: t('sources.errorsSection', { count: errors.length }) }), _jsx("div", { className: "space-y-2", children: errors.map(s => (_jsxs("div", { className: "rounded-lg bg-badge-red-bg p-3 shadow-ring-light", children: [_jsx("p", { className: "text-sm font-medium text-badge-red-text", children: s.ref.displayName }), _jsx("p", { className: "mt-1 font-mono text-xs text-badge-red-text/80", children: s.error })] }, s.ref.gitRoot))) })] }))] })] })] }) }));
}
