import { guardarResultado, consultarRanking } from './firebase.js';
'use strict';

 

// GEOGRAFÍA MUNDIAL — DESAFÍO MUNDIAL

// Cada etapa contiene 3 preguntas fáciles, 2 intermedias y 1 difícil.

// Requiere paises.json junto a index.html, style.css y app.js.

 

const $ = id => document.getElementById(id);

const SECUENCIA = [1, 1, 1, 2, 2, 3];

const LIMITES = {

    pais: { 1: 1000, 2: 2000, 3: 3000 },

    capital: { 1: 800, 2: 500, 3: 300 }

};

const NOMBRES = { 1: 'Fácil', 2: 'Intermedia', 3: 'Difícil' };

const MAX_VIDAS = 3;

const BONO_ETAPA = 500;

const ETAPAS_POR_BLOQUE = 12; // 38 fáciles permiten 12 etapas sin repetir.

 

const map = L.map('map', {

    worldCopyJump: false,

    minZoom: 2,

    maxZoom: 12

}).setView([15, 0], 2);

 

// Mantiene la capa de OpenStreetMap que ya funciona sin clave API.

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {

    maxZoom: 19,

    attribution: '&copy; OpenStreetMap contributors'

}).addTo(map);

 

let paises = [];

let bolsas = { 1: [], 2: [], 3: [] };

let etapa = 1;

let pregunta = 0;

let vidas = MAX_VIDAS;

let puntos = 0;

let respondida = false;

let terminado = false;

let actual = null;

let marcas = [];

let modo = 'pais';

let etapasCompletadas = 0;

let aciertos = 0;

let preguntasTotales = 0;

let preguntaBandera = false;

let preguntaCapitalTerritorio = false;

 

function mezclar(lista) {

    const copia = [...lista];

    for (let i = copia.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [copia[i], copia[j]] = [copia[j], copia[i]];

    }

    return copia;

}

 

function distanciaKm(lat1, lon1, lat2, lon2) {

    const r = Math.PI / 180;

    const a = (lat2 - lat1) * r;

    const b = (lon2 - lon1) * r;

    const h = Math.sin(a / 2) ** 2 +

        Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(b / 2) ** 2;

    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

}

 

function limpiarMarcas() {

    marcas.forEach(marca => map.removeLayer(marca));

    marcas = [];

}

 

function guardarRecord() {

    try {

        const record = Number(localStorage.getItem('geografiaRecord') || 0);

        const nuevo = Math.max(record, puntos);

        localStorage.setItem('geografiaRecord', String(nuevo));

        return nuevo;

    } catch (error) {

        return puntos;

    }

}

 

function prepararBolsas() {

    bolsas = { 1: [], 2: [], 3: [] };

    for (const grado of [1, 2, 3]) {

        bolsas[grado] = mezclar(paises.filter(p => p.grado === grado));

    }

}

 

function tomarPais(grado) {

    // Cuando una categoría se agota, se reutiliza en orden aleatorio.

    // Nunca se repite mientras haya países pendientes de esa categoría.

    if (bolsas[grado].length === 0) {

        bolsas[grado] = mezclar(paises.filter(p => p.grado === grado));

    }

    return bolsas[grado].pop() || null;

}

 

function crearProgreso() {

    if ($('progreso-etapa')) return;

 

    const contenedor = document.createElement('div');

    contenedor.id = 'progreso-etapa';

    contenedor.style.cssText = 'max-width:700px;margin:12px auto 18px;text-align:center;';

 

    const titulo = document.createElement('div');

    titulo.id = 'progreso-titulo';

    titulo.style.cssText = 'font-weight:700;margin-bottom:8px;color:#eef5ff;';

 

    const barra = document.createElement('div');

    barra.style.cssText = 'height:13px;background:#344765;border-radius:999px;overflow:hidden;';

 

    const relleno = document.createElement('div');

    relleno.id = 'progreso-relleno';

    relleno.style.cssText = 'height:100%;width:0%;background:#2455ff;transition:width .25s;';

    barra.appendChild(relleno);

 

    const pasos = document.createElement('div');

    pasos.id = 'progreso-pasos';

    pasos.style.cssText = 'font-size:13px;margin-top:7px;color:#b8d2ff;';

 

    contenedor.append(titulo, barra, pasos);

    const preguntaElemento = $('question');

    preguntaElemento.parentNode.insertBefore(contenedor, preguntaElemento);

}

 

