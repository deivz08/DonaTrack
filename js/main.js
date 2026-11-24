/* ==========================================================
   DonaTrack | main.js — lógica compartida por todas las páginas.
   Cada página declara data-page y este script solo inicializa lo que existe en ella.
   HU: Donante 001-007,009,010,012 · Empresa 017,019,021,022,024-027,029,031 · ONG 033-037,039,040,042,044,047
   ========================================================== */
(() => {
'use strict';
if (window.DT_STOP) return; // redirección por ruta privada en curso

/* ---------- Utilidades ---------- */
const NIL = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : NIL, set: () => true, apply: () => NIL }); // elemento ausente en esta página
const $ = (s, r = document) => r.querySelector(s) || NIL;
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const P = document.body.dataset.page;
const me = () => window.Auth && window.Auth.current();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const hoy = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ahora = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const money = n => 'S/ ' + Number(n).toLocaleString('es-PE');
const store = {
  get(k, d) { try { const v = localStorage.getItem('dt_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('dt_' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
};
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}
function setMsg(el, text, type = 'err', html = false) {
  el.className = 'msg ' + (text ? type : '');
  if (html) el.innerHTML = text; else el.textContent = text || '';
}
function printDoc(title, body) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#222;max-width:800px;margin:auto}h1{color:#5A3A1A}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #999;padding:6px 8px;text-align:left}th{background:#FBE7A1}img{max-width:200px;margin:4px}</style></head><body>${body}</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { // ventana bloqueada: se descarga el archivo
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = title.replace(/\s+/g, '_') + '.html'; a.click(); return;
  }
  w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
}

/* ---------- Modales ---------- */
let lastTrigger = null;
function openModal(id, trigger) {
  const m = $('#' + id); lastTrigger = trigger || document.activeElement;
  m.hidden = false; document.body.style.overflow = 'hidden';
  const f = $('button, input, select, a[href]', m); (f || m).focus();
}
function closeModal(m) {
  m.hidden = true;
  if (!$$('.modal').some(x => !x.hidden)) document.body.style.overflow = '';
  if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
}
$$('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) closeModal(m); });
  m.addEventListener('keydown', e => { // trampa de foco básica
    if (e.key !== 'Tab') return;
    const fs = $$('button:not([disabled]),input:not([disabled]),select,textarea,a[href],summary', m).filter(x => x.offsetParent !== null);
    if (!fs.length) return;
    const first = fs[0], last = fs[fs.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const open = $$('.modal').filter(m => !m.hidden).pop(); if (open) closeModal(open); }
});

/* ---------- Tabs accesibles (teclado con flechas) ---------- */
$$('[data-tabs]').forEach(list => {
  const tabs = $$('[role=tab]', list);
  const select = t => {
    tabs.forEach(x => {
      const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1;
      $('#' + x.getAttribute('aria-controls')).hidden = !on;
    });
    t.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', e => {
      let n = null;
      if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') n = tabs[0];
      if (e.key === 'End') n = tabs[tabs.length - 1];
      if (n) { e.preventDefault(); select(n); }
    });
  });
});

/* ==========================================================
   DATOS (demostración conservada). El estado de las donaciones y los montos
   se guarda en localStorage para que se mantenga entre páginas.
   ========================================================== */
const ETAPAS = ['Recibido', 'Comprando', 'En camino', 'Entregado'];
const ETAPA_ICON = ['inventory_2', 'shopping_cart', 'local_shipping', 'check_circle'];
const ETAPA_BADGE = ['recibido', 'proceso', 'camino', 'entregado'];
const CATS = { ninos: 'Niños', adultos: 'Adultos mayores', emergencias: 'Emergencias' };
const ONGS = [
  { id: 'ong1', nombre: 'Manos Unidas Perú', formal: 'Alta', reportes: 14, colabs: ['Empresa Andina S.A.', 'Textiles del Sur S.A.C.'] },
  { id: 'ong2', nombre: 'Sonrisas del Sur', formal: 'Media', reportes: 6, colabs: ['Comercial Pacífico S.A.'] },
  { id: 'ong3', nombre: 'Casa Esperanza', formal: 'Media', reportes: 0, colabs: [] }
];
const ongName = id => (ONGS.find(o => o.id === id) || {}).nombre || '';
const CAMPS = [
  { id: 'c1', titulo: 'Abrigos para niños de Puno', cat: 'ninos', ong: 'ong1', urg: 3, dist: 1000, rec: 3200, meta: 5000, benef: 120, video: true, uso: 'Compra de abrigos y transporte hasta comunidades altoandinas.' },
  { id: 'c2', titulo: 'Almuerzos para adultos mayores', cat: 'adultos', ong: 'ong2', urg: 2, dist: 6, rec: 1800, meta: 3000, benef: 60, video: true, uso: 'Compra de alimentos y preparación de almuerzos en comedores.' },
  { id: 'c3', titulo: 'Víveres por lluvias en Piura', cat: 'emergencias', ong: 'ong1', urg: 5, dist: 980, rec: 4100, meta: 8000, benef: 300, video: true, uso: 'Kits de víveres y agua para familias damnificadas.' },
  { id: 'c4', titulo: 'Útiles escolares en Cusco', cat: 'ninos', ong: 'ong2', urg: 1, dist: 1100, rec: 900, meta: 2500, benef: 85, video: false, uso: 'Cuadernos, lápices y mochilas para escuelas rurales.' },
  { id: 'c5', titulo: 'Albergue temporal para familias', cat: 'emergencias', ong: 'ong3', urg: 4, dist: 15, rec: 600, meta: 6000, benef: 40, video: true, uso: 'Alquiler de espacio, colchones y alimentación de familias.' }
].concat(store.get('camps', []));
const saveCustomCamps = () => store.set('camps', CAMPS.filter(c => c.custom));
const campName = id => (CAMPS.find(c => c.id === id) || {}).titulo || id;
const recAdd = store.get('recadd', {});
CAMPS.forEach(c => { if (!c.custom) c.rec += recAdd[c.id] || 0; });
function addRec(c, v) { c.rec += v; if (c.custom) saveCustomCamps(); else { recAdd[c.id] = (recAdd[c.id] || 0) + v; store.set('recadd', recAdd); } }

const DONS = [
  { codigo: 'DT-2026-0001', camp: 'c1', tipo: 'monetaria', detalle: 'S/ 100 por Yape', etapa: 2, fecha: '2026-11-03', hist: [],
    ev: [{ t: 'doc', titulo: 'Comprobante de recepción', fecha: '2026-11-03', etapa: 0 }, { t: 'doc', titulo: 'Factura de compra de abrigos', fecha: '2026-11-06', etapa: 1 }, { t: 'foto', titulo: 'Carga de abrigos en camión', fecha: '2026-11-10', etapa: 2 }] },
  { codigo: 'DT-2026-0002', camp: 'c2', tipo: 'especie', detalle: '20 kg de arroz', etapa: 3, fecha: '2026-10-20', hist: [],
    ev: [{ t: 'doc', titulo: 'Comprobante de recepción', fecha: '2026-10-20', etapa: 0 }, { t: 'doc', titulo: 'Boleta de compra complementaria', fecha: '2026-10-23', etapa: 1 }, { t: 'foto', titulo: 'Traslado al comedor', fecha: '2026-10-26', etapa: 2 }, { t: 'foto', titulo: 'Entrega a beneficiarios', fecha: '2026-10-28', etapa: 3 }, { t: 'doc', titulo: 'Acta de entrega firmada', fecha: '2026-10-28', etapa: 3 }] },
  { codigo: 'DT-2026-0003', camp: 'c3', tipo: 'monetaria', detalle: 'S/ 50 por Plin', etapa: -1, fecha: hoy(), hist: [], ev: [] }
].concat(store.get('dons', []));
const dov = store.get('dov', {}); // avances de las donaciones de demostración
DONS.forEach(d => { const o = dov[d.codigo]; if (o && !d.user) { d.etapa = o.etapa; d.hist = o.hist; d.ev = o.ev; } });
const saveDons = () => {
  store.set('dons', DONS.filter(d => d.user));
  const o = {}; DONS.filter(d => !d.user).forEach(d => { o[d.codigo] = { etapa: d.etapa, hist: d.hist, ev: d.ev }; }); store.set('dov', o);
};
let seq = store.get('seq', 100);
const nuevoCodigo = () => { seq++; store.set('seq', seq); return `DT-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`; };
let notifOn = store.get('notif', {});
const notifActiva = camp => notifOn[camp] !== false;

