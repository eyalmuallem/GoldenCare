export function formatCurrency(value) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function calculatePrice(basePrice, discountPercent) {
  const base = Math.max(0, Number(basePrice || 0));
  const discount = Math.min(100, Math.max(0, Number(discountPercent || 0)));
  return Math.round((base * (100 - discount)) / 100 * 100) / 100;
}

export function normalizePhone(value) {
  return String(value || '').replace(/[^0-9+]/g, '');
}

export function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
