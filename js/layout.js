/* DonaTrack | layout.js — encabezado, pie, modales, protección de rutas y navegación por perfil */
(function () {
  'use strict';
  const A = window.Auth, u = A.current(), b = document.body, need = b.dataset.auth;
  const file = location.pathname.split('/').pop() || 'index.html';
  if (need && (!u || u.role !== need)) { // ruta privada
    window.DT_STOP = true; document.documentElement.style.visibility = 'hidden';
    location.replace(u ? A.home(u.role) : 'login.html?next=' + encodeURIComponent(file)); return;
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const base = [['index.html', 'Inicio'], ['campanas.html', 'Campañas'], ['seguimiento.html', 'Seguimiento'], ['como-funciona.html', 'Cómo funciona']];
  const NAV = {
    public: base,
    donante: [base[0], ['panel-donante.html', 'Mi panel'], ...base.slice(1)],
    empresa: [base[0], ['empresas.html', 'Panel RSC'], ...base.slice(1)],
    ong: [base[0], ['ong.html', 'Panel ONG'], base[1], base[3]]
  };
  const act = h => h === file ? ' class="is-active" aria-current="page"' : '';
  const nav = NAV[u ? u.role : 'public'].map(([h, t]) => `<a href="${h}"${act(h)}>${t}</a>`).join('');
  const bell = b.hasAttribute('data-main') ? '<button class="btn btn-secondary btn-icon bell" id="bellBtn" type="button" aria-label="Notificaciones por etapa"><span class="ms" aria-hidden="true">notifications</span><span class="bell__dot" id="bellDot" hidden>0</span></button>' : '';
  const tools = bell + (u
    ? `<span class="tag hide-md">${A.ROLES[u.role]}</span><a class="btn user" href="${A.home(u.role)}" aria-label="Ir a mi panel, sesión de ${esc(u.nombre)}"><span class="ms" aria-hidden="true">account_circle</span><span class="user__name">${esc(u.nombre)}</span></a><button class="btn btn-icon" id="logoutBtn" type="button" aria-label="Cerrar sesión"><span class="ms" aria-hidden="true">logout</span></button>`
    : `<a class="btn header-auth" href="login.html" aria-label="Iniciar sesión"><span class="ms" aria-hidden="true">login</span><span class="header-auth__label">Iniciar sesión</span></a><a class="btn btn-primary header-auth" href="registro.html" aria-label="Crear cuenta"><span class="ms" aria-hidden="true">person_add</span><span class="header-auth__label">Crear cuenta</span></a>`);
  document.getElementById('siteHeader').outerHTML = `<header class="header"><div class="container header__in">
    <a class="logo" href="index.html" aria-label="DonaTrack, ir al inicio"><span class="logo__mark" aria-hidden="true">D</span>DonaTrack</a>
    <nav class="nav" id="mainNav" aria-label="Navegación principal">${nav}</nav>
    <div class="header__tools">${tools}<button class="btn btn-icon burger" id="navToggle" type="button" aria-expanded="false" aria-controls="mainNav" aria-label="Abrir menú"><span class="ms" aria-hidden="true">menu</span></button></div></div></header>`;
  document.getElementById('siteFooter').outerHTML = `<footer class="footer"><div class="container footer__grid">
    <div><p class="logo" style="color:var(--crema)"><span class="logo__mark" aria-hidden="true">D</span>DonaTrack</p><p class="small" style="margin-top:8px">Ser la plataforma de referencia en Latinoamérica para la trazabilidad de donaciones.</p></div>
    <nav aria-label="Secciones"><h4>Secciones</h4><ul><li><a href="index.html">Inicio</a></li><li><a href="campanas.html">Campañas</a></li><li><a href="seguimiento.html">Seguimiento</a></li><li><a href="como-funciona.html">Cómo funciona</a></li>${u ? `<li><a href="${A.home(u.role)}">Mi panel</a></li>` : '<li><a href="login.html">Iniciar sesión</a></li><li><a href="registro.html">Crear cuenta</a></li>'}</ul></nav>
    <div><h4>Proyecto</h4><p class="small">HCI for UX Design · 1ASI0784<br>UPC · Ciclo 2026-20</p></div></div></footer>`;
  if (b.hasAttribute('data-main')) {
    const close = '<button class="btn btn-icon modal__close" type="button" data-close aria-label="Cerrar"><span class="ms" aria-hidden="true">close</span></button>';
    b.insertAdjacentHTML('beforeend', `
<div class="modal" id="modalDetalle" role="dialog" aria-modal="true" aria-labelledby="detTitulo" hidden><div class="modal__box">${close}<h2 id="detTitulo"></h2><div id="detBody"></div></div></div>
<div class="modal" id="modalDonar" role="dialog" aria-modal="true" aria-labelledby="donTitulo" hidden><div class="modal__box">${close}<h2 id="donTitulo">Donar</h2>
  <div class="chips" role="group" aria-label="Tipo de donación" style="margin-bottom:16px"><button class="chip" type="button" id="tabDinero" aria-pressed="true"><span class="ms" aria-hidden="true">payments</span>Dinero</button><button class="chip" type="button" id="tabBienes" aria-pressed="false"><span class="ms" aria-hidden="true">inventory_2</span>Bienes físicos</button></div>
  <form class="form" id="formDinero" novalidate><div class="field"><label for="monto">Monto (S/)</label><input type="number" id="monto" min="1" step="any" inputmode="decimal"></div>
    <fieldset><legend>Método de pago</legend><div class="radios"><label><input type="radio" name="metodo" value="Yape" checked>Yape</label><label><input type="radio" name="metodo" value="Plin">Plin</label><label><input type="radio" name="metodo" value="Transferencia">Transferencia</label></div></fieldset>
    <label class="check small"><input type="checkbox" id="simRechazo">Simular pago rechazado (demostración)</label>
    <button class="btn btn-primary" type="submit"><span class="ms" aria-hidden="true">favorite</span>Donar</button><p class="msg" id="errDinero" role="alert"></p></form>
  <form class="form" id="formBienes" novalidate hidden><div class="field"><label for="tipoBien">Tipo de bien</label><select id="tipoBien"><option>Ropa</option><option>Alimentos</option><option>Útiles escolares</option><option>Abrigos</option></select></div>
    <div class="field"><label for="cantBien">Cantidad</label><input type="number" id="cantBien" min="1" step="1"></div>
    <div class="field"><label for="puntoEntrega">Punto de entrega acordado</label><select id="puntoEntrega"><option>Centro de acopio Lima Centro</option><option>Centro de acopio Miraflores</option><option>Centro de acopio San Juan de Lurigancho</option></select></div>
    <button class="btn btn-primary" type="submit">Registrar donación</button><p class="msg" id="errBienes" role="alert"></p></form>
  <div id="donarResultado" aria-live="polite" style="margin-top:16px"></div></div></div>
<div class="modal" id="lightbox" role="dialog" aria-modal="true" aria-labelledby="lbTitulo" hidden><div class="modal__box">${close}<h2 id="lbTitulo">Evidencia</h2><div id="lbBody"></div></div></div>
<div class="modal" id="modalNotif" role="dialog" aria-modal="true" aria-labelledby="notTitulo" hidden><div class="modal__box">${close}<h2 id="notTitulo">Notificaciones</h2><ul class="list" id="bellList"></ul></div></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`);
  }
  /* menú móvil */
  const tg = document.getElementById('navToggle'), mn = document.getElementById('mainNav');
  const setNav = o => { mn.classList.toggle('is-open', o); tg.setAttribute('aria-expanded', o); tg.querySelector('.ms').textContent = o ? 'close' : 'menu'; };
  tg.addEventListener('click', () => setNav(!mn.classList.contains('is-open')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && mn.classList.contains('is-open')) { setNav(false); tg.focus(); } });
  const lo = document.getElementById('logoutBtn'); if (lo) lo.addEventListener('click', () => { A.logout(); location.href = 'index.html'; });
  /* tarjetas de perfil: si ya hay sesión del mismo perfil, entran a su panel */
  document.querySelectorAll('[data-perfil]').forEach(a => { if (u && a.dataset.perfil === u.role) a.href = A.home(u.role); });
  document.querySelectorAll('[data-user-name]').forEach(n => { if (u) n.textContent = u.nombre; });
  /* transición suave entre páginas */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const h = a.getAttribute('href'); if (!/^[\w-]+\.html/.test(h) || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    e.preventDefault(); b.classList.add('leaving'); setTimeout(() => { location.href = a.href; }, 150);
  });
  addEventListener('pageshow', () => b.classList.remove('leaving'));
})();
