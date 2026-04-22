import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRecommend } from '@/api/ai';
import { useSaveRules } from '@/api/rules';
import { useApply, useDiffPreview } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DiffPreview } from '@/components/DiffPreview';
import type { RuleFile } from '@loom/shared';

export function AiRecommendPanel({ projectId, initialRules }: { projectId: string; initialRules: RuleFile | null }) {
  const { t } = useTranslation();
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
          <span className="font-medium text-ink-900">{t('ai.panel.projectHint')}</span>
          <textarea
            className="mt-1 w-full rounded-md bg-white p-3 text-sm text-ink-900 shadow-ring-light transition-all hover:shadow-border"
            rows={3} value={projectHint} onChange={e => setProjectHint(e.target.value)}
            placeholder={t('ai.panel.projectHintPlaceholder')}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink-900">{t('ai.panel.keywords')}</span>
          <Input value={keywordsText} onChange={e => setKeywordsText(e.target.value)} placeholder={t('ai.panel.keywordsPlaceholder')} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink-900">{t('ai.panel.includes')}</span>
          <Input value={includesText} onChange={e => setIncludesText(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink-900">{t('ai.panel.excludes')}</span>
          <Input value={excludesText} onChange={e => setExcludesText(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink-900">{t('ai.panel.aiGuidance')}</span>
          <textarea
            className="mt-1 w-full rounded-md bg-white p-3 text-sm text-ink-900 shadow-ring-light transition-all hover:shadow-border"
            rows={3} value={aiGuidance} onChange={e => setAiGuidance(e.target.value)}
            placeholder={t('ai.panel.aiGuidancePlaceholder')}
          />
        </label>
        <div className="flex items-center gap-2">
          <Button onClick={runRecommend} disabled={recommend.isPending || projectHint.trim().length === 0}>
            {recommend.isPending ? t('ai.panel.generating') : t('ai.panel.generate')}
          </Button>
          <Button variant="secondary" onClick={saveAndPreview} disabled={selectedIds.size === 0}>
            {t('ai.panel.saveAndPreview')}
          </Button>
        </div>
        {recommend.error && <p className="text-xs text-ship-red">{(recommend.error as Error).message}</p>}
      </div>

      <div>
        <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-tight text-ink-500">
          {t('ai.panel.recommendations')} <span className="ml-1 text-ink-400">{recommend.data?.picks.length ?? 0}</span>
        </h3>
        {recommend.data?.warnings.length ? (
          <div className="mb-3 rounded-lg bg-badge-yellow-bg p-3 shadow-ring-light">
            <p className="text-sm font-medium text-badge-yellow-text">
              {recommend.data.warnings.join(' · ')}
            </p>
          </div>
        ) : null}
        <div className="space-y-2">
          {recommend.data?.picks.map(p => (
            <label key={p.skill.id} className="flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3 text-sm shadow-ring-light transition-all hover:shadow-border">
              <input type="checkbox" className="mt-1" checked={selectedIds.has(p.skill.id)} onChange={() => togglePick(p.skill.id)} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-900">{p.skill.name}</span>
                  <Badge variant="secondary">{p.skill.pluginName ?? p.skill.source}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">{p.skill.description}</p>
                <p className="mt-1 text-xs italic text-ink-600">{t('ai.panel.why', { reason: p.reason })}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('projectDetail.diff.reviewChanges')}</DialogTitle></DialogHeader>
          {diffMut.data && <DiffPreview diff={diffMut.data} />}
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild><Button variant="secondary">{t('common.cancel')}</Button></DialogClose>
            <Button onClick={confirmApply} disabled={applyMut.isPending}>
              {applyMut.isPending ? t('common.applying') : t('common.apply')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
