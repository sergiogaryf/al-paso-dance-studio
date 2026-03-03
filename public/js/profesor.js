/* ============================================
   AL PASO DANCE STUDIO - Panel Profesor JS
   ============================================ */

let profUser      = null;
let profMisCursos = [];
let profAlumnos   = [];
let profEvals     = [];
let asistenciaHoy = {}; // alumnoId → true si está marcado hoy

// ---- ASISTENCIA DIARIA (localStorage) ----
// Guarda: { fecha, data: { clave: 'asistio'|'falto' } }
function getAsistenciaHoy() {
  const hoy = new Date().toISOString().slice(0, 10);
  try {
    const stored = JSON.parse(localStorage.getItem('prof_asistencia') || '{}');
    return stored.fecha === hoy ? (stored.data || {}) : {};
  } catch { return {}; }
}
function claveAsistencia(alumnoId, curso) {
  return alumnoId + (curso ? '_' + curso : '');
}
// tipo: 'asistio' | 'falto' | null (para borrar)
function guardarAsistencia(alumnoId, curso, tipo) {
  const hoy = new Date().toISOString().slice(0, 10);
  try {
    const stored = JSON.parse(localStorage.getItem('prof_asistencia') || '{}');
    const data = stored.fecha === hoy ? (stored.data || {}) : {};
    const clave = claveAsistencia(alumnoId, curso);
    if (tipo) data[clave] = tipo;
    else delete data[clave];
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
    programarRenovacionMedianoche();

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
      if (tabId === 'tab-calendario')   renderCalendarioProfesor();
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
// TAB: ALUMNOS — nombre, foto, cursos, clases
// ============================================
function renderAlumnosTab() {
  const container = document.getElementById('profAlumnosList');

  if (profAlumnos.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;padding:2rem 0">No hay alumnos asignados.</p>';
    return;
  }

  const lista = [...profAlumnos].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

  container.innerHTML = lista.map(a => {
    const cursos      = a.cursosInscritos && a.cursosInscritos.length
      ? a.cursosInscritos
      : (a.curso ? a.curso.split(',').map(s => s.trim()).filter(Boolean) : []);
    const asistidas   = a.clasesAsistidas || 0;
    const contratadas = a.clasesContratadas || 0;
    const pct         = contratadas > 0 ? Math.round(asistidas / contratadas * 100) : 0;

    const avatarHTML = a.fotoUrl
      ? `<div class="avatar" style="flex-shrink:0;padding:0;overflow:hidden">
           <img src="${esc(a.fotoUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">
         </div>`
      : `<div class="avatar" style="flex-shrink:0">${getInitials(a.nombre)}</div>`;

    const cursosHTML = cursos.length
      ? cursos.map(c => `<span style="display:inline-block;font-size:0.62rem;padding:0.12rem 0.45rem;border-radius:8px;background:rgba(196,110,60,0.15);border:1px solid rgba(196,110,60,0.35);color:var(--naranja-claro);margin:0.15rem 0.15rem 0 0;white-space:nowrap">${esc(c)}</span>`).join('')
      : `<span style="font-size:0.75rem;color:var(--blanco-suave)">Sin curso</span>`;

    return `
    <div class="prof-alumno-card" style="cursor:pointer" onclick="abrirPerfilAlumno('${a.id}')">
      ${avatarHTML}
      <div class="prof-alumno-info" style="flex:1;min-width:0">
        <div class="prof-alumno-nombre">${esc(a.nombre)}</div>
        <div style="margin-top:0.3rem;line-height:1.6">${cursosHTML}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;margin-left:0.5rem">
        <div style="font-size:0.9rem;font-weight:700;color:var(--blanco);font-family:'Inter',sans-serif">${asistidas}<span style="color:var(--blanco-suave);font-weight:400">/${contratadas}</span></div>
        <div style="font-size:0.7rem;color:var(--blanco-suave)">clases</div>
        <div style="margin-top:4px;height:3px;width:48px;background:rgba(255,255,255,0.08);border-radius:2px">
          <div style="height:100%;width:${pct}%;background:var(--gradiente-brand-90);border-radius:2px"></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ---- MODAL PERFIL ALUMNO ----
function abrirPerfilAlumno(alumnoId) {
  const a = profAlumnos.find(x => x.id === alumnoId);
  if (!a) return;

  const cursos      = a.cursosInscritos && a.cursosInscritos.length
    ? a.cursosInscritos
    : (a.curso ? a.curso.split(',').map(s => s.trim()).filter(Boolean) : []);
  const asistidas   = a.clasesAsistidas || 0;
  const contratadas = a.clasesContratadas || 0;
  const pct         = contratadas > 0 ? Math.round(asistidas / contratadas * 100) : 0;
  const racha       = a.racha || 0;

  const avatarHTML = a.fotoUrl
    ? `<div class="avatar avatar-xl" style="padding:0;overflow:hidden;margin:0 auto 0.8rem">
         <img src="${esc(a.fotoUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">
       </div>`
    : `<div class="avatar avatar-xl" style="margin:0 auto 0.8rem">${getInitials(a.nombre)}</div>`;

  const overlay = document.createElement('div');
  overlay.id = 'perfilAlumnoOverlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:200;
    background:rgba(10,5,15,0.97);
    overflow-y:auto;
    padding:1.2rem 1rem 6rem;
  `;

  overlay.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:0.8rem">
      <button onclick="cerrarPerfilAlumno()" style="
        background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);
        color:var(--blanco);width:36px;height:36px;border-radius:50%;
        font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center">
        &#x2715;
      </button>
    </div>

    <div style="text-align:center;margin-bottom:1.4rem">
      ${avatarHTML}
      <h2 style="margin:0 0 0.4rem;font-size:1.25rem;font-family:'Inter',sans-serif;color:var(--blanco)">${esc(a.nombre)}</h2>
      <span class="badge badge-gold">Alumno</span>
    </div>

    <div class="glass-card" style="padding:1rem;margin-bottom:0.8rem">
      <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;color:var(--blanco-suave);margin-bottom:0.6rem">Cursos</div>
      <div style="line-height:1.8">
        ${cursos.length
          ? cursos.map(c => `<span class="badge badge-gold" style="display:inline-block;margin:0.15rem">${esc(c)}</span>`).join('')
          : '<span class="text-muted" style="font-size:0.82rem">Sin cursos asignados</span>'}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.7rem;margin-bottom:0.8rem">
      <div class="glass-card" style="padding:1rem;text-align:center">
        <div style="font-size:1.5rem;font-weight:800;color:var(--blanco);font-family:'Inter',sans-serif">
          ${asistidas}<span style="font-size:0.8rem;color:var(--blanco-suave);font-weight:400">/${contratadas}</span>
        </div>
        <div style="font-size:0.7rem;color:var(--blanco-suave);margin-top:0.2rem">Clases</div>
        <div style="margin-top:0.5rem;height:4px;background:rgba(255,255,255,0.08);border-radius:2px">
          <div style="height:100%;width:${pct}%;background:var(--gradiente-brand-90);border-radius:2px"></div>
        </div>
      </div>
      <div class="glass-card" style="padding:1rem;text-align:center">
        <div style="font-size:1.5rem;font-weight:800;color:var(--naranja-claro);font-family:'Inter',sans-serif">&#128293; ${racha}</div>
        <div style="font-size:0.7rem;color:var(--blanco-suave);margin-top:0.2rem">Racha</div>
      </div>
    </div>

    ${a.telefono || a.email ? `
    <div class="glass-card" style="padding:1rem">
      <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;color:var(--blanco-suave);margin-bottom:0.6rem">Contacto</div>
      ${a.telefono ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0.45rem 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span style="font-size:0.78rem;color:var(--blanco-suave)">Teléfono</span>
        <span style="font-size:0.88rem;color:var(--blanco)">${esc(a.telefono)}</span>
      </div>` : ''}
      ${a.email ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0.45rem 0">
        <span style="font-size:0.78rem;color:var(--blanco-suave)">Email</span>
        <span style="font-size:0.82rem;color:var(--blanco);word-break:break-all;text-align:right;max-width:65%">${esc(a.email)}</span>
      </div>` : ''}
    </div>` : ''}
  `;

  // Cerrar al tocar el fondo (fuera del contenido)
  overlay.addEventListener('click', e => { if (e.target === overlay) cerrarPerfilAlumno(); });
  document.body.appendChild(overlay);
}

function cerrarPerfilAlumno() {
  const overlay = document.getElementById('perfilAlumnoOverlay');
  if (overlay) overlay.remove();
}

// ============================================
// TAB: CURSOS — alumnos por curso + asistencia
// ============================================
let cursoSeleccionado = null;
let sesionesPorAlumno = {}; // { alumnoId: maxNumeroClaseEnCursoSeleccionado }

async function renderCursosTab() {
  if (cursoSeleccionado === null && profMisCursos.length > 0) {
    cursoSeleccionado = profMisCursos[0];
  }
  renderCursosPills();
  await cargarSesionesYRenderizar();
}

async function cargarSesionesYRenderizar() {
  if (cursoSeleccionado) {
    try {
      sesionesPorAlumno = await ApiService._fetch(
        `/api/asistencia?curso=${encodeURIComponent(cursoSeleccionado)}`
      );
    } catch (e) {
      sesionesPorAlumno = {};
    }

    // Reconciliar localStorage con Airtable:
    // si un alumno aparece como marcado hoy pero no tiene sesión en Airtable
    // (p.ej. se borraron datos manualmente), limpiar la entrada local.
    try {
      const hoy    = new Date().toISOString().slice(0, 10);
      const stored = JSON.parse(localStorage.getItem('prof_asistencia') || '{}');
      if (stored.fecha === hoy && stored.data) {
        const sufijo = '_' + cursoSeleccionado;
        let changed  = false;
        Object.keys(stored.data).forEach(clave => {
          if (clave.endsWith(sufijo)) {
            const alumnoId = clave.slice(0, -sufijo.length);
            if (!sesionesPorAlumno[alumnoId]) {
              delete stored.data[clave];
              delete asistenciaHoy[clave];
              changed = true;
            }
          }
        });
        if (changed) localStorage.setItem('prof_asistencia', JSON.stringify(stored));
      }
    } catch (_) {}
  }
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
      cargarSesionesYRenderizar();
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
      const clave       = claveAsistencia(a.id, cursoSeleccionado);
      const estadoHoy   = asistenciaHoy[clave] || null; // 'asistio' | 'falto' | null
      const asistidas   = a.clasesAsistidas || 0;
      const contratadas = a.clasesContratadas || 0;
      // proxClase = sesiones ya registradas en este curso (asistencias + faltas) + 1
      const sesiones  = sesionesPorAlumno[a.id] || 0;
      const proxClase = sesiones + (estadoHoy ? 0 : 1);
      const racha       = a.racha || 0;
      const cursoEsc    = esc(cursoSeleccionado || '');

      const botonesHTML = estadoHoy
        ? `<button class="btn-asistencia ${estadoHoy === 'asistio' ? 'asistido' : 'btn-falta-marcada'}"
             id="btn-asist-${a.id}"
             onclick="desmarcarAsistencia('${a.id}', '${cursoEsc}')">
             ${estadoHoy === 'asistio'
               ? '&#x2714; #' + proxClase + ' &#x2715;'
               : '&#x2718; Falt&#243; &#x2715;'}
           </button>`
        : `<div class="btns-asistencia-grupo">
             <button class="btn-asistencia" id="btn-asist-${a.id}"
               onclick="marcarAsistencia('${a.id}', '${cursoEsc}', 'marcar')">
               Clase #${proxClase}
             </button>
             <button class="btn-falta" id="btn-falta-${a.id}"
               onclick="marcarAsistencia('${a.id}', '${cursoEsc}', 'falta')">
               &#x2718; Falt&#243;
             </button>
           </div>`;

      return `
      <div class="prof-alumno-card" id="card-${a.id}">
        <div class="avatar" style="flex-shrink:0">${getInitials(a.nombre)}</div>
        <div class="prof-alumno-info" style="flex:1;min-width:0">
          <div class="prof-alumno-nombre">${esc(a.nombre)}</div>
          <div class="prof-alumno-sub" id="clases-${a.id}">${asistidas}/${contratadas} &middot; Clase #${proxClase}</div>
          <div style="font-size:0.7rem;color:var(--naranja-claro)" id="racha-${a.id}">&#128293; Racha: ${racha}</div>
        </div>
        ${botonesHTML}
      </div>`;
    }).join('')}`;
}

async function marcarAsistencia(alumnoId, curso, accion) {
  const clave  = claveAsistencia(alumnoId, curso);
  const btnA   = document.getElementById(`btn-asist-${alumnoId}`);
  const btnF   = document.getElementById(`btn-falta-${alumnoId}`);
  if (btnA) { btnA.disabled = true; btnA.textContent = '...'; }
  if (btnF) { btnF.disabled = true; }

  try {
    const res = await ApiService._fetch('/api/asistencia', {
      method: 'POST',
      body: JSON.stringify({ alumnoId, accion, curso }),
    });

    const alumno = profAlumnos.find(a => a.id === alumnoId);
    if (alumno) {
      alumno.clasesAsistidas = res.clasesAsistidas;
      alumno.racha           = res.racha;
    }

    guardarAsistencia(alumnoId, curso, res.tipo);
    asistenciaHoy[clave] = res.tipo;
    // Actualizar sesiones locales para que el número de clase sea correcto
    if (sesionesPorAlumno[alumnoId] === undefined || res.numeroClase > sesionesPorAlumno[alumnoId]) {
      sesionesPorAlumno[alumnoId] = res.numeroClase || sesionesPorAlumno[alumnoId] || 0;
    }

    // Re-renderizar los botones de esta card
    actualizarBotonesCard(alumnoId, curso, res.tipo, alumno, res);

    const msg = accion === 'falta'
      ? `Falta registrada — ${esc(curso)}`
      : `Clase #${res.numeroClase || ''} — ${esc(curso)} registrada`;
    showToast(msg, accion === 'falta');

  } catch (e) {
    if (btnA) { btnA.disabled = false; const a = profAlumnos.find(x => x.id === alumnoId); btnA.innerHTML = 'Clase #' + ((a ? a.clasesAsistidas : 0) + 1); }
    if (btnF) { btnF.disabled = false; }
    const msg = e.message && (e.message.includes('Ya registrado') || e.message.includes('409'))
      ? 'Ya registrado hoy para este curso'
      : 'Error al registrar';
    showToast(msg, true);
  }
}

async function desmarcarAsistencia(alumnoId, curso) {
  const btn = document.getElementById(`btn-asist-${alumnoId}`);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  try {
    const res = await ApiService._fetch('/api/asistencia', {
      method: 'POST',
      body: JSON.stringify({ alumnoId, accion: 'desmarcar', curso }),
    });

    const alumno = profAlumnos.find(a => a.id === alumnoId);
    if (alumno) {
      alumno.clasesAsistidas = res.clasesAsistidas;
      alumno.racha           = res.racha;
    }

    const clave = claveAsistencia(alumnoId, curso);
    guardarAsistencia(alumnoId, curso, null);
    asistenciaHoy[clave] = null;

    // Decrementar sesiones locales para que el número de clase vuelva al anterior
    if (sesionesPorAlumno[alumnoId] !== undefined) {
      sesionesPorAlumno[alumnoId] = Math.max(0, sesionesPorAlumno[alumnoId] - 1);
    }

    actualizarBotonesCard(alumnoId, curso, null, alumno, res);
    showToast('Registro eliminado');

  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '&#x2715;'; }
    showToast('Error al desmarcar', true);
  }
}

function actualizarBotonesCard(alumnoId, curso, tipo, alumno, res) {
  const card = document.getElementById(`card-${alumnoId}`);
  if (!card) return;

  const asistidas = alumno ? alumno.clasesAsistidas : 0;
  const sesiones  = sesionesPorAlumno[alumnoId] || 0;
  const proxClase = sesiones + (tipo ? 0 : 1);
  // Para el botón marcado se usa el número de clase del curso (sesiones), no el total
  const claseNum  = sesiones;
  const cursoEsc    = esc(curso || '');

  // Zona de botones (último elemento del card)
  const zonaBtn = card.querySelector('.btns-asistencia-grupo') || card.querySelector('.btn-asistencia') || card.querySelector('.btn-falta-marcada');
  if (!zonaBtn) return;

  let nuevoHTML;
  if (tipo) {
    nuevoHTML = `<button class="btn-asistencia ${tipo === 'asistio' ? 'asistido' : 'btn-falta-marcada'}"
       id="btn-asist-${alumnoId}"
       onclick="desmarcarAsistencia('${alumnoId}', '${cursoEsc}')">
       ${tipo === 'asistio'
         ? '&#x2714; #' + claseNum + ' &#x2715;'
         : '&#x2718; Falt&#243; &#x2715;'}
     </button>`;
  } else {
    nuevoHTML = `<div class="btns-asistencia-grupo">
       <button class="btn-asistencia" id="btn-asist-${alumnoId}"
         onclick="marcarAsistencia('${alumnoId}', '${cursoEsc}', 'marcar')">
         Clase #${proxClase}
       </button>
       <button class="btn-falta" id="btn-falta-${alumnoId}"
         onclick="marcarAsistencia('${alumnoId}', '${cursoEsc}', 'falta')">
         &#x2718; Falt&#243;
       </button>
     </div>`;
  }

  zonaBtn.outerHTML = nuevoHTML;

  // Actualizar subtítulo y racha
  const clasesTxt = document.getElementById(`clases-${alumnoId}`);
  if (clasesTxt) clasesTxt.innerHTML = `${asistidas}/${alumno ? alumno.clasesContratadas || 0 : 0} &middot; Clase #${proxClase}`;

  const rachaEl = document.getElementById(`racha-${alumnoId}`);
  if (rachaEl) rachaEl.innerHTML = '&#128293; Racha: ' + (alumno ? alumno.racha || 0 : 0);
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

async function renderCalendarioProfesor() {
  const grid = document.getElementById('profCalGrid');
  if (!grid) return;

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const HORARIO = {
    0: { color: '#a855f7' },
    1: { color: '#3b82f6' },
    2: { color: '#06b6d4' },
    3: { color: '#f59e0b' },
    4: { color: '#ec4899' },
  };

  const now       = new Date();
  const year      = now.getFullYear();
  const month     = now.getMonth();
  const hoy       = now.getDate();
  const primerDia = (new Date(year, month, 1).getDay() + 6) % 7;
  const diasEnMes = new Date(year, month + 1, 0).getDate();

  const tituloEl = document.getElementById('profCalTitulo');
  if (tituloEl) tituloEl.textContent = MESES[month] + ' ' + year;

  // Cargar cumpleaños
  let cumplesPorDia = {};
  let todosCumples  = [];
  try {
    todosCumples = await ApiService._fetch('/api/companeros?tipo=cumpleanos');
    todosCumples.filter(c => c.mes === month + 1).forEach(c => {
      if (!cumplesPorDia[c.dia]) cumplesPorDia[c.dia] = [];
      cumplesPorDia[c.dia].push(c.nombre);
    });
  } catch (e) { /* ignorar */ }

  // Renderizar grid
  let html = '';
  for (let v = 0; v < primerDia; v++) html += '<div></div>';

  for (let d = 1; d <= diasEnMes; d++) {
    const diaSemana   = (new Date(year, month, d).getDay() + 6) % 7;
    const clase       = HORARIO[diaSemana];
    const esHoy       = d === hoy;
    const cumples     = cumplesPorDia[d] || [];
    const tieneCumple = cumples.length > 0;

    html += `<div title="${tieneCumple ? '🎂 ' + cumples.join(', ') : ''}" style="
      text-align:center;padding:0.3rem 0;border-radius:6px;
      font-size:0.72rem;font-family:'Inter',sans-serif;
      font-weight:${esHoy ? '700' : '400'};
      color:${esHoy ? '#fff' : (clase || tieneCumple) ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)'};
      background:${esHoy ? 'var(--morado)' : 'transparent'};
    ">
      ${d}
      <div style="display:flex;justify-content:center;gap:1px;margin-top:1px;min-height:6px">
        ${clase ? `<div style="width:5px;height:5px;border-radius:50%;background:${clase.color}"></div>` : ''}
        ${tieneCumple ? '<div style="font-size:0.6rem;line-height:1">🎂</div>' : ''}
      </div>
    </div>`;
  }

  grid.innerHTML = html;

  // Renderizar lista de cumpleaños próximos
  const listaCumpleEl = document.getElementById('profCumpleanerosMes');
  if (!listaCumpleEl) return;

  // Ordenar por proximidad: primero los que faltan (dia >= hoy), luego los ya pasados
  const delMes = todosCumples
    .filter(c => c.mes === month + 1)
    .sort((a, b) => {
      const distA = a.dia >= hoy ? a.dia - hoy : diasEnMes - hoy + a.dia;
      const distB = b.dia >= hoy ? b.dia - hoy : diasEnMes - hoy + b.dia;
      return distA - distB;
    });

  if (delMes.length === 0) {
    listaCumpleEl.innerHTML = `
      <div class="glass-card" style="margin-top:1rem;padding:1rem;text-align:center">
        <p class="text-muted" style="font-size:0.82rem;margin:0">Sin cumpleaños este mes</p>
      </div>`;
    return;
  }

  listaCumpleEl.innerHTML = `
    <div class="glass-card" style="margin-top:1rem;padding:1rem">
      <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;color:var(--blanco-suave);margin-bottom:0.8rem">
        Cumpleaños del mes
      </div>
      ${delMes.map(c => {
        const esHoyBd = c.dia === hoy;
        const yaFue   = c.dia < hoy;
        return `
        <div style="display:flex;align-items:center;gap:0.7rem;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.05)">
          <span style="font-size:1rem">${esHoyBd ? '🎉' : '🎂'}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.88rem;font-weight:600;color:${esHoyBd ? 'var(--naranja-claro)' : yaFue ? 'rgba(255,255,255,0.4)' : 'var(--blanco)'};
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${esc(c.nombre)}
            </div>
            <div style="font-size:0.72rem;color:var(--blanco-suave)">
              ${c.dia} de ${MESES[month]}${esHoyBd ? ' — ¡Hoy!' : ''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

// ============================================
// FOTO PERFIL
// ============================================
// ── CLOUDINARY CONFIG (profesor) ──────────────────────────────────────────
const PROF_CLOUDINARY_CLOUD_NAME    = 'debpk4syz';
const PROF_CLOUDINARY_UPLOAD_PRESET = 'fotos al paso';

function setupFoto() {
  const btn = document.getElementById('profFotoBtn');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();

    if (typeof cloudinary !== 'undefined') {
      const widget = cloudinary.createUploadWidget(
        {
          cloudName:             PROF_CLOUDINARY_CLOUD_NAME,
          uploadPreset:          PROF_CLOUDINARY_UPLOAD_PRESET,
          sources:               ['local', 'camera'],
          multiple:              false,
          cropping:              true,
          croppingAspectRatio:   1,
          croppingShowDimensions: true,
          maxFileSize:           5000000,
          folder:                'al-paso-perfiles',
          clientAllowedFormats:  ['jpg', 'jpeg', 'png', 'webp'],
          styles: {
            palette: {
              window:          '#140A18',
              windowBorder:    '#430440',
              tabIcon:         '#D4AF37',
              menuIcons:       '#D4AF37',
              textDark:        '#FFFFFF',
              textLight:       '#FFFFFF',
              link:            '#D4AF37',
              action:          '#430440',
              inactiveTabIcon: '#8A8A8A',
              error:           '#FF4444',
              inProgress:      '#430440',
              complete:        '#33AB2E',
              sourceBg:        '#1F1228',
            },
          },
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
let feedbackBtnInit = false;

async function setupFeedbackTab() {
  const select = document.getElementById('fbAlumnoSelect');
  if (!select) return;

  // Registrar boton guardar solo una vez
  if (!feedbackBtnInit) {
    feedbackBtnInit = true;
    const now = new Date();
    const mesSelect = document.getElementById('fbMesSelect');
    if (mesSelect) mesSelect.value = String(now.getMonth() + 1);
    const btn = document.getElementById('btnGuardarFeedback');
    if (btn) btn.addEventListener('click', guardarFeedback);
  }

  // Si profAlumnos está vacío, cargar todos los alumnos desde la API
  let lista = profAlumnos;
  if (lista.length === 0) {
    try {
      const todos = await ApiService.getAlumnos();
      lista = todos.filter(a => (a.role || 'alumno') === 'alumno');
      profAlumnos = lista;
    } catch (e) {
      lista = [];
    }
  }

  // Limpiar y repoblar select
  select.innerHTML = '<option value="">— Selecciona alumno —</option>';
  lista
    .slice()
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
    .forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.nombre + (a.cursosInscritos && a.cursosInscritos.length ? ' — ' + a.cursosInscritos[0] : '');
      select.appendChild(opt);
    });
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

// ============================================
// RENOVACION AUTOMATICA A MEDIANOCHE
// ============================================
function programarRenovacionMedianoche() {
  const ahora   = new Date();
  const manana  = new Date(ahora);
  manana.setDate(manana.getDate() + 1);
  manana.setHours(0, 0, 5, 0); // 00:00:05 del día siguiente
  const msHasta = manana - ahora;

  setTimeout(() => {
    // Nuevo día: reiniciar estados de asistencia
    asistenciaHoy = {};
    // Si el tab de cursos está visible, re-renderizarlo
    const tabCursos = document.getElementById('tab-cursos');
    if (tabCursos && tabCursos.classList.contains('active')) {
      renderAlumnosCurso();
    }
    showToast('Nuevo día — botones de asistencia renovados');
    // Programar el siguiente día
    programarRenovacionMedianoche();
  }, msHasta);
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
