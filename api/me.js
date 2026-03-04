const { tables, findById, updateRecord } = require('./_lib/airtable');
const { requireAuth } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;

  // ── GET: obtener datos del usuario autenticado ────────────────────────
  if (req.method === 'GET') {
    try {
      const alumno = await findById(tables.alumnos, user.id);

      const cursos = alumno.Curso
        ? alumno.Curso.split(',').map(s => s.trim()).filter(Boolean)
        : (alumno.CursosInscritos ? (() => { try { return JSON.parse(alumno.CursosInscritos); } catch { return []; } })() : []);

      return res.status(200).json({
        id: alumno.id,
        nombre: alumno.Nombre,
        email: alumno.Email || '',
        role: (alumno.Role || 'alumno').toLowerCase(),
        sede: alumno.Sede || 'Costa de Montemar, Concon',
        nivel: alumno.Nivel || '',
        telefono: alumno.Telefono || '',
        curso: alumno.Curso || '',
        cursosInscritos: cursos,
        plan: alumno.Plan || '',
        estado: alumno.Estado || '',
        fechaIngreso: alumno.FechaIngreso || '',
        clasesContratadas: alumno.ClasesContratadas || 0,
        clasesAsistidas: alumno.ClasesAsistidas || 0,
        racha: alumno.Racha || 0,
        activo: alumno.Activo !== false,
        fotoUrl: alumno.FotoUrl || '',
      });
    } catch (error) {
      console.error('Error en GET /api/me:', error);
      return res.status(500).json({ error: 'Error al obtener datos del usuario' });
    }
  }

  // ── PUT: actualizar campos propios (fotoUrl) ──────────────────────────
  if (req.method === 'PUT') {
    try {
      const { fotoUrl } = req.body || {};
      const fields = {};
      if (fotoUrl !== undefined) fields.FotoUrl = fotoUrl;

      if (Object.keys(fields).length === 0) {
        return res.status(400).json({ error: 'No hay campos para actualizar' });
      }

      await updateRecord(tables.alumnos, user.id, fields);
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error en PUT /api/me:', error);
      return res.status(500).json({ error: 'Error al actualizar perfil' });
    }
  }

  // ── POST: subir foto a Cloudinary y retornar URL ──────────────────────
  if (req.method === 'POST') {
    const { imageData } = req.body || {};
    if (!imageData) return res.status(400).json({ error: 'imageData requerido' });

    try {
      const params = new URLSearchParams();
      params.append('file', imageData);
      params.append('upload_preset', 'al-paso-fotos');

      const response = await fetch(
        'https://api.cloudinary.com/v1_1/debpk4syz/image/upload',
        { method: 'POST', body: params }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err.error && err.error.message) || `Error Cloudinary ${response.status}`);
      }

      const data = await response.json();
      return res.status(200).json({ url: data.secure_url });
    } catch (error) {
      console.error('Error en POST /api/me (upload foto):', error);
      return res.status(500).json({ error: error.message || 'Error al subir foto' });
    }
  }

  return res.status(405).json({ error: 'Metodo no permitido' });
};
