'use strict';

var MEMBERS_KEY = 'padelpark_members';
var VISITS_KEY  = 'padelpark_visits';

var allMembers    = [];
var allVisits     = [];
var scannerActive = false;
var scanCooldown  = false;
var videoStream   = null;
var animFrameId   = null;

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

// ── Visit count per member ────────────────────────────
function countVisits(memberId) {
  var n = 0;
  for (var i = 0; i < allVisits.length; i++) {
    if (allVisits[i].memberId === memberId) n++;
  }
  return n;
}

// ── Members table ─────────────────────────────────────
function renderMembersTable(members) {
  var tbody = document.getElementById('members-tbody');
  if (!members.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay socios registrados.</td></tr>';
    return;
  }
  tbody.innerHTML = members.slice().reverse().map(function(m) {
    var visits = countVisits(m.id);
    var promo  = visits > 0 && visits % 5 === 0;
    return '<tr>'
      + '<td><span class="badge-id">' + escHtml(m.id) + '</span></td>'
      + '<td>' + escHtml(m.name) + '</td>'
      + '<td>' + escHtml(m.phone) + '</td>'
      + '<td>' + (m.date ? formatDate(m.date) : '—') + '</td>'
      + '<td style="text-align:center">'
      +   '<span class="visit-count">' + visits + '</span>'
      +   (promo ? ' <span class="promo-badge">★ Promo</span>' : '')
      + '</td>'
      + '<td><button class="btn-delete" onclick="deleteMember(\'' + escHtml(m.id) + '\')">Eliminar</button></td>'
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

// ── Delete member ─────────────────────────────────────
function deleteMember(id) {
  var member = findMember(id);
  var name   = member ? member.name : id;
  if (!confirm('¿Eliminar al socio ' + name + ' (' + id + ')?\nEsta acción no se puede deshacer.')) return;
  allMembers = allMembers.filter(function(m) { return m.id !== id; });
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(allMembers));
  updateStats();
  renderMembersTable(allMembers);
  showToast('Socio eliminado ✓');
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
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showScanResult('error', 'Cámara no disponible',
      'Tu navegador no soporta acceso a la cámara. Usa Chrome o Safari y asegúrate de estar en HTTPS.');
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(function(stream) {
      videoStream = stream;
      var video = document.getElementById('scanner-video');
      video.srcObject = stream;
      video.play();
      scannerActive = true;

      var btn = document.getElementById('scanner-btn');
      btn.textContent = 'Detener cámara';
      btn.className = 'btn btn-outline';

      animFrameId = requestAnimationFrame(scanLoop);
    })
    .catch(function(err) {
      var msg = 'Revisa que hayas dado permiso de cámara al navegador.';
      if (err.name === 'NotAllowedError')  msg = 'Permiso de cámara denegado. Acéptalo cuando el navegador lo pida.';
      if (err.name === 'NotFoundError')    msg = 'No se encontró ninguna cámara en este dispositivo.';
      if (err.name === 'NotReadableError') msg = 'La cámara está siendo usada por otra aplicación.';
      showScanResult('error', 'Error al abrir la cámara', msg);
    });
}

function scanLoop() {
  if (!scannerActive) return;

  var video  = document.getElementById('scanner-video');
  var canvas = document.getElementById('scanner-canvas');

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (typeof jsQR !== 'undefined') {
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var code = jsQR(imageData.data, imageData.width, imageData.height,
                      { inversionAttempts: 'dontInvert' });
      if (code && !scanCooldown) {
        onScanSuccess(code.data);
      }
    }
  }

  animFrameId = requestAnimationFrame(scanLoop);
}

function stopScanner() {
  scannerActive = false;
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  if (videoStream) {
    videoStream.getTracks().forEach(function(t) { t.stop(); });
    videoStream = null;
  }
  var video = document.getElementById('scanner-video');
  if (video) { video.srcObject = null; }
  var btn = document.getElementById('scanner-btn');
  btn.textContent = 'Iniciar cámara';
  btn.className = 'btn btn-primary';
}

function onScanSuccess(text) {
  if (scanCooldown) return;
  setCooldown(3000);

  var parsed = parseQR(text);
  if (!parsed) {
    showScanResult('error', 'QR no reconocido', 'Este código no pertenece a Padel Park Gran Jardín.');
    return;
  }

  // Register member on first scan if not yet in the system
  var member  = findMember(parsed.id);
  var isNew   = false;
  if (!member) {
    member = { id: parsed.id, name: parsed.name, phone: parsed.phone, date: parsed.regDate };
    allMembers.push(member);
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(allMembers));
    isNew = true;
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
  renderMembersTable(allMembers);

  var totalVisits = countVisits(member.id);

  if (isNew) {
    showScanResult('success',
      '✓ ¡Nuevo socio registrado!',
      member.name + ' (' + member.id + ')\nPrimera visita: ' + formatDate(visit.date) + ' — ' + visit.time
    );
  } else if (totalVisits > 0 && totalVisits % 5 === 0) {
    showScanResult('promo',
      '🎉 ¡APLICA PROMOCIÓN!',
      member.name + ' lleva ' + totalVisits + ' visitas.\nAplica descuento o beneficio especial.'
    );
  } else {
    showScanResult('success',
      '✓ Visita registrada',
      member.name + ' (' + member.id + ')\n' + formatDate(visit.date) + ' — ' + visit.time
    );
  }
}

function setCooldown(ms) {
  scanCooldown = true;
  setTimeout(function() { scanCooldown = false; }, ms);
}

// Parse all member data from QR text
function parseQR(text) {
  if (text.indexOf('PADEL PARK') === -1) return null;
  var lines  = text.split('\n');
  var result = { id: null, name: null, phone: null, regDate: todayISO() };

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.indexOf('Socio: ') === 0)  result.id      = line.replace('Socio: ', '').trim();
    if (line.indexOf('Nombre: ') === 0) result.name    = line.replace('Nombre: ', '').trim();
    if (line.indexOf('Tel: ') === 0)    result.phone   = line.replace('Tel: ', '').trim();
    if (line.indexOf('Desde: ') === 0)  result.regDate = ddmmToISO(line.replace('Desde: ', '').trim());
  }

  if (!result.id || !result.name) return null;
  return result;
}

// Convert DD/MM/YYYY → YYYY-MM-DD
function ddmmToISO(str) {
  var p = str.split('/');
  if (p.length !== 3) return todayISO();
  return p[2] + '-' + p[1] + '-' + p[0];
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
function init() {
  allMembers = loadMembers();
  allVisits  = loadVisits();
  updateStats();
  renderMembersTable(allMembers);
  renderVisitsTable();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.switchTab         = switchTab;
window.filterTable       = filterTable;
window.toggleScanner     = toggleScanner;
window.exportMembersCSV  = exportMembersCSV;
window.exportVisitsCSV   = exportVisitsCSV;
window.deleteMember      = deleteMember;
