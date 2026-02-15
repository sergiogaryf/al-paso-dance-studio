/* ============================================
   ESTACION SALSERA - PWA Alumno JS
   ============================================ */

let currentUser = null;
let userClases = [];

// ---- AUTH CHECK ----
auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  try {
    const userData = await FirestoreService.getUser(user.uid);
    if (!userData) {
      window.location.href = 'login.html';
      return;
    }
    // If admin, redirect to admin panel
    if (userData.role === 'admin' || userData.rol === 'admin') {
      window.location.href = 'admin.html';
      return;
    }
    currentUser = { uid: user.uid, ...userData };
    document.getElementById('appLoading').style.display = 'none';
    document.getElementById('appContent').classList.remove('hidden');
    document.getElementById('tabBar').classList.remove('hidden');
    initApp();
  } catch (e) {
    console.error('Error cargando usuario:', e);
    window.location.href = 'login.html';
  }
});

// ---- INIT ----
function initApp() {
  setupTabs();
  setupLogout();
  loadInicio();
  registerSW();
}

// ---- SERVICE WORKER ----
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  }
}

// ---- TAB NAVIGATION ----
function setupTabs() {
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      // Update active tab
      document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // Show section
      document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      // Load data
      loadTab(tabId);
    });
  });
}

function loadTab(tabId) {
  switch (tabId) {
    case 'tab-inicio': loadInicio(); break;
    case 'tab-horario': loadHorario(); break;
    case 'tab-companeros': loadCompaneros(); break;
    case 'tab-eventos': loadEventosAlumno(); break;
    case 'tab-perfil': loadPerfil(); break;
  }
}

// ---- LOGOUT ----
function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    auth.signOut().then(() => window.location.href = 'login.html');
  });
}

// ============================================
// TAB: INICIO
// ============================================
async function loadInicio() {
  if (!currentUser) return;

  // Greeting
  const nombre = currentUser.nombre ? currentUser.nombre.split(' ')[0] : 'Alumno';
  document.getElementById('userName').textContent = nombre;

  // Clases restantes
  const contratadas = currentUser.clasesContratadas || 0;
  const asistidas = currentUser.clasesAsistidas || 0;
  const restantes = Math.max(0, contratadas - asistidas);
  document.getElementById('clasesRestantes').textContent = restantes;
  document.getElementById('clasesAsistidasInfo').textContent = asistidas;
  document.getElementById('clasesContratadasInfo').textContent = contratadas;

  const pct = contratadas > 0 ? Math.round((asistidas / contratadas) * 100) : 0;
  document.getElementById('clasesProgress').style.width = pct + '%';

  // Sede
  document.getElementById('userSede').textContent = currentUser.sede || 'Sin asignar';

  // Proxima clase
  await loadProximaClase();
}

