# Codificado · Verificación de fecha de vencimiento

Aplicación de línea para verificar que el código impreso en la botella sea el
que corresponde.

**Calidad Embotellado · Embol S.A. · Planta La Paz**

---

## Qué hace

**Calcula el código que debe salir.** Eliges el producto, el envase, el tamaño y
la fecha y hora de embotellado, y la app arma las tres líneas tal como deben
quedar impresas, sobre fondo negro y en letra monoespaciada para que se comparen
carácter por carácter:

```
V24SEP26 LP4      vencimiento · mes en TRES LETRAS
L260626 12:00     lote · mes en DOS DÍGITOS
PET-PCR 30%       solo si el envase es PET no retornable
```

El estándar de edad sale de LP-AC-E-01.10: la app sabe que un carbonatado en PET
de menos de un litro dura 60 días, que en 300 ml son 50 y el reciclado sube a
35 %, que Vital de 600 ml lleva PET 100 % reciclado, y así con cada caso.

**Compara con la botella.** Se toma una foto del código real y queda al lado del
código esperado, para revisar los dos juntos en la misma pantalla.

**Registra la verificación** con el analista, el turno y las observaciones. Si el
código está mal, se marca qué falló, quién fue el electrónico que ajustó el
equipo y a qué hora, y se puede tomar una segunda foto después del ajuste.

**Exporta en PDF**, una ficha por verificación con el código y las fotos. Es el
formato pensado para revisar con supervisión, porque se entiende de un vistazo.
También exporta la planilla en Excel para quien prefiera la tabla.

---

## El error más común

Las dos primeras líneas llevan el mes de forma distinta y es lo más fácil de
pasar por alto:

| Línea | Mes | Ejemplo |
|---|---|---|
| Vencimiento | tres letras, de ENE a DIC | `V24**SEP**26` |
| Lote | dos dígitos, de 01 a 12 | `L26**06**26` |

La app siempre las muestra ya resueltas, así que basta con comparar.

---

## Instalarla en el celular

**Android (Chrome).** Abre la dirección, toca el menú de tres puntos y elige
*Instalar aplicación*.

**iPhone (Safari).** Abre la dirección, toca compartir y elige *Agregar a
inicio*. Tiene que ser Safari; desde Chrome no aparece la opción.

Una vez instalada funciona sin internet, y sigue funcionando aunque la página de
GitHub deje de existir: el celular guarda su propia copia. La primera vez sí
necesita conexión.

---

## Publicarla

Son 8 archivos sueltos, sin carpetas. Los íconos y el logo van incrustados
dentro de `index.html` y de `manifest.webmanifest`.

1. Crea un repositorio y sube estos archivos a la raíz:

   ```
   index.html   app.js   data.js   styles.css
   sw.js        manifest.webmanifest        .nojekyll
   ```

2. En **Settings → Pages** elige la rama `main` y la carpeta `/ (root)`.

**El `.nojekyll` tiene que subirse.** Empieza con punto y Windows lo oculta:
activa **Vista → Elementos ocultos** en el Explorador antes de arrastrar.

Cuando cambies algo, sube el número de versión en la primera línea de `sw.js`
(`codif-v1` → `codif-v2`), o los celulares seguirán con la copia vieja.

---

## Dónde se guardan los datos

En el celular de cada analista, no en un servidor. Las fotos también. Por eso la
app avisa cuando hay verificaciones sin respaldar, y conviene exportar el PDF o
el respaldo `.json` al cerrar turno.

Si se limpian los datos del navegador o se desinstala la app, se pierde todo lo
que no se haya exportado.

---

## Pendientes por confirmar

Al armar la app aparecieron dos contradicciones dentro del propio documento
fuente. Están resueltas con el criterio más probable, pero conviene confirmarlas:

| Caso | Qué dice el documento | Qué usa la app |
|---|---|---|
| **Fury** | La hoja de vencimientos dice 250 días; la tabla del estándar dice 180 | 250 días |
| **Ginger Ale y Agua Tónica 990 ml** | La tabla dice 65 días; la revisión 24 y la hoja de vencimientos dicen 90 | 90 días |

Ambos se cambian en `data.js`, en la lista `REGLAS`, modificando el número que
sigue a `dias:`.

También quedó una regla especial para **Fanta Naranja** en vidrio y PET
retornable, con 180 días en vez de los 135 del resto de los blend, porque el
estándar la nombra aparte. Si eso ya no aplica, se borra la regla
`fanta_naranja_retornable`.

---

## Archivos

| Archivo | Qué contiene |
|---|---|
| `index.html` | La pantalla de la app, con el logo y los íconos incrustados |
| `app.js` | Generación del código, fotos, registros y exportación |
| `data.js` | Productos, envases y reglas del estándar de edad |
| `styles.css` | Diseño |
| `sw.js` | Permite que funcione sin internet |
| `manifest.webmanifest` | Datos e íconos de la app instalada |
| `.nojekyll` | Necesario para GitHub Pages |
| `informacion/` | El documento original del estándar. No hace falta subirla |

---

Desarrollado por Marcelo Herrera · Calidad Embotellado · Embol S.A.
Basado en LP-AC-E-01.10, Revisión N.° 26 (28/01/2026).
