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
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
      dedupe: ['react', 'react-dom', 'react-router-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-ga4']
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
      'import.meta.env.VITE_VAPID_PUBLIC_KEY': JSON.stringify(env.VITE_VAPID_PUBLIC_KEY || ''),
      'import.meta.env.VITE_ONESIGNAL_APP_ID': JSON.stringify(env.VITE_ONESIGNAL_APP_ID || ''),
      'import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID': JSON.stringify(env.VITE_ONESIGNAL_SAFARI_WEB_ID || ''),
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
