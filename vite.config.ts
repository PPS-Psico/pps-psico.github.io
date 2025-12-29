
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { resolve, dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    // IMPORTANTE: Esto debe coincidir con el nombre de tu repositorio en GitHub
    base: '/consulta-pps-uflo/',
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
      // Esta opción le dice a Vite que se asegure de usar una única copia de estas librerías
      dedupe: ['react', 'react-dom', 'react-router-dom'],
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.API_KEY),
    },
    build: {
      rollupOptions: {
        // No external dependencies needed; Vite will bundle everything.
      },
    },
    // Optimize deps to ensure they are pre-bundled correctly
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom']
    }
  }
})
