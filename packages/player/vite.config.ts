import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    publicDir: resolve(__dirname, '../../games/test-game'),
    server: {
        port: 5173
    }
});