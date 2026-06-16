const s = require('sharp');
const fs = require('fs');
const r = 'android/app/src/main/res';
const dens = ['ldpi', 'mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const files = ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground', 'ic_launcher_background'];
(async () => {
	for (const d of dens) {
		for (const f of files) {
			const p = `${r}/mipmap-${d}/${f}.png`;
			if (fs.existsSync(p)) {
				const md = await s(p).metadata();
				console.log(d, f, md.width + 'x' + md.height);
			}
		}
	}
})();
