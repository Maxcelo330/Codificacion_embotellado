/* =====================================================================
   CARBONATACIÓN & BRIX · PWA · Calidad Embotellado · Embol S.A.
   1) Producto → solo se muestran los parámetros que ese producto tiene
   2) Presión + temperatura → CO₂ corregido · °Brix · otros parámetros
   3) Producción: orden + tanque + muestras a sensorial cada 4 h
   4) Tabla horaria con orden/tanque · gráficas · exportación completa
   ===================================================================== */
'use strict';

/* ══════════════════ 1 · FÓRMULAS (réplica exacta de la planilla) ══════════════════ */

function co2Actual(P, T, cP, cT) {                    // celda C8
  const TK = T + cP + 273.16, Pa = (cT + P) / 14.69595;
  return ((0.01898 - 0.000047591 * TK) * (Pa + 1) * TK) / ((0.03275 * TK) - 7.9567) + 0.0002607 * TK * Pa;
}
function co2Corregida(P, T, cP, cT) {                 // celda D8 — CARBONATACIÓN corregida
  const TKd = (T + cT) + cP + 273.16, TKa = T + cP + 273.16;
  const PaD = (cT + (P + cP)) / 14.69595, PaC = (cT + P) / 14.69595;
  return ((0.01898 - 0.000047591 * TKd) * (PaD + 1) * TKa) / ((0.03275 * TKa) - 7.9567) + 0.0002607 * TKa * PaC;
}
function deltaBrix(jtActual, jtFresco) {              // 0,2282·(JT actual − JT fresco)
  return (0.2282 * jtActual - 2.1435) - (0.2282 * jtFresco - 2.1435);
}

/* Estado vs especificación: ok / warn (10 % del rango pegado al borde) / bad */
function evaluar(v, lei, les) {
  if (!isFinite(v)) return null;
  if (lei != null && v < lei) return 'bad';
  if (les != null && v > les) return 'bad';
  if (lei != null && les != null) {
    const m = (les - lei) * 0.10;
    if (v < lei + m || v > les - m) return 'warn';
  }
  return 'ok';
}
const TXT_ESTADO = { ok: 'DENTRO DE ESPECIFICACIÓN', warn: 'DENTRO, PERO AL LÍMITE', bad: 'FUERA DE ESPECIFICACIÓN' };
const MS_CICLO = SENSORIAL_INTERVALO * 3600000;       // 4 horas

/* ══════════════════ 2 · UTILIDADES ══════════════════ */

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  let s = String(v ?? '').trim().replace(/[\s ]/g, '');
  if (!s) return NaN;
  s = s.replace(/[^0-9.,\-]/g, '');
  const c = s.lastIndexOf(','), p = s.lastIndexOf('.');
  if (c > -1 && p > -1) s = c > p ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (c > -1) s = s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}
function fmt(v, dec = 2) {
  if (v == null || !isFinite(v)) return '—';
  return Number(v).toLocaleString('es-BO', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: false });
}
const fx = v => v == null ? '—' : String(v).replace('.', ',');
function hoyISO() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
function ahoraLocal() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
function fFecha(ts) { const d = new Date(ts); return isNaN(d) ? '—' : d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function fHora(ts)  { const d = new Date(ts); return isNaN(d) ? '—' : d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }); }
function fechaISO(d) { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }

let toastT;
function toast(msg, tipo = '') {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show ' + tipo;
  clearTimeout(toastT); toastT = setTimeout(() => t.className = 'toast ' + tipo, 3200);
}

/* Sonido de aviso (tres pitidos) */
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ctx.currentTime;
    [0, 0.4, 0.8].forEach(off => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, t0 + off);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + off + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + off + 0.32);
      o.start(t0 + off); o.stop(t0 + off + 0.34);
    });
  } catch {}
}

/* ══════════════════ 3 · ALMACENAMIENTO ══════════════════ */

const LS = {
  leer(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  escribir(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('No se pudo guardar en el celular', 'bad'); } }
};

const K = {
  estado:     'carbo:estado',
  mediciones: 'carbo:mediciones',
  muestras:   'carbo:muestras',
  tanques:    'carbo:tanques',
  produccion: 'carbo:produccion',
  config:     'carbo:config'
};

let S = { cat: 'COCA-COLA', prod: 'Coca-Cola', pack: 0, view: 'medicion',
          p: '', t: '', corrP: CORR_DEF.p, corrT: CORR_DEF.t,
          bx: '', jtF: '', jtA: '', dens: '', otros: {}, verif: {} };
Object.assign(S, LS.leer(K.estado, {}));

let MEDICIONES = LS.leer(K.mediciones, []);
let MUESTRAS = LS.leer(K.muestras, []);
let TANQUES = LS.leer(K.tanques, []);
let PROD = Object.assign({ activa: false }, LS.leer(K.produccion, {}));
let CFG = Object.assign({ sensAvisos: false, analista: '' }, LS.leer(K.config, {}));

const guardarEstado = () => LS.escribir(K.estado, S);
const guardarCfg = () => LS.escribir(K.config, CFG);
const guardarProd = () => LS.escribir(K.produccion, PROD);
const nuevoId = lista => (lista.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;

function prodActual() { return DB.find(x => x.cat === S.cat && x.prod === S.prod) || DB[0]; }
function packActual() { const p = prodActual(); return p.co2.length ? p.co2[Math.min(S.pack, p.co2.length - 1)] : null; }

const TIPO_MUESTRA = { arranque: 'ARRANQUE', cambio: 'CAMBIO DE TANQUE', '4h': 'CICLO 4 H' };

/* ══════════════════ 4 · NAVEGACIÓN ══════════════════ */

$$('.tab').forEach(t => t.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.remove('active'));
  $$('.view').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $('#view-' + t.dataset.view).classList.add('active');
  window.scrollTo(0, 0);
  S.view = t.dataset.view; guardarEstado();
  if (t.dataset.view === 'registros') { renderMediciones(); renderTanques(); contarExport(); renderGrafica(); renderAvisoRespaldo(); }
  if (t.dataset.view === 'produccion') { renderProduccion(); }
}));

/* ══════════════════ 5 · SELECTORES DE PRODUCTO ══════════════════ */

function iniciarSelectores() {
  const cats = [...new Set(DB.map(x => x.cat))];
  $('#selCategoria').innerHTML = cats.map(c => `<option ${c === S.cat ? 'selected' : ''}>${c}</option>`).join('');
  llenarProductos();
}
function llenarProductos() {
  const prods = DB.filter(x => x.cat === S.cat);
  if (!prods.some(x => x.prod === S.prod)) S.prod = prods[0].prod;
  $('#selProducto').innerHTML = prods.map(p => `<option ${p.prod === S.prod ? 'selected' : ''}>${p.prod}</option>`).join('');
  llenarEmpaques();
}
function llenarEmpaques() {
  const p = prodActual();
  if (p.co2.length) {
    $('#divEmpaque').style.display = '';
    if (S.pack >= p.co2.length) S.pack = 0;
    $('#selEmpaque').innerHTML = p.co2.map((c, i) =>
      `<option value="${i}" ${i === S.pack ? 'selected' : ''}>${c.pack} — CO₂ obj. ${fx(c.obj)}</option>`).join('');
  } else $('#divEmpaque').style.display = 'none';
  refrescarTodo();
}
$('#selCategoria').addEventListener('change', e => { S.cat = e.target.value; S.prod = ''; llenarProductos(); guardarEstado(); });
$('#selProducto').addEventListener('change', e => { S.prod = e.target.value; S.pack = 0; llenarEmpaques(); guardarEstado(); });
$('#selEmpaque').addEventListener('change', e => { S.pack = +e.target.value; refrescarTodo(); guardarEstado(); });

/* ══════════════════ 6 · RENDER DE MEDICIÓN ══════════════════ */

function gauge(pref, v, lei, obj, les) {
  const g = $('#' + pref + 'Gauge');
  if (!isFinite(v) || lei == null || les == null) { g.hidden = true; return; }
  g.hidden = false;
  const span = les - lei, min = lei - span * 0.5, max = les + span * 0.5;
  const pos = Math.max(2, Math.min(98, (v - min) / (max - min) * 100));
  $('#' + pref + 'Mark').style.left = pos + '%';
  $('#' + pref + 'GLei').textContent = 'LEI ' + fx(lei);
  $('#' + pref + 'GObj').textContent = fx(obj);
  $('#' + pref + 'GLes').textContent = 'LES ' + fx(les);
}
function veredicto(pref, est, det) {
  const v = $('#' + pref + 'Veredicto');
  if (!est) { v.hidden = true; return; }
  v.hidden = false;
  v.className = 'veredicto ' + est;
  $('#' + pref + 'Msg').textContent = TXT_ESTADO[est];
  $('#' + pref + 'Det').textContent = det || '';
}

