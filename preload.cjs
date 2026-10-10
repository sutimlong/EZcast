const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => {
    if (['export-pdf', 'renderer-ready', 'save-cast-file'].includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error('Unknown channel'));
  },
  // 監聽 main process 送來的「開啟 .cast 檔案」事件（Finder 雙擊）。
  onOpenCastFile: (callback) => {
    ipcRenderer.on('open-cast-file', (_event, data) => callback(data));
  }
});
