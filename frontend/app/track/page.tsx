'use client';

import { useState } from 'react';
import Link from 'next/link';
import { complaintsApi } from '@/lib/api';
import PublicNavbar from '@/components/PublicNavbar';

export default function TrackPage() {
  const [ticketNumber, setTicketNumber] = useState('');
  const [result, setResult] = useState<{
    ticket_number: string;
    title: string;
    status: string;
    category: string;
    created_at: string;
    resolved_at: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketNumber.trim()) return;
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const { data } = await complaintsApi.track(ticketNumber.trim());
      setResult(data);
    } catch (err: unknown) {
      const res = err as { response?: { data?: { detail?: string } } };
      setError(res?.response?.data?.detail || 'Complaint not found');
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (s: string) => {
    if (s === 'resolved') return 'bg-green-100 text-green-800';
    if (s === 'rejected') return 'bg-red-100 text-red-800';
    return 'bg-amber-100 text-amber-800';
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <PublicNavbar />

      <main className="max-w-xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2">Track Complaint Status</h1>
        <p className="text-stone-600 mb-8">
          Enter your complaint ticket number (e.g. MAAUN-20250209-1234) to check its status. No login required.
        </p>

        <form onSubmit={handleTrack} className="card space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Ticket Number</label>
            <input
              type="text"
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              className="input-field font-mono"
              placeholder="MAAUN-20250209-1234"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? 'Checking...' : 'Track Status'}
          </button>
        </form>

        {result && (
          <div className="card mt-6">
            <h3 className="font-semibold text-stone-800 mb-3">Complaint Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-stone-500">Ticket</dt>
                <dd className="font-mono font-medium">{result.ticket_number}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Title</dt>
                <dd className="font-medium">{result.title}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Category</dt>
                <dd>{result.category}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-stone-500">Status</dt>
                <dd>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor(result.status)}`}>
                    {result.status.replace(/_/g, ' ')}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Submitted</dt>
                <dd>{result.created_at ? new Date(result.created_at).toLocaleString() : '—'}</dd>
              </div>
              {result.resolved_at && (
                <div className="flex justify-between">
                  <dt className="text-stone-500">Resolved</dt>
                  <dd>{new Date(result.resolved_at).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <p className="mt-8 text-center text-stone-500 text-sm">
          <Link href="/" className="text-[#1e3a5f] hover:underline">← Back to Home</Link>
        </p>
      </main>
    </div>
  );
}
