/* =====================================================================
   CODIFICADO · Verificación de fecha de vencimiento
   Calidad Embotellado · Embol S.A. · Planta La Paz

   1) Producto, envase y tamaño       → estándar de edad y % de reciclado
   2) Fecha y hora de embotellado     → código que DEBE salir en la botella
   3) Foto del código real            → comparación lado a lado
   4) Resultado, ajuste del electrónico y registro con foto
   ===================================================================== */
'use strict';

/* ══════════════════ 1 · UTILIDADES ══════════════════ */

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const dd = n => String(n).padStart(2, '0');

function num(v) {
  const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10);
  return isFinite(n) ? n : NaN;
}
function hoyISO() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
function ahoraLocal() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
function fechaISO(d) { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }
function fFecha(ts) { const d = new Date(ts); return isNaN(d) ? '—' : d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function fHora(ts) { const d = new Date(ts); return isNaN(d) ? '—' : d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }); }
function fFechaLarga(ts) { const d = new Date(ts); return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }); }

let toastT;
function toast(msg, tipo = '') {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show ' + tipo;
  clearTimeout(toastT); toastT = setTimeout(() => t.className = 'toast ' + tipo, 3200);
}

/* ══════════════════ 2 · GENERACIÓN DEL CÓDIGO ══════════════════ */

/**
 * Arma el código tal como debe quedar impreso en la botella.
 *
 *   V24SEP26 LP4     vencimiento: mes en TRES LETRAS
 *   L260626 12:00    lote: mes en DOS DÍGITOS
 *   PET-PCR 30%      solo en PET no retornable
 */
function generarCodigo(producto, envaseId, ml, fechaLote, linea, preforma) {
  const regla = reglaDe(producto, envaseId, ml, preforma);
  if (!regla) return { error: 'sin-regla' };

  const d = new Date(fechaLote);
  if (isNaN(d)) return { error: 'sin-fecha' };

  const vence = new Date(d.getTime() + regla.dias * 86400000);
  const envase = ENVASES.find(e => e.id === envaseId);
  const llevaPCR = envase && envase.pcr && regla.pcr != null;

  return {
    linea1: 'V' + dd(vence.getDate()) + MESES[vence.getMonth()] + String(vence.getFullYear()).slice(2)
            + ' ' + PLANTA + linea,
    linea2: 'L' + dd(d.getDate()) + dd(d.getMonth() + 1) + String(d.getFullYear()).slice(2)
            + ' ' + dd(d.getHours()) + ':' + dd(d.getMinutes()),
    linea3: llevaPCR ? 'PET-PCR ' + regla.pcr + '%' : null,
    dias: regla.dias, pcr: llevaPCR ? regla.pcr : null,
    vence: vence.getTime(), nota: regla.nota || null, regla: regla.id
  };
}

const lineasDe = c => [c.linea1, c.linea2, c.linea3].filter(Boolean);
const textoCodigo = c => lineasDe(c).join('\n');

/* Explicación parte por parte, con los valores reales del código en pantalla */
function desglosarCodigo(c, linea) {
  if (!c || c.error) return [];
  const v = new Date(c.vence);
  return [
    ['V', 'Fecha de consumo preferente. Es hasta cuándo el producto mantiene la especificación.'],
    [dd(v.getDate()), 'Día en que termina el estándar de edad.'],
    [MESES[v.getMonth()], 'Mes del vencimiento, en tres letras.'],
    [String(v.getFullYear()).slice(2), 'Últimos dos dígitos del año de vencimiento.'],
    [PLANTA + linea, 'Planta La Paz y número de la línea de embotellado.'],
    ['L', 'Lote de producción.'],
    [c.linea2.slice(1, 7), 'Día, mes y año del embotellado. Aquí el mes va en NÚMEROS.'],
    [c.linea2.slice(8), 'Hora y minuto en que se embotelló.'],
    ...(c.linea3 ? [[c.linea3, 'Indica que el envase se fabricó con PET reciclado, y en qué porcentaje.']] : [])
  ];
}

/* ══════════════════ 3 · ALMACENAMIENTO ══════════════════
   Las fotos pesan bastante, así que los registros van en IndexedDB.
   Los ajustes menudos (analista, electrónicos) van en localStorage.        */

const LS = {
  leer(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  escribir(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast('No se pudo guardar', 'bad'); } }
};
const K = { cfg: 'codif:config', estado: 'codif:estado' };

let CFG = Object.assign(
  { analista: '', electronicos: [], analistas: [], ultimoRespaldo: 0, avisos: false },
  LS.leer(K.cfg, {}));
const guardarCfg = () => LS.escribir(K.cfg, CFG);

/** Base de datos de verificaciones, con respaldo automático a localStorage */
const DB = (() => {
  const NOMBRE = 'codificado-db', STORE = 'verificaciones', LS_KEY = 'codif:verificaciones';
  let db = null, modo = null, abriendo = null;

  const ls = {
    todo() { return LS.leer(LS_KEY, []); },
    put(r) {
      const l = this.todo();
      if (r.id == null) r.id = (l.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1;
      const i = l.findIndex(x => x.id === r.id);
      i >= 0 ? l[i] = r : l.push(r);
      LS.escribir(LS_KEY, l); return r.id;
    },
    del(id) { LS.escribir(LS_KEY, this.todo().filter(x => x.id !== id)); },
    limpiar() { LS.escribir(LS_KEY, []); }
  };

  function abrir() {
    return new Promise((res, rej) => {
      let rq;
      try { rq = indexedDB.open(NOMBRE, 1); } catch (e) { return rej(e); }
      rq.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE))
          d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      };
      rq.onsuccess = e => res(e.target.result);
      rq.onerror = () => rej(rq.error);
      rq.onblocked = () => rej(new Error('bloqueada'));
      setTimeout(() => rej(new Error('sin respuesta')), 4000);
    });
  }
  function listo() {
    if (abriendo) return abriendo;
    abriendo = abrir().then(d => { db = d; modo = 'idb'; })
      .catch(e => { modo = 'ls'; console.warn('IndexedDB no disponible:', e && e.message); });
    return abriendo;
  }
  const w = rq => new Promise((res, rej) => { rq.onsuccess = e => res(e.target.result); rq.onerror = () => rej(rq.error); });
  const st = m => db.transaction(STORE, m).objectStore(STORE);

  async function op(fnIdb, fnLs) {
    await listo();
    if (modo === 'idb') {
      try { return await fnIdb(); }
      catch (e) { console.warn('Fallo IndexedDB, se pasa a localStorage:', e && e.message); modo = 'ls'; }
    }
    return fnLs();
  }
  return {
    todo()  { return op(() => w(st('readonly').getAll()), () => ls.todo()); },
    put(r)  { return op(() => w(st('readwrite').put(r)),  () => ls.put(r)); },
    del(id) { return op(() => w(st('readwrite').delete(id)), () => ls.del(id)); },
    limpiar() { return op(() => w(st('readwrite').clear()), () => ls.limpiar()); }
  };
})();

