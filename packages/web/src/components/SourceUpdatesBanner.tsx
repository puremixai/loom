import { useState } from 'react';
import { useSources, useCheckSources } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { SourceUpdatesDrawer } from './SourceUpdatesDrawer';

export function SourceUpdatesBanner() {
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
          <span className="font-medium text-ink-900">Sources</span>
          <span className="text-ink-500">
            {refCount} git-backed
            {check.data && updateCount > 0 && (
              <> · <span className="text-develop-blue">{updateCount} have updates</span></>
            )}
          </span>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>View</Button>
      </div>
      <SourceUpdatesDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
