import type { AiConfig, Skill } from '@loom/shared';

export interface RecommendInput {
  projectHint: string;
  includes: string[];
  excludes: string[];
  keywords: string[];
  aiGuidance?: string;
  skills: Skill[];
}

export interface RecommendResult {
  picks: Array<{ skill: Skill; reason: string }>;
  warnings: string[];
  rawResponse: string;
}

export const DEFAULT_SYSTEM_PROMPT = `你是 Claude Code 技能选择顾问。给定候选技能清单和项目信息，
挑选最相关的技能子集。严格按 JSON 输出：
{ "picks": [ { "id": "<Skill.id>", "reason": "<为什么选它>" } ] }
必须遵守规则：
- includes 列出的技能必须全部返回
- excludes 列出的技能绝不返回
- 其它技能根据项目描述和 aiGuidance 评估相关性
- 只输出 JSON，不要任何额外文本`;

function buildUserPrompt(input: RecommendInput): string {
  const lines: string[] = [];
  lines.push(`项目描述：${input.projectHint}`);
  lines.push(`关键词：${input.keywords.join(', ') || '无'}`);
  lines.push(`AI 指引：${input.aiGuidance || '无'}`);
  lines.push(`强制包含：${input.includes.join(', ') || '无'}`);
  lines.push(`强制排除：${input.excludes.join(', ') || '无'}`);
  lines.push('');
  lines.push(`候选技能（共 ${input.skills.length} 条）：`);
  for (const s of input.skills) {
    const srcTag = s.source === 'plugin' && s.pluginName ? `plugin/${s.pluginName}` : s.source;
    lines.push(`- id: ${s.id} | source: ${srcTag} | name: ${s.name} | description: ${s.description}`);
  }
  return lines.join('\n');
}

function resolveApiKey(config: AiConfig): string | undefined {
  if (config.apiKeyEnv && process.env[config.apiKeyEnv]) return process.env[config.apiKeyEnv];
  return config.apiKey;
}

interface RawCall {
  endpoint: string;
  headers: Record<string, string>;
  body: string;
}

function buildRequest(config: AiConfig, systemPrompt: string, userPrompt: string): RawCall {
  const key = resolveApiKey(config);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(config.headers ?? {}) };
  let body: unknown;

  if (config.requestStyle === 'anthropic') {
    if (key) headers['x-api-key'] = key;
    headers['anthropic-version'] = headers['anthropic-version'] ?? '2023-06-01';
    body = {
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    };
  } else {
    if (key) headers['Authorization'] = `Bearer ${key}`;
    body = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    };
  }
  return { endpoint: config.endpoint, headers, body: JSON.stringify(body) };
}

function extractText(raw: unknown, style: 'openai' | 'anthropic'): string {
  if (style === 'anthropic') {
    const blocks = (raw as { content?: Array<{ type: string; text?: string }> }).content ?? [];
    return blocks.filter(b => b.type === 'text').map(b => b.text ?? '').join('');
  }
  const choices = (raw as { choices?: Array<{ message?: { content?: string } }> }).choices ?? [];
  return choices[0]?.message?.content ?? '';
}

function tryParsePicks(text: string): { picks: Array<{ id: string; reason: string }> } | null {
  try {
    const parsed = JSON.parse(text) as { picks?: Array<{ id: string; reason: string }> };
    if (Array.isArray(parsed.picks)) return { picks: parsed.picks };
  } catch { /* fall through */ }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { picks?: Array<{ id: string; reason: string }> };
      if (Array.isArray(parsed.picks)) return { picks: parsed.picks };
    } catch { /* ignored */ }
  }
  return null;
}

export interface CallAiOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function recommendSkills(
  config: AiConfig,
  input: RecommendInput,
  options: CallAiOptions = {},
): Promise<RecommendResult> {
  const style = config.requestStyle ?? 'openai';
  const systemPrompt = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(input);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const warnings: string[] = [];

  async function callOnce(promptOverride?: string): Promise<{ text: string }> {
    const { endpoint, headers, body } = buildRequest(config, promptOverride ?? systemPrompt, userPrompt);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(endpoint, { method: 'POST', headers, body, signal: controller.signal });
      if (!res.ok) throw new Error(`AI endpoint responded ${res.status}: ${await res.text()}`);
      const raw = await res.json();
      return { text: extractText(raw, style) };
    } finally { clearTimeout(t); }
  }

  let attempt = await callOnce();
  let parsed = tryParsePicks(attempt.text);
  if (!parsed) {
    warnings.push('First response not parseable as JSON; retrying with stricter instruction.');
    attempt = await callOnce(`${systemPrompt}\n\n上次输出无法解析，必须严格只返回 JSON 对象，不要任何额外文本。`);
    parsed = tryParsePicks(attempt.text);
    if (!parsed) {
      return { picks: [], warnings: [...warnings, 'Second response also unparseable.'], rawResponse: attempt.text };
    }
  }

  const byId = new Map(input.skills.map(s => [s.id, s]));
  const result = new Map<string, { skill: Skill; reason: string }>();

  for (const pick of parsed.picks) {
    const skill = byId.get(pick.id);
    if (!skill) { warnings.push(`AI returned unknown id: ${pick.id}`); continue; }
    if (input.excludes.includes(pick.id) || input.excludes.includes(skill.name)) continue;
    result.set(skill.id, { skill, reason: pick.reason });
  }

  for (const inc of input.includes) {
    const skill = [...byId.values()].find(s => s.id === inc || s.name === inc);
    if (!skill) { warnings.push(`Included id/name not found in candidates: ${inc}`); continue; }
    if (!result.has(skill.id)) result.set(skill.id, { skill, reason: '(forced include)' });
  }

  return { picks: [...result.values()], warnings, rawResponse: attempt.text };
}

export async function testConnection(config: AiConfig, options: CallAiOptions = {}): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const start = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { endpoint, headers, body } = buildRequest(
      config,
      'Reply with a single word: ok',
      'ping',
    );
    const res = await fetchImpl(endpoint, { method: 'POST', headers, body, signal: controller.signal });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
    await res.json();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  } finally {
    clearTimeout(t);
  }
}