/* ==========================================================
   HU-001 / 002 / 003 / 004  Campañas y donación  (campanas.html)
   ========================================================== */
const state = { cat: '', q: '', sort: '', reportes: store.get('reportes', {}), actas: {}, distrib: {} };

function renderCampanas() {
  const q = state.q.toLowerCase();
  let list = CAMPS.filter(c => (!state.cat || c.cat === state.cat) &&
    (!q || (c.titulo + ' ' + ongName(c.ong)).toLowerCase().includes(q)));
  if (state.sort === 'urgencia') list.sort((a, b) => b.urg - a.urg);
  if (state.sort === 'cercania') list.sort((a, b) => a.dist - b.dist);
  const grid = $('#campGrid'), empty = $('#campEmpty');
  $('#campCount').textContent = `${list.length} campaña${list.length === 1 ? '' : 's'} activa${list.length === 1 ? '' : 's'}`;
  if (!list.length) {
    const otras = Object.keys(CATS).filter(k => k !== state.cat).map(k => CATS[k]).join(', ');
    empty.hidden = false; grid.innerHTML = '';
    empty.innerHTML = `<p><strong>No hay campañas disponibles con esos filtros.</strong></p><p>Prueba con otras categorías: ${esc(otras)}.</p>`;
    return;
  }
  empty.hidden = true;
  grid.innerHTML = list.map(c => {
    const pct = Math.min(100, Math.round(c.rec / c.meta * 100)), o = ONGS.find(x => x.id === c.ong);
    return `<article class="card camp" data-id="${c.id}">
      <div><span class="tag">${esc(CATS[c.cat])}</span> ${c.urg >= 4 ? '<span class="badge badge--incidencia"><span class="ms" aria-hidden="true">priority_high</span>Urgente</span>' : ''} ${state.reportes[c.id] ? '<span class="badge badge--entregado"><span class="ms" aria-hidden="true">verified</span>Reporte disponible</span>' : ''}</div>
      <h3>${esc(c.titulo)}</h3>
      <p class="camp__meta">${esc(ongName(c.ong))} · Formalidad ${esc(o ? o.formal : '-')} · ${c.dist} km</p>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Avance de recaudación"><span style="width:${pct}%"></span></div>
      <div class="camp__nums"><span>${money(c.rec)} de ${money(c.meta)}</span><span>${pct}%</span></div>
      <p class="camp__meta">${c.benef} beneficiarios alcanzados</p>
      <div class="btn-row"><button class="btn btn-sm" type="button" data-det="${c.id}">Ver detalle</button><button class="btn btn-primary btn-sm" type="button" data-don="${c.id}"><span class="ms" aria-hidden="true">favorite</span>Donar</button></div>
    </article>`;
  }).join('');
}
$('#campSearch').addEventListener('input', e => { state.q = e.target.value.trim(); renderCampanas(); });
$('#campSort').addEventListener('change', e => { state.sort = e.target.value; renderCampanas(); });
$('#campChips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  state.cat = b.dataset.cat; $$('#campChips .chip').forEach(x => x.setAttribute('aria-pressed', x === b)); renderCampanas();
});
$('#campGrid').addEventListener('click', e => {
  const d = e.target.closest('[data-det]'), n = e.target.closest('[data-don]');
  if (d) abrirDetalle(d.dataset.det, d); if (n) abrirDonar(n.dataset.don, n);
});

/* Detalle de campaña: formalidad ONG (HU-001 CA03) + video y resumen (HU-002) */
function abrirDetalle(id, trigger) {
  const c = CAMPS.find(x => x.id === id), o = ONGS.find(x => x.id === c.ong);
  $('#detTitulo').textContent = c.titulo;
  $('#detBody').innerHTML = `
    <p><span class="tag">${esc(CATS[c.cat])}</span></p>
    <h3 style="margin-top:12px">Sobre la ONG</h3>
    <p>${esc(o.nombre)} · Formalidad <strong>${esc(o.formal)}</strong> · ${o.reportes} reportes de transparencia publicados.</p>
    <h3 style="margin-top:12px">¿A dónde va tu ayuda?</h3>
    <div id="videoBox"></div>
    <ul class="list"><li><strong>Destino de los fondos:</strong> ${esc(c.uso)}</li><li><strong>Meta:</strong> ${money(c.meta)} · <strong>Recaudado:</strong> ${money(c.rec)} · <strong>Beneficiarios:</strong> ${c.benef}</li></ul>
    <div class="btn-row"><button class="btn btn-primary" type="button" id="detDonar"><span class="ms" aria-hidden="true">favorite</span>Donar a esta campaña</button></div>`;
  const box = $('#videoBox');
  if (c.video) {
    box.innerHTML = `<div class="video"><video controls preload="none" aria-label="Video corto de la campaña ${esc(c.titulo)}"><source src="assets/videos/${c.id}.mp4" type="video/mp4"></video><p class="small" id="vidNote" hidden style="margin-top:8px">El video no está disponible en este momento. Revisa el resumen a continuación.</p></div>`;
    $('video', box).addEventListener('error', () => { $('#vidNote').hidden = false; }, true);
  }
  $('#detDonar').addEventListener('click', () => { closeModal($('#modalDetalle')); abrirDonar(id, trigger); });
  openModal('modalDetalle', trigger);
}

/* Donación (HU-003 dinero / HU-004 bienes) */
let campDonar = null;
function abrirDonar(id, trigger) {
  campDonar = CAMPS.find(x => x.id === id);
  $('#donTitulo').textContent = 'Donar a: ' + campDonar.titulo;
  $('#donarResultado').innerHTML = '';
  ['#errDinero', '#errBienes'].forEach(s => setMsg($(s), ''));
  setTab('dinero'); openModal('modalDonar', trigger);
}
function setTab(t) {
  $('#tabDinero').setAttribute('aria-pressed', t === 'dinero'); $('#tabBienes').setAttribute('aria-pressed', t === 'bienes');
  $('#formDinero').hidden = t !== 'dinero'; $('#formBienes').hidden = t !== 'bienes';
}
$('#tabDinero').addEventListener('click', () => setTab('dinero'));
$('#tabBienes').addEventListener('click', () => setTab('bienes'));

