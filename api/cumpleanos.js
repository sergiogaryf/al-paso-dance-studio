/**
 * GET /api/cumpleanos
 * Devuelve lista de cumpleaños de alumnos activos.
 * Solo retorna dia, mes y nombre (no el año, por privacidad).
 *
 * Requiere campo "FechaNacimiento" (Date) en tabla Alumnos de Airtable.
 * Formato esperado: YYYY-MM-DD
 */
const { tables, findAll } = require('./_lib/airtable');
const { requireAuth } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    // Obtener todos los alumnos activos que tengan FechaNacimiento
    const alumnos = await findAll(
      tables.alumnos,
      `AND({Activo} = 1, {Role} = 'alumno', {FechaNacimiento} != '')`
    );

    const cumpleanos = alumnos
      .filter(a => a.FechaNacimiento)
      .map(a => {
        const partes = String(a.FechaNacimiento).split('-');
        // partes: [YYYY, MM, DD] o [DD, MM, YYYY] según el formato de Airtable
        // Airtable devuelve las fechas en formato ISO YYYY-MM-DD
        const [, mm, dd] = partes;
        return {
          nombre: a.Nombre || '',
          mes:    parseInt(mm, 10),
          dia:    parseInt(dd, 10),
        };
      })
      .filter(c => c.mes && c.dia); // descartar entradas inválidas

    return res.status(200).json(cumpleanos);
  } catch (error) {
    console.error('Error en /api/cumpleanos:', error);
    return res.status(500).json({ error: 'Error al obtener cumpleanos' });
  }
};
