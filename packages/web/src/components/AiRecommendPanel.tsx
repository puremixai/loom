import { useState } from 'react';
import { useRecommend } from '@/api/ai';
import { useSaveRules } from '@/api/rules';
import { useApply, useDiffPreview } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DiffPreview } from '@/components/DiffPreview';
import type { RuleFile } from '@skill-manager/shared';

export function AiRecommendPanel({ projectId, initialRules }: { projectId: string; initialRules: RuleFile | null }) {
  const [projectHint, setProjectHint] = useState(initialRules?.projectHint ?? '');
  const [includesText, setIncludesText] = useState((initialRules?.includes ?? []).join(', '));
  const [excludesText, setExcludesText] = useState((initialRules?.excludes ?? []).join(', '));
  const [keywordsText, setKeywordsText] = useState((initialRules?.keywords ?? []).join(', '));
  const [aiGuidance, setAiGuidance] = useState(initialRules?.aiGuidance ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [diffOpen, setDiffOpen] = useState(false);

  const recommend = useRecommend();
  const saveRules = useSaveRules();
  const diffMut = useDiffPreview();
  const applyMut = useApply();

  const toList = (s: string): string[] => s.split(',').map(x => x.trim()).filter(Boolean);

  async function runRecommend() {
    const data = await recommend.mutateAsync({
      projectId,
      projectHint,
      includes: toList(includesText),
      excludes: toList(excludesText),
      keywords: toList(keywordsText),
      aiGuidance: aiGuidance || undefined,
    });
    setSelectedIds(new Set(data.picks.map(p => p.skill.id)));
  }

  function togglePick(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function saveAndPreview() {
    const rules: RuleFile = {
      version: 1,
      projectHint,
      includes: toList(includesText),
      excludes: toList(excludesText),
      keywords: toList(keywordsText),
      aiGuidance: aiGuidance || undefined,
      lastAppliedSkills: Array.from(selectedIds),
    };
    await saveRules.mutateAsync({ projectId, rules });
    await diffMut.mutateAsync({ projectId, skillIds: Array.from(selectedIds) });
    setDiffOpen(true);
  }

  async function confirmApply() {
    await applyMut.mutateAsync({ projectId, skillIds: Array.from(selectedIds) });
    setDiffOpen(false);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="font-medium">Project hint</span>
          <textarea
            className="mt-1 w-full rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            rows={3} value={projectHint} onChange={e => setProjectHint(e.target.value)}
            placeholder="Full-stack React + Supabase app with auth and billing."
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Keywords (comma-separated)</span>
          <Input value={keywordsText} onChange={e => setKeywordsText(e.target.value)} placeholder="react, supabase, auth" />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Includes (skill ids or names)</span>
          <Input value={includesText} onChange={e => setIncludesText(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Excludes</span>
          <Input value={excludesText} onChange={e => setExcludesText(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">AI guidance</span>
          <textarea
            className="mt-1 w-full rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            rows={3} value={aiGuidance} onChange={e => setAiGuidance(e.target.value)}
            placeholder="Prefer skills focused on testing and debugging."
          />
        </label>
        <div className="flex items-center gap-2">
          <Button onClick={runRecommend} disabled={recommend.isPending || projectHint.trim().length === 0}>
            {recommend.isPending ? 'Generating...' : 'Generate recommendations'}
          </Button>
          <Button variant="outline" onClick={saveAndPreview} disabled={selectedIds.size === 0}>
            Save rules & preview apply
          </Button>
        </div>
        {recommend.error && <p className="text-xs text-red-600">{(recommend.error as Error).message}</p>}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Recommendations ({recommend.data?.picks.length ?? 0})</h3>
        {recommend.data?.warnings.length ? (
          <div className="mb-2 rounded border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-900 dark:bg-yellow-950/40">
            {recommend.data.warnings.join(' · ')}
          </div>
        ) : null}
        <div className="space-y-2">
          {recommend.data?.picks.map(p => (
            <label key={p.skill.id} className="flex cursor-pointer items-start gap-2 rounded border p-2 text-sm dark:border-neutral-800">
              <input type="checkbox" className="mt-1" checked={selectedIds.has(p.skill.id)} onChange={() => togglePick(p.skill.id)} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.skill.name}</span>
                  <Badge variant="outline">{p.skill.pluginName ?? p.skill.source}</Badge>
                </div>
                <p className="text-xs text-neutral-500">{p.skill.description}</p>
                <p className="mt-1 text-xs italic text-neutral-600 dark:text-neutral-400">Why: {p.reason}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review changes</DialogTitle></DialogHeader>
          {diffMut.data && <DiffPreview diff={diffMut.data} />}
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
