import { useMemo, useState } from 'react';
import { useSkills } from '@/api/skills';
import { SkillCard } from '@/components/SkillCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Skill } from '@skill-manager/shared';

function group(skills: Skill[]): Record<string, Skill[]> {
  const out: Record<string, Skill[]> = {};
  for (const s of skills) {
    const key = s.source === 'plugin' ? `plugin · ${s.pluginName ?? '(unknown)'}` : s.source;
    (out[key] ??= []).push(s);
  }
  return out;
}

export function SkillsPage() {
  const [q, setQ] = useState('');
  const { data, isLoading, refetch, isFetching } = useSkills();
  const filtered = useMemo(() => {
    if (!data) return [] as Skill[];
    const needle = q.trim().toLowerCase();
    if (!needle) return data.skills;
    return data.skills.filter(s =>
      s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle),
    );
  }, [data, q]);
  const groups = useMemo(() => group(filtered), [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Skills ({data?.skills.length ?? 0})</h2>
        <div className="flex items-center gap-2">
          <Input placeholder="Search name or description..." value={q} onChange={e => setQ(e.target.value)} className="w-80" />
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>
      {isLoading && <p className="text-sm text-neutral-500">Loading...</p>}
      {data?.warnings.length ? (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-900 dark:bg-yellow-950/40">
          {data.warnings.length} skills failed to parse. First: {data.warnings[0]}
        </div>
      ) : null}
      {Object.entries(groups).map(([key, skills]) => (
        <section key={key} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{key} ({skills.length})</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {skills.map(s => <SkillCard key={s.id} skill={s} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