async function loadProximaClase() {
  const container = document.getElementById('proximaClaseContent');
  try {
    const cursosIds = currentUser.cursosInscritos || [];
    if (cursosIds.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.9rem;">No tienes clases inscritas</p>';
      return;
    }

    // Load enrolled classes
    if (userClases.length === 0) {
      const allClases = await FirestoreService.getClasesActivas();
      userClases = allClases.filter(c => cursosIds.includes(c.id));
    }

    if (userClases.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.9rem;">No se encontraron clases</p>';
      return;
    }

    // Find next class based on current day
    const diasOrden = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
    const hoyIdx = (new Date().getDay() + 6) % 7; // 0=Lunes

    let nextClase = null;
    let minDist = 8;

    for (const c of userClases) {
      const claseIdx = diasOrden.indexOf(c.dia);
      if (claseIdx === -1) continue;
      let dist = claseIdx - hoyIdx;
      if (dist < 0) dist += 7;
      if (dist === 0) {
        // Same day - check if class time hasn't passed
        const now = new Date();
        const [h, m] = (c.hora || '00:00').split(':').map(Number);
        if (h > now.getHours() || (h === now.getHours() && m > now.getMinutes())) {
          if (dist < minDist) { minDist = dist; nextClase = c; }
        } else {
          dist = 7;
          if (dist < minDist) { minDist = dist; nextClase = c; }
        }
      } else {
        if (dist < minDist) { minDist = dist; nextClase = c; }
      }
    }

    if (nextClase) {
      container.innerHTML = `
        <div class="proxima-clase-info">
          <div class="proxima-dia">${nextClase.dia}</div>
          <div class="proxima-detalle">
            <h4>${nextClase.nombre}</h4>
            <p>${nextClase.hora} &middot; ${nextClase.sede}</p>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = '<p class="text-muted" style="font-size:0.9rem;">Sin clases proximas</p>';
    }
  } catch (e) {
    console.error('Error cargando proxima clase:', e);
    container.innerHTML = '<p class="text-muted" style="font-size:0.9rem;">Error al cargar</p>';
  }
}

// ============================================
// TAB: HORARIO
// ============================================
async function loadHorario() {
  const container = document.getElementById('horarioList');
  const cursosIds = currentUser.cursosInscritos || [];

  if (cursosIds.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">&#128336;</span>
        <p>No tienes clases inscritas aun</p>
      </div>
    `;
    return;
  }

  try {
    if (userClases.length === 0) {
      const allClases = await FirestoreService.getClasesActivas();
      userClases = allClases.filter(c => cursosIds.includes(c.id));
    }

    if (userClases.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">&#128336;</span>
          <p>No se encontraron clases</p>
        </div>
      `;
      return;
    }

    // Sort by day of week
    const diasOrden = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
    const sorted = [...userClases].sort((a, b) => {
      const dA = diasOrden.indexOf(a.dia);
      const dB = diasOrden.indexOf(b.dia);
      if (dA !== dB) return dA - dB;
      return (a.hora || '').localeCompare(b.hora || '');
    });

    container.innerHTML = sorted.map(c => `
      <div class="boleto-mini">
        <div class="boleto-mini-izq">
          <div class="boleto-mini-dia">${c.dia}</div>
          <div class="boleto-mini-hora">${c.hora}</div>
        </div>
        <div class="boleto-mini-der">
          <div class="boleto-mini-nombre">${c.nombre}</div>
          <div class="boleto-mini-detalle">${c.instructor || 'Instructor'} &middot; ${c.sede}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Error cargando horario:', e);
    container.innerHTML = '<div class="empty-state"><p>Error al cargar horario</p></div>';
  }
}

// ============================================
// TAB: COMPANEROS
// ============================================
async function loadCompaneros() {
  const container = document.getElementById('companerosList');
  const cursosIds = currentUser.cursosInscritos || [];

  if (cursosIds.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">&#128101;</span>
        <p>No tienes clases inscritas</p>
      </div>
    `;
    return;
  }

  try {
    // Load class names if needed
    if (userClases.length === 0) {
      const allClases = await FirestoreService.getClasesActivas();
      userClases = allClases.filter(c => cursosIds.includes(c.id));
    }

    let html = '';
    for (const clase of userClases) {
      const companeros = await FirestoreService.getAlumnosByClase(clase.id);
      const otros = companeros.filter(c => c.id !== currentUser.uid);

      html += `
        <div class="companeros-grupo">
          <div class="companeros-grupo-title">${clase.nombre}</div>
          ${otros.length === 0
            ? '<p class="text-muted" style="font-size:0.85rem;padding:0.3rem 0;">Aun no hay companeros inscritos</p>'
            : otros.map(comp => `
              <div class="companero-item">
                <div class="avatar">${getInitials(comp.nombre)}</div>
                <div class="companero-info">
                  <h4>${comp.nombre}</h4>
                  <span class="badge badge-gold">${comp.nivel || '-'}</span>
                </div>
              </div>
            `).join('')
          }
        </div>
      `;
    }

    container.innerHTML = html || `
      <div class="empty-state">
        <span class="empty-icon">&#128101;</span>
        <p>No se encontraron companeros</p>
      </div>
    `;
  } catch (e) {
    console.error('Error cargando companeros:', e);
    container.innerHTML = '<div class="empty-state"><p>Error al cargar companeros</p></div>';
  }
}

// ============================================
// TAB: EVENTOS
// ============================================
async function loadEventosAlumno() {
  const container = document.getElementById('eventosList');
  try {
    const eventos = await FirestoreService.getEventosActivos();
    if (eventos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">&#9733;</span>
          <p>No hay eventos proximos</p>
        </div>
      `;
      return;
    }

    container.innerHTML = eventos.map(ev => {
      const fecha = formatDate(ev.fecha);
      return `
        <div class="evento-card">
          ${ev.imagenURL
            ? `<img src="${ev.imagenURL}" alt="${sanitize(ev.titulo)}" class="evento-card-img" onerror="this.outerHTML='<div class=\\'evento-card-img-placeholder\\'>&#9733;</div>'">`
            : '<div class="evento-card-img-placeholder">&#9733;</div>'
          }
          <div class="evento-card-body">
            <div class="evento-card-title">${sanitize(ev.titulo)}</div>
            <div class="evento-card-date">${fecha}</div>
            ${ev.lugar ? `<div class="evento-card-place">${sanitize(ev.lugar)}</div>` : ''}
            ${ev.descripcion ? `<div class="evento-card-desc">${sanitize(ev.descripcion)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Error cargando eventos:', e);
    container.innerHTML = '<div class="empty-state"><p>Error al cargar eventos</p></div>';
  }
}

// ============================================
// TAB: PERFIL
// ============================================
function loadPerfil() {
  if (!currentUser) return;

  document.getElementById('perfilAvatar').textContent = getInitials(currentUser.nombre);
  document.getElementById('perfilName').textContent = currentUser.nombre || '-';
  document.getElementById('perfilRole').textContent = currentUser.role || 'alumno';
  document.getElementById('perfilEmail').textContent = currentUser.email || '-';
  document.getElementById('perfilTelefono').textContent = currentUser.telefono || '-';
  document.getElementById('perfilSede').textContent = currentUser.sede || '-';
  document.getElementById('perfilNivel').textContent = currentUser.nivel || '-';

  const contratadas = currentUser.clasesContratadas || 0;
  const asistidas = currentUser.clasesAsistidas || 0;
  const pct = contratadas > 0 ? Math.round((asistidas / contratadas) * 100) : 0;

  document.getElementById('statContratadas').textContent = contratadas;
  document.getElementById('statAsistidas').textContent = asistidas;
  document.getElementById('statPorcentaje').textContent = pct + '%';
}

// ============================================
// HELPERS
// ============================================
function getInitials(nombre) {
  if (!nombre) return '??';
  return nombre.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return dateStr;
  }
}

function sanitize(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
