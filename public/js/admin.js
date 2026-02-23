/* ============================================
   ESTACION SALSERA - Panel Admin JS
   ============================================ */

// ---- AUTH CHECK ----
(async function () {
  try {
    if (!ApiService.isLoggedIn()) {
      window.location.href = 'login.html';
      return;
    }
    const userData = await ApiService.getCurrentUser();
    if (!userData || (userData.role !== 'admin')) {
      window.location.href = 'app.html';
      return;
    }
    document.getElementById('greetingText').textContent = `Hola, ${userData.nombre || 'Admin'}`;
    document.getElementById('loadingOverlay').style.display = 'none';
    initAdmin();
  } catch (e) {
    console.error('Error verificando admin:', e);
    window.location.href = 'login.html';
  }
})();

// ---- INIT ----
function initAdmin() {
  setupDate();
  setupNavigation();
  setupModals();
  setupForms();
  setupLogout();
  setupSidebar();
  setupEvaluacionesAdmin();
  loadDashboard();
}

// ---- DATE ----
function setupDate() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('currentDate').textContent = now.toLocaleDateString('es-CL', options);
}

// ---- NAVIGATION ----
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const section = item.dataset.section;
      // Update active nav
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      // Show section
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      document.getElementById(`section-${section}`).classList.add('active');
      // Load data
      loadSection(section);
      // Close mobile sidebar
      closeSidebar();
    });
  });
}

function loadSection(section) {
  switch (section) {
    case 'dashboard': loadDashboard(); break;
    case 'alumnos': loadAlumnos(); break;
    case 'clases': loadClases(); break;
    case 'eventos': loadEventos(); break;
    case 'evaluaciones': loadEvaluaciones(); break;
  }
}

// ---- SIDEBAR MOBILE ----
function setupSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const overlay = document.getElementById('sidebarOverlay');
  toggle.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    overlay.classList.toggle('active');
  });
  overlay.addEventListener('click', closeSidebar);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ---- LOGOUT ----
function setupLogout() {
  document.getElementById('btnLogout').addEventListener('click', () => {
    ApiService.logout();
  });
}

