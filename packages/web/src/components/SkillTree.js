import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { SkillTreeNode } from './SkillTreeNode';
export function SkillTree({ tree, selectedKey, setSelectedKey, collapsed, toggleCollapsed }) {
    const { t } = useTranslation();
    return (_jsx("nav", { "aria-label": t('skills.treeAriaLabel'), className: "w-60 shrink-0 self-start sticky top-20", children: _jsx(SkillTreeNode, { node: tree, selectedKey: selectedKey, collapsed: collapsed, onSelect: setSelectedKey, onToggleCollapse: toggleCollapsed }) }));
}