function comprobante(d, extra) {
  return `<div class="card card--yellow"><p class="verified"><span class="ms" aria-hidden="true">check_circle</span>Donación registrada</p>
    <ul class="list" style="margin-top:10px"><li><strong>Código de trazabilidad:</strong> ${d.codigo}</li><li><strong>Campaña:</strong> ${esc(campName(d.camp))}</li><li><strong>Aporte:</strong> ${esc(d.detalle)}</li><li><strong>Fecha:</strong> ${d.fecha} ${ahora()}</li>${extra || ''}</ul>
    <div class="btn-row"><button class="btn btn-primary" type="button" data-seguir="${d.codigo}">Ver seguimiento</button><button class="btn" type="button" data-compr="${d.codigo}"><span class="ms" aria-hidden="true">download</span>Comprobante</button></div></div>`;
}
$('#formDinero').addEventListener('submit', e => {
  e.preventDefault();
  const err = $('#errDinero'), montoEl = $('#monto'), v = parseFloat(montoEl.value);
  montoEl.setAttribute('aria-invalid', 'false');
  if (!(v > 0)) { montoEl.setAttribute('aria-invalid', 'true'); setMsg(err, 'Ingresa un monto válido mayor a cero.'); montoEl.focus(); return; }
  const metodo = $('input[name=metodo]:checked').value, t0 = performance.now();
  setMsg(err, 'Procesando tu pago…', 'warn');
  setTimeout(() => {
    if ($('#simRechazo').checked) { setMsg(err, `Pago rechazado por la pasarela (${metodo}). Intenta con otro método de pago.`); return; }
    const d = { codigo: nuevoCodigo(), camp: campDonar.id, tipo: 'monetaria', detalle: `${money(v)} por ${metodo}`, monto: v, etapa: -1, fecha: hoy(), hist: [], ev: [], user: true, owner: (me() || {}).email || '' };
    DONS.push(d); saveDons(); addRec(campDonar, v); renderCampanas();
    setMsg(err, ''); montoEl.value = '';
    $('#donarResultado').innerHTML = comprobante(d, `<li><strong>Confirmada en:</strong> ${((performance.now() - t0) / 1000).toFixed(1)} s</li>`);
    toast('¡Gracias por donar! Guarda tu código de trazabilidad.');
  }, 700);
});
$('#formBienes').addEventListener('submit', e => {
  e.preventDefault();
  const err = $('#errBienes'), q = parseInt($('#cantBien').value, 10);
  if (!(q >= 1)) { $('#cantBien').setAttribute('aria-invalid', 'true'); setMsg(err, 'Indica la cantidad de bienes que vas a donar.'); $('#cantBien').focus(); return; }
  $('#cantBien').setAttribute('aria-invalid', 'false'); setMsg(err, '');
  const f = new Date(); f.setDate(f.getDate() + 3);
  const punto = $('#puntoEntrega').value;
  const d = { codigo: nuevoCodigo(), camp: campDonar.id, tipo: 'especie', detalle: `${q} ${$('#tipoBien').value}`, etapa: -1, fecha: hoy(), hist: [], ev: [], user: true, owner: (me() || {}).email || '' };
  DONS.push(d); saveDons();
  $('#donarResultado').innerHTML = comprobante(d, `<li><strong>Punto de entrega:</strong> ${esc(punto)}</li><li><strong>Fecha acordada:</strong> ${hoy(f)}</li><li class="small">Recibirás el comprobante de recepción cuando la ONG confirme la entrega.</li>`);
  $('#cantBien').value = '';
});
$('#donarResultado').addEventListener('click', e => {
  const s = e.target.closest('[data-seguir]'), c = e.target.closest('[data-compr]');
  if (s) location.href = 'seguimiento.html?codigo=' + encodeURIComponent(s.dataset.seguir);
  if (c) { const d = DONS.find(x => x.codigo === c.dataset.compr); printDoc('Comprobante ' + d.codigo, `<h1>Comprobante digital DonaTrack</h1><p><strong>Código:</strong> ${d.codigo}</p><p><strong>Campaña:</strong> ${esc(campName(d.camp))}</p><p><strong>Aporte:</strong> ${esc(d.detalle)}</p><p><strong>Fecha:</strong> ${d.fecha}</p>`); }
});

/* ==========================================================
   HU-012 código | HU-005 barra de estado | HU-006 notificaciones
   HU-007 resumen en viñetas | HU-009 mapa de impacto | HU-010 fotos  (seguimiento.html)
   ========================================================== */
const campOfDon = d => CAMPS.find(c => c.id === d.camp);
function renderMyDonationCodes() {
  const holder = $('#myDonationCodes'), u = me();
  if (!holder || !u) return;
  const mine = DONS.filter(d => d.owner && d.owner === u.email).slice().reverse();
  holder.innerHTML = mine.length
    ? `<p class="small"><strong>Tus donaciones</strong> · ${mine.length}</p><div class="chips">${mine.map(d => `<button class="chip my-donation-code" type="button" data-code="${esc(d.codigo)}">${esc(d.codigo)} · ${esc(campName(d.camp))}</button>`).join('')}</div>`
    : '<p class="small">Aún no hay donaciones registradas con esta cuenta.</p>';
}
function buscar(code) {
  const err = $('#codigoErr'), out = $('#segResultado');
  code = code.trim().toUpperCase();
  if (!code) { setMsg(err, 'Ingresa tu código de trazabilidad.'); out.innerHTML = ''; return; }
  const u = me(), d = DONS.find(x => x.codigo === code && (!u || (x.owner && x.owner === u.email)));
  if (!d) { setMsg(err, u ? 'Ese código no corresponde a una donación registrada con esta cuenta.' : 'No encontramos una donación con ese código. Revisa tu comprobante.'); out.innerHTML = ''; return; }
  setMsg(err, ''); renderSeguimiento(d);
}
$('#formCodigo').addEventListener('submit', e => { e.preventDefault(); buscar($('#codigo').value); });
$('#myDonationCodes').addEventListener('click', e => { const b = e.target.closest('.my-donation-code'); if (!b) return; $('#codigo').value = b.dataset.code; buscar(b.dataset.code); });

