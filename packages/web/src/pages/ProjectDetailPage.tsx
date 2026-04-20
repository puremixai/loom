import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { DiffPreview } from '@/components/DiffPreview';
import { AiRecommendPanel } from '@/components/AiRecommendPanel';
import { RulesEditor } from '@/components/RulesEditor';
import { useRules } from '@/api/rules';
import { useSkills } from '@/api/skills';
import { useProjects, useManifest, useDiffPreview, useApply, useUnapply } from '@/api/projects';
import type { Skill } from '@loom/shared';

function group(skills: Skill[]): Record<string, Skill[]> {
  const out: Record<string, Skill[]> = {};
  for (const s of skills) {
    const k = s.source === 'plugin' ? `plugin · ${s.pluginName ?? '(unknown)'}` : s.source;
    (out[k] ??= []).push(s);
  }
  return out;
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: projects } = useProjects();
  const project = projects?.find(p => p.id === id);
  const { data: manifestRes } = useManifest(id);
  const { data: skillsRes } = useSkills();
  const { data: rulesRes } = useRules(id);
  const diffMut = useDiffPreview();
  const applyMut = useApply();
  const unapplyMut = useUnapply();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [diffOpen, setDiffOpen] = useState(false);

  const manifest = manifestRes?.manifest ?? null;
  const appliedIds = new Set((manifest?.skills ?? []).map(s => s.id));

  const filteredSkills = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (skillsRes?.skills ?? []).filter(s =>
      !needle || s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle),
    );
  }, [skillsRes, q]);

  const groups = useMemo(() => group(filteredSkills), [filteredSkills]);

  function toggle(idS: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idS)) next.delete(idS); else next.add(idS);
      return next;
    });
  }

  async function previewApply() {
    if (!id) return;
    const desiredIds = Array.from(new Set([...selected, ...appliedIds]));
    await diffMut.mutateAsync({ projectId: id, skillIds: desiredIds });
    setDiffOpen(true);
  }

  async function confirmApply() {
    if (!id || !diffMut.data) return;
    const desired = new Set<string>();
    for (const s of diffMut.data.toAdd) desired.add(s.id);
    for (const s of diffMut.data.toKeep) desired.add(s.id);
    await applyMut.mutateAsync({ projectId: id, skillIds: Array.from(desired) });
    setDiffOpen(false);
    setSelected(new Set());
  }

  if (!project) return <p className="text-sm text-ink-500">Loading project…</p>;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/" className="text-xs text-ink-500 hover:text-ink-900 transition-colors">
          ← Projects
        </Link>
        <div className="mt-3 flex items-start justify-between gap-6">
          <div>
            <h1 className="font-semibold leading-tight tracking-heading text-ink-900" style={{ fontSize: '32px' }}>
              {project.name}
            </h1>
            <p className="mt-1.5 truncate font-mono text-xs text-ink-500">{project.path}</p>
          </div>
          <div className="flex items-center gap-2">
            {manifest ? (
              <>
                <Badge variant="info">{manifest.skills.length} applied</Badge>
                <Badge variant={manifest.method === 'copy' ? 'warning' : 'secondary'}>
                  {manifest.method}
                </Badge>
              </>
            ) : (
              <Badge variant="secondary">not initialized</Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="applied">
        <TabsList>
          <TabsTrigger value="applied">Applied ({manifest?.skills.length ?? 0})</TabsTrigger>
          <TabsTrigger value="add">Add skills</TabsTrigger>
          <TabsTrigger value="ai">AI recommend</TabsTrigger>
          <TabsTrigger value="rules">Rules & sync</TabsTrigger>
        </TabsList>

        <TabsContent value="applied">
          {manifest?.skills.length ? (
            <div className="overflow-hidden rounded-lg bg-white shadow-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]">
                    <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-tight text-ink-500">Name</th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-tight text-ink-500">Linked as</th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-tight text-ink-500">Source</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {manifest.skills.map((s, i) => (
                    <tr key={s.id} className={i > 0 ? 'shadow-[inset_0_1px_0_rgba(0,0,0,0.06)]' : ''}>
                      <td className="px-4 py-3 font-medium text-ink-900">{s.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-500">{s.linkedAs}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-500" title={s.sourceDir}>
                        <span className="block max-w-xs truncate">{s.sourceDir}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => { if (confirm(`Remove "${s.name}"?`) && id) unapplyMut.mutate({ projectId: id, skillIds: [s.id] }); }}
                          className="text-ink-500 hover:text-ship-red hover:bg-white"
                        >Remove</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg bg-white py-16 text-center shadow-border">
              <p className="text-base text-ink-900">No skills applied yet</p>
              <p className="mt-1 text-sm text-ink-500">Open the "Add skills" tab to pick from the library.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="add">
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} className="w-80" />
              <Button onClick={previewApply} disabled={selected.size === 0 || diffMut.isPending}>
                {diffMut.isPending ? 'Computing diff…' : `Preview (${selected.size})`}
              </Button>
            </div>
            {Object.entries(groups).map(([key, skills]) => (
              <section key={key} className="space-y-2">
                <div className="flex items-baseline gap-3">
                  <h3 className="font-mono text-xs font-medium uppercase tracking-tight text-ink-500">{key}</h3>
                  <span className="text-xs text-ink-400">{skills.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {skills.map(s => {
                    const applied = appliedIds.has(s.id);
                    const checked = selected.has(s.id) || applied;
                    return (
                      <label
                        key={s.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3 text-sm shadow-ring-light transition-all hover:shadow-border ${applied ? 'opacity-60' : ''}`}
                      >
                        <input
                          type="checkbox" className="mt-1"
                          checked={checked}
                          onChange={() => toggle(s.id)}
                          disabled={applied}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="truncate font-medium text-ink-900">{s.name}</span>
                            {applied && <span className="text-[10px] font-mono uppercase text-ink-400">applied</span>}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{s.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ai">
          {id && <AiRecommendPanel projectId={id} initialRules={rulesRes?.rules ?? null} />}
        </TabsContent>

        <TabsContent value="rules">
          {id && <RulesEditor projectId={id} />}
        </TabsContent>
      </Tabs>

      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review changes</DialogTitle>
          </DialogHeader>
          {diffMut.data && <DiffPreview diff={diffMut.data} />}
          {diffMut.data?.missing && diffMut.data.missing.length > 0 && (
            <p className="mt-3 text-xs text-ship-red">Unknown skill ids: {diffMut.data.missing.join(', ')}</p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
            <Button onClick={confirmApply} disabled={applyMut.isPending}>
              {applyMut.isPending ? 'Applying…' : 'Apply'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
