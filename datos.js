// Datos de Brisca Maldita: palos, manos, bufones, estampitas y jefes.
var PALOS = {
  oros: { s: '🪙', c: '#c99a06', nombre: 'Oros' },
  copas: { s: '🏆', c: '#c0392b', nombre: 'Copas' },
  espadas: { s: '⚔️', c: '#2c5aa0', nombre: 'Espadas' },
  bastos: { s: '🪵', c: '#2e7d32', nombre: 'Bastos' }
};
var NUMEROS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
var NOMBRE_NUM = { 1: 'As', 10: 'Sota', 11: 'Caballo', 12: 'Rey' };
var LETRA = { 1: 'A', 10: 'S', 11: 'C', 12: 'R' };
// Fichas como en la brisca: as 11, tres 10, rey 4, caballo 3, sota 2. El resto, su número.
function fichasCarta(n) { return { 1: 11, 3: 10, 12: 4, 11: 3, 10: 2 }[n] || n; }

var MANOS = {
  alta: { nombre: 'Carta alta', base: [5, 1], sube: [10, 1] },
  pareja: { nombre: 'Pareja', base: [10, 2], sube: [15, 1] },
  doble: { nombre: 'Doble pareja', base: [20, 2], sube: [20, 1] },
  trio: { nombre: 'Trío', base: [30, 3], sube: [20, 2] },
  escalera: { nombre: 'Escalera', base: [30, 4], sube: [30, 3] },
  color: { nombre: 'Color', base: [35, 4], sube: [15, 2] },
  full: { nombre: 'Full', base: [40, 4], sube: [25, 2] },
  poker: { nombre: 'Póker', base: [60, 7], sube: [30, 3] },
  escColor: { nombre: 'Escalera de color', base: [100, 8], sube: [40, 4] }
};

// Cada bufón tiene precio y, si puntúa, una función que modifica el contexto de la jugada.
var BUFONES = [
  { id: 'bufon', nombre: 'El Bufón', desc: '+4 multi', precio: 4, puntua: function (c) { c.mult += 4; } },
  { id: 'tahur', nombre: 'El Tahúr', desc: '+8 multi si la mano tiene pareja', precio: 5, puntua: function (c) { if (['pareja', 'doble', 'trio', 'full', 'poker'].indexOf(c.tipo) >= 0) c.mult += 8; } },
  { id: 'oros', nombre: 'Glotón de Oros', desc: '+3 multi por cada oro que puntúa', precio: 5, puntua: function (c) { c.mult += 3 * cuentaPalo(c, 'oros'); } },
  { id: 'copas', nombre: 'Borracho de Copas', desc: '+3 multi por cada copa que puntúa', precio: 5, puntua: function (c) { c.mult += 3 * cuentaPalo(c, 'copas'); } },
  { id: 'espadas', nombre: 'Espadachín', desc: '+3 multi por cada espada que puntúa', precio: 5, puntua: function (c) { c.mult += 3 * cuentaPalo(c, 'espadas'); } },
  { id: 'bastos', nombre: 'Leñador', desc: '+3 multi por cada basto que puntúa', precio: 5, puntua: function (c) { c.mult += 3 * cuentaPalo(c, 'bastos'); } },
  { id: 'sacristan', nombre: 'El Sacristán', desc: '+40 fichas si juegas 3 cartas o menos', precio: 4, puntua: function (c) { if (c.jugadas.length <= 3) c.fichas += 40; } },
  { id: 'reymago', nombre: 'Rey Mago', desc: 'Cada rey que puntúa da x1,5 multi', precio: 7, puntua: function (c) { c.puntuan.forEach(function (k) { if (k.n === 12) c.mult *= 1.5; }); } },
  { id: 'ases', nombre: 'As en la Manga', desc: 'Cada as que puntúa da +20 fichas', precio: 5, puntua: function (c) { c.puntuan.forEach(function (k) { if (k.n === 1) c.fichas += 20; }); } },
  { id: 'banquero', nombre: 'El Banquero', desc: 'Ganas 3 € más al superar cada ciego', precio: 5 },
  { id: 'triunfador', nombre: 'Triunfador', desc: 'Las cartas del triunfo dan +4 multi más', precio: 6 },
  { id: 'cantaor', nombre: 'El Cantaor', desc: 'Los cantes valen el doble', precio: 6 },
  { id: 'sieteymedia', nombre: 'Siete y Media', desc: 'x3 multi si tus cartas jugadas suman 7 y media. Las figuras valen medio', precio: 6, puntua: function (c) {
    var s = c.jugadas.reduce(function (a, k) { return a + (k.n >= 10 ? 0.5 : k.n); }, 0);
    if (s === 7.5) c.mult *= 3;
  } },
  { id: 'mus', nombre: 'Duples', desc: 'x2 multi si juegas doble pareja o full', precio: 6, puntua: function (c) { if (c.tipo === 'doble' || c.tipo === 'full') c.mult *= 2; } },
  { id: 'chinchon', nombre: 'Chinchón', desc: 'x3 multi si juegas escalera', precio: 7, puntua: function (c) { if (c.tipo === 'escalera' || c.tipo === 'escColor') c.mult *= 3; } },
  { id: 'picaro', nombre: 'El Pícaro', desc: '+1 descarte en cada ciego', precio: 4 },
  { id: 'perezoso', nombre: 'El Perezoso', desc: '+1 mano en cada ciego', precio: 6 },
  { id: 'abuela', nombre: 'La Abuela', desc: '+3 multi por cada descarte que te quede', precio: 5, puntua: function (c) { c.mult += 3 * c.run.descartes; } },
  { id: 'figurin', nombre: 'Figurín', desc: 'Sotas, caballos y reyes que puntúan dan +2 multi', precio: 5, puntua: function (c) { c.puntuan.forEach(function (k) { if (k.n >= 10) c.mult += 2; }); } },
  { id: 'hucha', nombre: 'La Hucha', desc: '+1 multi por cada 4 € que tengas', precio: 6, puntua: function (c) { c.mult += Math.floor(c.run.dinero / 4); } }
];

function cuentaPalo(c, palo) { return c.puntuan.filter(function (k) { return k.p === palo; }).length; }

var JEFES = [
  { nombre: 'El Inquisidor', desc: 'Los oros no puntúan', anula: function (k) { return k.p === 'oros'; } },
  { nombre: 'La Abadesa', desc: 'Las copas no puntúan', anula: function (k) { return k.p === 'copas'; } },
  { nombre: 'El Hidalgo', desc: 'Las espadas no puntúan', anula: function (k) { return k.p === 'espadas'; } },
  { nombre: 'El Guardabosques', desc: 'Los bastos no puntúan', anula: function (k) { return k.p === 'bastos'; } },
  { nombre: 'El Fraile', desc: 'Las figuras no puntúan', anula: function (k) { return k.n >= 10; } },
  { nombre: 'La Monja', desc: 'Una mano menos', manos: -1 },
  { nombre: 'El Alguacil', desc: 'Solo un descarte', descartesFijos: 1 },
  { nombre: 'El Usurero', desc: 'Pierdes 1 € por cada mano jugada', cobra: 1 }
];

var OBJETIVO_ANTE = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];
var NOMBRE_CIEGO = ['Ciego pequeño', 'Ciego grande', 'Jefe'];
var PREMIO_CIEGO = [3, 4, 5];
