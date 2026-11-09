// Catálogo: lo ven ambos roles. El admin además crea, edita y elimina.

import { api } from "../api.js";
import { abrirModal, avisar, avisarError, colorLomo, confirmar, debounce, esc, etiquetaStock, quetzales, vacio } from "../ui.js";

const filtros = { q: "", genero: "", disponible: "", orden: "titulo" };

function formularioLibro(libro = {}) {
    const anio = new Date().getFullYear();
    return `
    <div class="campos campos--2">
        <div class="campo campo--ancho"><label>Título</label><input name="titulo" value="${esc(libro.titulo)}" required maxlength="150"></div>
        <div class="campo"><label>Autor</label><input name="autor" value="${esc(libro.autor)}" required></div>
        <div class="campo"><label>Género</label><input name="genero" value="${esc(libro.genero)}" required list="lista-generos"></div>
        <div class="campo"><label>ISBN</label><input name="isbn" value="${esc(libro.isbn)}" required pattern="(97[89])?\\d{9}[\\dX]" title="10 o 13 dígitos sin guiones"></div>
        <div class="campo"><label>Año</label><input name="anio" type="number" min="1400" max="${anio}" value="${esc(libro.anio)}" required></div>
        <div class="campo"><label>Precio (Q)</label><input name="precio" type="number" step="0.01" min="0" value="${esc(libro.precio)}" required></div>
        <div class="campo"><label>Ejemplares en estante</label><input name="stock" type="number" min="0" value="${esc(libro.stock ?? 1)}" required></div>
    </div>`;
}

const aNumeros = (d) => ({ ...d, anio: Number(d.anio), precio: Number(d.precio), stock: Number(d.stock) });

function tarjeta(libro, esAdmin) {
    return `
    <article class="libro">
        <div class="libro__lomo" style="background:${colorLomo(libro.genero)}"></div>
        <div class="libro__cuerpo">
            <span class="libro__genero">${esc(libro.genero)} · ${esc(libro.anio)}</span>
            <span class="libro__titulo">${esc(libro.titulo)}</span>
            <span class="libro__autor">${esc(libro.autor)}</span>
            <div class="libro__datos">
                <span class="libro__precio">${quetzales(libro.precio)}</span>
                ${etiquetaStock(libro.stock)}
            </div>
            ${esAdmin && libro.prestados ? `<small class="libro__autor">${libro.prestados} prestado(s) · ISBN ${esc(libro.isbn)}</small>` : ""}
        </div>
        ${esAdmin ? `
        <div class="libro__acciones">
            <button class="btn btn--suave btn--mini" data-editar="${libro.id}">Editar</button>
            <button class="btn btn--peligro btn--mini" data-eliminar="${libro.id}">Eliminar</button>
        </div>` : ""}
    </article>`;
}

export async function catalogo(raiz, { esAdmin }) {
    const { datos: generos } = await api.get("/libros/generos");

    raiz.innerHTML = `
    <header class="encabezado">
        <div>
            <h1>Catálogo</h1>
            <p id="cat-total">Cargando…</p>
        </div>
        ${esAdmin ? `<button class="btn btn--acento" id="btn-nuevo-libro">+ Nuevo libro</button>` : ""}
    </header>
    <div class="herramientas">
        <label class="buscador"><input id="cat-q" type="search" placeholder="Buscar por título, autor, ISBN o género…" value="${esc(filtros.q)}" aria-label="Buscar"></label>
        <select id="cat-genero" aria-label="Género"><option value="">Todos los géneros</option>${generos.map((g) => `<option ${g === filtros.genero ? "selected" : ""}>${esc(g)}</option>`).join("")}</select>
        <select id="cat-disponible" aria-label="Disponibilidad">
            <option value="">Cualquier disponibilidad</option>
            <option value="true">Con ejemplares</option>
            <option value="false">Agotados</option>
        </select>
        <select id="cat-orden" aria-label="Ordenar">
            <option value="titulo">Ordenar por título</option>
            <option value="autor">Por autor</option>
            <option value="precio">Por precio</option>
            <option value="anio">Más recientes</option>
            <option value="stock">Menos stock</option>
        </select>
    </div>
    <datalist id="lista-generos">${generos.map((g) => `<option value="${esc(g)}">`).join("")}</datalist>
    <section class="estante" id="estante"></section>`;

    raiz.querySelector("#cat-disponible").value = filtros.disponible;
    raiz.querySelector("#cat-orden").value = filtros.orden;

    const estante = raiz.querySelector("#estante");
    let libros = [];

    async function cargar() {
        try {
            ({ datos: libros } = await api.get("/libros", filtros));
            raiz.querySelector("#cat-total").textContent = `${libros.length} título(s) encontrados`;
            estante.innerHTML = libros.length
                ? libros.map((l) => tarjeta(l, esAdmin)).join("")
                : vacio("Sin resultados", "Prueba con otra búsqueda o quita los filtros.");
        } catch (e) { avisarError(e); }
    }

    const alCambiar = (campo) => (ev) => { filtros[campo] = ev.target.value; cargar(); };
    raiz.querySelector("#cat-q").addEventListener("input", debounce(alCambiar("q")));
    raiz.querySelector("#cat-genero").addEventListener("change", alCambiar("genero"));
    raiz.querySelector("#cat-disponible").addEventListener("change", alCambiar("disponible"));
    raiz.querySelector("#cat-orden").addEventListener("change", alCambiar("orden"));

    if (esAdmin) {
        raiz.querySelector("#btn-nuevo-libro").addEventListener("click", async () => {
            const datos = await abrirModal({ titulo: "Nuevo libro", cuerpo: formularioLibro(), aceptar: "Agregar al catálogo" });
            if (!datos) return;
            try {
                const r = await api.post("/libros", aNumeros(datos));
                avisar(r.mensaje);
                cargar();
            } catch (e) { avisarError(e); }
        });

        estante.addEventListener("click", async (ev) => {
            const idEditar = ev.target.dataset.editar;
            const idEliminar = ev.target.dataset.eliminar;
            const libro = libros.find((l) => l.id === Number(idEditar || idEliminar));
            if (!libro) return;

            try {
                if (idEditar) {
                    const datos = await abrirModal({ titulo: "Editar libro", cuerpo: formularioLibro(libro) });
                    if (!datos) return;
                    const r = await api.put(`/libros/${libro.id}`, aNumeros(datos));
                    avisar(r.mensaje);
                } else {
                    const ok = await confirmar("Eliminar libro", `¿Eliminar "${libro.titulo}" del catálogo? Esta acción no se puede deshacer.`, "Eliminar");
                    if (!ok) return;
                    const r = await api.delete(`/libros/${libro.id}`);
                    avisar(r.mensaje);
                }
                cargar();
            } catch (e) { avisarError(e); }
        });
    }

    await cargar();
}
