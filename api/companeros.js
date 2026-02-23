const { tables, findAll } = require('./_lib/airtable');
const { requireAuth } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  const { curso } = req.query;
  if (!curso) {
    return res.status(400).json({ error: 'curso es requerido' });
  }

  try {
    // Buscar alumnos activos inscritos en ese curso
    const cursoSafe = curso.replace(/'/g, "\\'");
    const alumnos = await findAll(
      tables.alumnos,
      `AND(FIND('${cursoSafe}', {Curso}), {Activo} = 1, {Role} = 'alumno')`
    );

    const result = alumnos
      .filter(a => a.id !== user.id)
      .map(a => ({
        id: a.id,
        nombre: a.Nombre || '',
        genero: a.Genero || '',
        fotoUrl: a.FotoUrl || '',
      }));

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error en /api/companeros:', error);
    return res.status(500).json({ error: 'Error al obtener companeros' });
  }
};
