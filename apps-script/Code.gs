// ═══════════════════════════════════════════════════════
//  Padel Park Gran Jardín — Google Apps Script Web App
//  1. Reemplaza SS_ID con el ID de tu Google Sheet
//  2. Despliega como Web App (Ejecutar como: Yo, Acceso: Cualquier persona)
//  3. Copia la URL /exec y pégala en js/admin.js como SHEETS_URL
// ═══════════════════════════════════════════════════════

var SS_ID = '1-IHYl9JnoOSEKJqSIPq5mOyhNl8l6MhRIA5XkfAgpCk';

function getSheets() {
  var ss = SpreadsheetApp.openById(SS_ID);
  return { members: ss.getSheetByName('Socios'), visits: ss.getSheetByName('Visitas') };
}

// ── GET: devuelve todos los socios y visitas ──────────
function doGet(e) {
  var s   = getSheets();
  var out = { members: [], visits: [] };

  var md = s.members.getDataRange().getValues();
  for (var i = 1; i < md.length; i++) {
    if (md[i][0]) out.members.push({
      id: String(md[i][0]), name: String(md[i][1]),
      phone: String(md[i][2]), date: String(md[i][3])
    });
  }

  var vd = s.visits.getDataRange().getValues();
  for (var i = 1; i < vd.length; i++) {
    if (vd[i][0]) out.visits.push({
      date: String(vd[i][0]), time: String(vd[i][1]),
      memberId: String(vd[i][2]), memberName: String(vd[i][3]),
      memberPhone: String(vd[i][4])
    });
  }

  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── POST: escanear QR o eliminar socio ───────────────
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var s    = getSheets();

  // ── Registrar visita (y socio si es nuevo) ─────────
  if (data.action === 'scan') {
    var md    = s.members.getDataRange().getValues();
    var isNew = true;
    for (var i = 1; i < md.length; i++) {
      if (String(md[i][0]) === data.memberId) { isNew = false; break; }
    }
    if (isNew) {
      s.members.appendRow([data.memberId, data.memberName, data.memberPhone, data.memberDate]);
    }
    s.visits.appendRow([data.date, data.time, data.memberId, data.memberName, data.memberPhone]);

    // Contar visitas del socio
    var vd    = s.visits.getDataRange().getValues();
    var count = 0;
    for (var i = 1; i < vd.length; i++) {
      if (String(vd[i][2]) === data.memberId) count++;
    }

    return ContentService.createTextOutput(JSON.stringify({
      ok: true, isNew: isNew, visitCount: count,
      promo: count > 0 && count % 5 === 0
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ── Eliminar socio ─────────────────────────────────
  if (data.action === 'delete') {
    var md = s.members.getDataRange().getValues();
    for (var i = 1; i < md.length; i++) {
      if (String(md[i][0]) === data.memberId) { s.members.deleteRow(i + 1); break; }
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false }))
    .setMimeType(ContentService.MimeType.JSON);
}
