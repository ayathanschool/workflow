import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd(), '');
  const gasTarget = env.VITE_GAS_WEB_APP_URL || 'https://script.google.com';
  const isProd = mode === 'production';

  return {
    plugins: [react()],
    build: {
      sourcemap: !isProd,
      // Optimize chunks for production
      rollupOptions: {
        output: {
          manualChunks: isProd ? {
            'react-vendor': ['react', 'react-dom'],
            'charts': ['recharts'],
            'calendar': ['react-big-calendar', 'date-fns'],
            'icons': ['lucide-react'],
            'ui-libs': ['@headlessui/react', 'react-transition-group'],
            'auth': ['@react-oauth/google', 'jwt-decode']
          } : undefined
        }
      },
      chunkSizeWarningLimit: 600
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      }
    },
    server: {
      port: 5173,
      // Configure HMR properly
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 5173,
        timeout: 120000,
        overlay: true
      },
      // Proxy API calls to the Google Apps Script URL during development to avoid CORS
      proxy: {
        '/gas': {
          target: gasTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/gas/, '')
        }
      }
    }
  }
})