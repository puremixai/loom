import { describe, it, expect } from 'vitest';
import { recommendSkills } from '../src/services/ai.js';
import type { Skill, AiConfig } from '@loom/shared';

function makeSkill(id: string, name: string): Skill {
  return {
    id, name, description: `${name} description`,
    source: 'user', sourceRoot: '/root', absolutePath: `/root/${name}/SKILL.md`,
    skillDir: `/root/${name}`, fingerprint: '1-1',
  };
}

const baseConfig: AiConfig = {
  endpoint: 'https://example.test/chat',
  model: 'test-model',
  requestStyle: 'openai',
};

describe('recommendSkills', () => {
  it('parses openai-style response and respects excludes/includes', async () => {
    const skills = [makeSkill('s1', 'alpha'), makeSkill('s2', 'beta'), makeSkill('s3', 'gamma')];
    const fake: typeof fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ picks: [
        { id: 's1', reason: 'useful' },
        { id: 's2', reason: 'also useful' },
      ] }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });

    const result = await recommendSkills(baseConfig, {
      projectHint: 'demo', includes: ['s3'], excludes: ['s2'], keywords: [], skills,
    }, { fetchImpl: fake });

    const ids = result.picks.map(p => p.skill.id).sort();
    expect(ids).toEqual(['s1', 's3']);
  });

  it('retries on unparseable response', async () => {
    const skills = [makeSkill('s1', 'alpha')];
    let call = 0;
    const fake: typeof fetch = async () => {
      call++;
      const content = call === 1 ? 'definitely not json' : JSON.stringify({ picks: [{ id: 's1', reason: 'x' }] });
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    };
    const result = await recommendSkills(baseConfig, {
      projectHint: 'demo', includes: [], excludes: [], keywords: [], skills,
    }, { fetchImpl: fake });
    expect(call).toBe(2);
    expect(result.picks).toHaveLength(1);
    expect(result.warnings[0]).toContain('not parseable');
  });

  it('handles anthropic-style response', async () => {
    const skills = [makeSkill('s1', 'alpha')];
    const fake: typeof fetch = async () => new Response(JSON.stringify({
      content: [{ type: 'text', text: JSON.stringify({ picks: [{ id: 's1', reason: 'good' }] }) }],
    }), { status: 200 });

    const result = await recommendSkills({ ...baseConfig, requestStyle: 'anthropic' }, {
      projectHint: 'demo', includes: [], excludes: [], keywords: [], skills,
    }, { fetchImpl: fake });
    expect(result.picks.map(p => p.skill.id)).toEqual(['s1']);
  });
});
