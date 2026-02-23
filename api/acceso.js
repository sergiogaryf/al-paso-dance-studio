/**
 * GET /api/acceso?token=LINKTOKEN
 * Valida el link de acceso directo y retorna un JWT
 */
const { tables, findAll } = require('./_lib/airtable');
const { signToken } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token requerido' });

  try {
    const alumnos = await findAll(tables.alumnos, `{LinkToken} = '${token}'`);

    if (alumnos.length === 0) {
      return res.status(401).json({ error: 'Link invalido o expirado' });
    }

    const alumno = alumnos[0];

    if (!alumno.Activo) {
      return res.status(403).json({ error: 'Cuenta deshabilitada. Contacta al instructor.' });
    }

    const jwt = signToken({
      id: alumno.id,
      nombre: alumno.Nombre,
      role: alumno.Role || 'alumno',
    });

    return res.status(200).json({ token: jwt, user: buildUser(alumno) });
  } catch (error) {
    console.error('Error en acceso por link:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

function buildUser(a) {
  const cursos = parseCursos(a);
  return {
    id: a.id,
    nombre: a.Nombre,
    email: a.Email || '',
    role: a.Role || 'alumno',
    telefono: a.Telefono || '',
    curso: a.Curso || '',
    cursosInscritos: cursos,
    plan: a.Plan || '',
    estado: a.Estado || '',
    fechaIngreso: a.FechaIngreso || '',
    clasesContratadas: a.ClasesContratadas || 0,
    clasesAsistidas: a.ClasesAsistidas || 0,
    activo: a.Activo !== false,
    sede: a.Sede || 'Costa de Montemar, Concon',
  };
}

function parseCursos(a) {
  if (a.Curso) return a.Curso.split(',').map(s => s.trim()).filter(Boolean);
  if (a.CursosInscritos) {
    try { return JSON.parse(a.CursosInscritos); } catch { return []; }
  }
  return [];
}
