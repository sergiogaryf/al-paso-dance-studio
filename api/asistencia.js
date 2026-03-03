/**
 * POST /api/asistencia  { alumnoId, accion, curso }
 *   accion = 'marcar' | 'falta' | 'desmarcar'
 *   Registra en tabla Asistencias (campo Tipo: 'asistio'|'falto')
 *   + actualiza ClasesAsistidas y Racha en Alumnos
 *
 * GET /api/asistencia?alumnoId=X&fecha=YYYY-MM-DD
 *   Retorna { tipo: 'asistio'|'falto'|null } para esa fecha
 */
const { tables, findAll, findById, createRecord, updateRecord, deleteRecord } = require('./_lib/airtable');
const { verifyToken } = require('./_lib/auth');

const DIAS_IDX = {
  Domingo: 0, Lunes: 1, Martes: 2, Miercoles: 3,
  Jueves: 4, Viernes: 5, Sabado: 6,
};

module.exports = async function handler(req, res) {
  const user = verifyToken(req);
  if (!user || !['admin', 'profesor'].includes(user.role)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { alumnoId, fecha, curso } = req.query;

    // ?curso=X → devuelve { alumnoId: sesionesEnCurso } para calcular proxClase
    if (curso && !alumnoId) {
      try {
        const cursoS = curso.replace(/'/g, "\\'");
        const registros = await findAll(
          tables.asistencias,
          `{Curso} = '${cursoS}'`
        );
        // Para cada alumno, el número de sesiones = max(NumeroClase) registrado
        const sesiones = {};
        registros.forEach(r => {
          const aid = r.AlumnoId;
          const num = r.NumeroClase || 0;
          if (!sesiones[aid] || num > sesiones[aid]) sesiones[aid] = num;
        });
        return res.status(200).json(sesiones);
      } catch (e) {
        return res.status(500).json({ error: 'Error al consultar sesiones' });
      }
    }

    // ?alumnoId=X&fecha=Y → estado de ese alumno en esa fecha
    if (!alumnoId || !fecha) {
      return res.status(400).json({ error: 'alumnoId y fecha son requeridos' });
    }
    try {
      const registros = await findAll(
        tables.asistencias,
        `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${fecha}')`
      );
      const tipo = registros.length > 0 ? (registros[0].Tipo || 'asistio') : null;
      return res.status(200).json({ tipo });
    } catch (e) {
      return res.status(500).json({ error: 'Error al consultar asistencia' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const { alumnoId, accion, curso } = req.body || {};
  if (!alumnoId) return res.status(400).json({ error: 'alumnoId es requerido' });

  const hoy    = new Date().toISOString().slice(0, 10);
  const cursoS = (curso || '').replace(/'/g, "\\'");

  try {
    const alumno = await findById(tables.alumnos, alumnoId);

    // ── DESMARCAR (borra cualquier registro de hoy) ───────────────────────
    if (accion === 'desmarcar') {
      const filter = curso
        ? `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${hoy}', {Curso} = '${cursoS}')`
        : `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${hoy}')`;

      const registros = await findAll(tables.asistencias, filter);
      const eraAsistio = registros.some(r => (r.Tipo || 'asistio') === 'asistio');

      for (const r of registros) await deleteRecord(tables.asistencias, r.id);

      // Solo restar ClasesAsistidas si era un registro de asistencia (no falta)
      const nuevasClases = eraAsistio
        ? Math.max(0, (alumno.ClasesAsistidas || 0) - 1)
        : (alumno.ClasesAsistidas || 0);
      const nuevaRacha = Math.max(0, (alumno.Racha || 0) - (eraAsistio ? 1 : 0));

      await updateRecord(tables.alumnos, alumnoId, {
        ClasesAsistidas: nuevasClases,
        Racha: nuevaRacha,
      });

      return res.status(200).json({ ok: true, tipo: null, clasesAsistidas: nuevasClases, racha: nuevaRacha });
    }

    // ── MARCAR ASISTENCIA o FALTA ─────────────────────────────────────────
    if (accion !== 'marcar' && accion !== 'falta') {
      return res.status(400).json({ error: 'accion invalida' });
    }

    // Verificar si ya hay un registro hoy para este alumno+curso
    const filtroYa = curso
      ? `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${hoy}', {Curso} = '${cursoS}')`
      : `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${hoy}')`;

    const yaRegistrados = await findAll(tables.asistencias, filtroYa);
    if (yaRegistrados.length > 0) {
      const tipoActual = yaRegistrados[0].Tipo || 'asistio';
      return res.status(409).json({ error: 'Ya registrado hoy', tipo: tipoActual });
    }

    const esFalta = accion === 'falta';
    const tipo    = esFalta ? 'falto' : 'asistio';

    // Contar todas las sesiones previas de este alumno en este curso (asistencias + faltas)
    const sesionesAnteriores = await findAll(
      tables.asistencias,
      `AND({AlumnoId} = '${alumnoId}', {Curso} = '${cursoS}')`
    );
    const numeroClase = sesionesAnteriores.length + 1;

    await createRecord(tables.asistencias, {
      AlumnoId:     alumnoId,
      AlumnoNombre: alumno.Nombre || '',
      Curso:        curso || '',
      NumeroClase:  numeroClase,
      Fecha:        hoy,
      Tipo:         tipo,
    });

    let nuevaRacha = alumno.Racha || 0;
    let nuevasClases = alumno.ClasesAsistidas || 0;

    if (esFalta) {
      // Falta: reiniciar racha a 0, no tocar ClasesAsistidas
      nuevaRacha = 0;
    } else {
      // Asistencia: incrementar total de clases asistidas y calcular racha
      nuevasClases = nuevasClases + 1;
      nuevaRacha   = await calcularRacha(alumnoId, alumno, curso, hoy);
    }

    await updateRecord(tables.alumnos, alumnoId, {
      ClasesAsistidas: nuevasClases,
      Racha: nuevaRacha,
    });

    return res.status(200).json({ ok: true, tipo, clasesAsistidas: nuevasClases, racha: nuevaRacha, numeroClase });

  } catch (error) {
    console.error('Error en asistencia:', error);
    return res.status(500).json({ error: 'Error al registrar asistencia' });
  }
};

async function calcularRacha(alumnoId, alumno, cursoHoy, hoy) {
  try {
    let cursosAlumno = [];
    if (alumno.Curso) cursosAlumno = alumno.Curso.split(',').map(s => s.trim()).filter(Boolean);
    if (!cursosAlumno.length && cursoHoy) cursosAlumno = [cursoHoy];
    if (!cursosAlumno.length) return 1;

    const todasClases = await findAll(tables.clases, '{Activo} = TRUE()');
    const diasClase = [];
    todasClases.forEach(c => {
      const nombreCurso = (c.Nombre || '').toLowerCase();
      const coincide = cursosAlumno.some(cu =>
        nombreCurso.includes(cu.toLowerCase()) || cu.toLowerCase().includes(nombreCurso)
      );
      if (coincide && c.Dia && DIAS_IDX[c.Dia] !== undefined) {
        diasClase.push(DIAS_IDX[c.Dia]);
      }
    });

    if (diasClase.length === 0) return 1;

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

    if (!diaAnterior) return 1;

    const anterior = await findAll(
      tables.asistencias,
      `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${diaAnterior}', {Tipo} = 'asistio')`
    );

    return anterior.length > 0 ? (alumno.Racha || 0) + 1 : 1;
  } catch (e) {
    console.error('Error calculando racha:', e);
    return (alumno.Racha || 0) + 1;
  }
}