function renderSeguimiento(d) {
  const c = campOfDon(d), cur = d.etapa;
  const ev = [...d.ev].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const steps = ETAPAS.map((e, i) => {
    const cls = i < cur ? 'is-done' : i === cur ? (i === 3 ? 'is-final' : 'is-current') : '';
    return `<li class="step ${cls}" ${i === cur ? 'aria-current="step"' : ''}><span class="ms" aria-hidden="true">${ETAPA_ICON[i]}</span>${e}${i < cur ? '<small>Completado</small>' : i === cur ? '<small>Etapa actual</small>' : ''}</li>`;
  }).join('');
  const ultima = d.ev.length ? ev[ev.length - 1].fecha : d.fecha;
  const bullets = [
    ['Estado', cur < 0 ? 'En espera de confirmación' : ETAPAS[cur], `La ONG registró este avance. Última actualización: ${ultima}.`],
    ['Aporte', d.detalle, `Registrado el ${d.fecha}. Tipo: ${d.tipo === 'monetaria' ? 'monetaria' : 'en especie'}.`],
    ['Campaña', campName(d.camp), `ONG responsable: ${ongName(c.ong)}.`],
    ['Siguiente paso', cur >= 3 ? 'Entrega completada' : cur < 0 ? 'Confirmación de la ONG' : ETAPAS[cur + 1], 'Recibirás una notificación cuando cambie la etapa.'],
    ['Evidencia', d.ev.length ? `${d.ev.length} archivo${d.ev.length > 1 ? 's' : ''}` : 'Pendiente', 'Fotos con fecha, facturas y actas vinculadas a tu donación.']
  ].map(b => `<details><summary>${b[0]}: ${esc(b[1])}</summary><p>${esc(b[2])}</p></details>`).join('');
  const evHtml = !ev.length
    ? '<p class="msg warn" style="display:block">La evidencia está pendiente de ser registrada por la ONG.</p>'
    : `<ol class="timeline">${ev.map((x, i) => `<li><div class="ev">${x.t === 'foto'
      ? `<button class="ph" type="button" data-foto="${i}" aria-label="Ampliar foto: ${esc(x.titulo)}, ${x.fecha}"><span class="ms" aria-hidden="true">photo_camera</span></button>`
      : `<span class="ph"><span class="ms" aria-hidden="true">description</span></span>`}
      <div><p><strong>${esc(x.titulo)}</strong></p><p class="ev__date">${x.fecha} · ${ETAPAS[x.etapa]} · ${esc(campName(d.camp))}</p></div></div></li>`).join('')}</ol>`;
  const entrega = cur === 3 ? `<p class="verified final"><span class="ms" aria-hidden="true">verified</span>Entregada al beneficiario final el ${ev.filter(x => x.etapa === 3).pop()?.fecha || ultima}</p>` : '';
  $('#segResultado').innerHTML = `
    <div class="grid grid--2" style="align-items:start">
      <div class="card"><h3>${d.codigo}</h3><p>${esc(c.titulo)} · ${esc(d.detalle)}</p>
        <span class="badge badge--${cur < 0 ? 'recibido' : ETAPA_BADGE[cur]}" style="margin-top:8px"><span class="ms" aria-hidden="true">${cur < 0 ? 'hourglass_empty' : ETAPA_ICON[cur]}</span>${cur < 0 ? 'En espera de confirmación' : ETAPAS[cur]}</span>
        <ol class="stepper" aria-label="Etapas de la donación">${steps}</ol>
        <h4>Resumen</h4><div style="margin-top:8px">${bullets}</div>
        ${cur < 3 ? '<div class="btn-row"><button class="btn btn-sm" type="button" id="btnAvance">Simular avance de la ONG (demo)</button></div>' : ''}
      </div>
      <div class="card"><h3>Historial de actualizaciones</h3>
        <label class="switch"><input type="checkbox" id="swNotif" ${notifActiva(d.camp) ? 'checked' : ''}>Recibir notificaciones de esta campaña</label>
        <ul class="list" style="margin-top:10px" aria-live="polite">${d.hist.length ? d.hist.slice().reverse().map(h => `<li>${esc(h)}</li>`).join('') : '<li>Aún no hay notificaciones.</li>'}</ul>
        <h3 style="margin-top:20px">Mapa de Impacto en Vivo</h3><div style="margin-top:12px">${evHtml}</div>${entrega}
      </div>
    </div>`;
  $('#swNotif').addEventListener('change', e => { notifOn[d.camp] = e.target.checked; store.set('notif', notifOn); toast(e.target.checked ? 'Notificaciones activadas' : 'Notificaciones desactivadas'); });
  const av = $('#btnAvance'); av.addEventListener('click', () => avanzar(d));
  $$('[data-foto]').forEach(b => b.addEventListener('click', () => {
    const x = ev[b.dataset.foto]; $('#lbTitulo').textContent = x.titulo;
    $('#lbBody').innerHTML = `<div class="lb-photo" role="img" aria-label="Foto: ${esc(x.titulo)}"><span class="ms" aria-hidden="true">photo_camera</span></div><p style="margin-top:10px"><strong>Fecha:</strong> ${x.fecha} · <strong>Campaña:</strong> ${esc(campName(d.camp))}</p>`;
    openModal('lightbox', b);
  }));
}
const bellItems = [];
function avanzar(d) {
  d.etapa = Math.min(3, d.etapa + 1);
  const e = d.etapa, f = hoy();
  const extra = [[{ t: 'doc', titulo: 'Comprobante de recepción' }], [{ t: 'doc', titulo: 'Factura de compra' }], [{ t: 'foto', titulo: 'Carga en camino' }], [{ t: 'foto', titulo: 'Entrega al beneficiario' }, { t: 'doc', titulo: 'Acta de entrega firmada' }]][e];
  extra.forEach(x => d.ev.push({ ...x, fecha: f, etapa: e }));
  const txt = `${f} ${ahora()} — Tu donación pasó a «${ETAPAS[e]}»`;
  if (notifActiva(d.camp)) { d.hist.push(txt); bellItems.unshift(`${d.codigo}: ${ETAPAS[e]}`); toast(`Notificación: ${d.codigo} ahora está «${ETAPAS[e]}»`); }
  else d.hist.push(`${f} ${ahora()} — Cambio registrado (notificación desactivada)`);
  saveDons(); renderBell();
  if (P === 'seguimiento') renderSeguimiento(d); else renderEtapas();
}
function renderBell() {
  const dot = $('#bellDot'); dot.hidden = !bellItems.length; dot.textContent = bellItems.length;
  $('#bellList').innerHTML = bellItems.length ? bellItems.map(i => `<li>${esc(i)}</li>`).join('') : '<li>No tienes notificaciones nuevas.</li>';
}
$('#bellBtn').addEventListener('click', e => openModal('modalNotif', e.currentTarget));

/* ---------- Panel del donante (panel-donante.html) ---------- */
function renderPanelDonante() {
  const u = me(), mine = DONS.filter(d => d.owner && u && d.owner === u.email);
  const total = mine.reduce((s, d) => s + (d.monto || 0), 0), ent = mine.filter(d => d.etapa === 3).length;
  $('#pdStats').innerHTML = `<div class="stat"><strong>${mine.length}</strong><span>donaciones registradas</span></div><div class="stat"><strong>${ent}</strong><span>entregadas</span></div><div class="stat"><strong>${money(total)}</strong><span>donado en dinero</span></div>`;
  $('#pdLista').innerHTML = mine.length ? `<div class="table-wrap"><table><caption>Mis donaciones</caption><thead><tr><th scope="col">Código</th><th scope="col">Campaña</th><th scope="col">Aporte</th><th scope="col">Fecha</th><th scope="col">Estado</th><th scope="col">Seguimiento</th></tr></thead><tbody>${mine.slice().reverse().map(d => {
    const c = d.etapa; return `<tr><th scope="row" style="background:none">${d.codigo}</th><td>${esc(campName(d.camp))}</td><td>${esc(d.detalle)}</td><td>${d.fecha}</td><td><span class="badge badge--${c < 0 ? 'recibido' : ETAPA_BADGE[c]}">${c < 0 ? 'En espera' : ETAPAS[c]}</span></td><td><a class="btn btn-sm" href="seguimiento.html?codigo=${encodeURIComponent(d.codigo)}">Ver seguimiento</a></td></tr>`; }).join('')}</tbody></table></div>`
    : '<div class="empty"><p><strong>Aún no tienes donaciones registradas con esta cuenta.</strong></p><p style="margin-top:6px">Elige una campaña y dona: tu código de trazabilidad aparecerá aquí.</p><div class="btn-row" style="justify-content:center"><a class="btn btn-primary" href="campanas.html"><span class="ms" aria-hidden="true">favorite</span>Ver campañas</a></div></div>';
}

/* ==========================================================
   EMPRESAS RSC  (empresas.html)
   ========================================================== */
const EMPC = [
  { id: 'e1', nombre: 'Útiles escolares', ong: 'ong2', tipo: 'especie', etapa: 3, pct: 100, monto: 2400, crono: ['2026-10-10', '2026-10-20'], pend: null },
  { id: 'e2', nombre: 'Abrigos para Puno', ong: 'ong1', tipo: 'monetaria', etapa: 1, pct: 45, monto: 8000, crono: ['2026-11-01', '2026-11-30'], pend: null },
  { id: 'e3', nombre: 'Víveres por emergencia', ong: 'ong1', tipo: 'especie', etapa: 2, pct: 70, monto: 0, crono: ['2026-09-01', '2026-09-15'], pend: null }
];
const empName = id => (EMPC.find(c => c.id === id) || {}).nombre || id;
const EVID = [
  { id: 1, camp: 'e1', tipo: 'foto', titulo: 'Entrega en escuela', fecha: '2026-10-12', rev: false },
  { id: 2, camp: 'e1', tipo: 'boleta', titulo: 'Boleta de compra de útiles', fecha: '2026-10-15', rev: false },
  { id: 3, camp: 'e1', tipo: 'acta', titulo: 'Acta de entrega', fecha: '2026-10-18', rev: false },
  { id: 4, camp: 'e2', tipo: 'boleta', titulo: 'Factura de abrigos', fecha: '2026-11-05', rev: false },
  { id: 5, camp: 'e2', tipo: 'foto', titulo: 'Foto de entrega', fecha: '2026-12-02', rev: false },
  { id: 6, camp: 'e2', tipo: 'acta', titulo: 'Acta de recepción', fecha: '2026-11-20', rev: false },
  { id: 7, camp: 'e3', tipo: 'acta', titulo: 'Acta de entrega de víveres', fecha: '2026-09-10', rev: false },
  { id: 8, camp: 'e3', tipo: 'foto', titulo: 'Foto de reparto', fecha: '2026-09-20', rev: false }
];
const TIPOS = { foto: 'Foto', boleta: 'Boleta/Factura', acta: 'Acta' };
const empCampOptions = () => EMPC.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
['#cronoCamp', '#apCamp', '#bolCamp', '#repCamp', '#audCamp'].forEach(s => { $(s).innerHTML = empCampOptions(); });