function actualizarProgreso(completadas = pregunta) {

    $('progreso-titulo').textContent = `Etapa ${etapa} · ${completadas} de 6 preguntas`;

    $('progreso-relleno').style.width = `${(completadas / 6) * 100}%`;

    $('progreso-pasos').textContent = SECUENCIA.map((grado, i) => {

        const simbolo = i < completadas ? '✓' : i === completadas ? '●' : '○';

        return `${simbolo} ${NOMBRES[grado]}`;

    }).join('  ·  ');

}

 

function crearContadorAciertos() {

    if ($('aciertos')) return;

    const contador = document.createElement('div');

    contador.id = 'aciertos';

    contador.style.cssText = 'margin-top:6px;text-align:center;font-size:13px;font-weight:700;color:#86efac;';

    $('level').insertAdjacentElement('afterend', contador);

}

 

function actualizarAciertos() {

    $('aciertos').textContent = `${aciertos} ${aciertos === 1 ? 'Acierto' : 'Aciertos'}`;

}

 

function crearIndicadorRecord() {

    if ($('record')) return;

    const indicador = document.createElement('span');

    indicador.id = 'record';

    indicador.style.cssText = 'text-align:center;white-space:nowrap;';

    $('score').insertAdjacentElement('afterend', indicador);

}

 

function leerRecord() {

    try {

        return Number(localStorage.getItem('geografiaRecord') || 0);

    } catch (error) {

        return 0;

    }

}

 

function actualizarRecord() {

    const mejor = Math.max(leerRecord(), puntos);

    $('record').textContent = `🏆 Récord: ${mejor.toLocaleString('es-MX')}`;

}

 

function actualizarMarcadores() {

    $('lives').textContent = '❤️'.repeat(vidas) + '🖤'.repeat(MAX_VIDAS - vidas);

    $('score').textContent = `${puntos.toLocaleString('es-MX')} puntos`;

    actualizarAciertos();

    actualizarRecord();

}

 

// Cada ciclo de 8 preguntas contiene 6 normales, 1 bandera y 1 capital.

function crearPanelBandera() {

    if ($('panel-bandera')) return;

    const panel = document.createElement('div');

    panel.id = 'panel-bandera';

    panel.style.cssText = 'display:none;text-align:center;margin:10px auto 14px;';

    const imagen = document.createElement('img');

    imagen.id = 'imagen-bandera';

    imagen.alt = 'Bandera del país que debes localizar';

    imagen.onerror = () => { $('feedback').textContent = 'No se pudo cargar la bandera. Comprueba tu conexión a internet.'; };

    imagen.style.cssText = 'display:block;width:160px;max-width:80%;height:auto;min-height:85px;object-fit:contain;margin:0 auto;border:2px solid #dce8ff;border-radius:8px;background:#fff;';

    panel.appendChild(imagen);

    $('question').insertAdjacentElement('afterend', panel);

}

 

function mostrarBandera() {

    const panel = $('panel-bandera');

    const imagen = $('imagen-bandera');

    if (!panel || !imagen) return;

    const url = actual.bandera || (actual.iso ? `https://flagcdn.com/w160/${actual.iso.toLowerCase()}.png` : '');

    if (preguntaBandera && url) {

        imagen.src = url;

        panel.style.display = 'block';

    } else {

        panel.style.display = 'none';

        imagen.removeAttribute('src');

    }

}

 

function mostrarPregunta() {

    limpiarMarcas();

    respondida = false;

    $('next').disabled = true;

 

    const grado = SECUENCIA[pregunta];

    actual = tomarPais(grado);

    if (!actual) {

        finalizar('No hay países disponibles para esta dificultad.');

        return;

    }

 

    preguntasTotales++;

    const posicionCiclo = (preguntasTotales - 1) % 8 + 1;

    preguntaBandera = posicionCiclo === 7;

    preguntaCapitalTerritorio = posicionCiclo === 8;

 

    $('level').textContent = `Etapa ${etapa}: ${modo === 'pais' ? 'Países' : 'Capitales'}`;

    $('round').textContent = `Pregunta ${pregunta + 1}/6 · ${NOMBRES[grado]}`;

    actualizarMarcadores();

    actualizarProgreso();

 

    $('question').textContent = preguntaBandera

        ? '¿Dónde está el territorio de esta bandera?'

        : preguntaCapitalTerritorio

            ? `¿A qué territorio pertenece la capital ${actual.capital}?`

            : modo === 'pais'

                ? `¿Dónde está ${actual.pais}?`

                : `¿Dónde está ${actual.capital}, ${actual.pais}?`;

    mostrarBandera();

 

    // Las preguntas de bandera buscan el país, incluso en etapas de capitales.

    const limite = LIMITES[preguntaBandera || preguntaCapitalTerritorio ? 'pais' : modo][grado];

    $('limit').textContent = `Distancia máxima: ${limite.toLocaleString('es-MX')} km`;

    $('feedback').textContent = 'Haz clic sobre el mapa para responder.';

}

 

