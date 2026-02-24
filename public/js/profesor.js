/* ============================================
   AL PASO DANCE STUDIO - Panel Profesor JS
   ============================================ */

let profUser     = null;
let profMisCursos = [];
let profAlumnos  = [];
let profEvals    = [];

// ---- INIT ----
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
    setupFoto();

    await Promise.all([loadAlumnos(), loadEvaluaciones()]);

    renderInicio();
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
      if (tabId === 'tab-alumnos')      renderAlumnosTab();
      if (tabId === 'tab-evaluaciones') renderEvalTab();
    });
  });
}

function setupLogout() {
  document.getElementById('profLogoutBtn').addEventListener('click', () => ApiService.logout());
}

// ---- DATOS ----
async function loadAlumnos() {
  try {
    const todos = await ApiService.getAlumnos();
    if (profMisCursos.length > 0) {
      const misCursosLower = profMisCursos.map(c => c.toLowerCase());
      profAlumnos = todos.filter(a => {
        const cursosA = getCursosAlumno(a);
        return misCursosLower.some(mc => cursosA.some(ca => ca.includes(mc) || mc.includes(ca)));
      });
    } else {
      profAlumnos = todos.filter(a => (a.role || 'alumno') === 'alumno');
    }
  } catch (e) {
    profAlumnos = [];
  }
}

async function loadEvaluaciones() {
  try {
    profEvals = await ApiService._fetch('/api/evaluaciones');
    if (profMisCursos.length > 0) {
      const misCursosLower = profMisCursos.map(c => c.toLowerCase());
      profEvals = profEvals.filter(e =>
        misCursosLower.some(mc => (e.Curso || '').toLowerCase().includes(mc))
      );
    }
  } catch (e) {
    profEvals = [];
  }
}

// ============================================
// TAB INICIO
// ============================================
function renderInicio() {
  document.getElementById('profNombre').textContent = (profUser.nombre || '').split(' ')[0];
  document.getElementById('profStatAlumnos').textContent = profAlumnos.length;
  document.getElementById('profStatCursos').textContent = profMisCursos.length;
  document.getElementById('profStatEvals').textContent = profEvals.length;

  renderClasesHoy();
  renderAlumnosHoy();
  renderPerfil();
}

