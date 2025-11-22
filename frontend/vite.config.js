import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd(), '');
  const gasTarget = env.VITE_GAS_WEB_APP_URL || 'https://script.google.com/macros/s/AKfycbyfKlfWqiDRkNF_Cjft73qHpGQm8tQ-nHjPSPHOKfuC1l8H5JH5gfippuhNqjvtx5dsDg/exec';
  const isProd = mode === 'production';

  return {
    plugins: [react({
      // Enable Fast Refresh for better development performance
      fastRefresh: true
    })],
    build: {
      sourcemap: !isProd,
      // Optimize build performance
      minify: isProd ? 'terser' : false,
      terserOptions: isProd ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info']
        }
      } : undefined,
      // Optimize chunks for production
      rollupOptions: {
        output: {
          manualChunks: isProd ? {
            'react-vendor': ['react', 'react-dom'],
            'charts': ['recharts'],
            'date-utils': ['date-fns'],
            'icons': ['lucide-react'],
            'ui-libs': ['@headlessui/react', 'react-transition-group'],
            'auth': ['@react-oauth/google', 'jwt-decode']
          } : undefined
        }
      },
      chunkSizeWarningLimit: 600,
      // Optimize CSS
      cssCodeSplit: true,
      // Enable build cache
      reportCompressedSize: false,
      // Increase chunk size limit
      assetsInlineLimit: 4096
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
      }
      // Proxy disabled - using direct backend URL to avoid connection issues
    }
  }
})