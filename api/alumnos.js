const { tables, findAll, findById, createRecord, updateRecord, deleteRecord } = require('./_lib/airtable');
const { requireAuth, requireAdmin } = require('./_lib/auth');

// Convierte el campo Curso (string) o CursosInscritos (JSON) en array de nombres
function parseCursos(rec) {
  if (rec.Curso) {
    return rec.Curso.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (rec.CursosInscritos) {
    try {
      const arr = JSON.parse(rec.CursosInscritos);
      if (Array.isArray(arr)) return arr.map(c => (typeof c === 'string' ? c : c.nombre || '')).filter(Boolean);
    } catch (_) {}
  }
  return [];
}

function buildAlumno(a) {
  return {
    id: a.id,
    nombre: a.Nombre || '',
    email: a.Email || '',
    role: a.Role || 'alumno',
    telefono: a.Telefono || '',
    curso: a.Curso || '',
    plan: a.Plan || '',
    estado: a.Estado || '',
    genero: a.Genero || '',
    fechaIngreso: a.FechaIngreso || '',
    observacion: a.Observacion || '',
    pin: a.PIN || '',
    linkToken: a.LinkToken || '',
    clasesContratadas: a.ClasesContratadas || 0,
    clasesAsistidas: a.ClasesAsistidas || 0,
    activo: a.Activo !== false,
    cursosInscritos: parseCursos(a),
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;

    const { id } = req.query;

    try {
      if (id) {
        const alumno = await findById(tables.alumnos, id);
        return res.status(200).json(buildAlumno(alumno));
      }

      // List all alumnos (admin o profesor)
      if (!['admin', 'profesor'].includes(user.role)) {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      const filter = req.query.role ? `{Role} = '${req.query.role}'` : null;
      const records = await findAll(tables.alumnos, filter);
      return res.status(200).json(records.map(buildAlumno));
    } catch (error) {
      console.error('Error en GET /api/alumnos:', error);
      return res.status(500).json({ error: 'Error al obtener alumnos' });
    }
  }

  if (req.method === 'POST') {
    const user = requireAdmin(req, res);
    if (!user) return;

    try {
      const d = req.body;
      const fields = {
        Nombre: d.nombre,
        Email: d.email || '',
        Role: d.role || 'alumno',
        Telefono: d.telefono || '',
        Curso: d.curso || '',
        Plan: d.plan || '',
        Estado: d.estado || '',
        Genero: d.genero || '',
        FechaIngreso: d.fechaIngreso || '',
        Observacion: d.observacion || '',
        PIN: d.pin || '',
        ClasesContratadas: d.clasesContratadas || 0,
        ClasesAsistidas: d.clasesAsistidas || 0,
        Activo: d.activo !== false,
      };

      const record = await createRecord(tables.alumnos, fields);
      return res.status(201).json({ id: record.id, nombre: d.nombre });
    } catch (error) {
      console.error('Error en POST /api/alumnos:', error);
      return res.status(500).json({ error: 'Error al crear alumno' });
    }
  }

  if (req.method === 'PUT') {
    const user = requireAdmin(req, res);
    if (!user) return;

    const { id, ...data } = req.body;
    if (!id) return res.status(400).json({ error: 'ID requerido' });

    try {
      const fields = {};
      if (data.nombre !== undefined) fields.Nombre = data.nombre;
      if (data.email !== undefined) fields.Email = data.email;
      if (data.role !== undefined) fields.Role = data.role;
      if (data.telefono !== undefined) fields.Telefono = data.telefono;
      if (data.curso !== undefined) fields.Curso = data.curso;
      if (data.plan !== undefined) fields.Plan = data.plan;
      if (data.estado !== undefined) fields.Estado = data.estado;
      if (data.genero !== undefined) fields.Genero = data.genero;
      if (data.fechaIngreso !== undefined) fields.FechaIngreso = data.fechaIngreso;
      if (data.observacion !== undefined) fields.Observacion = data.observacion;
      if (data.pin !== undefined) fields.PIN = data.pin;
      if (data.clasesContratadas !== undefined) fields.ClasesContratadas = data.clasesContratadas;
      if (data.clasesAsistidas !== undefined) fields.ClasesAsistidas = data.clasesAsistidas;
      if (data.activo !== undefined) fields.Activo = data.activo;

      await updateRecord(tables.alumnos, id, fields);
      return res.status(200).json({ id, ...data });
    } catch (error) {
      console.error('Error en PUT /api/alumnos:', error);
      return res.status(500).json({ error: 'Error al actualizar alumno' });
    }
  }

  if (req.method === 'DELETE') {
    const user = requireAdmin(req, res);
    if (!user) return;

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID requerido' });

    try {
      await deleteRecord(tables.alumnos, id);
      return res.status(200).json({ id, eliminado: true });
    } catch (error) {
      console.error('Error en DELETE /api/alumnos:', error);
      return res.status(500).json({ error: 'Error al eliminar alumno' });
    }
  }

  return res.status(405).json({ error: 'Metodo no permitido' });
};