let REGISTROS = [];

/* ══════════════════ 4 · NAVEGACIÓN ══════════════════ */

$$('.tab').forEach(t => t.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.remove('active'));
  $$('.view').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $('#view-' + t.dataset.view).classList.add('active');
  window.scrollTo(0, 0);
  if (t.dataset.view === 'registros') { renderRegistros(); contarExport(); renderAvisoRespaldo(); }
}));

/* ══════════════════ 5 · ESTADO DEL FORMULARIO ══════════════════ */

let S = Object.assign({
  cat: '', prod: '', envase: 'petnr', ml: '', preforma: false,
  fechaLote: '', linea: LINEAS[0],
  resultado: null, fallas: [], turno: ''
}, LS.leer(K.estado, {}));

let FOTO = null, FOTO2 = null;   // imágenes en base64, se pierden al limpiar

const guardarEstado = () => LS.escribir(K.estado, {
  cat: S.cat, prod: S.prod, envase: S.envase, ml: S.ml,
  preforma: S.preforma, linea: S.linea, turno: S.turno
});

const productoActual = () => PRODUCTOS.find(p => p.nombre === S.prod) || null;

/* ══════════════════ 6 · SELECTORES ══════════════════ */

const FALLAS = ['Fecha de vencimiento', 'Fecha de lote', 'Hora', 'Línea', 'PET-PCR',
                'Código ilegible', 'Código incompleto', 'Sin código', 'Posición del código'];

function iniciarSelectores() {
  const cats = [...new Set(PRODUCTOS.map(p => p.cat))];
  if (!cats.includes(S.cat)) S.cat = cats[0];
  $('#selCategoria').innerHTML = cats.map(c => `<option ${c === S.cat ? 'selected' : ''}>${c}</option>`).join('');
  llenarProductos();

  $('#selEnvase').innerHTML = ENVASES.map(e =>
    `<option value="${e.id}" ${e.id === S.envase ? 'selected' : ''}>${e.nombre}</option>`).join('');

  $('#quickTamanos').innerHTML = TAMANOS.map(t => `<button type="button" data-ml="${t}">${t}</button>`).join('');
  $('#quickLineas').innerHTML = LINEAS.map(l =>
    `<button type="button" data-linea="${l}" class="${l === S.linea ? 'sel' : ''}">${PLANTA}${l}</button>`).join('');
  $('#quickFallas').innerHTML = FALLAS.map(f => `<button type="button" data-falla="${f}">${f}</button>`).join('');

  $('#dlAnalistas').innerHTML = (CFG.analistas || []).map(a => `<option value="${a}">`).join('');
  $('#dlElectronicos').innerHTML = (CFG.electronicos || []).map(a => `<option value="${a}">`).join('');
}
function llenarProductos() {
  const l = PRODUCTOS.filter(p => p.cat === S.cat);
  if (!l.some(p => p.nombre === S.prod)) S.prod = l[0].nombre;
  $('#selProducto').innerHTML = l.map(p =>
    `<option ${p.nombre === S.prod ? 'selected' : ''}>${p.nombre}</option>`).join('');
}

$('#selCategoria').addEventListener('change', e => { S.cat = e.target.value; llenarProductos(); refrescar(); guardarEstado(); });
$('#selProducto').addEventListener('change', e => { S.prod = e.target.value; refrescar(); guardarEstado(); });
$('#selEnvase').addEventListener('change', e => { S.envase = e.target.value; refrescar(); guardarEstado(); });
$('#inTamano').addEventListener('input', e => { S.ml = e.target.value; refrescar(); guardarEstado(); });
$('#chkPreforma').addEventListener('change', e => { S.preforma = e.target.checked; refrescar(); guardarEstado(); });
$('#inFechaLote').addEventListener('input', () => refrescar());
$('#inTurno').addEventListener('change', e => { S.turno = e.target.value; guardarEstado(); });

$('#quickTamanos').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.ml = b.dataset.ml; $('#inTamano').value = S.ml;
  refrescar(); guardarEstado();
});
$('#quickLineas').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.linea = b.dataset.linea;
  $$('#quickLineas button').forEach(x => x.classList.toggle('sel', x === b));
  refrescar(); guardarEstado();
});
$('#quickFallas').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const f = b.dataset.falla;
  S.fallas = S.fallas.includes(f) ? S.fallas.filter(x => x !== f) : [...S.fallas, f];
  b.classList.toggle('sel');
});

/* ══════════════════ 7 · REFRESCO DE LA PANTALLA ══════════════════ */

let CODIGO = null;

