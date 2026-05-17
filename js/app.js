'use strict';

var STORAGE_KEY = 'padelpark_members';

// ── Storage ───────────────────────────────────────────
function loadMembers() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveMember(member) {
  var members = loadMembers();
  members.push(member);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

// ── ID ────────────────────────────────────────────────
function generateId() {
  var members = loadMembers();
  var num = String(members.length + 1);
  while (num.length < 6) { num = '0' + num; }
  return 'PP-' + num;
}

// ── Date ──────────────────────────────────────────────
function formatDate(isoDate) {
  var parts = isoDate.split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ── QR via imagen (sin librería JS) ───────────────────
function generateQR(text) {
  var container = document.getElementById('qr-code');
  container.innerHTML = '';
  var img = document.createElement('img');
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.borderRadius = '4px';
  img.alt = 'QR Socio';
  img.src = 'https://api.qrserver.com/v1/create-qr-code/'
    + '?size=144x144&margin=2&color=0d1b4b&bgcolor=ffffff'
    + '&data=' + encodeURIComponent(text);
  container.appendChild(img);
}

// ── Navegación ────────────────────────────────────────
function showSection(id) {
  var sections = document.querySelectorAll('.section');
  for (var i = 0; i < sections.length; i++) {
    sections[i].classList.remove('active');
  }
  var target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
  }
  window.scrollTo(0, 0);
}

// ── Render tarjeta ────────────────────────────────────
function renderCard(member) {
  document.getElementById('card-name').textContent  = member.name;
  document.getElementById('card-phone').textContent = member.phone;
  document.getElementById('card-id').textContent    = member.id;
  document.getElementById('card-date').textContent  = formatDate(member.date);

  var qrText = 'PADEL PARK GRAN JARDIN'
    + '\nSocio: '  + member.id
    + '\nNombre: ' + member.name
    + '\nTel: '    + member.phone
    + '\nDesde: '  + formatDate(member.date);

  generateQR(qrText);
}

// ── Submit formulario ─────────────────────────────────
function handleRegister(event) {
  event.preventDefault();

  var nameEl  = document.getElementById('name');
  var phoneEl = document.getElementById('phone');

  if (!nameEl || !phoneEl) return;

  var name  = nameEl.value.trim();
  var phone = phoneEl.value.trim();

  if (!name || !phone) return;

  var member = {
    id:    generateId(),
    name:  name,
    phone: phone,
    date:  todayISO()
  };

  saveMember(member);
  showSection('card-view');
  renderCard(member);
}

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  showSection('landing');

  var form = document.getElementById('register-form');
  if (form) {
    form.addEventListener('reset', function () {
      showSection('landing');
    });
  }
});

window.showSection    = showSection;
window.handleRegister = handleRegister;
