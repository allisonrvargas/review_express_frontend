// Vistas del rol "usuario": mis préstamos, mis compras y mi perfil.

import { api } from "../api.js";
import { abrirModal, avisar, avisarError, esc, etiquetaEstado, fecha, quetzales, vacio } from "../ui.js";
import { formularioPersona } from "./clientes.js";
import { detalleVenta } from "./ventas.js";

export async function misPrestamos(raiz) {
    const { datos } = await api.get("/perfil/prestamos");
    const activos = datos.filter((p) => p.estado !== "devuelto").length;

    raiz.innerHTML = `
    <header class="encabezado"><div><h1>Mis préstamos</h1><p>${activos} en tus manos · ${datos.length} en total</p></div></header>
    ${datos.length ? `
    <div class="tabla-caja"><table>
        <thead><tr><th>Libro</th><th>Lo recibiste</th><th>Devolver antes de</th><th>Lo devolviste</th><th>Estado</th></tr></thead>
        <tbody>${datos.map((p) => `
        <tr>
            <td><strong>${esc(p.libro.titulo)}</strong><span class="sub">${esc(p.libro.autor)}</span></td>
            <td>${fecha(p.fechaPrestamo)}</td>
            <td>${fecha(p.fechaDevolucionTentativa)}</td>
            <td>${fecha(p.fechaDevolucion)}</td>
            <td>${etiquetaEstado(p.estado, p.diasRetraso)}</td>
        </tr>`).join("")}</tbody>
    </table></div>` : vacio("Aún no has pedido libros prestados", "Visita el catálogo y pide uno en mostrador.")}`;
}

export async function misCompras(raiz) {
    const { datos, gastado } = await api.get("/perfil/compras");

    raiz.innerHTML = `
    <header class="encabezado"><div><h1>Mis compras</h1><p>${datos.length} compra(s) · ${quetzales(gastado)} en total</p></div></header>
    ${datos.length ? `
    <div class="tabla-caja"><table>
        <thead><tr><th>Fecha</th><th>Libros</th><th>Unidades</th><th>Total</th><th></th></tr></thead>
        <tbody>${datos.map((v) => `
        <tr>
            <td>${fecha(v.fecha)}</td>
            <td>${v.items.map((i) => esc(i.titulo)).join(", ")}</td>
            <td class="num">${v.unidades}</td>
            <td class="num"><strong>${quetzales(v.total)}</strong></td>
            <td><button class="btn btn--suave btn--mini" data-ver="${v.id}">Detalle</button></td>
        </tr>`).join("")}</tbody>
    </table></div>` : vacio("Todavía no tienes compras", "")}`;

    raiz.addEventListener("click", (ev) => {
        const venta = datos.find((v) => v.id === Number(ev.target.dataset.ver));
        if (venta) abrirModal({ titulo: `Compra #${venta.id}`, cuerpo: detalleVenta(venta), soloLectura: true });
    });
}

export async function miPerfil(raiz, { alActualizar }) {
    const { datos: yo } = await api.get("/perfil");

    raiz.innerHTML = `
    <header class="encabezado"><div><h1>Mi perfil</h1><p>Cliente desde ${fecha(yo.creadoEn)}</p></div></header>
    <section class="rejilla rejilla--metricas">
        <div class="tarjeta metrica"><div class="metrica__etiqueta">Préstamos activos</div><div class="metrica__valor">${yo.resumen.prestamosActivos}</div></div>
        <div class="tarjeta metrica"><div class="metrica__etiqueta">Libros leídos aquí</div><div class="metrica__valor">${yo.resumen.prestamosTotales}</div></div>
        <div class="tarjeta metrica"><div class="metrica__etiqueta">Compras</div><div class="metrica__valor">${quetzales(yo.resumen.totalGastado)}</div></div>
    </section>
    <form class="tarjeta" id="form-perfil" style="max-width:680px">
        <h3>Mis datos</h3>
        ${formularioPersona(yo, { conClave: true })}
        <div style="margin-top:16px; display:flex; justify-content:flex-end"><button class="btn" type="submit">Guardar cambios</button></div>
    </form>`;

    raiz.querySelector("#form-perfil").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const datos = Object.fromEntries(new FormData(ev.target));
        if (!datos.clave) delete datos.clave;
        try {
            const r = await api.patch("/perfil", datos);
            avisar(r.mensaje);
            alActualizar(r.datos);
            ev.target.querySelector("[name=clave]").value = "";
        } catch (e) { avisarError(e); }
    });
}