function finalizar(mensaje) {

    terminado = true;

    respondida = true;

    $('next').disabled = true;

    $('question').textContent = mensaje;

    $('panel-bandera').style.display = 'none';

    $('limit').textContent = `Puntuación final: ${puntos.toLocaleString('es-MX')}`;

    guardarRecord();

    $('feedback').textContent = 'Pulsa «Reiniciar partida» para jugar otra vez.';

    actualizarMarcadores();
    registrarResultado();

}

 

function responder(evento) {

    if (respondida || terminado || !actual) return;

    respondida = true;

 

    const grado = SECUENCIA[pregunta];

    const tipoUbicacion = (preguntaBandera || preguntaCapitalTerritorio) ? 'pais' : modo;

    const limite = LIMITES[tipoUbicacion][grado];

    const lat = tipoUbicacion === 'pais' ? actual.latPais : actual.latCapital;

    const lon = tipoUbicacion === 'pais' ? actual.lonPais : actual.lonCapital;

    const respuesta = [evento.latlng.lat, evento.latlng.lng];

    const correcto = [lat, lon];

    const km = Math.round(distanciaKm(...respuesta, ...correcto));

    const acierto = km <= limite;

    const ganados = acierto ? Math.round(1000 * (1 - km / limite)) : 0;

 

    puntos += ganados;

    if (acierto) aciertos++;

    else vidas--;

 

    marcas.push(L.circleMarker(respuesta, {

        radius: 9, color: '#2455ff', fillOpacity: 1

    }).addTo(map).bindPopup('Tu respuesta'));

 

    marcas.push(L.circleMarker(correcto, {

        radius: 9, color: '#12a150', fillOpacity: 1

    }).addTo(map).bindPopup(`Ubicación correcta: ${tipoUbicacion === 'pais' ? actual.pais : actual.capital}`));

 

    marcas.push(L.polyline([respuesta, correcto], {

        color: '#ffb547', weight: 3, dashArray: '7 7'

    }).addTo(map));

 

    $('feedback').textContent = `${acierto ? '✅ ¡Acertaste!' : '❌ Demasiado lejos.'} ` +

        `Error: ${km.toLocaleString('es-MX')} km. +${ganados} puntos.` +

        (acierto ? '' : ' Pierdes una vida.') +

        (preguntaBandera ? ` La bandera corresponde a ${actual.pais}.` : '') +

        (preguntaCapitalTerritorio ? ` ${actual.capital} es la capital de ${actual.pais}.` : '');

 

    guardarRecord();

    actualizarMarcadores();

    actualizarProgreso(pregunta + 1);

 

    if (vidas === 0) {

        finalizar('¡Fin de la partida!');

    } else {

        $('next').disabled = false;

    }

}

 

function avanzar() {

    if (!respondida || terminado || vidas === 0) return;

    pregunta++;

 

    if (pregunta === SECUENCIA.length) {

        etapasCompletadas++;

        puntos += BONO_ETAPA;

        guardarRecord();

        let mensaje = `¡Etapa ${etapa} completada! +${BONO_ETAPA} puntos.`;

 

        if (etapasCompletadas % 5 === 0 && vidas < MAX_VIDAS) {

            vidas++;

            mensaje += ' ¡Recuperaste una vida!';

        }

 

        etapa++;

        pregunta = 0;

 

        // Tras 12 etapas de países pasamos a las capitales.

        // Son 36 países fáciles necesarios; nuestra base contiene 38.

        if (etapa === 13 && modo === 'pais') {

            modo = 'capital';

            prepararBolsas();

            mensaje += ' ¡Ahora comienzan las capitales!';

        }

 

        // La partida termina tras 12 etapas de países y 12 de capitales.

        if (etapa > 24) {

            finalizar('🏆 ¡Completaste el Desafío Mundial!');

            return;

        }

 

        mostrarPregunta();

        $('feedback').textContent = mensaje;

        return;

    }

 

    mostrarPregunta();

}

 

function reiniciar() {

    etapa = 1;

    pregunta = 0;

    vidas = MAX_VIDAS;

    puntos = 0;

    respondida = false;

    terminado = false;

    modo = 'pais';

    etapasCompletadas = 0;

    aciertos = 0;

    preguntasTotales = 0;

    preguntaBandera = false;

    preguntaCapitalTerritorio = false;

    prepararBolsas();

    mostrarPregunta();

}

 

