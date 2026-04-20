import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAddProject, useProjects, useRemoveProject } from '@/api/projects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';

export function ProjectsPage() {
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
            Projects
          </h1>
          <p className="mt-1.5 text-sm text-ink-500">
            {data?.length ?? 0} registered · manage per-project skill sets
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add Project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-ink-900">Path</span>
                <p className="mt-0.5 text-xs text-ink-500">Absolute path to the project directory</p>
                <Input className="mt-2 font-mono text-xs" value={path} onChange={e => setPath(e.target.value)} placeholder="C:/path/to/project" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink-900">Name <span className="text-ink-400">(optional)</span></span>
                <Input className="mt-2" value={name} onChange={e => setName(e.target.value)} placeholder="Defaults to directory name" />
              </label>
              {err && <p className="text-xs text-ship-red">{err}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
                <Button onClick={handleAdd} disabled={addMut.isPending || path.trim().length === 0}>
                  {addMut.isPending ? 'Adding…' : 'Add'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-ink-500">Loading…</p>}

      {data?.length === 0 && !isLoading && (
        <div className="rounded-lg bg-white py-16 text-center shadow-border">
          <p className="text-base text-ink-900">No projects registered yet</p>
          <p className="mt-1 text-sm text-ink-500">Click "Add Project" above to get started.</p>
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
                  Last synced: {new Date(p.lastSyncedAt).toLocaleString()}
                </p>
              )}
              <div className="pt-1">
                <Button
                  size="sm" variant="ghost"
                  onClick={() => { if (confirm(`Remove "${p.name}" from the list? Files in the project directory are not deleted.`)) removeMut.mutate(p.id); }}
                  className="text-ink-500 hover:text-ship-red hover:bg-white"
                >
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