// ---- TOAST ----
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---- MODALS ----
function setupModals() {
  // Close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.close;
      closeModal(modalId);
    });
  });
  // Click overlay to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
  // Open buttons
  document.getElementById('btnNuevoAlumno').addEventListener('click', () => openAlumnoModal());
  document.getElementById('btnNuevaClase').addEventListener('click', () => openClaseModal());
  document.getElementById('btnNuevoEvento').addEventListener('click', () => openEventoModal());
  // Boton editar desde modal detalle
  document.getElementById('detalleAlumnoEditarBtn').addEventListener('click', () => {
    const id = document.getElementById('detalleAlumnoEditarBtn').dataset.alumnoId;
    closeModal('modalDetalleAlumno');
    if (id) editAlumno(id);
  });
}

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// ---- FORMS ----
function setupForms() {
  document.getElementById('formAlumno').addEventListener('submit', handleAlumnoSubmit);
  document.getElementById('formClase').addEventListener('submit', handleClaseSubmit);
  document.getElementById('formEvento').addEventListener('submit', handleEventoSubmit);
  // Filters
  document.getElementById('filterAlumnoNombre').addEventListener('input', filterAlumnos);
  document.getElementById('filterAlumnoCurso').addEventListener('change', filterAlumnos);
  document.getElementById('filterAlumnoEstado').addEventListener('change', filterAlumnos);
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
  try {
    const [alumnos, clases, eventos] = await Promise.all([
      ApiService.getAlumnos(),
      ApiService.getClasesActivas(),
      ApiService.getEventosActivos()
    ]);

    const pagados = alumnos.filter(a => (a.estado || '').toLowerCase() === 'pagado').length;
    const pendientes = alumnos.filter(a => (a.estado || '').toLowerCase() === 'pendiente').length;

    document.getElementById('statTotalAlumnos').textContent = alumnos.length;
    document.getElementById('statPagados').textContent = pagados;
    document.getElementById('statPendientes').textContent = pendientes;
    document.getElementById('statAlumnosActivos').textContent = alumnos.filter(a => a.activo).length;

    // Clases de hoy
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const hoy = diasSemana[new Date().getDay()];
    const clasesHoy = clases.filter(c => c.dia === hoy);

    const container = document.getElementById('clasesHoyContainer');
    if (clasesHoy.length === 0) {
      container.innerHTML = '<p class="text-muted">No hay clases programadas para hoy</p>';
    } else {
      container.innerHTML = clasesHoy.map(c => `
        <div class="clase-hoy-item">
          <div class="clase-hoy-info">
            <h4>${sanitize(c.nombre)}</h4>
            <p>${c.hora} - ${sanitize(c.sede || '')}</p>
          </div>
          <span class="clase-hoy-badge">${sanitize(c.disciplina || '')}</span>
        </div>
      `).join('');
    }

    // Alumnos recientes (ultimos 5 por fecha ingreso o al final)
    const recientes = alumnos.slice(0, 5);
    const alumnosContainer = document.getElementById('alumnosRecientesContainer');
    if (recientes.length === 0) {
      alumnosContainer.innerHTML = '<p class="text-muted">No hay alumnos registrados</p>';
    } else {
      alumnosContainer.innerHTML = recientes.map(a => `
        <div class="alumno-reciente-item">
          <div class="avatar">${getInitials(a.nombre)}</div>
          <div class="alumno-reciente-info">
            <h4>${sanitize(a.nombre)}</h4>
            <p>${sanitize(a.curso || '-')} &middot; ${sanitize(a.plan || '-')}</p>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Error cargando dashboard:', e);
    showToast('Error al cargar el dashboard', 'error');
  }
}

// ============================================
// ALUMNOS
// ============================================
let allAlumnos = [];

async function loadAlumnos() {
  try {
    allAlumnos = await ApiService.getAlumnos();
    renderAlumnos(allAlumnos);
  } catch (e) {
    console.error('Error cargando alumnos:', e);
    showToast('Error al cargar alumnos', 'error');
  }
}

function renderAlumnos(alumnos) {
  const tbody = document.getElementById('tbodyAlumnos');
  if (alumnos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No se encontraron alumnos</td></tr>';
    return;
  }
  tbody.innerHTML = alumnos.map(a => {
    const estadoBadge = (a.estado || '').toLowerCase() === 'pagado'
      ? `<span class="badge badge-green">Pagado</span>`
      : (a.estado ? `<span class="badge badge-red">${sanitize(a.estado)}</span>` : '<span class="badge">-</span>');
    const cursos = a.cursosInscritos && a.cursosInscritos.length
      ? a.cursosInscritos.map(c => `<span class="badge badge-gold">${sanitize(c)}</span>`).join(' ')
      : sanitize(a.curso || '-');
    return `
    <tr>
      <td><strong>${sanitize(a.nombre)}</strong></td>
      <td>${sanitize(a.telefono || '-')}</td>
      <td>${cursos}</td>
      <td>${sanitize(a.plan || '-')}</td>
      <td>${estadoBadge}</td>
      <td>${a.clasesAsistidas || 0}/${a.clasesContratadas || 0}</td>
      <td>
        <div class="table-actions">
          <button class="btn-icon" onclick="verDetalleAlumno('${a.id}')" title="Ver detalle">&#128065;</button>
          <button class="btn-icon" onclick="editAlumno('${a.id}')" title="Editar">&#9998;</button>
          <button class="btn-icon" onclick="confirmDelete('${a.id}', 'alumno', '${sanitize(a.nombre)}')" title="Eliminar">&#10006;</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterAlumnos() {
  const nombre = document.getElementById('filterAlumnoNombre').value.toLowerCase();
  const curso = document.getElementById('filterAlumnoCurso').value.toLowerCase();
  const estado = document.getElementById('filterAlumnoEstado').value.toLowerCase();
  let filtered = allAlumnos;
  if (nombre) filtered = filtered.filter(a => a.nombre.toLowerCase().includes(nombre));
  if (curso) filtered = filtered.filter(a => (a.curso || '').toLowerCase().includes(curso)
    || (a.cursosInscritos || []).some(c => c.toLowerCase().includes(curso)));
  if (estado) filtered = filtered.filter(a => (a.estado || '').toLowerCase() === estado);
  renderAlumnos(filtered);
}

function openAlumnoModal(data = null) {
  document.getElementById('modalAlumnoTitle').textContent = data ? 'Editar Alumno' : 'Nuevo Alumno';
  document.getElementById('alumnoId').value = data ? data.id : '';
  document.getElementById('alumnoNombre').value = data ? data.nombre : '';
  document.getElementById('alumnoTelefono').value = data ? data.telefono || '' : '';
  document.getElementById('alumnoGenero').value = data ? data.genero || '' : '';
  document.getElementById('alumnoCurso').value = data ? data.curso || '' : '';
  document.getElementById('alumnoPlan').value = data ? data.plan || '' : '';
  document.getElementById('alumnoEstado').value = data ? data.estado || '' : '';
  document.getElementById('alumnoClasesContratadas').value = data ? data.clasesContratadas || 0 : 0;
  document.getElementById('alumnoFechaIngreso').value = data ? data.fechaIngreso || '' : '';
  document.getElementById('alumnoObservacion').value = data ? data.observacion || '' : '';
  document.getElementById('alumnoActivo').checked = data ? data.activo !== false : true;
  openModal('modalAlumno');
}

async function editAlumno(id) {
  try {
    const alumno = await ApiService.getUser(id);
    if (alumno) openAlumnoModal(alumno);
  } catch (e) {
    showToast('Error al cargar datos del alumno', 'error');
  }
}

async function handleAlumnoSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('alumnoId').value;
  const data = {
    nombre: document.getElementById('alumnoNombre').value.trim(),
    telefono: document.getElementById('alumnoTelefono').value.trim(),
    genero: document.getElementById('alumnoGenero').value,
    curso: document.getElementById('alumnoCurso').value.trim(),
    plan: document.getElementById('alumnoPlan').value,
    estado: document.getElementById('alumnoEstado').value,
    clasesContratadas: parseInt(document.getElementById('alumnoClasesContratadas').value) || 0,
    fechaIngreso: document.getElementById('alumnoFechaIngreso').value,
    observacion: document.getElementById('alumnoObservacion').value.trim(),
    activo: document.getElementById('alumnoActivo').checked,
    role: 'alumno',
  };

  try {
    if (id) {
      await ApiService.updateUser(id, data);
      showToast('Alumno actualizado correctamente', 'success');
    } else {
      await ApiService.createUser(null, data);
      showToast('Alumno creado correctamente', 'success');
    }
    closeModal('modalAlumno');
    loadAlumnos();
  } catch (e) {
    showToast('Error al guardar alumno: ' + e.message, 'error');
  }
}

// ============================================
// CLASES
// ============================================
async function loadClases() {
  try {
    const clases = await FirestoreService.getClases();
    const grid = document.getElementById('clasesGrid');
    if (clases.length === 0) {
      grid.innerHTML = '<p class="text-muted">No hay clases registradas</p>';
      return;
    }
    grid.innerHTML = clases.map(c => `
      <div class="entity-card">
        <div class="entity-card-header">
          <span class="entity-card-title">${c.nombre}</span>
          ${c.activo ? '<span class="badge badge-green">Activa</span>' : '<span class="badge badge-red">Inactiva</span>'}
        </div>
        <div class="entity-card-body">
          <div class="detail-row"><span class="detail-label">Disciplina</span><span class="detail-value">${c.disciplina}</span></div>
          <div class="detail-row"><span class="detail-label">Nivel</span><span class="detail-value">${c.nivel}</span></div>
          <div class="detail-row"><span class="detail-label">Sede</span><span class="detail-value">${c.sede}</span></div>
          <div class="detail-row"><span class="detail-label">Horario</span><span class="detail-value">${c.dia} ${c.hora}</span></div>
          <div class="detail-row"><span class="detail-label">Instructor</span><span class="detail-value">${c.instructor || '-'}</span></div>
          <div class="detail-row"><span class="detail-label">Cupo</span><span class="detail-value">${c.cupoMaximo || '-'}</span></div>
        </div>
        <div class="entity-card-footer">
          <button class="btn-icon" onclick="editClase('${c.id}')" title="Editar">&#9998;</button>
          <button class="btn-icon" onclick="confirmDelete('${c.id}', 'clase', '${c.nombre}')" title="Eliminar">&#10006;</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Error cargando clases:', e);
    showToast('Error al cargar clases', 'error');
  }
}

function openClaseModal(data = null) {
  document.getElementById('modalClaseTitle').textContent = data ? 'Editar Clase' : 'Nueva Clase';
  document.getElementById('claseId').value = data ? data.id : '';
  document.getElementById('claseNombre').value = data ? data.nombre : '';
  document.getElementById('claseDisciplina').value = data ? data.disciplina : '';
  document.getElementById('claseNivel').value = data ? data.nivel : '';
  document.getElementById('claseSede').value = data ? data.sede : '';
  document.getElementById('claseDia').value = data ? data.dia : '';
  document.getElementById('claseHora').value = data ? data.hora : '';
  document.getElementById('claseDuracion').value = data ? data.duracion || 60 : 60;
  document.getElementById('claseInstructor').value = data ? data.instructor || '' : '';
  document.getElementById('claseCupoMaximo').value = data ? data.cupoMaximo || 20 : 20;
  document.getElementById('claseActivo').checked = data ? data.activo !== false : true;
  openModal('modalClase');
}

async function editClase(id) {
  try {
    const clase = await FirestoreService.getClase(id);
    if (clase) openClaseModal(clase);
  } catch (e) {
    showToast('Error al cargar datos de la clase', 'error');
  }
}

async function handleClaseSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('claseId').value;
  const data = {
    nombre: document.getElementById('claseNombre').value,
    disciplina: document.getElementById('claseDisciplina').value,
    nivel: document.getElementById('claseNivel').value,
    sede: document.getElementById('claseSede').value,
    dia: document.getElementById('claseDia').value,
    hora: document.getElementById('claseHora').value,
    duracion: parseInt(document.getElementById('claseDuracion').value) || 60,
    instructor: document.getElementById('claseInstructor').value,
    cupoMaximo: parseInt(document.getElementById('claseCupoMaximo').value) || 20,
    activo: document.getElementById('claseActivo').checked
  };

  try {
    if (id) {
      await FirestoreService.updateClase(id, data);
      showToast('Clase actualizada correctamente', 'success');
    } else {
      await FirestoreService.createClase(data);
      showToast('Clase creada correctamente', 'success');
    }
    closeModal('modalClase');
    loadClases();
  } catch (e) {
    showToast('Error al guardar clase: ' + e.message, 'error');
  }
}

// ============================================
// EVENTOS
// ============================================
async function loadEventos() {
  try {
    const eventos = await FirestoreService.getEventos();
    const grid = document.getElementById('eventosGrid');
    if (eventos.length === 0) {
      grid.innerHTML = '<p class="text-muted">No hay eventos registrados</p>';
      return;
    }
    grid.innerHTML = eventos.map(ev => {
      const fecha = ev.fecha ? formatDate(ev.fecha) : '-';
      return `
        <div class="entity-card">
          ${ev.imagenURL ? `<img src="${sanitize(ev.imagenURL)}" alt="${sanitize(ev.titulo)}" class="entity-card-img" onerror="this.style.display='none'">` : ''}
          <div class="entity-card-header">
            <span class="entity-card-title">${sanitize(ev.titulo)}</span>
            ${ev.activo ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-red">Inactivo</span>'}
          </div>
          <div class="entity-card-body">
            <p>${sanitize(ev.descripcion || '')}</p>
            <div class="detail-row"><span class="detail-label">Fecha</span><span class="detail-value">${fecha}</span></div>
            <div class="detail-row"><span class="detail-label">Lugar</span><span class="detail-value">${sanitize(ev.lugar || '-')}</span></div>
          </div>
          <div class="entity-card-footer">
            <button class="btn-icon" onclick="editEvento('${ev.id}')" title="Editar">&#9998;</button>
            <button class="btn-icon" onclick="confirmDelete('${ev.id}', 'evento', '${sanitize(ev.titulo)}')" title="Eliminar">&#10006;</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Error cargando eventos:', e);
    showToast('Error al cargar eventos', 'error');
  }
}

function openEventoModal(data = null) {
  document.getElementById('modalEventoTitle').textContent = data ? 'Editar Evento' : 'Nuevo Evento';
  document.getElementById('eventoId').value = data ? data.id : '';
  document.getElementById('eventoTitulo').value = data ? data.titulo : '';
  document.getElementById('eventoDescripcion').value = data ? data.descripcion || '' : '';
  document.getElementById('eventoFecha').value = data && data.fecha ? data.fecha : '';
  document.getElementById('eventoLugar').value = data ? data.lugar || '' : '';
  document.getElementById('eventoImagenURL').value = data ? data.imagenURL || '' : '';
  document.getElementById('eventoActivo').checked = data ? data.activo !== false : true;
  openModal('modalEvento');
}

async function editEvento(id) {
  try {
    const evento = await FirestoreService.getEvento(id);
    if (evento) openEventoModal(evento);
  } catch (e) {
    showToast('Error al cargar datos del evento', 'error');
  }
}

async function handleEventoSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('eventoId').value;
  const data = {
    titulo: document.getElementById('eventoTitulo').value,
    descripcion: document.getElementById('eventoDescripcion').value,
    fecha: document.getElementById('eventoFecha').value,
    lugar: document.getElementById('eventoLugar').value,
    imagenURL: document.getElementById('eventoImagenURL').value,
    activo: document.getElementById('eventoActivo').checked
  };

  try {
    if (id) {
      await FirestoreService.updateEvento(id, data);
      showToast('Evento actualizado correctamente', 'success');
    } else {
      await FirestoreService.createEvento(data);
      showToast('Evento creado correctamente', 'success');
    }
    closeModal('modalEvento');
    loadEventos();
  } catch (e) {
    showToast('Error al guardar evento: ' + e.message, 'error');
  }
}

// ============================================
// DELETE CONFIRM
// ============================================
let pendingDeleteId = null;
let pendingDeleteType = null;

function confirmDelete(id, type, name) {
  pendingDeleteId = id;
  pendingDeleteType = type;
  document.getElementById('confirmMessage').textContent = `Seguro que desea eliminar "${name}"? Esta accion no se puede deshacer.`;
  openModal('modalConfirm');
}

document.getElementById('btnConfirmDelete').addEventListener('click', async () => {
  if (!pendingDeleteId || !pendingDeleteType) return;
  try {
    switch (pendingDeleteType) {
      case 'alumno': await ApiService.deleteUser(pendingDeleteId); loadAlumnos(); break;
      case 'clase': await ApiService.deleteClase(pendingDeleteId); loadClases(); break;
      case 'evento': await ApiService.deleteEvento(pendingDeleteId); loadEventos(); break;
    }
    showToast('Registro eliminado correctamente', 'success');
  } catch (e) {
    showToast('Error al eliminar: ' + e.message, 'error');
  }
  closeModal('modalConfirm');
  pendingDeleteId = null;
  pendingDeleteType = null;
});

// ============================================
// EVALUACIONES
// ============================================
let evalAdminCache = [];

function setupEvaluacionesAdmin() {
  // Sub-tabs
  document.querySelectorAll('.eval-admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.eval-admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.eval-admin-tab-section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.etab).classList.add('active');
      if (tab.dataset.etab === 'etab-admin-historial') renderAdminHistorial();
    });
  });

  // Filtro curso
  document.getElementById('evalAdminFiltroCurso').addEventListener('change', () => {
    renderAdminDashboard(evalAdminCache);
  });

  // Estrellas
  document.querySelectorAll('#section-evaluaciones .eval-estrellas-grupo').forEach(grupo => {
    grupo.querySelectorAll('.eval-estrella').forEach((estrella, idx) => {
      estrella.addEventListener('click', () => {
        const valor = idx + 1;
        grupo.dataset.valor = valor;
        grupo.querySelectorAll('.eval-estrella').forEach((s, i) => {
          s.classList.toggle('activa', i < valor);
        });
      });
      estrella.addEventListener('mouseenter', () => {
        grupo.querySelectorAll('.eval-estrella').forEach((s, i) => {
          s.classList.toggle('activa', i <= idx);
        });
      });
      estrella.addEventListener('mouseleave', () => {
        const valorActual = parseInt(grupo.dataset.valor) || 0;
        grupo.querySelectorAll('.eval-estrella').forEach((s, i) => {
          s.classList.toggle('activa', i < valorActual);
        });
      });
    });
  });

  // Fecha por defecto
  const fechaInput = document.getElementById('obsAdminFecha');
  if (fechaInput) fechaInput.value = new Date().toISOString().slice(0, 10);

  // Form observacion
  document.getElementById('formAdminObservacion').addEventListener('submit', async (e) => {
    e.preventDefault();
    await guardarAdminObservacion();
  });

  // Exportar CSV
  document.getElementById('btnAdminExportarCSV').addEventListener('click', exportarAdminCSV);
}

