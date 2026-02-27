/* ============================================
   AL PASO DANCE STUDIO - Panel Profesor JS
   ============================================ */

let profUser      = null;
let profMisCursos = [];
let profAlumnos   = [];
let profEvals     = [];
let asistenciaHoy = {}; // alumnoId → true si está marcado hoy

// ---- ASISTENCIA DIARIA (localStorage) ----
function getAsistenciaHoy() {
  const hoy = new Date().toISOString().slice(0, 10);
  try {
    const stored = JSON.parse(localStorage.getItem('prof_asistencia') || '{}');
    return stored.fecha === hoy ? (stored.data || {}) : {};
  } catch { return {}; }
}
function guardarAsistencia(alumnoId, valor) {
  const hoy = new Date().toISOString().slice(0, 10);
  try {
    const stored = JSON.parse(localStorage.getItem('prof_asistencia') || '{}');
    const data = stored.fecha === hoy ? (stored.data || {}) : {};
    if (valor) data[alumnoId] = true;
    else delete data[alumnoId];
    localStorage.setItem('prof_asistencia', JSON.stringify({ fecha: hoy, data }));
  } catch {}
}

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

    asistenciaHoy = getAsistenciaHoy();

    await Promise.all([loadAlumnos(), loadEvaluaciones()]);

    renderAlumnosTab();
    renderPerfil();
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
      if (tabId === 'tab-cursos')       renderCursosTab();
      if (tabId === 'tab-evaluaciones') renderEvalTab();
      if (tabId === 'tab-feedback')     setupFeedbackTab();
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
    // Solo alumnos (no admin/profesor) y filtrar por cursos del profesor
    const soloAlumnos = todos.filter(a => (a.role || 'alumno') === 'alumno');
    if (profMisCursos.length > 0) {
      const misCursosLower = profMisCursos.map(c => c.toLowerCase());
      profAlumnos = soloAlumnos.filter(a => {
        const cursosA = getCursosAlumno(a);
        return misCursosLower.some(mc => cursosA.some(ca => ca.includes(mc) || mc.includes(ca)));
      });
    } else {
      profAlumnos = soloAlumnos;
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
// TAB: ALUMNOS — nombre, curso, clases
// ============================================
function renderAlumnosTab() {
  const container = document.getElementById('profAlumnosList');

  if (profAlumnos.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;padding:2rem 0">No hay alumnos asignados.</p>';
    return;
  }

  // Ordenar por nombre
  const lista = [...profAlumnos].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

  container.innerHTML = lista.map(a => {
    const cursoPrincipal = getCursosAlumno(a)[0] || a.curso || '-';
    const asistidas   = a.clasesAsistidas || 0;
    const contratadas = a.clasesContratadas || 0;
    const pct = contratadas > 0 ? Math.round(asistidas / contratadas * 100) : 0;

    return `
    <div class="prof-alumno-card">
      <div class="avatar" style="flex-shrink:0">${getInitials(a.nombre)}</div>
      <div class="prof-alumno-info" style="flex:1;min-width:0">
        <div class="prof-alumno-nombre">${esc(a.nombre)}</div>
        <div class="prof-alumno-sub">${esc(cursoPrincipal)}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:0.9rem;font-weight:700;color:var(--blanco);font-family:'Inter',sans-serif">${asistidas}<span style="color:var(--blanco-suave);font-weight:400">/${contratadas}</span></div>
        <div style="font-size:0.7rem;color:var(--blanco-suave)">clases</div>
        <div style="margin-top:4px;height:3px;width:56px;background:rgba(255,255,255,0.08);border-radius:2px">
          <div style="height:100%;width:${pct}%;background:var(--gradiente-brand-90);border-radius:2px"></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ============================================
// TAB: CURSOS — alumnos por curso + asistencia
// ============================================
let cursoSeleccionado = null;

function renderCursosTab() {
  if (cursoSeleccionado === null && profMisCursos.length > 0) {
    cursoSeleccionado = profMisCursos[0];
  }
  renderCursosPills();
  renderAlumnosCurso();
}

function renderCursosPills() {
  const container = document.getElementById('profCursosPills');
  container.innerHTML = profMisCursos.map(c => `
    <button class="curso-pill${cursoSeleccionado === c ? ' active' : ''}" data-curso="${esc(c)}">
      ${esc(c)}
    </button>`).join('');

  container.querySelectorAll('.curso-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      cursoSeleccionado = pill.dataset.curso;
      renderCursosPills();
      renderAlumnosCurso();
    });
  });
}

function renderAlumnosCurso() {
  const container = document.getElementById('profCursosContenido');

  if (!cursoSeleccionado) {
    container.innerHTML = '<p class="text-muted">Sin cursos asignados.</p>';
    return;
  }

  const cursoLower = cursoSeleccionado.toLowerCase();
  const alumnosCurso = profAlumnos
    .filter(a => getCursosAlumno(a).some(c => c.includes(cursoLower)))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

  if (alumnosCurso.length === 0) {
    container.innerHTML = '<p class="text-muted" style="padding:1rem 0">No hay alumnos en este curso.</p>';
    return;
  }

  container.innerHTML = `
    <div style="margin-bottom:0.6rem;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:0.75rem;color:var(--blanco-suave);font-family:'Inter',sans-serif;text-transform:uppercase;letter-spacing:1px">${alumnosCurso.length} alumnos</span>
    </div>
    ${alumnosCurso.map(a => {
      const yaAsistio  = !!asistenciaHoy[a.id];
      const asistidas  = a.clasesAsistidas || 0;
      const contratadas = a.clasesContratadas || 0;
      return `
      <div class="prof-alumno-card" id="card-${a.id}">
        <div class="avatar" style="flex-shrink:0">${getInitials(a.nombre)}</div>
        <div class="prof-alumno-info" style="flex:1;min-width:0">
          <div class="prof-alumno-nombre">${esc(a.nombre)}</div>
          <div class="prof-alumno-sub" id="clases-${a.id}">${asistidas}/${contratadas} clases</div>
        </div>
        <button
          class="btn-asistencia${yaAsistio ? ' asistido' : ''}"
          id="btn-asist-${a.id}"
          onclick="marcarAsistencia('${a.id}')">
          ${yaAsistio ? '&#x2714; Presente' : 'Marcar'}
        </button>
      </div>`;
    }).join('')}`;
}

async function marcarAsistencia(alumnoId) {
  const yaAsistio = !!asistenciaHoy[alumnoId];
  const accion = yaAsistio ? 'desmarcar' : 'marcar';

  const btn = document.getElementById(`btn-asist-${alumnoId}`);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  try {
    const res = await ApiService._fetch('/api/asistencia', {
      method: 'POST',
      body: JSON.stringify({ alumnoId, accion }),
    });

    const alumno = profAlumnos.find(a => a.id === alumnoId);
    if (alumno) alumno.clasesAsistidas = res.clasesAsistidas;

    asistenciaHoy[alumnoId] = !yaAsistio;
    guardarAsistencia(alumnoId, !yaAsistio);

    if (btn) {
      btn.disabled = false;
      if (asistenciaHoy[alumnoId]) {
        btn.classList.add('asistido');
        btn.innerHTML = '&#x2714; Presente';
      } else {
        btn.classList.remove('asistido');
        btn.innerHTML = 'Marcar';
      }
    }
    const clasesTxt = document.getElementById(`clases-${alumnoId}`);
    if (clasesTxt && alumno) {
      clasesTxt.textContent = `${alumno.clasesAsistidas}/${alumno.clasesContratadas || 0} clases`;
    }

    showToast(yaAsistio ? 'Asistencia desmarcada' : 'Asistencia registrada');
  } catch (e) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = yaAsistio ? '&#x2714; Presente' : 'Marcar';
    }
    showToast('Error al registrar asistencia', true);
  }
}

// ============================================
// TAB: EVALUACIONES — promedio general por curso
// ============================================
function renderEvalTab() {
  const container = document.getElementById('profEvalDashboard');

  if (profEvals.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;padding:2rem 0">No hay evaluaciones aun.</p>';
    return;
  }

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
// TAB: OBSERVACION
// ============================================
function setupObsForm() {
  const select = document.getElementById('obsProCurso');
  profMisCursos.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    select.appendChild(opt);
  });

  document.getElementById('obsProFecha').value = new Date().toISOString().slice(0, 10);

  document.querySelectorAll('#tab-observaciones .eval-app-clase-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-observaciones .eval-app-clase-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  document.getElementById('btnEnviarObsPro').addEventListener('click', enviarObservacion);
}

async function enviarObservacion() {
  const curso    = document.getElementById('obsProCurso').value;
  const claseBtn = document.querySelector('#tab-observaciones .eval-app-clase-btn.selected');

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
  btn.disabled = true; btn.textContent = 'Guardando...';

  try {
    await ApiService._fetch('/api/observaciones', { method: 'POST', body: JSON.stringify(payload) });
    mostrarObsMsg('Observacion guardada correctamente', true);
    ['obsProObjetivo','obsProPasos','obsProLogros','obsProDificultades','obsProAjustes','obsProNotas']
      .forEach(id => { document.getElementById(id).value = ''; });
    document.querySelectorAll('#tab-observaciones .eval-app-clase-btn').forEach(b => b.classList.remove('selected'));
  } catch (e) {
    mostrarObsMsg(e.message || 'Error al guardar', false);
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar observacion';
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
// TAB: PERFIL
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
}

// ============================================
// FOTO PERFIL
// ============================================
// ── CLOUDINARY CONFIG (profesor) ──────────────────────────────────────────
const PROF_CLOUDINARY_CLOUD_NAME    = 'debpk4syz';
const PROF_CLOUDINARY_UPLOAD_PRESET = 'al-paso-fotos';

function setupFoto() {
  const btn = document.getElementById('profFotoBtn');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();

    if (typeof cloudinary !== 'undefined') {
      const widget = cloudinary.createUploadWidget(
        {
          cloudName:            PROF_CLOUDINARY_CLOUD_NAME,
          uploadPreset:         PROF_CLOUDINARY_UPLOAD_PRESET,
          sources:              ['local', 'camera'],
          multiple:             false,
          cropping:             true,
          croppingAspectRatio:  1,
          maxFileSize:          5000000,
          folder:               'al-paso-perfiles',
          clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
        },
        async (error, result) => {
          if (error) { console.error('Cloudinary error:', error); return; }
          if (result.event === 'success') {
            const url = result.info.secure_url;
            try {
              await ApiService.updateUser(profUser.id, { fotoUrl: url });
              profUser.fotoUrl = url;
              const av = document.getElementById('profAvatar');
              av.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
              av.style.cssText += 'padding:0;overflow:hidden';
              showToast('Foto actualizada');
              widget.close();
            } catch {
              showToast('Error al guardar foto', true);
            }
          }
        }
      );
      widget.open();
    } else {
      // Fallback file input
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const orig = btn.textContent; btn.textContent = '...';
        try {
          const base64 = await comprimirFoto(file);
          await ApiService.updateUser(profUser.id, { fotoUrl: base64 });
          profUser.fotoUrl = base64;
          const av = document.getElementById('profAvatar');
          av.innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
          av.style.cssText += 'padding:0;overflow:hidden';
          showToast('Foto actualizada');
        } catch { showToast('Error al subir foto', true); }
        finally { btn.textContent = orig; }
      };
      input.click();
    }
  });
}

// ── FEEDBACK MENSUAL (profesor) ────────────────────────────────────────────
let feedbackTabInit = false;

function setupFeedbackTab() {
  if (feedbackTabInit) return;
  feedbackTabInit = true;

  // Poblar select de alumnos
  const select = document.getElementById('fbAlumnoSelect');
  if (!select) return;

  profAlumnos.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.nombre + (a.cursosInscritos && a.cursosInscritos.length ? ' — ' + a.cursosInscritos[0] : '');
    select.appendChild(opt);
  });

  // Mes actual como default
  const now = new Date();
  const mesSelect = document.getElementById('fbMesSelect');
  if (mesSelect) mesSelect.value = String(now.getMonth() + 1);

  // Boton guardar
  const btn = document.getElementById('btnGuardarFeedback');
  if (btn) btn.addEventListener('click', guardarFeedback);
}

async function guardarFeedback() {
  const msg       = document.getElementById('fbMsg');
  const btn       = document.getElementById('btnGuardarFeedback');
  const alumnoId  = document.getElementById('fbAlumnoSelect').value;
  const mes       = document.getElementById('fbMesSelect').value;
  const anio      = document.getElementById('fbAnioInput').value;
  const positivo  = document.getElementById('fbPositivo').value.trim();
  const mejoras   = document.getElementById('fbMejoras').value.trim();
  const aMejorar  = document.getElementById('fbAMejorar').value.trim();

  msg.className = 'eval-app-msg hidden';

  if (!alumnoId || !mes || !anio) {
    msg.textContent = 'Selecciona un alumno y el mes/año.';
    msg.className = 'eval-app-msg eval-app-msg-error';
    return;
  }

  const alumno = profAlumnos.find(a => a.id === alumnoId);
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    await ApiService._fetch('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        alumnoId,
        alumnoNombre: alumno ? alumno.nombre : '',
        mes,
        anio,
        positivo,
        mejoras,
        aMejorar,
      }),
    });
    msg.textContent = 'Feedback guardado correctamente.';
    msg.className = 'eval-app-msg eval-app-msg-success';
  } catch (e) {
    msg.textContent = e.message || 'Error al guardar. Intenta de nuevo.';
    msg.className = 'eval-app-msg eval-app-msg-error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar Feedback';
  }
}

function comprimirFoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 200;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width-min)/2, (img.height-min)/2, min, min, 0, 0, 200, 200);
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
