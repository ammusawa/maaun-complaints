'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import { complaintsApi } from '@/lib/api';

type Complaint = {
  id: number;
  ticket_number: string;
  title: string;
  category: string;
  status: string;
  submitter_name?: string;
  created_at: string;
};

export default function MaintenancePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;
    if (user.role !== 'maintenance_officer' && user.role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    const load = async () => {
      try {
        const { data } = await complaintsApi.list({ limit: 100 });
        setComplaints(data);
      } catch {
        setComplaints([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, authLoading, router]);

  const statusColor = (s: string) => {
    if (s === 'resolved') return 'bg-green-100 text-green-800';
    if (s === 'rejected') return 'bg-red-100 text-red-800';
    if (s.includes('maintenance') || s.includes('approval')) return 'bg-purple-100 text-purple-800';
    return 'bg-amber-100 text-amber-800';
  };

  const needsAction = (c: Complaint) =>
    ['assigned_to_maintenance', 'maintenance_in_progress', 'approved'].includes(c.status);

  if (authLoading) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2">{user?.role === 'admin' ? 'All Assignments (Oversight)' : 'My Assignments'}</h1>
        <p className="text-stone-600 mb-6">
          {user?.role === 'admin' ? 'View all complaints in the maintenance workflow. Full oversight as admin.' : 'Complaints assigned for repair. Submit report, draft invoice if needed, and mark repair completed.'}
        </p>

        <div className="card">
          {loading ? (
            <p className="text-stone-500 py-8 text-center">Loading...</p>
          ) : complaints.length === 0 ? (
            <p className="text-stone-500 py-8 text-center">{user?.role === 'admin' ? 'No complaints in the maintenance workflow yet.' : 'No complaints assigned to you yet.'}</p>
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
                        {c.ticket_number} • {c.category} • {c.submitter_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {needsAction(c) && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-200 text-purple-800">
                          Action required
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor(c.status)}`}>
                        {c.status.replace(/_/g, ' ')}
                      </span>
                    </div>
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
