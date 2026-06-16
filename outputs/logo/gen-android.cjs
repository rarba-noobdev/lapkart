const s = require('sharp');
const path = require('path');

const RES = 'android/app/src/main/res';
const SVG = 'outputs/logo';
const dens = { ldpi: 36, mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

const legacy = path.join(SVG, 'lapkart-icon.svg');
const fg = path.join(SVG, 'lapkart-foreground.svg');
const bg = path.join(SVG, 'lapkart-background.svg');

function circleMask(size) {
	return Buffer.from(
		`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
	);
}

(async () => {
	for (const [d, size] of Object.entries(dens)) {
		const dir = path.join(RES, `mipmap-${d}`);
		// legacy square launcher icon
		await s(legacy).resize(size, size).png().toFile(path.join(dir, 'ic_launcher.png'));
		// round launcher icon (circle-masked legacy)
		await s(legacy)
			.resize(size, size)
			.composite([{ input: circleMask(size), blend: 'dest-in' }])
			.png()
			.toFile(path.join(dir, 'ic_launcher_round.png'));
		// adaptive layers (full square; system mask + xml inset handle shape)
		await s(fg).resize(size, size).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
		await s(bg).resize(size, size).png().toFile(path.join(dir, 'ic_launcher_background.png'));
		console.log('wrote', d, size);
	}
	// Play Store / master 512
	await s(legacy).resize(512, 512).png().toFile(path.join(SVG, 'lapkart-icon-512.png'));
	console.log('done');
})();
