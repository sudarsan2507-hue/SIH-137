import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/SIH-137/' : '/',
  server: {
    port: 3000
  }
}));
