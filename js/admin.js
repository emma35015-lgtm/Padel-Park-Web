'use strict';

var MEMBERS_KEY = 'padelpark_members';
var VISITS_KEY  = 'padelpark_visits';

var allMembers   = [];
var allVisits    = [];
var scannerActive = false;
var scanCooldown  = false;
var qrScanner    = null;

// ── Storage ───────────────────────────────────────────
function loadMembers() {
  try { return JSON.parse(localStorage.getItem(MEMBERS_KEY)) || []; }
  catch (e) { return []; }
}

function loadVisits() {
  try { return JSON.parse(localStorage.getItem(VISITS_KEY)) || []; }
  catch (e) { return []; }
}

function saveVisit(visit) {
  var visits = loadVisits();
  visits.push(visit);
  localStorage.setItem(VISITS_KEY, JSON.stringify(visits));
  return visits;
}

// ── Helpers ───────────────────────────────────────────
function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function todayISO() { return new Date().toISOString().slice(0, 10); }

function nowTime() {
  var d = new Date();
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function currentMonthPrefix() { return new Date().toISOString().slice(0, 7); }

function formatDate(iso) {
  var p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Tabs ──────────────────────────────────────────────
function switchTab(id) {
  var panels  = document.querySelectorAll('.tab-panel');
  var buttons = document.querySelectorAll('.tab-btn');
  var order   = ['tab-members', 'tab-scanner', 'tab-visits'];

  for (var i = 0; i < panels.length; i++)  panels[i].classList.remove('active');
  for (var i = 0; i < buttons.length; i++) buttons[i].classList.remove('active');

  var panel = document.getElementById(id);
  if (panel) panel.classList.add('active');
  var idx = order.indexOf(id);
  if (idx >= 0 && buttons[idx]) buttons[idx].classList.add('active');

  if (id !== 'tab-scanner' && scannerActive) stopScanner();
}

// ── Stats ─────────────────────────────────────────────
function updateStats() {
  var today = todayISO();
  var month = currentMonthPrefix();

  document.getElementById('stat-total').textContent =
    allMembers.length;
  document.getElementById('stat-month').textContent =
    allMembers.filter(function(m) { return m.date && m.date.slice(0,7) === month; }).length;
  document.getElementById('stat-today-reg').textContent =
    allMembers.filter(function(m) { return m.date === today; }).length;
  document.getElementById('stat-visits-total').textContent =
    allVisits.length;
  document.getElementById('stat-visits-today').textContent =
    allVisits.filter(function(v) { return v.date === today; }).length;
}

// ── Members table ─────────────────────────────────────
function renderMembersTable(members) {
  var tbody = document.getElementById('members-tbody');
  if (!members.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No hay socios registrados.</td></tr>';
    return;
  }
  tbody.innerHTML = members.slice().reverse().map(function(m) {
    return '<tr>'
      + '<td><span class="badge-id">' + escHtml(m.id) + '</span></td>'
      + '<td>' + escHtml(m.name) + '</td>'
      + '<td>' + escHtml(m.phone) + '</td>'
      + '<td>' + (m.date ? formatDate(m.date) : '—') + '</td>'
      + '</tr>';
  }).join('');
}

function filterTable(q) {
  var low = q.toLowerCase();
  if (!low) { renderMembersTable(allMembers); return; }
  renderMembersTable(allMembers.filter(function(m) {
    return m.name.toLowerCase().indexOf(low) >= 0
        || m.phone.toLowerCase().indexOf(low) >= 0
        || m.id.toLowerCase().indexOf(low) >= 0;
  }));
}

// ── Visits table ──────────────────────────────────────
function renderVisitsTable() {
  var tbody = document.getElementById('visits-tbody');
  if (!allVisits.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No hay visitas registradas aún.</td></tr>';
    return;
  }
  tbody.innerHTML = allVisits.slice().reverse().map(function(v) {
    return '<tr>'
      + '<td>' + escHtml(v.date ? formatDate(v.date) : '—') + '</td>'
      + '<td>' + escHtml(v.time || '—') + '</td>'
      + '<td><span class="badge-id">' + escHtml(v.memberId) + '</span></td>'
      + '<td>' + escHtml(v.memberName) + '</td>'
      + '<td>' + escHtml(v.memberPhone) + '</td>'
      + '</tr>';
  }).join('');
}

// ── QR Scanner ────────────────────────────────────────
function toggleScanner() {
  if (scannerActive) { stopScanner(); } else { startScanner(); }
}

function startScanner() {
  if (typeof Html5Qrcode === 'undefined') {
    showToast('Librería de escáner no disponible. Verifica tu conexión.');
    return;
  }

  var box = document.getElementById('qr-reader');
  box.innerHTML = '';
  qrScanner = new Html5Qrcode('qr-reader');

  qrScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 240, height: 240 } },
    onScanSuccess,
    function() {}
  ).then(function() {
    scannerActive = true;
    var btn = document.getElementById('scanner-btn');
    btn.textContent = 'Detener cámara';
    btn.className = 'btn btn-outline';
  }).catch(function(err) {
    showToast('No se pudo acceder a la cámara. Revisa los permisos.');
    console.error(err);
  });
}

