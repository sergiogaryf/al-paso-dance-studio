/* ============================================
   ESTACION SALSERA - JavaScript principal
   ============================================ */

// ---- MODO INVITADO ----
(function() {
  if (new URLSearchParams(window.location.search).get('modo') === 'invitado') {
    document.body.classList.add('modo-invitado');
    // Mostrar secciones solo para invitados
    document.querySelectorAll('.invitado-only').forEach(el => {
      el.style.display = '';
    });
    // Renderizar calendario inline
    renderCalendarioInline();
  }
})();

// Nav scroll effect
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
});

// Mobile menu toggle
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

menuToggle.addEventListener('click', () => {
  navLinks.classList.toggle('active');
});

// Close mobile menu on link click
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('active');
  });
});

// Fade-in on scroll
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.fade-in').forEach(el => {
  observer.observe(el);
});

// ---- HOVER PLAY/PAUSE PARA VIDEOS DE CURSOS ----
document.querySelectorAll('.curso-card').forEach(card => {
  const video = card.querySelector('.curso-card-video video');
  if (!video) return;
  card.addEventListener('mouseenter', () => {
    video.play().catch(() => {});
  });
  card.addEventListener('mouseleave', () => {
    video.pause();
    video.currentTime = 0;
  });
});

// ---- CALENDARIO INLINE (para invitados) ----
function renderCalendarioInline() {
  var grid = document.getElementById('calGridInline');
  if (!grid) return;

  var CLASES_MARZO = [
    { dia: 2,  color: 'bachata-int', titulo: 'Bachata Intermedio' },
    { dia: 9,  color: 'bachata-int', titulo: 'Bachata Intermedio' },
    { dia: 16, color: 'bachata-int', titulo: 'Bachata Intermedio' },
    { dia: 23, color: 'bachata-int', titulo: 'Bachata Intermedio' },
    { dia: 3,  color: 'casino-bas', titulo: 'Casino Basico' },
    { dia: 10, color: 'casino-bas', titulo: 'Casino Basico' },
    { dia: 17, color: 'casino-bas', titulo: 'Casino Basico' },
    { dia: 24, color: 'casino-bas', titulo: 'Casino Basico' },
    { dia: 4,  color: 'casino-int', titulo: 'Casino Intermedio' },
    { dia: 11, color: 'casino-int', titulo: 'Casino Intermedio' },
    { dia: 18, color: 'casino-int', titulo: 'Casino Intermedio' },
    { dia: 25, color: 'casino-int', titulo: 'Casino Intermedio' },
    { dia: 5,  color: 'mambo', titulo: 'Mambo Open' },
    { dia: 12, color: 'mambo', titulo: 'Mambo Open' },
    { dia: 19, color: 'mambo', titulo: 'Mambo Open' },
    { dia: 26, color: 'mambo', titulo: 'Mambo Open' },
    { dia: 6,  color: 'bachata-bas', titulo: 'Bachata Basico' },
    { dia: 13, color: 'bachata-bas', titulo: 'Bachata Basico' },
    { dia: 20, color: 'bachata-bas', titulo: 'Bachata Basico' },
    { dia: 27, color: 'bachata-bas', titulo: 'Bachata Basico' },
  ];

  // Marzo 2026: 1 de marzo es domingo (getDay() = 0)
  // Calendario inicia en lunes: domingo = columna 7
  // primerDia getDay()=0 (domingo) -> offset = 6 (ultimo de la semana)
  var primerDiaJS = new Date(2026, 2, 1).getDay(); // 0=domingo
  // Convertir a lunes=0: (primerDiaJS + 6) % 7
  var offset = (primerDiaJS + 6) % 7; // 6 para domingo
  var diasEnMarzo = 31;

  var clasesPorDia = {};
  CLASES_MARZO.forEach(function(clase) {
    if (!clasesPorDia[clase.dia]) clasesPorDia[clase.dia] = [];
    clasesPorDia[clase.dia].push(clase);
  });

  var hoy = new Date();
  var esMarzo2026 = hoy.getFullYear() === 2026 && hoy.getMonth() === 2;

  var html = '';

  // Celdas vacias antes del dia 1
  for (var v = 0; v < offset; v++) {
    html += '<div class="cal-dia-inline vacio"></div>';
  }

  for (var dia = 1; dia <= diasEnMarzo; dia++) {
    var clases = clasesPorDia[dia] || [];
    var tieneClase = clases.length > 0;
    var esHoy = esMarzo2026 && hoy.getDate() === dia;

    var puntosHTML = clases.map(function(c) {
      return '<div class="cal-dia-punto-inline cal-dot-' + c.color + '" title="' + c.titulo + '"></div>';
    }).join('');

    html += '<div class="cal-dia-inline' +
      (tieneClase ? ' tiene-clase' : '') +
      (esHoy ? ' hoy' : '') +
      '">' +
      '<span class="cal-dia-num-inline">' + dia + '</span>' +
      (puntosHTML ? '<div class="cal-dia-puntos-inline">' + puntosHTML + '</div>' : '') +
      '</div>';
  }

  grid.innerHTML = html;
}

