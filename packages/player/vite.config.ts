import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
    publicDir: path.resolve(__dirname, '../../games/test-game'),
    server: {
        port: 5173
    }
});