/* HU-024 panel en tiempo real */
function renderPanel() {
  const f = $('#rscFilter').value, list = EMPC.filter(c => !f || c.tipo === f);
  $('#rscEmpty').hidden = list.length > 0;
  $('#rscTable').innerHTML = list.map(c => `<tr><th scope="row" style="background:none">${esc(c.nombre)}</th><td>${esc(ongName(c.ong))}</td><td>${c.tipo === 'monetaria' ? 'Monetaria' : 'En especie'}</td>
    <td><span class="badge badge--${ETAPA_BADGE[c.etapa]}"><span class="ms" aria-hidden="true">${ETAPA_ICON[c.etapa]}</span>${ETAPAS[c.etapa]}</span></td>
    <td style="min-width:140px"><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${c.pct}" aria-label="Avance de ${esc(c.nombre)}"><span style="width:${c.pct}%"></span></div><span class="small">${c.pct}%</span></td></tr>`).join('');
  $('#rscUpdated').textContent = '· actualizado ' + ahora();
}
$('#rscFilter').addEventListener('change', renderPanel);

/* HU-017 evaluar ONG */
$('#ongList').innerHTML = ONGS.map(o => `<div class="card"><label class="check"><input type="checkbox" name="ongSel" value="${o.id}"><strong>${esc(o.nombre)}</strong></label>
  <p class="small">Formalidad: ${esc(o.formal)} · ${o.reportes} reportes previos</p></div>`).join('');
$('#btnComparar').addEventListener('click', () => {
  const sel = $$('input[name=ongSel]:checked').map(i => ONGS.find(o => o.id === i.value)), tbl = $('#ongCompare');
  if (sel.length < 2) { setMsg($('#ongMsg'), 'Selecciona al menos dos ONG para compararlas.'); tbl.hidden = true; return; }
  setMsg($('#ongMsg'), '');
  const row = (l, fn) => `<tr><th scope="row">${l}</th>${sel.map(o => `<td>${fn(o)}</td>`).join('')}</tr>`;
  tbl.hidden = false;
  tbl.innerHTML = `<table><thead><tr><th scope="col">Criterio</th>${sel.map(o => `<th scope="col">${esc(o.nombre)}</th>`).join('')}</tr></thead><tbody>
    ${row('Formalización', o => esc(o.formal))}
    ${row('Reportes previos', o => o.reportes ? o.reportes : 'Información aún no disponible')}
    ${row('Colaboraciones anteriores', o => o.colabs.length ? esc(o.colabs.join(', ')) : 'Información aún no disponible')}</tbody></table>`;
});

/* HU-019 cronograma */
const cronoSel = () => EMPC.find(c => c.id === $('#cronoCamp').value);
function renderCrono() {
  const c = cronoSel();
  $('#cronoVigente').innerHTML = `<strong>${esc(c.nombre)}</strong><br>Vigente: ${c.crono[0]} → ${c.crono[1]}` + (c.pend ? `<br><span class="tag">Propuesta pendiente: ${c.pend[0]} → ${c.pend[1]}</span>` : '');
  $('#cronoIni').value = c.crono[0]; $('#cronoFin').value = c.crono[1];
  renderEvid();
}
$('#cronoCamp').addEventListener('change', renderCrono);
$('#formCrono').addEventListener('submit', e => {
  e.preventDefault(); const a = $('#cronoIni').value, b = $('#cronoFin').value, m = $('#cronoMsg');
  if (!a || !b || a > b) { setMsg(m, 'Indica fechas válidas: el inicio no puede ser posterior al fin.'); return; }
  cronoSel().pend = [a, b]; setMsg(m, 'Propuesta enviada a la ONG. Queda pendiente de confirmación.', 'warn'); renderCrono();
});
$('#btnConfCrono').addEventListener('click', () => {
  const c = cronoSel(), m = $('#cronoMsg');
  if (!c.pend) { setMsg(m, 'Primero propone un cronograma.', 'warn'); return; }
  c.crono = c.pend; c.pend = null; setMsg(m, 'Cronograma confirmado y visible en el detalle de la campaña.', 'ok'); renderCrono();
});
$('#btnSimCrono').addEventListener('click', () => {
  const c = cronoSel(), f = new Date(c.crono[1] + 'T00:00:00'); f.setDate(f.getDate() + 5);
  c.crono = [c.crono[0], hoy(f)]; setMsg($('#cronoMsg'), 'La ONG modificó la fecha final. Se notificó a ambas partes.', 'warn');
  pushNotif(c.id, 'La ONG modificó el cronograma de entrega'); renderCrono();
});

/* HU-021 aporte + HU-022 notificaciones */
const aportes = [];
$('#apTipo').addEventListener('change', e => { $('#apValorLbl').textContent = e.target.value === 'especie' ? 'Cantidad de bienes' : 'Monto (S/)'; });
$('#formAporte').addEventListener('submit', e => {
  e.preventDefault(); const m = $('#apMsg'), t = $('#apTipo').value, v = parseFloat($('#apValor').value);
  if (!t) { setMsg(m, 'Selecciona el tipo de aporte (monetario o en especie).'); $('#apTipo').focus(); return; }
  if (!(v > 0)) { setMsg(m, 'Ingresa un monto o cantidad mayor a cero.'); return; }
  const c = EMPC.find(x => x.id === $('#apCamp').value), id = `CI-${new Date().getFullYear()}-${String(aportes.length + 1).padStart(3, '0')}`;
  if (t === 'monetario') c.monto += v;
  aportes.push({ id, camp: c.id, t, v });
  setMsg(m, `Aporte registrado y vinculado a ${c.nombre} (${ongName(c.ong)}). Comprobante interno ${id}.`, 'ok');
  $('#apLista').innerHTML = aportes.map(a => `<li>${a.id} · ${esc(empName(a.camp))} · ${a.t === 'monetario' ? money(a.v) : a.v + ' bienes'}</li>`).join('');
  $('#apValor').value = '';
});
const NOTIFS = [
  { fecha: '2026-11-08', camp: 'e2', det: 'Compra de abrigos completada' },
  { fecha: '2026-11-09', camp: 'e3', det: 'Víveres en camino' },
  { fecha: '2026-11-12', camp: 'e2', det: 'Abrigos recibidos en almacén' }
];
function pushNotif(camp, det) { NOTIFS.push({ fecha: hoy() + ' ' + ahora(), camp, det }); renderNotifs(); }
function renderNotifs() {
  const fr = $('#notifFreq').value, ul = $('#notifList');
  if (fr === 'inmediata') ul.innerHTML = NOTIFS.slice().reverse().map(n => `<li><strong>${n.fecha}</strong> · ${esc(empName(n.camp))}: ${esc(n.det)}</li>`).join('');
  else ul.innerHTML = `<li><strong>Resumen ${fr}</strong>: ${NOTIFS.length} actualizaciones en ${new Set(NOTIFS.map(n => n.camp)).size} campañas.<ul class="list" style="margin-top:8px">${NOTIFS.map(n => `<li>${n.fecha} · ${esc(empName(n.camp))}: ${esc(n.det)}</li>`).join('')}</ul></li>`;
}
$('#notifFreq').addEventListener('change', renderNotifs);
$('#btnSimNotif').addEventListener('click', () => { pushNotif(EMPC[Math.floor(Math.random() * EMPC.length)].id, 'La ONG actualizó la etapa de la campaña'); toast('Nueva actualización de la ONG'); });

