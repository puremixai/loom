import { useMemo, useState } from 'react';
import { useSkills } from '@/api/skills';
import { useSkillTree } from '@/hooks/useSkillTree';
import { SkillTree } from '@/components/SkillTree';
import { SkillCard } from '@/components/SkillCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Skill } from '@loom/shared';

export function SkillsPage() {
  const [q, setQ] = useState('');
  const { data, isLoading, refetch, isFetching } = useSkills();
  const skills = data?.skills ?? [];
  const treeResult = useSkillTree(skills);
  const { visibleSkills, tree, selectedKey } = treeResult;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return visibleSkills;
    return visibleSkills.filter((s: Skill) =>
      s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle),
    );
  }, [visibleSkills, q]);

  const currentLabel = selectedKey === tree.key ? 'All skills' : selectedKey.split('/').pop()!;

  return (
    <div className="flex gap-8">
      <aside className="hidden md:block">
        <SkillTree {...treeResult} />
      </aside>

      <div className="flex-1 space-y-6">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="font-semibold leading-tight tracking-heading text-ink-900" style={{ fontSize: '32px' }}>
              {currentLabel}
            </h1>
            <p className="mt-1.5 text-sm text-ink-500">
              {filtered.length} of {skills.length} skills
              {q.trim() && <> matching "{q.trim()}"</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} className="w-80" />
            <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>

        {isLoading && <p className="text-sm text-ink-500">Loading…</p>}

        {data?.warnings.length ? (
          <div className="rounded-lg bg-badge-yellow-bg p-4 shadow-ring-light">
            <p className="text-sm font-medium text-badge-yellow-text">
              {data.warnings.length} skills failed to parse
            </p>
            <p className="mt-1 font-mono text-xs text-badge-yellow-text/80">{data.warnings[0]}</p>
          </div>
        ) : null}

        {!isLoading && filtered.length === 0 && (
          <div className="rounded-lg bg-white py-16 text-center shadow-border">
            <p className="text-base text-ink-900">No skills in this path</p>
            <p className="mt-1 text-sm text-ink-500">Pick another folder in the sidebar, or clear the search.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(s => <SkillCard key={s.id} skill={s} />)}
        </div>
      </div>
    </div>
  );
}
