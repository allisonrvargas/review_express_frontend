import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Un "navegador" mínimo para el cliente de la API
const almacen = new Map();
globalThis.sessionStorage = {
    getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
    setItem: (k, v) => almacen.set(k, String(v)),
    removeItem: (k) => almacen.delete(k)
};
globalThis.document = new EventTarget();

const { pedir, api, sesion, ErrorApi, API_URL } = await import('../src/api.js');

let peticiones;
const responder = (estado, cuerpo, headers = {}) => async (url, opciones) => {
    peticiones.push({ url: String(url), ...opciones });
    return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json', ...headers } });
};

beforeEach(() => { almacen.clear(); peticiones = []; });
afterEach(() => { delete globalThis.fetch; });

test('por defecto apunta a la API local y sin barra final', () => {
    assert.equal(API_URL, 'http://localhost:3000/api');
});

test('la sesión se guarda, se lee y se borra; un JSON dañado se ignora', () => {
    sesion.guardar({ token: 'abc' });
    assert.deepEqual(sesion.leer(), { token: 'abc' });
    sesion.borrar();
    assert.equal(sesion.leer(), null);
    almacen.set('librarian.sesion', '{no es json');
    assert.equal(sesion.leer(), null);
});

test('GET arma la consulta y omite los valores vacíos', async () => {
    globalThis.fetch = responder(200, { ok: true });
    await api.get('/libros', { genero: 'Novela', texto: '', pagina: undefined, orden: 'titulo' });
    assert.equal(peticiones[0].url, 'http://localhost:3000/api/libros?genero=Novela&orden=titulo');
    assert.equal(peticiones[0].method, 'GET');
});

test('envía el token Bearer y el cuerpo JSON cuando hay sesión', async () => {
    sesion.guardar({ token: 'tok123' });
    globalThis.fetch = responder(201, { id: 1 });
    await api.post('/prestamos', { libroId: 7 });
    const p = peticiones[0];
    assert.equal(p.headers.Authorization, 'Bearer tok123');
    assert.equal(p.headers['Content-Type'], 'application/json');
    assert.equal(p.body, JSON.stringify({ libroId: 7 }));
    assert.equal(p.method, 'POST');
});

test('un error de la API se convierte en ErrorApi con su estado y detalles', async () => {
    globalThis.fetch = responder(400, { error: 'Datos inválidos', detalles: ['precio'] });
    await assert.rejects(pedir('/libros', { metodo: 'POST', cuerpo: {} }), (e) => {
        assert.ok(e instanceof ErrorApi);
        assert.equal(e.status, 400);
        assert.equal(e.message, 'Datos inválidos');
        assert.deepEqual(e.detalles, ['precio']);
        return true;
    });
});

test('un 401 con sesión avisa a la app para volver al login', async () => {
    sesion.guardar({ token: 'vencido' });
    let avisos = 0;
    const oyente = () => { avisos++; };
    document.addEventListener('sesion-vencida', oyente);
    globalThis.fetch = responder(401, { error: 'Sesión expirada' });
    await assert.rejects(api.get('/perfil'), ErrorApi);
    document.removeEventListener('sesion-vencida', oyente);
    assert.equal(avisos, 1);
});

test('un 401 sin sesión (login fallido) no cierra nada', async () => {
    let avisos = 0;
    const oyente = () => { avisos++; };
    document.addEventListener('sesion-vencida', oyente);
    globalThis.fetch = responder(401, { error: 'Correo o contraseña incorrectos.' });
    await assert.rejects(api.post('/auth/login', {}), ErrorApi);
    document.removeEventListener('sesion-vencida', oyente);
    assert.equal(avisos, 0);
});

test('sin conexión devuelve un error claro con estado 0', async () => {
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    await assert.rejects(api.get('/libros'), (e) => e.status === 0 && /No hay conexión con la API/.test(e.message));
});

test('lee el cupo de peticiones del header RateLimit', async () => {
    let cupo;
    const oyente = (e) => { cupo = e.detail; };
    document.addEventListener('cupo', oyente);
    globalThis.fetch = responder(200, {}, { RateLimit: 'limit=100, remaining=87, reset=42' });
    await api.get('/libros');
    document.removeEventListener('cupo', oyente);
    assert.deepEqual(cupo, { limite: 100, restantes: 87, reinicio: 42 });
});