function chipsSpecs() {
  const p = prodActual(), c = packActual();
  let h = '';
  if (c) h += `<div class="spec hi"><span>CO₂ objetivo</span><b>${fx(c.obj)}</b><i>v/v</i></div>`;
  if (p.brix) h += `<div class="spec hi"><span>°Brix objetivo</span><b>${fx(p.brix.obj)}</b><i>°Bx</i></div>`;
  if (c) h += `<div class="spec"><span>CO₂ · LEI – LES</span><b>${fx(c.lei)} – ${fx(c.les)}</b></div>`;
  if (p.brix) h += `<div class="spec"><span>°Brix · LEI – LES</span><b>${fx(p.brix.lei)} – ${fx(p.brix.les)}</b></div>`;
  p.otros.forEach(o => {
    h += `<div class="spec"><span>${o.n}</span><b>${fx(o.lei)} – ${fx(o.les)}</b></div>`;
  });
  $('#chipsSpecs').innerHTML = h;
}

/* Numera solo los pasos visibles (1, 2, 3…) */
function renumerarPasos() {
  let n = 0;
  $$('#view-medicion .card.step').forEach(c => {
    if (c.hidden) return;
    const sn = c.querySelector('.step-n');
    if (sn) sn.textContent = ++n;
  });
}

function refrescarCO2() {
  const p = prodActual();
  if (!p.co2.length) { S._co2 = NaN; return; }          // producto sin CO₂: tarjeta oculta
  const P = num(S.p), T = num(S.t), cP = num(S.corrP) || 0, cT = num(S.corrT) || 0;
  const c = packActual();
  const card = $('#resCO2Card');
  $('#co2Lims').hidden = !c;
  if (c) { $('#co2Lei').textContent = fx(c.lei); $('#co2Obj').textContent = fx(c.obj); $('#co2Les').textContent = fx(c.les); }

  if (!isFinite(P) || !isFinite(T)) {
    card.hidden = true; veredicto('co2', null); $('#co2Gauge').hidden = true;
    S._co2 = NaN; return;
  }
  const cor = co2Corregida(P, T, cP, cT), act = co2Actual(P, T, cP, cT);
  S._co2 = cor;
  card.hidden = false;
  $('#resCO2').innerHTML = fmt(cor) + ' <small style="font-size:17px">v/v</small>';
  const est = c ? evaluar(cor, c.lei, c.les) : null;
  card.className = 'res-card' + (est ? ' ' + est : '');
  $('#resCO2Sub').textContent = c
    ? `Actual ${fmt(act)} · desviación ${cor - c.obj >= 0 ? '+' : ''}${fmt(cor - c.obj)} vs objetivo`
    : '';
  if (c) {
    veredicto('co2', est, `CO₂ corregido ${fmt(cor)} v/v · rango ${fx(c.lei)} – ${fx(c.les)}`);
    gauge('co2', cor, c.lei, c.obj, c.les);
  } else { veredicto('co2', null); $('#co2Gauge').hidden = true; }
}

function refrescarBrix() {
  const p = prodActual(), b = p.brix;
  if (!b) { S._brix = NaN; return; }                    // producto sin Brix: tarjeta oculta
  const esCC = p.prod === 'Coca-Cola';
  $('#bloqueBT').hidden = !esCC;
  $('#brixLabel').textContent = b.label + ' de la bebida terminada';
  $('#brixLims').hidden = false;
  $('#brixLei').textContent = fx(b.lei); $('#brixObj').textContent = fx(b.obj); $('#brixLes').textContent = fx(b.les);

  /* Brix de trabajo (Coca-Cola) */
  const jf = num(S.jtF), ja = num(S.jtA), de = num(S.dens);
  const delta = (isFinite(jf) && isFinite(ja)) ? deltaBrix(ja, jf) : NaN;
  $('#resDelta').textContent = isFinite(delta) ? (delta >= 0 ? '+' : '') + fmt(delta, 3) : '—';
  $('#resBT').textContent = isFinite(delta) ? fmt(b.obj + delta) : '—';
  const norm = (isFinite(de) && isFinite(delta)) ? de - delta : NaN;
  $('#resBrixNorm').textContent = isFinite(norm) ? fmt(norm) : '—';

  /* Valor a evaluar: brix directo; si no hay, el normalizado del densímetro */
  let v = num(S.bx);
  if (!isFinite(v) && isFinite(norm)) v = norm;
  S._brix = v;

  if (!isFinite(v)) { veredicto('brix', null); $('#brixGauge').hidden = true; return; }
  const est = evaluar(v, b.lei, b.les);
  veredicto('brix', est, `°Brix ${fmt(v)} · rango ${fx(b.lei)} – ${fx(b.les)}`);
  gauge('brix', v, b.lei, b.obj, b.les);
}

