/* ============================================
   AL PASO DANCE STUDIO - PWA Alumno JS
   ============================================ */

// ── CLOUDINARY CONFIG ──────────────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME    = 'debpk4syz';
const CLOUDINARY_UPLOAD_PRESET = 'al-paso-fotos'; // Crear en Cloudinary > Settings > Upload Presets (unsigned)

// ── PLAYLIST URL ───────────────────────────────────────────────────────────
const PLAYLIST_URL = ''; // Pegar aqui el link de YouTube Music cuando lo tengas

// ── CURSOS DE LA ACADEMIA ──────────────────────────────────────────────────
const CURSOS_ACADEMIA = [
  'Casino Basico',
  'Casino Intermedio',
  'Mambo Open',
  'Bachata Basico',
  'Bachata Intermedio',
];

let currentUser = null;
let userClases  = [];

// ── AUTH CHECK ────────────────────────────────────────────────────────────
(async function () {
  try {
    // Acceso por link directo: app.html?token=XXXXX
    const urlParams = new URLSearchParams(window.location.search);
    const linkToken = urlParams.get('token');

    if (linkToken) {
      try {
        const userData = await ApiService.loginConLink(linkToken);
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

// ── INIT ──────────────────────────────────────────────────────────────────
function initApp() {
  setupTabs();
  setupLogout();
  setupEvaluacion();
  setupFotoUpload();
  setupPlaylist();
  loadInicio();
  registerSW();
}

// ── SERVICE WORKER ────────────────────────────────────────────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  }
}

// ── TAB NAVIGATION ────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      loadTab(tabId);
    });
  });
}

function loadTab(tabId) {
  switch (tabId) {
    case 'tab-inicio':      loadInicio();       break;
    case 'tab-horario':     loadHorario();      break;
    case 'tab-calendario':  loadCalendario();   break;
    case 'tab-evaluacion':  loadEvaluacion();   break;
    case 'tab-companeros':  loadCompaneros();   break;
    case 'tab-videos':      loadVideos();       break;
    case 'tab-galeria':     loadGaleria();      break;
    case 'tab-perfil':      loadPerfil();       break;
  }
}

// ── LOGOUT ────────────────────────────────────────────────────────────────
function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    ApiService.logout();
  });
}

// ── PLAYLIST ──────────────────────────────────────────────────────────────
function setupPlaylist() {
  const card = document.getElementById('playlistCard');
  const link = document.getElementById('playlistLink');
  if (!card || !link) return;
  if (PLAYLIST_URL) {
    link.href = PLAYLIST_URL;
    card.style.display = '';
  }
}

// ============================================
// TAB: INICIO
// ============================================
async function loadInicio() {
  if (!currentUser) return;

  const nombre = currentUser.nombre ? currentUser.nombre.split(' ')[0] : 'Alumno';
  document.getElementById('userName').textContent = nombre;

  const contratadas = currentUser.clasesContratadas || 0;
  const asistidas   = currentUser.clasesAsistidas    || 0;
  const restantes   = Math.max(0, contratadas - asistidas);
  document.getElementById('clasesRestantes').textContent   = restantes;
  document.getElementById('clasesAsistidasInfo').textContent  = asistidas;
  document.getElementById('clasesContratadasInfo').textContent = contratadas;

  const pct = contratadas > 0 ? Math.round((asistidas / contratadas) * 100) : 0;
  document.getElementById('clasesProgress').style.width = pct + '%';

  document.getElementById('userSede').textContent = currentUser.sede || 'Costa de Montemar, Concon';

  const meses = calcMeses(currentUser.fechaIngreso);
  document.getElementById('inicioPlan').textContent  = currentUser.plan || '-';
  document.getElementById('inicioMeses').textContent = meses;
  document.getElementById('inicioRacha').textContent = asistidas;

  await loadProximaClase();
  loadEventosInicio();
}

