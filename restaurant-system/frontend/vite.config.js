import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appBasePath = process.env.VITE_APP_BASE_PATH || '/frontend/';

export default defineConfig({
  plugins: [react()],
  base: appBasePath.endsWith('/') ? appBasePath : `${appBasePath}/`,
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
