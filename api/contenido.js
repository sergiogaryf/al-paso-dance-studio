/**
 * GET /api/contenido?tipo=videos[&curso=X&mes=X&anio=X]  → Videos de clases
 * GET /api/contenido?tipo=galeria[&subtipo=foto|video]    → Galería de fiestas
 *
 * Absorbe: videos.js + galeria.js
 */
const { tables, findAll } = require('./_lib/airtable');
const { requireAuth } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  const { tipo, curso, mes, anio, subtipo } = req.query;

  // ── VIDEOS DE CLASES ───────────────────────────────────────────────────
  if (tipo === 'videos') {
    try {
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
      console.error('Error en /api/contenido?tipo=videos:', error);
      return res.status(500).json({ error: 'Error al obtener videos' });
    }
  }

  // ── GALERIA DE FIESTAS ─────────────────────────────────────────────────
  if (tipo === 'galeria') {
    try {
      let filter = '{Activo} = 1';
      if (subtipo) filter = `AND(${filter}, {Tipo} = '${subtipo}')`;

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
      console.error('Error en /api/contenido?tipo=galeria:', error);
      return res.status(500).json({ error: 'Error al obtener galeria' });
    }
  }

  return res.status(400).json({ error: 'tipo debe ser "videos" o "galeria"' });
};