async function loadProximaClase() {
  const container = document.getElementById('proximaClaseContent');
  try {
    const cursosNombres = currentUser.cursosInscritos || [];
    if (cursosNombres.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.9rem;">No tienes clases inscritas</p>';
      return;
    }

    if (userClases.length === 0) {
      const allClases = await FirestoreService.getClasesActivas();
      userClases = allClases.filter(c =>
        cursosNombres.some(n => c.nombre && c.nombre.toLowerCase().includes(n.toLowerCase()))
      );
    }

    if (userClases.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.9rem;">No se encontraron clases</p>';
      return;
    }

    const diasOrden = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
    const hoyIdx    = (new Date().getDay() + 6) % 7;

    let nextClase = null;
    let minDist   = 8;

    for (const c of userClases) {
      const claseIdx = diasOrden.indexOf(c.dia);
      if (claseIdx === -1) continue;
      let dist = claseIdx - hoyIdx;
      if (dist < 0) dist += 7;
      if (dist === 0) {
        const now  = new Date();
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
    if (eventos.length === 0) { container.innerHTML = ''; return; }
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
  const container    = document.getElementById('horarioList');
  const cursosNombres = currentUser.cursosInscritos || [];

  if (cursosNombres.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">&#128336;</span><p>No tienes clases inscritas aun</p></div>`;
    return;
  }

  try {
    if (userClases.length === 0) {
      const allClases = await FirestoreService.getClasesActivas();
      userClases = allClases.filter(c =>
        cursosNombres.some(n => c.nombre && c.nombre.toLowerCase().includes(n.toLowerCase()))
      );
    }

    if (userClases.length === 0) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon">&#128336;</span><p>No se encontraron clases</p></div>`;
      return;
    }

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
// TAB: CALENDARIO (con cumpleaños dinámicos)
// ============================================
let calendarioLoaded = false;

async function loadCalendario() {
  if (calendarioLoaded) return;
  calendarioLoaded = true;

  var grid = document.getElementById('calGridApp');
  if (!grid) return;

  var now   = new Date();
  var year  = now.getFullYear();
  var month = now.getMonth(); // 0-indexed

  // Actualizar titulo
  var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var tituloEl = document.getElementById('calTitulo');
  if (tituloEl) tituloEl.textContent = 'Calendario ' + MESES[month] + ' ' + year;

  // Horario semanal fijo de la academia (0=Lunes, 4=Viernes)
  var HORARIO_SEMANAL = {
    0: { color: 'bachata-int', titulo: 'Bachata Intermedio' }, // Lunes
    1: { color: 'casino-bas', titulo: 'Casino Basico' },       // Martes
    2: { color: 'casino-int', titulo: 'Casino Intermedio' },   // Miercoles
    3: { color: 'mambo',      titulo: 'Mambo Open' },          // Jueves
    4: { color: 'bachata-bas', titulo: 'Bachata Basico' },     // Viernes
  };

  // Buscar cumpleaños del mes actual
  var cumpleanerosMes = [];
  try {
    var todos = await ApiService._fetch('/api/cumpleanos');
    cumpleanerosMes = todos.filter(function(c) {
      return c.mes === (month + 1);
    });
  } catch (e) { /* ignorar si no hay API disponible */ }

  // Indexar cumpleaños por dia
  var cumplesPorDia = {};
  cumpleanerosMes.forEach(function(c) {
    var d = c.dia;
    if (!cumplesPorDia[d]) cumplesPorDia[d] = [];
    cumplesPorDia[d].push(c);
  });

  // Calcular primer día del mes (offset Lunes-based)
  var primerDia   = new Date(year, month, 1);
  var offset      = (primerDia.getDay() + 6) % 7;
  var diasEnMes   = new Date(year, month + 1, 0).getDate();
  var hoy         = new Date();
  var esEsteMes   = hoy.getFullYear() === year && hoy.getMonth() === month;

  // Construir dias con clases
  var clasesPorDia = {};
  for (var d = 1; d <= diasEnMes; d++) {
    var diaSemana = (new Date(year, month, d).getDay() + 6) % 7;
    if (HORARIO_SEMANAL[diaSemana]) {
      clasesPorDia[d] = [HORARIO_SEMANAL[diaSemana]];
    }
  }

  // Render grid
  var html = '';
  for (var v = 0; v < offset; v++) {
    html += '<div class="cal-dia-app vacio"></div>';
  }

  for (var dia = 1; dia <= diasEnMes; dia++) {
    var clases   = clasesPorDia[dia] || [];
    var cumples  = cumplesPorDia[dia] || [];
    var esHoy    = esEsteMes && hoy.getDate() === dia;

    var puntosHTML = clases.map(function(c) {
      return '<div class="cal-punto-app cal-dot-' + c.color + '"></div>';
    }).join('');

    var cumpleHTML = cumples.length > 0
      ? '<div class="cal-cumple-emoji" title="' + cumples.map(function(c){ return c.nombre; }).join(', ') + '">&#127874;</div>'
      : '';

    html += '<div class="cal-dia-app' +
      (clases.length > 0 ? ' tiene-clase' : '') +
      (esHoy ? ' hoy' : '') +
      (cumples.length > 0 ? ' tiene-cumple' : '') +
      '">' +
      '<span class="cal-num-app">' + dia + '</span>' +
      (puntosHTML ? '<div class="cal-puntos-app">' + puntosHTML + '</div>' : '') +
      cumpleHTML +
      '</div>';
  }

  grid.innerHTML = html;

  // Lista de cumpleañeros del mes
  if (cumpleanerosMes.length > 0) {
    var listEl = document.getElementById('cumpleanerosMes');
    if (listEl) {
      listEl.innerHTML = '<div class="cumple-lista-titulo">&#127874; Cumpleanos de ' + MESES[month] + '</div>' +
        cumpleanerosMes.sort(function(a,b){ return a.dia - b.dia; }).map(function(c) {
          return '<div class="cumple-item">' +
            '<span class="cumple-dia">' + c.dia + '</span>' +
            '<span class="cumple-nombre">' + sanitize(c.nombre) + '</span>' +
          '</div>';
        }).join('');
    }
  }
}

// ============================================
// TAB: EVALUACION
// ============================================
let evalAppInitialized = false;

function setupEvaluacion() {
  ['evalAppDisfrute', 'evalAppComprension', 'evalAppComodidad', 'evalAppConfianza'].forEach(id => {
    const input   = document.getElementById(id);
    const display = document.getElementById(id + 'Val');
    if (input && display) {
      input.addEventListener('input', () => { display.textContent = input.value; });
    }
  });

  document.querySelectorAll('.eval-app-clase-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.eval-app-clase-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  document.getElementById('evalAppBaileSi').addEventListener('click', () => {
    document.getElementById('evalAppBaileSi').classList.add('selected-si');
    document.getElementById('evalAppBaileNo').classList.remove('selected-no');
  });
  document.getElementById('evalAppBaileNo').addEventListener('click', () => {
    document.getElementById('evalAppBaileNo').classList.add('selected-no');
    document.getElementById('evalAppBaileSi').classList.remove('selected-si');
  });

  document.getElementById('btnEnviarEvalApp').addEventListener('click', enviarEvaluacionAlumno);
}

function loadEvaluacion() {
  if (evalAppInitialized) return;
  evalAppInitialized = true;

  const select        = document.getElementById('evalAppCurso');
  const cursosNombres = currentUser.cursosInscritos || [];

  if (userClases.length > 0) {
    poblarCursos(select, userClases);
  } else if (cursosNombres.length > 0) {
    FirestoreService.getClasesActivas().then(all => {
      userClases = all.filter(c =>
        cursosNombres.some(n => c.nombre && c.nombre.toLowerCase().includes(n.toLowerCase()))
      );
      if (userClases.length > 0) {
        poblarCursos(select, userClases);
      } else {
        select.innerHTML = '<option value="">Selecciona tu curso</option>';
        cursosNombres.forEach(n => {
          const opt = document.createElement('option');
          opt.value = n; opt.textContent = n;
          select.appendChild(opt);
        });
        if (cursosNombres.length === 1) select.value = cursosNombres[0];
      }
    });
  }
}

function poblarCursos(select, clases) {
  select.innerHTML = '<option value="">Selecciona tu curso</option>';
  clases.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.nombre;
    opt.textContent = c.nombre + (c.dia ? ' — ' + c.dia : '');
    select.appendChild(opt);
  });
  if (clases.length === 1) select.value = clases[0].nombre;
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
    nombreAlumno:   currentUser.nombre,
    curso:          curso,
    numeroClase:    parseInt(claseBtn.dataset.clase),
    disfrute:       parseInt(document.getElementById('evalAppDisfrute').value),
    comprension:    parseInt(document.getElementById('evalAppComprension').value),
    comodidadPareja: parseInt(document.getElementById('evalAppComodidad').value),
    confianza:      parseInt(document.getElementById('evalAppConfianza').value),
    baileNuevo:     tieneSi,
    comentario:     document.getElementById('evalAppComentario').value.trim(),
  };

  const btn = document.getElementById('btnEnviarEvalApp');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    await ApiService._fetch('/api/evaluaciones', { method: 'POST', body: JSON.stringify(payload) });
    exitoEl.textContent = 'Evaluacion enviada. Gracias por tu feedback!';
    exitoEl.classList.remove('hidden');

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
  const container     = document.getElementById('companerosList');
  const cursosNombres = currentUser.cursosInscritos || [];

  if (cursosNombres.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">&#128101;</span><p>No tienes clases inscritas</p></div>`;
    return;
  }

  container.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';

  try {
    let html = '';
    for (const cursoNombre of cursosNombres) {
      let companeros = [];
      try {
        companeros = await ApiService._fetch(`/api/companeros?curso=${encodeURIComponent(cursoNombre)}`);
        if (!Array.isArray(companeros)) companeros = [];
      } catch {}

      html += `
        <div class="companeros-grupo">
          <div class="companeros-grupo-title">${sanitize(cursoNombre)}</div>
          ${companeros.length === 0
            ? '<p class="text-muted" style="font-size:0.85rem;padding:0.3rem 0;">Aun no hay companeros inscritos</p>'
            : companeros.map(comp => {
                const hoyMes = new Date().getMonth() + 1;
                const hoyDia = new Date().getDate();
                const esCumple = comp.cumpleMes === hoyMes && comp.cumpleDia === hoyDia;
                return `
                  <div class="companero-item${esCumple ? ' companero-cumple' : ''}">
                    <div class="avatar" style="${comp.fotoUrl ? 'padding:0;overflow:hidden;' : ''}">
                      ${comp.fotoUrl
                        ? `<img src="${comp.fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`
                        : getInitials(comp.nombre)}
                    </div>
                    <div class="companero-info">
                      <h4>${sanitize(comp.nombre)}${esCumple ? ' &#127874;' : ''}</h4>
                      <span class="badge badge-gold">${sanitize(comp.genero || '-')}</span>
                    </div>
                  </div>
                `;
              }).join('')
          }
        </div>
      `;
    }

    container.innerHTML = html || `<div class="empty-state"><span class="empty-icon">&#128101;</span><p>No se encontraron companeros</p></div>`;
  } catch (e) {
    console.error('Error cargando companeros:', e);
    container.innerHTML = '<div class="empty-state"><p>Error al cargar companeros</p></div>';
  }
}

