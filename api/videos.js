/**
 * GET /api/videos
 * Devuelve videos de clases. Filtra por curso, mes y anio opcionalmente.
 * Tabla Airtable "Videos": Curso, NumeroClase, Mes, Anio, Titulo, UrlYoutube, Descripcion, Activo
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
    const { curso, mes, anio } = req.query;
    let filter = '{Activo} = 1';

    if (curso) {
      const cursoSafe = curso.replace(/'/g, "\\'");
      filter = `AND(${filter}, FIND('${cursoSafe}', {Curso}))`;
    }
    if (mes)  filter = `AND(${filter}, {Mes} = '${mes}')`;
    if (anio) filter = `AND(${filter}, {Anio} = '${anio}')`;

    const videos = await findAll(tables.videos, filter);

    return res.status(200).json(
      videos.map(v => ({
        id:          v.id,
        curso:       v.Curso        || '',
        numeroClase: v.NumeroClase  || 1,
        mes:         v.Mes         || '',
        anio:        v.Anio        || '',
        titulo:      v.Titulo      || '',
        urlYoutube:  v.UrlYoutube  || '',
        descripcion: v.Descripcion || '',
      }))
    );
  } catch (error) {
    console.error('Error en /api/videos:', error);
    return res.status(500).json({ error: 'Error al obtener videos' });
  }
};
