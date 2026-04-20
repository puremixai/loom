import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { DiffPreview } from '@/components/DiffPreview';
import { useSkills } from '@/api/skills';
import { useProjects, useManifest, useDiffPreview, useApply, useUnapply } from '@/api/projects';
import { AiRecommendPanel } from '@/components/AiRecommendPanel';
import { RulesEditor } from '@/components/RulesEditor';
import { useRules } from '@/api/rules';
import type { Skill } from '@skill-manager/shared';

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
  const diffMut = useDiffPreview();
  const applyMut = useApply();
  const unapplyMut = useUnapply();
  const { data: rulesRes } = useRules(id);

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

  if (!project) return <p className="text-sm text-neutral-500">Loading project...</p>;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/" className="text-xs text-neutral-500 hover:underline">← Back to projects</Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{project.name}</h2>
            <p className="text-xs text-neutral-500">{project.path}</p>
          </div>
          <Badge variant={manifest?.method === 'copy' ? 'outline' : 'secondary'}>
            {manifest ? `method: ${manifest.method}` : 'not initialized'}
          </Badge>
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
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-neutral-800">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Linked as</th>
                      <th className="p-3">Source dir</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {manifest.skills.map(s => (
                      <tr key={s.id} className="border-t dark:border-neutral-800">
                        <td className="p-3 font-medium">{s.name}</td>
                        <td className="p-3 font-mono text-xs text-neutral-500">{s.linkedAs}</td>
                        <td className="p-3 font-mono text-xs text-neutral-500" title={s.sourceDir}>{s.sourceDir}</td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => { if (confirm(`Remove "${s.name}"?`) && id) unapplyMut.mutate({ projectId: id, skillIds: [s.id] }); }}
                          >Remove</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-neutral-500">No skills applied yet. Use the "Add skills" tab.</p>
          )}
        </TabsContent>

        <TabsContent value="add">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Input placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} className="w-80" />
              <Button onClick={previewApply} disabled={selected.size === 0 || diffMut.isPending}>
                {diffMut.isPending ? 'Computing diff...' : `Preview (${selected.size})`}
              </Button>
            </div>
            {Object.entries(groups).map(([key, skills]) => (
              <section key={key} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{key} ({skills.length})</h3>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {skills.map(s => {
                    const applied = appliedIds.has(s.id);
                    const checked = selected.has(s.id) || applied;
                    return (
                      <label key={s.id} className="flex cursor-pointer items-start gap-2 rounded border p-2 text-sm dark:border-neutral-800">
                        <input
                          type="checkbox" className="mt-1"
                          checked={checked}
                          onChange={() => toggle(s.id)}
                          disabled={applied}
                        />
                        <div>
                          <div className="font-medium">{s.name} {applied && <span className="text-xs text-neutral-400">(applied)</span>}</div>
                          <div className="line-clamp-2 text-xs text-neutral-500">{s.description}</div>
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
            <p className="mt-3 text-xs text-red-600">Unknown skill ids: {diffMut.data.missing.join(', ')}</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={confirmApply} disabled={applyMut.isPending}>
              {applyMut.isPending ? 'Applying...' : 'Apply'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
