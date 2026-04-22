import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
export function SkillTreeNode({ node, selectedKey, collapsed, onSelect, onToggleCollapse }) {
    const isSelected = node.key === selectedKey;
    const isCollapsed = collapsed.has(node.key);
    const hasChildren = node.children.length > 0;
    const isEmpty = node.count === 0;
    return (_jsxs("div", { children: [_jsxs("div", { className: cn('flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors', isSelected
                    ? 'bg-ink-50 text-ink-900 font-semibold shadow-ring-light'
                    : isEmpty
                        ? 'text-ink-400 hover:bg-ink-50/60'
                        : 'text-ink-700 hover:bg-ink-50'), style: { paddingLeft: `${8 + node.depth * 16}px` }, onClick: () => onSelect(node.key), children: [hasChildren ? (_jsx("button", { type: "button", "aria-label": isCollapsed ? 'Expand' : 'Collapse', className: "flex h-4 w-4 items-center justify-center text-ink-400 hover:text-ink-900", onClick: (e) => { e.stopPropagation(); onToggleCollapse(node.key); }, children: isCollapsed ? _jsx(ChevronRight, { className: "h-3.5 w-3.5" }) : _jsx(ChevronDown, { className: "h-3.5 w-3.5" }) })) : (_jsx("span", { className: "inline-block h-4 w-4" })), hasChildren && !isCollapsed
                        ? _jsx(FolderOpen, { className: "h-4 w-4 text-ink-500" })
                        : _jsx(Folder, { className: "h-4 w-4 text-ink-500" }), _jsx("span", { className: "flex-1 truncate text-sm", children: node.label }), _jsx("span", { className: "font-mono text-[11px] tabular-nums text-ink-400", children: node.count })] }), hasChildren && !isCollapsed && (_jsx("div", { children: node.children.map(child => (_jsx(SkillTreeNode, { node: child, selectedKey: selectedKey, collapsed: collapsed, onSelect: onSelect, onToggleCollapse: onToggleCollapse }, child.key))) }))] }));
}
