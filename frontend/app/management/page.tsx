'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import { complaintsApi, usersApi } from '@/lib/api';
import { downloadCSV, printHTML } from '@/lib/print-download';
import logo from '../../Logo.png';

type Complaint = {
  id: number;
  ticket_number: string;
  title: string;
  category: string;
  status: string;
  submitter_name?: string;
  created_at: string;
};

type User = { id: number; full_name: string; email: string; role: string };

const WORKFLOW_STATUSES = [
  'pending', 'assigned_to_auditor', 'audited', 'assigned_to_maintenance',
  'maintenance_in_progress', 'pending_approval', 'approved',
  'repair_completed', 'final_audit', 'resolved', 'rejected'
];

export default function ManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [auditors, setAuditors] = useState<User[]>([]);
  const [maintenanceOfficers, setMaintenanceOfficers] = useState<User[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [assignMap, setAssignMap] = useState<Record<number, number>>({});
  const [assignType, setAssignType] = useState<Record<number, string>>({});

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

    const load = async () => {
      try {
        const [complaintsRes, auditorsRes, maintenanceRes] = await Promise.all([
          complaintsApi.list({ status: statusFilter || undefined, limit: 100 }),
          usersApi.list({ role: 'auditor', limit: 100 }),
          usersApi.list({ role: 'maintenance_officer', limit: 100 }),
        ]);
        setComplaints(complaintsRes.data);
        setAuditors(Array.isArray(auditorsRes.data) ? auditorsRes.data : []);
        setMaintenanceOfficers(Array.isArray(maintenanceRes.data) ? maintenanceRes.data : []);
      } catch {
        setComplaints([]);
        setAuditors([]);
        setMaintenanceOfficers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, authLoading, router, statusFilter]);

  const handleAssign = async (id: number, type: 'auditor' | 'maintenance') => {
    const assignedTo = assignMap[id];
    if (!assignedTo) return;
    setUpdating(id);
    try {
      await complaintsApi.update(id, { assigned_to_id: assignedTo });
      const status = type === 'auditor' ? 'assigned_to_auditor' : 'assigned_to_maintenance';
      await complaintsApi.update(id, { status: status as never });
      const { data } = await complaintsApi.list({ status: statusFilter || undefined, limit: 100 });
      setComplaints(data);
      setAssignMap((m) => ({ ...m, [id]: 0 }));
      setAssignType((t) => ({ ...t, [id]: '' }));
    } finally {
      setUpdating(null);
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    setUpdating(id);
    try {
      await complaintsApi.update(id, { status: status as never });
      const { data } = await complaintsApi.list({ status: statusFilter || undefined, limit: 100 });
      setComplaints(data);
    } finally {
      setUpdating(null);
    }
  };

  const statusColor = (s: string) => {
    if (s === 'resolved') return 'bg-green-100 text-green-800';
    if (s === 'rejected') return 'bg-red-100 text-red-800';
    if (s.includes('audit') || s === 'audited') return 'bg-blue-100 text-blue-800';
    if (s.includes('maintenance') || s.includes('approval') || s === 'approved') return 'bg-purple-100 text-purple-800';
    return 'bg-amber-100 text-amber-800';
  };

  const printComplaints = () => {
    const logoUrl = typeof window !== 'undefined' ? window.location.origin + logo.src : logo.src;
    const rows = complaints.map((c) => [
      c.ticket_number,
      c.title,
      c.category,
      c.submitter_name ?? '',
      c.status.replace(/_/g, ' '),
      new Date(c.created_at).toLocaleString(),
    ]);
    const html = `
      <div class="header">
        <img src="${logoUrl}" alt="MAAUN Logo" class="logo" />
        <h1 class="portal-title">MAAUN Complaints and Feedback Portal</h1>
        <p class="portal-subtitle">Maryam Abacha American University Nigeria</p>
      </div>
      <hr/>
      <h2>Complaints Report</h2>
      <p class="meta">Generated ${new Date().toLocaleString()} &bull; ${complaints.length} complaint${complaints.length !== 1 ? 's' : ''}</p>
      <table><thead><tr><th>Ticket</th><th>Title</th><th>Category</th><th>Submitter</th><th>Status</th><th>Created</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${String(c).replace(/</g, '&lt;')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    printHTML('Complaints Report', html);
  };

  const downloadComplaints = () => {
    const rows = [
      ['MAAUN Complaints and Feedback Portal'],
      [''],
      ['Ticket', 'Title', 'Category', 'Submitter', 'Status', 'Created'],
      ...complaints.map((c) => [
        c.ticket_number,
        c.title,
        c.category,
        c.submitter_name ?? '',
        c.status.replace(/_/g, ' '),
        new Date(c.created_at).toLocaleString(),
      ]),
    ];
    downloadCSV(`complaints-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (authLoading) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2">Manage Complaints</h1>
        <p className="text-stone-600 mb-6">Oversee complaints, assign to auditor for verification or to maintenance for repair.</p>

        <div className="flex flex-wrap gap-2 mb-6 items-center">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-auto">
            <option value="">All statuses</option>
            {WORKFLOW_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <button onClick={printComplaints} disabled={complaints.length === 0} className="btn-secondary text-sm py-2">
            Print
          </button>
          <button onClick={downloadComplaints} disabled={complaints.length === 0} className="btn-secondary text-sm py-2">
            Download CSV
          </button>
        </div>

        <div className="card overflow-x-auto">
          {loading ? (
            <p className="text-stone-500 py-8 text-center">Loading...</p>
          ) : complaints.length === 0 ? (
            <p className="text-stone-500 py-8 text-center">No complaints found.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 text-left">
                  <th className="py-3 px-2">Ticket</th>
                  <th className="py-3 px-2">Title</th>
                  <th className="py-3 px-2">Category</th>
                  <th className="py-3 px-2">Submitter</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2">Assign</th>
                  <th className="py-3 px-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="py-3 px-2">
                      <Link href={`/complaints/${c.id}`} className="text-[#1e3a5f] hover:underline font-mono text-sm">
                        {c.ticket_number}
                      </Link>
                    </td>
                    <td className="py-3 px-2 max-w-[180px] truncate">{c.title}</td>
                    <td className="py-3 px-2 text-sm">{c.category}</td>
                    <td className="py-3 px-2 text-sm">{c.submitter_name}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor(c.status)}`}>
                        {c.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {c.status === 'pending' && (
                        <>
                          <select
                            value={assignType[c.id] || ''}
                            onChange={(e) => setAssignType((t) => ({ ...t, [c.id]: e.target.value }))}
                            className="input-field py-1 text-xs w-28 mb-1"
                          >
                            <option value="">Assign to...</option>
                            <option value="auditor">Auditor</option>
                            <option value="maintenance">Maintenance</option>
                          </select>
                          {assignType[c.id] === 'auditor' && (
                            <div className="flex gap-1">
                              <select
                                value={assignMap[c.id] || ''}
                                onChange={(e) => setAssignMap((m) => ({ ...m, [c.id]: Number(e.target.value) }))}
                                className="input-field py-1 text-xs w-32"
                              >
                                <option value="">Select auditor</option>
                                {auditors.map((a) => (
                                  <option key={a.id} value={a.id}>{a.full_name} ({a.email})</option>
                                ))}
                                {auditors.length === 0 && (
                                  <option value="" disabled>No auditors found</option>
                                )}
                              </select>
                              <button
                                onClick={() => handleAssign(c.id, 'auditor')}
                                disabled={!assignMap[c.id] || updating === c.id}
                                className="btn-primary py-1 px-2 text-xs"
                              >Assign</button>
                            </div>
                          )}
                          {assignType[c.id] === 'maintenance' && (
                            <div className="flex gap-1">
                              <select
                                value={assignMap[c.id] || ''}
                                onChange={(e) => setAssignMap((m) => ({ ...m, [c.id]: Number(e.target.value) }))}
                                className="input-field py-1 text-xs w-32"
                              >
                                <option value="">Select officer</option>
                                {maintenanceOfficers.map((m) => (
                                  <option key={m.id} value={m.id}>{m.full_name} ({m.email})</option>
                                ))}
                                {maintenanceOfficers.length === 0 && (
                                  <option value="" disabled>No maintenance officers found</option>
                                )}
                              </select>
                              <button
                                onClick={() => handleAssign(c.id, 'maintenance')}
                                disabled={!assignMap[c.id] || updating === c.id}
                                className="btn-primary py-1 px-2 text-xs"
                              >Assign</button>
                            </div>
                          )}
                        </>
                      )}
                      {c.status === 'audited' && (
                        <div className="flex gap-1">
                          <select
                            value={assignMap[c.id] || ''}
                            onChange={(e) => setAssignMap((m) => ({ ...m, [c.id]: Number(e.target.value) }))}
                            className="input-field py-1 text-xs w-32"
                          >
                            <option value="">Select maintenance</option>
                            {maintenanceOfficers.map((m) => (
                              <option key={m.id} value={m.id}>{m.full_name} ({m.email})</option>
                            ))}
                            {maintenanceOfficers.length === 0 && (
                              <option value="" disabled>No maintenance officers found</option>
                            )}
                          </select>
                          <button
                            onClick={() => handleAssign(c.id, 'maintenance')}
                            disabled={!assignMap[c.id] || updating === c.id}
                            className="btn-primary py-1 px-2 text-xs"
                          >Assign</button>
                        </div>
                      )}
                      {c.status === 'pending_approval' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleStatusChange(c.id, 'approved')}
                            disabled={updating === c.id}
                            className="btn-primary py-1 px-2 text-xs"
                          >Approve</button>
                          <button
                            onClick={() => handleStatusChange(c.id, 'rejected')}
                            disabled={updating === c.id}
                            className="btn-secondary py-1 px-2 text-xs"
                          >Reject</button>
                        </div>
                      )}
                      {c.status === 'repair_completed' && (
                        <div className="flex gap-1">
                          <select
                            value={assignMap[c.id] || ''}
                            onChange={(e) => setAssignMap((m) => ({ ...m, [c.id]: Number(e.target.value) }))}
                            className="input-field py-1 text-xs w-32"
                          >
                            <option value="">Select auditor</option>
                            {auditors.map((a) => (
                              <option key={a.id} value={a.id}>{a.full_name} ({a.email})</option>
                            ))}
                            {auditors.length === 0 && (
                              <option value="" disabled>No auditors found</option>
                            )}
                          </select>
                          <button
                            onClick={async () => {
                              const aid = assignMap[c.id];
                              if (!aid || updating) return;
                              setUpdating(c.id);
                              try {
                                await complaintsApi.update(c.id, { assigned_to_id: aid });
                                await complaintsApi.update(c.id, { status: 'final_audit' });
                                const { data } = await complaintsApi.list({ status: statusFilter || undefined, limit: 100 });
                                setComplaints(data);
                                setAssignMap((m) => ({ ...m, [c.id]: 0 }));
                              } finally {
                                setUpdating(null);
                              }
                            }}
                            disabled={!assignMap[c.id] || updating === c.id}
                            className="btn-primary py-1 px-2 text-xs"
                          >Assign for verification</button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <Link href={`/complaints/${c.id}`} className="text-[#1e3a5f] hover:underline text-sm">View</Link>
                      {!['resolved', 'rejected'].includes(c.status) && (
                        <select
                          value=""
                          onChange={(e) => { const v = e.target.value; if (v) handleStatusChange(c.id, v); }}
                          className="input-field py-1 text-xs w-32 ml-2"
                        >
                          <option value="">Update status</option>
                          {WORKFLOW_STATUSES.filter((s) => !['resolved', 'rejected'].includes(s)).map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
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
