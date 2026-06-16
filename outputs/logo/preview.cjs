const s = require('sharp');
(async () => {
	// simulate adaptive icon: bg full-bleed + fg inset 16.7%, on a 512 canvas, circle-masked
	const C = 512;
	const inset = Math.round(C * 0.167);
	const inner = C - inset * 2;
	const bg = await s('outputs/logo/lapkart-background.svg').resize(C, C).png().toBuffer();
	const fg = await s('outputs/logo/lapkart-foreground.svg').resize(inner, inner).png().toBuffer();
	// circle mask
	const mask = Buffer.from(
		`<svg width="${C}" height="${C}"><circle cx="${C / 2}" cy="${C / 2}" r="${C / 2}" fill="#fff"/></svg>`
	);
	await s(bg)
		.composite([
			{ input: fg, top: inset, left: inset },
			{ input: mask, blend: 'dest-in' }
		])
		.png()
		.toFile('outputs/logo/preview-adaptive-round.png');
	console.log('ok');
})();
