import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

import { esc, quetzales, fecha, iniciales, etiquetaEstado, etiquetaStock, colorLomo, debounce, vacio } from '../src/ui.js';

test('esc neutraliza HTML, comillas y valores nulos', () => {
    assert.equal(esc('<img src=x onerror="a()"> & \'b\''), '&lt;img src=x onerror=&quot;a()&quot;&gt; &amp; &#39;b&#39;');
    assert.equal(esc(null), '');
    assert.equal(esc(undefined), '');
    assert.equal(esc(42), '42');
});

test('quetzales formatea con dos decimales y tolera nulos', () => {
    assert.match(quetzales(1250), /1,250\.00/);
    assert.match(quetzales(null), /0\.00/);
});

test('fecha muestra un guion si no hay valor y el año si lo hay', () => {
    assert.equal(fecha(''), '—');
    assert.equal(fecha(null), '—');
    assert.match(fecha('2026-03-05T10:00:00.000Z'), /2026/);
});

test('iniciales toma hasta dos palabras en mayúsculas', () => {
    assert.equal(iniciales('Ana Lucía Pérez'), 'AL');
    assert.equal(iniciales('  maría   '), 'M');
    assert.equal(iniciales(''), '');
});

test('etiquetaEstado distingue devuelto, vencido y activo', () => {
    assert.match(etiquetaEstado('devuelto'), /Devuelto/);
    assert.match(etiquetaEstado('vencido', 3), /Vencido · 3 d/);
    assert.match(etiquetaEstado('activo'), /Activo/);
});

test('etiquetaStock marca agotado, pocos y suficientes', () => {
    assert.match(etiquetaStock(0), /Agotado/);
    assert.match(etiquetaStock(2), /Quedan 2/);
    assert.match(etiquetaStock(7), /7 en estante/);
});

test('colorLomo es estable para el mismo género y siempre devuelve un color', () => {
    assert.equal(colorLomo('Novela'), colorLomo('Novela'));
    assert.match(colorLomo('Historia'), /^#[0-9a-f]{6}$/i);
    assert.match(colorLomo(), /^#[0-9a-f]{6}$/i);
});

test('debounce ejecuta solo la última llamada después de la espera', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const llamadas = [];
    const buscar = debounce((x) => llamadas.push(x), 250);
    buscar('a'); buscar('ab'); buscar('abc');
    mock.timers.tick(249);
    assert.deepEqual(llamadas, []);
    mock.timers.tick(1);
    assert.deepEqual(llamadas, ['abc']);
    mock.timers.reset();
});

test('vacio escapa el título y el texto', () => {
    assert.ok(!vacio('<b>x</b>', '<i>y</i>').includes('<b>'));
    assert.match(vacio('Sin datos', 'Agrega uno'), /Sin datos/);
});