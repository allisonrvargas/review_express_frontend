// Usuarios / clientes (admin): ficha, alta de clientes de mostrador, edición e historial.

import { api } from "../api.js";
import { abrirModal, avisar, avisarError, debounce, esc, etiquetaEstado, fecha, quetzales, vacio } from "../ui.js";

// Formulario de datos personales. La identificación solo se escribe al crear.
export function formularioPersona(p = {}, { creando = false, conClave = false } = {}) {
    return `
    <div class="campos campos--2">
        <div class="campo campo--ancho"><label>Nombre completo</label><input name="nombre" value="${esc(p.nombre)}" required minlength="3"></div>
        <div class="campo"><label>Identificación</label>
            <input name="identificacion" value="${esc(p.identificacion)}" ${creando ? "required" : "disabled"} inputmode="numeric" pattern="\\d{6,15}" title="Entre 6 y 15 dígitos">
            ${creando ? "" : "<small>La identificación no se puede cambiar.</small>"}</div>
        <div class="campo"><label>Teléfono</label><input name="telefono" value="${esc(p.telefono)}" required></div>
        <div class="campo campo--ancho"><label>Dirección</label><input name="direccion" value="${esc(p.direccion)}" required minlength="5"></div>
        <div class="campo campo--ancho"><label>Correo</label><input name="email" type="email" value="${esc(p.email)}" required></div>
        ${conClave ? `<div class="campo campo--ancho"><label>${creando ? "Contraseña (opcional)" : "Nueva contraseña (opcional)"}</label>
            <input name="clave" type="password" minlength="8" autocomplete="new-password">
            <small>${creando ? "Sin contraseña el cliente solo compra; no podrá iniciar sesión." : "Déjala vacía para conservar la actual."}</small></div>` : ""}
    </div>`;
}

const sinVacios = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ""));

async function verFicha(id) {
    const [{ datos: u }, { datos: prestamos }, { datos: compras }] = await Promise.all([
        api.get(`/usuarios/${id}`), api.get(`/usuarios/${id}/prestamos`), api.get(`/usuarios/${id}/compras`)
    ]);
    await abrirModal({
        titulo: u.nombre,
        soloLectura: true,
        cuerpo: `
        <ul class="lista-simple">
            <li><span>Identificación</span><strong>${esc(u.identificacion)}</strong></li>
            <li><span>Teléfono</span><span>${esc(u.telefono)}</span></li>
            <li><span>Correo</span><span>${esc(u.email)}</span></li>
            <li><span>Dirección</span><span>${esc(u.direccion)}</span></li>
            <li><span>Total comprado</span><strong>${quetzales(u.resumen.totalGastado)}</strong></li>
        </ul>
        <h3 style="margin:18px 0 8px">Préstamos (${prestamos.length})</h3>
        <ul class="lista-simple">${prestamos.map((p) => `<li><span>${esc(p.libro.titulo)}<span class="sub libro__autor">${fecha(p.fechaPrestamo)} → ${fecha(p.fechaDevolucionTentativa)}</span></span>${etiquetaEstado(p.estado, p.diasRetraso)}</li>`).join("") || `<li class="vacio">Sin préstamos</li>`}</ul>
        <h3 style="margin:18px 0 8px">Compras (${compras.length})</h3>
        <ul class="lista-simple">${compras.map((v) => `<li><span>${v.items.map((i) => esc(i.titulo)).join(", ")}<span class="sub libro__autor">${fecha(v.fecha)}</span></span><strong>${quetzales(v.total)}</strong></li>`).join("") || `<li class="vacio">Sin compras</li>`}</ul>`
    });
}

export async function clientes(raiz) {
    let q = "";
    let lista = [];

    raiz.innerHTML = `
    <header class="encabezado">
        <div><h1>Usuarios y clientes</h1><p id="cl-total">Cargando…</p></div>
        <button class="btn btn--acento" id="btn-nuevo-cliente">+ Nuevo cliente</button>
    </header>
    <div class="herramientas"><label class="buscador"><input id="cl-q" type="search" placeholder="Buscar por nombre, identificación, correo o teléfono…" aria-label="Buscar"></label></div>
    <div id="cl-tabla"></div>`;

    async function cargar() {
        try {
            ({ datos: lista } = await api.get("/usuarios", { q, rol: "usuario" }));
            raiz.querySelector("#cl-total").textContent = `${lista.length} cliente(s)`;
            raiz.querySelector("#cl-tabla").innerHTML = lista.length ? `
            <div class="tabla-caja"><table>
                <thead><tr><th>Nombre</th><th>Identificación</th><th>Contacto</th><th>Dirección</th><th></th></tr></thead>
                <tbody>${lista.map((u) => `
                <tr>
                    <td><strong>${esc(u.nombre)}</strong>${u.puedeIniciarSesion ? "" : `<span class="sub">Cliente de mostrador</span>`}</td>
                    <td>${esc(u.identificacion)}</td>
                    <td>${esc(u.email)}<span class="sub">${esc(u.telefono)}</span></td>
                    <td>${esc(u.direccion)}</td>
                    <td style="white-space:nowrap">
                        <button class="btn btn--suave btn--mini" data-ver="${u.id}">Ficha</button>
                        <button class="btn btn--suave btn--mini" data-editar="${u.id}">Editar</button>
                    </td>
                </tr>`).join("")}</tbody>
            </table></div>` : vacio("No se encontraron clientes", "");
        } catch (e) { avisarError(e); }
    }

    raiz.querySelector("#cl-q").addEventListener("input", debounce((ev) => { q = ev.target.value; cargar(); }));

    raiz.querySelector("#btn-nuevo-cliente").addEventListener("click", async () => {
        const datos = await abrirModal({ titulo: "Nuevo cliente", cuerpo: formularioPersona({}, { creando: true, conClave: true }), aceptar: "Registrar cliente" });
        if (!datos) return;
        try {
            const r = await api.post("/usuarios", sinVacios(datos));
            avisar(r.mensaje);
            cargar();
        } catch (e) { avisarError(e); }
    });

    raiz.querySelector("#cl-tabla").addEventListener("click", async (ev) => {
        const { ver, editar } = ev.target.dataset;
        try {
            if (ver) return await verFicha(ver);
            if (editar) {
                const persona = lista.find((u) => u.id === Number(editar));
                const datos = await abrirModal({ titulo: "Editar cliente", cuerpo: formularioPersona(persona, { conClave: true }) });
                if (!datos) return;
                const r = await api.patch(`/usuarios/${editar}`, sinVacios(datos));
                avisar(r.mensaje);
                cargar();
            }
        } catch (e) { avisarError(e); }
    });

    await cargar();
}
