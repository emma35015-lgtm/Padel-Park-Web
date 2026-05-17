'use strict';

const STORAGE_KEY = 'padelpark_members';
let allMembers = [];

// ── Load ─────────────────────────────────────────────
function loadMembers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// ── Date helpers ─────────────────────────────────────
function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthPrefix() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

// ── Stats ────────────────────────────────────────────
function updateStats(members) {
  const today = todayISO();
  const month = currentMonthPrefix();

  document.getElementById('stat-total').textContent = members.length;
  document.getElementById('stat-month').textContent =
    members.filter(m => m.date && m.date.startsWith(month)).length;
  document.getElementById('stat-today').textContent =
    members.filter(m => m.date === today).length;
}

// ── Table render ─────────────────────────────────────
function renderTable(members) {
  const tbody = document.getElementById('members-tbody');

  if (!members.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No hay socios registrados aún.</td></tr>';
    return;
  }

  // Newest first
  const sorted = [...members].reverse();
  tbody.innerHTML = sorted.map(m => `
    <tr>
      <td><span class="badge-id">${escapeHtml(m.id)}</span></td>
      <td>${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.phone)}</td>
      <td>${m.date ? formatDate(m.date) : '—'}</td>
    </tr>
  `).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Search / filter ───────────────────────────────────
function filterTable(query) {
  const q = query.toLowerCase();
  if (!q) {
    renderTable(allMembers);
    return;
  }
  const filtered = allMembers.filter(m =>
    m.name.toLowerCase().includes(q) ||
    m.phone.toLowerCase().includes(q) ||
    m.id.toLowerCase().includes(q)
  );
  renderTable(filtered);
}

// ── CSV export ───────────────────────────────────────
function exportCSV() {
  if (!allMembers.length) {
    showToast('No hay socios para exportar.');
    return;
  }

  const BOM = '﻿'; // UTF-8 BOM for Excel compatibility
  const headers = ['N.º Socio', 'Nombre', 'Teléfono', 'Fecha de Registro'];
  const rows = allMembers.map(m => [
    m.id,
    m.name,
    m.phone,
    m.date ? formatDate(m.date) : '',
  ]);

  const csvContent = BOM + [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = todayISO().replace(/-/g, '');

  a.href     = url;
  a.download = `padelpark_socios_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Exportados ${allMembers.length} socios ✓`);
}

// ── Toast ────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  allMembers = loadMembers();
  updateStats(allMembers);
  renderTable(allMembers);
});

// Expose globals for inline handlers
window.exportCSV   = exportCSV;
window.filterTable = filterTable;
