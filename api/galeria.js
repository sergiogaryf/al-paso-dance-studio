/**
 * GET /api/galeria
 * Devuelve fotos y videos de fiestas.
 * Tabla Airtable "Galeria": Titulo, Tipo (foto|video), Url, ThumbnailUrl, UrlDescarga, Fecha, Descripcion, Activo
 *
 * Para fotos en Drive: Url = link de Drive, UrlDescarga = link descarga directa
 * Para videos en YouTube: Url = link YouTube
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
    const { tipo } = req.query;
    let filter = '{Activo} = 1';
    if (tipo) filter = `AND(${filter}, {Tipo} = '${tipo}')`;

    const items = await findAll(tables.galeria, filter);

    return res.status(200).json(
      items.map(g => ({
        id:           g.id,
        titulo:       g.Titulo       || '',
        tipo:         g.Tipo         || 'foto',
        url:          g.Url          || '',
        thumbnailUrl: g.ThumbnailUrl || '',
        urlDescarga:  g.UrlDescarga  || g.Url || '',
        fecha:        g.Fecha        || '',
        descripcion:  g.Descripcion  || '',
      }))
    );
  } catch (error) {
    console.error('Error en /api/galeria:', error);
    return res.status(500).json({ error: 'Error al obtener galeria' });
  }
};
