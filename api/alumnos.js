const { tables, findAll, findById, createRecord, updateRecord, deleteRecord } = require('./_lib/airtable');
const { requireAuth, requireAdmin } = require('./_lib/auth');

// ── SISTEMA DE PAGOS MENSUALES ────────────────────────────────────────────────
const PRECIO_CURSOS = { 1: 30000, 2: 40000, 3: 50000 };
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function parseCursosCobros(record) {
  const raw = record.CursosActuales || record.CursosSolicitados || record.Cursos || record.Curso || '';
  return raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
}

function nombreMes(n) { return MESES[(n - 1) % 12]; }

// ── Claude API ────────────────────────────────────────────────────────────────
async function llamarClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text?.trim() || '';
}

function promptPorTipo(tipo, { nombre, cursosActuales, cursosSolicitados, monto, mesProximo }) {
  const montoFmt = '$' + Number(monto).toLocaleString('es-CL');
  const cursosAct = cursosActuales.length ? cursosActuales.join(', ') : 'sus cursos';
  const cursosSol = (cursosSolicitados && cursosSolicitados.length) ? cursosSolicitados.join(', ') : cursosAct;

  const base = `Eres el asistente de Al Paso Dance Studio, academia de baile en Concón, Chile. Director: Sergio Gary. Tono amigable, cercano, máximo 4 oraciones, 1-2 emojis. Solo devuelve el mensaje.`;

  if (tipo === 'confirmacion') {
    return `${base}
Mensaje para preguntar si el alumno confirma su continuidad el próximo mes.
- Nombre: ${nombre}
- Cursos actuales: ${cursosAct}
- Mes próximo: ${mesProximo}
Pregunta si confirma continuar en los mismos cursos o si quiere cambiar alguno. Menciona que confirmar reserva su cupo.`;
  }

  if (tipo === 'cobro') {
    return `${base}
Mensaje de cobro de mensualidad para el próximo mes.
- Nombre: ${nombre}
- Cursos contratados para ${mesProximo}: ${cursosSol}
- Monto: ${montoFmt}
Menciona los cursos, el monto, indica que tiene plazo hasta el día 5 del mes. Invita a escribir si tiene dudas.`;
  }

  if (tipo === 'vencimiento') {
    return `${base}
Mensaje de aviso de vencimiento urgente (plan vencido, quedan pocos días).
- Nombre: ${nombre}
- Cursos: ${cursosAct}
- Monto pendiente: ${montoFmt}
Avisa que su plan está vencido y tiene hasta el día 5 para pagar o perderá su cupo. Tono amable pero directo.`;
  }

  return `${base} Hola ${nombre}, recuerda que tienes un pago pendiente de ${montoFmt} por ${cursosAct}.`;
}

// ── Agente de Cobros ──────────────────────────────────────────────────────────
async function handleCobros(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;
  if (!['admin', 'profesor'].includes(user.role)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });
  }

  const tipo = req.query.tipo || 'cobro'; // confirmacion | cobro | vencimiento
  const ahora = new Date();
  const mesActual = parseInt(req.query.mes) || (ahora.getMonth() + 1);
  const año = parseInt(req.query.año) || ahora.getFullYear();
  const mesProximo = mesActual === 12 ? 1 : mesActual + 1;
  const añoProximo = mesActual === 12 ? año + 1 : año;

  let records = [];

  if (tipo === 'confirmacion') {
    // Leer todos los alumnos activos del mes actual para preguntarles si continúan
    records = await findAll(tables.alumnos, `{Activo} = 1`);
    if (records.length === 0) return res.status(200).json([]);

    const BATCH = 5;
    const resultados = [];
    for (let i = 0; i < records.length; i += BATCH) {
      const lote = records.slice(i, i + BATCH);
      const res2 = await Promise.all(lote.map(async (r) => {
        const cursos = parseCursosCobros(r);
        const monto = PRECIO_CURSOS[Math.min(cursos.length, 3)] || 30000;
        try {
          const mensaje = await llamarClaude(promptPorTipo('confirmacion', { nombre: r.Nombre || 'Alumno', cursosActuales: cursos, cursosSolicitados: [], monto, mesProximo: nombreMes(mesProximo) }));
          return { nombre: r.Nombre || '', telefono: r.Telefono || '', cursos, monto, mensaje, tipo, error: null };
        } catch (err) {
          return { nombre: r.Nombre || '', telefono: r.Telefono || '', cursos, monto, mensaje: '', tipo, error: err.message };
        }
      }));
      resultados.push(...res2);
    }
    return res.status(200).json(resultados);
  }

  // Para cobro y vencimiento: leer desde tabla Pagos
  const filtroEstado = tipo === 'cobro'
    ? `AND({Mes} = ${mesProximo}, {Año} = ${añoProximo}, {EstadoPago} = 'Pendiente', {EstadoConfirmacion} = 'Confirmado')`
    : `AND({Mes} = ${mesActual}, {Año} = ${año}, {EstadoPago} = 'Pendiente')`;

  try {
    records = await findAll(tables.pagosMensuales, filtroEstado);
  } catch (_) {
    // Si tabla Pagos no existe aún, fallback a Alumnos
    records = await findAll(tables.alumnos, `{Activo} = 1`);
  }

  if (records.length === 0) return res.status(200).json([]);

  const BATCH = 5;
  const resultados = [];
  for (let i = 0; i < records.length; i += BATCH) {
    const lote = records.slice(i, i + BATCH);
    const res2 = await Promise.all(lote.map(async (r) => {
      const cursosAct = (r.CursosActuales || r.Curso || '').split(',').map(s => s.trim()).filter(Boolean);
      const cursosSol = (r.CursosSolicitados || '').split(',').map(s => s.trim()).filter(Boolean);
      const monto = r.Monto ? Number(r.Monto) : (PRECIO_CURSOS[Math.min(cursosAct.length, 3)] || 30000);
      try {
        const mensaje = await llamarClaude(promptPorTipo(tipo, { nombre: r.AlumnoNombre || r.Nombre || 'Alumno', cursosActuales: cursosAct, cursosSolicitados: cursosSol, monto, mesProximo: nombreMes(tipo === 'cobro' ? mesProximo : mesActual) }));
        return { nombre: r.AlumnoNombre || r.Nombre || '', telefono: r.AlumnoTelefono || r.Telefono || '', cursosAct, cursosSol, monto, mensaje, tipo, pagoId: r.id, error: null };
      } catch (err) {
        return { nombre: r.AlumnoNombre || r.Nombre || '', telefono: r.AlumnoTelefono || r.Telefono || '', cursosAct, cursosSol, monto, mensaje: '', tipo, pagoId: r.id, error: err.message };
      }
    }));
    resultados.push(...res2);
  }
  return res.status(200).json(resultados);
}

