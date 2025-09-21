import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';
import {
  getAllUsersServerFn,
  getUserDataServerFn,
  updateUserRoleServerFn,
} from '~/features/dashboard/admin.server';
import { queryKeys } from '~/lib/query-keys';
import { adminGuard } from '~/lib/route-guards';

type AdminUser = Awaited<ReturnType<typeof getAllUsersServerFn>>[number];
type UserData = Awaited<ReturnType<typeof getUserDataServerFn>>;
type Account = UserData['accounts'][number];
type Model = UserData['models'][number];
type RebalancingGroup = UserData['rebalancingGroups'][number];

import { Eye, Shield, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { deleteUserServerFn } from '~/features/auth/auth.server';

export const Route = createFileRoute('/admin/users')({
  component: UserManagement,
  beforeLoad: adminGuard,
  loader: async () => {
    // Admin auth is handled by beforeLoad, loader only fetches data
    return getAllUsersServerFn();
  },
});

function UserManagement() {
  // Get initial data from loader
  const loaderData = Route.useLoaderData();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUserDataDialog, setShowUserDataDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const queryClient = useQueryClient();

  const { data: users, isPending: usersPending } = useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: () => getAllUsersServerFn(),
    initialData: loaderData, // Use loader data as initial data
  });

  const { data: userData, isPending: userDataPending } = useQuery({
    queryKey: selectedUserId ? queryKeys.admin.userData(selectedUserId) : [],
    queryFn: () =>
      selectedUserId ? getUserDataServerFn({ data: { userId: selectedUserId } }) : null,
    enabled: !!selectedUserId && showUserDataDialog,
  });

  const updateRoleMutation = useMutation({
    mutationFn: (variables: { userId: string; role: 'user' | 'admin' }) =>
      updateUserRoleServerFn({ data: variables }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (variables: { userId: string; confirmation: string }) =>
      deleteUserServerFn({ data: variables }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowDeleteDialog(false);
      setSelectedUserId(null);
      setDeleteConfirmation('');
    },
  });

  if (usersPending) {
    return <div>Loading...</div>;
  }

  const handleRoleChange = (userId: string, role: 'user' | 'admin') => {
    updateRoleMutation.mutate({ userId, role });
  };

  const handleDeleteUser = () => {
    if (selectedUserId && deleteConfirmation === 'DELETE_USER_DATA') {
      deleteUserMutation.mutate({
        userId: selectedUserId,
        confirmation: deleteConfirmation,
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-sm text-gray-600">Manage user accounts and permissions</p>
        </div>
        <Button onClick={() => window.history.back()}>Back to Admin</Button>
      </div>

      <ErrorBoundaryWrapper
        title="User Management Error"
        description="Failed to load user management interface. This might be due to a temporary data issue."
      >
        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email Verified</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user: AdminUser) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.name || '—'}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role || 'user'}
                      onValueChange={(role: 'user' | 'admin') => handleRoleChange(user.id, role)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            User
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Admin
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
                      {user.emailVerified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setShowUserDataDialog(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ErrorBoundaryWrapper>

      {/* Delete User Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the user and all associated
              data including accounts, sleeves, models, and transactions.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-4">
              Type <strong>DELETE_USER_DATA</strong> to confirm:
            </p>
            <Input
              value={deleteConfirmation}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDeleteConfirmation(e.target.value)
              }
              placeholder="DELETE_USER_DATA"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteConfirmation !== 'DELETE_USER_DATA' || deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Data Dialog */}
      <Dialog open={showUserDataDialog} onOpenChange={setShowUserDataDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Data</DialogTitle>
            <DialogDescription>Complete data overview for the selected user</DialogDescription>
          </DialogHeader>
          {userDataPending ? (
            <div>Loading user data...</div>
          ) : userData ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">User Info</h3>
                <div className="bg-gray-50 p-4 rounded">
                  <p>
                    <strong>Email:</strong> {userData.user.email}
                  </p>
                  <p>
                    <strong>Name:</strong> {userData.user.name || '—'}
                  </p>
                  <p>
                    <strong>Role:</strong> {userData.user.role}
                  </p>
                  <p>
                    <strong>Created:</strong> {new Date(userData.user.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Accounts ({userData.accounts.length})
                </h3>
                <div className="space-y-2">
                  {userData.accounts.map((account: Account) => (
                    <div key={account.id} className="bg-gray-50 p-3 rounded">
                      <p>
                        <strong>Name:</strong> {account.name}
                      </p>
                      <p>
                        <strong>Type:</strong> {account.type}
                      </p>
                      <p>
                        <strong>Data Source:</strong> {account.dataSource}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Models ({userData.models.length} with {userData.sleeves.length} sleeves)
                </h3>
                <div className="space-y-2">
                  {userData.models.map((model: Model) => (
                    <div key={model.id} className="bg-gray-50 p-3 rounded">
                      <p>
                        <strong>Name:</strong> {model.name}
                      </p>
                      <p>
                        <strong>Active:</strong> {model.isActive ? 'Yes' : 'No'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Rebalancing Groups ({userData.rebalancingGroups.length})
                </h3>
                <div className="space-y-2">
                  {userData.rebalancingGroups.map((group: RebalancingGroup) => (
                    <div key={group.id} className="bg-gray-50 p-3 rounded">
                      <p>
                        <strong>Name:</strong> {group.name}
                      </p>
                      <p>
                        <strong>Active:</strong> {group.isActive ? 'Yes' : 'No'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setShowUserDataDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
