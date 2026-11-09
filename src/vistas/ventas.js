// Ventas (admin): caja con carrito de varios libros + historial.

import { api } from "../api.js";
import { abrirModal, avisar, avisarError, esc, fecha, quetzales, vacio } from "../ui.js";

export function detalleVenta(v) {
    return `
    <p><strong>${esc(v.cliente?.nombre)}</strong> · ID ${esc(v.cliente?.identificacion)}<br><span class="libro__autor">${fecha(v.fecha)} · Venta #${v.id}</span></p>
    <div class="tabla-caja"><table>
        <thead><tr><th>Libro</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
        <tbody>${v.items.map((i) => `<tr><td>${esc(i.titulo)}</td><td class="num">${i.cantidad}</td><td class="num">${quetzales(i.precioUnitario)}</td><td class="num">${quetzales(i.subtotal)}</td></tr>`).join("")}</tbody>
    </table></div>
    <div class="carrito__total"><span>Total</span><span>${quetzales(v.total)}</span></div>`;
}

export async function ventas(raiz) {
    let libros = [];
    let clientes = [];
    let historial = [];
    const carrito = new Map(); // libroId -> cantidad

    raiz.innerHTML = `
    <header class="encabezado"><div><h1>Ventas</h1><p>Registra la compra de uno o varios libros.</p></div></header>
    <section class="venta">
        <div class="tarjeta">
            <h3>Nueva venta</h3>
            <div class="campos">
                <div class="campo"><label>Cliente</label><select id="v-cliente"></select></div>
                <div class="campos campos--2" style="grid-template-columns: 1fr auto; align-items:end">
                    <div class="campo"><label>Agregar libro</label><select id="v-libro"></select></div>
                    <button class="btn btn--suave" id="v-agregar" type="button">Agregar</button>
                </div>
            </div>
            <div id="v-carrito" style="margin-top:12px"></div>
            <button class="btn btn--acento btn--bloque" id="v-registrar" disabled>Registrar venta</button>
        </div>
        <div class="tarjeta">
            <h3>Historial</h3>
            <p class="libro__autor" id="v-ingresos"></p>
            <ul class="lista-simple" id="v-historial"></ul>
        </div>
    </section>`;

    const $ = (sel) => raiz.querySelector(sel);

    function pintarCarrito() {
        const lineas = [...carrito].map(([id, cantidad]) => ({ libro: libros.find((l) => l.id === id), cantidad }));
        const total = lineas.reduce((s, { libro, cantidad }) => s + libro.precio * cantidad, 0);
        $("#v-carrito").innerHTML = lineas.length ? `
            ${lineas.map(({ libro, cantidad }) => `
            <div class="carrito__linea">
                <span>${esc(libro.titulo)}<span class="sub libro__autor">${quetzales(libro.precio)} c/u</span></span>
                <input type="number" min="1" max="${libro.stock}" value="${cantidad}" data-cantidad="${libro.id}" aria-label="Cantidad">
                <span class="num">${quetzales(libro.precio * cantidad)}</span>
                <button class="carrito__quitar" data-quitar="${libro.id}" aria-label="Quitar">×</button>
            </div>`).join("")}
            <div class="carrito__total"><span>Total</span><span>${quetzales(total)}</span></div>`
            : vacio("Carrito vacío", "Agrega libros para comenzar.");
        $("#v-registrar").disabled = !lineas.length || !$("#v-cliente").value;
    }

    function pintarHistorial() {
        const ingresos = historial.reduce((s, v) => s + v.total, 0);
        $("#v-ingresos").textContent = `${historial.length} venta(s) · ${quetzales(ingresos)} en total`;
        $("#v-historial").innerHTML = historial.length
            ? historial.map((v) => `
                <li><span><strong>${esc(v.cliente?.nombre)}</strong><span class="sub libro__autor">${fecha(v.fecha)} · ${v.unidades} libro(s)</span></span>
                <span style="text-align:right">${quetzales(v.total)}<br><button class="btn btn--suave btn--mini" data-ver="${v.id}">Ver</button></span></li>`).join("")
            : `<li class="vacio">Sin ventas todavía.</li>`;
    }

    async function cargar() {
        try {
            [{ datos: libros }, { datos: clientes }, { datos: historial }] = await Promise.all([
                api.get("/libros"), api.get("/usuarios", { rol: "usuario" }), api.get("/ventas")
            ]);
            const elegido = $("#v-cliente").value;
            $("#v-cliente").innerHTML = `<option value="">Elige el cliente…</option>` +
                clientes.map((c) => `<option value="${c.id}">${esc(c.nombre)} · ${esc(c.identificacion)}</option>`).join("");
            $("#v-cliente").value = elegido;
            $("#v-libro").innerHTML = libros.filter((l) => l.stock > 0)
                .map((l) => `<option value="${l.id}">${esc(l.titulo)} — ${quetzales(l.precio)} (${l.stock})</option>`).join("");
            pintarCarrito();
            pintarHistorial();
        } catch (e) { avisarError(e); }
    }

    $("#v-cliente").addEventListener("change", pintarCarrito);

    $("#v-agregar").addEventListener("click", () => {
        const id = Number($("#v-libro").value);
        const libro = libros.find((l) => l.id === id);
        if (!libro) return;
        const actual = carrito.get(id) || 0;
        if (actual >= libro.stock) return avisar(`Solo hay ${libro.stock} ejemplar(es) de "${libro.titulo}".`, "error");
        carrito.set(id, actual + 1);
        pintarCarrito();
    });

    $("#v-carrito").addEventListener("change", (ev) => {
        const id = Number(ev.target.dataset.cantidad);
        if (!id) return;
        const libro = libros.find((l) => l.id === id);
        carrito.set(id, Math.min(libro.stock, Math.max(1, Number(ev.target.value) || 1)));
        pintarCarrito();
    });

    $("#v-carrito").addEventListener("click", (ev) => {
        const id = Number(ev.target.dataset.quitar);
        if (!id) return;
        carrito.delete(id);
        pintarCarrito();
    });

    $("#v-registrar").addEventListener("click", async () => {
        const cuerpo = {
            clienteId: Number($("#v-cliente").value),
            items: [...carrito].map(([libroId, cantidad]) => ({ libroId, cantidad }))
        };
        $("#v-registrar").disabled = true;
        try {
            const r = await api.post("/ventas", cuerpo);
            avisar(`${r.mensaje} Total ${quetzales(r.datos.total)}.`);
            carrito.clear();
            await cargar();
        } catch (e) {
            avisarError(e);
            pintarCarrito();
        }
    });

    $("#v-historial").addEventListener("click", (ev) => {
        const venta = historial.find((v) => v.id === Number(ev.target.dataset.ver));
        if (venta) abrirModal({ titulo: `Venta #${venta.id}`, cuerpo: detalleVenta(venta), soloLectura: true });
    });

    await cargar();
}
