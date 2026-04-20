import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TreeNode } from '@/hooks/useSkillTree';

export interface SkillTreeNodeProps {
  node: TreeNode;
  selectedKey: string;
  collapsed: Set<string>;
  onSelect: (key: string) => void;
  onToggleCollapse: (key: string) => void;
}

export function SkillTreeNode({ node, selectedKey, collapsed, onSelect, onToggleCollapse }: SkillTreeNodeProps) {
  const isSelected = node.key === selectedKey;
  const isCollapsed = collapsed.has(node.key);
  const hasChildren = node.children.length > 0;
  const isEmpty = node.count === 0;

  return (
    <div>
      <div
        className={cn(
          'flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors',
          isSelected
            ? 'bg-ink-50 text-ink-900 font-semibold shadow-ring-light'
            : isEmpty
              ? 'text-ink-400 hover:bg-ink-50/60'
              : 'text-ink-700 hover:bg-ink-50',
        )}
        style={{ paddingLeft: `${8 + node.depth * 16}px` }}
        onClick={() => onSelect(node.key)}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            className="flex h-4 w-4 items-center justify-center text-ink-400 hover:text-ink-900"
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.key); }}
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="inline-block h-4 w-4" />
        )}
        {hasChildren && !isCollapsed
          ? <FolderOpen className="h-4 w-4 text-ink-500" />
          : <Folder className="h-4 w-4 text-ink-500" />}
        <span className="flex-1 truncate text-sm">{node.label}</span>
        <span className="font-mono text-[11px] tabular-nums text-ink-400">{node.count}</span>
      </div>
      {hasChildren && !isCollapsed && (
        <div>
          {node.children.map(child => (
            <SkillTreeNode
              key={child.key}
              node={child}
              selectedKey={selectedKey}
              collapsed={collapsed}
              onSelect={onSelect}
              onToggleCollapse={onToggleCollapse}
            />
          ))}
        </div>
      )}
    </div>
  );
}
