import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, Folder, FolderOpen, HardDrive, Home, Loader2 } from 'lucide-react';
import type { FsBrowseResponse } from '@loom/shared';
import { browseDir } from '@/api/fs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface DirectoryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPath?: string;
  onSelect: (absolutePath: string) => void;
}

/**
 * Modal directory picker backed by the server's /api/fs/browse endpoint.
 * Works identically in web and Tauri (both load the SPA over HTTP), so one
 * component serves both deployment forms without exposing Tauri IPC.
 *
 * UX: Home / Drives shortcut row, breadcrumbs for the current path, a list
 * of child directories, a "Select this folder" button that confirms the
 * current cwd. Manual path entry via Input at the top for keyboard power
 * users.
 */
export function DirectoryPicker({ open, onOpenChange, initialPath, onSelect }: DirectoryPickerProps) {
  const { t } = useTranslation();
  const [cwd, setCwd] = useState<string>(initialPath ?? '');
  const [manualPath, setManualPath] = useState<string>(initialPath ?? '');
  const [data, setData] = useState<FsBrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load whenever `cwd` changes while the picker is open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    browseDir(cwd || undefined)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setManualPath(result.cwd);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, cwd]);

  // Reset to initialPath (or home) each time the dialog opens.
  useEffect(() => {
    if (open) {
      setCwd(initialPath ?? '');
      setManualPath(initialPath ?? '');
      setError(null);
    }
  }, [open, initialPath]);

  const crumbs = useMemo(() => {
    if (!data || data.isRoot) return [];
    const parts = data.cwd.split(/[\\/]+/).filter(Boolean);
    const sep = data.separator;
    // Windows drive: first segment like "C:" joined with sep. POSIX: prepend /.
    const isWin = sep === '\\';
    const acc: { label: string; path: string }[] = [];
    let accPath = isWin ? '' : '/';
    for (const p of parts) {
      accPath = isWin
        ? (accPath === '' ? `${p}\\` : `${accPath}${p}\\`)
        : `${accPath === '/' ? '' : accPath}/${p}`;
      acc.push({ label: p, path: accPath });
    }
    return acc;
  }, [data]);

  function submitManualPath(e: React.FormEvent) {
    e.preventDefault();
    if (manualPath.trim()) setCwd(manualPath.trim());
  }

  function confirm() {
    if (data && data.cwd) {
      onSelect(data.cwd);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('directoryPicker.title')}</DialogTitle>
        </DialogHeader>

        {/* Quick-jump row + manual input */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setCwd(data?.home ?? '~')}
            className="h-8 gap-1.5"
            title={t('directoryPicker.home')}
          >
            <Home className="h-3.5 w-3.5" /> {t('directoryPicker.home')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setCwd('')}
            className="h-8 gap-1.5"
            title={t('directoryPicker.roots')}
          >
            <HardDrive className="h-3.5 w-3.5" /> {t('directoryPicker.roots')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (data?.parent !== null && data?.parent !== undefined) setCwd(data.parent);
            }}
            disabled={data?.parent === null || data?.parent === undefined}
            className="h-8 gap-1.5"
            title={t('directoryPicker.up')}
          >
            <ChevronUp className="h-3.5 w-3.5" /> {t('directoryPicker.up')}
          </Button>
          <form onSubmit={submitManualPath} className="flex min-w-[260px] flex-1 gap-2">
            <Input
              className="h-8 font-mono text-xs"
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              placeholder={t('directoryPicker.manualPathPlaceholder')}
              spellCheck={false}
            />
            <Button type="submit" variant="secondary" className="h-8">
              {t('directoryPicker.go')}
            </Button>
          </form>
        </div>

        {/* Breadcrumbs */}
        {crumbs.length > 0 && (
          <nav className="mt-3 flex flex-wrap items-center gap-1 font-mono text-xs text-ink-500">
            {crumbs.map((c, i) => (
              <span key={c.path} className="flex items-center gap-1">
                {i > 0 && <span className="text-ink-400">{data?.separator === '\\' ? '\\' : '/'}</span>}
                <button
                  type="button"
                  onClick={() => setCwd(c.path)}
                  className="rounded px-1 hover:bg-ink-50 hover:text-ink-900"
                >
                  {c.label}
                </button>
              </span>
            ))}
          </nav>
        )}

        {/* Listing */}
        <div className="mt-3 h-72 overflow-auto rounded-md shadow-ring-light">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('common.loading')}
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-ship-red">{error}</div>
          ) : data && data.entries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-400">
              {t('directoryPicker.emptyFolder')}
            </div>
          ) : (
            <ul className="divide-y divide-ink-50">
              {data?.entries.map((e) => {
                const isDrive = data.isRoot && data.separator === '\\';
                return (
                  <li key={e.path}>
                    <button
                      type="button"
                      onDoubleClick={() => setCwd(e.path)}
                      onClick={() => setCwd(e.path)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-50 hover:text-ink-900',
                      )}
                    >
                      {isDrive ? (
                        <HardDrive className="h-4 w-4 text-ink-400" />
                      ) : (
                        <Folder className="h-4 w-4 text-ink-400" />
                      )}
                      <span className="font-mono text-xs">{e.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Current selection preview + confirm */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-mono uppercase tracking-tight text-ink-400">
              {t('directoryPicker.selected')}
            </p>
            <p className="truncate font-mono text-xs text-ink-900" title={data?.cwd ?? ''}>
              {data?.cwd || t('directoryPicker.noSelection')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={confirm}
              disabled={!data || data.isRoot || !data.cwd}
              className="gap-1.5"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {t('directoryPicker.selectThis')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
