import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    expect: {
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.01,
            threshold: 0.2,
        },
    },
    outputDir: 'test-results/playwright',
    use: {
        baseURL: 'http://127.0.0.1:1422',
    },
    projects: [
        {
            name: 'chromium-desktop',
            use: {
                ...devices['Desktop Chrome'],
                colorScheme: 'dark',
                reducedMotion: 'reduce',
                viewport: { height: 900, width: 1440 },
            },
        },
        {
            name: 'chromium-compact',
            use: {
                browserName: 'chromium',
                colorScheme: 'dark',
                hasTouch: true,
                isMobile: true,
                reducedMotion: 'reduce',
                viewport: { height: 844, width: 390 },
            },
        },
    ],
    testDir: './packages/editor/visual-smoke',
    webServer: {
        command: 'npm run dev --workspace=zerith-editor -- --host 127.0.0.1 --port 1422 --mode visual-smoke',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: 'http://127.0.0.1:1422',
    },
});
