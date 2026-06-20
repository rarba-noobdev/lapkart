import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv[2] ?? 'apk';
const root = process.cwd();
const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';
const gradleCmd = isWindows ? 'gradlew.bat' : './gradlew';

const capacitorEnv = {
	...process.env,
	CAPACITOR_BUILD: 'true',
	PUBLIC_CAPACITOR_BUILD: 'true',
	VITE_CAPACITOR_BUILD: 'true'
};

async function main() {
	if (!['web', 'sync', 'apk', 'install'].includes(mode)) {
		throw new Error(`Unknown mode "${mode}". Use web, sync, apk, or install.`);
	}

	if (mode === 'web' || process.env.CAP_BUNDLE === 'true') {
		await run(npmCmd, ['run', 'build'], { env: capacitorEnv });
		copyFallbackIndex();
	} else {
		writeRemoteFallback();
	}

	if (mode === 'web') return;

	if (!existsSync(join(root, 'android'))) {
		await run(npxCmd, ['cap', 'add', 'android']);
	}

	await run(npxCmd, ['cap', 'sync', 'android']);

	if (mode === 'sync') return;

	await run(gradleCmd, [mode === 'install' ? 'installDebug' : 'assembleDebug', '--console=plain'], {
		cwd: join(root, 'android'),
		env: process.env
	});
}

function copyFallbackIndex() {
	const fallback = join(root, 'www', '200.html');
	const index = join(root, 'www', 'index.html');
	if (!existsSync(fallback)) {
		throw new Error('Capacitor web build did not produce www/200.html.');
	}
	copyFileSync(fallback, index);
}

function writeRemoteFallback() {
	const outDir = join(root, 'www');
	mkdirSync(outDir, { recursive: true });
	writeFileSync(
		join(outDir, 'index.html'),
		`<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
		<title>LapKart</title>
		<meta http-equiv="refresh" content="0;url=https://www.lapkart.store/" />
	</head>
	<body>
		<a href="https://www.lapkart.store/">Open LapKart</a>
	</body>
</html>
`
	);
}

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const childCommand = isWindows ? 'cmd.exe' : command;
		const childArgs = isWindows ? ['/d', '/c', commandLine(command, args)] : args;
		const child = spawn(childCommand, childArgs, {
			cwd: options.cwd ?? root,
			env: options.env ?? process.env,
			shell: false,
			stdio: 'inherit'
		});

		child.on('error', reject);
		child.on('exit', (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
		});
	});
}

function commandLine(command, args) {
	return [command, ...args].join(' ');
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
