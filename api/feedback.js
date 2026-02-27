/**
 * GET  /api/feedback?alumnoId=XXX  → Obtiene feedback de un alumno (alumno ve el suyo, profesor/admin ve cualquiera)
 * POST /api/feedback               → Profesor/admin crea o actualiza feedback mensual
 *
 * Tabla Airtable "FeedbackMensual":
 *   AlumnoId, AlumnoNombre, Mes, Anio, Positivo, Mejoras, AMejorar, CreadoEn
 */
const { tables, findAll, createRecord, updateRecord } = require('./_lib/airtable');
const { requireAuth } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;

  // ── GET ──────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const alumnoId = req.query.alumnoId || user.id;

      // Alumnos solo pueden ver su propio feedback
      if (user.role === 'alumno' && alumnoId !== user.id) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const filter = `{AlumnoId} = '${alumnoId}'`;
      const registros = await findAll(tables.feedbackMensual, filter);

      return res.status(200).json(
        registros.map(f => ({
          id:           f.id,
          alumnoId:     f.AlumnoId     || '',
          alumnoNombre: f.AlumnoNombre || '',
          mes:          f.Mes         || '',
          anio:         f.Anio        || '',
          positivo:     f.Positivo    || '',
          mejoras:      f.Mejoras     || '',
          aMejorar:     f.AMejorar    || '',
          creadoEn:     f.CreadoEn    || '',
        }))
      );
    } catch (error) {
      console.error('Error GET /api/feedback:', error);
      return res.status(500).json({ error: 'Error al obtener feedback' });
    }
  }

  // ── POST ─────────────────────────────────────────────
  if (req.method === 'POST') {
    if (user.role === 'alumno') {
      return res.status(403).json({ error: 'Solo el profesor puede escribir feedback' });
    }

    try {
      const { alumnoId, alumnoNombre, mes, anio, positivo, mejoras, aMejorar } = req.body;

      if (!alumnoId || !mes || !anio) {
        return res.status(400).json({ error: 'alumnoId, mes y anio son requeridos' });
      }

      // Verificar si ya existe feedback para ese alumno/mes/año
      const existing = await findAll(
        tables.feedbackMensual,
        `AND({AlumnoId} = '${alumnoId}', {Mes} = '${mes}', {Anio} = '${anio}')`
      );

      if (existing.length > 0) {
        // Actualizar el existente
        await updateRecord(tables.feedbackMensual, existing[0].id, {
          Positivo: positivo || '',
          Mejoras:  mejoras  || '',
          AMejorar: aMejorar || '',
        });
        return res.status(200).json({ ok: true, accion: 'actualizado', id: existing[0].id });
      }

      // Crear nuevo
      const record = await createRecord(tables.feedbackMensual, {
        AlumnoId:     alumnoId,
        AlumnoNombre: alumnoNombre || '',
        Mes:          mes,
        Anio:         anio,
        Positivo:     positivo || '',
        Mejoras:      mejoras  || '',
        AMejorar:     aMejorar || '',
        CreadoEn:     new Date().toISOString().split('T')[0],
      });

      return res.status(201).json({ ok: true, accion: 'creado', id: record.id });
    } catch (error) {
      console.error('Error POST /api/feedback:', error);
      return res.status(500).json({ error: 'Error al guardar feedback' });
    }
  }

  return res.status(405).json({ error: 'Metodo no permitido' });
};
