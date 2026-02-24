/**
 * POST /api/login
 * Flujo 1 — PIN alumno:       { pin: "1234" }
 * Flujo 2 — PIN con colision: { pin: "1234", nombre: "Maria" }
 * Flujo 3 — Email+password:   { email, password }
 */
const bcrypt = require('bcryptjs');
const { tables, findAll } = require('./_lib/airtable');
const { signToken } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const { email, password, pin, nombre } = req.body || {};

  // ---- FLUJO PIN ----
  if (pin) {
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN debe ser exactamente 4 digitos' });
    }
    try {
      const alumnos = await findAll(
        tables.alumnos,
        `AND({PIN} = '${pin}', {Role} = 'alumno', {Activo} = 1)`
      );
      if (alumnos.length === 0) {
        return res.status(401).json({ error: 'PIN incorrecto. Son los ultimos 4 digitos de tu telefono.' });
      }
      if (alumnos.length > 1 && !nombre) {
        return res.status(200).json({
          opciones: alumnos.map(a => ({ id: a.id, nombre: a.Nombre }))
        });
      }
      let alumno = alumnos[0];
      if (nombre && alumnos.length > 1) {
        const match = alumnos.find(a => a.Nombre.toLowerCase().includes(nombre.toLowerCase()));
        if (!match) return res.status(401).json({ error: 'Nombre no coincide con el PIN' });
        alumno = match;
      }
      const jwt = signToken({ id: alumno.id, nombre: alumno.Nombre, role: alumno.Role || 'alumno' });
      return res.status(200).json({ token: jwt, user: buildUser(alumno) });
    } catch (error) {
      console.error('Error en login PIN:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // ---- FLUJO EMAIL + PASSWORD ----
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contrasena son requeridos' });
  }

  try {
    const alumnos = await findAll(tables.alumnos, `{Email} = '${email.replace(/'/g, "\\'")}'`);
    if (alumnos.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const alumno = alumnos[0];
    if (!alumno.Password) {
      return res.status(401).json({ error: 'Cuenta sin contrasena. Contacta al administrador.' });
    }
    const valid = await bcrypt.compare(password, alumno.Password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    if (alumno.Activo === false) {
      return res.status(403).json({ error: 'Tu cuenta esta deshabilitada. Contacta al administrador.' });
    }
    const jwt = signToken({ id: alumno.id, email: alumno.Email, nombre: alumno.Nombre, role: (alumno.Role || 'alumno').toLowerCase() });
    return res.status(200).json({ token: jwt, user: buildUser(alumno) });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

function parseCursos(a) {
  if (a.Curso) return a.Curso.split(',').map(s => s.trim()).filter(Boolean);
  if (a.CursosInscritos) { try { return JSON.parse(a.CursosInscritos); } catch { return []; } }
  return [];
}

function buildUser(a) {
  return {
    id: a.id,
    nombre: a.Nombre,
    email: a.Email || '',
    role: (a.Role || 'alumno').toLowerCase(),
    sede: a.Sede || 'Costa de Montemar, Concon',
    nivel: a.Nivel || '',
    telefono: a.Telefono || '',
    curso: a.Curso || '',
    cursosInscritos: parseCursos(a),
    plan: a.Plan || '',
    estado: a.Estado || '',
    fechaIngreso: a.FechaIngreso || '',
    clasesContratadas: a.ClasesContratadas || 0,
    clasesAsistidas: a.ClasesAsistidas || 0,
    activo: a.Activo !== false,
  };
}
