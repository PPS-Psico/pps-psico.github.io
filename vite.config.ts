import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { resolve, dirname } from 'node:path'

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
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
      dedupe: ['react', 'react-dom', 'react-router-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom']
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.API_KEY),
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true, 
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      }
    }
  }
})