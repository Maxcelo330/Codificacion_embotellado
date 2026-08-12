# Carbonatación &amp; Brix

Aplicación de línea para el control de carbonatación, °Brix y demás parámetros
de producto terminado.

**Calidad Embotellado · Embol S.A.**

---

## Qué hace

**Medición.** Eliges el producto y el empaque, y la app muestra únicamente los
parámetros que ese producto realmente mide. Para las gaseosas aparecen CO₂ y
°Brix; para el agua sin gas, ozono y pH; para los isotónicos, °Brix y nitrógeno.
Lo que no se mide no se muestra, así nadie llena una casilla que no corresponde.

Ingresas presión y temperatura y la app calcula el volumen de CO₂ corregido con
las mismas fórmulas de la planilla «Carbonatación – Brix Corregido 2026». El
color te dice el resultado de inmediato: verde dentro de especificación, ámbar
dentro pero al límite, rojo fuera.

**Producción.** Arrancas la producción con su orden y su tanque. La app te
recuerda sacar las 2 botellas para sensorial —una se mide al momento y la otra a
las 4 horas— y desde ahí lleva la cuenta regresiva, avisando con notificación y
sonido cada vez que toca llevar una muestra nueva. Cuando hay cambio de tanque
se registra el cambio, se reinicia el ciclo de 4 horas y todas las mediciones
siguientes heredan la orden y el tanque nuevos.

**Registros.** Tabla horaria con todas las mediciones, con su orden y tanque.
Gráficas de tendencia de CO₂ y °Brix con la franja de especificación y la línea
de objetivo. Exportación a Excel, PDF e imagen para revisar con supervisión.

**Especificaciones.** Consulta de LEI, objetivo y LES de todos los productos,
según LP-AC-E-01.11 Rev. 54.

---

## Instalarla en el celular

La app se instala desde el navegador, no desde una tienda.

**Android (Chrome).** Abre la dirección de la app, toca el menú de tres puntos y
elige *Instalar aplicación* o *Agregar a pantalla principal*.

**iPhone (Safari).** Abre la dirección, toca el botón de compartir y elige
*Agregar a inicio*. En iPhone tiene que ser Safari; desde Chrome no aparece la
opción.

Una vez instalada funciona sin internet. La primera vez sí necesita conexión,
para guardar los archivos en el celular.

---

## Publicarla en GitHub Pages

La app son **7 archivos sueltos, sin ninguna carpeta**. Los íconos y el logo van
incrustados dentro de `index.html` y de `manifest.webmanifest`, así que no hay
subcarpetas que subir y no se puede romper por ahí.

1. Crea un repositorio nuevo.
2. Entra a **Add file → Upload files** y arrastra estos 7 archivos:

   ```
   index.html   app.js   data.js   styles.css
   sw.js        manifest.webmanifest        .nojekyll
   ```

3. Confirma con **Commit changes**.
4. Entra a **Settings → Pages**, en *Branch* elige `main` y la carpeta
   `/ (root)`. Guarda.
5. A los pocos minutos la app queda en
   `https://<tu-usuario>.github.io/<nombre-del-repositorio>/`.

**El archivo `.nojekyll` tiene que subirse sí o sí.** Empieza con punto, así que
Windows lo tiene oculto: activa **Vista → Elementos ocultos** en el Explorador
antes de arrastrar. Sin él, GitHub no publica bien la app.

Si al arrastrar no aparecen todos los archivos, súbelos de a pocos: la subida por
arrastre de GitHub a veces se salta archivos cuando son muchos de golpe.

**La carpeta `icons/` no hace falta subirla.** Solo sirve como respaldo de los
íconos originales, por si algún día quieres regenerarlos o usarlos en un
documento.

---

## Actualizarla después

Cuando cambies cualquier archivo, sube el número de versión en la primera línea
de `sw.js`:

```js
const VERSION = 'carbo-v6';   // súbelo a v7, v8, etc.
```

Si no lo cambias, los celulares que ya tienen la app instalada seguirán usando
la copia vieja que guardaron.

---

## Archivos

| Archivo | Qué contiene |
|---|---|
| `index.html` | La pantalla de la app. Lleva incrustados el logo de la cabecera y los íconos del navegador |
| `app.js` | Cálculos, registros, recordatorios, gráficas y exportación |
| `data.js` | Especificaciones de todos los productos (LP-AC-E-01.11 Rev. 54) |
| `styles.css` | Diseño |
| `sw.js` | Permite que funcione sin internet |
| `manifest.webmanifest` | Datos de la app instalada: nombre, colores e íconos, incrustados dentro del propio archivo |
| `.nojekyll` | Necesario para que GitHub Pages publique todo correctamente |
| `icons/` | *No hace falta subirla.* Respaldo de los íconos originales. Se generan con el script de `CALIDAD-EMBOL/marca` |

---

## Dónde se guardan los datos

Todo queda guardado **en el celular de cada analista**, no en un servidor. Por
eso conviene exportar el Excel al terminar el turno, o usar el botón de respaldo
`.json` de la pestaña Registros. Si se desinstala la app o se borran los datos
del navegador, los registros se pierden.

---

## Especificaciones

Las de `data.js` corresponden a **LP-AC-E-01.11, Revisión N.° 54 (14/04/2026)**.
Cuando salga una revisión nueva hay que actualizar ese archivo y subir la
versión en `sw.js`.

---

Desarrollado por Marcelo Herrera · Calidad Embotellado · Embol S.A.
