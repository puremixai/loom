import type { Skill } from '@skill-manager/shared';
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
      className={selected ? 'ring-2 ring-neutral-900 dark:ring-neutral-100' : undefined}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{skill.name}</CardTitle>
          <Badge variant="outline">{skill.pluginName ?? skill.source}</Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-neutral-600 dark:text-neutral-400">
        {skill.description}
      </CardContent>
    </Card>
  );
}
