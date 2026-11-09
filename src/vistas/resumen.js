// Resumen de administración: inventario, alertas y movimiento.

import { api } from "../api.js";
import { esc, fecha, quetzales } from "../ui.js";

const metrica = (etiqueta, valor, pie = "") => `
    <div class="tarjeta metrica">
        <div class="metrica__etiqueta">${etiqueta}</div>
        <div class="metrica__valor">${valor}</div>
        ${pie ? `<div class="metrica__pie">${pie}</div>` : ""}
    </div>`;

const lista = (items, fila, vacio) =>
    `<ul class="lista-simple">${items.length ? items.map(fila).join("") : `<li class="vacio">${vacio}</li>`}</ul>`;

export async function resumen(raiz, { usuario }) {
    const { datos: d } = await api.get("/inventario");
    const generos = Object.entries(d.ejemplaresPorGenero).sort((a, b) => b[1] - a[1]);
    const maximo = Math.max(1, ...generos.map(([, n]) => n));

    raiz.innerHTML = `
    <header class="encabezado">
        <div>
            <h1>Buen día, ${esc(usuario.nombre.split(" ")[0])}</h1>
            <p>Así va la biblioteca hoy, ${fecha(new Date().toLocaleDateString("en-CA"))}.</p>
        </div>
    </header>

    <section class="rejilla rejilla--metricas">
        ${metrica("Títulos", d.titulos, `${d.clientes} clientes registrados`)}
        ${metrica("En estante", d.ejemplaresEnEstante, `${d.ejemplaresPrestados} prestados ahora`)}
        ${metrica("Valor del inventario", quetzales(d.valorInventario))}
        ${metrica("Ventas", quetzales(d.ventas.ingresos), `${d.ventas.cantidad} transacción(es)`)}
        ${metrica("Préstamos", d.prestamosActivos + d.prestamosVencidos.length, d.prestamosVencidos.length ? `<span class="etiqueta etiqueta--error">${d.prestamosVencidos.length} vencido(s)</span>` : "Todos al día")}
    </section>

    <section class="rejilla rejilla--2">
        <div class="tarjeta">
            <h3>Préstamos vencidos</h3>
            ${lista(d.prestamosVencidos, (p) => `<li><span>${esc(p.libro.titulo)}<span class="libro__autor"> · ${esc(p.usuario?.nombre)}</span></span><span class="etiqueta etiqueta--error">${p.diasRetraso} día(s)</span></li>`, "No hay préstamos vencidos 🎉")}
        </div>
        <div class="tarjeta">
            <h3>Reponer pronto</h3>
            ${lista([...d.agotados, ...d.stockBajo], (l) => `<li><span>${esc(l.titulo)}</span>${l.stock === 0 ? `<span class="etiqueta etiqueta--error">Agotado</span>` : `<span class="etiqueta etiqueta--aviso">Quedan ${l.stock}</span>`}</li>`, "Todo el inventario está bien surtido.")}
        </div>
        <div class="tarjeta">
            <h3>Más vendidos</h3>
            ${lista(d.masVendidos, (v) => `<li><span>${esc(v.titulo)}</span><span>${v.unidades} u · ${quetzales(v.ingresos)}</span></li>`, "Aún no hay ventas registradas.")}
        </div>
        <div class="tarjeta">
            <h3>Ejemplares por género</h3>
            <div class="barras">
                ${generos.map(([g, n]) => `
                <div class="barras__fila"><span>${esc(g)}</span><div class="barras__pista"><div style="width:${(n / maximo) * 100}%"></div></div><span>${n}</span></div>`).join("")}
            </div>
        </div>
    </section>`;
}