/* HU-025 repositorio + HU-026 verificación de fechas + HU-027 boletas */
const estadoEv = e => { const c = EMPC.find(x => x.id === e.camp); if (e.rev) return 'rev'; return (e.fecha >= c.crono[0] && e.fecha <= c.crono[1]) ? 'ok' : 'bad'; };
function renderEvid() {
  const q = $('#evQ').value.toLowerCase(), d1 = $('#evDesde').value, d2 = $('#evHasta').value, s = $('#evSort').value;
  let list = EVID.filter(e => (!q || (empName(e.camp) + ' ' + ongName(EMPC.find(c => c.id === e.camp).ong)).toLowerCase().includes(q)) && (!d1 || e.fecha >= d1) && (!d2 || e.fecha <= d2));
  list.sort((a, b) => s === 'tipo' ? a.tipo.localeCompare(b.tipo) || a.fecha.localeCompare(b.fecha) : a.fecha.localeCompare(b.fecha));
  $('#evEmpty').hidden = list.length > 0;
  $('#evTable').innerHTML = list.map(e => {
    const st = estadoEv(e), c = EMPC.find(x => x.id === e.camp);
    const cel = st === 'ok' ? '<span class="badge badge--entregado"><span class="ms" aria-hidden="true">check</span>Consistente</span>'
      : st === 'rev' ? '<span class="badge badge--recibido"><span class="ms" aria-hidden="true">task_alt</span>Revisada</span>'
      : `<span class="badge badge--incidencia"><span class="ms" aria-hidden="true">warning</span>Inconsistente</span> <button class="btn btn-sm" type="button" data-rev="${e.id}">Revisar</button>`;
    return `<tr><td>${e.fecha}</td><td>${TIPOS[e.tipo]}</td><td>${esc(e.titulo)}</td><td>${esc(c.nombre)}</td><td>${esc(ongName(c.ong))}</td><td>${cel}</td></tr>`;
  }).join('');
  const n = EVID.filter(e => estadoEv(e) === 'bad').length;
  setMsg($('#evAlert'), n ? `${n} evidencia${n > 1 ? 's' : ''} fuera del cronograma acordado: requiere${n > 1 ? 'n' : ''} revisión manual.` : '', 'warn');
}
['#evQ', '#evDesde', '#evHasta', '#evSort'].forEach(s => $(s).addEventListener('input', renderEvid));
$('#evTable').addEventListener('click', e => {
  const b = e.target.closest('[data-rev]'); if (!b) return;
  EVID.find(x => x.id == b.dataset.rev).rev = true; renderEvid(); toast('Evidencia marcada como revisada manualmente');
});
$('#formBoleta').addEventListener('submit', e => {
  e.preventDefault(); const f = $('#bolFile').files[0], m = $('#bolMsg');
  if (!f) { setMsg(m, 'Selecciona un archivo para adjuntar.'); return; }
  if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) { setMsg(m, 'Formato no soportado. Formatos permitidos: PDF, JPG o PNG.'); return; }
  EVID.push({ id: EVID.length + 1, camp: $('#bolCamp').value, tipo: 'boleta', titulo: f.name, fecha: hoy(), rev: false });
  setMsg(m, 'Documento validado y vinculado a la campaña.', 'ok'); $('#bolFile').value = ''; renderEvid();
});

