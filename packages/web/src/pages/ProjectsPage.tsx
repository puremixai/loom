import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAddProject, useProjects, useRemoveProject } from '@/api/projects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { LoomLogo } from '@/components/ui/loom-icon';

export function ProjectsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useProjects();
  const addMut = useAddProject();
  const removeMut = useRemoveProject();
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleAdd() {
    try {
      setErr(null);
      await addMut.mutateAsync({ path: path.trim(), name: name.trim() || undefined });
      setPath(''); setName(''); setOpen(false);
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="font-semibold leading-tight tracking-heading text-ink-900" style={{ fontSize: '32px' }}>
            {t('projects.title')}
          </h1>
          <p className="mt-1.5 text-sm text-ink-500">
            {t('projects.subtitleCount', { count: data?.length ?? 0 })}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>{t('projects.addButton')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('projects.addDialog.titleAlt')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-ink-900">{t('projects.addDialog.pathLabel')}</span>
                <p className="mt-0.5 text-xs text-ink-500">{t('projects.addDialog.pathHint')}</p>
                <Input className="mt-2 font-mono text-xs" value={path} onChange={e => setPath(e.target.value)} placeholder={t('projects.addDialog.pathPlaceholderShort')} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink-900">{t('projects.addDialog.nameLabel')} <span className="text-ink-400">{t('projects.addDialog.nameOptional')}</span></span>
                <Input className="mt-2" value={name} onChange={e => setName(e.target.value)} placeholder={t('projects.addDialog.nameDefaultHint')} />
              </label>
              {err && <p className="text-xs text-ship-red">{err}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose asChild><Button variant="secondary">{t('common.cancel')}</Button></DialogClose>
                <Button onClick={handleAdd} disabled={addMut.isPending || path.trim().length === 0}>
                  {addMut.isPending ? t('projects.addDialog.submitting') : t('projects.addDialog.submit')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-ink-500">{t('common.loading')}</p>}

      {data?.length === 0 && !isLoading && (
        <div className="rounded-lg bg-white py-16 text-center shadow-border">
          <div className="flex justify-center mb-5">
            <LoomLogo size="lg" />
          </div>
          <p className="text-base text-ink-900">{t('projects.empty.headlineAlt')}</p>
          <p className="mt-1 text-sm text-ink-500">{t('projects.empty.descriptionAlt')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.map(p => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>
                  <Link to={`/projects/${p.id}`} className="hover:underline decoration-ink-400 underline-offset-4">
                    {p.name}
                  </Link>
                </CardTitle>
                <Badge variant={p.status === 'ok' ? 'success' : 'destructive'}>{p.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="truncate font-mono text-xs text-ink-500" title={p.path}>{p.path}</p>
              {p.lastSyncedAt && (
                <p className="text-xs text-ink-500">
                  {t('projects.lastSynced', { date: new Date(p.lastSyncedAt).toLocaleString() })}
                </p>
              )}
              <div className="pt-1">
                <Button
                  size="sm" variant="ghost"
                  onClick={() => { if (confirm(t('projects.removeConfirm', { name: p.name }))) removeMut.mutate(p.id); }}
                  className="text-ink-500 hover:text-ship-red hover:bg-white"
                >
                  {t('common.remove')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
