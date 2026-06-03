# Stroka Visual

Sitio de portfolio para la productora audiovisual **Stroka Visual**.
Next.js (App Router) + Tailwind CSS. Sin CMS, sin base de datos, sin login,
sin middleware. Estética editorial, cinematográfica, negro y blanco con un
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
