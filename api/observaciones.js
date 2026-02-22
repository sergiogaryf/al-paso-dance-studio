const { tables, findAll, createRecord } = require('./_lib/airtable');
const { verifyToken } = require('./_lib/auth');

const PROFESOR_PIN = '1234';

module.exports = async function handler(req, res) {
  // Autorizacion: JWT admin O PIN profesor
  const jwtUser = verifyToken(req);
  const pin = req.headers['x-eval-pin'];

  if (!jwtUser && pin !== PROFESOR_PIN) {
    return res.status(401).json({ error: 'Acceso no autorizado' });
  }

  // Si es JWT, verificar que sea admin
  if (jwtUser && jwtUser.role !== 'admin' && pin !== PROFESOR_PIN) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    if (req.method === 'GET') {
      const observaciones = await findAll(tables.observaciones);
      // Ordenar por fecha descendente
      observaciones.sort((a, b) => (b.FechaHoraISO || '').localeCompare(a.FechaHoraISO || ''));
      return res.status(200).json(observaciones);
    }

    if (req.method === 'POST') {
      const {
        Curso, NumeroClase, Fecha, ObjetivoDelDia, PasosTrabajados,
        EstrellaParticipacion, EstrellaComprension, EstrellaConexion, EstrellaEnergia,
        LogrosDelDia, DificultadesDetectadas, AjustesProximaClase, Notas
      } = req.body || {};

      if (!Curso || !NumeroClase) {
        return res.status(400).json({ error: 'Curso y numero de clase son requeridos' });
      }

      const record = await createRecord(tables.observaciones, {
        Curso,
        NumeroClase: parseInt(NumeroClase),
        Fecha: Fecha || new Date().toISOString().slice(0, 10),
        ObjetivoDelDia: ObjetivoDelDia || '',
        PasosTrabajados: PasosTrabajados || '',
        EstrellaParticipacion: parseInt(EstrellaParticipacion) || 0,
        EstrellaComprension: parseInt(EstrellaComprension) || 0,
        EstrellaConexion: parseInt(EstrellaConexion) || 0,
        EstrellaEnergia: parseInt(EstrellaEnergia) || 0,
        LogrosDelDia: LogrosDelDia || '',
        DificultadesDetectadas: DificultadesDetectadas || '',
        AjustesProximaClase: AjustesProximaClase || '',
        Notas: Notas || '',
        FechaHoraISO: new Date().toISOString(),
      });

      return res.status(201).json({ ok: true, id: record.id });
    }

    return res.status(405).json({ error: 'Metodo no permitido' });
  } catch (error) {
    console.error('Error en observaciones:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
