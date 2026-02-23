import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  base: './',  // Add this line - important for asset paths
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',  // Add this
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      }
    }
},
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', 
        changeOrigin: true,
        secure: false,
      },
    },
  },})