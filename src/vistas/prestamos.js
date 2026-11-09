// Préstamos (admin): registrar, filtrar y recibir devoluciones.

import { api } from "../api.js";
import { abrirModal, avisar, avisarError, esc, etiquetaEstado, fecha, hoyISO, vacio } from "../ui.js";

let estadoFiltro = "";

function sumarDias(iso, dias) {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return d.toLocaleDateString("en-CA");
}

export async function prestamos(raiz) {
    raiz.innerHTML = `
    <header class="encabezado">
        <div><h1>Préstamos</h1><p id="pr-total">Cargando…</p></div>
        <button class="btn btn--acento" id="btn-prestar">+ Prestar libro</button>
    </header>
    <div class="herramientas">
        <div class="pestanas" role="tablist" id="pr-filtros" style="margin:0">
            <button data-estado="">Todos</button>
            <button data-estado="activo">Activos</button>
            <button data-estado="vencido">Vencidos</button>
            <button data-estado="devuelto">Devueltos</button>
        </div>
    </div>
    <div id="pr-tabla"></div>`;

    const filtrosBtns = raiz.querySelectorAll("#pr-filtros button");
    const marcarFiltro = () => filtrosBtns.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.estado === estadoFiltro)));

    async function cargar() {
        marcarFiltro();
        try {
            const { datos } = await api.get("/prestamos", { estado: estadoFiltro });
            raiz.querySelector("#pr-total").textContent = `${datos.length} préstamo(s)`;
            raiz.querySelector("#pr-tabla").innerHTML = datos.length ? `
            <div class="tabla-caja"><table>
                <thead><tr><th>Libro</th><th>Usuario</th><th>Prestado</th><th>Devolver antes de</th><th>Devuelto</th><th>Estado</th><th></th></tr></thead>
                <tbody>${datos.map((p) => `
                    <tr>
                        <td><strong>${esc(p.libro.titulo)}</strong><span class="sub">${esc(p.libro.autor)}</span></td>
                        <td>${esc(p.usuario?.nombre)}<span class="sub">ID ${esc(p.usuario?.identificacion)}</span></td>
                        <td>${fecha(p.fechaPrestamo)}</td>
                        <td>${fecha(p.fechaDevolucionTentativa)}</td>
                        <td>${fecha(p.fechaDevolucion)}</td>
                        <td>${etiquetaEstado(p.estado, p.diasRetraso)}</td>
                        <td>${p.fechaDevolucion ? "" : `<button class="btn btn--suave btn--mini" data-devolver="${p.id}" data-titulo="${esc(p.libro.titulo)}">Recibir</button>`}</td>
                    </tr>`).join("")}
                </tbody>
            </table></div>` : vacio("No hay préstamos aquí", "");
        } catch (e) { avisarError(e); }
    }

    raiz.querySelector("#pr-filtros").addEventListener("click", (ev) => {
        if (ev.target.dataset.estado === undefined) return;
        estadoFiltro = ev.target.dataset.estado;
        cargar();
    });

    raiz.querySelector("#pr-tabla").addEventListener("click", async (ev) => {
        const id = ev.target.dataset.devolver;
        if (!id) return;
        const datos = await abrirModal({
            titulo: "Registrar devolución",
            cuerpo: `<p>¿Recibiste <strong>${esc(ev.target.dataset.titulo)}</strong>?</p>
                     <div class="campo"><label>Fecha de devolución</label><input type="date" name="fechaDevolucion" value="${hoyISO()}" max="${hoyISO()}" required></div>`,
            aceptar: "Registrar devolución"
        });
        if (!datos) return;
        try {
            const r = await api.patch(`/prestamos/${id}/devolucion`, datos);
            avisar(r.datos.diasRetraso ? `${r.mensaje} Llegó con ${r.datos.diasRetraso} día(s) de retraso.` : r.mensaje);
            cargar();
        } catch (e) { avisarError(e); }
    });

    raiz.querySelector("#btn-prestar").addEventListener("click", async () => {
        try {
            const [{ datos: libros }, { datos: usuarios }] = await Promise.all([
                api.get("/libros", { disponible: "true" }),
                api.get("/usuarios", { rol: "usuario" })
            ]);
            const hoy = hoyISO();
            const datos = await abrirModal({
                titulo: "Prestar libro",
                aceptar: "Registrar préstamo",
                cuerpo: `
                <div class="campos campos--2">
                    <div class="campo campo--ancho"><label>Libro</label>
                        <select name="libroId" required><option value="">Elige un libro disponible…</option>
                        ${libros.map((l) => `<option value="${l.id}">${esc(l.titulo)} — ${esc(l.autor)} (${l.stock})</option>`).join("")}</select></div>
                    <div class="campo campo--ancho"><label>Usuario</label>
                        <select name="usuarioId" required><option value="">Elige a quién se presta…</option>
                        ${usuarios.map((u) => `<option value="${u.id}">${esc(u.nombre)} · ${esc(u.identificacion)}</option>`).join("")}</select></div>
                    <div class="campo"><label>Fecha de préstamo</label><input type="date" name="fechaPrestamo" value="${hoy}" max="${hoy}" required></div>
                    <div class="campo"><label>Devolución tentativa</label><input type="date" name="fechaDevolucionTentativa" value="${sumarDias(hoy, 14)}" min="${hoy}" required></div>
                </div>`,
                alAbrir: (modal) => {
                    const inicio = modal.querySelector("[name=fechaPrestamo]");
                    const fin = modal.querySelector("[name=fechaDevolucionTentativa]");
                    inicio.addEventListener("change", () => { fin.min = inicio.value; fin.value = sumarDias(inicio.value, 14); });
                }
            });
            if (!datos) return;
            const r = await api.post("/prestamos", { ...datos, libroId: Number(datos.libroId), usuarioId: Number(datos.usuarioId) });
            avisar(`${r.mensaje} "${r.datos.libro.titulo}" para ${r.datos.usuario.nombre}.`);
            cargar();
        } catch (e) { avisarError(e); }
    });

    await cargar();
}
