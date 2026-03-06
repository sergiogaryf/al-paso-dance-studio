/**
 * POST /api/asistencia  { alumnoId, accion, curso }
 *   accion = 'marcar' | 'falta' | 'desmarcar'
 *   Registra en tabla Asistencias (campo Tipo: 'asistio'|'falto')
 *   + actualiza ClasesAsistidas, Racha y UltimaClase en Alumnos
 *
 * GET /api/asistencia?curso=X
 *   Retorna { alumnoId: maxNumeroClase } para calcular proxClase
 *
 * GET /api/asistencia?alumnoId=X&fecha=YYYY-MM-DD
 *   Retorna { tipo: 'asistio'|'falto'|null } para esa fecha
 *
 * Logica de racha:
 *   - Asistencia: racha + 1, UltimaClase = 'asistio'
 *   - Falta:      racha = 0, UltimaClase = 'falto'
 *   - Desmarcar:  recalcula racha contando 'asistio' consecutivos desde el mas reciente
 */
const { tables, findAll, findById, createRecord, updateRecord, deleteRecord } = require('./_lib/airtable');
const { verifyToken } = require('./_lib/auth');

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
        const registros = await findAll(tables.asistencias, `{Curso} = '${cursoS}'`);
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

    // ── DESMARCAR ─────────────────────────────────────────────────────────
    if (accion === 'desmarcar') {
      const filter = curso
        ? `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${hoy}', {Curso} = '${cursoS}')`
        : `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${hoy}')`;

      const registros = await findAll(tables.asistencias, filter);
      for (const r of registros) await deleteRecord(tables.asistencias, r.id);

      const nuevasClases = Math.max(0, (alumno.ClasesAsistidas || 0) - 1);

      // Recalcular racha y UltimaClase desde los registros restantes
      const { racha: nuevaRacha, ultimaClase } = await recalcularRachaYUltima(alumnoId);

      await updateRecord(tables.alumnos, alumnoId, {
        ClasesAsistidas: nuevasClases,
        Racha:           nuevaRacha,
        UltimaClase:     ultimaClase,
      });

      return res.status(200).json({ ok: true, tipo: null, clasesAsistidas: nuevasClases, racha: nuevaRacha });
    }

    // ── MARCAR ASISTENCIA o FALTA ─────────────────────────────────────────
    if (accion !== 'marcar' && accion !== 'falta') {
      return res.status(400).json({ error: 'accion invalida' });
    }

    // Verificar duplicado hoy para este alumno+curso
    const filtroYa = curso
      ? `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${hoy}', {Curso} = '${cursoS}')`
      : `AND({AlumnoId} = '${alumnoId}', {Fecha} = '${hoy}')`;

    const yaRegistrados = await findAll(tables.asistencias, filtroYa);
    if (yaRegistrados.length > 0) {
      return res.status(409).json({ error: 'Ya registrado hoy', tipo: yaRegistrados[0].Tipo || 'asistio' });
    }

    const esFalta = accion === 'falta';
    const tipo    = esFalta ? 'falto' : 'asistio';

    // Numero de clase en este curso (sesiones anteriores + 1)
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

    const nuevasClases = (alumno.ClasesAsistidas || 0) + 1;
    // Racha: +1 si asistio, 0 si falto
    const nuevaRacha   = esFalta ? 0 : (alumno.Racha || 0) + 1;

    await updateRecord(tables.alumnos, alumnoId, {
      ClasesAsistidas: nuevasClases,
      Racha:           nuevaRacha,
      UltimaClase:     tipo,
    });

    return res.status(200).json({ ok: true, tipo, clasesAsistidas: nuevasClases, racha: nuevaRacha, numeroClase });

  } catch (error) {
    console.error('Error en asistencia:', error);
    return res.status(500).json({ error: 'Error al registrar asistencia' });
  }
};

/**
 * Recalcula racha y UltimaClase desde todos los registros del alumno.
 * Ordena desc por Fecha+NumeroClase y cuenta 'asistio' consecutivos desde el mas reciente.
 */
async function recalcularRachaYUltima(alumnoId) {
  const todos = await findAll(tables.asistencias, `{AlumnoId} = '${alumnoId}'`);

  if (!todos.length) return { racha: 0, ultimaClase: '' };

  todos.sort((a, b) => {
    const fa = a.Fecha || '', fb = b.Fecha || '';
    if (fb !== fa) return fb.localeCompare(fa);
    return (b.NumeroClase || 0) - (a.NumeroClase || 0);
  });

  const ultimaClase = todos[0].Tipo || 'asistio';

  let racha = 0;
  for (const r of todos) {
    if ((r.Tipo || 'asistio') === 'asistio') {
      racha++;
    } else {
      break; // primera 'falto' rompe la racha
    }
  }

  return { racha, ultimaClase };
}
