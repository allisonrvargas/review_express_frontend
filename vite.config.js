// Configuración de Vite: el frontend corre siempre en el puerto 5173,
// que es el que el backend tiene permitido en CORS.

import { defineConfig } from "vite";

export default defineConfig({
    server: { port: 5173, strictPort: true, open: true },
    preview: { port: 5173, strictPort: true }
});
