import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
    publicDir: resolve(__dirname, '../../games/test-game'),
    server: {
        port: 5173
    }
});