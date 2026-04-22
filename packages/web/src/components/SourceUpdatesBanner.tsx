import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSources, useCheckSources } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { SourceUpdatesDrawer } from './SourceUpdatesDrawer';

export function SourceUpdatesBanner() {
  const { t } = useTranslation();
  const { data } = useSources();
  const check = useCheckSources();
  const [open, setOpen] = useState(false);
  const refCount = data?.refs.length ?? 0;
  const updateCount = (check.data?.statuses ?? []).filter(s => s.behind > 0 && !s.error).length;

  if (refCount === 0) return null;

  return (
    <>
      <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-ring-light">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium text-ink-900">{t('sources.bannerLabel')}</span>
          <span className="text-ink-500">
            {t('sources.bannerGitBacked', { count: refCount })}
            {check.data && updateCount > 0 && (
              <> · <span className="text-develop-blue">{t('sources.bannerHasUpdates', { count: updateCount })}</span></>
            )}
          </span>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{t('sources.viewButton')}</Button>
      </div>
      <SourceUpdatesDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
