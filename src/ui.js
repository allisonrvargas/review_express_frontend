// Utilidades de interfaz: escape de HTML, formatos, avisos y modal.

import { ErrorApi } from "./api.js";

// Todo lo que viene del servidor pasa por aquí antes de ir a innerHTML
export const esc = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const formatoQ = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });
export const quetzales = (n) => formatoQ.format(n ?? 0);

export const fecha = (iso) => iso
    ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export const hoyISO = () => new Date().toLocaleDateString("en-CA");
export const iniciales = (nombre = "") => nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

export function etiquetaEstado(estado, diasRetraso = 0) {
    if (estado === "devuelto") return `<span class="etiqueta etiqueta--neutra">Devuelto</span>`;
    if (estado === "vencido") return `<span class="etiqueta etiqueta--error">Vencido · ${diasRetraso} d</span>`;
    return `<span class="etiqueta etiqueta--ok">Activo</span>`;
}

export function etiquetaStock(stock) {
    if (stock === 0) return `<span class="etiqueta etiqueta--error">Agotado</span>`;
    if (stock <= 2) return `<span class="etiqueta etiqueta--aviso">Quedan ${stock}</span>`;
    return `<span class="etiqueta etiqueta--ok">${stock} en estante</span>`;
}

// Color del lomo según el género, para que el estante se vea variado pero estable
const LOMOS = ["#24493d", "#b5562f", "#b8871f", "#3c6b5c", "#8a3f22", "#5a6f8c", "#7b5e8a"];
export function colorLomo(genero = "") {
    let h = 0;
    for (const c of genero) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return LOMOS[h % LOMOS.length];
}

export function debounce(fn, ms = 250) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---------- Avisos ----------
export function avisar(mensaje, tipo = "ok", detalles = []) {
    const caja = document.createElement("div");
    caja.className = `aviso aviso--${tipo}`;
    caja.innerHTML = esc(mensaje) + (detalles.length ? `<ul>${detalles.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : "");
    document.getElementById("avisos").append(caja);
    setTimeout(() => caja.remove(), tipo === "ok" ? 3500 : 6500);
}

export function avisarError(error) {
    if (error instanceof ErrorApi && error.status === 429) {
        avisar(`${error.motivo || error.message} Intenta de nuevo en ${error.espera} s.`, "limite");
        return;
    }
    avisar(error.message, "error", error.detalles || []);
}

// ---------- Modal ----------
// Devuelve un objeto con los valores del formulario, o null si se canceló.
export function abrirModal({ titulo, cuerpo, aceptar = "Guardar", tipoBoton = "", soloLectura = false, alAbrir }) {
    const modal = document.getElementById("modal");
    const form = document.getElementById("modal-form");
    document.getElementById("modal-titulo").textContent = titulo;
    document.getElementById("modal-cuerpo").innerHTML = cuerpo;
    document.getElementById("modal-pie").innerHTML = soloLectura
        ? `<button class="btn btn--suave" value="cancelar" formnovalidate>Cerrar</button>`
        : `<button class="btn btn--suave" value="cancelar" formnovalidate>Cancelar</button>
           <button class="btn ${tipoBoton}" value="aceptar">${esc(aceptar)}</button>`;
    form.querySelector(".modal__cabeza button").setAttribute("formnovalidate", "");

    modal.returnValue = "";
    modal.showModal();
    alAbrir?.(modal);

    return new Promise((resolver) => {
        modal.addEventListener("close", () => {
            if (modal.returnValue !== "aceptar") return resolver(null);
            resolver(Object.fromEntries(new FormData(form)));
        }, { once: true });
    });
}

export const confirmar = (titulo, texto, aceptar = "Confirmar") =>
    abrirModal({ titulo, cuerpo: `<p>${esc(texto)}</p>`, aceptar, tipoBoton: "btn--acento" }).then(Boolean);

// Pantalla vacía reutilizable
export const vacio = (titulo, texto = "") => `<div class="vacio-grande"><strong>${esc(titulo)}</strong>${esc(texto)}</div>`;
