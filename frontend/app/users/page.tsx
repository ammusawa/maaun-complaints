'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import { usersApi } from '@/lib/api';
import { downloadCSV, printHTML } from '@/lib/print-download';
import logo from '../../Logo.png';

type User = { id: number; full_name: string; email: string; role: string; department?: string; is_active?: number };

const ROLES = ['student', 'staff', 'admin', 'management', 'auditor', 'maintenance_officer'] as const;

export default function UsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState<string>('');
  const [addUserForm, setAddUserForm] = useState({ email: '', password: '', full_name: '', matric_number: '', department: '', role: 'student' });
  const [addingUser, setAddingUser] = useState(false);
  const [userUpdating, setUserUpdating] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const { data } = await usersApi.list({
        role: userRoleFilter || undefined,
        include_inactive: showInactive,
        limit: 200,
      });
      setAllUsers(Array.isArray(data) ? data : []);
    } catch {
      setAllUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [userRoleFilter, showInactive]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;
    if (!['management', 'admin'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }
    loadUsers();
  }, [user, authLoading, router, loadUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUserForm.email || !addUserForm.password || !addUserForm.full_name) return;
    setAddingUser(true);
    try {
      await usersApi.create({
        email: addUserForm.email,
        password: addUserForm.password,
        full_name: addUserForm.full_name,
        matric_number: addUserForm.matric_number || undefined,
        department: addUserForm.department || undefined,
        role: addUserForm.role,
      });
      setAddUserForm({ email: '', password: '', full_name: '', matric_number: '', department: '', role: 'student' });
      loadUsers();
    } finally {
      setAddingUser(false);
    }
  };

  const isAdminUser = (u: User) => String(u?.role ?? '').toLowerCase() === 'admin';
  const canModifyUser = (target: User) => {
    if (isAdminUser(target)) return user ? isAdminUser(user) : false;
    return true;
  };

  const handleRevokeUser = async (id: number) => {
    const target = allUsers.find((u) => u.id === id);
    if (target && !canModifyUser(target)) return;
    setUserUpdating(id);
    try {
      await usersApi.update(id, { is_active: false });
      loadUsers();
    } finally {
      setUserUpdating(null);
    }
  };

  const handleActivateUser = async (id: number) => {
    const target = allUsers.find((u) => u.id === id);
    if (target && !canModifyUser(target)) return;
    setUserUpdating(id);
    try {
      await usersApi.update(id, { is_active: true });
      loadUsers();
    } finally {
      setUserUpdating(null);
    }
  };

  const printUsers = () => {
    const logoUrl = typeof window !== 'undefined' ? window.location.origin + logo.src : logo.src;
    const rows = allUsers.map((u) => [
      u.full_name,
      u.email,
      u.role?.replace(/_/g, ' ') ?? '',
      u.department ?? '',
      u.is_active ? 'Active' : 'Revoked',
    ]);
    const html = `
      <div class="header">
        <img src="${logoUrl}" alt="MAAUN Logo" class="logo" />
        <h1 class="portal-title">MAAUN Complaints and Feedback Portal</h1>
        <p class="portal-subtitle">Maryam Abacha American University Nigeria</p>
      </div>
      <hr/>
      <h2>Users Report</h2>
      <p class="meta">Generated ${new Date().toLocaleString()} &bull; ${allUsers.length} user${allUsers.length !== 1 ? 's' : ''}</p>
      <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${String(c).replace(/</g, '&lt;')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    printHTML('Users Report', html);
  };

  const downloadUsers = () => {
    const rows = [
      ['MAAUN Complaints and Feedback Portal'],
      [''],
      ['Name', 'Email', 'Role', 'Department', 'Status'],
      ...allUsers.map((u) => [
        u.full_name,
        u.email,
        u.role?.replace(/_/g, ' ') ?? '',
        u.department ?? '',
        u.is_active ? 'Active' : 'Revoked',
      ]),
    ];
    downloadCSV(`users-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (authLoading) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2">User Management</h1>
        <p className="text-stone-600 mb-6">Add, view, and manage users. Revoke or activate accounts.</p>

        <div className="card p-4 mb-6">
          <h3 className="font-semibold text-stone-700 mb-3">Add User</h3>
          <form onSubmit={handleAddUser} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="email"
              placeholder="Email *"
              value={addUserForm.email}
              onChange={(e) => setAddUserForm((f) => ({ ...f, email: e.target.value }))}
              className="input-field"
              required
            />
            <input
              type="password"
              placeholder="Password *"
              value={addUserForm.password}
              onChange={(e) => setAddUserForm((f) => ({ ...f, password: e.target.value }))}
              className="input-field"
              required
            />
            <input
              type="text"
              placeholder="Full Name *"
              value={addUserForm.full_name}
              onChange={(e) => setAddUserForm((f) => ({ ...f, full_name: e.target.value }))}
              className="input-field"
              required
            />
            <input
              type="text"
              placeholder="Matric Number"
              value={addUserForm.matric_number}
              onChange={(e) => setAddUserForm((f) => ({ ...f, matric_number: e.target.value }))}
              className="input-field"
            />
            <input
              type="text"
              placeholder="Department"
              value={addUserForm.department}
              onChange={(e) => setAddUserForm((f) => ({ ...f, department: e.target.value }))}
              className="input-field"
            />
            <select
              value={addUserForm.role}
              onChange={(e) => setAddUserForm((f) => ({ ...f, role: e.target.value }))}
              className="input-field"
            >
              {(user?.role === 'admin' ? ROLES : ROLES.filter((r) => r !== 'admin')).map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <button type="submit" disabled={addingUser} className="btn-primary col-span-2">
              {addingUser ? 'Adding...' : 'Add User'}
            </button>
          </form>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <select value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)} className="input-field w-44">
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            <span className="text-sm">Show inactive</span>
          </label>
          <button onClick={printUsers} disabled={allUsers.length === 0} className="btn-secondary text-sm py-2">
            Print
          </button>
          <button onClick={downloadUsers} disabled={allUsers.length === 0} className="btn-secondary text-sm py-2">
            Download CSV
          </button>
        </div>

        <div className="card overflow-x-auto">
          {usersLoading ? (
            <p className="text-stone-500 py-8 text-center">Loading users...</p>
          ) : allUsers.length === 0 ? (
            <p className="text-stone-500 py-8 text-center">No users found.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 text-left">
                  <th className="py-3 px-2">Name</th>
                  <th className="py-3 px-2">Email</th>
                  <th className="py-3 px-2">Role</th>
                  <th className="py-3 px-2">Department</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => (
                  <tr key={u.id} className={`border-b border-stone-100 hover:bg-stone-50 ${u.is_active === 0 ? 'opacity-60' : ''}`}>
                    <td className="py-3 px-2">{u.full_name}</td>
                    <td className="py-3 px-2 text-sm">{u.email}</td>
                    <td className="py-3 px-2 text-sm">{u.role?.replace(/_/g, ' ')}</td>
                    <td className="py-3 px-2 text-sm">{u.department || '—'}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {u.is_active ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {!canModifyUser(u) ? (
                        <span className="text-stone-400 text-sm">Admin only</span>
                      ) : u.is_active ? (
                        <button
                          onClick={() => handleRevokeUser(u.id)}
                          disabled={userUpdating === u.id || u.id === user?.id}
                          className="text-red-600 hover:underline text-sm disabled:opacity-50"
                        >
                          {userUpdating === u.id ? '...' : 'Revoke'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivateUser(u.id)}
                          disabled={userUpdating === u.id}
                          className="text-green-600 hover:underline text-sm disabled:opacity-50"
                        >
                          {userUpdating === u.id ? '...' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
