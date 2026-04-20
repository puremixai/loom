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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Projects ({data?.length ?? 0})</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>+ Add Project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a project</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <label className="block text-sm">
                <span>Path (absolute)</span>
                <Input value={path} onChange={e => setPath(e.target.value)} placeholder="C:/path/to/project" />
              </label>
              <label className="block text-sm">
                <span>Name (optional)</span>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Defaults to directory name" />
              </label>
              {err && <p className="text-xs text-red-600">{err}</p>}
              <div className="flex justify-end gap-2">
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleAdd} disabled={addMut.isPending || path.trim().length === 0}>
                  {addMut.isPending ? 'Adding...' : 'Add'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading && <p className="text-sm text-neutral-500">Loading...</p>}
      {data?.length === 0 && !isLoading && (
        <p className="text-sm text-neutral-500">No projects yet. Click "+ Add Project" to get started.</p>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data?.map(p => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>
                  <Link to={`/projects/${p.id}`} className="hover:underline">{p.name}</Link>
                </CardTitle>
                <Badge variant={p.status === 'ok' ? 'success' : 'destructive'}>{p.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-neutral-500">
              <p className="truncate" title={p.path}>{p.path}</p>
              {p.lastSyncedAt && <p>Last synced: {new Date(p.lastSyncedAt).toLocaleString()}</p>}
              <div className="pt-2">
                <Button
                  size="sm" variant="ghost"
                  onClick={() => { if (confirm(`Remove "${p.name}" from the list? Files in the project directory are not deleted.`)) removeMut.mutate(p.id); }}
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
