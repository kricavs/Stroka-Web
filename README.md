# Stroka Visual

Sitio de portfolio para la productora audiovisual **Stroka Visual**.
Next.js (App Router) + Tailwind CSS. El sitio público no usa CMS ni base de
datos; la zona privada `/studio` (presupuestos) tiene login, middleware y
Postgres (ver [Stroka Studio](#stroka-studio--presupuestos-privados)). Estética
editorial, cinematográfica, negro y blanco con un único detalle azul. El
portfolio se organiza por **proyectos**: fotos locales (optimizadas por
Next.js) y videos en YouTube. Todo el contenido del portfolio vive en el repo.

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
3. Deploy. No hay variables de entorno.

---

## 1. Cambiar el logo

El logo es un archivo en `public/`. Para reemplazarlo:

- **Opción simple:** sobrescribí `public/logo-stroka.png` con tu archivo
  (manteniendo el nombre).
- **Otro nombre o formato:** dejá tu archivo en `public/` y en
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

## 2. Portfolio por proyectos

Cada tarjeta de `/portfolio` es un **proyecto** (un trabajo completo) y tiene su
propia página en `/portfolio/<slug>`. No hay CMS, base de datos ni servicios
externos: el contenido son archivos del repositorio.

```
content/portfolio/
  categorias.json              Categorías (filtros de /portfolio)
  proyectos/<slug>.json        Un archivo por proyecto. El nombre = URL
public/portfolio/<categoria>/<slug>/
  cover.jpg  hero.jpg  01.jpg ...   Portada, banner y fotos del proyecto
```

### Agregar un proyecto

1. Elegí el **slug** (minúsculas, números y guiones): `kama-x1`.
2. Creá la carpeta de fotos `public/portfolio/<categoria>/kama-x1/` y copiá ahí
   `cover.webp` (tarjeta de `/portfolio`), `hero.webp` (banner de la página del
   proyecto) y las demás fotos (`01.webp`, `02.webp`, …).
3. Creá `content/portfolio/proyectos/kama-x1.json`:

   ```json
   {
     "title": "KAMA X1",
     "client": "Nombre del cliente",
     "year": 2025,
     "category": "marcas",
     "services": ["Fotografía", "Video"],
     "description": ["Primer párrafo.", "Segundo párrafo (opcional)."],
     "cover": { "file": "cover.webp", "alt": "Describí la imagen de la tarjeta" },
     "hero": { "file": "hero.webp", "alt": "Describí la imagen del banner" },
     "photos": [
       { "file": "01.webp", "alt": "Describí la foto" },
       { "file": "02.webp", "alt": "Describí la foto" }
     ],
     "videos": ["https://youtu.be/XXXXXXXXXXX"]
   }
   ```

4. `npm run dev`, abrí `/portfolio/kama-x1` y revisá. Listo: no se toca ningún
   componente.

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `title` | sí | Nombre del proyecto |
| `category` | sí | Debe existir en `categorias.json` y coincide con la carpeta de fotos |
| `cover` | sí | `{ file, alt }`. Imagen de la tarjeta en `/portfolio`. Recomendado: **1200 × 1500 px** (vertical 4:5) |
| `hero` | sí | `{ file, alt }`. Banner de `/portfolio/<slug>`, usado solo ahí. Recomendado: **2400 × 1350 px** (horizontal 16:9). Se muestra con `object-cover` centrado, sin deformar. Si falta el archivo, el build falla indicando cuál |
| `photos` | no | Lista de `{ file, alt }`, en el orden en que se muestran |
| `videos` | no | Lista de IDs o URLs de YouTube (ver abajo) |
| `client`, `year`, `services`, `description` | no | Si faltan, esa sección no se muestra. `description` puede ser texto o lista de párrafos |
| `order` | no | Número. Fuerza la posición en `/portfolio` (menor = primero). Sin él: año más reciente primero |
| `example` | no | `true` marca el proyecto como ejemplo (etiqueta visible + aviso en el build) |

El **texto alternativo (`alt`) es obligatorio** en cada imagen.

### Fotografías

- Formato recomendado: `.webp` (también se aceptan `.jpg`, `.png`, `.avif`).
- Subí las fotos a buen tamaño (lado largo ~2400 px, calidad 80–85): Next.js
  genera las versiones responsive y optimizadas. No hace falta achicarlas más.
- Las dimensiones se leen solas de cada archivo; no hay que declararlas.
- Cada foto del JSON debe existir en la carpeta, o el build falla.

### Videos de YouTube

Subí el video a YouTube y pegá el link o el ID en `videos`:

```json
"videos": [
  "https://youtu.be/XXXXXXXXXXX",
  { "url": "https://www.youtube.com/watch?v=YYYYYYYYYYY", "title": "Making of" }
]
```

El reproductor no carga YouTube hasta que la persona toca play. `title` es
opcional (se usa como descripción accesible).

### Categorías

Se editan en `content/portfolio/categorias.json` (`slug`, `title`, `blurb`).
El filtro de `/portfolio` muestra solo las categorías que tienen proyectos.
La carpeta de fotos usa el slug de la categoría.

### Errores a propósito

El sitio **no inventa contenido**. Si un JSON tiene un campo mal escrito, una
categoría inexistente, una foto que no existe, un `alt` vacío o un ID de
YouTube inválido, `npm run dev` / `npm run build` fallan indicando el archivo y
el problema. Los proyectos con `"example": true` generan un aviso en el build y
muestran la etiqueta "Ejemplo": borralos (JSON + carpeta de fotos) antes de
lanzar.

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
  page.jsx                 Home (portada fullscreen)
  portfolio/page.jsx       Portfolio: tarjetas de proyectos + filtros
  portfolio/[slug]/page.jsx  Página de un proyecto (se genera de content/)
  servicios/ webs-rebrandings/ sobre/ contacto/
components/
  Navbar, Footer, Logo, Hero, PageHeader, Reveal, ContactForm
  Lightbox.jsx             Visor de fotos accesible (<dialog>)
  YouTubeEmbed.jsx         Reproductor YouTube con carga diferida
  portfolio/               ProjectCard, ProjectGrid, PhotoSequence
content/portfolio/         Datos del portfolio (categorías y proyectos)
lib/
  site.js                  Marca, logo, contacto
  portfolio.js             Lee y valida content/ (solo servidor)
public/
  hero/                    Imágenes de la portada
  portfolio/<categoria>/<slug>/   Fotos de cada proyecto
```

## Verificaciones

```bash
npm run lint
npm run build
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
