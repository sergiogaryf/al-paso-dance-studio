/* ============================================
   ESTACION SALSERA - Evaluacion JS
   Sistema de evaluacion de clases
   ============================================ */

// ---- ESTADO ----
let alumnoSesion = null;   // { nombre, curso, pin }
let profesorLogueado = false;
let evaluacionesCache = [];

// ---- NAVEGACION DE VISTAS ----
function irA(vistaId) {
  document.querySelectorAll('.eval-vista').forEach(v => v.classList.remove('active'));
  document.getElementById(vistaId).classList.add('active');
  window.scrollTo(0, 0);
}

// ---- TOAST ----
function showToastEval(message, type = 'info') {
  const container = document.getElementById('evalToastContainer');
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

// ---- ERRORES ----
function mostrarError(elementId, msg) {
  const el = document.getElementById(elementId);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function ocultarError(elementId) {
  document.getElementById(elementId).classList.add('hidden');
}

// ---- BTN LOADING ----
function setBtnLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ============================
//  SELECTOR DE ROL
// ============================
function setupRolSelector() {
  document.getElementById('btnRolAlumno').addEventListener('click', () => {
    irA('vistaLoginAlumno');
  });
  document.getElementById('btnRolProfesor').addEventListener('click', () => {
    irA('vistaLoginProfesor');
  });
  document.getElementById('btnVolver1').addEventListener('click', () => {
    irA('vistaSelector');
  });
  document.getElementById('btnVolver2').addEventListener('click', () => {
    irA('vistaSelector');
  });
  document.getElementById('btnVolverInicio').addEventListener('click', () => {
    alumnoSesion = null;
    document.getElementById('formLoginAlumno').reset();
    document.getElementById('formEvaluacion').reset();
    resetFormularioAlumno();
    irA('vistaSelector');
  });
}

// ============================
//  LOGIN ALUMNO
// ============================
function setupLoginAlumno() {
  document.getElementById('formLoginAlumno').addEventListener('submit', (e) => {
    e.preventDefault();
    ocultarError('errorAlumnoLogin');

    const nombre = document.getElementById('evalNombreAlumno').value.trim();
    const curso = document.getElementById('evalCursoAlumno').value;
    const pin = document.getElementById('evalPinAlumno').value;

    if (!nombre || !curso || pin.length !== 4) {
      mostrarError('errorAlumnoLogin', 'Completa todos los campos. El PIN debe tener 4 digitos.');
      return;
    }

    alumnoSesion = { nombre, curso, pin };
    document.getElementById('evalAlumnoNombreMostrar').textContent = nombre;
    document.getElementById('evalAlumnoCursoMostrar').textContent = curso;
    irA('vistaFormAlumno');
  });
}

// ============================
//  FORMULARIO EVALUACION
// ============================
function setupFormEvaluacion() {
  // Sliders: actualizar valor en tiempo real
  ['evalDisfrute', 'evalComprension', 'evalComodidad', 'evalConfianza'].forEach(id => {
    const input = document.getElementById(id);
    const display = document.getElementById(id + 'Val');
    input.addEventListener('input', () => {
      display.textContent = input.value;
    });
  });

  // Seleccion de clase (1-4)
  document.querySelectorAll('.eval-clase-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.eval-clase-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Binaria Si/No
  document.getElementById('evalBaileSi').addEventListener('click', () => {
    document.getElementById('evalBaileSi').classList.add('selected-si');
    document.getElementById('evalBaileNo').classList.remove('selected-no');
  });
  document.getElementById('evalBaileNo').addEventListener('click', () => {
    document.getElementById('evalBaileNo').classList.add('selected-no');
    document.getElementById('evalBaileSi').classList.remove('selected-si');
  });

  // Submit
  document.getElementById('formEvaluacion').addEventListener('submit', async (e) => {
    e.preventDefault();
    await enviarEvaluacion();
  });
}

function resetFormularioAlumno() {
  document.querySelectorAll('.eval-clase-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('evalBaileSi').classList.remove('selected-si');
  document.getElementById('evalBaileNo').classList.remove('selected-no');
  ['evalDisfrute', 'evalComprension', 'evalComodidad', 'evalConfianza'].forEach(id => {
    document.getElementById(id).value = 5;
    document.getElementById(id + 'Val').textContent = '5';
  });
  ocultarError('errorEvaluacion');
}

async function enviarEvaluacion() {
  ocultarError('errorEvaluacion');

  const claseSeleccionada = document.querySelector('.eval-clase-btn.selected');
  if (!claseSeleccionada) {
    mostrarError('errorEvaluacion', 'Selecciona el numero de clase.');
    return;
  }

  const tieneSi = document.getElementById('evalBaileSi').classList.contains('selected-si');
  const tieneNo = document.getElementById('evalBaileNo').classList.contains('selected-no');
  if (!tieneSi && !tieneNo) {
    mostrarError('errorEvaluacion', 'Indica si bailaste con alguien nuevo.');
    return;
  }

  const payload = {
    nombreAlumno: alumnoSesion.nombre,
    curso: alumnoSesion.curso,
    pinAlumno: alumnoSesion.pin,
    numeroClase: parseInt(claseSeleccionada.dataset.clase),
    disfrute: parseInt(document.getElementById('evalDisfrute').value),
    comprension: parseInt(document.getElementById('evalComprension').value),
    comodidadPareja: parseInt(document.getElementById('evalComodidad').value),
    confianza: parseInt(document.getElementById('evalConfianza').value),
    baileNuevo: tieneSi,
    comentario: document.getElementById('evalComentario').value.trim(),
  };

  try {
    setBtnLoading('btnSubmitEval', true);
    const res = await fetch('/api/evaluaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.status === 409) {
      mostrarError('errorEvaluacion', data.error || 'Ya enviaste tu evaluacion hoy.');
      return;
    }
    if (res.status === 401) {
      mostrarError('errorEvaluacion', data.error || 'PIN incorrecto.');
      return;
    }
    if (!res.ok) {
      mostrarError('errorEvaluacion', data.error || 'Error al enviar. Intenta de nuevo.');
      return;
    }

    irA('vistaExitoAlumno');
  } catch (err) {
    mostrarError('errorEvaluacion', 'Error de conexion. Verifica tu internet.');
  } finally {
    setBtnLoading('btnSubmitEval', false);
  }
}

// ============================
//  LOGIN PROFESOR
// ============================
function setupLoginProfesor() {
  document.getElementById('formLoginProfesor').addEventListener('submit', (e) => {
    e.preventDefault();
    ocultarError('errorProfesor');

    const pin = document.getElementById('evalPinProfesor').value;
    if (pin === '1234') {
      profesorLogueado = true;
      irA('vistaDashboard');
      cargarDashboard();
    } else {
      mostrarError('errorProfesor', 'PIN incorrecto.');
    }
  });

  document.getElementById('btnCerrarSesionProf').addEventListener('click', () => {
    profesorLogueado = false;
    evaluacionesCache = [];
    document.getElementById('evalPinProfesor').value = '';
    irA('vistaSelector');
  });
}

// ============================
//  TABS PROFESOR
// ============================
function setupTabsProfesor() {
  document.querySelectorAll('.eval-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.eval-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.eval-tab-section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.etab).classList.add('active');

      // Cargar historial al acceder al tab
      if (tab.dataset.etab === 'etab-historial') {
        renderHistorial();
      }
    });
  });
}

// ============================
//  DASHBOARD PROFESOR
// ============================
async function cargarDashboard() {
  try {
    const res = await fetch('/api/evaluaciones', {
      headers: { 'X-Eval-Pin': '1234' }
    });
    if (!res.ok) throw new Error('Error cargando datos');
    evaluacionesCache = await res.json();
    renderDashboard(evaluacionesCache);
  } catch (err) {
    console.error('Error cargando dashboard:', err);
    showToastEval('Error al cargar datos', 'error');
  }
}

function renderDashboard(evaluaciones) {
  const cursoFiltro = document.getElementById('evalFiltroCurso').value;
  const filtradas = cursoFiltro
    ? evaluaciones.filter(e => e.Curso === cursoFiltro)
    : evaluaciones;

  // Stats
  const total = filtradas.length;
  const alumnosUnicos = new Set(filtradas.map(e => e.NombreAlumno + '|' + e.Curso)).size;
  const porcentajeBaileNuevo = filtradas.length
    ? Math.round(filtradas.filter(e => e.BaileNuevo).length / filtradas.length * 100)
    : 0;

  document.getElementById('evalStatTotal').textContent = total;
  document.getElementById('evalStatAlumnos').textContent = alumnosUnicos;
  document.getElementById('evalStatBaileNuevo').textContent = porcentajeBaileNuevo + '%';

  // Promedios
  const promedio = (campo) => filtradas.length
    ? (filtradas.reduce((a, e) => a + (parseFloat(e[campo]) || 0), 0) / filtradas.length).toFixed(1)
    : '0';

  const metricas = ['Disfrute', 'Comprension', 'ComodidadPareja', 'Confianza'];
  metricas.forEach(m => {
    const prom = promedio(m);
    document.getElementById('evalProm' + m).textContent = prom;
    document.getElementById('evalBarra' + m).style.width = (parseFloat(prom) / 10 * 100) + '%';
  });

  // Grafica SVG
  renderGraficaSVG(filtradas);

  // Comentarios
  const comentarios = filtradas
    .filter(e => e.Comentario)
    .sort((a, b) => (b.FechaHoraISO || '').localeCompare(a.FechaHoraISO || ''))
    .slice(0, 5);

  const contenedor = document.getElementById('evalComentarios');
  if (comentarios.length === 0) {
    contenedor.innerHTML = '<p class="text-muted">Sin comentarios aun.</p>';
  } else {
    contenedor.innerHTML = comentarios.map(e => {
      const nombre = sanitize(e.NombreAlumno || '');
      const comentario = sanitize(e.Comentario || '');
      const curso = sanitize(e.Curso || '');
      return `<div class="eval-comentario-item glass-card">
        <div class="eval-comentario-header">
          <span class="text-gold">${nombre}</span>
          <span class="badge badge-gold">${curso}</span>
        </div>
        <p class="text-muted">"${comentario}"</p>
      </div>`;
    }).join('');
  }
}

function renderGraficaSVG(evaluaciones) {
  const container = document.getElementById('evalGrafica');

  // Agrupar por NumeroClase
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

  const W = 300;
  const H = 140;
  const PAD = 30;
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
        <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${guias}
      <polygon points="${polygon}" fill="url(#goldGrad)"/>
      <polyline points="${polyline}" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${puntos}
    </svg>`;
}

// ============================
//  OBSERVACION PROFESOR
// ============================
function setupFormObservacion() {
  // Fecha por defecto: hoy
  document.getElementById('obsFecha').value = new Date().toISOString().slice(0, 10);

  // Estrellas
  document.querySelectorAll('.eval-estrellas-grupo').forEach(grupo => {
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

  // Submit
  document.getElementById('formObservacion').addEventListener('submit', async (e) => {
    e.preventDefault();
    await guardarObservacion();
  });
}

async function guardarObservacion() {
  const curso = document.getElementById('obsCurso').value;
  if (!curso) {
    showToastEval('Selecciona un curso', 'error');
    return;
  }

  const payload = {
    Curso: curso,
    NumeroClase: parseInt(document.getElementById('obsClase').value),
    Fecha: document.getElementById('obsFecha').value,
    ObjetivoDelDia: document.getElementById('obsObjetivo').value.trim(),
    PasosTrabajados: document.getElementById('obsPasos').value.trim(),
    EstrellaParticipacion: parseInt(document.getElementById('obsEstrellasParticipacion').dataset.valor) || 0,
    EstrellaComprension: parseInt(document.getElementById('obsEstrellasComprension').dataset.valor) || 0,
    EstrellaConexion: parseInt(document.getElementById('obsEstrellasConexion').dataset.valor) || 0,
    EstrellaEnergia: parseInt(document.getElementById('obsEstrellasEnergia').dataset.valor) || 0,
    LogrosDelDia: document.getElementById('obsLogros').value.trim(),
    DificultadesDetectadas: document.getElementById('obsDificultades').value.trim(),
    AjustesProximaClase: document.getElementById('obsAjustes').value.trim(),
    Notas: document.getElementById('obsNotas').value.trim(),
  };

  try {
    setBtnLoading('btnSubmitObs', true);
    const res = await fetch('/api/observaciones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Eval-Pin': '1234'
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error();

    showToastEval('Observacion guardada correctamente', 'success');
    document.getElementById('formObservacion').reset();
    document.getElementById('obsFecha').value = new Date().toISOString().slice(0, 10);
    // Reset estrellas
    document.querySelectorAll('.eval-estrellas-grupo').forEach(g => {
      g.dataset.valor = '0';
      g.querySelectorAll('.eval-estrella').forEach(s => s.classList.remove('activa'));
    });
  } catch (err) {
    showToastEval('Error al guardar observacion', 'error');
  } finally {
    setBtnLoading('btnSubmitObs', false);
  }
}

// ============================
//  HISTORIAL
// ============================
function renderHistorial() {
  // Resumen por curso
  const cursos = ['Bachata Basico', 'Casino Basico', 'Bachata Intermedio', 'Casino Intermedio', 'Mambo Open'];
  const tbody = document.getElementById('tbodyResumen');
  tbody.innerHTML = cursos.map(c => {
    const evCurso = evaluacionesCache.filter(e => e.Curso === c);
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
  const ultimas = [...evaluacionesCache]
    .sort((a, b) => (b.FechaHoraISO || '').localeCompare(a.FechaHoraISO || ''))
    .slice(0, 10);

  const lista = document.getElementById('listaUltimasEval');
  if (ultimas.length === 0) {
    lista.innerHTML = '<p class="text-muted">No hay evaluaciones aun.</p>';
  } else {
    lista.innerHTML = ultimas.map(e => {
      const promedio = ((parseFloat(e.Disfrute || 0) + parseFloat(e.Comprension || 0) +
        parseFloat(e.ComodidadPareja || 0) + parseFloat(e.Confianza || 0)) / 4).toFixed(1);
      return `<div class="eval-ultima-card">
        <div class="eval-ultima-info">
          <span class="eval-ultima-nombre">${sanitize(e.NombreAlumno || '')}</span>
          <span class="eval-ultima-curso">${sanitize(e.Curso || '')} - Clase ${e.NumeroClase || '?'}</span>
        </div>
        <span class="eval-ultima-score">${promedio}</span>
      </div>`;
    }).join('');
  }
}

// ============================
//  EXPORTAR CSV
// ============================
function exportarCSV() {
  if (evaluacionesCache.length === 0) {
    showToastEval('No hay datos para exportar', 'error');
    return;
  }

  const headers = ['Nombre', 'Curso', 'Clase', 'Disfrute', 'Comprension', 'Comodidad en Pareja', 'Confianza', 'Bailo con alguien nuevo', 'Comentario', 'Fecha'];
  const filas = evaluacionesCache.map(e => [
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
  showToastEval('CSV descargado', 'success');
}

// ============================
//  UTILIDADES
// ============================
function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================
//  INIT
// ============================
document.addEventListener('DOMContentLoaded', () => {
  setupRolSelector();
  setupLoginAlumno();
  setupFormEvaluacion();
  setupLoginProfesor();
  setupTabsProfesor();
  setupFormObservacion();

  // Filtro de dashboard
  document.getElementById('evalFiltroCurso').addEventListener('change', () => {
    renderDashboard(evaluacionesCache);
  });

  // Exportar CSV
  document.getElementById('btnExportarCSV').addEventListener('click', exportarCSV);
});