// ── CRUD Pagos ────────────────────────────────────────────────────────────────
async function handlePagos(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;
  if (!['admin', 'profesor'].includes(user.role)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  const ahora = new Date();
  const mes = parseInt(req.query.mes) || (ahora.getMonth() + 1);
  const año = parseInt(req.query.año) || ahora.getFullYear();

  // GET: listar pagos del mes
  if (req.method === 'GET') {
    const registros = await findAll(tables.pagosMensuales, `AND({Mes} = ${mes}, {Año} = ${año})`);
    return res.status(200).json(registros.map(r => ({
      id: r.id,
      alumnoId: r.AlumnoId || '',
      nombre: r.AlumnoNombre || '',
      telefono: r.AlumnoTelefono || '',
      mes: r.Mes, año: r.Año,
      estadoPago: r.EstadoPago || 'Pendiente',
      estadoConfirmacion: r.EstadoConfirmacion || 'Sin confirmar',
      cursosActuales: r.CursosActuales || '',
      cursosSolicitados: r.CursosSolicitados || '',
      monto: r.Monto || 0,
      fechaPago: r.FechaPago || '',
      nuevoCurso: r.NuevoCurso || false,
      cupoConfirmado: r.CupoConfirmado || false,
    })));
  }

  // POST crear-mes: genera registros para todos los alumnos activos
  if (req.method === 'POST') {
    const { subaction } = req.query;
    if (subaction === 'crear-mes') {
      const alumnos = await findAll(tables.alumnos, `{Activo} = 1`);
      // Verificar si ya existen registros para ese mes
      const existing = await findAll(tables.pagosMensuales, `AND({Mes} = ${mes}, {Año} = ${año})`);
      const existingIds = new Set(existing.map(r => r.AlumnoId));

      const creados = [];
      for (const a of alumnos) {
        if (existingIds.has(a.id)) continue;
        const cursos = parseCursosCobros(a);
        const monto = PRECIO_CURSOS[Math.min(cursos.length, 3)] || 30000;
        const rec = await createRecord(tables.pagosMensuales, {
          AlumnoId: a.id,
          AlumnoNombre: a.Nombre || '',
          AlumnoTelefono: a.Telefono || '',
          Mes: mes,
          Año: año,
          EstadoPago: 'Pendiente',
          EstadoConfirmacion: 'Sin confirmar',
          CursosActuales: cursos.join(', '),
          CursosSolicitados: '',
          Monto: monto,
        });
        creados.push(rec.id);
      }
      return res.status(201).json({ ok: true, creados: creados.length, mes, año });
    }

    // POST actualizar pago individual
    const { id, ...data } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id requerido' });
    const fields = {};
    if (data.estadoPago !== undefined) fields.EstadoPago = data.estadoPago;
    if (data.estadoConfirmacion !== undefined) fields.EstadoConfirmacion = data.estadoConfirmacion;
    if (data.cursosSolicitados !== undefined) fields.CursosSolicitados = data.cursosSolicitados;
    if (data.monto !== undefined) fields.Monto = Number(data.monto);
    if (data.fechaPago !== undefined) fields.FechaPago = data.fechaPago;
    if (data.nuevoCurso !== undefined) fields.NuevoCurso = data.nuevoCurso;
    if (data.cupoConfirmado !== undefined) fields.CupoConfirmado = data.cupoConfirmado;
    await updateRecord(tables.pagosMensuales, id, fields);
    return res.status(200).json({ ok: true, id });
  }

  return res.status(405).json({ error: 'Metodo no permitido' });
}

// ── Mi Pago (alumno consulta su estado del mes) ───────────────────────────────
async function handleMiPago(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;
  const ahora = new Date();
  const mes = ahora.getMonth() + 1;
  const año = ahora.getFullYear();
  try {
    const registros = await findAll(tables.pagosMensuales, `AND({AlumnoId} = '${user.id}', {Mes} = ${mes}, {Año} = ${año})`);
    if (registros.length === 0) return res.status(200).json({ estado: 'sin-registro' });
    const p = registros[0];
    return res.status(200).json({ estado: p.EstadoPago || 'Pendiente', mes, año, monto: p.Monto || 0 });
  } catch (_) {
    return res.status(200).json({ estado: 'ok' });
  }
}

// ── Cron mensual ──────────────────────────────────────────────────────────────
async function handleCron(req, res) {
  const secret = req.query.secret || req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const tipo = req.query.tipo; // inicio | bloqueo
  const ahora = new Date();
  const mes = ahora.getMonth() + 1;
  const año = ahora.getFullYear();

  if (tipo === 'inicio') {
    // Día 1: archivar mes anterior + activar pagados + advertir pendientes
    const mesPrev = mes === 1 ? 12 : mes - 1;
    const añoPrev = mes === 1 ? año - 1 : año;

    // Archivar mes anterior en HistorialMensual
    const alumnosActivos = await findAll(tables.alumnos, `{Activo} = 1`);
    for (const a of alumnosActivos) {
      const cursos = parseCursosCobros(a);
      await createRecord(tables.historialMensual, {
        AlumnoId: a.id,
        AlumnoNombre: a.Nombre || '',
        Mes: mesPrev,
        Año: añoPrev,
        Cursos: cursos.join(', '),
        ClasesContratadas: a.ClasesContratadas || 0,
        ClasesAsistidas: a.ClasesAsistidas || 0,
        RachaFinal: a.Racha || 0,
        EstadoPago: a.Estado || '',
      }).catch(() => {});
    }

    // Activar alumnos que pagaron el mes actual
    const pagados = await findAll(tables.pagosMensuales, `AND({Mes} = ${mes}, {Año} = ${año}, {EstadoPago} = 'Pagado')`);
    for (const p of pagados) {
      if (!p.AlumnoId) continue;
      const cursosSig = p.CursosSolicitados || p.CursosActuales || '';
      const fields = { ClasesAsistidas: 0, Estado: 'Pagado' };
      if (cursosSig) fields.Curso = cursosSig;
      await updateRecord(tables.alumnos, p.AlumnoId, fields).catch(() => {});
    }

    return res.status(200).json({ ok: true, tipo, archivados: alumnosActivos.length, activados: pagados.length });
  }

  if (tipo === 'bloqueo') {
    // Día 5: bloquear definitivamente los que no pagaron
    const pendientes = await findAll(tables.pagosMensuales, `AND({Mes} = ${mes}, {Año} = ${año}, {EstadoPago} = 'Pendiente')`);
    let bloqueados = 0;
    for (const p of pendientes) {
      await updateRecord(tables.pagosMensuales, p.id, { EstadoPago: 'Bloqueado' }).catch(() => {});
      if (p.AlumnoId) {
        await updateRecord(tables.alumnos, p.AlumnoId, { Estado: 'Bloqueado' }).catch(() => {});
        bloqueados++;
      }
    }
    return res.status(200).json({ ok: true, tipo, bloqueados });
  }

  return res.status(400).json({ error: 'tipo inválido. Usa: inicio | bloqueo' });
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
    const { action } = req.query;

    if (action === 'cobros') {
      try { return await handleCobros(req, res); }
      catch (e) { return res.status(500).json({ error: e.message }); }
    }
    if (action === 'pagos') {
      try { return await handlePagos(req, res); }
      catch (e) { return res.status(500).json({ error: e.message }); }
    }
    if (action === 'mi-pago') {
      try { return await handleMiPago(req, res); }
      catch (e) { return res.status(200).json({ estado: 'ok' }); }
    }
    if (action === 'cron') {
      try { return await handleCron(req, res); }
      catch (e) { return res.status(500).json({ error: e.message }); }
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
    if (req.query.action === 'pagos') {
      try { return await handlePagos(req, res); }
      catch (e) { return res.status(500).json({ error: e.message }); }
    }

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
