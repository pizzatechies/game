// Promotional ad creatives for Pizza Stack (to advertise the game; the game itself has no ads).
// Built from REAL game frames (store/screenshots) + the official logo, rendered with Playwright.
//   node tools/make-ads.js            -> store/ads/<concept>-<size>.png
// Sizes: square feed 1080x1080, story/reel 1080x1920, landscape link 1200x628, web banners 300x250 and 728x90.
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..'), OUT = path.join(root, 'store/ads');
fs.mkdirSync(OUT, { recursive: true });
const b64 = (f, t) => `data:${t};base64,` + fs.readFileSync(path.join(root, f)).toString('base64');
const shot = n => b64(`store/screenshots/${n}.jpg`, 'image/jpeg');
const LOGO = b64('www/img/pt-logo.png', 'image/png'), ICON = b64('www/icons/icon-512.png', 'image/png');

const CONCEPTS = {
  'no-ads': { head: ['NO ADS.', 'JUST PIZZA.'], sub: 'Zero pop-ups. Zero videos. Just stacking.', cta: 'PLAY FREE', shot: '03-pizza-fever', bg: ['#1c1030', '#7a2442', '#d2602a'], badge: '100% AD-FREE' },
  'tap-stack': { head: ['TAP.', 'STACK.', 'REPEAT.'], sub: 'The one-tap pizza tower game.', cta: 'PLAY NOW', shot: '02-perfect-combo', bg: ['#ff7a45', '#c2402a', '#5a1530'], badge: 'ONE-TAP ARCADE' },
  'galaxy': { head: ['HOW HIGH', 'CAN YOU', 'STACK?'], sub: 'From the kitchen to the Pizza Galaxy.', cta: 'TAKE THE CHALLENGE', shot: '05-orbit-galaxy', bg: ['#0b0820', '#2a1458', '#a3318a'], badge: '5 WORLDS' },
  'fever': { head: ['8 PERFECTS =', 'PIZZA FEVER'], sub: 'Chain perfect drops. Set the stack on fire.', cta: 'GET STACKING', shot: '03-pizza-fever', bg: ['#ffb347', '#ff5d3a', '#6a1b9a'], badge: 'PLAYS OFFLINE' }
};
const FONT = `'Trebuchet MS','Arial Rounded MT Bold','Segoe UI',system-ui,sans-serif`;
const titleCss = (px, stroke) => `font-weight:900;line-height:.92;font-size:${px}px;letter-spacing:1px;color:#ffd23f;-webkit-text-stroke:${stroke}px #4a1c0a;paint-order:stroke fill;text-shadow:0 ${stroke}px 0 #b3380f,0 ${stroke * 2}px ${stroke * 3}px rgba(0,0,0,.45)`;
const head = (c, px, stroke) => c.head.map((l, i) => `<div style="${titleCss(px, stroke)};${i === c.head.length - 1 ? 'color:#ff6b3d;text-shadow:0 ' + stroke + 'px 0 #7c1d0a,0 ' + stroke * 2 + 'px ' + stroke * 3 + 'px rgba(0,0,0,.45)' : ''}">${l}</div>`).join('');
const bg = c => `background:linear-gradient(150deg,${c.bg[0]} 0%,${c.bg[1]} 55%,${c.bg[2]} 100%)`;
const rays = (x, y, s) => `<div style="position:absolute;left:${x};top:${y};width:${s}px;height:${s}px;margin:-${s / 2}px;background:repeating-conic-gradient(rgba(255,214,102,.16) 0 8deg,transparent 8deg 24deg);-webkit-mask:radial-gradient(circle,#000,transparent 55%)"></div>`;
const phone = (img, w, x, y, rot) => `<img src="${img}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${Math.round(w * 16 / 9)}px;border-radius:${w * .09}px;border:${Math.round(w * .03)}px solid #1a0f0a;box-shadow:0 ${w * .08}px ${w * .2}px rgba(0,0,0,.55);transform:rotate(${rot}deg);object-fit:cover">`;
const cta = (t, px) => `<div style="display:inline-block;background:#3fae3a;color:#fff;font-weight:900;font-size:${px}px;letter-spacing:1px;padding:${px * .5}px ${px * 1.1}px;border-radius:${px}px;box-shadow:0 ${px * .22}px 0 #2a7d27,0 ${px * .4}px ${px * .7}px rgba(0,0,0,.35);text-shadow:0 2px 0 rgba(0,0,0,.25)">${t}</div>`;
const badge = (t, px) => `<div style="display:inline-block;background:#ffd23f;color:#4a2400;font-weight:900;font-size:${px}px;letter-spacing:2px;padding:${px * .3}px ${px * .8}px;border-radius:${px * .4}px;transform:rotate(-3deg)">${t}</div>`;
const brand = (px, color) => `<div style="display:flex;align-items:center;gap:${px * .5}px"><img src="${LOGO}" style="height:${px * 2.4}px"><div style="color:${color || '#f3cf6e'};font-weight:900;letter-spacing:${px * .3}px;font-size:${px}px;line-height:1.2">PIZZA<br>TECHNOLOGIES</div></div>`;
const iconTag = px => `<div style="display:flex;align-items:center;gap:${px * .5}px;color:#fff;font-weight:900;font-size:${px}px"><img src="${ICON}" style="width:${px * 2.2}px;border-radius:${px * .5}px;box-shadow:0 4px 10px rgba(0,0,0,.4)">PIZZA STACK</div>`;
const page = (W, H, c, inner) => `<html><body style="margin:0;width:${W}px;height:${H}px;overflow:hidden;position:relative;${bg(c)};font-family:${FONT}">${inner}</body></html>`;

