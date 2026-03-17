'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import { complaintsApi, STATUSES } from '@/lib/api';
import { FileText, Plus, TrendingUp, CheckCircle, Clock } from 'lucide-react';

type Stats = Record<string, number>;
type Complaint = { id: number; ticket_number: string; title: string; category: string; status: string; created_at: string };

export default function DashboardPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;
    if (!token && typeof window !== 'undefined' && !localStorage.getItem('token')) return;

    const load = async () => {
      try {
        const isWorkflowRole = ['management', 'admin', 'auditor', 'maintenance_officer'].includes(user.role);
        const [complaintsRes, statsRes] = await Promise.all([
          complaintsApi.list({ limit: 5 }),
          isWorkflowRole ? complaintsApi.stats() : Promise.resolve({ data: null }),
        ]);
        setRecent(complaintsRes.data);
        if (statsRes?.data) setStats(statsRes.data);
      } catch {
        setRecent([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, token, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-stone-500">Loading...</div>
      </div>
    );
  }
  if (!user) return null;

  const statusColor = (s: string) => {
    if (s === 'resolved') return 'bg-green-100 text-green-800';
    if (s === 'in_progress') return 'bg-blue-100 text-blue-800';
    if (s === 'rejected') return 'bg-red-100 text-red-800';
    return 'bg-amber-100 text-amber-800';
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2">
          Welcome, {user.full_name}
        </h1>
        <p className="text-stone-600 mb-8">
          {['student', 'staff'].includes(user.role)
            ? 'Track your complaints and submit new feedback.'
            : user.role === 'management' || user.role === 'admin'
            ? 'Oversee complaints, assign to auditor and maintenance.'
            : user.role === 'auditor'
            ? 'Verify complaints and send feedback to management.'
            : user.role === 'maintenance_officer'
            ? 'Handle repair assignments and submit reports.'
            : 'Manage and respond to complaints and feedback.'}
        </p>

        {['management', 'admin', 'auditor', 'maintenance_officer'].includes(user.role) && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="card flex items-center gap-4">
              <div className="p-2 bg-[#1e3a5f]/10 rounded-lg">
                <TrendingUp className="text-[#1e3a5f]" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-stone-600">Total</p>
              </div>
            </div>
            <div className="card flex items-center gap-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="text-amber-700" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-stone-600">Pending</p>
              </div>
            </div>
            <div className="card flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="text-blue-700" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending_approval ?? 0}</p>
                <p className="text-sm text-stone-600">Pending Approval</p>
              </div>
            </div>
            <div className="card flex items-center gap-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="text-green-700" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.resolved}</p>
                <p className="text-sm text-stone-600">Resolved</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {['student', 'staff'].includes(user.role) ? 'My Complaints' : 'Recent Complaints'}
          </h2>
          {['student', 'staff'].includes(user.role) && (
            <Link href="/complaints/new" className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Submit Complaint
            </Link>
          )}
        </div>

        <div className="card">
          {loading ? (
            <p className="text-stone-500 py-8 text-center">Loading...</p>
          ) : recent.length === 0 ? (
            <p className="text-stone-500 py-8 text-center">No complaints yet. Submit your first one!</p>
          ) : (
            <div className="divide-y">
              {recent.map((c) => (
                <Link
                  key={c.id}
                  href={`/complaints/${c.id}`}
                  className="block py-4 hover:bg-stone-50 -mx-6 px-6 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{c.title}</p>
                      <p className="text-sm text-stone-500">
                        {c.ticket_number} • {c.category}
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