function stopScanner() {
  if (!qrScanner || !scannerActive) return;
  qrScanner.stop().then(function() {
    qrScanner.clear();
    scannerActive = false;
    var btn = document.getElementById('scanner-btn');
    btn.textContent = 'Iniciar cámara';
    btn.className = 'btn btn-primary';
  }).catch(function() {});
}

function onScanSuccess(text) {
  if (scanCooldown) return;
  setCooldown(3000);

  var memberId = parseIdFromQR(text);
  if (!memberId) {
    showScanResult('error', 'QR no reconocido', 'Este código no pertenece a Padel Park Gran Jardín.');
    return;
  }

  var member = findMember(memberId);
  if (!member) {
    showScanResult('error', 'Socio no encontrado', 'ID ' + memberId + ' no está en el sistema.');
    return;
  }

  var visit = {
    memberId:    member.id,
    memberName:  member.name,
    memberPhone: member.phone,
    date: todayISO(),
    time: nowTime()
  };

  allVisits = saveVisit(visit);
  updateStats();
  renderVisitsTable();

  showScanResult('success',
    '¡Visita registrada!',
    member.name + ' (' + member.id + ')\n' + formatDate(visit.date) + ' a las ' + visit.time
  );
}

function setCooldown(ms) {
  scanCooldown = true;
  setTimeout(function() { scanCooldown = false; }, ms);
}

function parseIdFromQR(text) {
  var lines = text.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.indexOf('Socio: ') === 0) return line.replace('Socio: ', '').trim();
    var m = line.match(/PP-\d{6}/);
    if (m) return m[0];
  }
  return null;
}

function findMember(id) {
  for (var i = 0; i < allMembers.length; i++) {
    if (allMembers[i].id === id) return allMembers[i];
  }
  return null;
}

function showScanResult(type, title, message) {
  var el = document.getElementById('scan-result');
  el.className = 'scan-result ' + type;
  el.innerHTML = '<strong>' + escHtml(title) + '</strong><br>'
    + escHtml(message).replace(/\n/g, '<br>');
  el.classList.remove('hidden');
}

// ── CSV exports ───────────────────────────────────────
function toCSV(rows) {
  return rows.map(function(row) {
    return row.map(function(cell) {
      return '"' + String(cell).replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\r\n');
}

function downloadCSV(content, filename) {
  var blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportMembersCSV() {
  if (!allMembers.length) { showToast('No hay socios para exportar.'); return; }
  var rows = [['N.º Socio', 'Nombre', 'Teléfono', 'Fecha Registro']].concat(
    allMembers.map(function(m) {
      return [m.id, m.name, m.phone, m.date ? formatDate(m.date) : ''];
    })
  );
  downloadCSV('﻿' + toCSV(rows), 'padelpark_socios_' + todayISO().replace(/-/g,'') + '.csv');
  showToast('Exportados ' + allMembers.length + ' socios ✓');
}

function exportVisitsCSV() {
  if (!allVisits.length) { showToast('No hay visitas para exportar.'); return; }
  var rows = [['Fecha', 'Hora', 'N.º Socio', 'Nombre', 'Teléfono']].concat(
    allVisits.map(function(v) {
      return [v.date ? formatDate(v.date) : '', v.time || '', v.memberId, v.memberName, v.memberPhone];
    })
  );
  downloadCSV('﻿' + toCSV(rows), 'padelpark_visitas_' + todayISO().replace(/-/g,'') + '.csv');
  showToast('Exportadas ' + allVisits.length + ' visitas ✓');
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 3000);
}

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  allMembers = loadMembers();
  allVisits  = loadVisits();
  updateStats();
  renderMembersTable(allMembers);
  renderVisitsTable();
});

window.switchTab         = switchTab;
window.filterTable       = filterTable;
window.toggleScanner     = toggleScanner;
window.exportMembersCSV  = exportMembersCSV;
window.exportVisitsCSV   = exportVisitsCSV;
