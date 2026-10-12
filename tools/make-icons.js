// Generates all brand art (SVG) and renders PNG icons/splash screens for web, PWA, Android and Electron.
// Usage: node tools/make-icons.js   (needs Playwright + Chromium; both are preinstalled in the dev container)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const W = (p, d) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, d); };

// ---------- Pizza Technologies logo: a pizza with a slice pulled out and circuit traces ----------
function pizzaMark({ cx = 100, cy = 100, r = 84, id = 'a' } = {}) {
  const a0 = -75 * Math.PI / 180, a1 = -15 * Math.PI / 180;
  const P = (ang, rad, ox = 0, oy = 0) => [cx + ox + Math.cos(ang) * rad, cy + oy + Math.sin(ang) * rad];
  const [sx, sy] = P(a0, r), [ex, ey] = P(a1, r);
  // body = circle minus wedge
  const body = `M${cx},${cy} L${sx.toFixed(2)},${sy.toFixed(2)} A${r},${r} 0 1 0 ${ex.toFixed(2)},${ey.toFixed(2)} Z`;
  const mid = (a0 + a1) / 2, ox = Math.cos(mid) * 16, oy = Math.sin(mid) * 16;
  const [s2x, s2y] = P(a0, r, ox, oy), [e2x, e2y] = P(a1, r, ox, oy);
  const slice = `M${cx + ox},${cy + oy} L${s2x.toFixed(2)},${s2y.toFixed(2)} A${r},${r} 0 0 1 ${e2x.toFixed(2)},${e2y.toFixed(2)} Z`;
  const peps = [[70, 80, 11], [118, 128, 12], [64, 128, 9], [100, 108, 8], [140, 100, 9], [90, 55, 8]];
  const pep = peps.map(([x, y, rr]) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="#c8312b"/><circle cx="${x - rr * .3}" cy="${y - rr * .3}" r="${rr * .35}" fill="#e85d4f" opacity=".7"/>`).join('');
  return `
  <defs>
    <radialGradient id="ch${id}" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#f6b93b"/></radialGradient>
  </defs>
  <path d="${body}" fill="#d98a3a"/>
  <path d="${body}" fill="url(#ch${id})" transform="translate(${cx} ${cy}) scale(.88) translate(${-cx} ${-cy})"/>
  ${pep}
  <g fill="none" stroke="#0e2a47" stroke-width="2.6" stroke-linecap="round" opacity=".85">
    <path d="M100,100 L100,150 L125,150"/><path d="M100,100 L52,100 L40,112"/><path d="M100,100 L70,60 L56,60"/><path d="M118,128 L150,128"/>
  </g>
  <g fill="#27d3c4" stroke="#0e2a47" stroke-width="1.6"><circle cx="125" cy="150" r="4.2"/><circle cx="40" cy="112" r="4.2"/><circle cx="56" cy="60" r="4.2"/><circle cx="150" cy="128" r="4.2"/></g>
  <path d="${slice}" fill="#d98a3a"/>
  <path d="${slice}" fill="url(#ch${id})" transform="translate(${cx + ox} ${cy + oy}) scale(.88) translate(${-cx - ox} ${-cy - oy})"/>
  <circle cx="${cx + ox + 34}" cy="${cy + oy - 34}" r="8" fill="#c8312b"/>
  <path d="M${cx + ox + 6},${cy + oy - 8} q24,-6 40,-28" stroke="#fff6d0" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>`;
}

const logoSvg = (dark = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200">
  <g>${pizzaMark({ id: 'L' })}</g>
  <text x="208" y="92" font-family="Arial Black,Impact,Helvetica,sans-serif" font-size="60" font-weight="900" fill="${dark ? '#fff4e0' : '#2a1608'}" textLength="360" lengthAdjust="spacingAndGlyphs">PIZZA</text>
  <text x="208" y="146" font-family="Arial,Helvetica,sans-serif" font-size="31" font-weight="700" fill="#27d3c4" textLength="360" lengthAdjust="spacing">TECHNOLOGIES</text>
</svg>`;
W(path.join(root, 'www/img/pizza-technologies-logo.svg'), logoSvg(true));
W(path.join(root, 'www/img/pizza-mark.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${pizzaMark({ id: 'M' })}</svg>`);

// ---------- Game icon: stacked pizza layers ----------
function stackIcon({ pad = 0, bg = true } = {}) {
  const layers = [
    ['#e0a04a', '#ffd35c', 150, 78, 0], ['#d98a3a', '#ffcf4d', 136, 70, 0], ['#c97a30', '#ffc83d', 120, 64, 0],
    ['#e0a04a', '#ff9f43', 98, 58, 1], ['#d98a3a', '#ffd35c', 80, 52, 0],
  ];
  let y = 360, out = '';
  layers.forEach(([crust, cheese, w, h, pep], i) => {
    const x = 256 - w * 1.5 + (i % 2 ? 10 : -10) * (i === 0 ? 0 : 1);
    const ww = w * 3;
    out += `<rect x="${x}" y="${y - 58}" width="${ww}" height="58" rx="22" fill="${crust}"/><rect x="${x + 8}" y="${y - 54}" width="${ww - 16}" height="30" rx="14" fill="${cheese}"/>`;
    for (let k = 0; k < 4; k++) out += `<circle cx="${x + 40 + k * (ww - 80) / 3}" cy="${y - 38}" r="9" fill="#c8312b"/>`;
    y -= 52;
  });
  const bgRect = bg ? `<rect width="512" height="512" fill="url(#g)"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a45"/><stop offset="1" stop-color="#b3261e"/></linearGradient></defs>${bgRect}<g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)">${out}<g transform="translate(396 56) scale(.5)">${pizzaMark({ id: 'I' })}</g></g></svg>`;
}
W(path.join(root, 'www/img/icon.svg'), stackIcon());

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
  // splash screens: keep each existing file's pixel size
  const splashSvg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#1a0f0a"/><g transform="translate(${w / 2 - Math.min(w, h) * .3} ${h / 2 - Math.min(w, h) * .1}) scale(${Math.min(w, h) * .6 / 600})"><g>${pizzaMark({ id: 'S' })}</g><text x="208" y="92" font-family="Arial Black,Impact,sans-serif" font-size="60" fill="#fff4e0" textLength="360" lengthAdjust="spacingAndGlyphs">PIZZA</text><text x="208" y="146" font-family="Arial,sans-serif" font-size="31" font-weight="700" fill="#27d3c4" textLength="360" lengthAdjust="spacing">TECHNOLOGIES</text></g></svg>`;
  const { execSync } = require('child_process');
  for (const f of execSync(`find ${res} -name splash.png`).toString().trim().split('\n')) {
    const m = /(\d+) x (\d+)/.exec(execSync(`file "${f}"`).toString());
    if (m) await render(splashSvg(+m[1], +m[2]), +m[1], +m[2], f);
  }
  // adaptive icon background: warm red
  W(path.join(res, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#D8402C</color>\n</resources>\n`);
  await browser.close();
  console.log('icons done');
})();
