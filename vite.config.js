import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 本地开发使用 /，生产构建使用 /cinenext-1/
  base: process.env.NODE_ENV === 'production' ? '/cinenext-1/' : '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: false
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
