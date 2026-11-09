// Arranque de la interfaz: acceso, menú por rol y navegación con #rutas.

import { api, sesion } from "./api.js";
import { avisar, avisarError, esc, iniciales } from "./ui.js";
import { resumen } from "./vistas/resumen.js";
import { catalogo } from "./vistas/catalogo.js";
import { prestamos } from "./vistas/prestamos.js";
import { ventas } from "./vistas/ventas.js";
import { clientes } from "./vistas/clientes.js";
import { misPrestamos, misCompras, miPerfil } from "./vistas/cuenta.js";

const MENUS = {
    admin: [
        { titulo: "Administración" },
        { ruta: "resumen", icono: "◎", texto: "Resumen", vista: resumen },
        { ruta: "catalogo", icono: "▤", texto: "Libros e inventario", vista: catalogo },
        { ruta: "prestamos", icono: "⇄", texto: "Préstamos", vista: prestamos },
        { ruta: "ventas", icono: "◈", texto: "Ventas", vista: ventas },
        { ruta: "clientes", icono: "☺", texto: "Usuarios y clientes", vista: clientes }
    ],
    usuario: [
        { titulo: "Mi biblioteca" },
        { ruta: "catalogo", icono: "▤", texto: "Catálogo", vista: catalogo },
        { ruta: "mis-prestamos", icono: "⇄", texto: "Mis préstamos", vista: misPrestamos },
        { ruta: "mis-compras", icono: "◈", texto: "Mis compras", vista: misCompras },
        { ruta: "perfil", icono: "☺", texto: "Mi perfil", vista: miPerfil }
    ]
};

const $ = (id) => document.getElementById(id);
let usuario = null;

// ---------- Medidor del rate limit ----------
document.addEventListener("cupo", ({ detail }) => {
    const { limite, restantes, reinicio } = detail;
    const porcentaje = (restantes / limite) * 100;
    $("cupo-texto").textContent = `${restantes}/${limite}`;
    $("cupo-barra").style.width = `${porcentaje}%`;
    $("cupo").dataset.nivel = porcentaje > 50 ? "alto" : porcentaje > 20 ? "medio" : "bajo";
    $("cupo").title = `Te quedan ${restantes} peticiones. El cupo se renueva en ${reinicio} s.`;
});

document.addEventListener("sesion-vencida", () => {
    sesion.borrar();
    avisar("Tu sesión terminó. Vuelve a entrar.", "error");
    mostrarAcceso();
});

// ---------- Acceso ----------
function cambiarPestana(nombre) {
    document.querySelectorAll("[data-pestana]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.pestana === nombre)));
    $("form-login").hidden = nombre !== "login";
    $("form-registro").hidden = nombre !== "registro";
    $("acceso-titulo").textContent = nombre === "login" ? "Bienvenido de nuevo" : "Únete a Librarian";
    $("acceso-subtitulo").textContent = nombre === "login" ? "Inicia sesión para continuar." : "Crea tu cuenta para ver tu historial de préstamos y compras.";
}

document.querySelectorAll("[data-pestana]").forEach((b) => b.addEventListener("click", () => cambiarPestana(b.dataset.pestana)));

const DEMOS = {
    admin: ["admin@librarian.gt", "Admin123*"],
    usuario: ["ana@correo.com", "Lector123*"]
};
document.querySelectorAll("[data-demo]").forEach((b) => b.addEventListener("click", () => {
    cambiarPestana("login");
    [$("login-email").value, $("login-clave").value] = DEMOS[b.dataset.demo];
}));

async function entrar(ruta, form) {
    const boton = form.querySelector("button[type=submit]");
    boton.disabled = true;
    try {
        const { datos, mensaje } = await api.post(ruta, Object.fromEntries(new FormData(form)));
        sesion.guardar(datos);
        form.reset();
        avisar(mensaje);
        iniciarApp(datos.usuario);
    } catch (e) {
        avisarError(e);
    } finally {
        boton.disabled = false;
    }
}

$("form-login").addEventListener("submit", (ev) => { ev.preventDefault(); entrar("/auth/login", ev.target); });
$("form-registro").addEventListener("submit", (ev) => { ev.preventDefault(); entrar("/auth/registro", ev.target); });

$("btn-salir").addEventListener("click", async () => {
    try { await api.post("/auth/logout"); } catch { /* si ya expiró no importa */ }
    sesion.borrar();
    location.hash = "";
    mostrarAcceso();
});

function mostrarAcceso() {
    usuario = null;
    $("pantalla-app").hidden = true;
    $("pantalla-acceso").hidden = false;
}

// ---------- App ----------
function pintarCuenta() {
    $("avatar").textContent = iniciales(usuario.nombre);
    $("cuenta-nombre").textContent = usuario.nombre;
    $("cuenta-rol").textContent = usuario.rol === "admin" ? "Administración" : "Lector/a";
}

function iniciarApp(datosUsuario) {
    usuario = datosUsuario;
    $("pantalla-acceso").hidden = true;
    $("pantalla-app").hidden = false;
    pintarCuenta();

    $("menu").innerHTML = MENUS[usuario.rol].map((item) => item.titulo
        ? `<div class="menu__titulo">${esc(item.titulo)}</div>`
        : `<button data-ruta="${item.ruta}"><span>${item.icono}</span><span>${esc(item.texto)}</span></button>`).join("");

    navegar();
}

$("menu").addEventListener("click", (ev) => {
    const boton = ev.target.closest("[data-ruta]");
    if (boton) location.hash = `#/${boton.dataset.ruta}`;
});

window.addEventListener("hashchange", () => usuario && navegar());

async function navegar() {
    const opciones = MENUS[usuario.rol].filter((i) => i.ruta);
    const pedida = location.hash.replace("#/", "");
    const item = opciones.find((i) => i.ruta === pedida) || opciones[0];

    document.querySelectorAll("#menu [data-ruta]").forEach((b) => {
        if (b.dataset.ruta === item.ruta) b.setAttribute("aria-current", "page");
        else b.removeAttribute("aria-current");
    });

    // Un contenedor nuevo por vista: así los eventos de la vista anterior no se acumulan
    const contenedor = document.createElement("div");
    $("vista").replaceChildren(contenedor);

    try {
        await item.vista(contenedor, {
            usuario,
            esAdmin: usuario.rol === "admin",
            alActualizar: (nuevo) => { usuario = nuevo; sesion.guardar({ ...sesion.leer(), usuario: nuevo }); pintarCuenta(); }
        });
    } catch (e) {
        avisarError(e);
    }
}

// ¿Ya había sesión abierta en esta pestaña? Se confirma con el servidor.
(async () => {
    if (!sesion.leer()?.token) return mostrarAcceso();
    try {
        const { datos } = await api.get("/auth/yo");
        iniciarApp(datos);
    } catch {
        sesion.borrar();
        mostrarAcceso();
    }
})();
