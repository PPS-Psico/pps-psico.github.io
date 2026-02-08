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

  // Debug: Log available environment variables
  console.log('Vite Config - Available env keys:', Object.keys(env).filter(k => k.startsWith('VITE_')));
  console.log('Vite Config - OneSignal App ID exists:', !!env.VITE_ONESIGNAL_APP_ID);

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
    // Environment variables - use env from loadEnv OR process.env as fallback
    define: {
      'import.meta.env.VITE_ONESIGNAL_APP_ID': JSON.stringify(env.VITE_ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID || ''),
      'import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID': JSON.stringify(env.VITE_ONESIGNAL_SAFARI_WEB_ID || process.env.VITE_ONESIGNAL_SAFARI_WEB_ID || ''),
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
