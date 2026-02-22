const bcrypt = require('bcryptjs');
const { tables, findAll, createRecord } = require('./_lib/airtable');
const { verifyToken } = require('./_lib/auth');

const PROFESOR_PIN = '1234';

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
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

      let filter = null;
      const { curso } = req.query || {};
      if (curso) {
        filter = `{Curso} = '${curso.replace(/'/g, "\\'")}'`;
      }

      const evaluaciones = await findAll(tables.evaluaciones, filter);
      return res.status(200).json(evaluaciones);
    }

    if (req.method === 'POST') {
      // Aceptar auth por JWT (alumno desde PWA) o por PIN (desde evaluacion.html)
      const jwtUser = verifyToken(req);

      const {
        nombreAlumno, curso, pinAlumno, numeroClase,
        disfrute, comprension, comodidadPareja, confianza,
        baileNuevo, comentario
      } = req.body || {};

      // Determinar nombre del alumno
      const nombre = jwtUser ? (nombreAlumno || jwtUser.nombre) : nombreAlumno;

      // Validar campos requeridos
      if (!nombre || !curso || !numeroClase) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
      }

      // Si no hay JWT, se requiere PIN
      if (!jwtUser) {
        if (!pinAlumno || pinAlumno.length !== 4 || !/^\d{4}$/.test(pinAlumno)) {
          return res.status(400).json({ error: 'El PIN debe ser de 4 digitos' });
        }
      }

      const hoy = new Date().toISOString().slice(0, 10);
      const nombreSanitizado = nombre.trim().replace(/'/g, "\\'");
      const cursoSanitizado = curso.replace(/'/g, "\\'");

      // Verificar bloqueo diario (1 evaluacion por dia por alumno+curso)
      const existentes = await findAll(
        tables.evaluaciones,
        `AND({NombreAlumno} = '${nombreSanitizado}', {Curso} = '${cursoSanitizado}', {FechaEvaluacion} = '${hoy}')`
      );

      if (existentes.length > 0) {
        return res.status(409).json({ error: 'Ya enviaste tu evaluacion de hoy. Vuelve manana.' });
      }

      let pinHash = '';

      // Flujo con PIN (sin JWT)
      if (!jwtUser && pinAlumno) {
        const previas = await findAll(
          tables.evaluaciones,
          `AND({NombreAlumno} = '${nombreSanitizado}', {Curso} = '${cursoSanitizado}')`
        );

        if (previas.length > 0) {
          const hashGuardado = previas[0].PINAlumno;
          if (hashGuardado) {
            const pinValido = await bcrypt.compare(pinAlumno, hashGuardado);
            if (!pinValido) {
              return res.status(401).json({ error: 'PIN incorrecto' });
            }
          }
          pinHash = hashGuardado || await bcrypt.hash(pinAlumno, 10);
        } else {
          pinHash = await bcrypt.hash(pinAlumno, 10);
        }
      }

      const recordData = {
        NombreAlumno: nombre.trim(),
        Curso: curso,
        NumeroClase: parseInt(numeroClase),
        Disfrute: parseInt(disfrute) || 5,
        Comprension: parseInt(comprension) || 5,
        ComodidadPareja: parseInt(comodidadPareja) || 5,
        Confianza: parseInt(confianza) || 5,
        BaileNuevo: !!baileNuevo,
        Comentario: comentario || '',
        FechaEvaluacion: hoy,
        FechaHoraISO: new Date().toISOString(),
      };

      if (pinHash) {
        recordData.PINAlumno = pinHash;
      }

      const record = await createRecord(tables.evaluaciones, recordData);

      return res.status(201).json({ ok: true, id: record.id });
    }

    return res.status(405).json({ error: 'Metodo no permitido' });
  } catch (error) {
    console.error('Error en evaluaciones:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
