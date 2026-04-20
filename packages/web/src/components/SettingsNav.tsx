import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SettingsNavItem {
  id: string;
  label: string;
}

export interface SettingsNavProps {
  items: SettingsNavItem[];
}

/**
 * Sticky left-sidebar navigation for the Settings page. Clicking a node
 * smoothly scrolls the matching `<section id>` into view; the active node
 * is highlighted automatically via IntersectionObserver as the user scrolls.
 */
export function SettingsNav({ items }: SettingsNavProps) {
  const firstId = items[0]?.id ?? '';
  const [activeId, setActiveId] = useState<string>(firstId);

  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          setActiveId(visible[0]!.target.id);
        }
      },
      {
        // Ignore the top 80px (sticky header) and the bottom 40% of the viewport
        // so the section whose TOP is in the upper third wins.
        rootMargin: '-80px 0px -40% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  function handleClick(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  }

  return (
    <nav aria-label="Settings sections" className="w-56 shrink-0 self-start sticky top-20">
      <p className="px-3 pb-2 font-mono text-[11px] font-medium uppercase tracking-tight text-ink-400">
        Sections
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleClick(item.id)}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                  isActive
                    ? 'bg-ink-50 text-ink-900 font-semibold shadow-ring-light'
                    : 'text-ink-600 font-medium hover:bg-ink-50 hover:text-ink-900',
                )}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