const LAYOUTS = {
  square: [1080, 1080, c => page(1080, 1080, c, `${rays('72%', '58%', 2000)}
    <div style="position:absolute;left:64px;top:56px">${brand(22)}</div>
    <div style="position:absolute;left:64px;top:190px;transform:rotate(-3deg);transform-origin:left top">${head(c, c.head.length > 2 ? 96 : 88, 8)}</div>
    <div style="position:absolute;left:66px;top:${c.head.length > 2 ? 530 : 420}px;width:500px;color:#fff;font-size:36px;font-weight:700;line-height:1.25;text-shadow:0 3px 8px rgba(0,0,0,.4)">${c.sub}</div>
    <div style="position:absolute;left:64px;top:${c.head.length > 2 ? 690 : 590}px">${badge(c.badge, 26)}</div>
    <div style="position:absolute;left:64px;bottom:70px">${cta(c.cta, 40)}</div>
    ${phone(shot(c.shot), 380, 628, 150, 6)}`)],
  story: [1080, 1920, c => page(1080, 1920, c, `${rays('50%', '62%', 3000)}
    <div style="position:absolute;left:0;right:0;top:90px;display:flex;justify-content:center">${brand(26)}</div>
    <div style="position:absolute;left:0;right:0;top:250px;text-align:center;transform:rotate(-3deg)">${head(c, c.head.length > 2 ? 132 : 140, 10)}</div>
    <div style="position:absolute;left:90px;right:90px;top:${c.head.length > 2 ? 680 : 560}px;text-align:center;color:#fff;font-size:44px;font-weight:700;text-shadow:0 3px 8px rgba(0,0,0,.4)">${c.sub}</div>
    ${phone(shot(c.shot), 520, 280, c.head.length > 2 ? 810 : 720, -4)}
    <div style="position:absolute;left:0;right:0;top:${c.head.length > 2 ? 820 : 730}px;display:flex;justify-content:flex-end;padding-right:70px">${badge(c.badge, 32)}</div>
    <div style="position:absolute;left:0;right:0;bottom:120px;text-align:center">${cta(c.cta, 54)}</div>`)],
  landscape: [1200, 628, c => page(1200, 628, c, `${rays('78%', '50%', 1600)}
    <div style="position:absolute;left:56px;top:44px">${brand(17)}</div>
    <div style="position:absolute;left:56px;top:${c.head.length > 2 ? 140 : 160}px;transform:rotate(-3deg);transform-origin:left top">${head(c, c.head.length > 2 ? 74 : 72, 6)}</div>
    <div style="position:absolute;left:58px;bottom:150px;width:660px;color:#fff;font-size:28px;font-weight:700;text-shadow:0 3px 8px rgba(0,0,0,.4)">${c.sub}</div>
    <div style="position:absolute;left:56px;bottom:46px">${cta(c.cta, 30)}</div>
    ${phone(shot(c.shot), 250, 820, 40, 7)}
    <div style="position:absolute;right:420px;top:50px">${badge(c.badge, 20)}</div>`)],
  mrec: [300, 250, c => page(300, 250, c, `${rays('80%', '60%', 600)}
    <div style="position:absolute;left:14px;top:12px">${iconTag(15)}</div>
    <div style="position:absolute;left:14px;top:62px;transform:rotate(-3deg);transform-origin:left top">${head(c, c.head.length > 2 ? 27 : 30, 3)}</div>
    <div style="position:absolute;left:14px;bottom:14px">${cta(c.cta.length > 12 ? 'PLAY FREE' : c.cta, 15)}</div>
    ${phone(shot(c.shot), 92, 196, 52, 6)}`)],
  leaderboard: [728, 90, c => page(728, 90, c, `${rays('85%', '50%', 500)}
    <div style="position:absolute;left:12px;top:17px">${iconTag(18).replace('PIZZA STACK', '')}</div>
    <div style="position:absolute;left:78px;top:14px;display:flex;gap:10px;align-items:baseline">${c.head.map((l, i) => `<span style="${titleCss(30, 3)};${i === c.head.length - 1 ? 'color:#ff6b3d' : ''}">${l}</span>`).join('')}</div>
    <div style="position:absolute;left:80px;bottom:10px;color:#fff;font-size:14px;font-weight:700;text-shadow:0 2px 4px rgba(0,0,0,.4)">${c.sub}</div>
    <div style="position:absolute;right:14px;top:22px">${cta(c.cta.length > 12 ? 'PLAY FREE' : c.cta, 17)}</div>`)]
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  for (const [name, c] of Object.entries(CONCEPTS)) {
    for (const [size, [W, H, html]] of Object.entries(LAYOUTS)) {
      const p = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: W < 800 ? 2 : 1 });
      await p.setContent(html(c)); await p.waitForTimeout(150);
      const f = path.join(OUT, `${name}-${size}-${W}x${H}.png`);
      await p.screenshot({ path: f }); await p.close(); console.log('ad', path.relative(root, f));
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
