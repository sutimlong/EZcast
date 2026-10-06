const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => {
    if (channel === 'export-pdf') {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error('Unknown channel'));
  }
});