// ============================================
// TAB: VIDEOS DE CLASES
// ============================================
let videosLoaded  = false;
let videosData    = [];
let videoCursoSel = null;

async function loadVideos() {
  if (videosLoaded) return;
  videosLoaded = true;

  const pillsContainer = document.getElementById('videosCursoPills');
  const gridContainer  = document.getElementById('videosGrid');
  if (!pillsContainer || !gridContainer) return;

  gridContainer.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:1rem auto"></div></div>';

  try {
    videosData = await ApiService._fetch('/api/videos');
  } catch (e) {
    gridContainer.innerHTML = '<div class="empty-state"><p>Error al cargar videos</p></div>';
    return;
  }

  // Obtener cursos únicos con videos disponibles (+ cursos inscritos del alumno)
  const cursosConVideos = [...new Set(videosData.map(v => v.curso))];
  const cursosAlumno   = currentUser.cursosInscritos || [];

  // Mostrar primero los cursos del alumno, luego el resto
  const cursosOrdenados = [
    ...cursosAlumno.filter(c => cursosConVideos.includes(c)),
    ...cursosConVideos.filter(c => !cursosAlumno.includes(c)),
    ...CURSOS_ACADEMIA.filter(c => !cursosConVideos.includes(c) && !cursosAlumno.includes(c)),
  ].filter((c, i, arr) => arr.indexOf(c) === i); // unique

  // Render pills de cursos
  pillsContainer.innerHTML = CURSOS_ACADEMIA.map(curso => {
    const tieneVideos  = cursosConVideos.includes(curso);
    const esDelAlumno  = cursosAlumno.includes(curso);
    return `<button class="videos-pill${esDelAlumno ? ' mi-curso' : ''}" data-curso="${sanitize(curso)}"
      ${!tieneVideos ? 'style="opacity:0.45"' : ''}>
      ${sanitize(curso)}${tieneVideos ? '' : ' <span style="font-size:0.7rem">(sin videos)</span>'}
    </button>`;
  }).join('');

  // Activar primer curso con videos (o el del alumno)
  const primerCurso = cursosAlumno.find(c => cursosConVideos.includes(c)) ||
                      cursosConVideos[0] || CURSOS_ACADEMIA[0];

  pillsContainer.querySelectorAll('.videos-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      pillsContainer.querySelectorAll('.videos-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderVideosGrilla(btn.dataset.curso);
    });
  });

  // Activar curso inicial
  const pillInicial = pillsContainer.querySelector(`[data-curso="${primerCurso}"]`);
  if (pillInicial) {
    pillInicial.classList.add('active');
    renderVideosGrilla(primerCurso);
  } else {
    gridContainer.innerHTML = '<div class="empty-state"><p>Sin videos disponibles aun</p></div>';
  }
}

function getYoutubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([^?&\s]{11})/);
  return m ? m[1] : null;
}

function renderVideosGrilla(curso) {
  const grid = document.getElementById('videosGrid');
  if (!grid) return;

  const videos = videosData.filter(v => v.curso === curso);
  if (videos.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>Aun no hay videos para este curso</p></div>';
    return;
  }

  // Ordenar por numeroClase
  videos.sort((a, b) => a.numeroClase - b.numeroClase);

  grid.innerHTML = videos.map(v => {
    const ytId   = getYoutubeId(v.urlYoutube);
    const thumb  = ytId
      ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`
      : 'img/Logo.png';
    const url    = v.urlYoutube || '#';
    return `
      <a href="${url}" target="_blank" rel="noopener" class="video-card">
        <div class="video-card-thumb" style="background-image:url('${thumb}')">
          <div class="video-card-overlay">
            <div class="video-play-btn">&#9654;</div>
          </div>
          <div class="video-clase-badge">Clase ${v.numeroClase}</div>
        </div>
        <div class="video-card-info">
          <div class="video-card-titulo">${sanitize(v.titulo || 'Clase ' + v.numeroClase)}</div>
          ${v.descripcion ? `<div class="video-card-desc">${sanitize(v.descripcion)}</div>` : ''}
        </div>
      </a>
    `;
  }).join('');
}

// ============================================
// TAB: GALERIA DE FIESTAS
// ============================================
let galeriaLoaded = false;
let galeriaData   = [];

async function loadGaleria() {
  if (galeriaLoaded) return;
  galeriaLoaded = true;

  const grid = document.getElementById('galeriaGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:1rem auto"></div></div>';

  try {
    galeriaData = await ApiService._fetch('/api/galeria');
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><p>Error al cargar galeria</p></div>';
    return;
  }

  // Setup filtros
  document.querySelectorAll('.galeria-filtro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.galeria-filtro-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGaleriaGrid(btn.dataset.tipo);
    });
  });

  renderGaleriaGrid('todos');
}

function getDriveFileId(url) {
  if (!url) return null;
  const m = url.match(/\/file\/d\/([^/]+)/);
  return m ? m[1] : null;
}

function renderGaleriaGrid(tipo) {
  const grid = document.getElementById('galeriaGrid');
  if (!grid) return;

  const items = tipo === 'todos'
    ? galeriaData
    : galeriaData.filter(g => g.tipo === tipo);

  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>Sin contenido disponible</p></div>';
    return;
  }

  grid.innerHTML = items.map(item => {
    const esFoto  = item.tipo === 'foto';
    const esVideo = item.tipo === 'video';

    // Thumbnail: Drive thumbnail o YouTube thumbnail
    let thumb = item.thumbnailUrl || '';
    if (!thumb && esFoto) {
      const driveId = getDriveFileId(item.url);
      if (driveId) thumb = `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;
    }
    if (!thumb && esVideo) {
      const ytId = getYoutubeId(item.url);
      if (ytId) thumb = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
    }

    // URL de descarga para fotos de Drive
    const urlDescarga = item.urlDescarga || item.url;
    const driveId     = getDriveFileId(urlDescarga);
    const downloadUrl = esFoto && driveId
      ? `https://drive.google.com/uc?export=download&id=${driveId}`
      : urlDescarga;

    if (esFoto) {
      return `
        <div class="galeria-item galeria-foto">
          ${thumb ? `<img src="${thumb}" class="galeria-img" alt="${sanitize(item.titulo)}" loading="lazy">` : '<div class="galeria-img-placeholder">&#128247;</div>'}
          <div class="galeria-item-footer">
            <div class="galeria-item-titulo">${sanitize(item.titulo)}</div>
            <a href="${downloadUrl}" target="_blank" rel="noopener" class="btn-galeria-dl" title="Descargar">&#11015;</a>
          </div>
        </div>
      `;
    } else {
      return `
        <a href="${item.url}" target="_blank" rel="noopener" class="galeria-item galeria-video">
          ${thumb ? `<img src="${thumb}" class="galeria-img" alt="${sanitize(item.titulo)}" loading="lazy">` : '<div class="galeria-img-placeholder">&#127909;</div>'}
          <div class="galeria-play-overlay">&#9654;</div>
          <div class="galeria-item-footer">
            <div class="galeria-item-titulo">${sanitize(item.titulo)}</div>
          </div>
        </a>
      `;
    }
  }).join('');
}

