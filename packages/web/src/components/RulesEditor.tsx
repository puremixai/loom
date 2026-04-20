import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useRules, useSaveRules } from '@/api/rules';
import { apiFetch } from '@/api/client';
import { useApply, useDiffPreview } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { DiffPreview } from '@/components/DiffPreview';
import type { RuleFile, Skill, DiffPreview as DP } from '@loom/shared';

interface SyncResponse {
  picks: Array<{ skill: Skill; reason: string }>;
  diff: DP & { missing: string[] };
  warnings: string[];
  desiredIds: string[];
}

function toYaml(rules: RuleFile | null): string {
  if (!rules) {
    return `version: 1
projectHint: ""
includes: []
excludes: []
keywords: []
aiGuidance: ""
`;
  }
  const out: string[] = [];
  out.push(`version: 1`);
  out.push(`projectHint: ${JSON.stringify(rules.projectHint ?? '')}`);
  out.push(`includes:`);
  (rules.includes ?? []).forEach(x => out.push(`  - ${JSON.stringify(x)}`));
  out.push(`excludes:`);
  (rules.excludes ?? []).forEach(x => out.push(`  - ${JSON.stringify(x)}`));
  out.push(`keywords:`);
  (rules.keywords ?? []).forEach(x => out.push(`  - ${JSON.stringify(x)}`));
  if (rules.aiGuidance) out.push(`aiGuidance: ${JSON.stringify(rules.aiGuidance)}`);
  return out.join('\n');
}

export function RulesEditor({ projectId }: { projectId: string }) {
  const { data: rulesRes } = useRules(projectId);
  const [text, setText] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const saveMut = useSaveRules();
  const diffMut = useDiffPreview();
  const applyMut = useApply();

  useEffect(() => { setText(toYaml(rulesRes?.rules ?? null)); }, [rulesRes]);

  async function save() {
    setErr(null);
    try {
      const yaml = (await import('js-yaml')).default;
      const parsed = yaml.load(text) as RuleFile;
      await saveMut.mutateAsync({ projectId, rules: parsed });
    } catch (e) { setErr((e as Error).message); }
  }

  async function runSync() {
    setErr(null);
    try {
      const data = await apiFetch<SyncResponse>(`/api/projects/${projectId}/sync`, { method: 'POST' });
      setSyncResult(data);
      await diffMut.mutateAsync({ projectId, skillIds: data.desiredIds });
      setDiffOpen(true);
    } catch (e) { setErr((e as Error).message); }
  }

  async function confirmApply() {
    if (!syncResult) return;
    await applyMut.mutateAsync({ projectId, skillIds: syncResult.desiredIds });
    setDiffOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="h-96 overflow-hidden rounded-lg shadow-border">
        <Editor
          language="yaml"
          theme="vs-dark"
          value={text}
          onChange={(v) => setText(v ?? '')}
          options={{ minimap: { enabled: false }, fontSize: 13 }}
        />
      </div>
      {err && <p className="text-xs text-ship-red">{err}</p>}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saveMut.isPending}>
          {saveMut.isPending ? 'Saving…' : 'Save rules'}
        </Button>
        <Button variant="secondary" onClick={runSync}>
          Sync by rules
        </Button>
      </div>

      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sync preview</DialogTitle></DialogHeader>
          {diffMut.data && <DiffPreview diff={diffMut.data} />}
          {syncResult?.warnings.length ? (
            <div className="mt-3 rounded-lg bg-badge-yellow-bg p-3 shadow-ring-light">
              <p className="text-sm font-medium text-badge-yellow-text">
                {syncResult.warnings.join(' · ')}
              </p>
            </div>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
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