/* Otros parámetros (N2, O3, pH, acidez, TDS…) — tarjetas con paso numerado */
function refrescarOtros() {
  const p = prodActual(), clave = p.cat + '|' + p.prod;
  const vals = (S.otros[clave]) || {};
  const cont = $('#contOtros');
  if (!p.otros.length) { cont.innerHTML = ''; renumerarPasos(); return; }
  cont.innerHTML = p.otros.map((o, i) => {
    const v = num(vals[i]);
    const est = evaluar(v, o.lei, o.les);
    return `<div class="card step">
      <div class="step-head">
        <span class="step-n">·</span>
        <div><h2>${o.n}</h2><p>Parámetro de este producto</p></div>
      </div>
      <div class="field">
        <label for="inOtro${i}">Valor medido</label>
        <input id="inOtro${i}" class="big" type="text" inputmode="decimal" enterkeyhint="done"
          autocomplete="off" value="${vals[i] || ''}" placeholder="0">
      </div>
      <div class="volrow" style="margin-top:0">
        <div class="vr"><span>Mínimo · LEI</span><b>${fx(o.lei)}</b></div>
        <div class="vr teo"><span>Objetivo</span><b>${fx(o.obj)}</b></div>
        <div class="vr"><span>Máximo · LES</span><b>${fx(o.les)}</b></div>
      </div>
      ${est ? `<div class="veredicto ${est}"><span class="v-dot"></span>
        <div class="v-txt"><strong>${TXT_ESTADO[est]}</strong><span>${o.n}: ${fmt(v)}</span></div></div>` : ''}
    </div>`;
  }).join('');
  p.otros.forEach((o, i) => {
    $('#inOtro' + i).addEventListener('input', e => {
      if (!S.otros[clave]) S.otros[clave] = {};
      S.otros[clave][i] = e.target.value;
      guardarEstado(); refrescarOtros();
      const el = $('#inOtro' + i); el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  });
  renumerarPasos();
}

function refrescarTodo() {
  const p = prodActual();
  /* Solo se muestran las tarjetas de lo que este producto mide */
  $('#cardCO2').hidden = !p.co2.length;
  $('#cardBrix').hidden = !p.brix;
  chipsSpecs(); refrescarCO2(); refrescarBrix(); refrescarOtros(); renderVerif();
  renumerarPasos();
}

/* Entradas del flujo principal */
function enlazar(id, campo, fn) {
  const el = $(id); el.value = S[campo] || '';
  el.addEventListener('input', () => { S[campo] = el.value; fn(); guardarEstado(); });
}
enlazar('#inPresion', 'p', refrescarCO2);
enlazar('#inTemp', 't', refrescarCO2);
enlazar('#inCorrP', 'corrP', refrescarCO2);
enlazar('#inCorrT', 'corrT', refrescarCO2);
enlazar('#inBrix', 'bx', refrescarBrix);
enlazar('#inJTFresco', 'jtF', refrescarBrix);
enlazar('#inJTActual', 'jtA', refrescarBrix);
enlazar('#inDensimetro', 'dens', refrescarBrix);

function cambiarSigno(id, campo) {
  const el = $(id); let v = el.value.trim();
  v = !v ? '-' : (v.startsWith('-') ? v.slice(1) : '-' + v);
  el.value = v; S[campo] = v; refrescarCO2(); guardarEstado();
}
$('#btnSignoP').addEventListener('click', () => cambiarSigno('#inCorrP', 'corrP'));
$('#btnSignoT').addEventListener('click', () => cambiarSigno('#inCorrT', 'corrT'));

$('#inAnalista').addEventListener('change', e => { CFG.analista = e.target.value; guardarCfg(); });

$('#btnLimpiar').addEventListener('click', () => {
  ['p', 't', 'bx', 'jtF', 'jtA', 'dens'].forEach(k => S[k] = '');
  ['#inPresion', '#inTemp', '#inBrix', '#inJTFresco', '#inJTActual', '#inDensimetro', '#inObs'].forEach(s => $(s).value = '');
  const p = prodActual(), clave = p.cat + '|' + p.prod;
  if (S.otros[clave]) { S.otros[clave] = {}; }
  $('#inHora').value = ahoraLocal();
  refrescarTodo(); guardarEstado();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ══════════════════ 7 · GUARDAR MEDICIÓN (tabla horaria) ══════════════════ */

$('#btnGuardar').addEventListener('click', () => {
  const p = prodActual(), c = packActual();
  const co2 = p.co2.length ? S._co2 : NaN;
  const brix = p.brix ? S._brix : NaN;

  /* Resumen de otros parámetros medidos */
  const clave = p.cat + '|' + p.prod, vals = S.otros[clave] || {};
  const otrosTxt = p.otros.map((o, i) => {
    const v = num(vals[i]);
    return isFinite(v) ? o.n + ' ' + fmt(v) : null;
  }).filter(Boolean).join(' · ');

  if (!isFinite(co2) && !isFinite(brix) && !otrosTxt)
    return toast('Ingresa al menos una medición antes de guardar', 'bad');

  const cuando = $('#inHora').value ? new Date($('#inHora').value) : new Date();
  const reg = {
    id: nuevoId(MEDICIONES), ts: cuando.getTime(), guardadoEn: Date.now(),
    fecha: fechaISO(cuando),
    hora: fHora(cuando),
    cat: p.cat, producto: p.prod, empaque: c ? c.pack : '',
    orden: $('#inOrden').value.trim(),
    tanque: $('#inTanque').value.trim(),
    presion: isFinite(num(S.p)) && p.co2.length ? num(S.p) : null,
    temp: isFinite(num(S.t)) && p.co2.length ? num(S.t) : null,
    co2: isFinite(co2) ? Number(co2.toFixed(3)) : null,
    estCO2: (isFinite(co2) && c) ? evaluar(co2, c.lei, c.les) : null,
    brix: isFinite(brix) ? Number(brix.toFixed(3)) : null,
    estBrix: (isFinite(brix) && p.brix) ? evaluar(brix, p.brix.lei, p.brix.les) : null,
    otros: otrosTxt,
    analista: $('#inAnalista').value.trim(),
    obs: $('#inObs').value.trim()
  };
  MEDICIONES.push(reg);
  LS.escribir(K.mediciones, MEDICIONES);
  $('#inObs').value = '';
  $('#inHora').value = ahoraLocal();
  renderMediciones(); contarExport(); renderGrafica(); renderAvisoRespaldo();
  toast(`Medición guardada · ${MEDICIONES.length} en la tabla`, 'ok');
});

function celdaEst(est) {
  return est ? `<td class="${est}">${est === 'ok' ? 'OK' : est === 'warn' ? 'LÍMITE' : 'FUERA'}</td>` : '<td>—</td>';
}
function medFiltradas() {
  const q = $('#medBuscar').value.trim().toLowerCase();
  let l = [...MEDICIONES].sort((a, b) => (b.ts - a.ts) || (b.id - a.id));
  if (q) l = l.filter(r => [r.producto, r.empaque, r.orden, r.tanque, r.analista, r.fecha, r.obs, r.otros].join(' ').toLowerCase().includes(q));
  return l;
}
function renderMediciones() {
  const l = medFiltradas();
  $('#medCount').textContent = MEDICIONES.length;
  const t = $('#medTabla');
  if (!l.length) {
    t.innerHTML = '<tr><td style="border:0"><div class="empty">Sin mediciones todavía.<br>Guarda una desde la pestaña Medición.</div></td></tr>';
    return;
  }
  t.innerHTML = `<thead><tr>
    <th>Fecha</th><th>Hora</th><th>Producto</th><th>Empaque</th><th>Orden</th><th>Tanque</th>
    <th>P [psi]</th><th>T [°C]</th><th>CO₂ [v/v]</th><th>Estado</th>
    <th>°Brix</th><th>Estado</th><th>Otros</th><th>Analista</th><th>Obs.</th><th></th></tr></thead>
  <tbody>${l.map(r => `<tr>
    <td>${fFecha(r.ts)}</td><td><b>${r.hora}</b></td><td>${r.producto}</td>
    <td>${r.empaque || '—'}</td><td>${r.orden || '—'}</td><td>${r.tanque || '—'}</td>
    <td>${fmt(r.presion, 1)}</td><td>${fmt(r.temp, 1)}</td>
    <td><b>${fmt(r.co2)}</b></td>${celdaEst(r.estCO2)}
    <td><b>${fmt(r.brix)}</b></td>${celdaEst(r.estBrix)}
    <td>${r.otros || '—'}</td><td>${r.analista || '—'}</td><td>${r.obs || '—'}</td>
    <td><button class="del-row" onclick="borrarMed(${r.id})">✕</button></td>
  </tr>`).join('')}</tbody>`;
}
$('#medBuscar').addEventListener('input', renderMediciones);
function borrarMed(id) {
  if (!confirm('¿Borrar esta medición?')) return;
  MEDICIONES = MEDICIONES.filter(x => x.id !== id);
  LS.escribir(K.mediciones, MEDICIONES);
  renderMediciones(); contarExport(); renderGrafica(); renderAvisoRespaldo(); toast('Medición borrada');
}

/* ══════════════════ 8 · PRODUCCIÓN Y MUESTRAS A SENSORIAL ══════════════════ */

let SENS_TIMER = null, AVISADOS = new Set();

function proximaMuestra() {
  return PROD.activa ? new Date(PROD.ultimaMuestra + MS_CICLO) : null;
}

function renderProduccion() {
  const activa = PROD.activa;
  $('#prodEstado').textContent = activa ? 'EN CURSO' : 'SIN PRODUCCIÓN';
  $('#prodForm').hidden = activa;
  $('#prodActiva').hidden = !activa;

  if (activa) {
    $('#paOrden').textContent = PROD.orden || '—';
    $('#paTanque').textContent = PROD.tanque || '—';
    $('#paProducto').textContent = PROD.producto || '—';
    $('#paInicio').textContent = fFecha(PROD.inicio) + ' ' + fHora(PROD.inicio);

    const prox = proximaMuestra();
    const falta = prox - Date.now();
    const card = $('#sensCard');
    card.className = 'sens-card' + (falta <= 0 ? ' ahora' : falta <= 30 * 60000 ? ' pronto' : '');
    $('#sensProx').textContent = fHora(prox) + (fechaISO(prox) !== hoyISO() ? ' (' + fFecha(prox) + ')' : '');
    if (falta <= 0) {
      const atraso = Math.floor(-falta / 60000);
      $('#sensResta').textContent = `¡Ya toca llevar la muestra! ${atraso > 0 ? 'Atrasada ' + (atraso >= 60 ? Math.floor(atraso / 60) + ' h ' + (atraso % 60) + ' min' : atraso + ' min') : ''}`;
    } else {
      const h = Math.floor(falta / 3600000), m = Math.floor(falta % 3600000 / 60000);
      $('#sensResta').textContent = `Falta ${h > 0 ? h + ' h ' : ''}${m} min · ciclo de ${SENSORIAL_INTERVALO} horas`;
    }
    $('#tabProduccion').classList.toggle('avisa', falta <= 15 * 60000);
  } else {
    $('#tabProduccion').classList.remove('avisa');
  }
  renderMuestras();
}

function renderMuestras() {
  const l = [...MUESTRAS].sort((a, b) => (b.ts - a.ts) || (b.id - a.id));
  $('#muCount').textContent = l.length;
  $('#muLista').innerHTML = l.length ? l.slice(0, 30).map(r => `
    <div class="item">
      <div class="item-top">
        <div><div class="item-t">${r.producto}</div>
        <div class="item-s">${fFecha(r.ts)} · ${fHora(r.ts)}${r.analista ? ' · ' + r.analista : ''}</div></div>
        <span class="pill ${r.tipo === 'arranque' ? 'ok' : r.tipo === 'cambio' ? 'warn' : 'nd'}">${TIPO_MUESTRA[r.tipo] || r.tipo}</span>
      </div>
      <div class="item-tags">
        ${r.orden ? `<span class="tag">Orden ${r.orden}</span>` : ''}
        ${r.tanque ? `<span class="tag">Tanque ${r.tanque}</span>` : ''}
        ${r.tipo === 'arranque' ? '<span class="tag agua">2 botellas: una se mide ahora, otra a las 4 h</span>' : ''}
      </div>
      <div class="item-acts"><button class="del" onclick="borrarMuestra(${r.id})">Borrar</button></div>
    </div>`).join('')
    : '<div class="empty">Sin muestras registradas todavía.<br>Arranca una producción para empezar el ciclo.</div>';
}
function borrarMuestra(id) {
  if (!confirm('¿Borrar este registro de muestra?')) return;
  MUESTRAS = MUESTRAS.filter(x => x.id !== id);
  LS.escribir(K.muestras, MUESTRAS);
  renderMuestras(); contarExport(); toast('Registro borrado');
}

function logMuestra(tipo, ts) {
  MUESTRAS.push({
    id: nuevoId(MUESTRAS), ts, guardadoEn: Date.now(),
    fecha: fechaISO(ts),
    tipo,
    producto: PROD.producto, cat: PROD.cat,
    orden: PROD.orden, tanque: PROD.tanque,
    analista: $('#inAnalista').value.trim() || CFG.analista
  });
  LS.escribir(K.muestras, MUESTRAS);
}
function logTanque(tipo, ts, datos) {
  TANQUES.push(Object.assign({
    id: nuevoId(TANQUES), ts, guardadoEn: Date.now(),
    fecha: fechaISO(ts), tipo,
    producto: PROD.producto,
    analista: $('#inAnalista').value.trim() || CFG.analista
  }, datos));
  LS.escribir(K.tanques, TANQUES);
}

/* ── Arrancar producción ── */
$('#btnArrancar').addEventListener('click', () => {
  const orden = $('#pOrden').value.trim(), tanque = $('#pTanque').value.trim();
  if (!orden || !tanque) return toast('Anota la orden y el tanque para arrancar', 'bad');
  const p = prodActual();
  const cuando = $('#pInicio').value ? new Date($('#pInicio').value) : new Date();
  PROD = { activa: true, orden, tanque, producto: p.prod, cat: p.cat,
           inicio: cuando.getTime(), ultimaMuestra: cuando.getTime() };
  guardarProd();
  logTanque('arranque', cuando.getTime(), { ordenEntra: orden, entra: tanque, sale: '', ordenSale: '', obs: '' });
  logMuestra('arranque', cuando.getTime());
  $('#inOrden').value = orden; $('#inTanque').value = tanque;
  $('#pOrden').value = ''; $('#pTanque').value = '';
  AVISADOS.clear();
  renderProduccion(); renderTanques(); contarExport(); programarAviso(); renderAvisoRespaldo();
  toast('Producción arrancada · saca 2 botellas para sensorial', 'ok');
});

/* ── Muestra llevada ── */
$('#btnMuestra').addEventListener('click', () => {
  if (!PROD.activa) return;
  const ahora = Date.now();
  logMuestra('4h', ahora);
  PROD.ultimaMuestra = ahora;
  guardarProd();
  AVISADOS.clear();
  renderProduccion(); contarExport(); programarAviso(); renderAvisoRespaldo();
  toast(`Muestra registrada · la próxima es a las ${fHora(ahora + MS_CICLO)}`, 'ok');
});

/* ── Cambio de tanque ── */
$('#btnCambioTq').addEventListener('click', () => {
  const f = $('#cambioForm');
  f.hidden = !f.hidden;
  if (!f.hidden) { $('#cHora').value = ahoraLocal(); $('#cOrden').value = ''; $('#cTanque').value = ''; $('#cObs').value = ''; }
});
$('#btnGuardarCambio').addEventListener('click', () => {
  if (!PROD.activa) return;
  const nuevoTq = $('#cTanque').value.trim();
  if (!nuevoTq) return toast('Anota el tanque que entra', 'bad');
  const nuevaOrden = $('#cOrden').value.trim() || PROD.orden;
  const cuando = $('#cHora').value ? new Date($('#cHora').value) : new Date();
  const ts = cuando.getTime();

  logTanque('cambio', ts, {
    ordenSale: PROD.orden, ordenEntra: nuevaOrden,
    sale: PROD.tanque, entra: nuevoTq,
    obs: $('#cObs').value.trim()
  });
  PROD.orden = nuevaOrden; PROD.tanque = nuevoTq; PROD.ultimaMuestra = ts;
  guardarProd();
  logMuestra('cambio', ts);
  $('#inOrden').value = nuevaOrden; $('#inTanque').value = nuevoTq;
  $('#cambioForm').hidden = true;
  AVISADOS.clear();
  renderProduccion(); renderTanques(); contarExport(); programarAviso(); renderAvisoRespaldo();
  toast('Cambio registrado · saca muestra nueva para sensorial', 'ok');
});

/* ── Finalizar ── */
$('#btnFinalizar').addEventListener('click', () => {
  if (!confirm('¿Finalizar la producción en curso? Se dejan de programar recordatorios.')) return;
  PROD = { activa: false };
  guardarProd();
  $('#inOrden').value = ''; $('#inTanque').value = '';
  $('#cambioForm').hidden = true;
  clearTimeout(SENS_TIMER);
  renderProduccion();
  toast('Producción finalizada');
});

/* ── Avisos ── */
async function notificar(titulo, cuerpo, tag) {
  const opts = { body: cuerpo, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    tag, renotify: true, requireInteraction: true, vibrate: [300, 150, 300, 150, 300] };
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) return reg.showNotification(titulo, opts);
  } catch {}
  try { new Notification(titulo, opts); } catch {}
}
function avisarMuestra() {
  const clave = String(PROD.ultimaMuestra);
  if (AVISADOS.has(clave)) return;
  AVISADOS.add(clave);
  notificar('Llevar muestra a sensorial',
    `${PROD.producto} · Orden ${PROD.orden} · Tanque ${PROD.tanque} — toca la muestra de las ${fHora(proximaMuestra())}`,
    'sens-' + clave);
  beep();
}
function programarAviso() {
  clearTimeout(SENS_TIMER);
  if (!CFG.sensAvisos || !PROD.activa) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const falta = proximaMuestra() - Date.now();
  if (falta <= 0) { avisarMuestra(); return; }
  if (falta < 86400000) SENS_TIMER = setTimeout(() => { avisarMuestra(); renderProduccion(); }, falta);
}

$('#swSensorial').addEventListener('change', async e => {
  if (e.target.checked) {
    if (!('Notification' in window)) { e.target.checked = false; return toast('Este navegador no permite notificaciones', 'bad'); }
    let permiso = Notification.permission;
    if (permiso === 'default') permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      e.target.checked = false;
      $('#sensSwTxt').textContent = 'Permiso denegado. Actívalo en los ajustes del navegador.';
      return toast('No se dieron permisos de notificación', 'bad');
    }
    CFG.sensAvisos = true; toast('Avisos activados', 'ok');
  } else { CFG.sensAvisos = false; toast('Avisos desactivados'); }
  $('#btnProbarSens').hidden = !CFG.sensAvisos;
  $('#sensSwTxt').textContent = CFG.sensAvisos
    ? 'Avisará con sonido cuando toque llevar la muestra (app abierta)'
    : 'Notifica y suena cada 4 horas según la producción';
  guardarCfg(); programarAviso();
});
$('#btnProbarSens').addEventListener('click', () => {
  if (Notification.permission !== 'granted') return toast('Primero activa los avisos', 'bad');
  notificar('Aviso de prueba', 'Así sonará cuando toque llevar la muestra a sensorial.', 'prueba');
  beep();
  toast('Notificación enviada', 'ok');
});

/* ── Calendario .ics: alarma cada 4 h desde la última muestra ── */
const icsFecha = d => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
const esc = t => String(t ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
$('#btnIcsSens').addEventListener('click', () => {
  const base = PROD.activa ? PROD.ultimaMuestra : Date.now();
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0',
    'PRODID:-//Embol Calidad//Carbonatacion y Brix//ES',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Muestras a sensorial cada 4 h'];
  const ahora = icsFecha(new Date());
  const nCiclos = 24 / SENSORIAL_INTERVALO;            // 6 horarios por día
  for (let i = 1; i <= nCiclos; i++) {
    const ini = new Date(base + i * MS_CICLO);
    const fin = new Date(ini.getTime() + 15 * 60000);
    L.push('BEGIN:VEVENT');
    L.push(`UID:muestra-${i}-${base}@embol-calidad`);
    L.push(`DTSTAMP:${ahora}`);
    L.push(`DTSTART:${icsFecha(ini)}`);
    L.push(`DTEND:${icsFecha(fin)}`);
    L.push('RRULE:FREQ=DAILY');
    L.push(`SUMMARY:${esc('Llevar muestra a sensorial' + (PROD.activa ? ' · ' + PROD.producto : ''))}`);
    L.push(`DESCRIPTION:${esc((PROD.activa ? 'Orden ' + PROD.orden + ' · Tanque ' + PROD.tanque + '\n' : '') + 'Ciclo de muestras cada ' + SENSORIAL_INTERVALO + ' horas · Calidad Embotellado Embol')}`);
    L.push('BEGIN:VALARM'); L.push('TRIGGER:PT0M'); L.push('ACTION:DISPLAY');
    L.push(`DESCRIPTION:${esc('Llevar muestra a sensorial')}`);
    L.push('END:VALARM');
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  const b = new Blob([L.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = `Muestras_sensorial_${hoyISO()}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Calendario exportado · ábrelo para agendar las alarmas', 'ok');
});

/* ══════════════════ 9 · LISTA DE CAMBIOS DE TANQUE ══════════════════ */

function renderTanques() {
  const l = [...TANQUES].sort((a, b) => (b.ts - a.ts) || (b.id - a.id));
  $('#tqCount').textContent = l.length;
  $('#tqLista').innerHTML = l.length ? l.slice(0, 30).map(r => `
    <div class="item">
      <div class="item-top">
        <div><div class="item-t">${r.producto}</div>
        <div class="item-s">${fFecha(r.ts)} · ${fHora(r.ts)}${r.analista ? ' · ' + r.analista : ''}</div></div>
        <span class="pill ${r.tipo === 'arranque' ? 'ok' : 'warn'}">${r.tipo === 'arranque' ? 'ARRANQUE' : `TQ ${r.sale || '?'} → ${r.entra || '?'}`}</span>
      </div>
      <div class="item-tags">
        ${r.tipo === 'cambio' && r.ordenSale && r.ordenSale !== r.ordenEntra ? `<span class="tag">Orden ${r.ordenSale} → ${r.ordenEntra}</span>` : `<span class="tag">Orden ${r.ordenEntra || '—'}</span>`}
        ${r.tipo === 'arranque' ? `<span class="tag">Tanque ${r.entra}</span>` : ''}
        ${r.obs ? `<span class="tag">${r.obs}</span>` : ''}
      </div>
      <div class="item-acts"><button class="del" onclick="borrarTq(${r.id})">Borrar</button></div>
    </div>`).join('')
    : '<div class="empty">Sin arranques ni cambios de tanque registrados.</div>';
}
function borrarTq(id) {
  if (!confirm('¿Borrar este registro?')) return;
  TANQUES = TANQUES.filter(x => x.id !== id);
  LS.escribir(K.tanques, TANQUES);
  renderTanques(); contarExport(); toast('Registro borrado');
}

/* ══════════════════ 10 · GRÁFICA DE TENDENCIA ══════════════════ */

function datosGrafica() {
  const p = prodActual(), c = packActual();
  const rango = enRango(MEDICIONES).filter(r => r.producto === p.prod);
  const co2Datos = c ? rango.filter(r => r.co2 != null && r.empaque === c.pack).slice(-24) : [];
  const brixDatos = p.brix ? rango.filter(r => r.brix != null).slice(-24) : [];
  return { p, c, co2Datos, brixDatos };
}

function dibujarChart(canvas, datos, lei, obj, les) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 560, H = 230;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const mL = 48, mR = 14, mT = 14, mB = 30;

  const vs = datos.map(d => d.v);
  let yMin = Math.min(...vs), yMax = Math.max(...vs);
  if (lei != null) yMin = Math.min(yMin, lei);
  if (les != null) yMax = Math.max(yMax, les);
  const pad = (yMax - yMin) * 0.3 || 0.5;
  yMin -= pad; yMax += pad;

  const X = i => datos.length === 1 ? mL + (W - mL - mR) / 2 : mL + (W - mL - mR) * i / (datos.length - 1);
  const Y = v => mT + (H - mT - mB) * (1 - (v - yMin) / (yMax - yMin));

  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

  /* Franja verde LEI–LES */
  if (lei != null && les != null) {
    ctx.fillStyle = 'rgba(14,143,78,.12)';
    ctx.fillRect(mL, Y(les), W - mL - mR, Y(lei) - Y(les));
    ctx.strokeStyle = 'rgba(14,143,78,.55)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
    [lei, les].forEach(v => { ctx.beginPath(); ctx.moveTo(mL, Y(v)); ctx.lineTo(W - mR, Y(v)); ctx.stroke(); });
    ctx.setLineDash([]);
  }
  /* Línea de objetivo */
  if (obj != null) {
    ctx.strokeStyle = '#F40009'; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(mL, Y(obj)); ctx.lineTo(W - mR, Y(obj)); ctx.stroke();
    ctx.setLineDash([]);
  }
  /* Etiquetas del eje Y */
  ctx.font = '700 10px Inter, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0E8F4E';
  if (lei != null) ctx.fillText(fmt(lei), mL - 5, Y(lei));
  if (les != null) ctx.fillText(fmt(les), mL - 5, Y(les));
  if (obj != null) { ctx.fillStyle = '#F40009'; ctx.fillText(fmt(obj), mL - 5, Y(obj)); }

  /* Línea de datos */
  ctx.strokeStyle = '#1A1D23'; ctx.lineWidth = 2; ctx.beginPath();
  datos.forEach((d, i) => { i ? ctx.lineTo(X(i), Y(d.v)) : ctx.moveTo(X(0), Y(d.v)); });
  ctx.stroke();

  /* Puntos coloreados por estado */
  datos.forEach((d, i) => {
    const est = evaluar(d.v, lei, les);
    ctx.fillStyle = est === 'ok' ? '#0E8F4E' : est === 'warn' ? '#B26A00' : est === 'bad' ? '#C2000B' : '#6A7382';
    ctx.beginPath(); ctx.arc(X(i), Y(d.v), 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  });

  /* Horas en el eje X */
  ctx.fillStyle = '#6A7382'; ctx.font = '600 9.5px Inter, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const paso = Math.max(1, Math.ceil(datos.length / 8));
  datos.forEach((d, i) => {
    if (i % paso && i !== datos.length - 1) return;
    ctx.fillText(fHora(d.ts), X(i), H - mB + 8);
  });
}

function renderGrafica() {
  const { p, c, co2Datos, brixDatos } = datosGrafica();
  $('#grafProd').textContent = p.prod;
  $('#grafCO2Blk').hidden = !co2Datos.length;
  $('#grafBrixBlk').hidden = !brixDatos.length;
  $('#grafVacia').hidden = !!(co2Datos.length || brixDatos.length);
  if (co2Datos.length) {
    $('#grafCO2Emp').textContent = c.pack;
    dibujarChart($('#grafCO2'), co2Datos.map(r => ({ ts: r.ts, v: r.co2 })), c.lei, c.obj, c.les);
  }
  if (brixDatos.length)
    dibujarChart($('#grafBrix'), brixDatos.map(r => ({ ts: r.ts, v: r.brix })), p.brix.lei, p.brix.obj, p.brix.les);
}

/* Guardar la gráfica como imagen */
$('#btnGrafImg').addEventListener('click', () => {
  renderGrafica();
  const bloques = [
    ['grafCO2Blk', 'grafCO2', 'CO₂ [v/v] · ' + ($('#grafCO2Emp').textContent || '')],
    ['grafBrixBlk', 'grafBrix', '°Brix']
  ].filter(([blk]) => !$('#' + blk).hidden);
  if (!bloques.length) return toast('No hay datos para graficar', 'bad');

  const W = 1200, headH = 100, chH = 470, gap = 34;
  const out = document.createElement('canvas');
  out.width = W; out.height = headH + bloques.length * (chH + gap);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
  ctx.fillStyle = '#F40009'; ctx.fillRect(0, 0, W, 56);
  ctx.fillStyle = '#fff'; ctx.font = '800 24px Inter, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('CARBONATACIÓN & BRIX — GRÁFICA DE TENDENCIA', 24, 30);
  ctx.fillStyle = '#6A7382'; ctx.font = '600 16px Inter, sans-serif';
  ctx.fillText(prodActual().prod + ' · ' + new Date().toLocaleString('es-BO') + ' · Calidad Embotellado · Embol S.A.', 24, 80);
  let y = headH;
  bloques.forEach(([blk, id, tit]) => {
    ctx.fillStyle = '#1A1D23'; ctx.font = '800 18px Inter, sans-serif';
    ctx.fillText(tit, 24, y + 14);
    ctx.drawImage($('#' + id), 24, y + 30, W - 48, chH - 40);
    y += chH + gap;
  });
  out.toBlob(b => {
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u; a.download = `Grafica_${prodActual().prod.replace(/\s+/g, '_')}_${hoyISO()}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
    toast('Gráfica guardada como imagen', 'ok');
  }, 'image/png');
});

/* ══════════════════ 11 · EXPORTACIÓN ══════════════════ */

function enRango(lista) {
  const d = $('#xDesde').value, h = $('#xHasta').value;
  return [...lista].filter(r => (!d || r.fecha >= d) && (!h || r.fecha <= h))
    .sort((a, b) => (a.ts - b.ts) || (a.id - b.id));
}
function contarExport() {
  const n = enRango(MEDICIONES).length, s = enRango(MUESTRAS).length, t = enRango(TANQUES).length;
  $('#xConteo').textContent = `${n} medicion${n === 1 ? '' : 'es'} · ${s} muestra${s === 1 ? '' : 's'} a sensorial · ${t} arranque${t === 1 ? '' : 's'}/cambio${t === 1 ? '' : 's'} (vacío = todos).`;
}
['#xDesde', '#xHasta'].forEach(s => $(s).addEventListener('change', () => { contarExport(); renderGrafica(); }));

const txtEst = e => e === 'ok' ? 'DENTRO' : e === 'warn' ? 'AL LÍMITE' : e === 'bad' ? 'FUERA' : '';
const r2 = (v, d = 2) => (v == null || !isFinite(v)) ? '' : Number(Number(v).toFixed(d));

/* ── Respaldos cuando no hay internet ──────────────────────────────────────
   Excel, PDF e imagen se arman con librerías que se descargan de internet la
   primera vez. Si el celular las tiene guardadas, todo funciona igual sin
   conexión. Si no (por ejemplo después de limpiar el caché del navegador), en
   vez de fallar en silencio se usan formatos que el navegador sabe hacer solo:
   CSV, que Excel abre sin problema, e impresión, que en el celular permite
   «Guardar como PDF».                                                        */

function descargar(nombre, contenido, tipo) {
  const b = new Blob([contenido], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const csvCampo = v => {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csvFilas = filas => filas.map(f => f.map(csvCampo).join(';')).join('\r\n');

function exportarCSV() {
  const m = enRango(MEDICIONES), mu = enRango(MUESTRAS), t = enRango(TANQUES);
  const filas = [
    ['CARBONATACIÓN & BRIX — TABLA HORARIA'],
    ['Generado', new Date().toLocaleString('es-BO')], [],
    ['N°','FECHA','HORA','PRODUCTO','EMPAQUE','ORDEN','TANQUE','PRESIÓN [psi]','TEMP [°C]',
     'CO2 [v/v]','ESTADO CO2','BRIX','ESTADO BRIX','OTROS PARÁMETROS','ANALISTA','OBSERVACIONES'],
    ...m.map((r, i) => [i + 1, r.fecha, r.hora, r.producto, r.empaque, r.orden || '', r.tanque || '',
      r2(r.presion, 1), r2(r.temp, 1), r2(r.co2, 3), txtEst(r.estCO2),
      r2(r.brix, 3), txtEst(r.estBrix), r.otros || '', r.analista, r.obs])
  ];
  if (mu.length) {
    filas.push([], ['MUESTRAS LLEVADAS A SENSORIAL'],
      ['N°','FECHA','HORA','TIPO','PRODUCTO','ORDEN','TANQUE','ANALISTA'],
      ...mu.map((r, i) => [i + 1, r.fecha, fHora(r.ts), TIPO_MUESTRA[r.tipo] || r.tipo,
        r.producto, r.orden || '', r.tanque || '', r.analista || '']));
  }
  if (t.length) {
    filas.push([], ['ARRANQUES Y CAMBIOS DE TANQUE'],
      ['N°','FECHA','HORA','TIPO','PRODUCTO','ORDEN SALE','ORDEN ENTRA','TANQUE SALE','TANQUE ENTRA','OBSERVACIONES','ANALISTA'],
      ...t.map((r, i) => [i + 1, r.fecha, fHora(r.ts), r.tipo === 'arranque' ? 'ARRANQUE' : 'CAMBIO DE TANQUE',
        r.producto, r.ordenSale || '', r.ordenEntra || '', r.sale || '', r.entra || '', r.obs || '', r.analista || '']));
  }
  // El BOM al inicio hace que Excel respete los acentos
  descargar(`Carbonatacion_Brix_${hoyISO()}.csv`, '﻿' + csvFilas(filas),
            'text/csv;charset=utf-8');
  toast('Sin internet: se generó un CSV, que Excel abre igual', 'ok');
}

/** Abre una ventana con la tabla lista para imprimir o guardar como PDF */
function imprimirTabla() {
  const m = enRango(MEDICIONES);
  const color = e => e === 'DENTRO' ? '#0E8F4E' : e === 'AL LÍMITE' ? '#B26A00' : e === 'FUERA' ? '#C2000B' : '#98A1AE';
  const head = ['N°','Fecha','Hora','Producto','Empaque','Orden','Tanque','P [psi]','T [°C]',
                'CO₂ [v/v]','Estado CO₂','°Brix','Estado Brix','Otros','Analista'];
  const doc = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Carbonatacion_Brix_${hoyISO()}</title><style>
@page{size:landscape;margin:10mm}
body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#14171C;margin:0;padding:16px}
h2{margin:0 0 4px;font-size:17px}
.meta{font-size:11px;color:#6A7382;margin-bottom:12px;font-weight:600}
table{border-collapse:collapse;width:100%;font-size:10px}
th{background:#F40009;color:#fff;padding:7px 5px;border:1px solid #C4000A;font-size:9px;text-align:center}
td{padding:6px 5px;border:1px solid #E2E5EA;text-align:center;font-weight:600}
tr:nth-child(even) td{background:#F8F9FA}
.pie{margin-top:12px;font-size:9.5px;color:#98A1AE;font-weight:600}
</style></head><body>
<h2>CARBONATACIÓN &amp; BRIX — TABLA HORARIA</h2>
<div class="meta">${m.length} mediciones · ${new Date().toLocaleString('es-BO')} · Calidad Embotellado · Embol S.A.</div>
<table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>
${m.map((r, i) => `<tr><td>${i + 1}</td><td>${fFecha(r.ts)}</td><td><b>${r.hora}</b></td>
<td style="text-align:left"><b>${r.producto}</b></td><td>${r.empaque || '—'}</td>
<td>${r.orden || '—'}</td><td>${r.tanque || '—'}</td>
<td>${r.presion != null ? fmt(r.presion, 1) : '—'}</td><td>${r.temp != null ? fmt(r.temp, 1) : '—'}</td>
<td><b>${r.co2 != null ? fmt(r.co2) : '—'}</b></td>
<td style="color:${color(txtEst(r.estCO2))};font-weight:800">${txtEst(r.estCO2) || '—'}</td>
<td><b>${r.brix != null ? fmt(r.brix) : '—'}</b></td>
<td style="color:${color(txtEst(r.estBrix))};font-weight:800">${txtEst(r.estBrix) || '—'}</td>
<td>${r.otros || '—'}</td><td>${r.analista || '—'}</td></tr>`).join('')}
</tbody></table>
<div class="pie">LP-AC-E-01.11 Rev. 54 · Calidad Embotellado · Embol S.A.</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return toast('Permite las ventanas emergentes para poder imprimir', 'bad');
  w.document.write(doc);
  w.document.close();
  toast('Elige «Guardar como PDF» en el menú de impresión', 'ok');
}

$('#xXlsx').addEventListener('click', () => {
  const m = enRango(MEDICIONES), mu = enRango(MUESTRAS), t = enRango(TANQUES);
  if (!m.length && !mu.length && !t.length) return toast('No hay registros en el rango', 'bad');
  if (typeof XLSX === 'undefined') return exportarCSV();
  const wb = XLSX.utils.book_new();

  const wsM = XLSX.utils.aoa_to_sheet([
    ['CARBONATACIÓN & BRIX — TABLA HORARIA'], ['Generado: ' + new Date().toLocaleString('es-BO')], [],
    ['N°','FECHA','HORA','PRODUCTO','EMPAQUE','ORDEN','TANQUE','PRESIÓN [psi]','TEMP [°C]','CO₂ [v/v]','ESTADO CO₂','°BRIX','ESTADO BRIX','OTROS PARÁMETROS','ANALISTA','OBSERVACIONES'],
    ...m.map((r, i) => [i + 1, r.fecha, r.hora, r.producto, r.empaque, r.orden || '', r.tanque || '',
      r2(r.presion, 1), r2(r.temp, 1), r2(r.co2, 3), txtEst(r.estCO2),
      r2(r.brix, 3), txtEst(r.estBrix), r.otros || '', r.analista, r.obs])]);
  wsM['!cols'] = [4,11,7,26,16,12,9,13,10,10,12,9,12,30,16,26].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsM, 'Mediciones');

  const wsMu = XLSX.utils.aoa_to_sheet([
    ['MUESTRAS LLEVADAS A SENSORIAL (ciclo de ' + SENSORIAL_INTERVALO + ' h)'], [],
    ['N°','FECHA','HORA','TIPO','PRODUCTO','ORDEN','TANQUE','ANALISTA'],
    ...mu.map((r, i) => [i + 1, r.fecha, fHora(r.ts), TIPO_MUESTRA[r.tipo] || r.tipo, r.producto, r.orden || '', r.tanque || '', r.analista || ''])]);
  wsMu['!cols'] = [4,11,7,18,26,12,9,16].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsMu, 'Muestras sensorial');

  const wsT = XLSX.utils.aoa_to_sheet([
    ['ARRANQUES Y CAMBIOS DE TANQUE'], [],
    ['N°','FECHA','HORA','TIPO','PRODUCTO','ORDEN SALE','ORDEN ENTRA','TANQUE SALE','TANQUE ENTRA','OBSERVACIONES','ANALISTA'],
    ...t.map((r, i) => [i + 1, r.fecha, fHora(r.ts), r.tipo === 'arranque' ? 'ARRANQUE' : 'CAMBIO DE TANQUE',
      r.producto, r.ordenSale || '', r.ordenEntra || '', r.sale || '', r.entra || '', r.obs || '', r.analista || ''])]);
  wsT['!cols'] = [4,11,7,18,26,12,13,12,13,26,16].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsT, 'Cambios de tanque');

  const filasE = [];
  DB.forEach(p => {
    if (p.brix) filasE.push([p.cat, p.prod, p.brix.label, p.brix.lei, p.brix.obj, p.brix.les]);
    p.co2.forEach(c => filasE.push([p.cat, p.prod, 'CO₂ [v/v] ' + c.pack, c.lei, c.obj, c.les]));
    p.otros.forEach(o => filasE.push([p.cat, p.prod, o.n, o.lei, o.obj, o.les]));
  });
  const wsE = XLSX.utils.aoa_to_sheet([
    ['ESPECIFICACIONES DE LÍNEA — LP-AC-E-01.11 Rev. 54'], [],
    ['CATEGORÍA','PRODUCTO','PARÁMETRO','LEI','OBJETIVO','LES'], ...filasE]);
  wsE['!cols'] = [14,28,26,9,10,9].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsE, 'Especificaciones');

  XLSX.writeFile(wb, `Carbonatacion_Brix_${hoyISO()}.xlsx`);
  toast('Excel generado', 'ok');
});

$('#xPdf').addEventListener('click', () => {
  const m = enRango(MEDICIONES);
  if (!m.length) return toast('No hay mediciones en el rango', 'bad');
  if (!window.jspdf || !window.jspdf.jsPDF) return imprimirTabla();
  renderGrafica();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFillColor(244, 0, 9); doc.rect(0, 0, 297, 18, 'F');
  doc.setTextColor(255).setFontSize(14).setFont(undefined, 'bold');
  doc.text('CARBONATACIÓN & BRIX — TABLA HORARIA', 10, 12);
  doc.setFontSize(8).setFont(undefined, 'normal');
  doc.text(new Date().toLocaleString('es-BO'), 287, 12, { align: 'right' });

  doc.autoTable({
    head: [['N°','Fecha','Hora','Producto','Empaque','Orden','Tanque','P\n[psi]','T\n[°C]','CO₂\n[v/v]','Estado\nCO₂','°Brix','Estado\nBrix','Otros','Analista']],
    body: m.map((r, i) => [i + 1, fFecha(r.ts), r.hora, r.producto, r.empaque || '—', r.orden || '—', r.tanque || '—',
      r.presion != null ? fmt(r.presion, 1) : '—', r.temp != null ? fmt(r.temp, 1) : '—',
      r.co2 != null ? fmt(r.co2) : '—', txtEst(r.estCO2) || '—',
      r.brix != null ? fmt(r.brix) : '—', txtEst(r.estBrix) || '—',
      r.otros || '—', r.analista || '—']),
    startY: 23,
    styles: { fontSize: 7, cellPadding: 1.6, halign: 'center', lineColor: [222,226,230], lineWidth: .1, font: 'helvetica' },
    headStyles: { fillColor: [244,0,9], textColor: 255, fontSize: 6.6, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248,249,250] },
    columnStyles: { 3: { halign: 'left', cellWidth: 34 }, 13: { cellWidth: 30 } },
    margin: { left: 7, right: 7 },
    didParseCell: d => {
      if (d.section !== 'body') return;
      if (d.column.index === 10 || d.column.index === 12) {
        if (d.cell.raw === 'DENTRO')    { d.cell.styles.textColor = [14,143,78];  d.cell.styles.fontStyle = 'bold'; }
        if (d.cell.raw === 'AL LÍMITE') { d.cell.styles.textColor = [178,106,0];  d.cell.styles.fontStyle = 'bold'; }
        if (d.cell.raw === 'FUERA')     { d.cell.styles.textColor = [194,0,11];   d.cell.styles.fontStyle = 'bold'; }
      }
    },
    didDrawPage: () => {
      doc.setFontSize(7).setTextColor(130);
      doc.text(`Página ${doc.internal.getNumberOfPages()} · LP-AC-E-01.11 Rev. 54 · Calidad Embotellado · Embol S.A.`,
        10, doc.internal.pageSize.getHeight() - 6);
    }
  });

  /* Gráficas al final del PDF */
  const bloques = [
    ['grafCO2Blk', 'grafCO2', 'CO2 [v/v] · ' + ($('#grafCO2Emp').textContent || '')],
    ['grafBrixBlk', 'grafBrix', 'Grados Brix']
  ].filter(([blk]) => !$('#' + blk).hidden);
  let y = doc.lastAutoTable.finalY + 10;
  bloques.forEach(([blk, id, tit]) => {
    if (y + 78 > doc.internal.pageSize.getHeight() - 8) { doc.addPage(); y = 14; }
    doc.setFontSize(10).setTextColor(26, 29, 35).setFont(undefined, 'bold');
    doc.text(tit + ' — ' + prodActual().prod, 10, y);
    try { doc.addImage($('#' + id).toDataURL('image/png'), 'PNG', 10, y + 3, 170, 68); } catch {}
    y += 80;
  });

  doc.save(`Carbonatacion_Brix_${hoyISO()}.pdf`);
  toast('PDF generado', 'ok');
});

$('#xPng').addEventListener('click', async () => {
  const m = enRango(MEDICIONES);
  if (!m.length) return toast('No hay mediciones en el rango', 'bad');
  if (typeof html2canvas === 'undefined') {
    toast('Sin internet no se puede hacer la imagen; se abre para imprimir', 'bad');
    return imprimirTabla();
  }
  const head = ['N°','Fecha','Hora','Producto','Empaque','Orden','Tanque','P [psi]','T [°C]','CO₂ [v/v]','Estado CO₂','°Brix','Estado Brix','Otros','Analista'];
  const color = e => e === 'DENTRO' ? '#0E8F4E' : e === 'AL LÍMITE' ? '#B26A00' : e === 'FUERA' ? '#C2000B' : '#98A1AE';
  const a = $('#printArea');
  a.innerHTML = `<h2>CARBONATACIÓN &amp; BRIX — TABLA HORARIA</h2>
    <div class="meta">${m.length} mediciones · ${new Date().toLocaleString('es-BO')} · Calidad Embotellado · Embol S.A.</div>
    <table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>
    ${m.map((r, i) => `<tr>
      <td>${i + 1}</td><td>${fFecha(r.ts)}</td><td><b>${r.hora}</b></td>
      <td style="text-align:left"><b>${r.producto}</b></td>
      <td>${r.empaque || '—'}</td><td>${r.orden || '—'}</td><td>${r.tanque || '—'}</td>
      <td>${r.presion != null ? fmt(r.presion, 1) : '—'}</td>
      <td>${r.temp != null ? fmt(r.temp, 1) : '—'}</td>
      <td><b>${r.co2 != null ? fmt(r.co2) : '—'}</b></td>
      <td style="font-weight:800;color:${color(txtEst(r.estCO2))}">${txtEst(r.estCO2) || '—'}</td>
      <td><b>${r.brix != null ? fmt(r.brix) : '—'}</b></td>
      <td style="font-weight:800;color:${color(txtEst(r.estBrix))}">${txtEst(r.estBrix) || '—'}</td>
      <td>${r.otros || '—'}</td><td>${r.analista || '—'}</td></tr>`).join('')}
    </tbody></table>`;
  try {
    const canvas = await html2canvas(a, { backgroundColor: '#ffffff', scale: 2, logging: false });
    canvas.toBlob(b => {
      const u = URL.createObjectURL(b);
      const el = document.createElement('a');
      el.href = u; el.download = `Carbonatacion_Brix_${hoyISO()}.png`; el.click();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
      toast('Imagen generada', 'ok');
    }, 'image/png');
  } catch (e) { console.error(e); toast('No se pudo generar la imagen', 'bad'); }
  a.innerHTML = '';
});

/* ── Respaldo ─────────────────────────────────────────────────────────────
   Los registros viven solo en este celular. Si se limpian los datos del
   navegador o se desinstala la app, se pierden. Por eso la app lleva la cuenta
   de lo que aún no se ha respaldado y lo avisa en la pestaña Registros.      */

function hacerRespaldo(silencioso) {
  const datos = { version: 2, exportado: new Date().toISOString(),
    mediciones: MEDICIONES, muestras: MUESTRAS, tanques: TANQUES, produccion: PROD };
  descargar(`respaldo_carbonatacion_${hoyISO()}.json`,
            JSON.stringify(datos, null, 2), 'application/json');
  CFG.ultimoRespaldo = Date.now();
  guardarCfg();
  renderAvisoRespaldo();
  if (!silencioso) toast('Respaldo guardado en el celular', 'ok');
}
$('#xBackup').addEventListener('click', () => hacerRespaldo(false));
$('#arBoton').addEventListener('click', () => hacerRespaldo(false));

/** Registros guardados después del último respaldo */
function sinRespaldar() {
  const desde = CFG.ultimoRespaldo || 0;
  return [...MEDICIONES, ...MUESTRAS, ...TANQUES].filter(r => (r.guardadoEn || r.ts) > desde).length;
}
function renderAvisoRespaldo() {
  const n = sinRespaldar();
  const a = $('#avisoRespaldo');
  if (!n) { a.hidden = true; return; }
  a.hidden = false;
  $('#arTitulo').textContent = n === 1 ? '1 registro sin respaldar' : `${n} registros sin respaldar`;
  $('#arDetalle').textContent = CFG.ultimoRespaldo
    ? `Último respaldo: ${fFecha(CFG.ultimoRespaldo)} ${fHora(CFG.ultimoRespaldo)}. Si limpias los datos del navegador se pierden.`
    : 'Los registros se guardan solo en este celular. Si limpias los datos del navegador se pierden.';
}
$('#xRestore').addEventListener('click', () => $('#xFile').click());
$('#xFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    const nm = (d.mediciones || []).length, ns = (d.muestras || d.sensoriales || []).length, nt = (d.tanques || []).length;
    if (!nm && !ns && !nt) throw 0;
    if (!confirm(`Se importarán ${nm} mediciones, ${ns} muestras y ${nt} cambios de tanque. ¿Continuar?`)) return;
    (d.mediciones || []).forEach(r => { r.id = nuevoId(MEDICIONES); MEDICIONES.push(r); });
    (d.muestras || []).forEach(r => { r.id = nuevoId(MUESTRAS); MUESTRAS.push(r); });
    (d.tanques || []).forEach(r => { r.id = nuevoId(TANQUES); TANQUES.push(r); });
    LS.escribir(K.mediciones, MEDICIONES); LS.escribir(K.muestras, MUESTRAS); LS.escribir(K.tanques, TANQUES);
    renderMediciones(); renderTanques(); renderMuestras(); contarExport(); renderGrafica(); renderAvisoRespaldo();
    toast('Respaldo importado', 'ok');
  } catch { toast('Archivo inválido', 'bad'); }
  e.target.value = '';
});
$('#xBorrar').addEventListener('click', () => {
  if (!confirm('Esto borrará TODAS las mediciones, muestras y cambios de tanque. ¿Continuar?')) return;
  MEDICIONES = []; MUESTRAS = []; TANQUES = [];
  LS.escribir(K.mediciones, []); LS.escribir(K.muestras, []); LS.escribir(K.tanques, []);
  CFG.ultimoRespaldo = Date.now(); guardarCfg();
  renderMediciones(); renderTanques(); renderMuestras(); contarExport(); renderGrafica(); renderAvisoRespaldo();
  toast('Registros borrados');
});

/* ══════════════════ 12 · ESPECIFICACIONES ══════════════════ */

function parametrosDe(p) {
  const lista = [];
  if (p.brix) lista.push({ id: 'brix', n: p.brix.label, lei: p.brix.lei, obj: p.brix.obj, les: p.brix.les });
  p.co2.forEach((c, i) => lista.push({ id: 'co2' + i, n: 'CO₂ [v/v] ' + c.pack, lei: c.lei, obj: c.obj, les: c.les }));
  p.otros.forEach((o, i) => lista.push({ id: 'otro' + i, n: o.n, lei: o.lei, obj: o.obj, les: o.les }));
  return lista;
}
function renderVerif() {
  const p = prodActual(), clave = p.cat + '|' + p.prod;
  const vals = S.verif[clave] || {};
  const t = $('#tablaVerif');
  t.innerHTML = `<thead><tr><th>Parámetro</th><th>LEI</th><th>OBJ</th><th>LES</th><th>Medido</th><th></th></tr></thead>
  <tbody>${parametrosDe(p).map(par => {
    const v = num(vals[par.id]);
    const est = evaluar(v, par.lei, par.les);
    const punto = est == null ? '#C3C9D3' : est === 'ok' ? 'var(--ok)' : est === 'warn' ? 'var(--warn)' : 'var(--bad)';
    return `<tr><td>${par.n}</td><td>${fx(par.lei)}</td><td><b>${fx(par.obj)}</b></td><td>${fx(par.les)}</td>
      <td><input type="text" inputmode="decimal" enterkeyhint="done" data-par="${par.id}"
        value="${vals[par.id] || ''}" style="width:88px;padding:8px 10px;font-size:14px;text-align:center"></td>
      <td><span style="display:inline-block;width:13px;height:13px;border-radius:50%;background:${punto}"></span></td></tr>`;
  }).join('')}</tbody>`;
  t.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => {
      if (!S.verif[clave]) S.verif[clave] = {};
      S.verif[clave][inp.dataset.par] = inp.value;
      guardarEstado();
      const par = parametrosDe(p).find(x => x.id === inp.dataset.par);
      const est = evaluar(num(inp.value), par.lei, par.les);
      const punto = inp.parentElement.nextElementSibling.querySelector('span');
      punto.style.background = est == null ? '#C3C9D3' : est === 'ok' ? 'var(--ok)' : est === 'warn' ? 'var(--warn)' : 'var(--bad)';
    });
  });
}
function renderListaSpecs(filtro = '') {
  const f = filtro.toLowerCase();
  let html = '', catAct = '';
  DB.forEach(p => {
    const pars = parametrosDe(p);
    const coincide = !f || p.prod.toLowerCase().includes(f) || p.cat.toLowerCase().includes(f) ||
      pars.some(x => x.n.toLowerCase().includes(f));
    if (!coincide) return;
    if (p.cat !== catAct) { html += `<div class="cat-titulo">${p.cat}</div>`; catAct = p.cat; }
    html += `<div class="prod-bloque"><h4>${p.prod}</h4>`;
    pars.forEach(x => { html += `<div class="pfila"><span>${x.n}</span><span class="lims">${fx(x.lei)} · <b>${fx(x.obj)}</b> · ${fx(x.les)}</span></div>`; });
    html += '</div>';
  });
  $('#listaSpecs').innerHTML = html || '<div class="empty">Sin resultados para esa búsqueda.</div>';
}
$('#inBuscar').addEventListener('input', e => renderListaSpecs(e.target.value));

/* ══════════════════ 13 · TECLADO Y PWA ══════════════════ */

document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.keyCode === 13) && e.target && e.target.tagName === 'INPUT' && e.target.type !== 'search') {
    e.preventDefault(); e.target.blur();
  }
});

