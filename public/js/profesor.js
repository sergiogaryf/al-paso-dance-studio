/* ============================================
   AL PASO DANCE STUDIO - Panel Profesor JS
   ============================================ */

// ---- AUTH CHECK ----
let profUser = null;
let profMisCursos = [];
let profAlumnos = [];
let profEvaluaciones = [];

(async function () {
  try {
    profUser = await checkProfesorAuth();
    profMisCursos = profUser.cursosInscritos || [];

    document.getElementById('profLoading').style.display = 'none';
    document.getElementById('profContent').classList.remove('hidden');
    document.getElementById('profTabBar').classList.remove('hidden');

    setupTabs();
    setupLogout();
    setupObsForm();
    setupProfFoto();

    await Promise.all([
      loadAllAlumnos(),
      loadAllEvaluaciones(),
    ]);

    loadInicio();
  } catch (e) {
    console.error('Error init profesor:', e);
  }
})();

// ---- TABS ----
function setupTabs() {
  document.querySelectorAll('#profTabBar .tab-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#profTabBar .tab-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.getElementById(tabId).classList.add('active');
      if (tabId === 'tab-alumnos') renderAlumnosTab();
      if (tabId === 'tab-evaluaciones') renderEvaluacionesTab();
    });
  });
}

// ---- LOGOUT ----
function setupLogout() {
  document.getElementById('profLogoutBtn').addEventListener('click', () => ApiService.logout());
}

// ============================================
// DATOS
// ============================================
async function loadAllAlumnos() {
  try {
    const todos = await ApiService.getAlumnos();
    // Filtrar solo los alumnos que tienen al menos un curso del profesor
    if (profMisCursos.length > 0) {
      const misCursosLower = profMisCursos.map(c => c.toLowerCase());
      profAlumnos = todos.filter(a => {
        const cursosAlumno = (a.cursosInscritos || []).map(c => c.toLowerCase());
        if (!cursosAlumno.length && a.curso) {
          cursosAlumno.push(...a.curso.toLowerCase().split(',').map(c => c.trim()));
        }
        return misCursosLower.some(mc => cursosAlumno.some(ca => ca.includes(mc) || mc.includes(ca)));
      });
    } else {
      profAlumnos = todos;
    }
  } catch (e) {
    console.error('Error cargando alumnos:', e);
    profAlumnos = [];
  }
}

async function loadAllEvaluaciones() {
  try {
    profEvaluaciones = await ApiService._fetch('/api/evaluaciones');
    // Filtrar por mis cursos
    if (profMisCursos.length > 0) {
      const misCursosLower = profMisCursos.map(c => c.toLowerCase());
      profEvaluaciones = profEvaluaciones.filter(e =>
        misCursosLower.some(mc => (e.Curso || '').toLowerCase().includes(mc))
      );
    }
  } catch (e) {
    console.error('Error cargando evaluaciones:', e);
    profEvaluaciones = [];
  }
}

// ============================================
// TAB INICIO
// ============================================
function loadInicio() {
  // Nombre
  document.getElementById('profNombre').textContent = (profUser.nombre || '').split(' ')[0];

  // Stats
  document.getElementById('profStatAlumnos').textContent = profAlumnos.length;
  document.getElementById('profStatCursos').textContent = profMisCursos.length;

  const hoy = new Date().toISOString().slice(0, 10);
  const evalHoy = profEvaluaciones.filter(e => (e.FechaEvaluacion || '').slice(0, 10) === hoy).length;
  document.getElementById('profStatEvalHoy').textContent = evalHoy;

  // Clases de hoy
  renderClasesHoy();

  // Pendientes de pago
  renderPendientes();

  // Perfil
  loadPerfil();
}