// ============================================
// TAB: PERFIL
// ============================================
function loadPerfil() {
  if (!currentUser) return;

  const avatarEl = document.getElementById('perfilAvatar');
  if (currentUser.fotoUrl) {
    avatarEl.innerHTML = `<img src="${currentUser.fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`;
    avatarEl.style.padding  = '0';
    avatarEl.style.overflow = 'hidden';
  } else {
    avatarEl.textContent = getInitials(currentUser.nombre);
  }

  document.getElementById('perfilName').textContent    = currentUser.nombre || '-';
  document.getElementById('perfilRole').textContent    = currentUser.role   || 'alumno';
  document.getElementById('perfilPlan').textContent    = currentUser.plan   || '-';
  document.getElementById('perfilTelefono').textContent = currentUser.telefono || '-';
  document.getElementById('perfilSede').textContent    = currentUser.sede  || 'Costa de Montemar, Concon';

  const desde = currentUser.fechaIngreso
    ? new Date(currentUser.fechaIngreso + 'T00:00:00')
        .toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    : '-';
  document.getElementById('perfilDesde').textContent = desde;

  const cursos = currentUser.cursosInscritos || [];
  document.getElementById('perfilCursos').innerHTML = cursos.length > 0
    ? cursos.map(c => `<span class="badge badge-gold" style="margin:0.2rem 0.2rem 0.2rem 0;">${sanitize(c)}</span>`).join('')
    : '<span style="color:var(--blanco-suave);font-size:0.9rem;">Sin cursos asignados</span>';

  const meses    = calcMeses(currentUser.fechaIngreso);
  const asistidas = currentUser.clasesAsistidas || 0;
  document.getElementById('statMeses').textContent    = meses;
  document.getElementById('statRacha').textContent    = asistidas;
  document.getElementById('statAsistidas').textContent = asistidas;

  // Cargar feedback del profesor
  loadFeedback();
}

