import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { localApi } from './scripts/vite-api';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command, mode }) => {
  if (command === 'serve') {
    const env = loadEnv(mode, process.cwd(), '');
    for (const [key, value] of Object.entries(env)) if (/^(FIREBASE_|VAPID_|CRON_SECRET$)/.test(key) && process.env[key] === undefined) process.env[key] = value;
  }
  return {
  server: {
    watch: { ignored: ['**/*.local/**', '**/.private-backups/**'] },
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.private-backups/**', '**/*.local/**', '**/*service-account*.json', '**/*admin-key*.json'] },
  },
  plugins: [react(), tailwindcss(), localApi()],
  build: { rolldownOptions: { output: { codeSplitting: { groups: [
    { name: 'firestore', test: /node_modules[\\/]@firebase[\\/]firestore[\\/]/, priority: 30 },
    { name: 'firebase-auth', test: /node_modules[\\/]@firebase[\\/]auth[\\/]/, priority: 20 },
    { name: 'firebase', priority: 10, test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
    { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
  ] } } } },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
};
});
