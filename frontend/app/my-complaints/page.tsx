'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import { complaintsApi } from '@/lib/api';
import { downloadCSV, printHTML } from '@/lib/print-download';
import logo from '../../Logo.png';

type Complaint = {
  id: number;
  ticket_number: string;
  title: string;
  category: string;
  feedback_type: string;
  status: string;
  priority: number;
  submitter_name?: string;
  created_at: string;
};

export default function MyComplaintsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;

    const load = async () => {
      try {
        const { data } = await complaintsApi.list({
          status: statusFilter || undefined,
          limit: 50,
        });
        setComplaints(data);
      } catch {
        setComplaints([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, authLoading, router, statusFilter]);

  const statusColor = (s: string) => {
    if (s === 'resolved') return 'bg-green-100 text-green-800';
    if (s === 'in_progress') return 'bg-blue-100 text-blue-800';
    if (s === 'rejected') return 'bg-red-100 text-red-800';
    return 'bg-amber-100 text-amber-800';
  };

  if (authLoading) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2">My Complaints</h1>
        <p className="text-stone-600 mb-6">View and track all your submitted complaints and feedback.</p>

        <div className="flex flex-wrap gap-2 mb-6 items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={() => {
              const logoUrl = typeof window !== 'undefined' ? window.location.origin + logo.src : logo.src;
              const rows = complaints.map((c) => [c.ticket_number, c.title, c.submitter_name ?? '', c.category, c.feedback_type, c.status.replace(/_/g, ' '), new Date(c.created_at).toLocaleString()]);
              const html = `
                <div class="header">
                  <img src="${logoUrl}" alt="MAAUN Logo" class="logo" />
                  <h1 class="portal-title">MAAUN Complaints and Feedback Portal</h1>
                  <p class="portal-subtitle">Maryam Abacha American University Nigeria</p>
                </div>
                <hr/>
                <h2>My Complaints (${(user?.full_name ?? '').replace(/</g, '&lt;')}${user?.matric_number ? ` - ${user.matric_number.replace(/</g, '&lt;')}` : ''})</h2>
                <p class="meta">${complaints.length} complaint${complaints.length !== 1 ? 's' : ''}</p>
                <table><thead><tr><th>Ticket</th><th>Title</th><th>Submitter</th><th>Category</th><th>Type</th><th>Status</th><th>Created</th></tr></thead>
                <tbody>${rows.map((r) => `<tr>${r.map((cell) => `<td>${String(cell).replace(/</g, '&lt;')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
              printHTML(`My Complaints (${user?.full_name ?? ''}${user?.matric_number ? ` - ${user.matric_number}` : ''})`, html);
            }}
            disabled={complaints.length === 0}
            className="btn-secondary text-sm py-2"
          >
            Print
          </button>
          <button
            onClick={() => {
              const rows = [
                ['MAAUN Complaints and Feedback Portal'],
                [''],
                ['Ticket', 'Title', 'Submitter', 'Category', 'Type', 'Status', 'Created'],
                ...complaints.map((c) => [c.ticket_number, c.title, c.submitter_name ?? '', c.category, c.feedback_type, c.status.replace(/_/g, ' '), new Date(c.created_at).toLocaleString()]),
              ];
              downloadCSV(`my-complaints-${new Date().toISOString().slice(0, 10)}.csv`, rows);
            }}
            disabled={complaints.length === 0}
            className="btn-secondary text-sm py-2"
          >
            Download CSV
          </button>
        </div>

        <div className="card">
          {loading ? (
            <p className="text-stone-500 py-8 text-center">Loading...</p>
          ) : complaints.length === 0 ? (
            <p className="text-stone-500 py-8 text-center">No complaints found.</p>
          ) : (
            <div className="divide-y">
              {complaints.map((c) => (
                <Link
                  key={c.id}
                  href={`/complaints/${c.id}`}
                  className="block py-4 hover:bg-stone-50 -mx-6 px-6 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{c.title}</p>
                      <p className="text-sm text-stone-500">
                        {c.ticket_number} • {c.submitter_name && <>{c.submitter_name} • </>}{c.category} • {c.feedback_type}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor(c.status)}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
