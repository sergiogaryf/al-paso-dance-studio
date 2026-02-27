const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN })
  .base(process.env.AIRTABLE_BASE_ID);

const tables = {
  alumnos: base('Alumnos'),
  clases: base('Clases'),
  eventos: base('Eventos'),
  banners: base('Banners'),
  evaluaciones: base('Evaluaciones'),
  observaciones: base('ObservacionesProfesor'),
  videos: base('Videos'),
  galeria: base('Galeria'),
  feedbackMensual: base('FeedbackMensual'),
};

function recordToObj(record) {
  return { id: record.id, ...record.fields };
}

async function findAll(table, filterFormula) {
  const records = [];
  const opts = {};
  if (filterFormula) opts.filterByFormula = filterFormula;
  await table.select(opts).eachPage((page, next) => {
    page.forEach(r => records.push(recordToObj(r)));
    next();
  });
  return records;
}

async function findById(table, id) {
  const record = await table.find(id);
  return recordToObj(record);
}

async function createRecord(table, fields) {
  const record = await table.create(fields);
  return recordToObj(record);
}

async function updateRecord(table, id, fields) {
  const record = await table.update(id, fields);
  return recordToObj(record);
}

async function deleteRecord(table, id) {
  await table.destroy(id);
  return { id, eliminado: true };
}

module.exports = { base, tables, findAll, findById, createRecord, updateRecord, deleteRecord };