/**
 * Botón «Instalar».
 *
 * Chrome avisa que la app se puede instalar con el evento beforeinstallprompt,
 * pero ese evento NO se dispara en varios casos comunes:
 *   · la app ya está instalada en ese celular
 *   · la página se abrió como archivo local en vez de por https
 *   · el navegador es Safari (iPhone y iPad nunca lo disparan)
 *
 * Para que el analista no se quede sin saber qué hacer, el botón se muestra
 * igual y, cuando no hay instalación automática, explica cómo hacerlo a mano
 * según el equipo que esté usando.
 */
let deferred = null;

const yaInstalada = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const esMovil = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

function instruccionesInstalar() {
  const local = location.protocol === 'file:';
  let titulo = 'Instalar la app', pasos = '', nota = '';

  if (local) {
    titulo = 'Falta publicar la app';
    pasos = `<div class="paso-i"><b>!</b><span>Esta página se abrió como archivo del computador, y así el navegador no permite instalarla.</span></div>
             <div class="paso-i"><b>1</b><span>Sube la carpeta a GitHub Pages o a la intranet.</span></div>
             <div class="paso-i"><b>2</b><span>Abre la dirección <em>https://…</em> en el celular y vuelve a tocar Instalar.</span></div>`;
  } else if (esIOS()) {
    pasos = `<div class="paso-i"><b>1</b><span>Abre esta página en <em>Safari</em>. Desde Chrome no aparece la opción.</span></div>
             <div class="paso-i"><b>2</b><span>Toca el botón <em>Compartir</em>, el cuadrito con la flecha hacia arriba.</span></div>
             <div class="paso-i"><b>3</b><span>Desliza y elige <em>Agregar a inicio</em>.</span></div>`;
  } else if (esMovil()) {
    pasos = `<div class="paso-i"><b>1</b><span>Toca el menú <em>⋮</em> arriba a la derecha del navegador.</span></div>
             <div class="paso-i"><b>2</b><span>Elige <em>Instalar aplicación</em> o <em>Agregar a pantalla principal</em>.</span></div>`;
  } else {
    pasos = `<div class="paso-i"><b>1</b><span>En la barra de direcciones, a la derecha, toca el ícono de <em>instalar</em>.</span></div>
             <div class="paso-i"><b>2</b><span>Si no lo ves, entra al menú <em>⋮</em> y elige <em>Instalar…</em></span></div>`;
  }

  if (!local) {
    nota = `<div class="nota-i"><b>¿No aparece la opción?</b> Casi siempre es porque la app ya está
            instalada en este equipo. Búscala entre tus aplicaciones. Si quieres reinstalarla,
            desinstálala primero y vuelve a abrir esta página.</div>`;
  }
  return { titulo, html: pasos + nota };
}

