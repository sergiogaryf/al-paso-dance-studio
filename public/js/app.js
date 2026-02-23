/* ============================================
   ESTACION SALSERA - PWA Alumno JS
   ============================================ */

let currentUser = null;
let userClases = [];

// ---- AUTH CHECK ----
(async function () {
  try {
    // Acceso por link directo: app.html?token=XXXXX
    const urlParams = new URLSearchParams(window.location.search);
    const linkToken = urlParams.get('token');

    if (linkToken) {
      try {
        const userData = await ApiService.loginConLink(linkToken);
        // Limpiar token de la URL sin recargar
        window.history.replaceState({}, document.title, window.location.pathname);
        if (userData.role === 'admin') { window.location.href = 'admin.html'; return; }
        currentUser = { uid: userData.id, ...userData };
        document.getElementById('appLoading').style.display = 'none';
        document.getElementById('appContent').classList.remove('hidden');
        document.getElementById('tabBar').classList.remove('hidden');
        initApp();
        return;
      } catch (e) {
        console.error('Link invalido:', e);
        window.location.href = 'login.html';
        return;
      }
    }

    // Acceso normal con sesion existente
    if (!ApiService.isLoggedIn()) {
      window.location.href = 'login.html';
      return;
    }
    const userData = await ApiService.getCurrentUser();
    if (!userData) {
      window.location.href = 'login.html';
      return;
    }
    if (userData.role === 'admin') {
      window.location.href = 'admin.html';
      return;
    }
    currentUser = { uid: userData.id, ...userData };
    document.getElementById('appLoading').style.display = 'none';
    document.getElementById('appContent').classList.remove('hidden');
    document.getElementById('tabBar').classList.remove('hidden');
    initApp();
  } catch (e) {
    console.error('Error cargando usuario:', e);
    window.location.href = 'login.html';
  }
})();

// ---- INIT ----
function initApp() {
  setupTabs();
  setupLogout();
  setupEvaluacion();
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
    case 'tab-calendario': loadCalendario(); break;
    case 'tab-evaluacion': loadEvaluacion(); break;
    case 'tab-companeros': loadCompaneros(); break;
    case 'tab-perfil': loadPerfil(); break;
  }
}

// ---- LOGOUT ----
function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    ApiService.logout();
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

  // Eventos inline en inicio
  loadEventosInicio();
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

