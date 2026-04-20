import { useEffect, useState } from 'react';
import { useSettings, useSaveSettings, useTestAi } from '@/api/settings';
import { usePlatform } from '@/api/platform';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export function SettingsPage() {
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

  const Label = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
    <div className="mb-2">
      <span className="text-sm font-medium text-ink-900">{children}</span>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-semibold leading-tight tracking-heading text-ink-900" style={{ fontSize: '32px' }}>
          Settings
        </h1>
        <p className="mt-1.5 text-sm text-ink-500">
          AI provider, scan paths, and platform diagnostics
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="block">
            <Label hint="Both styles share the same response parser.">Request style</Label>
            <select
              className="flex h-9 w-full rounded-md bg-white px-3 text-sm text-ink-900 shadow-ring-light transition-all hover:shadow-border"
              value={requestStyle} onChange={e => setRequestStyle(e.target.value as 'openai' | 'anthropic')}
            >
              <option value="openai">openai (chat/completions)</option>
              <option value="anthropic">anthropic (messages)</option>
            </select>
          </label>

          <label className="block">
            <Label>Endpoint URL</Label>
            <Input className="font-mono text-xs" value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="https://api.openai.com/v1/chat/completions" />
          </label>

          <label className="block">
            <Label>Model</Label>
            <Input className="font-mono text-xs" value={model} onChange={e => setModel(e.target.value)} placeholder="gpt-4o-mini or claude-sonnet-4-6" />
          </label>

          <label className="block">
            <Label hint="Preferred — key read from this environment variable at runtime.">API key env var</Label>
            <Input className="font-mono text-xs" value={apiKeyEnv} onChange={e => setApiKeyEnv(e.target.value)} placeholder="OPENAI_API_KEY" />
          </label>

          <label className="block">
            <Label hint="Fallback — stored in plaintext in ~/.skill-manager/db.json. Prefer env var.">API key</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="sk-…"
                className="font-mono text-xs"
              />
              <Button variant="secondary" onClick={() => setShowKey(s => !s)}>{showKey ? 'Hide' : 'Show'}</Button>
            </div>
          </label>

          <label className="block">
            <Label hint="Overrides the default system prompt when set.">Custom system prompt</Label>
            <textarea
              className="flex w-full rounded-md bg-white p-3 text-sm text-ink-900 shadow-ring-light transition-all hover:shadow-border"
              rows={5} value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
            />
          </label>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={() => test.mutate()} disabled={test.isPending}>
              {test.isPending ? 'Testing…' : 'Test connection'}
            </Button>
            {test.data && (
              test.data.ok
                ? <Badge variant="success">OK · {test.data.latencyMs}ms</Badge>
                : <Badge variant="destructive">FAIL</Badge>
            )}
          </div>
          {test.data && !test.data.ok && (
            <p className="font-mono text-xs text-ship-red">{test.data.error}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scan paths</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-ink-500">One path per line. Defaults cover ~/.claude skills and plugins.</p>
          <textarea
            className="flex w-full rounded-md bg-white p-3 font-mono text-xs text-ink-900 shadow-ring-light transition-all hover:shadow-border"
            rows={6} value={scanPathsText} onChange={e => setScanPathsText(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform</CardTitle>
        </CardHeader>
        <CardContent>
          {platform ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <dt className="font-mono text-xs uppercase tracking-tight text-ink-500">OS</dt>
              <dd className="font-mono text-xs text-ink-900">{platform.os} {platform.release} ({platform.arch})</dd>
              <dt className="font-mono text-xs uppercase tracking-tight text-ink-500">Node</dt>
              <dd className="font-mono text-xs text-ink-900">{platform.node}</dd>
              <dt className="font-mono text-xs uppercase tracking-tight text-ink-500">Link method</dt>
              <dd><Badge variant="info">{platform.linkMethodPreview}</Badge></dd>
            </dl>
          ) : <p className="text-sm text-ink-500">Loading…</p>}
        </CardContent>
      </Card>
    </div>
  );
}
