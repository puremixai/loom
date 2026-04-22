import { useTranslation } from 'react-i18next';
import type { UseSkillTreeResult } from '@/hooks/useSkillTree';
import { SkillTreeNode } from './SkillTreeNode';

export function SkillTree({ tree, selectedKey, setSelectedKey, collapsed, toggleCollapsed }: UseSkillTreeResult) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('skills.treeAriaLabel')} className="w-60 shrink-0 self-start sticky top-20">
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