/* HU-029 reporte PDF + HU-031 paquete de auditoría */
function ultimaEntrega(c) { const f = EVID.filter(e => e.camp === c.id && e.tipo !== 'boleta').map(e => e.fecha).sort().pop(); return c.etapa === 3 && f ? f : 'Pendiente'; }
function generarReporte(c) {
  const t0 = performance.now();
  printDoc('Reporte ' + c.nombre, `<h1>Reporte de campaña: ${esc(c.nombre)}</h1><p>ONG: ${esc(ongName(c.ong))}</p><table><tr><th>Monto donado</th><td>${money(c.monto)}</td></tr><tr><th>Porcentaje ejecutado</th><td>${c.pct}%</td></tr><tr><th>Fecha de entrega</th><td>${ultimaEntrega(c)}</td></tr></table><p>Generado el ${hoy()} ${ahora()}</p>`);
  setMsg($('#repMsg'), `Reporte generado en ${((performance.now() - t0) / 1000).toFixed(1)} s.`, 'ok');
}
$('#btnRep').addEventListener('click', () => {
  const c = EMPC.find(x => x.id === $('#repCamp').value), m = $('#repMsg');
  if (!c.monto) {
    setMsg(m, 'Esta campaña no tiene datos suficientes de ejecución: el reporte estará incompleto. <br><button class="btn btn-sm" type="button" id="repForce">Generar igualmente</button>', 'warn', true);
    $('#repForce').addEventListener('click', () => generarReporte(c)); return;
  }
  generarReporte(c);
});
const auditLog = [];
function generarPaquete(c) {
  const docs = EVID.filter(e => e.camp === c.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
  auditLog.push(`${hoy()} ${ahora()} · ${c.nombre} · solicitado por ${(me() || {}).nombre || 'Analista RSC'}`);
  $('#audLog').innerHTML = auditLog.slice().reverse().map(l => `<li>${esc(l)}</li>`).join('');
  printDoc('Paquete auditoría ' + c.nombre, `<h1>Paquete de evidencia: ${esc(c.nombre)}</h1><p>Generado: ${hoy()} ${ahora()}</p><table><tr><th>Fecha</th><th>Tipo</th><th>Documento</th></tr>${docs.map(d => `<tr><td>${d.fecha}</td><td>${TIPOS[d.tipo]}</td><td>${esc(d.titulo)}</td></tr>`).join('')}</table>`);
  setMsg($('#audMsg'), 'Paquete generado y registrado en el historial de auditoría.', 'ok');
}
$('#btnAud').addEventListener('click', () => {
  const c = EMPC.find(x => x.id === $('#audCamp').value), m = $('#audMsg');
  const faltan = Object.keys(TIPOS).filter(t => !EVID.some(e => e.camp === c.id && e.tipo === t)).map(t => TIPOS[t]);
  if (faltan.length) {
    setMsg(m, `Evidencia incompleta. Faltan: ${faltan.join(', ')}.<br><button class="btn btn-sm" type="button" id="audForce">Generar igualmente</button>`, 'warn', true);
    $('#audForce').addEventListener('click', () => generarPaquete(c)); return;
  }
  generarPaquete(c);
});

/* ==========================================================
   ONG  (ong.html)
   ========================================================== */
const ongCampOptions = () => CAMPS.map(c => `<option value="${c.id}">${esc(c.titulo)}</option>`).join('');
const ongSelects = ['#rCamp', '#fCamp', '#dCamp', '#docCamp', '#repOngCamp'];
function refreshOngSelects() { ongSelects.forEach(s => { const v = $(s).value; $(s).innerHTML = ongCampOptions(); if (v) $(s).value = v; }); }

/* HU-033 registrar campaña */
$('#formCampana').addEventListener('submit', e => {
  e.preventDefault(); const m = $('#cMsg');
  const nombre = $('#cNombre').value.trim(), obj = $('#cObjetivo').value.trim(), meta = parseFloat($('#cMeta').value), fecha = $('#cFecha').value;
  const falta = !nombre ? ['Nombre', '#cNombre'] : !obj ? ['Objetivo', '#cObjetivo'] : !(meta > 0) ? ['Meta', '#cMeta'] : !fecha ? ['Fecha límite', '#cFecha'] : null;
  ['#cNombre', '#cObjetivo', '#cMeta', '#cFecha'].forEach(s => $(s).setAttribute('aria-invalid', 'false'));
  if (falta) { $(falta[1]).setAttribute('aria-invalid', 'true'); setMsg(m, `Falta completar el campo obligatorio: ${falta[0]}.`); $(falta[1]).focus(); return; }
  CAMPS.push({ id: 'cx' + Date.now(), titulo: nombre, cat: $('#cCat').value, ong: 'ong1', urg: 2, dist: 10, rec: 0, meta, benef: 0, video: false, uso: obj, custom: true });
  saveCustomCamps(); refreshOngSelects();
  setMsg(m, 'Campaña publicada: ya es visible en el catálogo para los donantes.', 'ok'); e.target.reset();
});
/* HU-034 donación recibida */
const recibidas = {};
$('#rTipo').addEventListener('change', e => { const b = e.target.value === 'bienes'; $('#rItemWrap').hidden = !b; $('#rValorLbl').textContent = b ? 'Cantidad' : 'Monto (S/)'; });
const INV = [
  { item: 'Abrigos', camp: 'c1', stock: 80, plan: 100 },
  { item: 'Kits de víveres', camp: 'c3', stock: 40, plan: 35 },
  { item: 'Útiles escolares', camp: 'c4', stock: 150, plan: 120 }
];
$('#formRecibida').addEventListener('submit', e => {
  e.preventDefault(); const m = $('#rMsg'), v = parseFloat($('#rValor').value), b = $('#rTipo').value === 'bienes', camp = CAMPS.find(c => c.id === $('#rCamp').value);
  if (!(v > 0)) { setMsg(m, 'Monto inválido: ingresa un valor mayor a cero.'); $('#rValor').focus(); return; }
  if (!$('#rDonante').value.trim()) { setMsg(m, 'Indica el nombre del donante.'); return; }
  if (b && !$('#rItem').value.trim()) { setMsg(m, 'Describe el bien recibido.'); return; }
  recibidas[camp.id] = (recibidas[camp.id] || 0) + 1;
  if (!b) addRec(camp, v); else { const it = INV.find(i => i.camp === camp.id && i.item.toLowerCase() === $('#rItem').value.trim().toLowerCase()); if (it) it.stock += v; else INV.push({ item: $('#rItem').value.trim(), camp: camp.id, stock: v, plan: 0 }); renderInv(); }
  setMsg(m, `Donación registrada. Comprobante de recepción emitido para ${$('#rDonante').value.trim()}.`, 'ok');
  $('#rTotales').textContent = `Total recaudado en «${camp.titulo}»: ${money(camp.rec)}`; $('#rValor').value = '';
  renderDocs();
});
/* HU-035 roles */
const ROLES = [{ n: 'Registrador', p: ['registrar'] }, { n: 'Aprobador', p: ['aprobar'] }, { n: 'Publicador', p: ['publicar'] }];
const COLABS = [{ n: 'Camila', r: 'Registrador' }, { n: 'Jorge', r: 'Aprobador' }, { n: 'Lucía', r: 'Publicador' }];
const rolesLog = [];
function renderRoles() {
  $('#asigRol').innerHTML = ROLES.map(r => `<option>${esc(r.n)}</option>`).join('');
  $('#asigColab').innerHTML = COLABS.map(c => `<option>${esc(c.n)} (${esc(c.r)})</option>`).join('');
  $('#rolesLog').innerHTML = rolesLog.length ? rolesLog.slice().reverse().map(l => `<li>${esc(l)}</li>`).join('') : '<li>Sin acciones registradas.</li>';
}
$('#formRol').addEventListener('submit', e => {
  e.preventDefault(); const n = $('#rolNombre').value.trim(), p = $$('input[name=perm]:checked').map(i => i.value), m = $('#rolMsg');
  if (!n || !p.length) { setMsg(m, 'Indica un nombre y al menos un permiso para el rol.'); return; }
  ROLES.push({ n, p }); setMsg(m, `Rol «${n}» creado con permisos: ${p.join(', ')}.`, 'ok'); renderRoles(); e.target.reset();
});
$('#btnAsignar').addEventListener('click', () => {
  const idx = $('#asigColab').selectedIndex; COLABS[idx].r = $('#asigRol').value;
  rolesLog.push(`${hoy()} ${ahora()} · ${COLABS[idx].n} ahora tiene el rol ${COLABS[idx].r}`); renderRoles();
  $('#asigColab').selectedIndex = idx; setMsg($('#permMsg'), 'Rol asignado.', 'ok');
});
$('#btnProbar').addEventListener('click', () => {
  const c = COLABS[$('#asigColab').selectedIndex], a = $('#permAccion').value, r = ROLES.find(x => x.n === c.r), ok = r && r.p.includes(a);
  rolesLog.push(`${hoy()} ${ahora()} · ${c.n} intentó «${a}»: ${ok ? 'permitido' : 'denegado'}`);
  setMsg($('#permMsg'), ok ? `${c.n} puede ${a}.` : `Permiso denegado: el rol ${c.r} no puede ${a}.`, ok ? 'ok' : 'err'); renderRoles();
  $('#asigColab').selectedIndex = COLABS.indexOf(c);
});
/* HU-036 inventario */
function renderInv() {
  $('#invBody').innerHTML = INV.map((i, k) => `<tr><th scope="row" style="background:none">${esc(i.item)}</th><td>${esc(campName(i.camp))}</td><td>${i.stock}</td><td>${i.plan}</td>
    <td><div style="display:flex;gap:8px"><label class="sr-only" for="ent${k}">Cantidad a entregar de ${esc(i.item)}</label><input type="number" id="ent${k}" min="1" style="width:90px"><button class="btn btn-sm" type="button" data-ent="${k}">Entregar</button></div></td></tr>`).join('');
  const bajos = INV.filter(i => i.stock < i.plan).map(i => i.item);
  setMsg($('#invAlert'), bajos.length ? `Stock bajo para la entrega planificada: ${bajos.join(', ')}.` : '', 'warn');
}
$('#invBody').addEventListener('click', e => {
  const b = e.target.closest('[data-ent]'); if (!b) return;
  const k = b.dataset.ent, q = parseInt($('#ent' + k).value, 10), i = INV[k];
  if (!(q > 0) || q > i.stock) { toast('Indica una cantidad válida (no mayor al stock).'); return; }
  i.stock -= q; state.distrib[i.camp] = (state.distrib[i.camp] || 0) + q; renderInv(); renderDocs(); toast(`Entrega registrada: ${q} ${i.item}. Inventario actualizado.`);
});
/* Actualizar etapas de las donaciones (la ONG avanza la etapa y el donante ve el cambio en su seguimiento) */
function renderEtapas() {
  $('#etBody').innerHTML = DONS.map(d => { const c = d.etapa; return `<tr><th scope="row" style="background:none">${d.codigo}</th><td>${esc(campName(d.camp))}</td><td>${esc(d.detalle)}</td>
    <td><span class="badge badge--${c < 0 ? 'recibido' : ETAPA_BADGE[c]}">${c < 0 ? 'En espera' : ETAPAS[c]}</span></td>
    <td>${c >= 3 ? '<span class="verified"><span class="ms" aria-hidden="true">verified</span>Entregada</span>' : `<button class="btn btn-sm" type="button" data-adv="${d.codigo}">Avanzar a «${ETAPAS[c + 1]}»</button>`}</td></tr>`; }).join('');
}
$('#etBody').addEventListener('click', e => { const b = e.target.closest('[data-adv]'); if (b) avanzar(DONS.find(x => x.codigo === b.dataset.adv)); });

/* HU-037 captura de fotos + HU-047 modo sin conexión */
const FOTOS = [];
const offline = () => $('#offlineToggle').checked || !navigator.onLine;
function renderFotos() {
  $('#fotoList').innerHTML = FOTOS.length ? FOTOS.map(f => `<li>${esc(campName(f.camp))} · ${f.fecha} ${f.hora} · ${f.sync ? '<span class="verified">Sincronizada</span>' : '<strong>Pendiente de sincronizar</strong>'}</li>`).join('') : '<li>Aún no hay fotos capturadas.</li>';
  const p = FOTOS.filter(f => !f.sync).length;
  setMsg($('#syncBar'), offline() ? `Sin conexión: la evidencia se guarda en el dispositivo (${p} pendiente${p === 1 ? '' : 's'}).` : p ? `${p} evidencia${p > 1 ? 's' : ''} pendiente${p > 1 ? 's' : ''} de sincronizar.` : '', 'warn');
}
function sincronizar() {
  if (offline()) { renderFotos(); return; }
  const p = FOTOS.filter(f => !f.sync); p.forEach(f => { f.sync = true; });
  renderFotos(); renderDocs(); if (p.length) toast(`${p.length} evidencia${p.length > 1 ? 's' : ''} sincronizada${p.length > 1 ? 's' : ''}.`);
}
$('#fFoto').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    FOTOS.push({ camp: $('#fCamp').value, fecha: hoy(), hora: ahora(), src: r.result, sync: false });
    sincronizar(); renderFotos(); e.target.value = '';
    toast(offline() ? 'Sin conexión: foto guardada localmente.' : 'Foto asociada a fecha, hora y campaña.');
  };
  r.readAsDataURL(file);
});
$('#offlineToggle').addEventListener('change', sincronizar);
window.addEventListener('online', sincronizar); window.addEventListener('offline', renderFotos);

