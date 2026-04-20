import type { UseSkillTreeResult } from '@/hooks/useSkillTree';
import { SkillTreeNode } from './SkillTreeNode';

export function SkillTree({ tree, selectedKey, setSelectedKey, collapsed, toggleCollapsed }: UseSkillTreeResult) {
  return (
    <nav aria-label="Skills tree" className="w-60 shrink-0 self-start sticky top-20">
      <SkillTreeNode
        node={tree}
        selectedKey={selectedKey}
        collapsed={collapsed}
        onSelect={setSelectedKey}
        onToggleCollapse={toggleCollapsed}
      />
    </nav>
  );
}
