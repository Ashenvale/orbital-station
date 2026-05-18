import { defineConfig } from 'vite';

// Prototipo web. base relativa para poder servirlo desde cualquier ruta
// (y mas adelante empaquetarlo con Capacitor/Cordova hacia mobile).
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { target: 'es2020' }
});