function refrescar() {
  const p = productoActual();
  const ml = num(S.ml);
  const fecha = $('#inFechaLote').value;

  /* La preforma solo aplica a PET no retornable de 500 ml */
  $('#filaPreforma').hidden = !(S.envase === 'petnr' && ml === 500);
  if ($('#filaPreforma').hidden && S.preforma) { S.preforma = false; $('#chkPreforma').checked = false; }

  const cajas = [$('#codigoCaja'), $('#codigoChico')];
  const c = (p && isFinite(ml) && fecha) ? generarCodigo(p, S.envase, ml, fecha, S.linea, S.preforma) : null;
  CODIGO = (c && !c.error) ? c : null;

  const sinRegla = !!(c && c.error === 'sin-regla');
  $('#sinRegla').hidden = !sinRegla;

  if (!CODIGO) {
    const txt = sinRegla ? 'SIN REGLA' : 'COMPLETA LOS DATOS';
    cajas.forEach(caja => caja.querySelector('.codigo-lineas').innerHTML = `<div class="cl vacio">${txt}</div>`);
    $('#datosVigencia').hidden = true;
    $('#notaRegla').hidden = true;
    $('#desglose').innerHTML = '';
    return;
  }

  const html = lineasDe(CODIGO).map(l => `<div class="cl">${l}</div>`).join('');
  cajas.forEach(caja => caja.querySelector('.codigo-lineas').innerHTML = html);

  $('#datosVigencia').hidden = false;
  $('#mDias').textContent = CODIGO.dias;
  $('#mVence').textContent = fFechaLarga(CODIGO.vence);
  $('#mPcr').textContent = CODIGO.pcr != null ? CODIGO.pcr + ' %' : 'No aplica';

  $('#notaRegla').hidden = !CODIGO.nota;
  if (CODIGO.nota) $('#notaRegla').textContent = CODIGO.nota;

  $('#desglose').innerHTML = desglosarCodigo(CODIGO, S.linea)
    .map(([a, b]) => `<div class="dg"><b>${a}</b><span>${b}</span></div>`).join('');
}

$('#btnCopiar').addEventListener('click', async () => {
  if (!CODIGO) return toast('Todavía no hay código que copiar', 'bad');
  const t = textoCodigo(CODIGO);
  try { await navigator.clipboard.writeText(t); toast('Código copiado', 'ok'); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Código copiado', 'ok'); }
    catch { toast('No se pudo copiar', 'bad'); }
    ta.remove();
  }
});

/* ══════════════════ 8 · FOTOS ══════════════════ */

/**
 * Las fotos de celular pesan varios megas y hay que guardarlas en el equipo,
 * así que se reducen antes de almacenarlas. 1400 px de lado mayor deja el
 * código perfectamente legible ocupando una fracción del espacio.
 */
function comprimirFoto(archivo, maxLado = 1400, calidad = 0.75) {
  return new Promise((res, rej) => {
    const lector = new FileReader();
    lector.onerror = () => rej(new Error('no se pudo leer la foto'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error('archivo de imagen inválido'));
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const w = Math.round(img.width * escala), h = Math.round(img.height * escala);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        res(cv.toDataURL('image/jpeg', calidad));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

function conectarFoto(idInput, idBoton, idPrev, alGuardar) {
  $(idBoton).addEventListener('click', () => $(idInput).click());
  $(idInput).addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      toast('Procesando la foto…');
      const b64 = await comprimirFoto(f);
      $(idPrev).src = b64;
      alGuardar(b64);
      toast('Foto lista', 'ok');
    } catch (err) { console.error(err); toast('No se pudo usar esa foto', 'bad'); }
    e.target.value = '';
  });
}
conectarFoto('#inFoto', '#btnFoto', '#fotoPrev', b64 => {
  FOTO = b64;
  $('#comparacion').hidden = false;
  $('#ayudaFoto').textContent = 'Compara las tres líneas: si algo no calza, marca «No coincide» abajo.';
});
conectarFoto('#inFoto2', '#btnFoto2', '#fotoPrev2', b64 => {
  FOTO2 = b64; $('#marcoFoto2').hidden = false;
});
$('#btnQuitarFoto').addEventListener('click', () => {
  FOTO = null; $('#comparacion').hidden = true;
  $('#ayudaFoto').textContent = 'Acerca la cámara al código impreso y procura que se lean las tres líneas.';
});
$('#btnQuitarFoto2').addEventListener('click', () => { FOTO2 = null; $('#marcoFoto2').hidden = true; });

/* ══════════════════ 9 · RESULTADO ══════════════════ */

function pintarResultado() {
  $('#rbConforme').classList.toggle('sel', S.resultado === 'ok');
  $('#rbNoConforme').classList.toggle('sel', S.resultado === 'bad');
  $('#bloqueFalla').hidden = S.resultado !== 'bad';
  if (S.resultado === 'bad' && !$('#inHoraAjuste').value) $('#inHoraAjuste').value = ahoraLocal();
}
$('#rbConforme').addEventListener('click', () => { S.resultado = 'ok'; S.fallas = []; $$('#quickFallas button').forEach(b => b.classList.remove('sel')); pintarResultado(); });
$('#rbNoConforme').addEventListener('click', () => { S.resultado = 'bad'; pintarResultado(); });

/* ══════════════════ 10 · GUARDAR ══════════════════ */

function recordarNombre(lista, nombre) {
  if (!nombre) return;
  const l = CFG[lista] || [];
  if (!l.includes(nombre)) { CFG[lista] = [nombre, ...l].slice(0, 20); guardarCfg(); }
}

$('#btnGuardar').addEventListener('click', async () => {
  if (!CODIGO) return toast('Falta completar el producto, el tamaño o la fecha del lote', 'bad');
  if (!S.resultado) return toast('Marca si el código coincide o no', 'bad');
  const analista = $('#inAnalista').value.trim();
  if (!analista) return toast('Anota tu nombre en Analista', 'bad');
  if (S.resultado === 'bad' && !S.fallas.length) return toast('Marca qué está mal en el código', 'bad');

  const p = productoActual();
  const envase = ENVASES.find(e => e.id === S.envase);
  const ahora = Date.now();
  const electronico = $('#inElectronico').value.trim();

  const reg = {
    ts: ahora, guardadoEn: ahora, fecha: fechaISO(ahora),
    producto: p.nombre, codigoProducto: p.codigo, categoria: p.cat,
    envase: envase.nombre, envaseId: envase.id, ml: num(S.ml), preforma: !!S.preforma,
    linea: PLANTA + S.linea,
    loteFecha: $('#inFechaLote').value,
    codigo1: CODIGO.linea1, codigo2: CODIGO.linea2, codigo3: CODIGO.linea3,
    dias: CODIGO.dias, pcr: CODIGO.pcr, vence: CODIGO.vence, regla: CODIGO.regla,
    resultado: S.resultado,
    fallas: S.resultado === 'bad' ? [...S.fallas] : [],
    electronico: S.resultado === 'bad' ? electronico : '',
    horaAjuste: S.resultado === 'bad' ? $('#inHoraAjuste').value : '',
    analista, turno: $('#inTurno').value,
    obs: $('#inObs').value.trim(),
    foto: FOTO, foto2: S.resultado === 'bad' ? FOTO2 : null
  };

  const btn = $('#btnGuardar'), txt = btn.textContent;
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await DB.put(reg);
    REGISTROS = await DB.todo();
    recordarNombre('analistas', analista);
    if (electronico) recordarNombre('electronicos', electronico);
    CFG.analista = analista; guardarCfg();
    $('#dlAnalistas').innerHTML = (CFG.analistas || []).map(a => `<option value="${a}">`).join('');
    $('#dlElectronicos').innerHTML = (CFG.electronicos || []).map(a => `<option value="${a}">`).join('');
    limpiarFormulario(true);
    renderRegistros(); contarExport(); renderAvisoRespaldo();
    toast(`Verificación guardada · ${REGISTROS.length} en total`, 'ok');
  } catch (e) {
    console.error(e);
    toast('No se pudo guardar: ' + (e && e.message ? e.message : 'error'), 'bad');
  } finally { btn.disabled = false; btn.textContent = txt; }
});

