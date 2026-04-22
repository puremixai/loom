import type { DiffPreview as DP, ManifestEntry, Skill } from '@loom/shared';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

export function DiffPreview({ diff }: { diff: DP & { missing?: string[] } }) {
  const { t } = useTranslation();
  const Section = ({ title, color, items, render }: {
    title: string; color: 'success' | 'destructive' | 'secondary';
    items: Array<Skill | ManifestEntry>;
    render: (x: Skill | ManifestEntry) => string;
  }) => (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Badge variant={color}>{title}</Badge>
        <span className="text-xs text-ink-500">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-ink-400 italic">{t('diff.none')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map(x => <li key={(x as { id: string }).id}>{render(x)}</li>)}
        </ul>
      )}
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Section title={t('diff.add')} color="success" items={diff.toAdd} render={(s) => (s as Skill).name} />
      <Section title={t('diff.keep')} color="secondary" items={diff.toKeep} render={(s) => (s as Skill).name} />
      <Section title={t('diff.remove')} color="destructive" items={diff.toRemove} render={(e) => (e as ManifestEntry).name} />
    </div>
  );
}
