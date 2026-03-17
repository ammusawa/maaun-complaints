'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import { complaintsApi, CATEGORIES, FEEDBACK_TYPES } from '@/lib/api';
import { downloadCSV, printHTML } from '@/lib/print-download';
import logo from '../../Logo.png';

type AnalyticsData = {
  total: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_feedback_type: Record<string, number>;
  by_department: Record<string, number>;
  top_submitters: { user_id: number; full_name: string; count: number }[];
  departments: string[];
  submitters: { id: number; full_name: string }[];
};

const WORKFLOW_STATUSES = [
  'pending', 'assigned_to_auditor', 'audited', 'assigned_to_maintenance',
  'maintenance_in_progress', 'pending_approval', 'approved',
  'repair_completed', 'final_audit', 'resolved', 'rejected'
];

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsFilters, setAnalyticsFilters] = useState({
    submitter_id: '',
    category: '',
    feedback_type: '',
    department: '',
    status: '',
  });

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const { data } = await complaintsApi.analytics({
        submitter_id: analyticsFilters.submitter_id ? Number(analyticsFilters.submitter_id) : undefined,
        category: analyticsFilters.category || undefined,
        feedback_type: analyticsFilters.feedback_type || undefined,
        department: analyticsFilters.department || undefined,
        status: analyticsFilters.status || undefined,
      });
      setAnalytics(data);
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsFilters]);

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
    loadAnalytics();
  }, [user, authLoading, router, loadAnalytics]);

  const printAnalytics = () => {
    if (!analytics) return;
    const logoUrl = typeof window !== 'undefined' ? window.location.origin + logo.src : logo.src;
    const byStatus = Object.entries(analytics.by_status).map(([k, v]) => `<tr><td>${k.replace(/_/g, ' ')}</td><td>${v}</td></tr>`).join('');
    const byCat = Object.entries(analytics.by_category).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
    const topSub = analytics.top_submitters.map((s) => `<tr><td>${s.full_name}</td><td>${s.count}</td></tr>`).join('');
    const html = `
      <div class="header">
        <img src="${logoUrl}" alt="MAAUN Logo" class="logo" />
        <h1 class="portal-title">MAAUN Complaints and Feedback Portal</h1>
        <p class="portal-subtitle">Maryam Abacha American University Nigeria</p>
      </div>
      <hr/>
      <h2>Analytics Report</h2>
      <p class="meta">Generated ${new Date().toLocaleString()} &bull; Total: ${analytics.total} complaints</p>
      <div class="section"><h2>By Status</h2><table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>${byStatus || '<tr><td colspan="2">No data</td></tr>'}</tbody></table></div>
      <div class="section"><h2>By Category</h2><table><thead><tr><th>Category</th><th>Count</th></tr></thead><tbody>${byCat || '<tr><td colspan="2">No data</td></tr>'}</tbody></table></div>
      <div class="section"><h2>Top Submitters</h2><table><thead><tr><th>Name</th><th>Count</th></tr></thead><tbody>${topSub || '<tr><td colspan="2">No data</td></tr>'}</tbody></table></div>`;
    printHTML('Analytics Report', html);
  };

  const downloadAnalytics = () => {
    if (!analytics) return;
    const rows = [
      ['MAAUN Complaints and Feedback Portal', ''],
      [''],
      ['Analytics Report', ''],
      ['Generated', new Date().toLocaleString()],
      ['Total Complaints', String(analytics.total)],
      [],
      ['By Status', 'Count'],
      ...Object.entries(analytics.by_status).map(([k, v]) => [k.replace(/_/g, ' '), String(v)]),
      [],
      ['By Category', 'Count'],
      ...Object.entries(analytics.by_category).map(([k, v]) => [k, String(v)]),
      [],
      ['Top Submitters', 'Count'],
      ...analytics.top_submitters.map((s) => [s.full_name, String(s.count)]),
    ];
    downloadCSV(`analytics-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (authLoading) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2">Analytics</h1>
        <p className="text-stone-600 mb-6">Filter and analyze complaints by submitter, category, type, department, and status.</p>

        <div className="flex flex-wrap gap-2 p-4 bg-stone-100 rounded-lg mb-6">
          <select
            value={analyticsFilters.submitter_id}
            onChange={(e) => setAnalyticsFilters((f) => ({ ...f, submitter_id: e.target.value }))}
            className="input-field w-48"
          >
            <option value="">All submitters</option>
            {analytics?.submitters?.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            )) ?? []}
          </select>
          <select
            value={analyticsFilters.category}
            onChange={(e) => setAnalyticsFilters((f) => ({ ...f, category: e.target.value }))}
            className="input-field w-36"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={analyticsFilters.feedback_type}
            onChange={(e) => setAnalyticsFilters((f) => ({ ...f, feedback_type: e.target.value }))}
            className="input-field w-36"
          >
            <option value="">All types</option>
            {FEEDBACK_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={analyticsFilters.department}
            onChange={(e) => setAnalyticsFilters((f) => ({ ...f, department: e.target.value }))}
            className="input-field w-40"
          >
            <option value="">All departments</option>
            {analytics?.departments?.map((d) => (
              <option key={d} value={d}>{d}</option>
            )) ?? []}
          </select>
          <select
            value={analyticsFilters.status}
            onChange={(e) => setAnalyticsFilters((f) => ({ ...f, status: e.target.value }))}
            className="input-field w-44"
          >
            <option value="">All statuses</option>
            {WORKFLOW_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <button onClick={loadAnalytics} disabled={analyticsLoading} className="btn-primary">
            {analyticsLoading ? 'Loading...' : 'Apply'}
          </button>
          <button onClick={printAnalytics} disabled={!analytics || analyticsLoading} className="btn-secondary">
            Print
          </button>
          <button onClick={downloadAnalytics} disabled={!analytics || analyticsLoading} className="btn-secondary">
            Download CSV
          </button>
        </div>

        {analyticsLoading ? (
          <p className="text-stone-500 py-8 text-center">Loading analytics...</p>
        ) : analytics ? (
          <div className="grid gap-6">
            <div className="text-2xl font-bold text-[#1e3a5f]">Total: {analytics.total} complaints</div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card">
                <h3 className="font-semibold text-stone-700 mb-2">By Status</h3>
                <ul className="space-y-1 text-sm">
                  {Object.entries(analytics.by_status).map(([k, v]) => (
                    <li key={k} className="flex justify-between"><span className="text-stone-600">{k.replace(/_/g, ' ')}</span><span className="font-medium">{v}</span></li>
                  ))}
                  {Object.keys(analytics.by_status).length === 0 && <li className="text-stone-500">No data</li>}
                </ul>
              </div>
              <div className="card">
                <h3 className="font-semibold text-stone-700 mb-2">By Category</h3>
                <ul className="space-y-1 text-sm">
                  {Object.entries(analytics.by_category).map(([k, v]) => (
                    <li key={k} className="flex justify-between"><span className="text-stone-600">{k}</span><span className="font-medium">{v}</span></li>
                  ))}
                  {Object.keys(analytics.by_category).length === 0 && <li className="text-stone-500">No data</li>}
                </ul>
              </div>
              <div className="card">
                <h3 className="font-semibold text-stone-700 mb-2">By Feedback Type</h3>
                <ul className="space-y-1 text-sm">
                  {Object.entries(analytics.by_feedback_type).map(([k, v]) => (
                    <li key={k} className="flex justify-between"><span className="text-stone-600">{k}</span><span className="font-medium">{v}</span></li>
                  ))}
                  {Object.keys(analytics.by_feedback_type).length === 0 && <li className="text-stone-500">No data</li>}
                </ul>
              </div>
              <div className="card">
                <h3 className="font-semibold text-stone-700 mb-2">By Department</h3>
                <ul className="space-y-1 text-sm">
                  {Object.entries(analytics.by_department).map(([k, v]) => (
                    <li key={k} className="flex justify-between"><span className="text-stone-600 truncate max-w-[120px]">{k}</span><span className="font-medium">{v}</span></li>
                  ))}
                  {Object.keys(analytics.by_department).length === 0 && <li className="text-stone-500">No data</li>}
                </ul>
              </div>
            </div>
            <div className="card">
              <h3 className="font-semibold text-stone-700 mb-2">Top Submitters</h3>
              <ul className="space-y-1">
                {analytics.top_submitters.map((s) => (
                  <li key={s.user_id} className="flex justify-between py-1 border-b border-stone-100 last:border-0">
                    <span>{s.full_name}</span>
                    <span className="font-medium text-[#1e3a5f]">{s.count}</span>
                  </li>
                ))}
                {analytics.top_submitters.length === 0 && <li className="text-stone-500">No data</li>}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-stone-500 py-8 text-center">No analytics data.</p>
        )}
      </main>
    </div>
  );
}
