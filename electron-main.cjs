const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');

let mainWindow;
let pendingOpenFilePath = null;
let rendererReady = false;

// 將 .cast 檔案內容送給 renderer，讓其載入專案。
function openCastFileInWindow(win, filePath) {
  fs.readFile(filePath, 'utf8')
    .then((content) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('open-cast-file', { filePath, content });
      }
    })
    .catch((err) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('open-cast-file', {
          filePath,
          content: null,
          error: String((err && err.message) || err)
        });
      }
    });
}

// Finder 雙擊 .cast 開啟本 App 時（無論是冷啟動或已在執行中）。
function handleOpenFile(filePath) {
  if (!filePath || !/\.cast$/i.test(filePath)) return;
  if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
    openCastFileInWindow(mainWindow, filePath);
  } else {
    pendingOpenFilePath = filePath;
  }
}

function createWindow() {
  rendererReady = false; // 新視窗的 renderer 需重新回報就緒。
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.maximize();

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// ---- PDF export ----
// The renderer prepares a print-only layout, then asks the main process to
// render it with Chromium's PDF engine so we get a real vector PDF with
// page numbers ("第1頁，共5頁") in the footer.
ipcMain.handle('export-pdf', async (event, options = {}) => {
  const { pageSize = 'A4', defaultName = 'ez-cast' } = options;
  const win = BrowserWindow.fromWebContents(event.sender);
  // A3 is √2 times larger than A4; scale margins/footer so both look identical.
  const scale = pageSize === 'A3' ? Math.SQRT2 : 1;

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '匯出 PDF',
    defaultPath: `${defaultName}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return { canceled: true };

  const footerFontPx = Math.round(9 * scale);
  const footerTemplate = `
    <div style="width:100%;text-align:center;font-size:${footerFontPx}px;color:#4a5568;
                font-family:'Inter',-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;">
      第<span class="pageNumber"></span>頁，共<span class="totalPages"></span>頁
    </div>`;

  const data = await event.sender.printToPDF({
    pageSize,
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate,
    margins: {
      top: 0.5 * scale,
      bottom: 0.65 * scale,
      left: 0.45 * scale,
      right: 0.45 * scale
    }
  });

  await fs.writeFile(filePath, data);
  return { canceled: false, filePath };
});

// Renderer 掛載完成後回報，此時才把「待開啟的 .cast」推送過去，
// 避免在 renderer 尚未訂閱事件時錯過檔案。
ipcMain.handle('renderer-ready', () => {
  rendererReady = true;
  if (pendingOpenFilePath) {
    const filePath = pendingOpenFilePath;
    pendingOpenFilePath = null;
    openCastFileInWindow(mainWindow, filePath);
  }
  return true;
});

// 將目前專案直接寫回「從 Finder 雙擊開啟」的那個 .cast 檔案。
ipcMain.handle('save-cast-file', async (event, options = {}) => {
  const { filePath, content } = options;
  if (!filePath || typeof content !== 'string') {
    return { ok: false, error: '參數不正確' };
  }
  try {
    await fs.writeFile(filePath, content, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

// Finder 雙擊 .cast 開啟 App。
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  handleOpenFile(filePath);
});

app.whenReady().then(() => {
  createWindow();

  // macOS 冷啟動時，雙擊的檔案也可能只出現在 argv 中（不一定觸發 open-file）。
  const argvFile = process.argv.find((arg) => /\.cast$/i.test(arg));
  if (argvFile) handleOpenFile(argvFile);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