async function renderClasesHoy() {
  const container = document.getElementById('profClasesHoy');
  try {
    const clases = await ApiService.getClasesActivas();
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const hoy = diasSemana[new Date().getDay()];

    // Filtrar clases de hoy que pertenezcan a mis cursos
    const misCursosLower = profMisCursos.map(c => c.toLowerCase());
    const clasesHoy = clases.filter(c => {
      const mismaFecha = c.dia === hoy;
      if (!mismaFecha) return false;
      if (profMisCursos.length === 0) return true;
      const nombreClase = (c.nombre || '').toLowerCase();
      return misCursosLower.some(mc => nombreClase.includes(mc.split(' ')[0].toLowerCase()));
    });

    if (clasesHoy.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.9rem">No hay clases programadas para hoy.</p>';
      return;
    }

    container.innerHTML = clasesHoy.map(c => {
      const numAlumnos = profAlumnos.filter(a => {
        const cursosA = (a.cursosInscritos || []).map(n => n.toLowerCase());
        const nombreClase = (c.nombre || '').toLowerCase();
        return cursosA.some(ca => nombreClase.includes(ca.split(' ')[0]));
      }).length;
      return `<div class="prof-clase-hoy-item">
        <div>
          <div class="prof-clase-nombre">${esc(c.nombre)}</div>
          <div class="prof-clase-hora">${c.hora || ''} &middot; ${numAlumnos} alumnos</div>
        </div>
        <span class="prof-clase-badge">${esc(c.nivel || c.disciplina || '')}</span>
      </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.9rem">No se pudo cargar.</p>';
  }
}

function renderPendientes() {
  const pendientes = profAlumnos.filter(a => (a.estado || '').toLowerCase() === 'pendiente');
  const card = document.getElementById('profPendientesCard');
  const lista = document.getElementById('profPendientesList');

  if (pendientes.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  lista.innerHTML = pendientes.map(a => `
    <div class="prof-pendiente-item">
      <span>${esc(a.nombre)}</span>
      ${a.telefono
        ? `<a href="https://wa.me/${formatWA(a.telefono)}" class="btn-whatsapp" target="_blank">&#128172;</a>`
        : ''}
    </div>
  `).join('');
}

// ============================================
// TAB ALUMNOS
// ============================================
let cursoActivoAlumnos = null;
let asistenciaHoy = {}; // id → true si ya marcamos en esta sesion

function renderAlumnosTab() {
  renderCursoPills('profCursosPills', cursoActivoAlumnos, (c) => {
    cursoActivoAlumnos = c;
    renderAlumnosLista();
  });
  renderAlumnosLista();
}

function renderAlumnosLista() {
  const container = document.getElementById('profAlumnosList');
  let lista = profAlumnos;
  if (cursoActivoAlumnos) {
    lista = lista.filter(a => {
      const cursosA = (a.cursosInscritos || []).map(c => c.toLowerCase());
      return cursosA.some(c => c.includes(cursoActivoAlumnos.toLowerCase()));
    });
  }

  if (lista.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay alumnos en este curso.</p>';
    return;
  }

  container.innerHTML = lista.map(a => {
    const yaAsistio = !!asistenciaHoy[a.id];
    const planBadge = a.plan ? `<span class="badge badge-gold" style="font-size:0.65rem">${esc(a.plan)}</span>` : '';
    const estadoBadge = (a.estado || '').toLowerCase() === 'pendiente'
      ? `<span class="badge badge-red" style="font-size:0.65rem">Pendiente</span>` : '';
    return `
    <div class="prof-alumno-card">
      <div class="avatar" style="flex-shrink:0">${getInitials(a.nombre)}</div>
      <div class="prof-alumno-info">
        <div class="prof-alumno-nombre">${esc(a.nombre)}</div>
        <div class="prof-alumno-sub">
          ${a.clasesAsistidas || 0}/${a.clasesContratadas || 0} clases
          &nbsp;${planBadge}${estadoBadge}
        </div>
      </div>
      <div class="prof-alumno-actions">
        ${a.telefono
          ? `<a href="https://wa.me/${formatWA(a.telefono)}" class="btn-whatsapp" target="_blank">&#128172;</a>`
          : ''}
        <button class="btn-asistencia${yaAsistio ? ' asistido' : ''}"
          onclick="abrirAsistModal('${a.id}', '${esc(a.nombre)}', ${a.clasesAsistidas || 0}, ${a.clasesContratadas || 0})"
          ${yaAsistio ? 'disabled' : ''}>
          ${yaAsistio ? '&#x2714;' : '&#x2714; Asistio'}
        </button>
      </div>
    </div>`;
  }).join('');
}

// ---- MODAL ASISTENCIA ----
let asistModalAlumnoId = null;

function abrirAsistModal(id, nombre, asistidas, contratadas) {
  asistModalAlumnoId = id;
  document.getElementById('profAsistNombre').textContent = nombre;
  document.getElementById('profAsistInfo').textContent = `Clases: ${asistidas}/${contratadas}`;
  document.getElementById('profAsistModal').classList.remove('hidden');
}

document.getElementById('btnCerrarAsist').addEventListener('click', () => {
  document.getElementById('profAsistModal').classList.add('hidden');
  asistModalAlumnoId = null;
});

document.getElementById('btnMarcarAsistencia').addEventListener('click', async () => {
  if (!asistModalAlumnoId) return;
  const btn = document.getElementById('btnMarcarAsistencia');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const alumno = profAlumnos.find(a => a.id === asistModalAlumnoId);
    if (!alumno) throw new Error('Alumno no encontrado');
    const nuevasCantidad = (alumno.clasesAsistidas || 0) + 1;
    await ApiService.updateUser(asistModalAlumnoId, { clasesAsistidas: nuevasCantidad });
    alumno.clasesAsistidas = nuevasCantidad;
    asistenciaHoy[asistModalAlumnoId] = true;
    document.getElementById('profAsistModal').classList.add('hidden');
    asistModalAlumnoId = null;
    renderAlumnosLista();
    showMiniToast('Asistencia registrada');
  } catch (e) {
    showMiniToast('Error al registrar asistencia', true);
  } finally {
    btn.disabled = false;
    btn.textContent = '&#x2714; Asistio hoy';
  }
});

// ============================================
// TAB EVALUACIONES
// ============================================
let cursoActivoEval = null;

function renderEvaluacionesTab() {
  renderCursoPills('profEvalPills', cursoActivoEval, (c) => {
    cursoActivoEval = c;
    renderEvaluacionesDatos();
  });
  renderEvaluacionesDatos();
}

function renderEvaluacionesDatos() {
  let lista = profEvaluaciones;
  if (cursoActivoEval) {
    lista = lista.filter(e => (e.Curso || '').toLowerCase().includes(cursoActivoEval.toLowerCase()));
  }

  const promediosCard = document.getElementById('profEvalPromedios');

  if (lista.length === 0) {
    promediosCard.style.display = 'none';
    document.getElementById('profEvalLista').innerHTML =
      '<p class="text-muted" style="text-align:center;padding:1.5rem 0">No hay evaluaciones aun.</p>';
    return;
  }

  promediosCard.style.display = 'block';

  const prom = campo => lista.length
    ? (lista.reduce((a, e) => a + (parseFloat(e[campo]) || 0), 0) / lista.length).toFixed(1)
    : '0';

  const metricas = [
    ['Disfrute', 'profPromDisfrute', 'profBarraDisfrute'],
    ['Comprension', 'profPromComprension', 'profBarraComprension'],
    ['ComodidadPareja', 'profPromComodidad', 'profBarraComodidad'],
    ['Confianza', 'profPromConfianza', 'profBarraConfianza'],
  ];

  metricas.forEach(([campo, idVal, idBarra]) => {
    const v = prom(campo);
    document.getElementById(idVal).textContent = v;
    document.getElementById(idBarra).style.width = (parseFloat(v) / 10 * 100) + '%';
  });

  // Lista de ultimas evaluaciones
  const ultimas = [...lista]
    .sort((a, b) => (b.FechaHoraISO || '').localeCompare(a.FechaHoraISO || ''))
    .slice(0, 20);

  document.getElementById('profEvalLista').innerHTML = ultimas.map(e => {
    const promedio = (
      (parseFloat(e.Disfrute || 0) + parseFloat(e.Comprension || 0) +
       parseFloat(e.ComodidadPareja || 0) + parseFloat(e.Confianza || 0)) / 4
    ).toFixed(1);
    return `<div class="prof-eval-item">
      <div class="prof-eval-item-header">
        <span class="prof-eval-nombre">${esc(e.NombreAlumno || '?')}</span>
        <span class="prof-eval-score">${promedio}</span>
      </div>
      <div class="prof-eval-meta">
        ${esc(e.Curso || '')} · Clase ${e.NumeroClase || '?'}
        · ${formatFecha(e.FechaEvaluacion)}
        ${e.BaileNuevo ? ' · <span style="color:#2ecc71">Nuevo compañero ✓</span>' : ''}
      </div>
      ${e.Comentario
        ? `<div class="prof-eval-comentario">"${esc(e.Comentario)}"</div>`
        : ''}
    </div>`;
  }).join('');
}

// ============================================
// TAB OBSERVACIONES
// ============================================
function setupObsForm() {
  // Poblar select de cursos
  const select = document.getElementById('obsProCurso');
  profMisCursos.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });

  // Fecha default
  document.getElementById('obsProFecha').value = new Date().toISOString().slice(0, 10);

  // Botones clase
  document.querySelectorAll('#tab-observaciones .eval-app-clase-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-observaciones .eval-app-clase-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Submit
  document.getElementById('btnEnviarObsPro').addEventListener('click', enviarObservacion);
}

async function enviarObservacion() {
  const curso = document.getElementById('obsProCurso').value;
  const claseBtn = document.querySelector('#tab-observaciones .eval-app-clase-btn.active');
  const errDiv = document.getElementById('obsProError');
  const okDiv = document.getElementById('obsProExito');

  errDiv.classList.add('hidden');
  okDiv.classList.add('hidden');

  if (!curso) { mostrarObsMsg('Selecciona un curso', false); return; }
  if (!claseBtn) { mostrarObsMsg('Selecciona el numero de clase', false); return; }

  const payload = {
    Curso: curso,
    NumeroClase: parseInt(claseBtn.dataset.clase),
    Fecha: document.getElementById('obsProFecha').value,
    ObjetivoDelDia: document.getElementById('obsProObjetivo').value.trim(),
    PasosTrabajados: document.getElementById('obsProPasos').value.trim(),
    LogrosDelDia: document.getElementById('obsProLogros').value.trim(),
    DificultadesDetectadas: document.getElementById('obsProDificultades').value.trim(),
    AjustesProximaClase: document.getElementById('obsProAjustes').value.trim(),
    Notas: document.getElementById('obsProNotas').value.trim(),
  };

  const btn = document.getElementById('btnEnviarObsPro');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    await ApiService._fetch('/api/observaciones', { method: 'POST', body: JSON.stringify(payload) });
    mostrarObsMsg('Observacion guardada correctamente', true);
    // Limpiar form
    document.getElementById('obsProObjetivo').value = '';
    document.getElementById('obsProPasos').value = '';
    document.getElementById('obsProLogros').value = '';
    document.getElementById('obsProDificultades').value = '';
    document.getElementById('obsProAjustes').value = '';
    document.getElementById('obsProNotas').value = '';
    document.querySelectorAll('#tab-observaciones .eval-app-clase-btn').forEach(b => b.classList.remove('active'));
  } catch (e) {
    mostrarObsMsg(e.message || 'Error al guardar', false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar observacion';
  }
}

function mostrarObsMsg(msg, exito) {
  const el = document.getElementById(exito ? 'obsProExito' : 'obsProError');
  const otro = document.getElementById(exito ? 'obsProError' : 'obsProExito');
  el.textContent = msg;
  el.classList.remove('hidden');
  otro.classList.add('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ============================================
// TAB PERFIL
// ============================================
function loadPerfil() {
  if (!profUser) return;
  const avatarEl = document.getElementById('profAvatar');
  if (profUser.fotoUrl) {
    avatarEl.innerHTML = `<img src="${profUser.fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`;
    avatarEl.style.padding = '0';
    avatarEl.style.overflow = 'hidden';
  } else {
    avatarEl.textContent = getInitials(profUser.nombre);
  }
  document.getElementById('profPerfilNombre').textContent = profUser.nombre || '-';
  document.getElementById('profPerfilTel').textContent = profUser.telefono || '-';
  document.getElementById('profPerfilEmail').textContent = profUser.email || '-';

  const cursosEl = document.getElementById('profPerfilCursos');
  if (profMisCursos.length > 0) {
    cursosEl.innerHTML = profMisCursos.map(c =>
      `<span class="badge badge-gold" style="display:inline-block;margin:0.2rem 0.2rem 0.2rem 0">${esc(c)}</span>`
    ).join('');
  } else {
    cursosEl.textContent = '-';
  }

  // Poblar select obs
  const select = document.getElementById('obsProCurso');
  if (select.options.length <= 1 && profMisCursos.length > 0) {
    profMisCursos.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
  }
}

// ============================================
// HELPERS
// ============================================
function renderCursoPills(containerId, activo, onSelect) {
  const container = document.getElementById(containerId);
  const pills = [null, ...profMisCursos];
  container.innerHTML = pills.map(c => `
    <button class="curso-pill${activo === c ? ' active' : ''}" data-curso="${c || ''}">
      ${c || 'Todos'}
    </button>
  `).join('');
  container.querySelectorAll('.curso-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const c = pill.dataset.curso || null;
      onSelect(c);
      renderCursoPills(containerId, c, onSelect);
    });
  });
}