async function renderClasesHoy() {
  const container = document.getElementById('profClasesHoy');
  try {
    const clases = await ApiService.getClasesActivas();
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const hoy = diasSemana[new Date().getDay()];
    const misCursosLower = profMisCursos.map(c => c.toLowerCase());

    const clasesHoy = clases.filter(c => {
      if ((c.dia || '').toLowerCase() !== hoy.toLowerCase()) return false;
      if (profMisCursos.length === 0) return true;
      const nombre = (c.nombre || '').toLowerCase();
      return misCursosLower.some(mc => nombre.includes(mc.split(' ')[0]));
    });

    if (clasesHoy.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.9rem">No hay clases programadas para hoy.</p>';
      return;
    }

    container.innerHTML = clasesHoy.map(c => {
      const numAlumnos = profAlumnos.filter(a => {
        const cursosA = getCursosAlumno(a);
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

async function renderAlumnosHoy() {
  const container = document.getElementById('profAlumnosHoy');
  try {
    const clases = await ApiService.getClasesActivas();
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const hoy = diasSemana[new Date().getDay()];
    const misCursosLower = profMisCursos.map(c => c.toLowerCase());

    const cursosHoy = clases
      .filter(c => {
        if ((c.dia || '').toLowerCase() !== hoy.toLowerCase()) return false;
        if (profMisCursos.length === 0) return true;
        const nombre = (c.nombre || '').toLowerCase();
        return misCursosLower.some(mc => nombre.includes(mc.split(' ')[0]));
      })
      .map(c => (c.nombre || '').toLowerCase());

    const alumnosHoy = profAlumnos.filter(a => {
      const cursosA = getCursosAlumno(a);
      return cursosHoy.some(ch => cursosA.some(ca => ch.includes(ca.split(' ')[0]) || ca.includes(ch.split(' ')[0])));
    });

    if (alumnosHoy.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.9rem">Sin alumnos para hoy.</p>';
      return;
    }

    container.innerHTML = alumnosHoy.map(a => `
      <div style="display:flex;align-items:center;gap:0.7rem;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <div class="avatar" style="width:32px;height:32px;font-size:0.7rem;flex-shrink:0">${getInitials(a.nombre)}</div>
        <div>
          <div style="font-size:0.88rem;font-weight:600;color:var(--blanco)">${esc(a.nombre)}</div>
          <div style="font-size:0.75rem;color:var(--blanco-suave)">${esc(a.curso || '')}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.9rem">No se pudo cargar.</p>';
  }
}

// ============================================
// TAB ALUMNOS
// ============================================
let cursoActivoAlumnos = null;

function renderAlumnosTab() {
  renderCursoPills('profCursosPills', cursoActivoAlumnos, (c) => {
    cursoActivoAlumnos = c;
    renderAlumnosList();
  });
  renderAlumnosList();
}

function renderAlumnosList() {
  const container = document.getElementById('profAlumnosList');
  let lista = profAlumnos;
  if (cursoActivoAlumnos) {
    lista = lista.filter(a => {
      const cursosA = getCursosAlumno(a);
      return cursosA.some(c => c.includes(cursoActivoAlumnos.toLowerCase()));
    });
  }

  if (lista.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay alumnos en este curso.</p>';
    return;
  }

  container.innerHTML = lista.map(a => {
    const planBadge   = a.plan ? `<span class="badge badge-gold" style="font-size:0.62rem">${esc(a.plan)}</span>` : '';
    const estadoBadge = (a.estado || '').toLowerCase() === 'pendiente'
      ? `<span class="badge badge-red" style="font-size:0.62rem">Pendiente</span>` : '';
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
    </div>`;
  }).join('');
}

// ============================================
// TAB EVALUACIONES — Promedio general por curso
// ============================================
function renderEvalTab() {
  const container = document.getElementById('profEvalDashboard');

  if (profEvals.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;padding:2rem 0">No hay evaluaciones aun.</p>';
    return;
  }

  // Agrupar por curso
  const porCurso = {};
  profEvals.forEach(e => {
    const curso = e.Curso || 'Sin curso';
    if (!porCurso[curso]) porCurso[curso] = [];
    porCurso[curso].push(e);
  });

  const prom = (arr, campo) => arr.length
    ? (arr.reduce((s, e) => s + (parseFloat(e[campo]) || 0), 0) / arr.length).toFixed(1)
    : '-';

  container.innerHTML = Object.entries(porCurso).map(([curso, evals]) => {
    const d = prom(evals, 'Disfrute');
    const c = prom(evals, 'Comprension');
    const p = prom(evals, 'ComodidadPareja');
    const f = prom(evals, 'Confianza');
    const general = evals.length
      ? ((parseFloat(d)+parseFloat(c)+parseFloat(p)+parseFloat(f))/4).toFixed(1)
      : '-';

    return `
    <div class="glass-card" style="margin-bottom:1rem;padding:1.2rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.9rem">
        <span style="font-size:0.9rem;font-weight:700;color:var(--blanco)">${esc(curso)}</span>
        <span style="font-size:1.3rem;font-weight:800;color:var(--naranja-claro);font-family:'Inter',sans-serif">${general}<span style="font-size:0.7rem;color:var(--blanco-suave)">/10</span></span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem">
        ${metricaFila('Disfrute', d)}
        ${metricaFila('Comprension', c)}
        ${metricaFila('Comodidad', p)}
        ${metricaFila('Confianza', f)}
      </div>
      <div style="margin-top:0.7rem;font-size:0.72rem;color:var(--blanco-suave);text-align:right">${evals.length} evaluacion${evals.length !== 1 ? 'es' : ''}</div>
    </div>`;
  }).join('');
}

function metricaFila(label, valor) {
  const pct = valor !== '-' ? (parseFloat(valor) / 10 * 100) : 0;
  return `
  <div>
    <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--blanco-suave);margin-bottom:0.2rem">
      <span>${label}</span><span class="text-gold">${valor}</span>
    </div>
    <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:2px">
      <div style="height:100%;width:${pct}%;background:var(--gradiente-brand-90);border-radius:2px"></div>
    </div>
  </div>`;
}

// ============================================
// TAB OBSERVACION
// ============================================
function setupObsForm() {
  const select = document.getElementById('obsProCurso');
  profMisCursos.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });

  document.getElementById('obsProFecha').value = new Date().toISOString().slice(0, 10);

  document.querySelectorAll('#tab-observaciones .eval-app-clase-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-observaciones .eval-app-clase-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('btnEnviarObsPro').addEventListener('click', enviarObservacion);
}

async function enviarObservacion() {
  const curso    = document.getElementById('obsProCurso').value;
  const claseBtn = document.querySelector('#tab-observaciones .eval-app-clase-btn.active');

  if (!curso)    { mostrarObsMsg('Selecciona un curso', false); return; }
  if (!claseBtn) { mostrarObsMsg('Selecciona el numero de clase', false); return; }

  const payload = {
    Curso:                  curso,
    NumeroClase:            parseInt(claseBtn.dataset.clase),
    Fecha:                  document.getElementById('obsProFecha').value,
    ObjetivoDelDia:         document.getElementById('obsProObjetivo').value.trim(),
    PasosTrabajados:        document.getElementById('obsProPasos').value.trim(),
    LogrosDelDia:           document.getElementById('obsProLogros').value.trim(),
    DificultadesDetectadas: document.getElementById('obsProDificultades').value.trim(),
    AjustesProximaClase:    document.getElementById('obsProAjustes').value.trim(),
    Notas:                  document.getElementById('obsProNotas').value.trim(),
  };

  const btn = document.getElementById('btnEnviarObsPro');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    await ApiService._fetch('/api/observaciones', { method: 'POST', body: JSON.stringify(payload) });
    mostrarObsMsg('Observacion guardada correctamente', true);
    ['obsProObjetivo','obsProPasos','obsProLogros','obsProDificultades','obsProAjustes','obsProNotas']
      .forEach(id => { document.getElementById(id).value = ''; });
    document.querySelectorAll('#tab-observaciones .eval-app-clase-btn').forEach(b => b.classList.remove('active'));
  } catch (e) {
    mostrarObsMsg(e.message || 'Error al guardar', false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar observacion';
  }
}

function mostrarObsMsg(msg, exito) {
  const el   = document.getElementById(exito ? 'obsProExito' : 'obsProError');
  const otro = document.getElementById(exito ? 'obsProError' : 'obsProExito');
  el.textContent = msg;
  el.classList.remove('hidden');
  otro.classList.add('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ============================================
// TAB PERFIL
// ============================================
function renderPerfil() {
  if (!profUser) return;
  const avatarEl = document.getElementById('profAvatar');
  if (profUser.fotoUrl) {
    avatarEl.innerHTML = `<img src="${profUser.fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    avatarEl.style.cssText += 'padding:0;overflow:hidden';
  } else {
    avatarEl.textContent = getInitials(profUser.nombre);
  }
  document.getElementById('profPerfilNombre').textContent = profUser.nombre || '-';
  document.getElementById('profPerfilTel').textContent   = profUser.telefono || '-';
  document.getElementById('profPerfilEmail').textContent = profUser.email || '-';

  const cursosEl = document.getElementById('profPerfilCursos');
  cursosEl.innerHTML = profMisCursos.length
    ? profMisCursos.map(c => `<span class="badge badge-gold" style="display:inline-block;margin:0.2rem">${esc(c)}</span>`).join('')
    : '-';

  // Rellenar select observacion si no tiene opciones aun
  const select = document.getElementById('obsProCurso');
  if (select.options.length <= 1 && profMisCursos.length > 0) {
    profMisCursos.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      select.appendChild(opt);
    });
  }
}

// ============================================
// FOTO PERFIL
// ============================================
function setupFoto() {
  const input = document.getElementById('profFotoInput');
  const btn   = document.getElementById('profFotoBtn');
  if (!input || !btn) return;

  let uploading = false;
  input.addEventListener('change', async (e) => {
    if (uploading) return;
    const file = e.target.files[0];
    if (!file) return;
    uploading = true;
    const orig = btn.innerHTML;
    btn.textContent = '...';
    try {
      const base64 = await comprimirFoto(file);
      await ApiService.updateUser(profUser.id, { fotoUrl: base64 });
      profUser.fotoUrl = base64;
      const avatarEl = document.getElementById('profAvatar');
      avatarEl.innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      avatarEl.style.cssText += 'padding:0;overflow:hidden';
      showToast('Foto actualizada');
    } catch {
      showToast('Error al subir foto', true);
    } finally {
      btn.innerHTML = orig;
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
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width-min)/2, (img.height-min)/2, min, min, 0, 0, size, size);
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
function getCursosAlumno(a) {
  const lista = (a.cursosInscritos || []).map(c => c.toLowerCase());
  if (!lista.length && a.curso) {
    lista.push(...a.curso.toLowerCase().split(',').map(c => c.trim()).filter(Boolean));
  }
  return lista;
}

function renderCursoPills(containerId, activo, onSelect) {
  const container = document.getElementById(containerId);
  const pills = [null, ...profMisCursos];
  container.innerHTML = pills.map(c => `
    <button class="curso-pill${activo === c ? ' active' : ''}" data-curso="${c || ''}">
      ${c || 'Todos'}
    </button>`).join('');
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

function showToast(msg, error = false) {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:${error ? '#e74c3c' : '#2ecc71'};color:#fff;
    padding:0.6rem 1.2rem;border-radius:12px;font-size:0.85rem;
    z-index:999;font-family:'Inter',sans-serif;font-weight:500;
    box-shadow:0 4px 15px rgba(0,0,0,0.3)`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
