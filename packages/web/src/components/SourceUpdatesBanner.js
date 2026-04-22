import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSources, useCheckSources } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { SourceUpdatesDrawer } from './SourceUpdatesDrawer';
export function SourceUpdatesBanner() {
    const { t } = useTranslation();
    const { data } = useSources();
    const check = useCheckSources();
    const [open, setOpen] = useState(false);
    const refCount = data?.refs.length ?? 0;
    const updateCount = (check.data?.statuses ?? []).filter(s => s.behind > 0 && !s.error).length;
    if (refCount === 0)
        return null;
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-ring-light", children: [_jsxs("div", { className: "flex items-center gap-3 text-sm", children: [_jsx("span", { className: "font-medium text-ink-900", children: t('sources.bannerLabel') }), _jsxs("span", { className: "text-ink-500", children: [t('sources.bannerGitBacked', { count: refCount }), check.data && updateCount > 0 && (_jsxs(_Fragment, { children: [" \u00B7 ", _jsx("span", { className: "text-develop-blue", children: t('sources.bannerHasUpdates', { count: updateCount }) })] }))] })] }), _jsx(Button, { size: "sm", variant: "secondary", onClick: () => setOpen(true), children: t('sources.viewButton') })] }), _jsx(SourceUpdatesDrawer, { open: open, onOpenChange: setOpen })] }));
}