function abrirInstalar() {
  const { titulo, html } = instruccionesInstalar();
  $('#tituloInstalar').textContent = titulo;
  $('#pasosInstalar').innerHTML = html;
  $('#modalInstalar').hidden = false;
}
$('#cerrarInstalar').addEventListener('click', () => { $('#modalInstalar').hidden = true; });
$('#modalInstalar').addEventListener('click', e => {
  if (e.target.id === 'modalInstalar') $('#modalInstalar').hidden = true;
});

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferred = e;
  $('#btnInstall').hidden = false;
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  $('#btnInstall').hidden = true;
  toast('App instalada en el celular', 'ok');
});

$('#btnInstall').addEventListener('click', async () => {
  if (deferred) {
    deferred.prompt();
    const r = await deferred.userChoice;
    deferred = null;
    if (r && r.outcome === 'accepted') $('#btnInstall').hidden = true;
    return;
  }
  abrirInstalar();
});

/* Si el navegador no ofreció la instalación automática, el botón se muestra
   igual para poder explicar cómo hacerlo a mano. */
setTimeout(() => {
  if (!yaInstalada()) $('#btnInstall').hidden = false;
}, 2000);

if ('serviceWorker' in navigator)
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

/* Cuenta regresiva y chequeo de avisos cada 30 s */
setInterval(() => {
  renderProduccion();
  if (CFG.sensAvisos && PROD.activa && Notification.permission === 'granted' && proximaMuestra() - Date.now() <= 0)
    avisarMuestra();
}, 30000);

