/* ============================================
   AL PASO DANCE STUDIO - Agente de Cobros
   Lee alumnos con Estado='Pendiente' desde Airtable
   y genera mensajes WhatsApp via Claude API
   ============================================ */

const { tables, findAll } = require('./_lib/airtable');
const { requireAdmin } = require('./_lib/auth');

const PRECIO = { 1: 30000, 2: 40000, 3: 50000 };

function calcularMonto(numCursos) {
  return PRECIO[Math.min(numCursos, 3)] || 30000;
}

function parseCursos(record) {
  const raw = record.Cursos || record.Curso || '';
  return raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
}

async function generarMensajeWhatsApp({ nombre, cursos, monto, detalles }) {
  const cursosTexto = cursos.length > 0 ? cursos.join(', ') : 'su curso';
  const montoFormateado = `$${Number(monto).toLocaleString('es-CL')}`;

  const prompt = `Eres el asistente de Al Paso Dance Studio, academia de baile en Concón, Chile.
Tu director es Sergio Gary.

Genera un mensaje de WhatsApp corto y amigable para cobrar la mensualidad del mes.

Datos del alumno:
- Nombre: ${nombre}
- Cursos inscritos: ${cursosTexto}
- Monto a pagar: ${montoFormateado}
${detalles ? `- Detalles adicionales: ${detalles}` : ''}

Instrucciones:
- Saluda por nombre
- Menciona los cursos que toma
- Indica el monto a pagar
- Tono cercano y amable, nunca presionante
- Máximo 3-4 oraciones
- Usa 1 o 2 emojis como máximo
- Termina invitándolos a escribir si tienen dudas

Devuelve solo el mensaje, sin comillas ni explicaciones.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 350,
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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const user = requireAdmin(req, res);
  if (!user) return;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no está configurada en las variables de entorno' });
  }

  try {
    const records = await findAll(tables.alumnos, "{Estado} = 'Pendiente'");

    if (records.length === 0) {
      return res.status(200).json([]);
    }

    // Generar mensajes en paralelo (máx 5 a la vez para no saturar la API)
    const resultados = [];
    const BATCH = 5;

    for (let i = 0; i < records.length; i += BATCH) {
      const lote = records.slice(i, i + BATCH);
      const loteResultados = await Promise.all(
        lote.map(async (r) => {
          const cursos = parseCursos(r);
          const monto = r.Monto ? Number(r.Monto) : calcularMonto(cursos.length);
          const detalles = r['Detalles de cursos'] || '';

          try {
            const mensaje = await generarMensajeWhatsApp({
              nombre: r.Nombre || 'Alumno',
              cursos,
              monto,
              detalles,
            });
            return {
              nombre: r.Nombre || '',
              telefono: r.Telefono || '',
              cursos,
              monto,
              mensaje,
              error: null,
            };
          } catch (err) {
            return {
              nombre: r.Nombre || '',
              telefono: r.Telefono || '',
              cursos,
              monto,
              mensaje: '',
              error: err.message,
            };
          }
        })
      );
      resultados.push(...loteResultados);
    }

    return res.status(200).json(resultados);
  } catch (error) {
    console.error('Error en agent-cobros:', error);
    return res.status(500).json({ error: 'Error al procesar cobros: ' + error.message });
  }
};
