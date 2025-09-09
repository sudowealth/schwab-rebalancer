import { formatCurrency } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader } from '../ui/card';

interface GroupHeaderStatsProps {
  totalValue: number;
  membersCount: number;
  assignedModel: {
    name: string;
  } | null;
  updatedAt: string | null;
}

export function GroupHeaderStats({
  totalValue,
  membersCount,
  assignedModel,
  updatedAt,
}: GroupHeaderStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total Portfolio Value</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Number of Accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{membersCount}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Assigned Model</CardDescription>
        </CardHeader>
        <CardContent>
          {assignedModel ? (
            <Badge variant="default">{assignedModel.name}</Badge>
          ) : (
            <Badge variant="outline">No Model</Badge>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Last Updated</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            {updatedAt ? new Date(updatedAt).toLocaleDateString() : 'N/A'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
