// Pizza Stack desktop wrapper (Windows / macOS / Linux) - by Pizza Technologies.
// The game is plain HTML5 in ../www, so desktop and Android run exactly the same code.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

app.setName('Pizza Stack');
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 540, height: 920, minWidth: 360, minHeight: 600,
    backgroundColor: '#1a0f0a',
    title: 'Pizza Stack - Pizza Technologies',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  win.once('ready-to-show', () => win.show());
  // external links (privacy policy site, store checkout, mailto) open in the user's browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto):/.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    if (url.startsWith('file:')) return { action: 'allow', overrideBrowserWindowOptions: { width: 780, height: 820, autoHideMenuBar: true, title: 'Pizza Technologies' } };
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  // F11 / Alt+Enter toggle fullscreen
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type === 'keyDown' && (i.key === 'F11' || (i.alt && i.key === 'Enter'))) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
