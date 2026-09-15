/* ═══════════════════════════════════════════════════════════════════════════
   CODIFICADO · Verificación de fecha de vencimiento
   Calidad Embotellado · Embol S.A. · Planta La Paz

   Fuente: LP-AC-E-01.10 «Estándar de Codificación de Productos Embotellados
   en La Paz», Revisión N.° 26 (28/01/2026).

   FORMATO DEL CÓDIGO EN LA BOTELLA
   ─────────────────────────────────
       V24SEP26 LP4      línea 1 · vencimiento (mes en LETRAS) + planta y línea
       L260626 12:00     línea 2 · lote (mes en NÚMEROS) + hora de embotellado
       PET-PCR 30%       línea 3 · solo si el envase es PET no retornable

   Ojo con la diferencia entre las dos primeras líneas: el vencimiento lleva el
   mes en tres letras (ENE a DIC) y el lote lo lleva en dos dígitos (01 a 12).
   Es el error de codificación más fácil de pasar por alto.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

/* Planta y líneas de embotellado de La Paz */
const PLANTA = 'LP';
const LINEAS = ['2', '3', '4', '5'];

/* Meses en la línea de vencimiento */
const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/* ─────────────────────────── ENVASES ───────────────────────────
   soloPCR: la tercera línea PET-PCR únicamente se imprime en envases de
   PET no retornable, según la norma.                                        */
const ENVASES = [
  { id: 'petnr',     nombre: 'PET no retornable',  pcr: true  },
  { id: 'refpet',    nombre: 'PET retornable',     pcr: false },
  { id: 'vidrio',    nombre: 'Vidrio retornable',  pcr: false },
  { id: 'lata',      nombre: 'Lata',               pcr: false },
  { id: 'tetrapack', nombre: 'Tetrapack',          pcr: false },
  { id: 'bib',       nombre: 'Bag in Box',         pcr: false }
];

/* Tamaños que se usan con más frecuencia; el analista puede escribir otro */
const TAMANOS = [250, 300, 355, 500, 600, 750, 990, 1000, 1500, 2000, 2500, 3000];

/* ─────────────────────────── PRODUCTOS ───────────────────────────
   Nombre completo tal como figura en la hoja ABREVIATURAS del estándar.
   El código corto se guarda solo como referencia; en pantalla siempre se
   muestra el nombre completo.

   grupo → determina qué regla de vida útil se aplica.                       */
