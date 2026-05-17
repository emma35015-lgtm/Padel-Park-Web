'use strict';

var STORAGE_KEY = 'padelpark_members';

// ── Pastel color themes ───────────────────────────────
var CARD_THEMES = [
  { from: '#dbeafe', to: '#93c5fd', accent: '#1d4ed8', text: '#1e3a8a' }, // azul
  { from: '#d1fae5', to: '#6ee7b7', accent: '#059669', text: '#064e3b' }, // menta
  { from: '#ede9fe', to: '#c4b5fd', accent: '#7c3aed', text: '#4c1d95' }, // lavanda
  { from: '#ffedd5', to: '#fdba74', accent: '#c2410c', text: '#7c2d12' }, // durazno
  { from: '#fce7f3', to: '#f9a8d4', accent: '#db2777', text: '#831843' }, // rosa
  { from: '#fef9c3', to: '#fde047', accent: '#b45309', text: '#78350f' }, // limón
  { from: '#cffafe', to: '#67e8f9', accent: '#0891b2', text: '#164e63' }, // cian
  { from: '#ecfccb', to: '#bef264', accent: '#65a30d', text: '#365314' }, // lima
  { from: '#fee2e2', to: '#fca5a5', accent: '#dc2626', text: '#7f1d1d' }, // coral
  { from: '#f0fdf4', to: '#86efac', accent: '#16a34a', text: '#14532d' }, // verde
];

// ── Storage ───────────────────────────────────────────
function loadMembers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch (e) { return []; }
}

function saveMember(member) {
  var members = loadMembers();
  members.push(member);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

// ── ID generator (random, no central counter needed) ──
function generateId() {
  var n = String(Math.floor(Math.random() * 900000) + 100000);
  return 'PP-' + n;
}

// ── Date ──────────────────────────────────────────────
function formatDate(iso) {
  var p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ── Navigation ────────────────────────────────────────
function showSection(id) {
  var all = document.querySelectorAll('.section');
  for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
  var target = document.getElementById(id);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);
}

// ── QR (qrcodejs — canvas local, sin CORS) ────────────
function generateQR(text) {
  var container = document.getElementById('qr-code');
  container.innerHTML = '';
  if (typeof QRCode === 'undefined') return;
  try {
    new QRCode(container, {
      text: text,
      width: 120,
      height: 120,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch (e) { /* silently ignore */ }
}

// ── Apply random pastel theme ─────────────────────────
function applyRandomTheme() {
  var theme = CARD_THEMES[Math.floor(Math.random() * CARD_THEMES.length)];
  var card  = document.getElementById('loyalty-card');
  card.style.setProperty('--card-from',   theme.from);
  card.style.setProperty('--card-to',     theme.to);
  card.style.setProperty('--card-accent', theme.accent);
  card.style.setProperty('--card-text',   theme.text);
}

// ── Render card ───────────────────────────────────────
function renderCard(member) {
  document.getElementById('card-name').textContent  = member.name;
  document.getElementById('card-phone').textContent = member.phone;
  document.getElementById('card-date').textContent  = formatDate(member.date);

  // Show last 4 chars of ID as the member number (like "0001")
  var shortId = member.id.replace('PP-', '');
  document.getElementById('card-id').textContent = shortId;

  applyRandomTheme();

  var qrText = 'PADEL PARK GRAN JARDIN'
    + '\nSocio: '  + member.id
    + '\nNombre: ' + member.name
    + '\nTel: '    + member.phone
    + '\nDesde: '  + formatDate(member.date);

  generateQR(qrText);
}

// ── Download card as PNG ──────────────────────────────
function downloadCard() {
  var btn  = document.getElementById('download-btn');
  var card = document.getElementById('loyalty-card');

  btn.textContent = 'Generando…';
  btn.disabled    = true;

  if (typeof html2canvas === 'undefined') {
    alert('Función no disponible. Toma una captura de pantalla.');
    btn.textContent = '↓ Descargar tarjeta';
    btn.disabled    = false;
    return;
  }

  html2canvas(card, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false
  }).then(function(canvas) {
    var link      = document.createElement('a');
    link.download = 'tarjeta-padel-park.png';
    link.href     = canvas.toDataURL('image/png');
    link.click();
    btn.textContent = '↓ Descargar tarjeta';
    btn.disabled    = false;
  }).catch(function() {
    alert('No se pudo descargar. Toma una captura de pantalla.');
    btn.textContent = '↓ Descargar tarjeta';
    btn.disabled    = false;
  });
}

// ── Register handler ──────────────────────────────────
function handleRegister(event) {
  event.preventDefault();

  var nameEl  = document.getElementById('name');
  var phoneEl = document.getElementById('phone');
  if (!nameEl || !phoneEl) return;

  var name  = nameEl.value.trim();
  var phone = phoneEl.value.trim();
  if (!name || !phone) return;

  var member = { id: generateId(), name: name, phone: phone, date: todayISO() };
  // No guardamos aquí — el registro ocurre cuando admin escanea el QR por primera vez

  showSection('card-view');
  renderCard(member);
}

// ── Init ──────────────────────────────────────────────
function init() {
  showSection('landing');

  var form = document.getElementById('register-form');
  if (form) {
    // Attach submit handler programmatically — more reliable than inline onsubmit
    form.addEventListener('submit', handleRegister);
    form.addEventListener('reset',  function() { showSection('landing'); });
  }
}

// Run immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.showSection    = showSection;
window.handleRegister = handleRegister;
window.downloadCard   = downloadCard;
