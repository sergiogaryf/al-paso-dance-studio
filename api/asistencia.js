const { tables, findById, updateRecord } = require('./_lib/airtable');
const { verifyToken } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const user = verifyToken(req);
  if (!user || !['admin', 'profesor'].includes(user.role)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  const { alumnoId } = req.body || {};
  if (!alumnoId) {
    return res.status(400).json({ error: 'alumnoId es requerido' });
  }

  try {
    const alumno = await findById(tables.alumnos, alumnoId);
    const nuevasCantidad = (alumno.ClasesAsistidas || 0) + 1;
    await updateRecord(tables.alumnos, alumnoId, { ClasesAsistidas: nuevasCantidad });
    return res.status(200).json({ ok: true, clasesAsistidas: nuevasCantidad });
  } catch (error) {
    console.error('Error en asistencia:', error);
    return res.status(500).json({ error: 'Error al registrar asistencia' });
  }
};