// ---- BANNERS DESDE FIRESTORE ----
async function loadLandingBanners() {
  try {
    if (typeof db === 'undefined') return;
    const snapshot = await db.collection('banners')
      .where('activo', '==', true)
      .orderBy('orden')
      .get();

    if (snapshot.empty) {
      document.getElementById('banners-landing').style.display = 'none';
      return;
    }

    const carousel = document.getElementById('bannersCarousel');
    carousel.innerHTML = snapshot.docs.map(doc => {
      const b = doc.data();
      const img = `<img src="${b.imagenURL}" alt="${b.titulo || ''}" class="banner-img" onerror="this.parentElement.style.display='none'">`;
      return b.enlace
        ? `<a href="${b.enlace}" class="banner-slide" target="_blank" rel="noopener">${img}</a>`
        : `<div class="banner-slide">${img}</div>`;
    }).join('');
  } catch (e) {
    console.warn('No se pudieron cargar banners:', e);
    document.getElementById('banners-landing').style.display = 'none';
  }
}

// ---- EVENTOS DESDE FIRESTORE ----
async function loadLandingEventos() {
  try {
    if (typeof db === 'undefined') return;
    const snapshot = await db.collection('eventos')
      .where('activo', '==', true)
      .orderBy('fecha')
      .limit(6)
      .get();

    const grid = document.getElementById('eventosLandingGrid');
    if (snapshot.empty) {
      document.getElementById('eventos-landing').style.display = 'none';
      return;
    }

    grid.innerHTML = snapshot.docs.map(doc => {
      const ev = doc.data();
      const fecha = ev.fecha ? new Date(ev.fecha + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long' }) : '';
      return `
        <div class="evento-landing-card fade-in">
          ${ev.imagenURL ? `<div class="evento-landing-img" style="background-image:url('${ev.imagenURL}')"></div>` : ''}
          <div class="evento-landing-body">
            <h3>${ev.titulo}</h3>
            ${fecha ? `<p class="evento-landing-fecha">${fecha}</p>` : ''}
            ${ev.lugar ? `<p class="evento-landing-lugar">${ev.lugar}</p>` : ''}
            ${ev.descripcion ? `<p class="evento-landing-desc">${ev.descripcion}</p>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Observe new fade-in elements
    grid.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
  } catch (e) {
    console.warn('No se pudieron cargar eventos:', e);
    document.getElementById('eventos-landing').style.display = 'none';
  }
}

// ---- REGISTER SERVICE WORKER ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => {
    console.warn('SW registration failed:', err);
  });
}

// ---- LOAD DYNAMIC CONTENT ----
loadLandingBanners();
loadLandingEventos();
