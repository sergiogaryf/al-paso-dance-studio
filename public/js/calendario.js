/* ============================================
   ESTACION SALSERA - Calendario JS
   Renderiza grid de Marzo 2026
   ============================================ */

var CLASES_MARZO = [
  // Bachata Intermedio - Lunes
  { dia: 2,  color: 'bachata-int', titulo: 'Bachata Intermedio' },
  { dia: 9,  color: 'bachata-int', titulo: 'Bachata Intermedio' },
  { dia: 16, color: 'bachata-int', titulo: 'Bachata Intermedio' },
  { dia: 23, color: 'bachata-int', titulo: 'Bachata Intermedio' },
  // Casino Basico - Martes
  { dia: 3,  color: 'casino-bas', titulo: 'Casino Basico' },
  { dia: 10, color: 'casino-bas', titulo: 'Casino Basico' },
  { dia: 17, color: 'casino-bas', titulo: 'Casino Basico' },
  { dia: 24, color: 'casino-bas', titulo: 'Casino Basico' },
  // Casino Intermedio - Miercoles
  { dia: 4,  color: 'casino-int', titulo: 'Casino Intermedio' },
  { dia: 11, color: 'casino-int', titulo: 'Casino Intermedio' },
  { dia: 18, color: 'casino-int', titulo: 'Casino Intermedio' },
  { dia: 25, color: 'casino-int', titulo: 'Casino Intermedio' },
  // Mambo Open - Jueves
  { dia: 5,  color: 'mambo', titulo: 'Mambo Open' },
  { dia: 12, color: 'mambo', titulo: 'Mambo Open' },
  { dia: 19, color: 'mambo', titulo: 'Mambo Open' },
  { dia: 26, color: 'mambo', titulo: 'Mambo Open' },
  // Bachata Basico - Viernes
  { dia: 6,  color: 'bachata-bas', titulo: 'Bachata Basico' },
  { dia: 13, color: 'bachata-bas', titulo: 'Bachata Basico' },
  { dia: 20, color: 'bachata-bas', titulo: 'Bachata Basico' },
  { dia: 27, color: 'bachata-bas', titulo: 'Bachata Basico' },
];

function renderCalendario() {
  var grid = document.getElementById('calGrid');

  // Marzo 2026: 1 de marzo es domingo (getDay() = 0)
  // Primera columna es domingo, asi que no necesitamos celdas vacias al inicio
  var primerDia = new Date(2026, 2, 1).getDay(); // 0 = domingo
  var diasEnMarzo = 31;

  // Agrupar clases por dia
  var clasesPorDia = {};
  CLASES_MARZO.forEach(function(clase) {
    if (!clasesPorDia[clase.dia]) clasesPorDia[clase.dia] = [];
    clasesPorDia[clase.dia].push(clase);
  });

  var hoy = new Date();
  var esMarzo2026 = hoy.getFullYear() === 2026 && hoy.getMonth() === 2;

  var html = '';

  // Celdas vacias antes del dia 1
  for (var v = 0; v < primerDia; v++) {
    html += '<div class="cal-dia vacio"></div>';
  }

  // Dias del mes
  for (var dia = 1; dia <= diasEnMarzo; dia++) {
    var clases = clasesPorDia[dia] || [];
    var tieneClase = clases.length > 0;
    var esHoy = esMarzo2026 && hoy.getDate() === dia;

    var puntosHTML = clases.map(function(c) {
      return '<div class="cal-dia-punto cal-dot-' + c.color + '" title="' + c.titulo + '"></div>';
    }).join('');

    var tooltipContent = clases.map(function(c) { return c.titulo; }).join(', ');

    html += '<div class="cal-dia' +
      (tieneClase ? ' tiene-clase' : '') +
      (esHoy ? ' hoy' : '') +
      '"' +
      (tieneClase ? ' title="' + tooltipContent + '"' : '') +
      '>' +
      '<span class="cal-dia-num">' + dia + '</span>' +
      (puntosHTML ? '<div class="cal-dia-puntos">' + puntosHTML + '</div>' : '') +
      '</div>';
  }

  grid.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', renderCalendario);