function limpiarFormulario(conservarProducto) {
  FOTO = null; FOTO2 = null;
  S.resultado = null; S.fallas = [];
  $('#comparacion').hidden = true;
  $('#marcoFoto2').hidden = true;
  $('#inObs').value = '';
  $('#inElectronico').value = '';
  $('#inHoraAjuste').value = '';
  $$('#quickFallas button').forEach(b => b.classList.remove('sel'));
  $('#ayudaFoto').textContent = 'Acerca la cámara al código impreso y procura que se lean las tres líneas.';
  pintarResultado();
  if (!conservarProducto) { $('#inFechaLote').value = ahoraLocal(); refrescar(); }
}
$('#btnLimpiar').addEventListener('click', () => {
  limpiarFormulario(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ══════════════════ 11 · LISTA DE REGISTROS ══════════════════ */

function filtrados() {
  const q = $('#regBuscar').value.trim().toLowerCase();
  let l = [...REGISTROS].sort((a, b) => (b.ts - a.ts) || (b.id - a.id));
  if (q) l = l.filter(r => [r.producto, r.analista, r.electronico, r.envase, r.linea,
    r.codigo1, r.codigo2, r.obs, r.fecha].join(' ').toLowerCase().includes(q));
  return l;
}
function renderRegistros() {
  const l = filtrados();
  $('#regCount').textContent = REGISTROS.length;

  const ok = REGISTROS.filter(r => r.resultado === 'ok').length;
  const mal = REGISTROS.length - ok;
  $('#regResumen').innerHTML = REGISTROS.length ? `
    <div class="rs ok"><b>${ok}</b><span>Conformes</span></div>
    <div class="rs ba"><b>${mal}</b><span>No conformes</span></div>
    <div class="rs"><b>${REGISTROS.length ? Math.round(ok / REGISTROS.length * 100) : 0}%</b><span>Cumplimiento</span></div>` : '';

  $('#regLista').innerHTML = l.length ? l.map(r => `
    <div class="item ${r.resultado === 'bad' ? 'ba' : ''}">
      <div class="item-top">
        <div><div class="item-t">${r.producto}</div>
        <div class="item-s">${fFecha(r.ts)} · ${fHora(r.ts)} · ${r.envase} ${r.ml} ml · ${r.linea}</div></div>
        <span class="pill ${r.resultado}">${r.resultado === 'ok' ? 'CONFORME' : 'NO CONFORME'}</span>
      </div>
      <div class="item-cod">${[r.codigo1, r.codigo2, r.codigo3].filter(Boolean).join('\n')}</div>
      ${r.foto ? `<img class="item-foto" src="${r.foto}" alt="Foto del código">` : ''}
      <div class="item-tags">
        <span class="tag">${r.analista}</span>
        ${r.fallas && r.fallas.length ? r.fallas.map(f => `<span class="tag ba">${f}</span>`).join('') : ''}
        ${r.electronico ? `<span class="tag agua">Ajustó ${r.electronico}</span>` : ''}
      </div>
      <div class="item-acts">
        <button onclick="verDetalle(${r.id})">Ver ficha</button>
        <button class="del" onclick="borrarRegistro(${r.id})">Borrar</button>
      </div>
    </div>`).join('')
    : '<div class="empty">Sin verificaciones todavía.<br>Guarda una desde la pestaña Verificar.</div>';
}
$('#regBuscar').addEventListener('input', renderRegistros);

function verDetalle(id) {
  const r = REGISTROS.find(x => x.id === id); if (!r) return;
  $('#detTitulo').textContent = r.producto;
  const fila = (a, b) => `<div class="det-fila"><span>${a}</span><b>${b || '—'}</b></div>`;
  $('#detCuerpo').innerHTML = `
    <div class="codigo-caja" style="margin-bottom:14px">
      <div class="codigo-lineas">${[r.codigo1, r.codigo2, r.codigo3].filter(Boolean)
        .map(l => `<div class="cl">${l}</div>`).join('')}</div>
    </div>
    <span class="pill ${r.resultado}" style="display:inline-block;margin-bottom:10px">
      ${r.resultado === 'ok' ? 'CONFORME' : 'NO CONFORME'}</span>
    ${fila('Verificado el', fFecha(r.ts) + ' ' + fHora(r.ts))}
    ${fila('Envase', r.envase + ' · ' + r.ml + ' ml' + (r.preforma ? ' · preforma Preforsa' : ''))}
    ${fila('Línea', r.linea)}
    ${fila('Embotellado', r.loteFecha ? fFecha(r.loteFecha) + ' ' + fHora(r.loteFecha) : '—')}
    ${fila('Estándar de edad', r.dias + ' días')}
    ${fila('Vence', fFechaLarga(r.vence))}
    ${fila('Reciclado', r.pcr != null ? r.pcr + ' %' : 'No aplica')}
    ${fila('Analista', r.analista + (r.turno ? ' · ' + r.turno : ''))}
    ${r.fallas && r.fallas.length ? fila('Fallas', r.fallas.join(', ')) : ''}
    ${r.electronico ? fila('Electrónico', r.electronico) : ''}
    ${r.horaAjuste ? fila('Hora del ajuste', fFecha(r.horaAjuste) + ' ' + fHora(r.horaAjuste)) : ''}
    ${r.obs ? fila('Observaciones', r.obs) : ''}
    ${r.foto ? `<p class="under" style="margin-top:14px"><b>Foto de la botella</b></p><img class="det-foto" src="${r.foto}">` : ''}
    ${r.foto2 ? `<p class="under" style="margin-top:14px"><b>Después del ajuste</b></p><img class="det-foto" src="${r.foto2}">` : ''}`;
  $('#detBorrar').onclick = () => { $('#modalDetalle').hidden = true; borrarRegistro(id); };
  $('#modalDetalle').hidden = false;
}
$('#detCerrar').addEventListener('click', () => $('#modalDetalle').hidden = true);
$('#modalDetalle').addEventListener('click', e => { if (e.target.id === 'modalDetalle') $('#modalDetalle').hidden = true; });

async function borrarRegistro(id) {
  if (!confirm('¿Borrar esta verificación?')) return;
  try {
    await DB.del(id);
    REGISTROS = await DB.todo();
    renderRegistros(); contarExport(); renderAvisoRespaldo();
    toast('Verificación borrada');
  } catch (e) { console.error(e); toast('No se pudo borrar', 'bad'); }
}

/* ══════════════════ 12 · TABLAS DEL ESTÁNDAR ══════════════════ */

function renderEstandar() {
  $('#desgloseFijo').innerHTML = [
    ['V', 'Fecha de consumo preferente.'],
    ['DD', 'Día en que termina el estándar de edad, de 01 a 31.'],
    ['MMM', 'Mes del vencimiento en tres letras, de ENE a DIC.'],
    ['AA', 'Últimos dos dígitos del año de vencimiento.'],
    ['LP', 'Planta embotelladora: La Paz.'],
    ['4', 'Número de la línea de embotellado.'],
    ['L', 'Lote de producción.'],
    ['dd mm aa', 'Día, mes y año del embotellado. El mes va en dos dígitos, de 01 a 12.'],
    ['HH:mm', 'Hora y minuto en que se embotelló.'],
    ['PET-PCR XX%', 'Solo aparece cuando el envase se fabricó con PET reciclado.']
  ].map(([a, b]) => `<div class="dg"><b>${a}</b><span>${b}</span></div>`).join('');

  filtrarReglas();

  $('#tablaProductos').innerHTML = `<thead><tr><th>Producto</th><th>Categoría</th><th>Código</th></tr></thead>
    <tbody>${PRODUCTOS.map(p => `<tr><td>${p.nombre}</td><td>${p.cat}</td>
      <td><span class="ab">${p.codigo}</span></td></tr>`).join('')}</tbody>`;
}

/* Se recorre la tabla de reglas mostrando un ejemplo representativo de cada una */
const EJEMPLOS = [
  ['carb_menor_litro', 'Carbonatados', 'PET no retornable, menos de 1 L'],
  ['carb_litro_o_mas', 'Carbonatados', 'PET no retornable, 1 L o más'],
  ['carb_300', 'Carbonatados', 'PET no retornable de 300 ml'],
  ['carb_preforma', 'Carbonatados', 'PET no retornable de 500 ml con preforma Preforsa 20,1 g'],
  ['retornable_sin_aspartame', 'Carbonatados sin aspartame', 'Vidrio o PET retornable'],
  ['retornable_con_aspartame', 'Carbonatados con aspartame', 'Vidrio o PET retornable'],
  ['fanta_naranja_retornable', 'Fanta Naranja', 'Vidrio o PET retornable'],
  ['ginger_tonica_990', 'Ginger Ale y Schweppes Tónica', 'PET no retornable de 990 ml'],
  ['agua_chica', 'Vital sin gas', 'PET no retornable de 600 y 750 ml'],
  ['agua_grande', 'Vital sin gas', 'PET no retornable de 2000 y 3000 ml'],
  ['isotonico', 'Powerade y Aquarius', 'Todos los envases'],
  ['jugo_dv', 'Jugos Del Valle', 'Tetrapack y PET'],
  ['ades_local', 'Jugos Ades producción local', 'Tetrapack'],
  ['ades_importado', 'Jugos Ades importado', 'Tetrapack'],
  ['fury', 'Fury', 'PET no retornable de 250 ml'],
  ['monster', 'Monster Energy', 'Lata'],
  ['bib', 'Jarabe postmix', 'Bag in Box'],
  ['tetrapack', 'Otros productos', 'Tetrapack']
];
function filtrarReglas() {
  const q = $('#buscarRegla').value.trim().toLowerCase();
  const filas = EJEMPLOS
    .map(([id, prod, env]) => ({ r: REGLAS.find(x => x.id === id), prod, env }))
    .filter(x => x.r && (!q || (x.prod + ' ' + x.env).toLowerCase().includes(q)));
  $('#tablaReglas').innerHTML = `<thead><tr><th>Producto</th><th>Envase y tamaño</th><th>Días</th><th>PET-PCR</th></tr></thead>
    <tbody>${filas.map(({ r, prod, env }) => `<tr><td>${prod}</td><td>${env}</td>
      <td><b>${r.dias}</b></td><td>${r.pcr != null ? r.pcr + ' %' : '—'}</td></tr>`).join('')}</tbody>`;
  if (!filas.length) $('#tablaReglas').innerHTML = '<tr><td style="border:0"><div class="empty">Sin resultados.</div></td></tr>';
}
$('#buscarRegla').addEventListener('input', filtrarReglas);

/* ══════════════════ 13 · EXPORTACIÓN ══════════════════ */

function enRango() {
  const d = $('#xDesde').value, h = $('#xHasta').value;
  return [...REGISTROS].filter(r => (!d || r.fecha >= d) && (!h || r.fecha <= h))
    .sort((a, b) => (a.ts - b.ts) || (a.id - b.id));
}
function contarExport() {
  const l = enRango();
  const mal = l.filter(r => r.resultado === 'bad').length;
  $('#xConteo').textContent = `${l.length} verificación${l.length === 1 ? '' : 'es'} en el rango` +
    (mal ? ` · ${mal} no conforme${mal === 1 ? '' : 's'}` : '') + ' (vacío = todas).';
}
['#xDesde', '#xHasta'].forEach(s => $(s).addEventListener('change', contarExport));

function descargar(nombre, contenido, tipo) {
  const b = new Blob([contenido], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/**
 * PDF: una ficha por verificación, con el código que debía salir y la foto de
 * la botella. Se eligió este formato porque es lo que revisa supervisión: se
 * entiende de un vistazo sin tener que interpretar una planilla.
 */
$('#xPdf').addEventListener('click', () => {
  const l = enRango();
  if (!l.length) return toast('No hay verificaciones en el rango', 'bad');
  if (!window.jspdf || !window.jspdf.jsPDF) return imprimirFichas(l);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const AN = 210, AL = 297, M = 12;

  l.forEach((r, i) => {
    if (i) doc.addPage();

    doc.setFillColor(244, 0, 9); doc.rect(0, 0, AN, 20, 'F');
    doc.setTextColor(255).setFontSize(13).setFont(undefined, 'bold');
    doc.text('VERIFICACIÓN DE CODIFICADO', M, 9.5);
    doc.setFontSize(8).setFont(undefined, 'normal');
    doc.text('Calidad Embotellado · Embol S.A. · Planta La Paz', M, 15.5);
    doc.setFontSize(8);
    doc.text(`${i + 1} de ${l.length}`, AN - M, 9.5, { align: 'right' });
    doc.text(fFecha(r.ts) + ' ' + fHora(r.ts), AN - M, 15.5, { align: 'right' });

    let y = 30;
    doc.setTextColor(26, 29, 35).setFontSize(15).setFont(undefined, 'bold');
    doc.text(r.producto, M, y);
    y += 6;
    doc.setFontSize(9.5).setFont(undefined, 'normal').setTextColor(106, 115, 130);
    doc.text(`${r.envase} · ${r.ml} ml${r.preforma ? ' · preforma Preforsa 20,1 g' : ''} · Línea ${r.linea}`, M, y);
    y += 9;

    /* Recuadro con el código esperado */
    const alto = r.codigo3 ? 30 : 23;
    doc.setFillColor(20, 23, 28); doc.roundedRect(M, y, AN - M * 2, alto, 3, 3, 'F');
    doc.setTextColor(255).setFont('courier', 'bold').setFontSize(15);
    let yc = y + 10;
    [r.codigo1, r.codigo2, r.codigo3].filter(Boolean).forEach(t => { doc.text(t, AN / 2, yc, { align: 'center' }); yc += 7.5; });
    y += alto + 8;

    /* Resultado */
    const conforme = r.resultado === 'ok';
    doc.setFillColor(...(conforme ? [234, 248, 240] : [255, 237, 237]));
    doc.roundedRect(M, y, AN - M * 2, 13, 2.5, 2.5, 'F');
    doc.setTextColor(...(conforme ? [14, 143, 78] : [194, 0, 11]));
    doc.setFont(undefined, 'bold').setFontSize(11);
    doc.text(conforme ? 'CONFORME · el código de la botella coincide'
                      : 'NO CONFORME · ' + (r.fallas || []).join(', '), M + 5, y + 8.5);
    y += 19;

    /* Datos */
    doc.setFontSize(9.5).setTextColor(26, 29, 35);
    const datos = [
      ['Embotellado', r.loteFecha ? fFecha(r.loteFecha) + '  ' + fHora(r.loteFecha) : '—'],
      ['Estándar de edad', r.dias + ' días'],
      ['Vence', fFechaLarga(r.vence)],
      ['Reciclado', r.pcr != null ? 'PET-PCR ' + r.pcr + ' %' : 'No aplica'],
      ['Analista', r.analista + (r.turno ? '  ·  ' + r.turno : '')]
    ];
    if (r.electronico) datos.push(['Electrónico que ajustó', r.electronico]);
    if (r.horaAjuste) datos.push(['Hora del ajuste', fFecha(r.horaAjuste) + '  ' + fHora(r.horaAjuste)]);
    if (r.obs) datos.push(['Observaciones', r.obs]);

    datos.forEach(([a, b]) => {
      doc.setFont(undefined, 'normal').setTextColor(106, 115, 130);
      doc.text(a, M, y);
      doc.setFont(undefined, 'bold').setTextColor(26, 29, 35);
      doc.text(String(b), M + 48, y);
      doc.setDrawColor(231, 234, 239);
      doc.line(M, y + 2.4, AN - M, y + 2.4);
      y += 7.4;
    });
    y += 4;

    /* Fotos */
    const fotos = [[r.foto, 'Foto de la botella'], [r.foto2, 'Después del ajuste']].filter(f => f[0]);
    if (fotos.length) {
      const ancho = fotos.length > 1 ? (AN - M * 2 - 6) / 2 : (AN - M * 2) * 0.62;
      const altoMax = AL - y - 18;
      fotos.forEach(([src, etq], k) => {
        const x = M + k * (ancho + 6);
        doc.setFontSize(8).setFont(undefined, 'bold').setTextColor(152, 161, 174);
        doc.text(etq.toUpperCase(), x, y);
        try {
          const props = doc.getImageProperties(src);
          const h = Math.min(ancho * props.height / props.width, altoMax);
          const w = h * props.width / props.height;
          doc.addImage(src, 'JPEG', x, y + 3, Math.min(w, ancho), h);
        } catch (e) { console.warn('foto no incrustada', e); }
      });
    }

    doc.setFontSize(7.5).setTextColor(152, 161, 174).setFont(undefined, 'normal');
    doc.text('LP-AC-E-01.10 Rev. 26 · Estándar de codificación de productos embotellados en La Paz',
      M, AL - 8);
  });

  doc.save(`Codificado_${hoyISO()}.pdf`);
  toast('PDF generado', 'ok');
});

/** Respaldo del PDF cuando la librería no está disponible (sin internet) */
function imprimirFichas(l) {
  const doc = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Codificado_${hoyISO()}</title><style>
@page{margin:12mm}
body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#14171C;margin:0}
.f{page-break-after:always;padding-bottom:10px}
.f:last-child{page-break-after:auto}
.hd{background:#F40009;color:#fff;padding:10px 14px;border-radius:6px}
.hd b{font-size:14px}.hd span{display:block;font-size:10px;opacity:.9}
h2{font-size:16px;margin:12px 0 2px}
.sub{font-size:11px;color:#6A7382;margin-bottom:10px}
.cod{background:#14171C;color:#fff;border-radius:8px;padding:14px;text-align:center;
  font-family:'Courier New',monospace;font-weight:bold;font-size:17px;line-height:1.5;white-space:pre-line}
.res{margin:10px 0;padding:9px 12px;border-radius:6px;font-weight:bold;font-size:12px}
.ok{background:#EAF8F0;color:#0E8F4E}.bad{background:#FFEDED;color:#C2000B}
table{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px}
td{padding:6px 2px;border-bottom:1px solid #E7EAEF}
td:first-child{color:#6A7382;width:42%}
td:last-child{font-weight:bold}
img{max-width:62%;border-radius:8px;margin-top:10px;display:block}
.pie{font-size:8.5px;color:#98A1AE;margin-top:10px}
</style></head><body>
${l.map((r, i) => `<div class="f">
<div class="hd"><b>VERIFICACIÓN DE CODIFICADO</b><span>Calidad Embotellado · Embol S.A. · ${fFecha(r.ts)} ${fHora(r.ts)} · ${i + 1} de ${l.length}</span></div>
<h2>${r.producto}</h2>
<div class="sub">${r.envase} · ${r.ml} ml${r.preforma ? ' · preforma Preforsa 20,1 g' : ''} · Línea ${r.linea}</div>
<div class="cod">${[r.codigo1, r.codigo2, r.codigo3].filter(Boolean).join('\n')}</div>
<div class="res ${r.resultado === 'ok' ? 'ok' : 'bad'}">${r.resultado === 'ok'
  ? 'CONFORME · el código de la botella coincide'
  : 'NO CONFORME · ' + (r.fallas || []).join(', ')}</div>
<table>
<tr><td>Embotellado</td><td>${r.loteFecha ? fFecha(r.loteFecha) + ' ' + fHora(r.loteFecha) : '—'}</td></tr>
<tr><td>Estándar de edad</td><td>${r.dias} días</td></tr>
<tr><td>Vence</td><td>${fFechaLarga(r.vence)}</td></tr>
<tr><td>Reciclado</td><td>${r.pcr != null ? 'PET-PCR ' + r.pcr + ' %' : 'No aplica'}</td></tr>
<tr><td>Analista</td><td>${r.analista}${r.turno ? ' · ' + r.turno : ''}</td></tr>
${r.electronico ? `<tr><td>Electrónico que ajustó</td><td>${r.electronico}</td></tr>` : ''}
${r.obs ? `<tr><td>Observaciones</td><td>${r.obs}</td></tr>` : ''}
</table>
${r.foto ? `<img src="${r.foto}">` : ''}
${r.foto2 ? `<img src="${r.foto2}">` : ''}
<div class="pie">LP-AC-E-01.10 Rev. 26 · Estándar de codificación de productos embotellados en La Paz</div>
</div>`).join('')}
<script>window.onload=function(){setTimeout(function(){window.print()},600)}<\/script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return toast('Permite las ventanas emergentes para poder imprimir', 'bad');
  w.document.write(doc); w.document.close();
  toast('Elige «Guardar como PDF» en el menú de impresión', 'ok');
}

/* Planilla, para quien prefiera revisar en tabla */
$('#xXlsx').addEventListener('click', () => {
  const l = enRango();
  if (!l.length) return toast('No hay verificaciones en el rango', 'bad');
  const cab = ['N°','FECHA','HORA','PRODUCTO','ENVASE','TAMAÑO [ml]','LÍNEA','EMBOTELLADO',
    'VENCIMIENTO (línea 1)','LOTE (línea 2)','PET-PCR (línea 3)','DÍAS','RESULTADO','FALLAS',
    'ELECTRÓNICO','HORA DEL AJUSTE','ANALISTA','TURNO','OBSERVACIONES'];
  const filas = l.map((r, i) => [i + 1, r.fecha, fHora(r.ts), r.producto, r.envase, r.ml, r.linea,
    r.loteFecha ? fFecha(r.loteFecha) + ' ' + fHora(r.loteFecha) : '',
    r.codigo1, r.codigo2, r.codigo3 || '', r.dias,
    r.resultado === 'ok' ? 'CONFORME' : 'NO CONFORME', (r.fallas || []).join(', '),
    r.electronico || '', r.horaAjuste ? fFecha(r.horaAjuste) + ' ' + fHora(r.horaAjuste) : '',
    r.analista, r.turno || '', r.obs || '']);

  if (typeof XLSX === 'undefined') {
    const esc = v => { const s = String(v ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    descargar(`Codificado_${hoyISO()}.csv`,
      '﻿' + [cab, ...filas].map(f => f.map(esc).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
    return toast('Sin internet: se generó un CSV, que Excel abre igual', 'ok');
  }
  const ws = XLSX.utils.aoa_to_sheet([
    ['VERIFICACIÓN DE CODIFICADO · Calidad Embotellado · Embol S.A.'],
    ['Generado: ' + new Date().toLocaleString('es-BO')], [], cab, ...filas]);
  ws['!cols'] = [4,11,7,30,20,12,8,18,20,18,16,7,15,28,20,18,18,10,30].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Verificaciones');
  XLSX.writeFile(wb, `Codificado_${hoyISO()}.xlsx`);
  toast('Planilla generada', 'ok');
});

/* ── Respaldo ── */
function hacerRespaldo() {
  descargar(`respaldo_codificado_${hoyISO()}.json`,
    JSON.stringify({ version: 1, exportado: new Date().toISOString(), registros: REGISTROS }, null, 2),
    'application/json');
  CFG.ultimoRespaldo = Date.now(); guardarCfg(); renderAvisoRespaldo();
  toast('Respaldo guardado en el celular', 'ok');
}
$('#xBackup').addEventListener('click', hacerRespaldo);
$('#arBoton').addEventListener('click', hacerRespaldo);

function renderAvisoRespaldo() {
  const desde = CFG.ultimoRespaldo || 0;
  const n = REGISTROS.filter(r => (r.guardadoEn || r.ts) > desde).length;
  const a = $('#avisoRespaldo');
  if (!n) { a.hidden = true; return; }
  a.hidden = false;
  $('#arTitulo').textContent = n === 1 ? '1 verificación sin respaldar' : `${n} verificaciones sin respaldar`;
  $('#arDetalle').textContent = CFG.ultimoRespaldo
    ? `Último respaldo: ${fFecha(CFG.ultimoRespaldo)} ${fHora(CFG.ultimoRespaldo)}. Las fotos se guardan solo en este celular.`
    : 'Las verificaciones y sus fotos se guardan solo en este celular. Si limpias los datos del navegador se pierden.';
}

$('#xRestore').addEventListener('click', () => $('#xFile').click());
$('#xFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.registros) || !d.registros.length) throw 0;
    if (!confirm(`Se importarán ${d.registros.length} verificaciones. ¿Continuar?`)) return;
    for (const r of d.registros) { const c = { ...r }; delete c.id; await DB.put(c); }
    REGISTROS = await DB.todo();
    renderRegistros(); contarExport(); renderAvisoRespaldo();
    toast('Respaldo importado', 'ok');
  } catch { toast('Archivo inválido', 'bad'); }
  e.target.value = '';
});
$('#xBorrar').addEventListener('click', async () => {
  if (!confirm('Esto borrará TODAS las verificaciones y sus fotos. ¿Continuar?')) return;
  await DB.limpiar();
  REGISTROS = [];
  CFG.ultimoRespaldo = Date.now(); guardarCfg();
  renderRegistros(); contarExport(); renderAvisoRespaldo();
  toast('Verificaciones borradas');
});

/* ══════════════════ 14 · INSTALACIÓN Y PWA ══════════════════ */

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
             <div class="paso-i"><b>1</b><span>Súbela a GitHub Pages o a la intranet.</span></div>
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
  if (!local) nota = `<div class="nota-i"><b>¿No aparece la opción?</b> Casi siempre es porque la app ya está
    instalada en este equipo. Búscala entre tus aplicaciones.</div>`;
  return { titulo, html: pasos + nota };
}
$('#cerrarInstalar').addEventListener('click', () => $('#modalInstalar').hidden = true);
$('#modalInstalar').addEventListener('click', e => { if (e.target.id === 'modalInstalar') $('#modalInstalar').hidden = true; });

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#btnInstall').hidden = false; });
window.addEventListener('appinstalled', () => { deferred = null; $('#btnInstall').hidden = true; toast('App instalada', 'ok'); });
$('#btnInstall').addEventListener('click', async () => {
  if (deferred) {
    deferred.prompt();
    const r = await deferred.userChoice;
    deferred = null;
    if (r && r.outcome === 'accepted') $('#btnInstall').hidden = true;
    return;
  }
  const { titulo, html } = instruccionesInstalar();
  $('#tituloInstalar').textContent = titulo;
  $('#pasosInstalar').innerHTML = html;
  $('#modalInstalar').hidden = false;
});
setTimeout(() => { if (!yaInstalada()) $('#btnInstall').hidden = false; }, 2000);

if ('serviceWorker' in navigator)
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.keyCode === 13) && e.target && e.target.tagName === 'INPUT' && e.target.type !== 'search') {
    e.preventDefault(); e.target.blur();
  }
});

/* ══════════════════ 15 · INICIO ══════════════════ */

(async function init() {
  iniciarSelectores();
  renderEstandar();
  $('#inFechaLote').value = ahoraLocal();
  $('#inTamano').value = S.ml || '';
  $('#chkPreforma').checked = !!S.preforma;
  $('#inAnalista').value = CFG.analista || '';
  $('#inTurno').value = S.turno || '';
  pintarResultado();
  refrescar();

  try { REGISTROS = await DB.todo(); }
  catch (e) { console.warn('Almacenamiento no disponible', e); }

  renderRegistros(); contarExport(); renderAvisoRespaldo();
})();

window.verDetalle = verDetalle;
window.borrarRegistro = borrarRegistro;
