/* ============================================
   ESTACION SALSERA - JavaScript principal
   ============================================ */

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

// Flip cards - play/pause video on hover
document.querySelectorAll('.curso-flip').forEach(card => {
  const video = card.querySelector('.curso-back video');
  if (!video) return;

  card.addEventListener('mouseenter', () => {
    video.currentTime = 0;
    video.play();
  });

  card.addEventListener('mouseleave', () => {
    video.pause();
  });
});

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