async function loadEvaluaciones() {
  try {
    evalAdminCache = await ApiService._fetch('/api/evaluaciones');
    renderAdminDashboard(evalAdminCache);
  } catch (err) {
    console.error('Error cargando evaluaciones:', err);
    showToast('Error al cargar evaluaciones', 'error');
  }
}

function renderAdminDashboard(evaluaciones) {
  const cursoFiltro = document.getElementById('evalAdminFiltroCurso').value;
  const filtradas = cursoFiltro
    ? evaluaciones.filter(e => e.Curso === cursoFiltro)
    : evaluaciones;

  // Stats
  const total = filtradas.length;
  const alumnosUnicos = new Set(filtradas.map(e => e.NombreAlumno + '|' + e.Curso)).size;
  const porcentajeBaileNuevo = filtradas.length
    ? Math.round(filtradas.filter(e => e.BaileNuevo).length / filtradas.length * 100)
    : 0;

  document.getElementById('evalAdminStatTotal').textContent = total;
  document.getElementById('evalAdminStatAlumnos').textContent = alumnosUnicos;
  document.getElementById('evalAdminStatBaileNuevo').textContent = porcentajeBaileNuevo + '%';

  // Promedios
  const promedio = (campo) => filtradas.length
    ? (filtradas.reduce((a, e) => a + (parseFloat(e[campo]) || 0), 0) / filtradas.length).toFixed(1)
    : '0';

  const metricas = ['Disfrute', 'Comprension', 'ComodidadPareja', 'Confianza'];
  metricas.forEach(m => {
    const prom = promedio(m);
    document.getElementById('evalAdminProm' + m).textContent = prom;
    document.getElementById('evalAdminBarra' + m).style.width = (parseFloat(prom) / 10 * 100) + '%';
  });

  // Grafica SVG
  renderAdminGraficaSVG(filtradas);

  // Comentarios
  const comentarios = filtradas
    .filter(e => e.Comentario)
    .sort((a, b) => (b.FechaHoraISO || '').localeCompare(a.FechaHoraISO || ''))
    .slice(0, 5);

  const contenedor = document.getElementById('evalAdminComentarios');
  if (comentarios.length === 0) {
    contenedor.innerHTML = '<p class="text-muted">Sin comentarios aun.</p>';
  } else {
    contenedor.innerHTML = comentarios.map(e => `
      <div class="eval-admin-comentario glass-card">
        <div class="eval-admin-comentario-header">
          <span class="text-gold">${sanitize(e.NombreAlumno || '')}</span>
          <span class="badge badge-gold">${sanitize(e.Curso || '')}</span>
        </div>
        <p class="text-muted">"${sanitize(e.Comentario || '')}"</p>
      </div>
    `).join('');
  }
}

