// Cliente de la API: guarda el token, lee los headers del rate limit y normaliza los errores.

// Dirección del backend. Se cambia en el archivo .env con VITE_API_URL.
// El "?." permite abrir la página también sin Vite (por ejemplo con Live Server).
export const API_URL = (import.meta.env?.VITE_API_URL || "http://localhost:3000/api").replace(/\/$/, "");

const CLAVE_SESION = "librarian.sesion";

export class ErrorApi extends Error {
    constructor(status, cuerpo) {
        super(cuerpo?.error || "No se pudo completar la solicitud.");
        this.status = status;
        this.detalles = cuerpo?.detalles;
        this.espera = cuerpo?.reintentarEnSegundos;
        this.motivo = cuerpo?.motivo;
    }
}

// --- Sesión (sessionStorage: se borra al cerrar la pestaña) ---
export const sesion = {
    leer() {
        try { return JSON.parse(sessionStorage.getItem(CLAVE_SESION)); } catch { return null; }
    },
    guardar(datos) {
        try { sessionStorage.setItem(CLAVE_SESION, JSON.stringify(datos)); } catch { /* modo privado */ }
    },
    borrar() {
        try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* nada */ }
    }
};

// El header estándar llega así: "limit=100, remaining=87, reset=42"
function leerCupo(respuesta) {
    const header = respuesta.headers.get("RateLimit");
    if (!header) return;
    const valores = Object.fromEntries(header.split(",").map((par) => par.trim().split("=")));
    document.dispatchEvent(new CustomEvent("cupo", {
        detail: { limite: Number(valores.limit), restantes: Number(valores.remaining), reinicio: Number(valores.reset) }
    }));
}

export async function pedir(ruta, { metodo = "GET", cuerpo, consulta } = {}) {
    const url = new URL(API_URL + ruta);
    if (consulta) {
        for (const [k, v] of Object.entries(consulta)) if (v !== "" && v !== undefined && v !== null) url.searchParams.set(k, v);
    }

    const headers = {};
    const token = sesion.leer()?.token;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cuerpo !== undefined) headers["Content-Type"] = "application/json";

    let respuesta;
    try {
        respuesta = await fetch(url, { method: metodo, headers, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
    } catch {
        throw new ErrorApi(0, { error: `No hay conexión con la API (${API_URL}). ¿Encendiste el backend?` });
    }

    leerCupo(respuesta);
    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
        // Sesión vencida o inválida: se avisa a la app para que regrese al login
        if (respuesta.status === 401 && token) document.dispatchEvent(new Event("sesion-vencida"));
        throw new ErrorApi(respuesta.status, datos);
    }
    return datos;
}

export const api = {
    get: (ruta, consulta) => pedir(ruta, { consulta }),
    post: (ruta, cuerpo) => pedir(ruta, { metodo: "POST", cuerpo }),
    put: (ruta, cuerpo) => pedir(ruta, { metodo: "PUT", cuerpo }),
    patch: (ruta, cuerpo) => pedir(ruta, { metodo: "PATCH", cuerpo }),
    delete: (ruta) => pedir(ruta, { metodo: "DELETE" })
};
