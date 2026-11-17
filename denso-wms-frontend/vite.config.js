import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 4310,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5089', changeOrigin: true },
    },
  },
  preview: {
    port: 4380,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5089', changeOrigin: true },
    },
  },
}));
