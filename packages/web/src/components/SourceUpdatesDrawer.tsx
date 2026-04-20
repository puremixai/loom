import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, RefreshCw } from 'lucide-react';
import { useCheckSources, usePullSource } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { UpdateStatus } from '@loom/shared';

export interface SourceUpdatesDrawerProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function fmtDuration(from: string): string {
  const ms = Date.now() - new Date(from).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

function pluginCmd(name?: string): string {
  return name ? `claude plugins update ${name}` : '';
}

function StatusRow({ s, onPull, pulling }: { s: UpdateStatus; onPull: (gitRoot: string) => void; pulling?: boolean }) {
  const isPlugin = s.ref.kind === 'plugin';
  return (
    <div className="rounded-lg bg-white p-4 shadow-ring-light">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-ink-900">{s.ref.displayName}</span>
            <Badge variant={isPlugin ? 'info' : 'secondary'}>{s.ref.kind}</Badge>
            {s.dirty && <Badge variant="warning">dirty</Badge>}
          </div>
          {s.behind > 0 && (
            <p className="mt-1 text-xs text-ink-600">{s.behind} commit{s.behind > 1 ? 's' : ''} behind</p>
          )}
          {s.ahead > 0 && (
            <p className="mt-1 text-xs text-ink-600">{s.ahead} commit{s.ahead > 1 ? 's' : ''} ahead (local)</p>
          )}
          {s.lastCommit && (
            <p className="mt-1 line-clamp-2 text-xs italic text-ink-500">
              "{s.lastCommit.subject}" — {s.lastCommit.author}, {fmtDuration(s.lastCommit.date)}
            </p>
          )}
        </div>
      </div>
      {s.error && <p className="mt-2 font-mono text-xs text-ship-red">{s.error}</p>}
      {s.behind > 0 && !s.error && (
        <div className="mt-3 flex items-center gap-2">
          {isPlugin ? (
            <>
              <pre className="flex-1 overflow-x-auto rounded bg-ink-50 p-2 font-mono text-xs text-ink-900">{pluginCmd(s.ref.pluginName)}</pre>
              <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(pluginCmd(s.ref.pluginName))}>Copy</Button>
            </>
          ) : (
            <Button size="sm" onClick={() => onPull(s.ref.gitRoot)} disabled={pulling || s.dirty}>
              {pulling ? 'Pulling…' : 'Pull'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function SourceUpdatesDrawer({ open, onOpenChange }: SourceUpdatesDrawerProps) {
  const check = useCheckSources();
  const pull = usePullSource();
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [activePull, setActivePull] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    check.mutateAsync({}).then(() => setLastCheckedAt(new Date().toISOString())).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const statuses = check.data?.statuses ?? [];
  const behind = statuses.filter(s => s.behind > 0 && !s.error);
  const upToDate = statuses.filter(s => s.behind === 0 && !s.error);
  const errors = statuses.filter(s => s.error);

  async function handlePull(gitRoot: string) {
    setActivePull(gitRoot);
    try {
      await pull.mutateAsync({ gitRoot });
      await check.mutateAsync({});
      setLastCheckedAt(new Date().toISOString());
    } finally { setActivePull(null); }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-[1px]" />
        <DialogPrimitive.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-[480px] overflow-y-auto bg-white p-6 shadow-card-elevated">
          <div className="mb-4 flex items-center justify-between">
            <DialogPrimitive.Title className="text-[17px] font-semibold tracking-heading">Source updates</DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-md p-1.5 text-ink-500 hover:bg-ink-50 hover:text-ink-900">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="mb-4 flex items-center gap-3 text-xs text-ink-500">
            <Button size="sm" variant="secondary" onClick={() => check.mutate({})} disabled={check.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="ml-1">{check.isPending ? 'Checking…' : 'Refresh now'}</span>
            </Button>
            {lastCheckedAt && <span>Last checked {fmtDuration(lastCheckedAt)}</span>}
          </div>

          {check.error && <p className="mb-3 font-mono text-xs text-ship-red">{(check.error as Error).message}</p>}

          <div className="space-y-5">
            {behind.length > 0 && (
              <section>
                <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-tight text-ink-500">Behind upstream ({behind.length})</h3>
                <div className="space-y-2">
                  {behind.map(s => (
                    <StatusRow key={s.ref.gitRoot} s={s} onPull={handlePull} pulling={activePull === s.ref.gitRoot} />
                  ))}
                </div>
              </section>
            )}
            {upToDate.length > 0 && (
              <section>
                <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-tight text-ink-500">Up to date ({upToDate.length})</h3>
                <ul className="space-y-1 text-sm text-ink-600">
                  {upToDate.map(s => <li key={s.ref.gitRoot} className="truncate">✓ {s.ref.displayName}</li>)}
                </ul>
              </section>
            )}
            {errors.length > 0 && (
              <section>
                <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-tight text-ink-500">Errors ({errors.length})</h3>
                <div className="space-y-2">
                  {errors.map(s => (
                    <div key={s.ref.gitRoot} className="rounded-lg bg-badge-red-bg p-3 shadow-ring-light">
                      <p className="text-sm font-medium text-badge-red-text">{s.ref.displayName}</p>
                      <p className="mt-1 font-mono text-xs text-badge-red-text/80">{s.error}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
