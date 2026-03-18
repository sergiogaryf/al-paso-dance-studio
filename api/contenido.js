/**
 * GET /api/contenido?tipo=videos[&curso=X&mes=X&anio=X]  → Videos de clases
 * GET /api/contenido?tipo=galeria[&subtipo=foto|video]    → Galería de fiestas
 * GET /api/contenido?tipo=canciones[&curso=X&clase=N]     → Canciones por clase
 */
const { tables, findAll } = require('./_lib/airtable');
const { requireAuth } = require('./_lib/auth');

function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  const { tipo, curso, mes, anio, subtipo, clase } = req.query;

  // ── VIDEOS DE CLASES ───────────────────────────────────────────────────
  if (tipo === 'videos') {
    try {
      let filter = '{Activo} = TRUE()';
      if (curso) {
        const cursoSafe = curso.replace(/'/g, "\\'");
        filter = `AND(${filter}, FIND('${cursoSafe}', {Curso}))`;
      }
      if (mes)  filter = `AND(${filter}, {Mes} = '${mes}')`;
      if (anio) filter = `AND(${filter}, {Año} = '${anio}')`;

      const videos = await findAll(tables.videos, filter);
      return res.status(200).json(
        videos.map(v => {
          const ytId = getYouTubeId(v.UrlYoutube);
          return {
            id:          v.id,
            curso:       v.Curso        || '',
            numeroClase: v.NumeroClase  || 1,
            mes:         v.Mes         || '',
            anio:        v.Año         || '',
            titulo:      v.Titulo      || '',
            urlYoutube:  v.UrlYoutube  || '',
            youtubeId:   ytId,
            thumbnail:   v.Thumbnail   || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : ''),
            descripcion: v.Descripcion || '',
          };
        })
      );
    } catch (error) {
      console.error('Error en /api/contenido?tipo=videos:', error);
      return res.status(500).json({ error: 'Error al obtener videos' });
    }
  }

  // ── GALERIA DE FIESTAS ─────────────────────────────────────────────────
  if (tipo === 'galeria') {
    try {
      let filter = '{Activo} = TRUE()';
      if (subtipo) filter = `AND(${filter}, {Tipo} = '${subtipo}')`;

      const items = await findAll(tables.galeria, filter);
      return res.status(200).json(
        items.map(g => ({
          id:           g.id,
          titulo:       g.Titulo        || '',
          tipo:         (g.Tipo         || 'foto').toLowerCase(),
          url:          g.Url           || '',
          thumbnailUrl: g.ThumbnailUrl  || '',
          urlDescarga:  g.UrlDescarga   || g.Url || '',
          fecha:        g.Fecha         || '',
          descripcion:  g.Descripcion   || '',
          eventoId:     g.EventoId      || '',
          eventoNombre: g.EventoNombre  || '',
        }))
      );
    } catch (error) {
      console.error('Error en /api/contenido?tipo=galeria:', error);
      return res.status(500).json({ error: 'Error al obtener galeria' });
    }
  }

  // ── CANCIONES POR CLASE ────────────────────────────────────────────────
  if (tipo === 'canciones') {
    try {
      let filter = '{Activo} = TRUE()';
      if (curso) {
        const cursoSafe = curso.replace(/'/g, "\\'");
        filter = `AND(${filter}, FIND('${cursoSafe}', {Curso}))`;
      }
      if (clase) filter = `AND(${filter}, {NumeroClase} = ${parseInt(clase)})`;
      if (mes)   filter = `AND(${filter}, {Mes} = '${mes}')`;
      if (anio)  filter = `AND(${filter}, {Año} = '${anio}')`;

      const canciones = await findAll(tables.canciones, filter);
      return res.status(200).json(
        canciones.map(c => ({
          id:          c.id,
          titulo:      c.Titulo      || '',
          artista:     c.Artista     || '',
          curso:       c.Curso       || '',
          numeroClase: c.NumeroClase || 1,
          mes:         c.Mes         || '',
          anio:        c.Año         || '',
          urlSpotify:  c.UrlSpotify  || '',
          urlYoutube:  c.UrlYoutube  || '',
        }))
      );
    } catch (error) {
      console.error('Error en /api/contenido?tipo=canciones:', error);
      return res.status(500).json({ error: 'Error al obtener canciones' });
    }
  }

  return res.status(400).json({ error: 'tipo debe ser "videos", "galeria" o "canciones"' });
};
