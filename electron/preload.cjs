// preload.cjs — 暴露最小信息给 BrowserWindow 渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('t8pc', {
  getInfo: () => ipcRenderer.invoke('t8pc:get-info'),
  openExternal: (url) => ipcRenderer.invoke('t8pc:open-external', url),
  parseAuth: {
    login: (profileId) => ipcRenderer.invoke('t8pc:parse-auth:login', profileId),
    getCookie: (profileId) => ipcRenderer.invoke('t8pc:parse-auth:get-cookie', profileId),
    listSaved: (profileId) => ipcRenderer.invoke('t8pc:parse-auth:list-saved', profileId),
    save: (profileId, cookieText, meta) => ipcRenderer.invoke('t8pc:parse-auth:save', profileId, cookieText, meta),
    load: (profileId) => ipcRenderer.invoke('t8pc:parse-auth:load', profileId),
    clear: (profileId) => ipcRenderer.invoke('t8pc:parse-auth:clear', profileId),
  },
  updater: {
    getStatus: () => ipcRenderer.invoke('t8pc:updater:status'),
    check: () => ipcRenderer.invoke('t8pc:updater:check'),
    download: () => ipcRenderer.invoke('t8pc:updater:download'),
    install: () => ipcRenderer.invoke('t8pc:updater:install'),
    onStatus: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, status) => callback(status);
      ipcRenderer.on('t8pc:updater-status', listener);
      return () => ipcRenderer.removeListener('t8pc:updater-status', listener);
    },
  },
});
