# Stroka Visual

Sitio de portfolio para la productora audiovisual **Stroka Visual**.
Next.js (App Router) + Tailwind CSS. El sitio público no usa CMS ni base de
datos; la zona privada `/studio` (presupuestos) tiene login, middleware y
Postgres (ver [Stroka Studio](#stroka-studio--presupuestos-privados)). Estética editorial, cinematográfica, negro y blanco con un
único detalle azul. Imágenes desde **Cloudinary** con fallback local.

## Requisitos

- Node.js 18.18+ (recomendado 20+)

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:3000
```

Funciona sin configurar nada: muestra placeholders locales en blanco y negro.

## Build de producción

```bash
npm run build
npm start
```

## Publicar en Vercel

1. Subí el proyecto a un repositorio (GitHub / GitLab).
2. Importalo en https://vercel.com → New Project (framework Next.js autodetectado).
3. (Opcional) Cargá las variables de Cloudinary en *Settings → Environment Variables*.
4. Deploy.

---

## 1. Cambiar el logo

El logo es un archivo en `public/`. Para reemplazarlo:

- **Opción simple:** sobrescribí `public/logo-stroka.svg` con tu archivo
  (manteniendo el nombre).
- **Opción PNG:** dejá tu archivo en `public/logo-stroka.png` y en
  `lib/site.js` cambiá:

  ```js
  logoSrc: "/logo-stroka.png",
  logoWidth: 1000,   // ancho real del archivo
  logoHeight: 250,   // alto real del archivo
  ```

`logoWidth` / `logoHeight` definen la proporción: poné los valores reales de
tu archivo para que **no se deforme**. El logo se muestra con `object-contain`.
No se recrea con texto: se usa tu archivo tal cual.

---

## 2. Fotos del portfolio (Cloudinary)

El portfolio lee imágenes de Cloudinary. **El panel de control es Cloudinary**:
ahí subís, borrás, reemplazás y organizás. La web las muestra automáticamente.

### Configurar

1. Creá una cuenta en https://cloudinary.com
2. Copiá `.env.example` a `.env.local` y completá:

   ```
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```

3. En Cloudinary, subí tus imágenes y asignales un **tag** según la categoría.
   El tag debe coincidir exactamente con estos slugs:

   | Categoría            | Tag en Cloudinary    |
   |----------------------|----------------------|
   | Fotografía           | `fotografia`         |
   | Video                | `video`              |
   | Drone                | `drone`              |
   | Eventos              | `eventos`            |
   | Marcas               | `marcas`             |
   | Institucional        | `institucional`      |
   | Webs y rebrandings   | `webs-rebrandings`   |

   Para etiquetar: seleccioná las imágenes en Media Library → **Add tag** →
   escribí el slug de la categoría. Una imagen puede tener varios tags.

Listo. La web toma esas imágenes, las entrega optimizadas (`f_auto`, `q_auto`)
y las muestra en la grilla y el lightbox.

### Notas

- Las imágenes se cachean 1 hora (`revalidate: 3600`). Tras subir fotos
  nuevas, aparecen al revalidarse (o redeployando).
- **Fallback:** si no hay variables configuradas, o si Cloudinary falla, la
  web usa los placeholders locales de `public/portfolio/<categoria>/`.
- Las categorías se editan en `lib/site.js`.

---

## 3. Imagen/slides de la portada (Home)

La home es una portada fullscreen con un crossfade entre algunas imágenes.
Se definen en `components/Hero.jsx` (array `slides`). Cambiá esas rutas por
tus imágenes, o reemplazá el bloque por un `<video autoPlay muted loop
playsInline>` para usar video.

---

## Estructura

```
app/
  page.jsx               Home (portada fullscreen)
  portfolio/page.jsx     Portfolio (filtros + lightbox) — async, lee Cloudinary
  servicios/page.jsx     Servicios
  webs-rebrandings/...    Webs y rebrandings
  sobre/page.jsx         Sobre Stroka
  contacto/page.jsx      Contacto
components/
  Navbar, Footer, Logo   Logo reemplazable por archivo
  Hero                   Portada con crossfade
  Gallery                Grilla masonry + filtros + lightbox
  PageHeader, Reveal
lib/
  site.js                Marca, logo, contacto, categorías
  portfolio.js           Cloudinary (server) + fallback local
public/
  logo-stroka.svg        ← reemplazá por tu logo
  portfolio/<categoria>/ Placeholders locales (fallback)
```


---

# Stroka Studio — presupuestos privados

Herramienta interna en `/studio` (separada del sitio público, con su propio
layout). Crea, guarda, edita, duplica y elimina presupuestos, con vista previa
A4 y exportación a PDF.

## Arquitectura

| Capa | Dónde | Notas |
|---|---|---|
| Config institucional | `lib/studio/config.js` | Datos de Stroka (email, teléfono, Instagram…). **El teléfono está vacío**: completalo ahí; mientras esté vacío no aparece en el PDF. |
| Cálculo / validación | `lib/studio/calc.js`, `validate.js` | Funciones puras compartidas. El servidor **recalcula** totales siempre. |
| Auth | `middleware.js`, `lib/studio/session.js`, `lib/studio/server/{auth,password.mjs}` | Usuario/password por variables de entorno + cookie firmada (HMAC). |
| Persistencia | `lib/studio/server/{db,budgets}.js` | Postgres. |
| API | `app/api/studio/*` | Todas verifican sesión. |
| UI | `app/studio/*`, `components/studio/*` | |
| Plantilla PDF | `lib/studio/pdf/*` | Un único documento (`BudgetDocument`) para preview y export. |

## Modelo de presupuesto: `intro`

Campo opcional `intro` (texto breve, máx. 400 caracteres) para los tres tipos.
Se edita en *General*, se valida/normaliza en `lib/studio/validate.js`, se
guarda en el JSONB `data` (sin migración: los presupuestos viejos simplemente no
lo tienen), se copia al duplicar y se muestra bajo título/cliente en preview y
PDF. Vacío = no ocupa espacio.

## Decisiones

- **Autenticación**: sin proveedor externo. `STUDIO_USER` + `STUDIO_PASSWORD_HASH`
  (scrypt) y cookie `stk_studio` (HttpOnly, SameSite=Strict, Secure en producción,
  7 días) firmada con `STUDIO_SESSION_SECRET`. Se verifica en el middleware
  (servidor) **y** otra vez en cada página/handler. Mutaciones: chequeo de
  `Origin`. Login con retardo y bloqueo de 1 min tras 5 fallos (por instancia).
- **Persistencia**: el sitio se despliega en Vercel (filesystem efímero), así que
  hace falta una base externa. Se usa **Postgres estándar** (driver `pg`):
  Neon, Supabase o Vercel Postgres sirven igual. Una tabla `studio_budgets`
  (columnas indexables + `data` JSONB) y `studio_counters` para la numeración
  `STK-AAAA-NNN` (upsert atómico + `UNIQUE`: sin duplicados aunque haya
  guardados simultáneos; los números eliminados no se reutilizan).
  En desarrollo sin `DATABASE_URL` se usa Postgres embebido (PGlite) en `./.data`
  (ignorado por git). En producción `DATABASE_URL` es obligatoria.
- **PDF**: `@react-pdf/renderer`. Texto real seleccionable, fuentes incrustadas
  (Anton para títulos y precios + Inter para texto, en `public/studio-fonts`, licencia OFL), vectores,
  A4, paginación con bloques indivisibles, cabecera corrida y footer en cada
  página. El PDF se genera **en el navegador** (sin carga en el servidor ni
  límites de tiempo de Vercel). La vista previa rasteriza ese mismo PDF con
  pdf.js, por lo que preview y exportación no pueden divergir.
- Sin fotografías: identidad solo con logo, tipografía, escala, líneas y color.
  Las notas internas **nunca** se renderizan en el PDF.

## Variables de entorno

Ver `.env.example`.

| Variable | Descripción |
|---|---|
| `STUDIO_USER` | Usuario de login. |
| `STUDIO_PASSWORD_HASH` | Hash scrypt de la contraseña. |
| `STUDIO_SESSION_SECRET` | ≥ 32 caracteres aleatorios. Cambiarlo cierra todas las sesiones. |
| `DATABASE_URL` | Cadena de conexión Postgres (obligatoria en producción). |

## Configuración

1. `npm install`
2. Generá hash y secret: `npm run studio:hash -- "tu-password-larga"` (imprime
   `STUDIO_PASSWORD_HASH` y `STUDIO_SESSION_SECRET`).
3. Copiá `.env.example` a `.env.local` y pegá los valores.

## Desarrollo local

`npm run dev` → http://localhost:3000/studio (sin `DATABASE_URL` usa la base embebida).

## Despliegue (Vercel)

1. Creá una base Postgres (p. ej. Vercel → Storage → Neon, o neon.tech) y copiá su `DATABASE_URL`.
2. En *Settings → Environment Variables* cargá las 4 variables de arriba.
3. Deploy. Las tablas se crean solas en el primer uso (`CREATE TABLE IF NOT EXISTS`).

### Migraciones

El esquema vive en `lib/studio/server/db.js` y es idempotente. Los presupuestos
guardan su contenido en JSONB, por lo que agregar campos no requiere migrar
columnas; cambios estructurales futuros se agregarían como sentencias
`ALTER TABLE ... IF NOT EXISTS` en ese mismo archivo.

### Backup / exportación

- Botón **Exportar backup** en el historial → JSON con todos los presupuestos.
- O `pg_dump "$DATABASE_URL" -t studio_budgets -t studio_counters > backup.sql`.

## Límites conocidos

- El bloqueo de intentos de login es en memoria (por instancia serverless); la
  contraseña larga + scrypt es la defensa principal.
- Un solo usuario (las credenciales viven en variables de entorno).
- La vista previa tarda ~1 s tras dejar de escribir.
- La fecha por defecto usa la hora del navegador; el duplicado usa la del servidor (UTC).
