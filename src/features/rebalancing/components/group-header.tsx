import { Link } from '@tanstack/react-router';
import { Edit, Trash2 } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import type { RebalancingGroup } from '~/features/auth/schemas';

interface GroupHeaderProps {
  group: RebalancingGroup;
  onEdit: () => void;
  onDelete: () => void;
}

export function GroupHeader({ group, onEdit, onDelete }: GroupHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
        <div className="flex flex-col items-start gap-1">
          {group.assignedModel ? (
            <Link
              to="/models/$modelId"
              params={{ modelId: group.assignedModel.id }}
              className="inline-flex"
            >
              <Badge variant="default" className="cursor-pointer">
                {group.assignedModel.name}
              </Badge>
            </Link>
          ) : (
            <Badge variant="outline">No Model</Badge>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit className="mr-1 h-4 w-4" />
          Edit
        </Button>
        <Button variant="outline" size="sm" className="text-destructive" onClick={onDelete}>
          <Trash2 className="mr-1 h-4 w-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}
