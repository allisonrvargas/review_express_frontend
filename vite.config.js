// Configuración de Vite: el frontend corre siempre en el puerto 5173,
// que es el que el backend tiene permitido en CORS.
// VITE_BASE permite publicarlo en una subruta (GitHub Pages).

import { defineConfig } from "vite";

export default defineConfig({
    base: process.env.VITE_BASE || "/",
    server: { port: 5173, strictPort: true, open: true },
    preview: { port: 5173, strictPort: true }
});