function getInitials(nombre) {
  if (!nombre) return '??';
  return nombre.trim().split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatWA(tel) {
  return tel.replace(/\D/g, '');
}

function formatFecha(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  } catch { return dateStr; }
}

// ============================================
// FOTO PERFIL PROFESOR
// ============================================
function setupProfFoto() {
  const btn = document.getElementById('profFotoBtn');
  const input = document.getElementById('profFotoInput');
  if (!btn || !input) return;

  let uploading = false;
  input.addEventListener('change', async (e) => {
    if (uploading) return;
    const file = e.target.files[0];
    if (!file) return;

    uploading = true;
    const origContent = btn.innerHTML;
    btn.textContent = '...';

    try {
      const base64 = await comprimirFoto(file);
      await ApiService.updateUser(profUser.id, { fotoUrl: base64 });
      profUser.fotoUrl = base64;

      const avatarEl = document.getElementById('profAvatar');
      avatarEl.innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`;
      avatarEl.style.padding = '0';
      avatarEl.style.overflow = 'hidden';

      showMiniToast('Foto actualizada');
    } catch (err) {
      console.error('Error subiendo foto:', err);
      showMiniToast('Error al subir foto', true);
    } finally {
      btn.innerHTML = origContent;
      uploading = false;
      input.value = '';
    }
  });
}

function comprimirFoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
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

function showMiniToast(msg, error = false) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:${error ? '#e74c3c' : '#2ecc71'};color:#fff;
    padding:0.6rem 1.2rem;border-radius:12px;font-size:0.85rem;
    z-index:999;font-family:'Inter',sans-serif;font-weight:500;
    box-shadow:0 4px 15px rgba(0,0,0,0.3)`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}
