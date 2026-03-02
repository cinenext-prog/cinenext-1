import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const htmlInputs = {
  main: '/index.html',
  admin: '/admin.html',
  upload: '/upload.html',
  telegramTest: '/test-telegram.html',
};

const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_URL);
const basePath = isVercel ? '/' : (process.env.NODE_ENV === 'production' ? '/cinenext-1/' : '/');

export default defineConfig({
  // Vercel 使用根路径；GitHub Pages 生产构建保持 /cinenext-1/
  base: basePath,
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: false
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: htmlInputs,
    },
  }
});
