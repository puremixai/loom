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
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="font-semibold leading-tight tracking-heading text-ink-900" style={{ fontSize: '32px' }}>
            Skills Library
          </h1>
          <p className="mt-1.5 text-sm text-ink-500">
            {data?.skills.length ?? 0} discovered across configured scan paths
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search name or description…" value={q} onChange={e => setQ(e.target.value)} className="w-80" />
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

      {Object.entries(groups).map(([key, skills]) => (
        <section key={key} className="space-y-3">
          <div className="flex items-baseline gap-3">
            <h2 className="font-mono text-xs font-medium uppercase tracking-tight text-ink-500">
              {key}
            </h2>
            <span className="text-xs text-ink-400">{skills.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {skills.map(s => <SkillCard key={s.id} skill={s} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
