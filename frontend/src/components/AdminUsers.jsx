import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import api from '../lib/api';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/api/admin/users');
      setUsers(data);
    } catch {
      setError('Failed to fetch users');
    }
  };

  const handleRoleChange = async (userId, roleId) => {
    try {
      setError('');
      await api.put(`/api/admin/users/${userId}/role`, { role_id: parseInt(roleId, 10) });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user role');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="space-y-4">
      {error && <div className="p-2 text-xs rounded border bg-destructive/10 text-destructive border-destructive/20">{error}</div>}
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[80px]">User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Assigned Role</TableHead>
              <TableHead className="text-right">Joined On</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-xs py-8 text-muted-foreground">No users found.</TableCell></TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={u.avatar_url} />
                        <AvatarFallback className="text-[9px]">{u.name?.slice(0, 2).toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold">{u.name || 'Anonymous'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <select
                      value={u.role_id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="1">Admin</option>
                      <option value="2">Recruiter</option>
                      <option value="3">Student</option>
                    </select>
                  </TableCell>
                  <TableCell className="text-right text-[10px] text-muted-foreground font-mono">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