function renderAdminGraficaSVG(evaluaciones) {
  const container = document.getElementById('evalAdminGrafica');

  const porClase = {};
  evaluaciones.forEach(e => {
    const nc = e.NumeroClase;
    if (!nc) return;
    if (!porClase[nc]) porClase[nc] = [];
    porClase[nc].push(parseFloat(e.Disfrute) || 0);
  });

  const clases = [1, 2, 3, 4].filter(n => porClase[n] && porClase[n].length > 0);
  if (clases.length < 2) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;font-size:0.85rem">Se necesitan al menos 2 clases con datos</p>';
    return;
  }

  const datos = clases.map(n => ({
    clase: n,
    prom: porClase[n].reduce((a, b) => a + b, 0) / porClase[n].length
  }));

  const W = 400;
  const H = 160;
  const PAD = 35;
  const xStep = (W - PAD * 2) / (datos.length - 1);

  const points = datos.map((d, i) => {
    const x = PAD + i * xStep;
    const y = H - PAD - ((d.prom - 1) / 9) * (H - PAD * 2);
    return { x, y, prom: d.prom, clase: d.clase };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const polygon = polyline + ` ${points[points.length - 1].x},${H - PAD} ${points[0].x},${H - PAD}`;

  const guias = [2, 4, 6, 8, 10].map(v => {
    const y = H - PAD - ((v - 1) / 9) * (H - PAD * 2);
    return `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
            <text x="${PAD - 5}" y="${y + 3}" text-anchor="end" fill="#555" font-size="9">${v}</text>`;
  }).join('');

  const puntos = points.map(p =>
    `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#FFFFFF"/>
     <text x="${p.x}" y="${p.y - 10}" text-anchor="middle" fill="#FFFFFF" font-size="10" font-weight="600">${p.prom.toFixed(1)}</text>
     <text x="${p.x}" y="${H - 8}" text-anchor="middle" fill="#B8B0BC" font-size="9">C${p.clase}</text>`
  ).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="adminGoldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${guias}
      <polygon points="${polygon}" fill="url(#adminGoldGrad)"/>
      <polyline points="${polyline}" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${puntos}
    </svg>`;
}

async function guardarAdminObservacion() {
  const curso = document.getElementById('obsAdminCurso').value;
  if (!curso) {
    showToast('Selecciona un curso', 'error');
    return;
  }

  const payload = {
    Curso: curso,
    NumeroClase: parseInt(document.getElementById('obsAdminClase').value),
    Fecha: document.getElementById('obsAdminFecha').value,
    ObjetivoDelDia: document.getElementById('obsAdminObjetivo').value.trim(),
    PasosTrabajados: document.getElementById('obsAdminPasos').value.trim(),
    EstrellaParticipacion: parseInt(document.getElementById('obsAdminEstrellasParticipacion').dataset.valor) || 0,
    EstrellaComprension: parseInt(document.getElementById('obsAdminEstrellasComprension').dataset.valor) || 0,
    EstrellaConexion: parseInt(document.getElementById('obsAdminEstrellasConexion').dataset.valor) || 0,
    EstrellaEnergia: parseInt(document.getElementById('obsAdminEstrellasEnergia').dataset.valor) || 0,
    LogrosDelDia: document.getElementById('obsAdminLogros').value.trim(),
    DificultadesDetectadas: document.getElementById('obsAdminDificultades').value.trim(),
    AjustesProximaClase: document.getElementById('obsAdminAjustes').value.trim(),
    Notas: document.getElementById('obsAdminNotas').value.trim(),
  };

  try {
    const btn = document.getElementById('btnAdminSubmitObs');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    await ApiService._fetch('/api/observaciones', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    showToast('Observacion guardada correctamente', 'success');
    document.getElementById('formAdminObservacion').reset();
    document.getElementById('obsAdminFecha').value = new Date().toISOString().slice(0, 10);
    // Reset estrellas
    document.querySelectorAll('#section-evaluaciones .eval-estrellas-grupo').forEach(g => {
      g.dataset.valor = '0';
      g.querySelectorAll('.eval-estrella').forEach(s => s.classList.remove('activa'));
    });
  } catch (err) {
    showToast('Error al guardar observacion', 'error');
  } finally {
    const btn = document.getElementById('btnAdminSubmitObs');
    btn.disabled = false;
    btn.textContent = 'Guardar observacion';
  }
}

function renderAdminHistorial() {
  const cursos = ['Bachata Basico', 'Casino Basico', 'Bachata Intermedio', 'Casino Intermedio', 'Mambo Open'];
  const tbody = document.getElementById('tbodyAdminResumen');
  tbody.innerHTML = cursos.map(c => {
    const evCurso = evalAdminCache.filter(e => e.Curso === c);
    const promDisfrute = evCurso.length
      ? (evCurso.reduce((a, e) => a + (parseFloat(e.Disfrute) || 0), 0) / evCurso.length).toFixed(1)
      : '-';
    return `<tr>
      <td>${sanitize(c)}</td>
      <td>${evCurso.length}</td>
      <td>${promDisfrute}</td>
    </tr>`;
  }).join('');

  // Ultimas 10
  const ultimas = [...evalAdminCache]
    .sort((a, b) => (b.FechaHoraISO || '').localeCompare(a.FechaHoraISO || ''))
    .slice(0, 10);

  const lista = document.getElementById('listaAdminUltimasEval');
  if (ultimas.length === 0) {
    lista.innerHTML = '<p class="text-muted">No hay evaluaciones aun.</p>';
  } else {
    lista.innerHTML = ultimas.map(e => {
      const promedio = ((parseFloat(e.Disfrute || 0) + parseFloat(e.Comprension || 0) +
        parseFloat(e.ComodidadPareja || 0) + parseFloat(e.Confianza || 0)) / 4).toFixed(1);
      return `<div class="eval-admin-ultima">
        <div class="eval-admin-ultima-info">
          <span class="eval-admin-ultima-nombre">${sanitize(e.NombreAlumno || '')}</span>
          <span class="eval-admin-ultima-curso">${sanitize(e.Curso || '')} - Clase ${e.NumeroClase || '?'}</span>
        </div>
        <span class="eval-admin-ultima-score">${promedio}</span>
      </div>`;
    }).join('');
  }
}

function exportarAdminCSV() {
  if (evalAdminCache.length === 0) {
    showToast('No hay datos para exportar', 'error');
    return;
  }

  const headers = ['Nombre', 'Curso', 'Clase', 'Disfrute', 'Comprension', 'Comodidad en Pareja', 'Confianza', 'Bailo con alguien nuevo', 'Comentario', 'Fecha'];
  const filas = evalAdminCache.map(e => [
    '"' + (e.NombreAlumno || '').replace(/"/g, '""') + '"',
    '"' + (e.Curso || '') + '"',
    e.NumeroClase || '',
    e.Disfrute || '',
    e.Comprension || '',
    e.ComodidadPareja || '',
    e.Confianza || '',
    e.BaileNuevo ? 'Si' : 'No',
    '"' + (e.Comentario || '').replace(/"/g, '""') + '"',
    e.FechaEvaluacion || ''
  ].join(','));

  const csv = [headers.join(','), ...filas].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'evaluaciones_al_paso_dance_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV descargado', 'success');
}

// ============================================
// DETALLE ALUMNO
// ============================================
async function verDetalleAlumno(id) {
  try {
    const a = await ApiService.getUser(id);
    document.getElementById('detalleAlumnoNombre').textContent = a.nombre;
    document.getElementById('detalleAlumnoEditarBtn').dataset.alumnoId = id;

    const linkBase = window.location.origin + '/app.html?token=';
    const link = a.linkToken ? linkBase + encodeURIComponent(a.linkToken) : null;
    const cursos = a.cursosInscritos && a.cursosInscritos.length
      ? a.cursosInscritos.join(', ')
      : (a.curso || '-');

    document.getElementById('detalleAlumnoContent').innerHTML = `
      <div class="detalle-alumno-grid">
        <div class="detalle-row">
          <span class="detail-label">Telefono</span>
          <span class="detail-value">${sanitize(a.telefono || '-')}</span>
        </div>
        <div class="detalle-row">
          <span class="detail-label">Genero</span>
          <span class="detail-value">${sanitize(a.genero || '-')}</span>
        </div>
        <div class="detalle-row">
          <span class="detail-label">Curso(s)</span>
          <span class="detail-value">${sanitize(cursos)}</span>
        </div>
        <div class="detalle-row">
          <span class="detail-label">Plan</span>
          <span class="detail-value">${sanitize(a.plan || '-')}</span>
        </div>
        <div class="detalle-row">
          <span class="detail-label">Estado pago</span>
          <span class="detail-value">${sanitize(a.estado || '-')}</span>
        </div>
        <div class="detalle-row">
          <span class="detail-label">Clases</span>
          <span class="detail-value">${a.clasesAsistidas || 0} / ${a.clasesContratadas || 0}</span>
        </div>
        <div class="detalle-row">
          <span class="detail-label">Desde</span>
          <span class="detail-value">${sanitize(a.fechaIngreso || '-')}</span>
        </div>
        ${a.observacion ? `<div class="detalle-row detalle-row-full">
          <span class="detail-label">Observacion</span>
          <span class="detail-value">${sanitize(a.observacion)}</span>
        </div>` : ''}
        <div class="detalle-row detalle-row-full detalle-acceso">
          <span class="detail-label">PIN acceso</span>
          <span class="detail-value detalle-pin">${sanitize(a.pin || '-')}
            ${a.pin ? `<button class="btn-copy" onclick="copyToClipboard('${sanitize(a.pin)}', this)">Copiar</button>` : ''}
          </span>
        </div>
        ${link ? `<div class="detalle-row detalle-row-full detalle-acceso">
          <span class="detail-label">Link acceso</span>
          <span class="detail-value detalle-link">
            <span class="detalle-link-text">${link.substring(0, 48)}...</span>
            <button class="btn-copy" onclick="copyToClipboard('${link}', this)">Copiar link</button>
          </span>
        </div>` : ''}
      </div>
    `;
    openModal('modalDetalleAlumno');
  } catch (e) {
    showToast('Error al cargar detalle del alumno', 'error');
  }
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copiado!';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1800);
  }).catch(() => showToast('No se pudo copiar', 'error'));
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
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
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
