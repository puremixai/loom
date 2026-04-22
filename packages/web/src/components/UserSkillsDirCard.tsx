import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { FolderOpen } from 'lucide-react';
import { useSettings, useSaveSettings } from '@/api/settings';
import { usePlatform } from '@/api/platform';
import { useOpenUserSkillsDir } from '@/api/user-skills-dir';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DirectoryPicker } from '@/components/DirectoryPicker';

export function UserSkillsDirCard() {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const { data: platform } = usePlatform();
  const save = useSaveSettings();
  const open = useOpenUserSkillsDir();

  const [path, setPath] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
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
        <CardTitle>{t('settings.userSkills.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-ink-500">
          <Trans
            i18nKey="settings.userSkills.cardDescription"
            components={{ code: <code className="font-mono" /> }}
          />
        </p>

        <div className="flex flex-wrap gap-2">
          <Input className="min-w-[200px] flex-1 font-mono text-xs" value={path} onChange={e => setPath(e.target.value)} placeholder="/home/you/.loom/skills" />
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPickerOpen(true)}
            className="shrink-0 gap-1.5"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {t('directoryPicker.browse')}
          </Button>
          <Button onClick={handleSave} disabled={save.isPending || path.trim() === effectivePath}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
          <Button variant="secondary" onClick={() => open.mutate()} disabled={open.isPending}>
            {open.isPending ? t('common.opening') : t('settings.userSkills.openFolder')}
          </Button>
        </div>
        <DirectoryPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          initialPath={path.trim() || undefined}
          onSelect={(p) => setPath(p)}
        />

        {err && <p className="text-xs text-ship-red">{err}</p>}
        {saved && <p className="text-xs text-badge-green-text">{t('settings.userSkills.saved')}</p>}
        {open.error && <p className="text-xs text-ship-red">{(open.error as Error).message}</p>}

        <div className="rounded-lg bg-ink-50 p-3 shadow-ring-light">
          <p className="mb-2 text-xs font-medium text-ink-900">{t('settings.userSkills.createTitle')}</p>
          <ol className="space-y-1 text-xs text-ink-600">
            <li>
              {t('settings.userSkills.createStep1Prefix')}
              <code className="font-mono">&lt;skill-name&gt;</code>
              {t('settings.userSkills.createStep1Suffix')}
            </li>
            <li>
              {t('settings.userSkills.createStep2Prefix')}
              <strong>{t('settings.userSkills.createStep2Bold')}</strong>
              {t('settings.userSkills.createStep2Suffix')}
            </li>
          </ol>
          <pre className="mt-3 overflow-x-auto rounded bg-white p-2 font-mono text-xs text-ink-900 shadow-ring-light">
{copyCommand}
          </pre>
          <Button size="sm" variant="secondary" className="mt-2" onClick={copyCmd}>{t('settings.userSkills.copyCommand')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
