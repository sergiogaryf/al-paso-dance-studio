const { tables, findAll, createRecord, updateRecord, deleteRecord } = require('./_lib/airtable');
const { requireAuth, requireAdmin } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
      const activos = req.query.all === 'true' ? null : `{Activo} = TRUE()`;
      const records = await findAll(tables.eventos, activos);
      const eventos = records.map(r => ({
        id: r.id,
        titulo: r.Titulo,
        descripcion: r.Descripcion,
        fecha: r.Fecha,
        lugar: r.Lugar,
        imagenURL: r.CoverUrl || r.ImagenURL || '',
        activo: r.Activo !== false,
      }));
      if (!req.query.all) {
        eventos.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
      }
      return res.status(200).json(eventos);
    } catch (error) {
      console.error('Error en GET /api/eventos:', error);
      return res.status(500).json({ error: 'Error al obtener eventos' });
    }
  }

  if (req.method === 'POST') {
    const user = requireAdmin(req, res);
    if (!user) return;

    try {
      const d = req.body;
      const record = await createRecord(tables.eventos, {
        Titulo: d.titulo,
        Descripcion: d.descripcion,
        Fecha: d.fecha,
        Lugar: d.lugar,
        CoverUrl: d.imagenURL,
        Activo: d.activo !== false,
      });
      return res.status(201).json({ id: record.id, ...d });
    } catch (error) {
      console.error('Error en POST /api/eventos:', error);
      return res.status(500).json({ error: 'Error al crear evento' });
    }
  }

  if (req.method === 'PUT') {
    const user = requireAdmin(req, res);
    if (!user) return;

    const { id, ...data } = req.body;
    if (!id) return res.status(400).json({ error: 'ID requerido' });

    try {
      const fields = {};
      if (data.titulo !== undefined) fields.Titulo = data.titulo;
      if (data.descripcion !== undefined) fields.Descripcion = data.descripcion;
      if (data.fecha !== undefined) fields.Fecha = data.fecha;
      if (data.lugar !== undefined) fields.Lugar = data.lugar;
      if (data.imagenURL !== undefined) fields.CoverUrl = data.imagenURL;
      if (data.activo !== undefined) fields.Activo = data.activo;

      await updateRecord(tables.eventos, id, fields);
      return res.status(200).json({ id, ...data });
    } catch (error) {
      console.error('Error en PUT /api/eventos:', error);
      return res.status(500).json({ error: 'Error al actualizar evento' });
    }
  }

  if (req.method === 'DELETE') {
    const user = requireAdmin(req, res);
    if (!user) return;

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID requerido' });

    try {
      await deleteRecord(tables.eventos, id);
      return res.status(200).json({ id, eliminado: true });
    } catch (error) {
      console.error('Error en DELETE /api/eventos:', error);
      return res.status(500).json({ error: 'Error al eliminar evento' });
    }
  }

  return res.status(405).json({ error: 'Metodo no permitido' });
};
