import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
/**
 * Sticky left-sidebar navigation for the Settings page. Clicking a node
 * smoothly scrolls the matching `<section id>` into view; the active node
 * is highlighted automatically via IntersectionObserver as the user scrolls.
 */
export function SettingsNav({ items }) {
    const firstId = items[0]?.id ?? '';
    const [activeId, setActiveId] = useState(firstId);
    useEffect(() => {
        if (items.length === 0)
            return;
        const observer = new IntersectionObserver((entries) => {
            const visible = entries
                .filter((e) => e.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
            if (visible.length > 0) {
                setActiveId(visible[0].target.id);
            }
        }, {
            // Ignore the top 80px (sticky header) and the bottom 40% of the viewport
            // so the section whose TOP is in the upper third wins.
            rootMargin: '-80px 0px -40% 0px',
            threshold: [0, 0.25, 0.5, 0.75, 1],
        });
        for (const item of items) {
            const el = document.getElementById(item.id);
            if (el)
                observer.observe(el);
        }
        return () => observer.disconnect();
    }, [items]);
    function handleClick(id) {
        const el = document.getElementById(id);
        if (!el)
            return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveId(id);
    }
    return (_jsxs("nav", { "aria-label": "Settings sections", className: "w-56 shrink-0 self-start sticky top-20", children: [_jsx("p", { className: "px-3 pb-2 font-mono text-[11px] font-medium uppercase tracking-tight text-ink-400", children: "Sections" }), _jsx("ul", { className: "space-y-0.5", children: items.map((item) => {
                    const isActive = activeId === item.id;
                    return (_jsx("li", { children: _jsx("button", { type: "button", onClick: () => handleClick(item.id), "aria-current": isActive ? 'true' : undefined, className: cn('w-full rounded-md px-3 py-2 text-left text-sm transition-colors', isActive
                                ? 'bg-ink-50 text-ink-900 font-semibold shadow-ring-light'
                                : 'text-ink-600 font-medium hover:bg-ink-50 hover:text-ink-900'), children: item.label }) }, item.id));
                }) })] }));
}
