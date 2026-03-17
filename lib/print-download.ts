/**
 * Utilities for printing and downloading reports as CSV.
 */

function escapeCsvCell(val: unknown): string {
  if (val == null) return '';
  const s = String(val);
  return `"${s.replace(/"/g, '""')}"`;
}

export function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function printHTML(title: string, html: string) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Please allow popups to print.');
    return;
  }
  w.document.write(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; color: #1c1917; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #d6d3d1; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f4; font-weight: 600; }
  h1 { font-size: 1.25rem; margin-bottom: 8px; }
  h2 { font-size: 1rem; margin: 16px 0 8px; color: #44403c; }
  .meta { color: #78716c; font-size: 0.875rem; margin-bottom: 16px; }
  .section { margin-bottom: 20px; }
  .header { text-align: center; margin-bottom: 16px; }
  .logo { width: 80px; height: 80px; object-fit: contain; margin: 0 auto 8px; display: block; }
  .portal-title { font-size: 1.5rem; font-weight: 700; color: #1e3a5f; margin-bottom: 4px; }
  .portal-subtitle { font-size: 0.95rem; color: #78716c; margin: 0; }
  hr { border: none; border-top: 2px solid #1e3a5f; margin: 16px 0; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>${html}</body>
</html>`);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    w.close();
  }, 250);
}
