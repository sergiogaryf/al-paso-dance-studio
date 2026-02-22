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
    case 'banners': loadBanners(); break;
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
  document.getElementById('btnNuevoBanner').addEventListener('click', () => openBannerModal());
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
  document.getElementById('formBanner').addEventListener('submit', handleBannerSubmit);

  // Filters
  document.getElementById('filterAlumnoNombre').addEventListener('input', filterAlumnos);
  document.getElementById('filterAlumnoSede').addEventListener('change', filterAlumnos);
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
  try {
    const [alumnos, clases, eventos] = await Promise.all([
      FirestoreService.getAlumnos(),
      FirestoreService.getClasesActivas(),
      FirestoreService.getEventosActivos()
    ]);

    document.getElementById('statTotalAlumnos').textContent = alumnos.length;
    document.getElementById('statClasesActivas').textContent = clases.length;
    document.getElementById('statEventosProximos').textContent = eventos.length;
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
            <h4>${c.nombre}</h4>
            <p>${c.hora} - ${c.sede}</p>
          </div>
          <span class="clase-hoy-badge">${c.disciplina}</span>
        </div>
      `).join('');
    }

    // Alumnos recientes
    const recientes = alumnos.slice(0, 5);
    const alumnosContainer = document.getElementById('alumnosRecientesContainer');
    if (recientes.length === 0) {
      alumnosContainer.innerHTML = '<p class="text-muted">No hay alumnos registrados</p>';
    } else {
      alumnosContainer.innerHTML = recientes.map(a => `
        <div class="alumno-reciente-item">
          <div class="avatar">${getInitials(a.nombre)}</div>
          <div class="alumno-reciente-info">
            <h4>${a.nombre}</h4>
            <p>${a.sede || '-'} &middot; ${a.nivel || '-'}</p>
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
    allAlumnos = await FirestoreService.getAlumnos();
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
  tbody.innerHTML = alumnos.map(a => `
    <tr>
      <td><strong>${a.nombre}</strong></td>
      <td>${a.email}</td>
      <td>${a.sede || '-'}</td>
      <td>${a.nivel || '-'}</td>
      <td>${a.clasesAsistidas || 0}/${a.clasesContratadas || 0}</td>
      <td>${a.activo ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-red">Inactivo</span>'}</td>
      <td>
        <div class="table-actions">
          <button class="btn-icon" onclick="editAlumno('${a.id}')" title="Editar">&#9998;</button>
          <button class="btn-icon" onclick="confirmDelete('${a.id}', 'alumno', '${a.nombre}')" title="Eliminar">&#10006;</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterAlumnos() {
  const nombre = document.getElementById('filterAlumnoNombre').value.toLowerCase();
  const sede = document.getElementById('filterAlumnoSede').value;
  let filtered = allAlumnos;
  if (nombre) filtered = filtered.filter(a => a.nombre.toLowerCase().includes(nombre));
  if (sede) filtered = filtered.filter(a => a.sede === sede);
  renderAlumnos(filtered);
}

function openAlumnoModal(data = null) {
  document.getElementById('modalAlumnoTitle').textContent = data ? 'Editar Alumno' : 'Nuevo Alumno';
  document.getElementById('alumnoId').value = data ? data.id : '';
  document.getElementById('alumnoNombre').value = data ? data.nombre : '';
  document.getElementById('alumnoEmail').value = data ? data.email : '';
  document.getElementById('alumnoSede').value = data ? data.sede : '';
  document.getElementById('alumnoNivel').value = data ? data.nivel : '';
  document.getElementById('alumnoTelefono').value = data ? data.telefono || '' : '';
  document.getElementById('alumnoClasesContratadas').value = data ? data.clasesContratadas || 0 : 0;
  document.getElementById('alumnoActivo').checked = data ? data.activo !== false : true;

  // Show/hide password field
  const pwGroup = document.getElementById('passwordGroup');
  if (pwGroup) pwGroup.style.display = data ? 'none' : 'block';

  openModal('modalAlumno');
}

async function editAlumno(id) {
  try {
    const alumno = await FirestoreService.getUser(id);
    if (alumno) openAlumnoModal(alumno);
  } catch (e) {
    showToast('Error al cargar datos del alumno', 'error');
  }
}

async function handleAlumnoSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('alumnoId').value;
  const data = {
    nombre: document.getElementById('alumnoNombre').value,
    email: document.getElementById('alumnoEmail').value,
    sede: document.getElementById('alumnoSede').value,
    nivel: document.getElementById('alumnoNivel').value,
    telefono: document.getElementById('alumnoTelefono').value,
    clasesContratadas: parseInt(document.getElementById('alumnoClasesContratadas').value) || 0,
    activo: document.getElementById('alumnoActivo').checked,
    role: 'alumno'
  };

  // Add password for new alumnos
  const pwInput = document.getElementById('alumnoPassword');
  if (!id && pwInput && pwInput.value) {
    data.password = pwInput.value;
  }

  try {
    if (id) {
      await FirestoreService.updateUser(id, data);
      showToast('Alumno actualizado correctamente', 'success');
    } else {
      if (!data.password) {
        showToast('Debes asignar una contrasena al nuevo alumno', 'error');
        return;
      }
      await FirestoreService.createUser(null, data);
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
// BANNERS
// ============================================
async function loadBanners() {
  try {
    const banners = await FirestoreService.getBanners();
    const grid = document.getElementById('bannersGrid');
    if (banners.length === 0) {
      grid.innerHTML = '<p class="text-muted">No hay banners registrados</p>';
      return;
    }
    grid.innerHTML = banners.map(b => `
      <div class="entity-card">
        ${b.imagenURL ? `<img src="${sanitize(b.imagenURL)}" alt="${sanitize(b.titulo)}" class="entity-card-img" onerror="this.style.display='none'">` : ''}
        <div class="entity-card-header">
          <span class="entity-card-title">${sanitize(b.titulo)}</span>
          ${b.activo ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-red">Inactivo</span>'}
        </div>
        <div class="entity-card-body">
          <div class="detail-row"><span class="detail-label">Orden</span><span class="detail-value">${b.orden || 0}</span></div>
          <div class="detail-row"><span class="detail-label">Enlace</span><span class="detail-value">${b.enlace ? sanitize(b.enlace).substring(0, 30) + '...' : '-'}</span></div>
          <div class="detail-row"><span class="detail-label">Inicio</span><span class="detail-value">${b.fechaInicio || '-'}</span></div>
          <div class="detail-row"><span class="detail-label">Fin</span><span class="detail-value">${b.fechaFin || '-'}</span></div>
        </div>
        <div class="entity-card-footer">
          <button class="btn-icon" onclick="editBanner('${b.id}')" title="Editar">&#9998;</button>
          <button class="btn-icon" onclick="confirmDelete('${b.id}', 'banner', '${sanitize(b.titulo)}')" title="Eliminar">&#10006;</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Error cargando banners:', e);
    showToast('Error al cargar banners', 'error');
  }
}

function openBannerModal(data = null) {
  document.getElementById('modalBannerTitle').textContent = data ? 'Editar Banner' : 'Nuevo Banner';
  document.getElementById('bannerId').value = data ? data.id : '';
  document.getElementById('bannerTitulo').value = data ? data.titulo : '';
  document.getElementById('bannerImagenURL').value = data ? data.imagenURL || '' : '';
  document.getElementById('bannerEnlace').value = data ? data.enlace || '' : '';
  document.getElementById('bannerOrden').value = data ? data.orden || 0 : 0;
  document.getElementById('bannerActivo').checked = data ? data.activo !== false : true;
  document.getElementById('bannerFechaInicio').value = data ? data.fechaInicio || '' : '';
  document.getElementById('bannerFechaFin').value = data ? data.fechaFin || '' : '';
  openModal('modalBanner');
}

async function editBanner(id) {
  try {
    const banner = await FirestoreService.getBanner(id);
    if (banner) openBannerModal(banner);
  } catch (e) {
    showToast('Error al cargar datos del banner', 'error');
  }
}

async function handleBannerSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('bannerId').value;
  const data = {
    titulo: document.getElementById('bannerTitulo').value,
    imagenURL: document.getElementById('bannerImagenURL').value,
    enlace: document.getElementById('bannerEnlace').value,
    orden: parseInt(document.getElementById('bannerOrden').value) || 0,
    activo: document.getElementById('bannerActivo').checked,
    fechaInicio: document.getElementById('bannerFechaInicio').value,
    fechaFin: document.getElementById('bannerFechaFin').value
  };

  try {
    if (id) {
      await FirestoreService.updateBanner(id, data);
      showToast('Banner actualizado correctamente', 'success');
    } else {
      await FirestoreService.createBanner(data);
      showToast('Banner creado correctamente', 'success');
    }
    closeModal('modalBanner');
    loadBanners();
  } catch (e) {
    showToast('Error al guardar banner: ' + e.message, 'error');
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
      case 'alumno': await FirestoreService.deleteUser(pendingDeleteId); loadAlumnos(); break;
      case 'clase': await FirestoreService.deleteClase(pendingDeleteId); loadClases(); break;
      case 'evento': await FirestoreService.deleteEvento(pendingDeleteId); loadEventos(); break;
      case 'banner': await FirestoreService.deleteBanner(pendingDeleteId); loadBanners(); break;
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
    const res = await ApiService._fetch('/api/evaluaciones');
    if (!res.ok) throw new Error('Error cargando evaluaciones');
    evalAdminCache = await res.json();
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
    return `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="#2a2a2a" stroke-width="1"/>
            <text x="${PAD - 5}" y="${y + 3}" text-anchor="end" fill="#555" font-size="9">${v}</text>`;
  }).join('');

  const puntos = points.map(p =>
    `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#E8652B"/>
     <text x="${p.x}" y="${p.y - 10}" text-anchor="middle" fill="#E8652B" font-size="10" font-weight="600">${p.prom.toFixed(1)}</text>
     <text x="${p.x}" y="${H - 8}" text-anchor="middle" fill="#aaa" font-size="9">C${p.clase}</text>`
  ).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="adminGoldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#E8652B" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#E8652B" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${guias}
      <polygon points="${polygon}" fill="url(#adminGoldGrad)"/>
      <polyline points="${polyline}" fill="none" stroke="#E8652B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
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

    const res = await ApiService._fetch('/api/observaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error();

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
