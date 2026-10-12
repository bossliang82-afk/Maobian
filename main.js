const { app, BrowserWindow, ipcMain, Tray, Menu, Notification } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let reminderTimer = null;

// 设置默认开机自启（首次运行未设置时默认为 true）
function initAutoLaunch() {
  const settings = app.getLoginItemSettings();
  // 首次运行如果没设置过，默认开启
  if (process.execPath && !process.defaultApp) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: ['--hidden']
    });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 640,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: false, // 默认不置顶
    skipTaskbar: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 检查并设置开机自启
ipcMain.handle('get-auto-launch', () => {
  const settings = app.getLoginItemSettings();
  return settings.openAtLogin;
});

ipcMain.handle('toggle-auto-launch', (event, enable) => {
  if (process.execPath && !process.defaultApp) {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: process.execPath,
      args: ['--hidden']
    });
  }
  return enable;
});

// 窗口控制
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// 人本主义轻提醒：每晚 21:00 检查今日是否已记录，若未记录则轻柔托盘通知
function scheduleGentleReminder() {
  setInterval(() => {
    const now = new Date();
    // 晚上 21:00 ~ 21:05 之间检测
    if (now.getHours() === 21 && now.getMinutes() === 0) {
      if (mainWindow) {
        mainWindow.webContents.send('check-today-sealed');
      }
    }
  }, 60000); // 每分钟轮询一次
}

ipcMain.on('notify-gentle-reminder', (event, needNotify) => {
  if (needNotify && Notification.isSupported()) {
    const notification = new Notification({
      title: '毛边 (Deckle Edge)',
      body: '今天过得怎么样？来给今天贴个签，留下一句毛边吧~',
      silent: false
    });
    notification.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
    notification.show();
  }
});

// 单实例运行
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    initAutoLaunch();
    createWindow();
    scheduleGentleReminder();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});