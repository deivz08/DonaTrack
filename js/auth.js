/* DonaTrack | auth.js — registro e inicio de sesión SIMULADOS con localStorage (prototipo, sin backend:
   no es autenticación real ni segura; las contraseñas solo se ofuscan con un hash simple). */
(function () {
  'use strict';
  const L = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const S = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();
  const rd = (st, k) => { try { const v = st.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  const wr = (st, k, v) => { try { st.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const rm = (st, k) => { try { st.removeItem(k); } catch (e) { /* nada */ } };
  const hash = s => { let a = 5381, b = 52711; for (const c of 'dt::' + s) { const n = c.charCodeAt(0); a = ((a * 33) ^ n) >>> 0; b = ((b * 31) + n * 7) >>> 0; } return a.toString(16) + b.toString(16); };
  const HOME = { donante: 'panel-donante.html', empresa: 'empresas.html', ong: 'ong.html' };
  const ROLES = { donante: 'Donante', empresa: 'Empresa (RSC)', ong: 'Organización (ONG)' };
  const norm = e => String(e).trim().toLowerCase();
  const users = () => rd(L, 'dt_users') || [];
  const NOSTORE = 'Tu navegador bloquea el almacenamiento local, necesario para este prototipo.';
  const Auth = {
    ROLES, home: r => HOME[r] || 'index.html',
    current() {
      const s = rd(S, 'dt_session') || rd(L, 'dt_session'); if (!s) return null;
      const u = users().find(x => x.email === s.email); return u ? { nombre: u.nombre, email: u.email, role: u.role, celular: u.celular, ruc: u.ruc || '' } : null;
    },
    register(d) {
      const email = norm(d.email), list = users();
      if (list.some(u => u.email === email)) return { ok: false, field: 'email', error: 'Este correo ya está registrado. Inicia sesión o usa otro correo.' };
      if (d.role === 'empresa' && list.some(u => u.role === 'empresa' && u.ruc === d.ruc)) return { ok: false, field: 'ruc', error: 'Este RUC ya está registrado.' };
      list.push({ nombre: d.nombre.trim(), email, celular: d.celular, role: d.role, ruc: d.role === 'empresa' ? d.ruc : '', pass: hash(d.password), creado: new Date().toISOString() });
      return wr(L, 'dt_users', list) ? { ok: true } : { ok: false, error: NOSTORE };
    },
    login(email, pass, remember) {
      const u = users().find(x => x.email === norm(email));
      if (!u) return { ok: false, error: 'No encontramos una cuenta con ese correo. Verifica el correo o crea tu cuenta.' };
      if (u.pass !== hash(pass)) return { ok: false, error: 'La contraseña es incorrecta. Inténtalo de nuevo.' };
      rm(S, 'dt_session'); rm(L, 'dt_session');
      if (!wr(remember ? L : S, 'dt_session', { email: u.email })) return { ok: false, error: NOSTORE };
      return { ok: true, user: { nombre: u.nombre, email: u.email, role: u.role } };
    },
    logout() { rm(S, 'dt_session'); rm(L, 'dt_session'); },
    reset(email, pass) {
      const list = users(), u = list.find(x => x.email === norm(email));
      if (!u) return { ok: false, error: 'No existe una cuenta con ese correo.' };
      u.pass = hash(pass); return wr(L, 'dt_users', list) ? { ok: true } : { ok: false, error: NOSTORE };
    }
  };
  window.Auth = Auth;

  /* ---------- Formularios (login, registro, recuperar) ---------- */
  const page = document.body.dataset.page, $ = s => document.querySelector(s), q = new URLSearchParams(location.search);
  if (!['login', 'registro', 'recuperar'].includes(page)) return;
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const bad = [];
  const fe = (id, msg) => { const i = $('#' + id), e = $('#' + id + 'Err'); if (i) i.setAttribute('aria-invalid', msg ? 'true' : 'false'); if (e) e.textContent = msg || ''; if (msg) bad.push(i); };
  const banner = (t, type) => { const m = $('#formMsg'); m.className = 'msg ' + (t ? type : ''); m.textContent = t || ''; };
  const done = () => { if (bad.length) { bad[0].focus(); } const ok = !bad.length; bad.length = 0; return ok; };
  const pwOk = p => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
  document.querySelectorAll('[data-pass]').forEach(b => b.addEventListener('click', () => {
    const i = $('#' + b.dataset.pass), show = i.type === 'password'; i.type = show ? 'text' : 'password';
    b.setAttribute('aria-pressed', show); b.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña'); b.querySelector('.ms').textContent = show ? 'visibility_off' : 'visibility';
  }));
  const me = Auth.current();
  if (me && page !== 'recuperar') { location.replace(Auth.home(me.role)); return; }

  if (page === 'login') {
    if (q.get('registrado')) { banner('¡Cuenta creada! Ahora inicia sesión con tu correo y contraseña.', 'ok'); $('#email').value = q.get('email') || ''; }
    if (q.get('reset')) { banner('Contraseña actualizada. Inicia sesión con la nueva contraseña.', 'ok'); $('#email').value = q.get('email') || ''; }
    if (q.get('next')) banner('Inicia sesión para acceder a esa página.', 'warn');
    $('#formLogin').addEventListener('submit', e => {
      e.preventDefault(); banner('');
      const em = $('#email').value.trim(), pw = $('#password').value;
      fe('email', !em ? 'Ingresa tu correo electrónico.' : !EMAIL.test(em) ? 'Escribe un correo válido, por ejemplo nombre@correo.com.' : '');
      fe('password', pw ? '' : 'Ingresa tu contraseña.');
      if (!done()) return;
      const r = Auth.login(em, pw, $('#remember').checked);
      if (!r.ok) { banner(r.error, 'err'); return; }
      const n = q.get('next'), priv = { 'panel-donante.html': 'donante', 'empresas.html': 'empresa', 'ong.html': 'ong' };
      location.href = n && /^[a-z-]+\.html$/.test(n) && (!priv[n] || priv[n] === r.user.role) ? n : Auth.home(r.user.role);
    });
  }
  if (page === 'registro') {
    const t = q.get('tipo'), r0 = t && ROLES[t] && $('input[name=tipo][value=' + t + ']'); if (r0) r0.checked = true;
    const rucField = $('#rucField'), rucInput = $('#ruc');
    const syncRoleFields = () => { const isCompany = $('input[name=tipo]:checked')?.value === 'empresa'; rucField.hidden = !isCompany; if (!isCompany) { rucInput.value = ''; fe('ruc', ''); } };
    document.querySelectorAll('input[name=tipo]').forEach(el => el.addEventListener('change', syncRoleFields));
    syncRoleFields();
    $('#formRegistro').addEventListener('submit', e => {
      e.preventDefault(); banner('');
      const d = { nombre: $('#nombre').value.trim(), email: $('#email').value.trim(), celular: $('#celular').value.replace(/[\s-]/g, ''), password: $('#password').value, ruc: $('#ruc').value.replace(/\D/g, '') };
      const tipo = $('input[name=tipo]:checked');
      fe('nombre', d.nombre.split(/\s+/).filter(Boolean).length < 2 ? 'Ingresa tu nombre completo (nombre y apellido).' : '');
      fe('email', !d.email ? 'Ingresa tu correo electrónico.' : !EMAIL.test(d.email) ? 'Escribe un correo válido, por ejemplo nombre@correo.com.' : '');
      fe('celular', /^9\d{8}$/.test(d.celular) ? '' : 'Ingresa un celular de 9 dígitos que empiece con 9.');
      fe('password', pwOk(d.password) ? '' : 'Usa al menos 8 caracteres, con letras y números.');
      fe('confirm', $('#confirm').value === d.password && $('#confirm').value ? '' : 'Las contraseñas no coinciden.');
      fe('tipo', tipo ? '' : 'Selecciona el tipo de usuario.');
      fe('ruc', tipo?.value === 'empresa' && !/^\d{11}$/.test(d.ruc) ? 'Ingresa un RUC válido de 11 dígitos.' : '');
      fe('terms', $('#terms').checked ? '' : 'Debes aceptar los términos y condiciones.');
      if (!done()) return;
      d.role = tipo.value; const r = Auth.register(d);
      if (!r.ok) { if (r.field) { fe(r.field, r.error); done(); } else banner(r.error, 'err'); return; }
      banner('Cuenta creada correctamente. Te llevamos al inicio de sesión…', 'ok');
      setTimeout(() => { location.href = 'login.html?registrado=1&email=' + encodeURIComponent(d.email); }, 900);
    });
  }
  if (page === 'recuperar') {
    $('#formReset').addEventListener('submit', e => {
      e.preventDefault(); banner('');
      const em = $('#email').value.trim(), pw = $('#password').value;
      fe('email', EMAIL.test(em) ? '' : 'Escribe un correo válido.');
      fe('password', pwOk(pw) ? '' : 'Usa al menos 8 caracteres, con letras y números.');
      fe('confirm', $('#confirm').value === pw && pw ? '' : 'Las contraseñas no coinciden.');
      if (!done()) return;
      const r = Auth.reset(em, pw);
      if (!r.ok) { banner(r.error, 'err'); return; }
      location.href = 'login.html?reset=1&email=' + encodeURIComponent(em);
    });
  }
})();
