# Memoria del Proyecto - Estacion Salsera Dance Studio

## Datos generales
- **Nombre:** Estacion Salsera
- **Director:** Francisco Rojas
- **Tipo:** Academia de danza
- **Disciplinas:** Salsa, Bachata, Casino
- **Niveles:** Basico e Intermedio
- **Sedes:** Calera y Quillota
- **Colores:** Negro (#0a0a0a) y Dorado (#d4a017)
- **Logo:** Tren dorado con clave de sol (Logo.png)
- **Fuente principal:** Sugo Pro Display (local, trial/personal use)
- **Fuente respaldo:** Cinzel (Google Fonts)
- **WhatsApp:** 56XXXXXXXXX (pendiente de actualizar con numero real)

## Estructura del proyecto
```
estacion-salsera-dance-studio/
├── index.html              -> Pagina principal (landing page)
├── css/
│   └── styles.css          -> Estilos principales
├── js/
│   └── main.js             -> JavaScript (nav, menu, fade-in, flip videos)
├── img/
│   ├── Logo.png            -> Logo del tren dorado
│   ├── Fondo.mp4           -> Video de fondo para hero (38MB)
│   ├── Fondo.png           -> Textura negro/dorado (poster + fondo secciones)
│   ├── Francisco1.jpg      -> Francisco en escenario
│   ├── Francisco2.jpg      -> Francisco bailando social
│   ├── favicon.svg         -> Icono de pestana (tren dorado)
│   ├── og-image.svg        -> Imagen para redes sociales (1200x630)
│   └── README.txt          -> Guia de imagenes
├── fonts/
│   ├── Sugo-Pro-Display-Light-trial.ttf
│   ├── Sugo-Pro-Display-Regular-trial.ttf
│   └── Sugo-Pro-Display-Bold-trial.ttf
└── Documentos/
    └── memoria.md          -> Este archivo
```

## Registro de conversaciones y decisiones

### 2026-02-12 - Inicio del proyecto
- Se creo la carpeta principal y subcarpeta Documentos

### 2026-02-12 - Landing page v1
- Primera version todo en un solo archivo HTML

### 2026-02-12 - Rediseno minimalista v2
- Proyecto reorganizado en carpetas: css/, js/, img/, fonts/
- Diseno minimalista, cards responsivas, fade-in al scroll

### 2026-02-12 - Integracion de multimedia v3
- Video Fondo.mp4 como fondo del hero
- Logo en nav y hero, fotos de Francisco en seccion Director

### 2026-02-12 - Logo sin fondo + boton dorado v4
- Logo con mix-blend-mode: screen
- Boton principal dorado "Subete al Tren del Sabor"

### 2026-02-12 - Terminales de tren + fondo musical v5
- Tarjetas como terminales: Estacion Salsa/Bachata/Casino
- Fondo sutil: pentagrama + notas musicales + vias de tren

### 2026-02-12 - Flip cards + Cinzel/Cormorant v6
- Tarjetas flip 3D con video al dorso
- Logo aparece desde el fondo (zoom from depth)
- Fuentes: Cinzel + Cormorant Garamond

### 2026-02-12 - Sugo Pro Display + mejoras completas v7
- Fuente cambiada a Sugo Pro Display (descargada localmente)
  - Light (300), Regular (400), Bold (700)
  - Cinzel como respaldo via Google Fonts
- Favicon SVG creado (tren dorado sobre fondo negro)
- Imagen OG creada (1200x630 con info de la academia)
- Meta tags Open Graph y Twitter Cards agregados
- Theme color meta tag agregado
- Nota: Sugo Pro Display es trial/uso personal - requiere licencia comercial de zetafonts.com

### 2026-02-12 - Unbounded + horarios v8
- Fuente: Unbounded (titulos) + DM Sans (cuerpo), ambas Google Fonts

### 2026-02-12 - Boletos de tren + correccion horarios + WhatsApp v9
- Numero de WhatsApp actualizado: 56935368400
- Horario corregido: Jue 20:30 Salsa Basico es en QUILLOTA (no Calera)
- Horarios correctos:
  - QUILLOTA: Mar 19:30 Salsa Cubana, Mar 20:30 Rueda Casino, Mie 20:00 Bachata Inicial, Mie 21:00 Salsa Inicial, Jue 19:30 Bachata Basico, Jue 20:30 Salsa Basico
  - CALERA: Vie 19:00 Bachata, Vie 20:00 Salsa
- Sedes rediseñadas como boletos de tren:
  - Lado izquierdo: destino (nombre ciudad + subtitulo) con fondo dorado sutil
  - Perforacion circular tipo boleto real (semicirculos arriba y abajo)
  - Lado derecho: horarios organizados por dia
  - Responsive: en movil el boleto se apila verticalmente

## Pendientes
- Agregar videos especificos para cada curso (salsa, bachata, casino)
- Comprimir Fondo.mp4 (38MB es pesado para web)
- Subir a hosting (Netlify, Vercel, o dominio propio)
