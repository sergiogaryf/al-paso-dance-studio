/**
 * POST /api/asistencia  { alumnoId, accion, curso }
 *   accion = 'marcar' | 'desmarcar'
 *   Registra en tabla Asistencias + actualiza ClasesAsistidas y Racha en Alumnos
 *
 * GET /api/asistencia?alumnoId=X&fecha=YYYY-MM-DD
 *   Verifica si el alumno ya tiene asistencia registrada para esa fecha
 */
const { tables, findAll, findById, createRecord, updateRecord, deleteRecord } = require('./_lib/airtable');
const { verifyToken } = require('./_lib/auth');

// Dias de la semana en español → índice JS (0=Domingo)
const DIAS_IDX = {
  Domingo: 0, Lunes: 1, Martes: 2, Miercoles: 3,
  Jueves: 4, Viernes: 5, Sabado: 6,
};

module.exports = async function handler(req, res) {
  const user = verifyToken(req);
  if (!user || !['admin', 'profesor'].includes(user.role)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  // ── GET: verificar asistencia de un alumno en una fecha ─────────────────
  if (req.method === 'GET') {
    const { alumnoId, fecha } = req.query;
    if (!alumnoId || !fecha) {
      return res.status(400).json({ error: 'alumnoId y fecha son requeridos' });
    }
    try {
      const registros = await findAll(
        tables.asistencias,
        `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${fecha}')`
      );
      return res.status(200).json({ marcado: registros.length > 0, registros: registros.length });
    } catch (e) {
      return res.status(500).json({ error: 'Error al consultar asistencia' });
    }
  }

  // ── POST: marcar / desmarcar ─────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const { alumnoId, accion, curso } = req.body || {};
  if (!alumnoId) return res.status(400).json({ error: 'alumnoId es requerido' });

  const hoy = new Date().toISOString().slice(0, 10);

  try {
    const alumno = await findById(tables.alumnos, alumnoId);

    // ── DESMARCAR ─────────────────────────────────────────────────────────
    if (accion === 'desmarcar') {
      const filter = curso
        ? `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${hoy}', {Curso} = '${curso.replace(/'/g, "\\'")}')`
        : `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${hoy}')`;

      const registros = await findAll(tables.asistencias, filter);
      for (const r of registros) await deleteRecord(tables.asistencias, r.id);

      const nuevasClases = Math.max(0, (alumno.ClasesAsistidas || 0) - registros.length);
      const nuevaRacha   = Math.max(0, (alumno.Racha || 0) - registros.length);
      await updateRecord(tables.alumnos, alumnoId, {
        ClasesAsistidas: nuevasClases,
        Racha: nuevaRacha,
      });

      return res.status(200).json({ ok: true, clasesAsistidas: nuevasClases, racha: nuevaRacha });
    }

    // ── MARCAR ────────────────────────────────────────────────────────────
    // Verificar si ya está marcado hoy para este alumno+curso
    const filtroYaMarcado = curso
      ? `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${hoy}', {Curso} = '${curso.replace(/'/g, "\\'")}')`
      : `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${hoy}')`;

    const yaMarcados = await findAll(tables.asistencias, filtroYaMarcado);
    if (yaMarcados.length > 0) {
      return res.status(409).json({ error: 'Ya marcado hoy para este curso' });
    }

    const numeroClase = (alumno.ClasesAsistidas || 0) + 1;

    // Crear registro de asistencia
    await createRecord(tables.asistencias, {
      AlumnoId:     alumnoId,
      AlumnoNombre: alumno.Nombre || '',
      Curso:        curso || '',
      NumeroClase:  numeroClase,
      Fecha:        hoy,
    });

    // Calcular nueva racha
    const nuevaRacha = await calcularRacha(alumnoId, alumno, curso, hoy);

    const nuevasClases = numeroClase;
    await updateRecord(tables.alumnos, alumnoId, {
      ClasesAsistidas: nuevasClases,
      Racha: nuevaRacha,
    });

    return res.status(200).json({ ok: true, clasesAsistidas: nuevasClases, racha: nuevaRacha, numeroClase });

  } catch (error) {
    console.error('Error en asistencia:', error);
    return res.status(500).json({ error: 'Error al registrar asistencia' });
  }
};

/**
 * Calcula la racha del alumno.
 * Busca el día de clase inmediatamente anterior a hoy en cualquiera de sus cursos.
 * Si ese día tiene asistencia registrada → racha sube; si no → racha se reinicia a 1.
 */
async function calcularRacha(alumnoId, alumno, cursoHoy, hoy) {
  try {
    // Obtener cursos del alumno
    let cursosAlumno = [];
    if (alumno.Curso) {
      cursosAlumno = alumno.Curso.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (!cursosAlumno.length && cursoHoy) cursosAlumno = [cursoHoy];
    if (!cursosAlumno.length) return 1;

    // Obtener clases activas de esos cursos para saber los días de la semana
    const todasClases = await findAll(tables.clases, '{Activo} = TRUE()');
    const diasClase = []; // índices de día de la semana (0=Dom)
    todasClases.forEach(c => {
      const nombreCurso = (c.Nombre || '').toLowerCase();
      const coincide = cursosAlumno.some(cu => nombreCurso.includes(cu.toLowerCase()) || cu.toLowerCase().includes(nombreCurso));
      if (coincide && c.Dia && DIAS_IDX[c.Dia] !== undefined) {
        diasClase.push(DIAS_IDX[c.Dia]);
      }
    });

    if (diasClase.length === 0) return 1; // Sin horario definido → racha = 1

    // Encontrar el día de clase anterior a hoy (hasta 14 días atrás)
    const hoyDate = new Date(hoy + 'T12:00:00');
    let diaAnterior = null;
    for (let i = 1; i <= 14; i++) {
      const d = new Date(hoyDate);
      d.setDate(hoyDate.getDate() - i);
      if (diasClase.includes(d.getDay())) {
        diaAnterior = d.toISOString().slice(0, 10);
        break;
      }
    }

    if (!diaAnterior) return 1; // No hay clase anterior en los últimos 14 días

    // Verificar si asistió ese día anterior
    const asistenciaAnterior = await findAll(
      tables.asistencias,
      `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${diaAnterior}')`
    );

    if (asistenciaAnterior.length > 0) {
      // Asistió el día anterior → racha sigue
      return (alumno.Racha || 0) + 1;
    } else {
      // Faltó el día anterior → racha se reinicia
      return 1;
    }
  } catch (e) {
    console.error('Error calculando racha:', e);
    return (alumno.Racha || 0) + 1; // En caso de error, no penalizar
  }
}