async function loadFeedback() {
  const container = document.getElementById('feedbackLista');
  if (!container) return;

  try {
    const feedbacks = await ApiService._fetch('/api/feedback');
    if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.85rem">Aun no tienes feedback del profesor.</p>';
      return;
    }

    // Ordenar por año desc, luego por mes desc
    const MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                          'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    feedbacks.sort((a, b) => {
      if (b.anio !== a.anio) return parseInt(b.anio) - parseInt(a.anio);
      return parseInt(b.mes) - parseInt(a.mes);
    });

    container.innerHTML = feedbacks.map(f => {
      const mesNombre = MESES_NOMBRE[(parseInt(f.mes) || 1) - 1] || f.mes;
      return `
        <div class="feedback-item glass-card">
          <div class="feedback-mes">${mesNombre} ${f.anio}</div>
          ${f.positivo ? `
            <div class="feedback-bloque feedback-positivo">
              <div class="feedback-bloque-titulo">&#128077; Lo que vas bien</div>
              <p>${sanitize(f.positivo)}</p>
            </div>` : ''}
          ${f.mejoras ? `
            <div class="feedback-bloque feedback-mejoras">
              <div class="feedback-bloque-titulo">&#128200; Progreso notado</div>
              <p>${sanitize(f.mejoras)}</p>
            </div>` : ''}
          ${f.aMejorar ? `
            <div class="feedback-bloque feedback-amejorar">
              <div class="feedback-bloque-titulo">&#127919; Enfocate en esto</div>
              <p>${sanitize(f.aMejorar)}</p>
            </div>` : ''}
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.85rem">No se pudo cargar el feedback.</p>';
  }
}

// ============================================
// FOTO PERFIL — Cloudinary Upload Widget
// ============================================
function setupFotoUpload() {
  const btn = document.getElementById('fotoUploadBtn');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();

    // Verificar si Cloudinary está disponible
    if (typeof cloudinary !== 'undefined') {
      const widget = cloudinary.createUploadWidget(
        {
          cloudName:            CLOUDINARY_CLOUD_NAME,
          uploadPreset:         CLOUDINARY_UPLOAD_PRESET,
          sources:              ['local', 'camera'],
          multiple:             false,
          cropping:             true,
          croppingAspectRatio:  1,
          croppingShowDimensions: true,
          maxFileSize:          5000000,
          folder:               'al-paso-perfiles',
          clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
          styles: {
            palette: {
              window:         '#140A18',
              windowBorder:   '#430440',
              tabIcon:        '#D4AF37',
              menuIcons:      '#D4AF37',
              textDark:       '#FFFFFF',
              textLight:      '#FFFFFF',
              link:           '#D4AF37',
              action:         '#430440',
              inactiveTabIcon:'#8A8A8A',
              error:          '#FF4444',
              inProgress:     '#430440',
              complete:       '#33AB2E',
              sourceBg:       '#1F1228',
            },
          },
        },
        async (error, result) => {
          if (error) { console.error('Cloudinary error:', error); return; }
          if (result.event === 'success') {
            const url = result.info.secure_url;
            try {
              await ApiService.updateUser(currentUser.uid, { fotoUrl: url });
              currentUser.fotoUrl = url;

              const avatarEl = document.getElementById('perfilAvatar');
              avatarEl.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`;
              avatarEl.style.padding  = '0';
              avatarEl.style.overflow = 'hidden';

              widget.close();
            } catch (err) {
              console.error('Error guardando foto:', err);
            }
          }
        }
      );
      widget.open();
    } else {
      // Fallback: file input si Cloudinary no carga
      console.warn('Cloudinary no disponible, usando file input');
      const input = document.createElement('input');
      input.type   = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const origContent = btn.textContent;
        btn.textContent = '...';
        try {
          const base64 = await comprimirFoto(file);
          await ApiService.updateUser(currentUser.uid, { fotoUrl: base64 });
          currentUser.fotoUrl = base64;
          const avatarEl = document.getElementById('perfilAvatar');
          avatarEl.innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`;
          avatarEl.style.padding  = '0';
          avatarEl.style.overflow = 'hidden';
        } catch (err) {
          console.error('Error subiendo foto:', err);
        } finally {
          btn.textContent = origContent;
        }
      };
      input.click();
    }
  });
}

function comprimirFoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas  = document.createElement('canvas');
        const size    = 200;
        canvas.width  = size;
        canvas.height = size;
        const ctx    = canvas.getContext('2d');
        const minDim = Math.min(img.width, img.height);
        const sx     = (img.width - minDim) / 2;
        const sy     = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

function calcMeses(fechaIngreso) {
  if (!fechaIngreso) return 0;
  try {
    const inicio = new Date(fechaIngreso + 'T00:00:00');
    const hoy    = new Date();
    const meses  = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth());
    return Math.max(0, meses);
  } catch { return 0; }
}
