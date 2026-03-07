const { tables, findAll, findById, createRecord, updateRecord, deleteRecord } = require('./_lib/airtable');
const { requireAuth, requireAdmin } = require('./_lib/auth');

// ── Agente de Cobros ─────────────────────────────────────────────────────────
const PRECIO_CURSOS = { 1: 30000, 2: 40000, 3: 50000 };

function parseCursosCobros(record) {
  const raw = record.Cursos || record.Curso || '';
  return raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
}

async function generarMensajeWhatsApp({ nombre, cursos, monto, detalles }) {
  const cursosTexto = cursos.length > 0 ? cursos.join(', ') : 'su curso';
  const montoFormateado = '$' + Number(monto).toLocaleString('es-CL');
  const prompt = `Eres el asistente de Al Paso Dance Studio, academia de baile en Concón, Chile. Su director es Sergio Gary.
Genera un mensaje de WhatsApp corto y amigable para cobrar la mensualidad del mes.
Datos del alumno:
- Nombre: ${nombre}
- Cursos inscritos: ${cursosTexto}
- Monto a pagar: ${montoFormateado}
${detalles ? `- Detalles: ${detalles}` : ''}
Instrucciones: saluda por nombre, menciona los cursos, indica el monto, tono cercano y nunca presionante, máximo 3-4 oraciones, 1-2 emojis, termina invitando a escribir si tienen dudas.
Devuelve solo el mensaje, sin comillas ni explicaciones.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 350,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Claude API error ${response.status}`);
  const data = await response.json();
  return data.content?.[0]?.text?.trim() || '';
}

async function handleCobros(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;
  if (!['admin', 'profesor'].includes(user.role)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });
  }
  const records = await findAll(tables.alumnos, "{Estado} = 'Pendiente'");
  if (records.length === 0) return res.status(200).json([]);

  const resultados = [];
  const BATCH = 5;
  for (let i = 0; i < records.length; i += BATCH) {
    const lote = records.slice(i, i + BATCH);
    const loteRes = await Promise.all(lote.map(async (r) => {
      const cursos = parseCursosCobros(r);
      const monto = r.Monto ? Number(r.Monto) : (PRECIO_CURSOS[Math.min(cursos.length, 3)] || 30000);
      try {
        const mensaje = await generarMensajeWhatsApp({ nombre: r.Nombre || 'Alumno', cursos, monto, detalles: r['Detalles de cursos'] || '' });
        return { nombre: r.Nombre || '', telefono: r.Telefono || '', cursos, monto, mensaje, error: null };
      } catch (err) {
        return { nombre: r.Nombre || '', telefono: r.Telefono || '', cursos, monto, mensaje: '', error: err.message };
      }
    }));
    resultados.push(...loteRes);
  }
  return res.status(200).json(resultados);
}
// ─────────────────────────────────────────────────────────────────────────────

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
    fotoUrl: a.FotoUrl || '',
    clasesContratadas: a.ClasesContratadas || 0,
    clasesAsistidas: a.ClasesAsistidas || 0,
    racha: a.Racha || 0,
    activo: a.Activo !== false,
    cursosInscritos: parseCursos(a),
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    // Accion especial: agente de cobros
    if (req.query.action === 'cobros') {
      try {
        return await handleCobros(req, res);
      } catch (error) {
        console.error('Error en cobros:', error);
        return res.status(500).json({ error: 'Error al procesar cobros: ' + error.message });
      }
    }

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
      if (data.fotoUrl !== undefined) fields.FotoUrl = data.fotoUrl;
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