const PRODUCTOS = [
  /* ── Carbonatados regulares · sin aspartame ── */
  { nombre: 'Coca-Cola',                      codigo: 'CC',     cat: 'Carbonatados regulares',      grupo: 'carb_sin_aspartame' },
  { nombre: 'Sprite',                         codigo: 'SP',     cat: 'Carbonatados regulares',      grupo: 'carb_sin_aspartame' },
  { nombre: 'Vital con gas',                  codigo: 'VG',     cat: 'Carbonatados regulares',      grupo: 'carb_sin_aspartame' },
  { nombre: 'Ginger Ale Canada Dry',          codigo: 'GA',     cat: 'Carbonatados regulares',      grupo: 'ginger_tonica' },
  { nombre: 'Schweppes Tónica',               codigo: 'ST',     cat: 'Carbonatados regulares',      grupo: 'ginger_tonica' },

  /* ── Carbonatados sin azúcar y zero · con aspartame, no blend ── */
  { nombre: 'Coca-Cola Sin Azúcar',           codigo: 'CCSA',   cat: 'Carbonatados sin azúcar / zero', grupo: 'carb_aspartame_noblend' },
  { nombre: 'Coca-Cola Zero',                 codigo: 'CCZ',    cat: 'Carbonatados sin azúcar / zero', grupo: 'carb_aspartame_noblend' },
  { nombre: 'Fanta Naranja Sin Azúcar',       codigo: 'FNSA',   cat: 'Carbonatados sin azúcar / zero', grupo: 'carb_aspartame_noblend' },
  { nombre: 'Sprite Sin Azúcar',              codigo: 'SPSA',   cat: 'Carbonatados sin azúcar / zero', grupo: 'carb_aspartame_noblend' },
  { nombre: 'Coca-Cola Ultimate',             codigo: 'CCU',    cat: 'Carbonatados sin azúcar / zero', grupo: 'carb_aspartame_noblend' },

  /* ── Carbonatados blend · nuevas formulaciones ── */
  { nombre: 'Coca-Cola Menos Calorías',       codigo: 'CCMC',   cat: 'Carbonatados blend',          grupo: 'carb_aspartame_blend' },
  { nombre: 'Fanta Naranja',                  codigo: 'FN',     cat: 'Carbonatados blend',          grupo: 'carb_aspartame_blend', retornableLargo: true },
  { nombre: 'Fanta Naranja-Mandarina',        codigo: 'FNM',    cat: 'Carbonatados blend',          grupo: 'carb_aspartame_blend' },
  { nombre: 'Fanta Papaya',                   codigo: 'FPY',    cat: 'Carbonatados blend',          grupo: 'carb_aspartame_blend' },
  { nombre: 'Fanta Guaraná',                  codigo: 'FG',     cat: 'Carbonatados blend',          grupo: 'carb_aspartame_blend' },
  { nombre: 'Fanta Limón',                    codigo: 'FL',     cat: 'Carbonatados blend',          grupo: 'carb_aspartame_blend' },
  { nombre: 'Fanta Misterio',                 codigo: 'FM',     cat: 'Carbonatados blend',          grupo: 'carb_aspartame_blend' },
  { nombre: 'Simba Manzana',                  codigo: 'SM',     cat: 'Carbonatados blend',          grupo: 'carb_aspartame_blend' },
  { nombre: 'Simba Durazno',                  codigo: 'SD',     cat: 'Carbonatados blend',          grupo: 'carb_aspartame_blend' },
  { nombre: 'Simba Piña',                     codigo: 'SPI',    cat: 'Carbonatados blend',          grupo: 'carb_aspartame_blend' },
  { nombre: 'Simba Pomelo',                   codigo: 'SPM',    cat: 'Carbonatados blend',          grupo: 'carb_aspartame_blend' },
  { nombre: 'Schweppes Ginger Ale',           codigo: 'SGA',    cat: 'Carbonatados blend',          grupo: 'ginger_tonica' },

  /* ── Aguas ── */
  { nombre: 'Vital sin gas',                  codigo: 'VSG',    cat: 'Aguas',                       grupo: 'agua_sin_gas' },

  /* ── Energizantes ── */
  { nombre: 'Furia',                           codigo: 'FY',     cat: 'Energizantes',                grupo: 'fury' },
  { nombre: 'Monster Energy',                 codigo: 'ME',     cat: 'Energizantes',                grupo: 'monster' },

  /* ── Isotónicos y aguas saborizadas ── */
  { nombre: 'Powerade Ion-4 Mora Azul',       codigo: 'PW-MA',  cat: 'Isotónicos / aguas saborizadas', grupo: 'isotonico' },
  { nombre: 'Powerade Ion-4 Multifrutas',     codigo: 'PW-MF',  cat: 'Isotónicos / aguas saborizadas', grupo: 'isotonico' },
  { nombre: 'Powerade Ion-4 Manzana',         codigo: 'PW-MZ',  cat: 'Isotónicos / aguas saborizadas', grupo: 'isotonico' },
  { nombre: 'Powerade Ion-4 Citrus Passion Fruit', codigo: 'PW-CP', cat: 'Isotónicos / aguas saborizadas', grupo: 'isotonico' },
  { nombre: 'Powerade Ataque',                codigo: 'PW-AT',  cat: 'Isotónicos / aguas saborizadas', grupo: 'isotonico' },
  { nombre: 'Powerade Contrataque',           codigo: 'PW-CAT', cat: 'Isotónicos / aguas saborizadas', grupo: 'isotonico' },
  { nombre: 'Aquarius Manzana',               codigo: 'AQ-MZ',  cat: 'Isotónicos / aguas saborizadas', grupo: 'isotonico' },
  { nombre: 'Aquarius Pera',                  codigo: 'AQ-PE',  cat: 'Isotónicos / aguas saborizadas', grupo: 'isotonico' },
  { nombre: 'Aquarius Pomelo',                codigo: 'AQ-PO',  cat: 'Isotónicos / aguas saborizadas', grupo: 'isotonico' },

  /* ── Jugos ── */
  { nombre: 'Del Valle Fresh Naranja',        codigo: 'DV-FN',  cat: 'Jugos Del Valle',             grupo: 'jugo_del_valle' },
  { nombre: 'Del Valle Fresh Fruit Punch',    codigo: 'DV-FFP', cat: 'Jugos Del Valle',             grupo: 'jugo_del_valle' },
  { nombre: 'Del Valle Durazno',              codigo: 'DV-DU',  cat: 'Jugos Del Valle',             grupo: 'jugo_del_valle' },
  { nombre: 'Del Valle Manzana',              codigo: 'DV-MZ',  cat: 'Jugos Del Valle',             grupo: 'jugo_del_valle' },
  { nombre: 'Del Valle Tropical / Citrus',    codigo: 'DV-TR',  cat: 'Jugos Del Valle',             grupo: 'jugo_del_valle' },
  { nombre: 'Jugos Ades producción local',    codigo: 'ADES-L', cat: 'Jugos Ades',                  grupo: 'ades_local' },
  { nombre: 'Jugos Ades importado',           codigo: 'ADES-I', cat: 'Jugos Ades',                  grupo: 'ades_importado' },

  /* ── Postmix ── */
  { nombre: 'Jarabe Bag in Box postmix',      codigo: 'BIB',    cat: 'Postmix',                     grupo: 'bib_postmix' }
];

