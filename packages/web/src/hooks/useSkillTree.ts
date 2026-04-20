import { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Skill } from '@loom/shared';

export const ROOT_KEY = '__root__';
const COLLAPSED_STORAGE_KEY = 'loom:skill-tree:collapsed';

export interface TreeNode {
  key: string;
  label: string;
  depth: number;
  count: number;
  directCount: number;
  children: TreeNode[];
  skills: Skill[];
}

export function skillPath(s: Skill): string[] {
  if (s.source === 'plugin') {
    const parts = (s.pluginName ?? 'unknown').split('/');
    return ['plugin', ...parts];
  }
  return [s.source];
}

export function buildTree(skills: Skill[]): TreeNode {
  const root: TreeNode = { key: ROOT_KEY, label: 'All', depth: 0, count: 0, directCount: 0, children: [], skills: [] };
  for (const skill of skills) {
    const path = skillPath(skill);
    let node = root;
    for (let i = 0; i < path.length; i++) {
      const segment = path[i]!;
      const childKey = node.key === ROOT_KEY ? segment : `${node.key}/${segment}`;
      let child = node.children.find(c => c.key === childKey);
      if (!child) {
        child = { key: childKey, label: segment, depth: node.depth + 1, count: 0, directCount: 0, children: [], skills: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.skills.push(skill);
    node.directCount++;
  }
  const computeCount = (n: TreeNode): number => {
    const childrenSum = n.children.reduce((sum, c) => sum + computeCount(c), 0);
    n.count = n.directCount + childrenSum;
    return n.count;
  };
  computeCount(root);
  const sortTree = (n: TreeNode): void => {
    n.children.sort((a, b) => a.label.localeCompare(b.label));
    n.children.forEach(sortTree);
  };
  sortTree(root);
  return root;
}

function getVisibleSkills(tree: TreeNode, selectedKey: string): Skill[] {
  const find = (n: TreeNode): TreeNode | null => {
    if (n.key === selectedKey) return n;
    for (const c of n.children) {
      const found = find(c);
      if (found) return found;
    }
    return null;
  };
  const target = find(tree);
  if (!target) return [];
  const collect = (n: TreeNode): Skill[] => [...n.skills, ...n.children.flatMap(collect)];
  return collect(target);
}

function loadCollapsed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch { return new Set(); }
}

function saveCollapsed(collapsed: Set<string>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...collapsed]));
}

export interface UseSkillTreeResult {
  tree: TreeNode;
  selectedKey: string;
  setSelectedKey: (key: string) => void;
  collapsed: Set<string>;
  toggleCollapsed: (key: string) => void;
  visibleSkills: Skill[];
}

export function useSkillTree(skills: Skill[]): UseSkillTreeResult {
  const tree = useMemo(() => buildTree(skills), [skills]);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedKey = searchParams.get('path') ?? ROOT_KEY;
  const setSelectedKey = useCallback((key: string) => {
    const next = new URLSearchParams(searchParams);
    if (key === ROOT_KEY) next.delete('path');
    else next.set('path', key);
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed());
  useEffect(() => { saveCollapsed(collapsed); }, [collapsed]);
  const toggleCollapsed = useCallback((key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const visibleSkills = useMemo(() => getVisibleSkills(tree, selectedKey), [tree, selectedKey]);

  return { tree, selectedKey, setSelectedKey, collapsed, toggleCollapsed, visibleSkills };
}
