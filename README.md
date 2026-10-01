# Stroka Visual

Sitio de portfolio para la productora audiovisual **Stroka Visual**.
Next.js (App Router) + Tailwind CSS. Sin CMS, sin base de datos, sin login,
sin middleware. Estética editorial, cinematográfica, negro y blanco con un
único detalle azul. El portfolio se organiza por **proyectos**: fotos locales
(optimizadas por Next.js) y videos en YouTube. Todo el contenido vive en el repo.

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
  cover.webp  01.webp  02.webp ...   Fotos del proyecto
```

### Agregar un proyecto

1. Elegí el **slug** (minúsculas, números y guiones): `kama-x1`.
2. Creá la carpeta de fotos `public/portfolio/<categoria>/kama-x1/` y copiá ahí
   `cover.webp` (portada) y las demás fotos (`01.webp`, `02.webp`, …).
3. Creá `content/portfolio/proyectos/kama-x1.json`:

   ```json
   {
     "title": "KAMA X1",
     "client": "Nombre del cliente",
     "year": 2025,
     "category": "marcas",
     "services": ["Fotografía", "Video"],
     "description": ["Primer párrafo.", "Segundo párrafo (opcional)."],
     "cover": { "file": "cover.webp", "alt": "Describí la imagen de portada" },
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
| `cover` | sí | `{ file, alt }`. La portada de la tarjeta y de la página |
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