async function iniciar() {

    crearProgreso();

    crearContadorAciertos();

    crearIndicadorRecord();

    crearPanelBandera();

    try {

        const respuesta = await fetch('./paises.json', { cache: 'no-store' });

        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

        const datos = await respuesta.json();

        if (!Array.isArray(datos)) throw new Error('El archivo no contiene una lista de países.');

 

        paises = datos.map(p => ({

            ...p,

            grado: Number(p.grado) === 4 ? 3 : Number(p.grado),

            latPais: Number(p.latPais),

            lonPais: Number(p.lonPais),

            latCapital: Number(p.latCapital),

            lonCapital: Number(p.lonCapital)

        })).filter(p =>

            [1, 2, 3].includes(p.grado) &&

            p.pais && p.capital &&

            [p.latPais, p.lonPais, p.latCapital, p.lonCapital].every(Number.isFinite)

        );

 

        if ([1, 2, 3].some(grado => !paises.some(p => p.grado === grado))) {

            throw new Error('Faltan países de alguna dificultad.');

        }

        reiniciar();

    } catch (error) {

        console.error(error);

        $('question').textContent = 'No se pudo cargar paises.json';

        $('feedback').textContent = 'Verifica que paises.json esté en la misma carpeta y abre el juego con Live Server.';

        $('next').disabled = true;

    }

}

 

map.on('click', responder);

$('next').addEventListener('click', avanzar);

$('restart').addEventListener('click', () => {

    if (paises.length) reiniciar();

});

iniciar();

// Ranking independiente de Imperio Hotelero.
const nombreInput = $('jugador');
try { nombreInput.value = localStorage.getItem('geografiaApodo') || ''; } catch {}
nombreInput.addEventListener('change', () => {
    try { localStorage.setItem('geografiaApodo', nombreInput.value.trim()); } catch {}
});
let pendiente = null;
let guardando = false;
function registrarResultado() {
    pendiente = { puntos, etapa: Math.min(etapa, 24), aciertos,
        mes: new Date().toISOString().slice(0, 7) };
    enviarResultado();
}
async function enviarResultado() {
    if (!pendiente || guardando) return;
    const nombre = nombreInput.value.trim();
    if (!nombre) {
        $('estado-ranking').textContent = 'Escribe tu apodo y pulsa Reintentar guardar.';
        $('reintentar-ranking').hidden = false;
        return;
    }
    const resultado = pendiente;
    guardando = true;
    $('estado-ranking').textContent = 'Guardando puntuación...';
    try {
        await guardarResultado(nombre, resultado);
        if (pendiente === resultado) pendiente = null;
        $('estado-ranking').textContent = 'Puntuación registrada. Se conserva tu mejor resultado.';
    } catch (error) {
        console.error(error);
        $('estado-ranking').textContent = 'No se pudo guardar. Puedes reintentar.';
    } finally {
        guardando = false;
        $('reintentar-ranking').hidden = !pendiente;
    }
}
$('reintentar-ranking').addEventListener('click', enviarResultado);
let consulta = 0;
async function mostrarRanking(historico = false) {
    const turno = ++consulta;
    $('tabla-ranking').hidden = false;
    $('titulo-ranking').textContent = historico ? 'Ranking histórico' : 'Ranking mensual (UTC)';
    const cuerpo = $('filas-ranking');
    cuerpo.replaceChildren();
    const mensaje = texto => {
        const fila = cuerpo.insertRow();
        const celda = fila.insertCell();
        celda.colSpan = 4;
        celda.textContent = texto;
    };
    mensaje('Cargando...');
    try {
        const lista = await consultarRanking(historico);
        if (turno !== consulta) return;
        cuerpo.replaceChildren();
        if (!lista.length) mensaje('Todavía no hay puntuaciones.');
        lista.forEach((r, i) => {
            const fila = cuerpo.insertRow();
            [i + 1, r.nombre, Number(r.puntos).toLocaleString('es-MX'), r.etapa]
                .forEach(valor => { fila.insertCell().textContent = String(valor ?? ''); });
        });
    } catch (error) {
        if (turno !== consulta) return;
        console.error(error);
        cuerpo.replaceChildren();
        mensaje('No se pudo consultar el ranking. Intenta de nuevo.');
    }
}
$('ver-ranking').addEventListener('click', () => {
    if (!$('tabla-ranking').hidden) {
        consulta++;
        $('tabla-ranking').hidden = true;
    } else mostrarRanking();
});
$('ranking-mensual').addEventListener('click', () => mostrarRanking());
$('ranking-historico').addEventListener('click', () => mostrarRanking(true));