/* ═══════════════════ REGLAS DE VIDA ÚTIL Y PCR ═══════════════════
   Se evalúan en orden y gana la primera que coincida, igual que se lee la
   norma: primero los casos particulares y al final los generales.

   dias  → estándar de edad, en días
   pcr   → porcentaje de PET reciclado que debe imprimirse en la tercera línea
           (null = el envase no lleva esa línea)
   nota  → texto que se muestra al analista cuando la regla tiene alguna
           particularidad o cuando el documento original no es claro          */
const REGLAS = [

  /* ── Casos particulares por producto ── */
  { id: 'monster',
    cuando: (p, e) => p.grupo === 'monster' && e === 'lata',
    dias: 730, pcr: null },

  { id: 'agua_chica',
    cuando: (p, e, ml) => p.grupo === 'agua_sin_gas' && e === 'petnr' && ml <= 750,
    dias: 330, pcr: 100,
    nota: 'Vital sin gas de 600 y 750 ml se embotella en PET 100 % reciclado.' },

  { id: 'agua_grande',
    cuando: (p, e, ml) => p.grupo === 'agua_sin_gas' && e === 'petnr' && ml > 750,
    dias: 330, pcr: 30 },

  { id: 'fury',
    cuando: p => p.grupo === 'fury',
    dias: 250, pcr: 30,
    nota: 'PENDIENTE DE CONFIRMAR: la hoja de vencimientos indica 250 días y la tabla del estándar indica 180. Se está usando 250.' },

  { id: 'ginger_tonica_990',
    cuando: (p, e, ml) => p.grupo === 'ginger_tonica' && e === 'petnr' && ml === 990,
    dias: 90, pcr: 30,
    nota: 'Ginger Ale y Agua Tónica de 990 ml pasaron de 65 a 90 días en la revisión 24 del estándar.' },

  { id: 'isotonico',
    cuando: p => p.grupo === 'isotonico',
    dias: 180, pcr: 30 },

  { id: 'jugo_dv',
    cuando: p => p.grupo === 'jugo_del_valle',
    dias: 180, pcr: 30 },

  { id: 'ades_local',
    cuando: p => p.grupo === 'ades_local',
    dias: 180, pcr: null },

  { id: 'ades_importado',
    cuando: p => p.grupo === 'ades_importado',
    dias: 300, pcr: null },

  { id: 'bib',
    cuando: (p, e) => p.grupo === 'bib_postmix' || e === 'bib',
    dias: 75, pcr: null },

  /* ── Retornables ── */
  { id: 'fanta_naranja_retornable',
    cuando: (p, e) => p.retornableLargo && (e === 'vidrio' || e === 'refpet'),
    dias: 180, pcr: null,
    nota: 'Fanta Naranja en vidrio y PET retornable tiene 180 días, por encima de los 135 del resto de los blend.' },

  { id: 'retornable_sin_aspartame',
    cuando: (p, e) => p.grupo === 'carb_sin_aspartame' && (e === 'vidrio' || e === 'refpet'),
    dias: 180, pcr: null },

  { id: 'retornable_con_aspartame',
    cuando: (p, e) => (p.grupo === 'carb_aspartame_noblend' || p.grupo === 'carb_aspartame_blend' || p.grupo === 'ginger_tonica')
                      && (e === 'vidrio' || e === 'refpet'),
    dias: 135, pcr: null },

  /* ── Carbonatados en PET no retornable ── */
  { id: 'carb_300',
    cuando: (p, e, ml) => esCarbonatado(p) && e === 'petnr' && ml === 300,
    dias: 50, pcr: 35,
    nota: 'El formato de 300 ml usa PET 35 % reciclado y 50 días (revisión 26 del estándar).' },

  { id: 'carb_preforma',
    cuando: (p, e, ml, pref) => esCarbonatado(p) && e === 'petnr' && ml === 500 && pref,
    dias: 60, pcr: 35,
    nota: 'Con preforma Preforsa de 20,1 g el envase de 500 ml lleva PET 35 % reciclado.' },

  { id: 'carb_menor_litro',
    cuando: (p, e, ml) => esCarbonatado(p) && e === 'petnr' && ml < 1000,
    dias: 60, pcr: 30 },

  { id: 'carb_litro_o_mas',
    cuando: (p, e, ml) => esCarbonatado(p) && e === 'petnr' && ml >= 1000,
    dias: 90, pcr: 30 },

  /* ── Envases sin regla propia ── */
  { id: 'tetrapack',
    cuando: (p, e) => e === 'tetrapack',
    dias: 180, pcr: null }
];

function esCarbonatado(p) {
  return ['carb_sin_aspartame', 'carb_aspartame_noblend', 'carb_aspartame_blend', 'ginger_tonica'].includes(p.grupo);
}

/**
 * Devuelve la regla que corresponde al producto, envase y tamaño elegidos.
 * Si ninguna coincide devuelve null, y la app avisa en vez de inventar un dato.
 */
function reglaDe(producto, envase, ml, preforma) {
  if (!producto || !envase) return null;
  for (const r of REGLAS) {
    if (r.cuando(producto, envase, ml, !!preforma)) return r;
  }
  return null;
}
