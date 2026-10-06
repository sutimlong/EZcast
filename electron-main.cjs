const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');

let mainWindow;

function createWindow() {
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

app.whenReady().then(() => {
  createWindow();

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
