import type { Skill } from '@loom/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface SkillCardProps {
  skill: Skill;
  selected?: boolean;
  onToggle?: (skill: Skill) => void;
}

export function SkillCard({ skill, selected, onToggle }: SkillCardProps) {
  return (
    <Card
      role={onToggle ? 'button' : undefined}
      onClick={onToggle ? () => onToggle(skill) : undefined}
      className={selected ? 'ring-2 ring-ink-900' : undefined}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{skill.name}</CardTitle>
          <Badge variant="secondary">{skill.pluginName ?? skill.source}</Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-ink-600">
        {skill.description}
      </CardContent>
    </Card>
  );
}