/* Firma del beneficiario (canvas) */
const cv = $('#sigCanvas'), ctx = cv.getContext('2d'); let dibujando = false, firmado = false, firmaGuardada = false;
ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#5A3A1A';
const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
cv.addEventListener('pointerdown', e => { dibujando = true; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { if (!dibujando) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); firmado = true; });
['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, () => { dibujando = false; }));
$('#btnSigClear').addEventListener('click', () => { ctx.clearRect(0, 0, cv.width, cv.height); firmado = false; firmaGuardada = false; setMsg($('#sigMsg'), ''); });
$('#btnSigSave').addEventListener('click', () => {
  if (!firmado) { setMsg($('#sigMsg'), 'Dibuja la firma del beneficiario antes de guardarla.', 'err'); return; }
  firmaGuardada = true; setMsg($('#sigMsg'), 'Firma guardada y vinculada al acta de entrega.', 'ok');
});

/* HU-040 discrepancias */
const discs = [];
$('#formDisc').addEventListener('submit', e => {
  e.preventDefault(); const m = $('#dMsg'), mot = $('#dMotivo').value.trim();
  if (!mot) { $('#dMotivo').setAttribute('aria-invalid', 'true'); setMsg(m, 'Indica el motivo de la discrepancia para registrarla.'); $('#dMotivo').focus(); return; }
  $('#dMotivo').setAttribute('aria-invalid', 'false');
  const estado = $('#dTipo').value === 'parcial' ? 'Entrega parcial' : 'Reprogramada';
  discs.push({ camp: $('#dCamp').value, estado, mot, f: hoy() + ' ' + ahora() });
  setMsg(m, `Estado actualizado a «${estado}». Se notificó al coordinador.`, 'ok'); toast('Coordinador notificado de la discrepancia');
  $('#discList').innerHTML = discs.slice().reverse().map(d => `<li><span class="badge badge--incidencia">${d.estado}</span> ${esc(campName(d.camp))} · ${d.f}<br>${esc(d.mot)}</li>`).join('');
  $('#dMotivo').value = '';
});

/* HU-042 documentación, HU-039 acta, HU-044 reporte */
function renderDocs() {
  const id = $('#docCamp').value; if (!id) return;
  const fotos = FOTOS.filter(f => f.camp === id && f.sync).length, acta = !!state.actas[id], comp = (recibidas[id] || 0) + DONS.filter(d => d.user && d.camp === id).length;
  const falta = []; if (!fotos) falta.push('fotos de entrega'); if (!acta) falta.push('acta de entrega'); if (!comp) falta.push('comprobantes de recepción');
  $('#docView').innerHTML = `<ul class="list"><li>Fotos de entrega: <strong>${fotos}</strong></li><li>Acta de entrega: <strong>${acta ? 'Generada' : 'Pendiente'}</strong></li><li>Comprobantes de recepción: <strong>${comp}</strong></li></ul>
    <p class="msg ${falta.length ? 'warn' : 'ok'}" style="margin-top:10px">${falta.length ? 'Falta para cerrar la campaña: ' + falta.join(', ') + '.' : 'Documentación completa: la campaña puede cerrarse.'}</p>`;
}
$('#docCamp').addEventListener('change', renderDocs);
$('#btnActa').addEventListener('click', () => {
  const id = $('#docCamp').value, m = $('#actaMsg'), fotos = FOTOS.filter(f => f.camp === id);
  const falta = []; if (!fotos.length) falta.push('al menos una foto de la entrega'); if (!firmaGuardada) falta.push('la firma del beneficiario');
  if (falta.length) { setMsg(m, 'No se puede generar el acta. Falta: ' + falta.join(' y ') + '.'); return; }
  state.actas[id] = true; renderDocs();
  printDoc('Acta de entrega', `<h1>Acta de entrega</h1><p><strong>Campaña:</strong> ${esc(campName(id))}</p><p><strong>Fecha:</strong> ${hoy()} ${ahora()}</p><h3>Evidencia fotográfica</h3>${fotos.map(f => `<img src="${f.src}" alt="Foto de entrega ${f.fecha}">`).join('')}<h3>Firma del beneficiario</h3><img src="${cv.toDataURL()}" alt="Firma del beneficiario">`);
  setMsg(m, 'Acta generada en PDF y vinculada a la campaña.', 'ok');
});
function generarReporteOng(id) {
  const c = CAMPS.find(x => x.id === id), dist = state.distrib[id] || 0;
  state.reportes[id] = true; store.set('reportes', state.reportes);
  printDoc('Reporte de transparencia', `<h1>Reporte de transparencia: ${esc(c.titulo)}</h1><table><tr><th>Monto recaudado</th><td>${money(c.rec)}</td></tr><tr><th>Bienes distribuidos</th><td>${dist} unidades</td></tr><tr><th>Evidencias asociadas</th><td>${FOTOS.filter(f => f.camp === id).length} fotos${state.actas[id] ? ' + acta de entrega' : ''}</td></tr></table><p>Generado: ${hoy()} ${ahora()}</p>`);
  setMsg($('#repOngMsg'), 'Reporte generado en PDF y visible para los donantes de la campaña.', 'ok');
}
$('#btnRepOng').addEventListener('click', () => {
  const id = $('#repOngCamp').value, m = $('#repOngMsg');
  if (!(state.distrib[id] > 0)) {
    setMsg(m, 'Esta campaña aún no tiene datos de distribución: el reporte estará incompleto.<br><button class="btn btn-sm" type="button" id="repOngForce">Generar igualmente</button>', 'warn', true);
    $('#repOngForce').addEventListener('click', () => generarReporteOng(id)); return;
  }
  generarReporteOng(id);
});

/* ---------- Inicialización por página ---------- */
if (P === 'campanas') renderCampanas();
if (P === 'seguimiento') { renderMyDonationCodes(); const c = new URLSearchParams(location.search).get('codigo'); if (c) { $('#codigo').value = c; buscar(c); } }
if (P === 'panel-donante') renderPanelDonante();
if (P === 'empresas') {
  renderPanel(); renderCrono(); renderNotifs();
  setInterval(() => { // avance en tiempo real (simulado)
    EMPC.forEach(c => { if (c.pct < 100 && Math.random() > .5) { c.pct++; if (c.pct >= 100) c.etapa = 3; } });
    renderPanel();
  }, 10000);
}
if (P === 'ong') { refreshOngSelects(); renderRoles(); renderInv(); renderFotos(); renderDocs(); renderEtapas(); }
renderBell();
})();
