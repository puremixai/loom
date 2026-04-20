import { describe, it, expect } from 'vitest';
import { buildTree, skillPath, ROOT_KEY } from '../src/hooks/useSkillTree';
import type { Skill } from '@loom/shared';

function mk(id: string, name: string, source: Skill['source'], pluginName?: string): Skill {
  return {
    id, name,
    description: `${name} description`,
    source,
    sourceRoot: '/root', absolutePath: `/root/${name}/SKILL.md`, skillDir: `/root/${name}`,
    fingerprint: '1', pluginName,
  };
}

describe('useSkillTree pure helpers', () => {
  it('skillPath returns [source] for non-plugin', () => {
    expect(skillPath(mk('a', 'alpha', 'user'))).toEqual(['user']);
    expect(skillPath(mk('b', 'beta', 'user-local'))).toEqual(['user-local']);
  });

  it('skillPath splits pluginName into path segments', () => {
    expect(skillPath(mk('c', 'gamma', 'plugin', 'claude-plugins-official/superpowers'))).toEqual(
      ['plugin', 'claude-plugins-official', 'superpowers']
    );
  });

  it('buildTree groups skills by path and computes counts', () => {
    const skills: Skill[] = [
      mk('1', 'a', 'user'),
      mk('2', 'b', 'user-local'),
      mk('3', 'c', 'plugin', 'market-a/plugin-x'),
      mk('4', 'd', 'plugin', 'market-a/plugin-x'),
      mk('5', 'e', 'plugin', 'market-a/plugin-y'),
    ];
    const root = buildTree(skills);
    expect(root.key).toBe(ROOT_KEY);
    expect(root.count).toBe(5);
    const userNode = root.children.find(c => c.key === 'user')!;
    expect(userNode.count).toBe(1);
    const pluginNode = root.children.find(c => c.key === 'plugin')!;
    expect(pluginNode.count).toBe(3);
    const marketNode = pluginNode.children.find(c => c.key === 'plugin/market-a')!;
    expect(marketNode.count).toBe(3);
    const pluginX = marketNode.children.find(c => c.label === 'plugin-x')!;
    expect(pluginX.directCount).toBe(2);
  });

  it('buildTree sorts children alphabetically', () => {
    const skills: Skill[] = [
      mk('1', 'z', 'plugin', 'z-market/p'),
      mk('2', 'a', 'user-local'),
      mk('3', 'm', 'plugin', 'a-market/p'),
    ];
    const root = buildTree(skills);
    const labels = root.children.map(c => c.label);
    expect(labels).toEqual([...labels].sort());
  });
});
