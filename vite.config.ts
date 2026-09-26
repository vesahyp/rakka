import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site under https://<user>.github.io/rakka/,
// so production builds and `vite preview` use that base. Dev stays at '/'.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/rakka/' : '/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
        },
      },
    },
  },
}));
