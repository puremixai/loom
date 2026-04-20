import { useEffect, useState } from 'react';
import { useSettings, useSaveSettings } from '@/api/settings';
import { usePlatform } from '@/api/platform';
import { useOpenUserSkillsDir } from '@/api/user-skills-dir';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function UserSkillsDirCard() {
  const { data: settings } = useSettings();
  const { data: platform } = usePlatform();
  const save = useSaveSettings();
  const open = useOpenUserSkillsDir();

  const [path, setPath] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const current = settings?.userSkillsDir ?? platform?.userSkillsDir ?? '';
    setPath(current);
  }, [settings, platform]);

  const effectivePath = settings?.userSkillsDir ?? platform?.userSkillsDir ?? '';
  const copyCommand = `claude "use skill-creator to create <skill-name> in ${effectivePath}"`;

  async function handleSave() {
    setErr(null); setSaved(false);
    try {
      await save.mutateAsync({ userSkillsDir: path.trim() });
      setSaved(true);
    } catch (e) { setErr((e as Error).message); }
  }

  async function copyCmd() {
    await navigator.clipboard.writeText(copyCommand);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User skills directory</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-ink-500">
          Loom-managed location for your own skills. Auto-scanned and shown under the <code className="font-mono">user-local</code> source.
        </p>

        <div className="flex gap-2">
          <Input className="font-mono text-xs" value={path} onChange={e => setPath(e.target.value)} placeholder="/home/you/.loom/skills" />
          <Button onClick={handleSave} disabled={save.isPending || path.trim() === effectivePath}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={() => open.mutate()} disabled={open.isPending}>
            {open.isPending ? 'Opening…' : 'Open folder'}
          </Button>
        </div>

        {err && <p className="text-xs text-ship-red">{err}</p>}
        {saved && <p className="text-xs text-badge-green-text">Saved.</p>}
        {open.error && <p className="text-xs text-ship-red">{(open.error as Error).message}</p>}

        <div className="rounded-lg bg-ink-50 p-3 shadow-ring-light">
          <p className="mb-2 text-xs font-medium text-ink-900">Create a new skill</p>
          <ol className="space-y-1 text-xs text-ink-600">
            <li>1. In Claude Code, run the command below (replace <code className="font-mono">&lt;skill-name&gt;</code>).</li>
            <li>2. Return here and click <strong>Refresh</strong> on the Skills Library.</li>
          </ol>
          <pre className="mt-3 overflow-x-auto rounded bg-white p-2 font-mono text-xs text-ink-900 shadow-ring-light">
{copyCommand}
          </pre>
          <Button size="sm" variant="secondary" className="mt-2" onClick={copyCmd}>Copy command</Button>
        </div>
      </CardContent>
    </Card>
  );
}
