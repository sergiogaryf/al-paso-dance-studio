# Memoria del Proyecto - Al Paso Dance Studio

## Datos generales
- **Nombre:** Al Paso Dance Studio
- **Tagline:** Donde el ritmo comienza
- **Director:** Sergio Gary
- **Tipo:** Academia de danza
- **Disciplinas:** Bachata, Casino, Mambo
- **Sede:** Costa de Montemar, Concon
- **WhatsApp:** +56973327307
- **Dominio:** alpasodancestudio.cl
- **Vercel:** https://al-paso-dance-studio.vercel.app
- **GitHub:** https://github.com/sergiogaryf/al-paso-dance-studio

## Branding
- **Paleta:** Morado oscuro (#430440), naranja sunset, fondo (#140A18)
- **Fuentes:** Poppins (titulos/UI), Great Vibes (script), DM Sans (cuerpo)
- **Estetica:** Atardecer tropical, glassmorphism, glow neon purpura
- **Logo principal:** Logo.png (usado en app, login, admin, profesor)
- **Logo hero:** LOGOHERO.png (blanco transparente, hero de landing)
- **Fondo hero:** hero-bg.png (palmeras atardecer con bokeh purpura/naranja)
- **Videos cursos:** Fondo.mp4 + Fondo.png (poster) — flip cards de cursos

## Cursos (Lun-Vie 21:00-22:00)
1. Lunes: Bachata Intermedio
2. Martes: Casino Basico
3. Miercoles: Casino Intermedio
4. Jueves: Mambo Open
5. Viernes: Bachata Intermedio

## Estructura del proyecto
```
Al Paso Dance Studio AP26/
├── api/                    # Serverless functions (Vercel + Airtable)
│   ├── _lib/auth.js
│   ├── alumnos.js
│   ├── asistencia.js
│   ├── banners.js
│   ├── clases.js
│   ├── companeros.js
│   ├── contenido.js
│   ├── evaluaciones.js
│   ├── eventos.js
│   ├── feedback.js
│   ├── login.js
│   ├── me.js
│   └── observaciones.js
├── public/
│   ├── index.html          # Landing page
│   ├── login.html
│   ├── app.html            # PWA alumno
│   ├── profesor.html       # Panel profesor
│   ├── admin.html          # Panel admin
│   ├── evaluacion.html
│   ├── calendario.html
│   ├── offline.html
│   ├── sw.js               # Service Worker (cache: al-paso-dance-v4)
│   ├── manifest.json
│   ├── css/
│   │   ├── styles.css      # Landing
│   │   ├── app.css
│   │   ├── admin.css
│   │   ├── login.css
│   │   ├── shared.css
│   │   ├── profesor.css
│   │   ├── evaluacion.css
│   │   └── calendario.css
│   ├── js/
│   │   ├── main.js         # Landing JS
│   │   ├── app.js          # PWA alumno
│   │   ├── admin.js        # Panel admin
│   │   ├── profesor.js     # Panel profesor
│   │   ├── auth.js
│   │   ├── api-service.js  # Cliente API (bypass localhost)
│   │   ├── evaluacion.js
│   │   └── calendario.js
│   ├── img/
│   │   ├── LOGOHERO.png    # Logo blanco transparente (hero landing)
│   │   ├── Logo.png        # Logo principal (app/login/admin)
│   │   ├── hero-bg.png     # Fondo hero landing
│   │   ├── Fondo.mp4       # Video fondo flip cards cursos
│   │   ├── Fondo.png       # Poster video + fondo secciones
│   │   ├── Sergio Gary.png # Foto instructor
│   │   ├── favicon.png
│   │   ├── logo-icon.png   # Usado en offline.html
│   │   ├── og-image.svg    # Meta tags redes sociales
│   │   ├── evento-mulata.png
│   │   ├── icons/          # PWA icons
│   │   └── README.txt
│   ├── Galeria/            # Fotos de fiestas (galeria1-10.jpg)
│   ├── Wall of love/       # Testimonios y reseñas
│   ├── fonts/              # Sugo Pro Display (trial)
│   ├── admin/index.html
│   └── Documentos/
│       └── memoria.md      # Este archivo
├── scripts/
│   ├── hash-password.js
│   └── sync-rachas.js
├── docs/
│   └── pauta_planificacion.docx
├── vercel.json
└── package.json
```

## Stack tecnico
- **Frontend:** Vanilla HTML/CSS/JS (sin frameworks)
- **Backend:** Vercel Serverless Functions (Node.js)
- **Base de datos:** Airtable
- **Imagenes perfil:** Cloudinary (Cloud: debpk4syz, Preset: al-paso-fotos)
- **Auth:** JWT + bcrypt
- **Deploy:** Vercel (auto-deploy desde main)
- **Dev local:** Python HTTP server — login bypass en api-service.js para localhost

## Funcionalidades principales
- Landing page publica con cursos, eventos, instructor, wall of love, contacto
- PWA alumno: Inicio, Calendario, Videos, Galeria, Evaluacion, Companeros, Horario, Perfil
- Panel profesor: asistencia, feedback mensual, calendario
- Panel admin: gestion alumnos, clases, banners, eventos
- Foto de perfil via Cloudinary (alumno y profesor)
- Cumpleanos en calendario (campo FechaNacimiento en Airtable)
- Videos de clases (tabla Videos en Airtable, formato YouTube)
- Galeria de fiestas (tabla Galeria en Airtable)
- Racha de asistencia (columna UltimaClase en tabla Alumnos)
- Playlist (constante PLAYLIST_URL en app.js)

## Registro de cambios relevantes
- **Feb 2026:** Inicio del proyecto (fork de Estacion Salsera, rebranded completo)
- **Feb 2026:** Landing rediseñada — hero poster, glassmorphism, neon morado
- **Feb 2026:** PWA alumno con 8 tabs, service worker, foto perfil Cloudinary
- **Feb 2026:** Galeria de fiestas + videos de clases + feedback profesor
- **Mar 2026:** Logica de racha simplificada (columna UltimaClase)
- **Mar 2026:** Fix tab bar profesor (flex, overflow, safe-area)
- **Mar 2026:** Fix rol profesor → redirige a profesor.html
- **Mar 2026:** Limpieza del proyecto — eliminados archivos Firebase, logos sin usar, referencias a Estacion Salsera
