/**
 * sync-rachas.js
 * Lee todas las asistencias de Airtable, recalcula ClasesAsistidas,
 * Racha y UltimaClase para cada alumno y actualiza la tabla Alumnos.
 */

const Airtable = require('airtable');

const TOKEN   = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appcIMqqGxwgtE0Mt';

const base = new Airtable({ apiKey: TOKEN }).base(BASE_ID);

async function fetchAll(tableName, filter) {
  const records = [];
  const opts = {};
  if (filter) opts.filterByFormula = filter;
  await base(tableName).select(opts).eachPage((page, next) => {
    page.forEach(r => records.push({ id: r.id, ...r.fields }));
    next();
  });
  return records;
}

function recalcular(registros) {
  // Ordenar desc por Fecha, luego NumeroClase
  const sorted = [...registros].sort((a, b) => {
    const fa = a.Fecha || '', fb = b.Fecha || '';
    if (fb !== fa) return fb.localeCompare(fa);
    return (b.NumeroClase || 0) - (a.NumeroClase || 0);
  });

  if (!sorted.length) return { clasesAsistidas: 0, racha: 0, ultimaClase: '' };

  const ultimaClase = sorted[0].Tipo || 'asistio';

  // ClasesAsistidas = total registros con Tipo='asistio'
  const clasesAsistidas = registros.filter(r => (r.Tipo || 'asistio') === 'asistio').length;

  // Racha = asistio consecutivos desde el más reciente
  let racha = 0;
  for (const r of sorted) {
    if ((r.Tipo || 'asistio') === 'asistio') racha++;
    else break;
  }

  return { clasesAsistidas, racha, ultimaClase };
}

async function main() {
  console.log('Leyendo asistencias...');
  const asistencias = await fetchAll('Asistencias');
  console.log(`  ${asistencias.length} registros de asistencia encontrados.`);

  console.log('Leyendo alumnos...');
  const alumnos = await fetchAll('Alumnos');
  console.log(`  ${alumnos.length} alumnos encontrados.`);

  // Agrupar asistencias por AlumnoId
  const porAlumno = {};
  for (const a of asistencias) {
    const id = a.AlumnoId;
    if (!id) continue;
    if (!porAlumno[id]) porAlumno[id] = [];
    porAlumno[id].push(a);
  }

  console.log('\nActualizando alumnos...');
  let actualizados = 0;

  for (const alumno of alumnos) {
    const registros = porAlumno[alumno.id] || [];
    const { clasesAsistidas, racha, ultimaClase } = recalcular(registros);

    // Detectar si hay diferencia real antes de actualizar
    const sinCambio =
      (alumno.ClasesAsistidas || 0) === clasesAsistidas &&
      (alumno.Racha || 0) === racha &&
      (alumno.UltimaClase || '') === ultimaClase;

    if (sinCambio) {
      console.log(`  [sin cambios] ${alumno.Nombre || alumno.id}`);
      continue;
    }

    try {
      await base('Alumnos').update(alumno.id, {
        ClasesAsistidas: clasesAsistidas,
        Racha: racha,
        UltimaClase: ultimaClase,
      });
      actualizados++;
      console.log(`  [actualizado] ${alumno.Nombre || alumno.id} → clases: ${clasesAsistidas}, racha: ${racha}, ultima: ${ultimaClase || '(ninguna)'}`);
    } catch (err) {
      console.error(`  [ERROR] ${alumno.Nombre || alumno.id}: ${err.message}`);
    }
  }

  console.log(`\nListo. ${actualizados} alumnos actualizados.`);
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1); });