window.addEventListener('resize', () => { if ($('#view-registros').classList.contains('active')) renderGrafica(); });

/* ══════════════════ 14 · INICIO ══════════════════ */

(function init() {
  iniciarSelectores();
  renderListaSpecs();
  $('#inHora').value = ahoraLocal();
  $('#pInicio').value = ahoraLocal();
  $('#inAnalista').value = CFG.analista || '';

  if (PROD.activa) {
    $('#inOrden').value = PROD.orden || '';
    $('#inTanque').value = PROD.tanque || '';
  }

  if (CFG.sensAvisos && (!('Notification' in window) || Notification.permission !== 'granted'))
    CFG.sensAvisos = false;
  $('#swSensorial').checked = CFG.sensAvisos;
  $('#btnProbarSens').hidden = !CFG.sensAvisos;
  if (CFG.sensAvisos)
    $('#sensSwTxt').textContent = 'Avisará con sonido cuando toque llevar la muestra (app abierta)';

  renderMediciones(); renderTanques(); renderProduccion(); contarExport(); renderGrafica(); renderAvisoRespaldo();
  programarAviso();

  /* Restaurar pestaña */
  const t = document.querySelector(`.tab[data-view="${S.view}"]`);
  if (t && S.view !== 'medicion') t.click();
})();

window.borrarMed = borrarMed;
window.borrarMuestra = borrarMuestra;
window.borrarTq = borrarTq;
