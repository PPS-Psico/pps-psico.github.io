import react from '@vitejs/plugin-react'
import { dirname } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    // CAMBIO CLAVE: Usar ruta relativa './' permite que la app funcione
    // tanto en el subdirectorio de GitHub Pages como en la raíz del preview local.
    // Esto soluciona los errores 404 de CSS/JS.
    base: './',
    // React Compiler (v1.0, estable): auto-memoización en build. Permite dejar
    // de escribir useMemo/useCallback a mano y mejora el runtime. Funciona con
    // @vitejs/plugin-react 4.x (basado en Babel). Target React 19 por defecto.
    //
    // IMPORTANTE: lo activamos SOLO en producción. En dev, Vite transforma cada
    // módulo on-demand la primera vez que se importa; el análisis Babel del
    // compiler agrega latencia por archivo, lo que se nota al entrar por primera
    // vez a cada sección lazy-loaded ("se traba y luego sigue"). En el build de
    // producción todo se pre-compila una sola vez, así que conservamos el
    // beneficio de runtime sin penalizar la experiencia de desarrollo.
    plugins: [
      react(
        mode === "production"
          ? { babel: { plugins: [["babel-plugin-react-compiler", {}]] } }
          : undefined
      ),
    ],
    // En producción eliminamos los logs de depuración (log/info/debug) y los
    // `debugger`, pero conservamos console.error y console.warn para soporte.
    // Esto evita ruido y posible filtrado de datos en la consola del usuario
    // final sin tener que tocar manualmente cada llamada en el código.
    esbuild: {
      pure: [],
      drop: mode === "production" ? ["debugger"] : [],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
      dedupe: ['react', 'react-dom', 'react-router-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-ga4']
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          // NOTA: se quitó `manualChunks`. La versión anterior separaba React en
          // un chunk propio mientras librerías que dependen de React (react-query,
          // framer-motion, recharts…) quedaban en otros chunks que se evaluaban
          // antes de que React cargara → `React undefined` → "Cannot read
          // properties of undefined (reading 'createContext')" → pantalla en
          // blanco en producción. El chunking automático de Vite respeta el orden
          // de dependencias y evita ese crash.
        }
      },
      // Asegurar que archivos en public/ se copien al dist/
      copyPublicDir: true
    },
    // Configuración específica para archivos estáticos
    publicDir: 'public'
  }
})
