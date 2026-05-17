'use strict';

// ── Storage helpers ──────────────────────────────────
const STORAGE_KEY = 'padelpark_members';

function loadMembers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveMember(member) {
  const members = loadMembers();
  members.push(member);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

// ── ID generator ─────────────────────────────────────
function generateId() {
  const members = loadMembers();
  // Next sequential number padded to 6 digits
  const next = (members.length + 1).toString().padStart(6, '0');
  return 'PP-' + next;
}

// ── Date formatter ───────────────────────────────────
function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ── QR generator ─────────────────────────────────────
function generateQR(text) {
  const container = document.getElementById('qr-code');
  container.innerHTML = '';

  if (typeof QRCode === 'undefined') {
    // CDN failed — show a plain text fallback so the card still displays
    container.style.cssText = 'font-size:8px;color:#0d1b4b;word-break:break-all;padding:2px;text-align:center;';
    container.textContent = text;
    return;
  }

  try {
    new QRCode(container, {
      text,
      width: 72,
      height: 72,
      colorDark: '#0d1b4b',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  } catch (e) {
    container.textContent = '';
  }
}

// ── Section navigation ───────────────────────────────
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);
}

// ── Register handler ─────────────────────────────────
function handleRegister(event) {
  event.preventDefault();

  const name  = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();

  if (!name || !phone) return;

  const id   = generateId();
  const date = todayISO();

  const member = { id, name, phone, date };
  saveMember(member);
  showSection('card-view');  // muestra la sección primero
  renderCard(member);        // luego llena los datos y el QR
}

// ── Card renderer ─────────────────────────────────────
function renderCard(member) {
  document.getElementById('card-name').textContent  = member.name;
  document.getElementById('card-phone').textContent = member.phone;
  document.getElementById('card-id').textContent    = member.id;
  document.getElementById('card-date').textContent  = formatDate(member.date);

  // QR encodes the member data as plain text
  const qrPayload = [
    'PADEL PARK GRAN JARDÍN',
    'Socio: ' + member.id,
    'Nombre: ' + member.name,
    'Tel: ' + member.phone,
    'Desde: ' + formatDate(member.date),
  ].join('\n');

  generateQR(qrPayload);
}

// ── Init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  showSection('landing');

  // Reset form when going back from card view
  document.getElementById('register-form')?.addEventListener('reset', () => {
    showSection('landing');
  });
});

// Expose globals for inline event handlers
window.showSection    = showSection;
window.handleRegister = handleRegister;
