#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertNewDesktopDestination, desktopMetadata, runCommand, validateDesktopRuntime, writeDesktopPackage } from './desktop-package.mjs';

async function run() {
    const values = {};
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index += 1) {
        const match = /^--(game|outDir|runtimeDir)(?:=(.*))?$/.exec(args[index]);
        if (!match) throw new Error(`Unknown desktop package option: ${args[index]}`);
        const value = match[2] ?? args[++index];
        if (!value || value.startsWith('--')) throw new Error(`Missing value for --${match[1]}`);
        values[match[1]] = value;
    }
    if (!values.game || !values.outDir) throw new Error('Use --game <project> --outDir <new directory>');
    const invocation = process.env.INIT_CWD || process.cwd();
    const game = path.resolve(invocation, values.game);
    const out = path.resolve(invocation, values.outDir);
    const manifest = JSON.parse(fs.readFileSync(path.join(game, 'game.json'), 'utf8'));
    const configPath = path.join(game, 'engine.config.json');
    const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
    const metadata = desktopMetadata(manifest, config);
    assertNewDesktopDestination(game, out);
    const runtime = validateDesktopRuntime(values.runtimeDir ? path.resolve(invocation, values.runtimeDir) : undefined);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.mkdirSync(out);
    try {
        const scripts = path.dirname(fileURLToPath(import.meta.url));
        runCommand(process.execPath, [path.join(scripts, 'build-game.mjs'), '--game', game, '--outDir', path.join(out, 'web'), '--base', './'], { stdio: 'inherit' });
        const executable = writeDesktopPackage(out, runtime, metadata);
        process.stdout.write(`Desktop game packaged at ${executable}\nGame data: ${path.join(out, 'game.zpack')}\nThe web folder is an optional diagnostic export. Distribute the player and game.zpack together.\n`);
    } catch (error) {
        throw new Error(`${error.message}\nPartial output remains at ${out}. Choose a new destination to retry`);
    }
}

run().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