async function loadEventosInicio() {
  const container = document.getElementById('eventosInicio');
  if (!container) return;
  try {
    const eventos = await FirestoreService.getEventosActivos();
    if (eventos.length === 0) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = `
      <div class="card-label" style="margin-top:1rem">Proximos eventos</div>
      ${eventos.slice(0, 3).map(ev => {
        const fecha = formatDate(ev.fecha);
        return `<div class="glass-card" style="margin-bottom:0.6rem;padding:0.8rem 1rem">
          <div style="font-size:0.9rem;color:var(--blanco);font-weight:600">${sanitize(ev.titulo)}</div>
          <div style="font-size:0.75rem;color:var(--blanco-suave)">${fecha}${ev.lugar ? ' &middot; ' + sanitize(ev.lugar) : ''}</div>
        </div>`;
      }).join('')}
    `;
  } catch (e) {
    container.innerHTML = '';
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
// TAB: CALENDARIO
// ============================================
function loadCalendario() {
  var grid = document.getElementById('calGridApp');
  if (!grid || grid.children.length > 0) return; // ya renderizado

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

  // Marzo 2026: 1 de marzo es domingo -> offset lunes-based = 6
  var primerDiaJS = new Date(2026, 2, 1).getDay();
  var offset = (primerDiaJS + 6) % 7;
  var diasEnMarzo = 31;

  var clasesPorDia = {};
  CLASES_MARZO.forEach(function(clase) {
    if (!clasesPorDia[clase.dia]) clasesPorDia[clase.dia] = [];
    clasesPorDia[clase.dia].push(clase);
  });

  var hoy = new Date();
  var esMarzo2026 = hoy.getFullYear() === 2026 && hoy.getMonth() === 2;

  var html = '';
  for (var v = 0; v < offset; v++) {
    html += '<div class="cal-dia-app vacio"></div>';
  }

  for (var dia = 1; dia <= diasEnMarzo; dia++) {
    var clases = clasesPorDia[dia] || [];
    var tieneClase = clases.length > 0;
    var esHoy = esMarzo2026 && hoy.getDate() === dia;

    var puntosHTML = clases.map(function(c) {
      return '<div class="cal-punto-app cal-dot-' + c.color + '"></div>';
    }).join('');

    html += '<div class="cal-dia-app' +
      (tieneClase ? ' tiene-clase' : '') +
      (esHoy ? ' hoy' : '') +
      '">' +
      '<span class="cal-num-app">' + dia + '</span>' +
      (puntosHTML ? '<div class="cal-puntos-app">' + puntosHTML + '</div>' : '') +
      '</div>';
  }

  grid.innerHTML = html;
}

// ============================================
// TAB: EVALUACION
// ============================================
let evalAppInitialized = false;

function setupEvaluacion() {
  // Sliders
  ['evalAppDisfrute', 'evalAppComprension', 'evalAppComodidad', 'evalAppConfianza'].forEach(id => {
    const input = document.getElementById(id);
    const display = document.getElementById(id + 'Val');
    if (input && display) {
      input.addEventListener('input', () => { display.textContent = input.value; });
    }
  });

  // Clase buttons
  document.querySelectorAll('.eval-app-clase-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.eval-app-clase-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Binaria
  document.getElementById('evalAppBaileSi').addEventListener('click', () => {
    document.getElementById('evalAppBaileSi').classList.add('selected-si');
    document.getElementById('evalAppBaileNo').classList.remove('selected-no');
  });
  document.getElementById('evalAppBaileNo').addEventListener('click', () => {
    document.getElementById('evalAppBaileNo').classList.add('selected-no');
    document.getElementById('evalAppBaileSi').classList.remove('selected-si');
  });

  // Submit
  document.getElementById('btnEnviarEvalApp').addEventListener('click', enviarEvaluacionAlumno);
}

function loadEvaluacion() {
  if (evalAppInitialized) return;
  evalAppInitialized = true;

  // Poblar select de cursos desde cursosInscritos
  const select = document.getElementById('evalAppCurso');
  const cursosIds = currentUser.cursosInscritos || [];

  if (userClases.length > 0) {
    poblarCursos(select, userClases);
  } else if (cursosIds.length > 0) {
    FirestoreService.getClasesActivas().then(all => {
      userClases = all.filter(c => cursosIds.includes(c.id));
      poblarCursos(select, userClases);
    });
  }
}

function poblarCursos(select, clases) {
  select.innerHTML = '<option value="">Selecciona tu curso</option>';
  clases.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.nombre;
    opt.textContent = c.nombre + ' - ' + c.dia;
    select.appendChild(opt);
  });
  if (clases.length === 1) {
    select.value = clases[0].nombre;
  }
}

async function enviarEvaluacionAlumno() {
  const errorEl = document.getElementById('evalAppError');
  const exitoEl = document.getElementById('evalAppExito');
  errorEl.classList.add('hidden');
  exitoEl.classList.add('hidden');

  const curso = document.getElementById('evalAppCurso').value;
  if (!curso) {
    errorEl.textContent = 'Selecciona tu curso.';
    errorEl.classList.remove('hidden');
    return;
  }

  const claseBtn = document.querySelector('.eval-app-clase-btn.selected');
  if (!claseBtn) {
    errorEl.textContent = 'Selecciona el numero de clase.';
    errorEl.classList.remove('hidden');
    return;
  }

  const tieneSi = document.getElementById('evalAppBaileSi').classList.contains('selected-si');
  const tieneNo = document.getElementById('evalAppBaileNo').classList.contains('selected-no');
  if (!tieneSi && !tieneNo) {
    errorEl.textContent = 'Indica si bailaste con alguien nuevo.';
    errorEl.classList.remove('hidden');
    return;
  }

  const payload = {
    nombreAlumno: currentUser.nombre,
    curso: curso,
    numeroClase: parseInt(claseBtn.dataset.clase),
    disfrute: parseInt(document.getElementById('evalAppDisfrute').value),
    comprension: parseInt(document.getElementById('evalAppComprension').value),
    comodidadPareja: parseInt(document.getElementById('evalAppComodidad').value),
    confianza: parseInt(document.getElementById('evalAppConfianza').value),
    baileNuevo: tieneSi,
    comentario: document.getElementById('evalAppComentario').value.trim(),
  };

  const btn = document.getElementById('btnEnviarEvalApp');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const res = await ApiService._fetch('/api/evaluaciones', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    exitoEl.textContent = 'Evaluacion enviada. Gracias por tu feedback!';
    exitoEl.classList.remove('hidden');

    // Reset form
    document.querySelectorAll('.eval-app-clase-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('evalAppBaileSi').classList.remove('selected-si');
    document.getElementById('evalAppBaileNo').classList.remove('selected-no');
    ['evalAppDisfrute', 'evalAppComprension', 'evalAppComodidad', 'evalAppConfianza'].forEach(id => {
      document.getElementById(id).value = 5;
      document.getElementById(id + 'Val').textContent = '5';
    });
    document.getElementById('evalAppComentario').value = '';
  } catch (err) {
    if (err.message && err.message.includes('409')) {
      errorEl.textContent = 'Ya enviaste tu evaluacion de hoy. Vuelve manana.';
    } else {
      errorEl.textContent = err.message || 'Error al enviar. Intenta de nuevo.';
    }
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar mi evaluacion';
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
