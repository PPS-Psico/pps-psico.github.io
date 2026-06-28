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
    plugins: [react()],
    // En producción eliminamos los logs de depuración (log/info/debug) y los
    // `debugger`, pero conservamos console.error y console.warn para soporte.
    // Esto evita ruido y posible filtrado de datos en la consola del usuario
    // final sin tener que tocar manualmente cada llamada en el código.
    esbuild: {
      pure: mode === "production" ? ["console.log", "console.info", "console.debug"] : [],
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
          // Code-splitting por familia de librería: chunks vendor independientes
          // y cacheables, en vez de un único bundle monolítico. Mejora la carga
          // inicial (lazy de las vistas que usan pdf/xlsx/charts) y el cache-hit
          // entre deploys (un cambio en la app no invalida el vendor de React).
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('pdfjs-dist') || id.includes('react-pdf')) return 'pdf';
            if (id.includes('xlsx') || id.includes('exceljs')) return 'spreadsheet';
            if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory'))
              return 'charts';
            if (id.includes('framer-motion') || id.includes('/motion-')) return 'motion';
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('@supabase')) return 'supabase';
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/') ||
              id.includes('react-router')
            )
              return 'react-vendor';
            return 'vendor';
          },
        }
      },
      // Asegurar que archivos en public/ se copien al dist/
      copyPublicDir: true
    },
    // Configuración específica para archivos estáticos
    publicDir: 'public'
  }
})
