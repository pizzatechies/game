// Renders all PNG icons/splash screens for web, PWA, Android and Electron from the official logo + the game icon art.
// Prereq: python3 tools/process-logo.py  (creates www/img/pt-logo.png from brand/pizza-technologies-logo-original.png)
// Usage:  node tools/make-icons.js      (needs Playwright + Chromium; set CHROMIUM / PLAYWRIGHT_MODULE if not on PATH)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const W = (p, d) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, d); };
const logoUri = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'www/img/pt-logo.png')).toString('base64');

// ---------- Game icon: stacked pizza layers + Pizza Technologies badge ----------
function stackIcon({ pad = 0, bg = true, badge = true } = {}) {
  const layers = [
    ['#e0a04a', '#ffd35c', 150], ['#d98a3a', '#ffcf4d', 136], ['#c97a30', '#ffc83d', 120],
    ['#e0a04a', '#ff9f43', 98], ['#d98a3a', '#ffd35c', 80],
  ];
  let y = 380, out = '';
  layers.forEach(([crust, cheese, w], i) => {
    const x = 256 - w * 1.5 + (i % 2 ? 10 : -10) * (i === 0 ? 0 : 1), ww = w * 3;
    out += `<rect x="${x}" y="${y - 58}" width="${ww}" height="58" rx="22" fill="${crust}"/><rect x="${x + 8}" y="${y - 54}" width="${ww - 16}" height="30" rx="14" fill="${cheese}"/>`;
    for (let k = 0; k < 4; k++) out += `<circle cx="${x + 40 + k * (ww - 80) / 3}" cy="${y - 38}" r="9" fill="#c8312b"/>`;
    y -= 52;
  });
  const bgRect = bg ? `<rect width="512" height="512" fill="url(#g)"/>` : '';
  const b = badge ? `<circle cx="256" cy="92" r="62" fill="#1a0f0a" stroke="#ffd35c" stroke-width="5"/><image href="${logoUri}" x="198" y="34" width="116" height="116"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a45"/><stop offset="1" stop-color="#b3261e"/></linearGradient></defs>${bgRect}<g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)">${out}${b}</g></svg>`;
}
W(path.join(root, 'www/img/icon.svg'), stackIcon());

// ---------- Splash: official logo + wordmark on the dark brand background ----------
const splashSvg = (w, h) => {
  const m = Math.min(w, h), s = m * .4;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#1a0f0a"/>
  <image href="${logoUri}" x="${(w - s) / 2}" y="${h / 2 - s * .62}" width="${s}" height="${s}"/>
  <text x="${w / 2}" y="${h / 2 + s * .62}" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-size="${m * .06}" fill="#fff4e0" letter-spacing="${m * .012}">PIZZA TECHNOLOGIES</text></svg>`;
};

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage();
  async function render(svg, w, h, file, { transparent = false } = {}) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><body style="margin:0;background:${transparent ? 'transparent' : '#000'};width:${w}px;height:${h}px;overflow:hidden">${svg.replace('<svg ', `<svg width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" `)}</body></html>`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  }
  const www = p => path.join(root, 'www/icons', p);
  const icon = stackIcon(), iconMask = stackIcon({ pad: 0.22 });
  await render(icon, 192, 192, www('icon-192.png'));
  await render(icon, 512, 512, www('icon-512.png'));
  await render(iconMask, 512, 512, www('maskable-512.png'));
  await render(icon, 256, 256, path.join(root, 'electron/icon.png'));
  await render(icon, 512, 512, path.join(root, 'build/icon.png'));
  await render(icon, 32, 32, www('favicon-32.png'));

  const res = path.join(root, 'android/app/src/main/res');
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, m] of Object.entries(dens)) {
    await render(icon, 48 * m, 48 * m, path.join(res, `mipmap-${d}/ic_launcher.png`));
    await render(icon, 48 * m, 48 * m, path.join(res, `mipmap-${d}/ic_launcher_round.png`));
    // adaptive foreground: art on transparent bg, kept inside the 66% safe zone
    await render(stackIcon({ pad: 0.34, bg: false }), 108 * m, 108 * m, path.join(res, `mipmap-${d}/ic_launcher_foreground.png`), { transparent: true });
  }
  const { execSync } = require('child_process');
  for (const f of execSync(`find ${res} -name splash.png`).toString().trim().split('\n')) {
    const m = /(\d+) x (\d+)/.exec(execSync(`file "${f}"`).toString());
    if (m) await render(splashSvg(+m[1], +m[2]), +m[1], +m[2], f);
  }
  W(path.join(res, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#D8402C</color>\n</resources>\n`);
  await browser.close();
  console.log('icons done');
})();
