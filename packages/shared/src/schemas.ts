import { z } from 'zod';

export const SkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  source: z.enum(['user', 'custom', 'plugin', 'user-local']),
  sourceRoot: z.string().min(1),
  absolutePath: z.string().min(1),
  skillDir: z.string().min(1),
  pluginName: z.string().optional(),
  fingerprint: z.string().min(1),
});
export type Skill = z.infer<typeof SkillSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  path: z.string().min(1),
  addedAt: z.string().datetime(),
  lastSyncedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const RuleFileSchema = z.object({
  version: z.literal(1),
  projectHint: z.string(),
  includes: z.array(z.string()).default([]),
  excludes: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  aiGuidance: z.string().optional(),
  lastAppliedSkills: z.array(z.string()).optional(),
});
export type RuleFile = z.infer<typeof RuleFileSchema>;

export const ManifestEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sourceDir: z.string().min(1),
  linkedAs: z.string().min(1),
});
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

export const ManifestSchema = z.object({
  version: z.literal(1),
  tool: z.literal('loom'),
  appliedAt: z.string().datetime(),
  method: z.enum(['symlink', 'junction', 'copy']),
  skills: z.array(ManifestEntrySchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const AiConfigSchema = z.object({
  endpoint: z.string().url(),
  model: z.string().min(1),
  apiKeyEnv: z.string().optional(),
  apiKey: z.string().optional(),
  headers: z.record(z.string()).optional(),
  systemPrompt: z.string().optional(),
  requestStyle: z.enum(['openai', 'anthropic']).default('openai'),
});
export type AiConfig = z.infer<typeof AiConfigSchema>;

export const CenterDbSchema = z.object({
  projects: z.array(ProjectSchema).default([]),
  scanPaths: z.array(z.string()).default([]),
  userSkillsDir: z.string().optional(),
  ai: AiConfigSchema.partial().default({}),
});
export type CenterDb = z.infer<typeof CenterDbSchema>;

export const ApplyRequestSchema = z.object({
  skillIds: z.array(z.string()).min(1),
});
export const UnapplyRequestSchema = z.object({
  skillIds: z.array(z.string()).optional(),
});
export const DiffPreviewSchema = z.object({
  toAdd: z.array(SkillSchema),
  toKeep: z.array(SkillSchema),
  toRemove: z.array(ManifestEntrySchema),
});
export type DiffPreview = z.infer<typeof DiffPreviewSchema>;

export const AiRecommendRequestSchema = z.object({
  projectId: z.string().uuid(),
  projectHint: z.string().min(1),
  includes: z.array(z.string()).default([]),
  excludes: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  aiGuidance: z.string().optional(),
});

export const AiRecommendResultSchema = z.object({
  picks: z.array(z.object({
    skill: SkillSchema,
    reason: z.string(),
  })),
  warnings: z.array(z.string()).default([]),
});

export type ApplyRequest = z.infer<typeof ApplyRequestSchema>;
export type UnapplyRequest = z.infer<typeof UnapplyRequestSchema>;
export type AiRecommendRequest = z.infer<typeof AiRecommendRequestSchema>;
export type AiRecommendResult = z.infer<typeof AiRecommendResultSchema>;

export const SourceKindSchema = z.enum(['git-source', 'plugin']);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const SourceRefSchema = z.object({
  kind: SourceKindSchema,
  gitRoot: z.string().min(1),
  displayName: z.string().min(1),
  skillIds: z.array(z.string()),
  marketplace: z.string().optional(),
  pluginName: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const UpdateStatusSchema = z.object({
  ref: SourceRefSchema,
  ahead: z.number().int().nonnegative(),
  behind: z.number().int().nonnegative(),
  dirty: z.boolean(),
  lastFetchAt: z.string().datetime().optional(),
  lastCommit: z.object({
    sha: z.string(),
    subject: z.string(),
    author: z.string(),
    date: z.string(),
  }).optional(),
  error: z.string().optional(),
});
export type UpdateStatus = z.infer<typeof UpdateStatusSchema>;

export const PullResultSchema = z.object({
  ok: z.boolean(),
  output: z.string(),
  error: z.string().optional(),
});
export type PullResult = z.infer<typeof PullResultSchema>;
