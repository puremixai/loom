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

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Settings</h2>

      <Card>
        <CardHeader><CardTitle>AI configuration</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <label className="block">
            <span className="font-medium">Request style</span>
            <select
              className="mt-1 w-full rounded border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
              value={requestStyle} onChange={e => setRequestStyle(e.target.value as 'openai' | 'anthropic')}
            >
              <option value="openai">openai (chat/completions)</option>
              <option value="anthropic">anthropic (messages)</option>
            </select>
          </label>
          <label className="block">
            <span className="font-medium">Endpoint URL</span>
            <Input value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="https://api.openai.com/v1/chat/completions" />
          </label>
          <label className="block">
            <span className="font-medium">Model</span>
            <Input value={model} onChange={e => setModel(e.target.value)} placeholder="gpt-4o-mini or claude-3-5-sonnet-latest" />
          </label>
          <label className="block">
            <span className="font-medium">API key env var (preferred)</span>
            <Input value={apiKeyEnv} onChange={e => setApiKeyEnv(e.target.value)} placeholder="OPENAI_API_KEY" />
          </label>
          <label className="block">
            <span className="font-medium">API key (fallback, stored in plaintext)</span>
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <Button variant="outline" onClick={() => setShowKey(s => !s)}>{showKey ? 'Hide' : 'Show'}</Button>
            </div>
            <p className="mt-1 text-xs text-red-600">&#9888; Stored in ~/.skill-manager/db.json in plaintext. Prefer env vars.</p>
          </label>
          <label className="block">
            <span className="font-medium">Custom system prompt (optional)</span>
            <textarea
              className="mt-1 w-full rounded border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
              rows={4} value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
            />
          </label>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
              {test.isPending ? 'Testing...' : 'Test connection'}
            </Button>
            {test.data && (
              test.data.ok
                ? <Badge variant="success">OK · {test.data.latencyMs}ms</Badge>
                : <Badge variant="destructive">FAIL</Badge>
            )}
          </div>
          {test.data && !test.data.ok && (
            <p className="text-xs text-red-600">{test.data.error}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Scan paths</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-2 text-xs text-neutral-500">One path per line. Defaults cover ~/.claude skills and plugins.</p>
          <textarea
            className="w-full rounded border border-neutral-300 p-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
            rows={6} value={scanPathsText} onChange={e => setScanPathsText(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Platform</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {platform ? (
            <ul className="space-y-1 text-xs text-neutral-600 dark:text-neutral-300">
              <li>OS: {platform.os} {platform.release} ({platform.arch})</li>
              <li>Node: {platform.node}</li>
              <li>Link method: <Badge variant="secondary">{platform.linkMethodPreview}</Badge></li>
            </ul>
          ) : <p className="text-xs text-neutral-500">Loading...</p>}
        </CardContent>
      </Card>
    </div>
  );
}
