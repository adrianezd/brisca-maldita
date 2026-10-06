// Brisca Maldita: roguelike de manos de póker con la baraja española.
var R = null;          // partida en curso
var pantalla = 'inicio';
var seleccion = [];    // ids de cartas seleccionadas
var tienda = null;
var ultimaJugada = null;
var ordenPor = 'numero';
var bloqueo = false;

function $(id) { return document.getElementById(id); }
function azar(a) { return a[Math.floor(Math.random() * a.length)]; }
function barajar(a) {
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function tiene(id) { return R.bufones.some(function (b) { return b.id === id; }); }
function orden(n) { return NUMEROS.indexOf(n); }
function formato(n) { return Math.floor(n).toLocaleString('es-ES'); }
function record() { try { return JSON.parse(localStorage.getItem('brisca-record')) || { ante: 0 }; } catch (e) { return { ante: 0 }; } }
function guardarRecord() {
  var r = record();
  if (R.ante > r.ante) { try { localStorage.setItem('brisca-record', JSON.stringify({ ante: R.ante })); } catch (e) {} }
}

// ---------- Partida ----------
function nuevaPartida() {
  var niveles = {};
  Object.keys(MANOS).forEach(function (k) { niveles[k] = 1; });
  R = { ante: 1, ciego: 0, dinero: 4, bufones: [], niveles: niveles, maxBufones: 5 };
  prepararCiego();
}

function prepararCiego() {
  R.objetivo = Math.round(OBJETIVO_ANTE[Math.min(R.ante, 8) - 1] * [1, 1.5, 2][R.ciego] * (R.ante > 8 ? Math.pow(1.6, R.ante - 8) : 1));
  R.jefe = R.ciego === 2 ? azar(JEFES) : null;
  R.triunfo = azar(Object.keys(PALOS));
  pantalla = 'ciego';
  render();
}

function empezarCiego() {
  var id = 0, mazo = [];
  Object.keys(PALOS).forEach(function (p) { NUMEROS.forEach(function (n) { mazo.push({ id: id++, p: p, n: n }); }); });
  R.mazo = barajar(mazo);
  R.mano = [];
  R.puntos = 0;
  R.manos = 4 + (tiene('perezoso') ? 1 : 0) + (R.jefe && R.jefe.manos ? R.jefe.manos : 0);
  R.descartes = R.jefe && R.jefe.descartesFijos ? R.jefe.descartesFijos : 3 + (tiene('picaro') ? 1 : 0);
  seleccion = [];
  ultimaJugada = null;
  robar();
  pantalla = 'juego';
  render();
}

function robar() {
  while (R.mano.length < 8 && R.mazo.length) R.mano.push(R.mazo.pop());
  ordenarMano();
}

function ordenarMano() {
  R.mano.sort(function (a, b) {
    if (ordenPor === 'palo' && a.p !== b.p) return a.p < b.p ? -1 : 1;
    return orden(b.n) - orden(a.n);
  });
}

// ---------- Evaluación de manos ----------
function evaluar(cartas) {
  var porNum = {};
  cartas.forEach(function (k) { (porNum[k.n] = porNum[k.n] || []).push(k); });
  var grupos = Object.keys(porNum).map(function (n) { return porNum[n]; }).sort(function (a, b) { return b.length - a.length || orden(b[0].n) - orden(a[0].n); });
  var cinco = cartas.length === 5;
  var esColor = cinco && cartas.every(function (k) { return k.p === cartas[0].p; });
  var ords = cartas.map(function (k) { return orden(k.n); }).sort(function (a, b) { return a - b; });
  var esEsc = cinco && grupos.length === 5 && ords[4] - ords[0] === 4;
  var g0 = grupos[0] ? grupos[0].length : 0, g1 = grupos[1] ? grupos[1].length : 0;

  if (esEsc && esColor) return { tipo: 'escColor', puntuan: cartas };
  if (g0 === 4) return { tipo: 'poker', puntuan: grupos[0] };
  if (g0 === 3 && g1 === 2) return { tipo: 'full', puntuan: cartas };
  if (esColor) return { tipo: 'color', puntuan: cartas };
  if (esEsc) return { tipo: 'escalera', puntuan: cartas };
  if (g0 === 3) return { tipo: 'trio', puntuan: grupos[0] };
  if (g0 === 2 && g1 === 2) return { tipo: 'doble', puntuan: grupos[0].concat(grupos[1]) };
  if (g0 === 2) return { tipo: 'pareja', puntuan: grupos[0] };
  return { tipo: 'alta', puntuan: grupos.length ? [grupos[0][0]] : [] };
}

function baseMano(tipo) {
  var m = MANOS[tipo], lv = R.niveles[tipo] - 1;
  return [m.base[0] + m.sube[0] * lv, m.base[1] + m.sube[1] * lv];
}

// Rey y caballo del mismo palo jugados juntos: cante de veinte, o las cuarenta si es el triunfo.
function cantes(cartas) {
  var res = [];
  Object.keys(PALOS).forEach(function (p) {
    var rey = cartas.some(function (k) { return k.p === p && k.n === 12; });
    var cab = cartas.some(function (k) { return k.p === p && k.n === 11; });
    if (rey && cab) res.push(p === R.triunfo ? 40 : 20);
  });
  return res;
}

function puntuar(cartas) {
  var ev = evaluar(cartas);
  var b = baseMano(ev.tipo);
  var puntuan = ev.puntuan.filter(function (k) { return !(R.jefe && R.jefe.anula && R.jefe.anula(k)); });
  var c = { tipo: ev.tipo, jugadas: cartas, puntuan: puntuan, fichas: b[0], mult: b[1], run: R, notas: [] };
  puntuan.forEach(function (k) {
    c.fichas += fichasCarta(k.n);
    if (k.p === R.triunfo) c.mult += tiene('triunfador') ? 6 : 2;
  });
  cantes(cartas).forEach(function (v) {
    var x = tiene('cantaor') ? 2 : 1;
    if (v === 40) { c.fichas += 40 * x; c.mult *= 2 * x; c.notas.push('¡Las cuarenta!'); }
    else { c.fichas += 20 * x; c.mult += 4 * x; c.notas.push('Cante de veinte'); }
  });
  R.bufones.forEach(function (bf) {
    if (!bf.puntua) return;
    var antes = c.mult, antesF = c.fichas;
    bf.puntua(c);
    if (c.mult !== antes || c.fichas !== antesF) c.notas.push(bf.nombre);
  });
  c.total = Math.floor(c.fichas * c.mult);
  return c;
}

// ---------- Acciones ----------
function jugar() {
  if (bloqueo || !seleccion.length || R.manos <= 0) return;
  var cartas = R.mano.filter(function (k) { return seleccion.indexOf(k.id) >= 0; });
  var c = puntuar(cartas);
  R.manos--;
  if (R.jefe && R.jefe.cobra) R.dinero = Math.max(0, R.dinero - R.jefe.cobra);
  R.puntos += c.total;
  ultimaJugada = c;
  R.mano = R.mano.filter(function (k) { return seleccion.indexOf(k.id) < 0; });
  seleccion = [];
  bloqueo = true;
  render();
  setTimeout(function () {
    bloqueo = false;
    if (R.puntos >= R.objetivo) return ganarCiego();
    if (R.manos <= 0 || (!R.mano.length && !R.mazo.length)) return perder();
    robar();
    render();
  }, 1100);
}

function descartar() {
  if (bloqueo || !seleccion.length || R.descartes <= 0) return;
  R.descartes--;
  R.mano = R.mano.filter(function (k) { return seleccion.indexOf(k.id) < 0; });
  seleccion = [];
  robar();
  render();
}

function ganarCiego() {
  var premio = PREMIO_CIEGO[R.ciego];
  var porManos = R.manos;
  var interes = Math.min(5, Math.floor(R.dinero / 5));
  var extra = tiene('banquero') ? 3 : 0;
  R.dinero += premio + porManos + interes + extra;
  R.resumen = { premio: premio, porManos: porManos, interes: interes, extra: extra };
  if (R.ciego === 2) { R.ante++; guardarRecord(); }
  R.ciego = (R.ciego + 1) % 3;
  if (R.ante === 9 && R.ciego === 0 && !R.ganada) { R.ganada = true; pantalla = 'victoria'; render(); return; }
  abrirTienda();
}

function perder() { guardarRecord(); pantalla = 'derrota'; render(); }

// ---------- Tienda ----------
function abrirTienda() {
  tienda = { bufones: ofertaBufones(), estampas: ofertaEstampas(), coste: 2 };
  pantalla = 'tienda';
  render();
}
function ofertaBufones() {
  var libres = BUFONES.filter(function (b) { return !tiene(b.id); });
  return barajar(libres.slice()).slice(0, 3);
}
function ofertaEstampas() {
  return barajar(Object.keys(MANOS).slice()).slice(0, 2);
}
function comprarBufon(i) {
  var b = tienda.bufones[i];
  if (!b || R.dinero < b.precio || R.bufones.length >= R.maxBufones) return;
  R.dinero -= b.precio;
  R.bufones.push(b);
  tienda.bufones.splice(i, 1);
  render();
}
function comprarEstampa(i) {
  var t = tienda.estampas[i];
  if (!t || R.dinero < 3) return;
  R.dinero -= 3;
  R.niveles[t]++;
  tienda.estampas.splice(i, 1);
  render();
}
function venderBufon(i) {
  var b = R.bufones[i];
  R.dinero += Math.floor(b.precio / 2);
  R.bufones.splice(i, 1);
  render();
}
function cambiarOferta() {
  if (R.dinero < tienda.coste) return;
  R.dinero -= tienda.coste;
  tienda.coste++;
  tienda.bufones = ofertaBufones();
  render();
}

// ---------- Pintado ----------
function htmlCarta(k, extra) {
  var pal = PALOS[k.p];
  return '<button class="carta ' + (extra || '') + (k.p === R.triunfo ? ' triunfo' : '') + '" data-id="' + k.id + '" style="--palo:' + pal.c + '">' +
    '<span class="num">' + (LETRA[k.n] || k.n) + '</span><span class="sim">' + pal.s + '</span><span class="fic">' + fichasCarta(k.n) + '</span></button>';
}

function htmlBufones(vender) {
  var huecos = '';
  for (var i = R.bufones.length; i < R.maxBufones; i++) huecos += '<div class="bufon vacio"></div>';
  return '<div class="bufones">' + R.bufones.map(function (b, i) {
    return '<div class="bufon" title="' + b.desc + '"><b>🃏 ' + b.nombre + '</b><small>' + b.desc + '</small>' +
      (vender ? '<button class="mini" data-vender="' + i + '">Vender ' + Math.floor(b.precio / 2) + ' €</button>' : '') + '</div>';
  }).join('') + huecos + '</div>';
}

function htmlCabecera() {
  return '<div class="cabecera"><span>Apuesta <b>' + R.ante + '</b>/8</span><span>💰 <b>' + R.dinero + ' €</b></span>' +
    '<span>Triunfo ' + PALOS[R.triunfo].s + '</span></div>';
}

function render() {
  var app = $('app');
  if (pantalla === 'inicio') {
    var r = record();
    app.innerHTML = '<div class="centro"><h1>Brisca Maldita</h1><p class="lema">Manos de póker con la baraja española</p>' +
      '<div class="abanico">' + ['oros', 'copas', 'espadas', 'bastos'].map(function (p, i) {
        return '<div class="carta grande" style="--palo:' + PALOS[p].c + ';transform:rotate(' + (i * 10 - 15) + 'deg)"><span class="num">' + ['A', '3', 'R', 'C'][i] + '</span><span class="sim">' + PALOS[p].s + '</span></div>';
      }).join('') + '</div>' +
      '<button class="boton" id="bJugar">Jugar</button>' +
      (r.ante > 1 ? '<p class="nota">Tu récord: apuesta ' + r.ante + '</p>' : '') +
      '<details class="ayuda"><summary>Cómo se juega</summary>' +
      '<p>Selecciona hasta 5 cartas y juégalas como una mano de póker. Cada mano tiene fichas y multiplicador; las cartas que puntúan suman sus fichas de brisca: as 11, tres 10, rey 4, caballo 3, sota 2 y el resto su número.</p>' +
      '<p>Las cartas del palo del triunfo dan +2 multi. Si juegas rey y caballo del mismo palo, cantas veinte. Si es del triunfo, ¡las cuarenta!</p>' +
      '<p>Supera la puntuación de cada ciego antes de quedarte sin manos. Con el dinero compra bufones y estampitas en la tienda. Hay 8 apuestas de tres ciegos, y el tercero siempre es un jefe.</p>' +
      '<p>Manos: carta alta, pareja, doble pareja, trío, escalera (5 seguidas, el orden es 1 a 7, sota, caballo, rey), color, full, póker y escalera de color.</p></details></div>';
    $('bJugar').onclick = nuevaPartida;
    return;
  }

  if (pantalla === 'ciego') {
    app.innerHTML = htmlCabecera() + '<div class="centro"><h2>' + NOMBRE_CIEGO[R.ciego] + '</h2>' +
      (R.jefe ? '<div class="jefe"><b>' + R.jefe.nombre + '</b><br>' + R.jefe.desc + '</div>' : '') +
      '<p class="objetivo">Consigue <b>' + formato(R.objetivo) + '</b> puntos</p>' +
      '<p>Triunfo de este ciego: <b style="color:' + PALOS[R.triunfo].c + '">' + PALOS[R.triunfo].s + ' ' + PALOS[R.triunfo].nombre + '</b></p>' +
      '<p class="nota">Premio: ' + PREMIO_CIEGO[R.ciego] + ' €, más 1 € por cada mano que te sobre</p>' +
      '<button class="boton" id="bEmpezar">Empezar</button></div>' + htmlBufones(false);
    $('bEmpezar').onclick = empezarCiego;
    return;
  }

  if (pantalla === 'juego') {
    var sel = R.mano.filter(function (k) { return seleccion.indexOf(k.id) >= 0; });
    var info = '';
    if (bloqueo && ultimaJugada) {
      info = '<div class="jugada destello"><b>' + MANOS[ultimaJugada.tipo].nombre + '</b> <span class="f">' + formato(ultimaJugada.fichas) + '</span> × <span class="m">' + (Math.round(ultimaJugada.mult * 10) / 10).toLocaleString('es-ES') + '</span> = <b>' + formato(ultimaJugada.total) + '</b>' +
        (ultimaJugada.notas.length ? '<div class="notas">' + ultimaJugada.notas.join(' · ') + '</div>' : '') + '</div>';
    } else if (sel.length) {
      var ev = evaluar(sel), b = baseMano(ev.tipo);
      info = '<div class="jugada"><b>' + MANOS[ev.tipo].nombre + '</b> nivel ' + R.niveles[ev.tipo] + ' <span class="f">' + b[0] + '</span> × <span class="m">' + b[1] + '</span>' +
        (cantes(sel).length ? '<div class="notas">' + cantes(sel).map(function (v) { return v === 40 ? '¡Las cuarenta!' : 'Cante de veinte'; }).join(' · ') + '</div>' : '') + '</div>';
    } else {
      info = '<div class="jugada vacia">Elige hasta 5 cartas</div>';
    }
    var pct = Math.min(100, R.puntos / R.objetivo * 100);
    app.innerHTML = htmlCabecera() + htmlBufones(false) +
      '<div class="marcador"><div><small>' + NOMBRE_CIEGO[R.ciego] + (R.jefe ? ': ' + R.jefe.nombre : '') + '</small><b>' + formato(R.puntos) + '</b> / ' + formato(R.objetivo) + '</div>' +
      '<div class="progreso"><div style="width:' + pct + '%"></div></div>' +
      '<div class="contadores"><span>✋ Manos <b>' + R.manos + '</b></span><span>♻️ Descartes <b>' + R.descartes + '</b></span><span>🂠 Mazo <b>' + R.mazo.length + '</b></span></div></div>' +
      (R.jefe ? '<div class="aviso">' + R.jefe.desc + '</div>' : '') +
      info +
      '<div class="mano">' + R.mano.map(function (k) { return htmlCarta(k, seleccion.indexOf(k.id) >= 0 ? 'sel' : ''); }).join('') + '</div>' +
      '<div class="acciones"><button class="boton jugar" id="bJug"' + (sel.length && !bloqueo ? '' : ' disabled') + '>Jugar</button>' +
      '<button class="boton sec" id="bOrd">' + (ordenPor === 'numero' ? 'Por palo' : 'Por número') + '</button>' +
      '<button class="boton desc" id="bDesc"' + (sel.length && R.descartes && !bloqueo ? '' : ' disabled') + '>Descartar</button></div>';
    app.querySelectorAll('.mano .carta').forEach(function (el) {
      el.onclick = function () {
        if (bloqueo) return;
        var id = +el.dataset.id, i = seleccion.indexOf(id);
        if (i >= 0) seleccion.splice(i, 1); else if (seleccion.length < 5) seleccion.push(id);
        render();
      };
    });
    $('bJug').onclick = jugar;
    $('bDesc').onclick = descartar;
    $('bOrd').onclick = function () { ordenPor = ordenPor === 'numero' ? 'palo' : 'numero'; ordenarMano(); render(); };
    return;
  }

  if (pantalla === 'tienda') {
    var rs = R.resumen;
    app.innerHTML = htmlCabecera() +
      '<div class="ganancias">¡Ciego superado! +' + rs.premio + ' € de premio, +' + rs.porManos + ' € por manos, +' + rs.interes + ' € de interés' + (rs.extra ? ', +' + rs.extra + ' € del Banquero' : '') + '</div>' +
      '<h2 class="tit">Tienda</h2><div class="ofertas">' +
      tienda.bufones.map(function (b, i) {
        var puede = R.dinero >= b.precio && R.bufones.length < R.maxBufones;
        return '<div class="oferta"><b>🃏 ' + b.nombre + '</b><small>' + b.desc + '</small><button class="boton peq" data-bufon="' + i + '"' + (puede ? '' : ' disabled') + '>' + b.precio + ' €</button></div>';
      }).join('') +
      tienda.estampas.map(function (t, i) {
        return '<div class="oferta estampa"><b>✝️ Estampita</b><small>Sube de nivel ' + MANOS[t].nombre + ' (ahora ' + R.niveles[t] + ')</small><button class="boton peq" data-estampa="' + i + '"' + (R.dinero >= 3 ? '' : ' disabled') + '>3 €</button></div>';
      }).join('') +
      '</div><div class="acciones"><button class="boton sec" id="bCambiar"' + (R.dinero >= tienda.coste ? '' : ' disabled') + '>Cambiar ' + tienda.coste + ' €</button>' +
      '<button class="boton" id="bSeguir">Seguir</button></div>' +
      '<h2 class="tit">Tus bufones</h2>' + htmlBufones(true);
    app.querySelectorAll('[data-bufon]').forEach(function (el) { el.onclick = function () { comprarBufon(+el.dataset.bufon); }; });
    app.querySelectorAll('[data-estampa]').forEach(function (el) { el.onclick = function () { comprarEstampa(+el.dataset.estampa); }; });
    app.querySelectorAll('[data-vender]').forEach(function (el) { el.onclick = function () { venderBufon(+el.dataset.vender); }; });
    $('bCambiar').onclick = cambiarOferta;
    $('bSeguir').onclick = prepararCiego;
    return;
  }

  if (pantalla === 'derrota' || pantalla === 'victoria') {
    var gana = pantalla === 'victoria';
    var txt = (gana ? '🏆 He ganado a Brisca Maldita' : '💀 He caído en la apuesta ' + R.ante + ' de Brisca Maldita') +
      (R.bufones.length ? ' con ' + R.bufones.map(function (b) { return b.nombre; }).join(', ') : '') + '\n' + location.href.split('#')[0];
    app.innerHTML = '<div class="centro"><h1>' + (gana ? '¡Victoria!' : 'Derrota') + '</h1>' +
      '<p>' + (gana ? 'Has superado las ocho apuestas.' : 'Te has quedado a ' + formato(R.objetivo - R.puntos) + ' puntos en la apuesta ' + R.ante + '.') + '</p>' +
      (gana ? '<button class="boton" id="bSin">Seguir sin fin</button>' : '') +
      '<button class="boton" id="bOtra">Otra partida</button><button class="boton sec" id="bComp">Compartir</button></div>';
    $('bOtra').onclick = nuevaPartida;
    if (gana) $('bSin').onclick = abrirTienda;
    $('bComp').onclick = function () {
      if (navigator.share) navigator.share({ text: txt }).catch(function () {});
      else navigator.clipboard.writeText(txt).then(function () { $('bComp').textContent = 'Copiado'; });
    };
  }
}

render();
