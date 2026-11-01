import { defineConfig } from 'vite';

// 相対パスで出力し、GitHub Pages の github.io/<repo>/ サブパスでも動くようにする
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
