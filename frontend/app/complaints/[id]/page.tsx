'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import { complaintsApi } from '@/lib/api';
import { downloadCSV, printHTML } from '@/lib/print-download';
import logo from '../../../Logo.png';

type Complaint = {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  category: string;
  feedback_type: string;
  status: string;
  priority: number;
  department?: string;
  submitter_name?: string;
  assigned_to_id?: number;
  assigned_to_name?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  audit_feedback?: string;
  maintenance_report?: string;
  invoice_amount?: number;
  invoice_notes?: string;
  invoice_items?: { id: number; item: string; cost: number; quantity: number }[];
  responses: { id: number; message: string; is_internal: boolean; created_at: string; responder_name?: string; responder_role?: string }[];
  attachments?: { id: number; file_path: string; file_name: string; url?: string }[];
};

type InvoiceRow = { item: string; cost: string; quantity: string };

function backHref(role: string) {
  if (['student', 'staff'].includes(role)) return '/my-complaints';
  if (['management', 'admin'].includes(role)) return '/management';
  if (role === 'auditor') return '/auditor';
  if (role === 'maintenance_officer') return '/maintenance';
  return '/dashboard';
}

function formatRole(role: string) {
  const map: Record<string, string> = {
    admin: 'Admin',
    management: 'Management',
    auditor: 'Auditor',
    maintenance_officer: 'Maintenance Officer',
    student: 'Student',
    staff: 'Staff',
  };
  return map[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function backLabel(role: string) {
  if (['student', 'staff'].includes(role)) return 'My Complaints';
  if (['management', 'admin'].includes(role)) return 'Manage Complaints';
  if (role === 'auditor') return 'My Audits';
  if (role === 'maintenance_officer') return 'My Assignments';
  return 'Dashboard';
}

export default function ComplaintDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Workflow forms
  const [auditFeedback, setAuditFeedback] = useState('');
  const [maintenanceReport, setMaintenanceReport] = useState('');
  const [invoiceItems, setInvoiceItems] = useState<InvoiceRow[]>([{ item: '', cost: '', quantity: '1' }]);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [workflowSubmitting, setWorkflowSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user || !id) return;

    const load = async () => {
      try {
        const { data } = await complaintsApi.get(id);
        setComplaint(data);
        setAuditFeedback(data.audit_feedback || '');
        setMaintenanceReport(data.maintenance_report || '');
        setInvoiceNotes(data.invoice_notes || '');
        if (data.invoice_items && data.invoice_items.length > 0) {
          setInvoiceItems(data.invoice_items.map((i) => ({
            item: i.item,
            cost: String(i.cost / 100),
            quantity: String(i.quantity),
          })));
        } else {
          setInvoiceItems([{ item: '', cost: '', quantity: '1' }]);
        }
      } catch {
        setComplaint(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, authLoading, router, id]);

  const statusColor = (s: string) => {
    if (s === 'resolved') return 'bg-green-100 text-green-800';
    if (s === 'rejected') return 'bg-red-100 text-red-800';
    if (s.includes('audit') || s === 'audited') return 'bg-blue-100 text-blue-800';
    if (s.includes('maintenance') || s.includes('approval') || s === 'approved') return 'bg-purple-100 text-purple-800';
    return 'bg-amber-100 text-amber-800';
  };

  const handleAddResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !complaint) return;
    setSubmitting(true);
    try {
      await complaintsApi.addResponse(id, { message: message.trim() });
      const { data } = await complaintsApi.get(id);
      setComplaint(data);
      setMessage('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuditSubmit = async (markAs: 'audited' | 'resolved') => {
    if (!complaint || !auditFeedback.trim()) return;
    setWorkflowSubmitting(true);
    try {
      await complaintsApi.update(id, { audit_feedback: auditFeedback.trim(), status: markAs });
      const { data } = await complaintsApi.get(id);
      setComplaint(data);
      setAuditFeedback(data.audit_feedback || '');
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  const handleMaintenanceUpdate = async (status: string) => {
    setWorkflowSubmitting(true);
    try {
      const payload: Record<string, unknown> = { status };
      if (maintenanceReport.trim()) payload.maintenance_report = maintenanceReport.trim();
      if (invoiceNotes.trim()) payload.invoice_notes = invoiceNotes.trim();
      const validItems = invoiceItems.filter((r) => r.item.trim() && r.cost && Number(r.cost) >= 0 && Number(r.quantity) >= 1);
      if (validItems.length > 0) {
        payload.invoice_items = validItems.map((r) => ({
          item: r.item.trim(),
          cost: Math.round(parseFloat(r.cost) * 100) || 0,
          quantity: Math.max(1, parseInt(r.quantity, 10) || 1),
        }));
      }
      await complaintsApi.update(id, payload);
      const { data } = await complaintsApi.get(id);
      setComplaint(data);
      setMaintenanceReport(data.maintenance_report || '');
      setInvoiceNotes(data.invoice_notes || '');
      if (data.invoice_items?.length) {
        setInvoiceItems(data.invoice_items.map((i: { item: string; cost: number; quantity: number }) => ({
          item: i.item,
          cost: String(i.cost / 100),
          quantity: String(i.quantity),
        })));
      }
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  const addInvoiceRow = () => setInvoiceItems((prev) => [...prev, { item: '', cost: '', quantity: '1' }]);
  const removeInvoiceRow = (idx: number) =>
    setInvoiceItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : [{ item: '', cost: '', quantity: '1' }]);
  const updateInvoiceRow = (idx: number, field: keyof InvoiceRow, value: string) =>
    setInvoiceItems((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  if (authLoading) return null;
  if (!user) return null;
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <p className="text-stone-500">Loading...</p>
        </main>
      </div>
    );
  }
  if (!complaint) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <p className="text-stone-500">Complaint not found.</p>
          <Link href={backHref(user.role)} className="text-[#1e3a5f] hover:underline mt-4 inline-block">
            Back to {backLabel(user.role)}
          </Link>
        </main>
      </div>
    );
  }

  const canRespond = complaint.status !== 'resolved' && complaint.status !== 'rejected';
  const visibleResponses = complaint.responses.filter((r) => !r.is_internal || !['student', 'staff'].includes(user.role));
  const isAssignedToMe = complaint.assigned_to_id === user.id;
  const isAuditor = user.role === 'admin' || (user.role === 'auditor' && isAssignedToMe);
  const isMaintenance = user.role === 'admin' || (user.role === 'maintenance_officer' && isAssignedToMe);
  const auditorCanAct = ['assigned_to_auditor', 'final_audit'].includes(complaint.status);
  const maintenanceCanAct = ['assigned_to_maintenance', 'maintenance_in_progress', 'pending_approval', 'approved'].includes(complaint.status);

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href={backHref(user.role)} className="text-[#1e3a5f] hover:underline mb-4 inline-block">
          ← Back to {backLabel(user.role)}
        </Link>

        <div className="card mb-6">
          <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
            <h1 className="text-xl font-bold text-[#1e3a5f]">{complaint.title}</h1>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  /* ---- Build involved personnel section ---- */
                  const esc = (s: string) => s.replace(/</g, '&lt;');
                  const people: { name: string; role: string }[] = [];
                  if (complaint.submitter_name) people.push({ name: complaint.submitter_name, role: 'Submitter' });
                  if (complaint.assigned_to_name) people.push({ name: complaint.assigned_to_name, role: 'Assigned Officer' });
                  /* Extract unique responders with their roles */
                  const seen = new Set<string>();
                  visibleResponses.forEach((r) => {
                    const key = r.responder_name || '';
                    if (key && !seen.has(key)) {
                      seen.add(key);
                      const roleLabel = r.responder_role ? formatRole(r.responder_role) : 'Staff';
                      /* Avoid duplicating the submitter entry */
                      if (key !== complaint.submitter_name || roleLabel !== 'Submitter') {
                        people.push({ name: key, role: roleLabel });
                      }
                    }
                  });
                  /* Deduplicate by name (keep first occurrence) */
                  const uniquePeople: { name: string; role: string }[] = [];
                  const nameSet = new Set<string>();
                  people.forEach((p) => {
                    if (!nameSet.has(p.name)) { nameSet.add(p.name); uniquePeople.push(p); }
                  });

                  const logoUrl = typeof window !== 'undefined' ? window.location.origin + logo.src : logo.src;
                  const html = `
                    <div class="header">
                      <img src="${logoUrl}" alt="MAAUN Logo" class="logo" />
                      <h1 class="portal-title">MAAUN Complaints and Feedback Portal</h1>
                      <p class="portal-subtitle">Maryam Abacha American University Nigeria</p>
                    </div>
                    <hr/>
                    <h2>${esc(complaint.title)}</h2>
                    <p class="meta">${complaint.ticket_number} &bull; ${complaint.category} &bull; ${complaint.feedback_type} &bull; ${complaint.status.replace(/_/g, ' ')}</p>
                    <p><strong>Description:</strong></p>
                    <p>${esc(complaint.description).replace(/\n/g, '<br>')}</p>

                    <div class="section">
                      <h2>People Involved</h2>
                      <table>
                        <thead><tr><th>Name</th><th>Role</th></tr></thead>
                        <tbody>${uniquePeople.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.role)}</td></tr>`).join('')}</tbody>
                      </table>
                    </div>

                    <p><strong>Created:</strong> ${new Date(complaint.created_at).toLocaleString()}</p>
                    ${complaint.resolved_at ? `<p><strong>Resolved:</strong> ${new Date(complaint.resolved_at).toLocaleString()}</p>` : ''}
                    ${complaint.audit_feedback ? `<div class="section"><h2>Audit Feedback</h2><p>${esc(complaint.audit_feedback).replace(/\n/g, '<br>')}</p></div>` : ''}
                    ${complaint.maintenance_report ? `<div class="section"><h2>Maintenance Report</h2><p>${esc(complaint.maintenance_report).replace(/\n/g, '<br>')}</p></div>` : ''}
                    ${complaint.invoice_items && complaint.invoice_items.length > 0 ? `
                    <div class="section"><h2>Invoice</h2>
                    <table><thead><tr><th>Item</th><th>Qty</th><th>Unit Cost (₦)</th><th>Total (₦)</th></tr></thead>
                    <tbody>${complaint.invoice_items.map((i) => `<tr><td>${esc(i.item)}</td><td>${i.quantity}</td><td>${(i.cost / 100).toLocaleString()}</td><td>${(i.cost * i.quantity / 100).toLocaleString()}</td></tr>`).join('')}</tbody>
                    <tfoot><tr><td colspan="3" style="text-align:right">Total</td><td>₦${(complaint.invoice_items.reduce((s, i) => s + i.cost * i.quantity, 0) / 100).toLocaleString()}</td></tr></tfoot></table></div>` : ''}
                    ${visibleResponses.length > 0 ? `<div class="section"><h2>Responses</h2>${visibleResponses.map((r) => `<p><strong>${esc(r.responder_name || 'Staff')}${r.responder_role ? ` (${formatRole(r.responder_role)})` : ''}</strong> &mdash; ${new Date(r.created_at).toLocaleString()}:<br>${esc(r.message).replace(/\n/g, '<br>')}</p>`).join('')}</div>` : ''}
                  `;
                  printHTML(`Complaint ${complaint.ticket_number}`, html);
                }}
                className="btn-secondary text-sm py-1 px-2"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => {
                  /* Build involved personnel for CSV */
                  const csvPeople: string[][] = [];
                  if (complaint.submitter_name) csvPeople.push(['Submitter', complaint.submitter_name]);
                  if (complaint.assigned_to_name) csvPeople.push(['Assigned Officer', complaint.assigned_to_name]);
                  const csvSeen = new Set<string>();
                  visibleResponses.forEach((r) => {
                    const n = r.responder_name || '';
                    if (n && !csvSeen.has(n) && n !== complaint.submitter_name) {
                      csvSeen.add(n);
                      csvPeople.push([r.responder_role ? formatRole(r.responder_role) : 'Staff', n]);
                    }
                  });

                  const rows = [
                    ['MAAUN Complaints and Feedback Portal', ''],
                    ['', ''],
                    ['Ticket', complaint.ticket_number],
                    ['Title', complaint.title],
                    ['Category', complaint.category],
                    ['Feedback Type', complaint.feedback_type],
                    ['Status', complaint.status],
                    ['Description', complaint.description],
                    ['Created', new Date(complaint.created_at).toLocaleString()],
                    ...(complaint.resolved_at ? [['Resolved', new Date(complaint.resolved_at).toLocaleString()]] : []),
                    ['', ''],
                    ['People Involved', ''],
                    ['Role', 'Name'],
                    ...csvPeople,
                    ['', ''],
                    ...(complaint.audit_feedback ? [['Audit Feedback', complaint.audit_feedback]] : []),
                    ...(complaint.maintenance_report ? [['Maintenance Report', complaint.maintenance_report]] : []),
                    ...(complaint.invoice_items && complaint.invoice_items.length > 0
                      ? [['Invoice Total', `₦${(complaint.invoice_items.reduce((s, i) => s + i.cost * i.quantity, 0) / 100).toLocaleString()}`]]
                      : []),
                  ];
                  downloadCSV(`complaint-${complaint.ticket_number}.csv`, rows);
                }}
                className="btn-secondary text-sm py-1 px-2"
              >
                Download
              </button>
            </div>
            <span className={`px-2 py-1 rounded text-sm font-medium ${statusColor(complaint.status)}`}>
              {complaint.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-stone-500 mb-4">
            {complaint.ticket_number} • {complaint.category} • {complaint.feedback_type}
          </p>
          <p className="text-stone-700 whitespace-pre-wrap">{complaint.description}</p>
          {complaint.attachments && complaint.attachments.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-stone-700 mb-2">Proof Images</p>
              <div className="flex flex-wrap gap-3">
                {complaint.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.url || `/uploads/${att.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={att.url || `/uploads/${att.file_path}`}
                      alt={att.file_name}
                      className="w-24 h-24 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                    />
                    <p className="text-xs text-stone-500 mt-1 truncate max-w-[96px]">{att.file_name}</p>
                  </a>
                ))}
              </div>
            </div>
          )}
          {complaint.audit_feedback && ['management', 'admin', 'auditor'].includes(user.role) && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-1">Audit feedback</p>
              <p className="text-stone-700 whitespace-pre-wrap text-sm">{complaint.audit_feedback}</p>
            </div>
          )}
          {complaint.maintenance_report && ['management', 'admin', 'maintenance_officer'].includes(user.role) && (
            <div className="mt-4 p-3 bg-purple-50 rounded-lg">
              <p className="text-sm font-medium text-purple-900 mb-1">Maintenance report</p>
              <p className="text-stone-700 whitespace-pre-wrap text-sm">{complaint.maintenance_report}</p>
            </div>
          )}
          {((complaint.invoice_items && complaint.invoice_items.length > 0) || complaint.invoice_amount != null || complaint.invoice_notes) && ['management', 'admin', 'maintenance_officer'].includes(user.role) && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg">
              <p className="text-sm font-medium text-amber-900 mb-2">Invoice</p>
              {complaint.invoice_items && complaint.invoice_items.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-200">
                      <th className="text-left py-1 font-medium">Item</th>
                      <th className="text-right py-1 font-medium">Qty</th>
                      <th className="text-right py-1 font-medium">Unit Cost (₦)</th>
                      <th className="text-right py-1 font-medium">Total (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complaint.invoice_items.map((i) => (
                      <tr key={i.id} className="border-b border-amber-100">
                        <td className="py-1">{i.item}</td>
                        <td className="text-right py-1">{i.quantity}</td>
                        <td className="text-right py-1">{(i.cost / 100).toLocaleString()}</td>
                        <td className="text-right py-1 font-medium">{(i.cost * i.quantity / 100).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={3} className="py-2 text-right">Total:</td>
                      <td className="py-2 text-right">₦{((complaint.invoice_items?.reduce((s, i) => s + i.cost * i.quantity, 0) ?? complaint.invoice_amount ?? 0) / 100).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              ) : complaint.invoice_amount != null && (
                <p className="text-sm">Total: ₦{(complaint.invoice_amount / 100).toLocaleString()}</p>
              )}
              {complaint.invoice_notes && (
                <p className="text-stone-700 whitespace-pre-wrap text-sm mt-2">{complaint.invoice_notes}</p>
              )}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-stone-200 flex flex-wrap gap-4 text-sm text-stone-600">
            <span>Submitted by: {complaint.submitter_name}</span>
            {complaint.assigned_to_name && <span>Assigned to: {complaint.assigned_to_name}</span>}
            <span>Created: {new Date(complaint.created_at).toLocaleDateString()}</span>
            {complaint.resolved_at && (
              <span>Resolved: {new Date(complaint.resolved_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {/* Auditor workflow */}
        {isAuditor && auditorCanAct && (
          <div className="card mb-6 border-l-4 border-blue-500">
            <h3 className="font-semibold text-blue-900 mb-3">Submit audit feedback</h3>
            <textarea
              value={auditFeedback}
              onChange={(e) => setAuditFeedback(e.target.value)}
              className="input-field min-h-[100px] mb-3"
              placeholder="Enter verification findings..."
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleAuditSubmit('audited')}
                disabled={workflowSubmitting || !auditFeedback.trim()}
                className="btn-primary"
              >
                {workflowSubmitting ? 'Saving...' : 'Mark as audited'}
              </button>
              {complaint.status === 'final_audit' && (
                <button
                  onClick={() => handleAuditSubmit('resolved')}
                  disabled={workflowSubmitting || !auditFeedback.trim()}
                  className="btn-primary bg-green-600 hover:bg-green-700"
                >
                  Verify & resolve
                </button>
              )}
            </div>
          </div>
        )}

        {/* Maintenance workflow */}
        {isMaintenance && maintenanceCanAct && (
          <div className="card mb-6 border-l-4 border-purple-500">
            <h3 className="font-semibold text-purple-900 mb-3">Maintenance update</h3>
            <label className="block text-sm font-medium text-stone-700 mb-1">Report</label>
            <textarea
              value={maintenanceReport}
              onChange={(e) => setMaintenanceReport(e.target.value)}
              className="input-field min-h-[80px] mb-3"
              placeholder="Repair work done, findings..."
            />
            <label className="block text-sm font-medium text-stone-700 mb-2">Invoice (item, quantity, cost)</label>
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="text-left py-1 font-medium">Item</th>
                    <th className="text-right py-1 font-medium w-20">Qty</th>
                    <th className="text-right py-1 font-medium w-24">Cost (₦)</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((row, idx) => (
                    <tr key={idx} className="border-b border-stone-100">
                      <td className="py-1">
                        <input
                          type="text"
                          value={row.item}
                          onChange={(e) => updateInvoiceRow(idx, 'item', e.target.value)}
                          className="input-field py-1 text-sm w-full"
                          placeholder="Description"
                        />
                      </td>
                      <td className="py-1 px-1">
                        <input
                          type="number"
                          value={row.quantity}
                          onChange={(e) => updateInvoiceRow(idx, 'quantity', e.target.value)}
                          className="input-field py-1 text-sm w-full text-right"
                          min="1"
                        />
                      </td>
                      <td className="py-1 px-1">
                        <input
                          type="number"
                          value={row.cost}
                          onChange={(e) => updateInvoiceRow(idx, 'cost', e.target.value)}
                          className="input-field py-1 text-sm w-full text-right"
                          placeholder="0"
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="py-1">
                        <button
                          type="button"
                          onClick={() => removeInvoiceRow(idx)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={addInvoiceRow} className="text-sm text-[#1e3a5f] hover:underline mt-1">
                + Add item
              </button>
            </div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Invoice notes</label>
            <textarea
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              className="input-field min-h-[60px] mb-3"
              placeholder="Optional notes..."
            />
            <div className="flex flex-wrap gap-2">
              {complaint.status === 'assigned_to_maintenance' && (
                <button
                  onClick={() => handleMaintenanceUpdate('maintenance_in_progress')}
                  disabled={workflowSubmitting}
                  className="btn-primary"
                >
                  Start repair
                </button>
              )}
              {(complaint.status === 'maintenance_in_progress' || complaint.status === 'assigned_to_maintenance') && (
                <button
                  onClick={() => handleMaintenanceUpdate('pending_approval')}
                  disabled={workflowSubmitting}
                  className="btn-primary"
                >
                  Submit for approval
                </button>
              )}
              {complaint.status === 'approved' && (
                <button
                  onClick={() => handleMaintenanceUpdate('repair_completed')}
                  disabled={workflowSubmitting}
                  className="btn-primary bg-green-600 hover:bg-green-700"
                >
                  Mark repair completed
                </button>
              )}
              {(complaint.status === 'pending_approval' || complaint.status === 'maintenance_in_progress') && (
                <button
                  onClick={() => handleMaintenanceUpdate(complaint.status)}
                  disabled={workflowSubmitting}
                  className="btn-secondary"
                >
                  Save changes (update report & invoice)
                </button>
              )}
            </div>
          </div>
        )}

        <h2 className="text-lg font-semibold mb-4">Responses</h2>
        <div className="space-y-4 mb-6">
          {visibleResponses.length === 0 ? (
            <p className="text-stone-500">No responses yet.</p>
          ) : (
            visibleResponses.map((r) => (
              <div key={r.id} className="card border-l-4 border-[#1e3a5f]">
                <p className="text-stone-700 whitespace-pre-wrap">{r.message}</p>
                <p className="text-sm text-stone-500 mt-2">
                  {r.responder_name}{r.responder_role ? ` (${formatRole(r.responder_role)})` : ''} • {new Date(r.created_at).toLocaleString()}
                  {r.is_internal && <span className="ml-2 text-amber-600">(Internal note)</span>}
                </p>
              </div>
            ))
          )}
        </div>

        {canRespond && (
          <form onSubmit={handleAddResponse} className="card">
            <label className="block text-sm font-medium text-stone-700 mb-2">Add Response</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input-field min-h-[80px]"
              placeholder="Type your response..."
              required
            />
            <button type="submit" className="btn-primary mt-3" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Response'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
