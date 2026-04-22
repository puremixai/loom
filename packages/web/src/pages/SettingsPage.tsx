import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings, useSaveSettings, useTestAi } from '@/api/settings';
import { usePlatform } from '@/api/platform';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserSkillsDirCard } from '@/components/UserSkillsDirCard';
import { SettingsNav } from '@/components/SettingsNav';
import i18n, { type Locale, writeStoredLocale } from '@/i18n';

export function SettingsPage() {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const { data: platform } = usePlatform();
  const save = useSaveSettings();
  const test = useTestAi();

  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [apiKeyEnv, setApiKeyEnv] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [requestStyle, setRequestStyle] = useState<'openai' | 'anthropic'>('openai');
  const [showKey, setShowKey] = useState(false);
  const [scanPathsText, setScanPathsText] = useState('');
  const [locale, setLocale] = useState<Locale>((i18n.language as Locale) ?? 'zh');

  const SETTINGS_SECTIONS = [
    { id: 'language', label: t('settings.sections.language') },
    { id: 'ai-config', label: t('settings.sections.ai') },
    { id: 'user-skills-dir', label: t('settings.sections.userSkillsDir') },
    { id: 'scan-paths', label: t('settings.sections.scanPaths') },
    { id: 'platform', label: t('settings.sections.platform') },
  ];

  useEffect(() => {
    if (!settings) return;
    setEndpoint(settings.ai.endpoint ?? '');
    setModel(settings.ai.model ?? '');
    setApiKeyEnv(settings.ai.apiKeyEnv ?? '');
    setApiKey(settings.ai.apiKey ?? '');
    setSystemPrompt(settings.ai.systemPrompt ?? '');
    setRequestStyle((settings.ai.requestStyle as 'openai' | 'anthropic') ?? 'openai');
    setScanPathsText(settings.scanPaths.join('\n'));
  }, [settings]);

  async function handleSave() {
    await save.mutateAsync({
      scanPaths: scanPathsText.split('\n').map(s => s.trim()).filter(Boolean),
      ai: {
        endpoint: endpoint.trim(),
        model: model.trim(),
        apiKeyEnv: apiKeyEnv.trim() || undefined,
        apiKey: apiKey.trim() ? apiKey.trim() : undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        requestStyle,
      },
    });
  }

  function handleLocaleChange(next: Locale) {
    setLocale(next);
    writeStoredLocale(next);
    i18n.changeLanguage(next);
  }

  const Label = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
    <div className="mb-2">
      <span className="text-sm font-medium text-ink-900">{children}</span>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );

  return (
    <div className="flex gap-8">
      <aside className="hidden md:block">
        <SettingsNav items={SETTINGS_SECTIONS} />
      </aside>

      <div className="flex-1 space-y-8">
      <div>
        <h1 className="font-semibold leading-tight tracking-heading text-ink-900" style={{ fontSize: '32px' }}>
          {t('settings.title')}
        </h1>
        <p className="mt-1.5 text-sm text-ink-500">
          {t('settings.subtitle')}
        </p>
      </div>

      <section id="language" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.language.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-ink-500">{t('settings.language.description')}</p>
            <label className="block">
              <Label>{t('settings.language.label')}</Label>
              <select
                className="flex h-9 w-full max-w-xs rounded-md bg-white px-3 text-sm text-ink-900 shadow-ring-light transition-all hover:shadow-border"
                value={locale}
                onChange={(e) => handleLocaleChange(e.target.value as Locale)}
              >
                <option value="zh">{t('settings.language.options.zh')}</option>
                <option value="en">{t('settings.language.options.en')}</option>
              </select>
            </label>
          </CardContent>
        </Card>
      </section>

      <section id="ai-config" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.ai.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="block">
            <Label hint={t('settings.ai.requestStyleHint')}>{t('settings.ai.requestStyle')}</Label>
            <select
              className="flex h-9 w-full rounded-md bg-white px-3 text-sm text-ink-900 shadow-ring-light transition-all hover:shadow-border"
              value={requestStyle} onChange={e => setRequestStyle(e.target.value as 'openai' | 'anthropic')}
            >
              <option value="openai">openai (chat/completions)</option>
              <option value="anthropic">anthropic (messages)</option>
            </select>
          </label>

          <label className="block">
            <Label>{t('settings.ai.endpoint')}</Label>
            <Input className="font-mono text-xs" value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="https://api.openai.com/v1/chat/completions" />
          </label>

          <label className="block">
            <Label>{t('settings.ai.model')}</Label>
            <Input className="font-mono text-xs" value={model} onChange={e => setModel(e.target.value)} placeholder="gpt-4o-mini or claude-sonnet-4-6" />
          </label>

          <label className="block">
            <Label hint={t('settings.ai.apiKeyEnvHint')}>{t('settings.ai.apiKeyEnv')}</Label>
            <Input className="font-mono text-xs" value={apiKeyEnv} onChange={e => setApiKeyEnv(e.target.value)} placeholder="OPENAI_API_KEY" />
          </label>

          <label className="block">
            <Label hint={t('settings.ai.apiKeyHint')}>{t('settings.ai.apiKey')}</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="sk-…"
                className="font-mono text-xs"
              />
              <Button variant="secondary" onClick={() => setShowKey(s => !s)}>
                {showKey ? t('common.hide') : t('common.show')}
              </Button>
            </div>
          </label>

          <label className="block">
            <Label hint={t('settings.ai.systemPromptHint')}>{t('settings.ai.systemPrompt')}</Label>
            <textarea
              className="flex w-full rounded-md bg-white p-3 text-sm text-ink-900 shadow-ring-light transition-all hover:shadow-border"
              rows={5} value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
            />
          </label>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
            <Button variant="secondary" onClick={() => test.mutate()} disabled={test.isPending}>
              {test.isPending ? t('settings.ai.testing') : t('settings.ai.testConnection')}
            </Button>
            {test.data && (
              test.data.ok
                ? <Badge variant="success">{t('settings.ai.testOk', { latency: test.data.latencyMs })}</Badge>
                : <Badge variant="destructive">{t('settings.ai.testFail')}</Badge>
            )}
          </div>
          {test.data && !test.data.ok && (
            <p className="font-mono text-xs text-ship-red">{test.data.error}</p>
          )}
        </CardContent>
      </Card>
      </section>

      <section id="user-skills-dir" className="scroll-mt-24">
        <UserSkillsDirCard />
      </section>

      <section id="scan-paths" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.scanPaths.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-ink-500">{t('settings.scanPaths.description')}</p>
          <textarea
            className="flex w-full rounded-md bg-white p-3 font-mono text-xs text-ink-900 shadow-ring-light transition-all hover:shadow-border"
            rows={6} value={scanPathsText} onChange={e => setScanPathsText(e.target.value)}
          />
        </CardContent>
      </Card>
      </section>

      <section id="platform" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.platform.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {platform ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <dt className="font-mono text-xs uppercase tracking-tight text-ink-500">{t('settings.platform.os')}</dt>
              <dd className="font-mono text-xs text-ink-900">{platform.os} {platform.release} ({platform.arch})</dd>
              <dt className="font-mono text-xs uppercase tracking-tight text-ink-500">{t('settings.platform.node')}</dt>
              <dd className="font-mono text-xs text-ink-900">{platform.node}</dd>
              <dt className="font-mono text-xs uppercase tracking-tight text-ink-500">{t('settings.platform.linkMethod')}</dt>
              <dd><Badge variant="info">{platform.linkMethodPreview}</Badge></dd>
            </dl>
          ) : <p className="text-sm text-ink-500">{t('settings.platform.loading')}</p>}
        </CardContent>
      </Card>
      </section>
      </div>
    </div>
  );
}
