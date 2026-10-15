/**
 * v1.7.3 (2026-10-15)
 * 改动：任务图片存到 userData/task-images，只接受常见图片扩展名。
 */
import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell, Notification } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { randomUUID } from 'crypto';
import { readFile, copyFile, mkdir, unlink, rm } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let tray = null;
let isPinned = false;
import { readFileSync } from 'fs';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
const IMAGE_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
};

function assertTodoId(todoId) {
  if (typeof todoId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(todoId)) {
    throw new Error('invalid task id');
  }
  return todoId;
}

function assertImageName(name) {
  if (typeof name !== 'string') throw new Error('invalid image name');
  const base = path.basename(name);
  const ext = path.extname(base).toLowerCase();
  if (base !== name || !IMAGE_EXT.has(ext) || base.includes('..')) {
    throw new Error('invalid image name');
  }
  return base;
}

function taskImageDir(todoId) {
  return path.join(app.getPath('userData'), 'task-images', assertTodoId(todoId));
}

ipcMain.handle('task-images-add', async (_event, todoId) => {
  const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return [];
  const dir = taskImageDir(todoId);
  await mkdir(dir, { recursive: true });
  const saved = [];
  for (const file of result.filePaths) {
    const ext = path.extname(file).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const name = `${randomUUID()}${ext}`;
    await copyFile(file, path.join(dir, name));
    saved.push(name);
  }
  return saved;
});

ipcMain.handle('task-images-read', async (_event, todoId, name) => {
  const fileName = assertImageName(name);
  const bytes = await readFile(path.join(taskImageDir(todoId), fileName));
  const mime = IMAGE_MIME[path.extname(fileName).toLowerCase()];
  return `data:${mime};base64,${bytes.toString('base64')}`;
});

ipcMain.handle('task-images-delete', async (_event, todoId, name) => {
  await unlink(path.join(taskImageDir(todoId), assertImageName(name)));
});

ipcMain.handle('task-images-delete-task', async (_event, todoId) => {
  await rm(taskImageDir(todoId), { recursive: true, force: true });
});


const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json')));
const CURRENT_VERSION = packageJson.version;
const GITHUB_REPO = 'Pao-Lu-Lou/softdo';
const UPDATE_CHECK_KEY = 'softdo-skip-update';
const SKIP_VERSION_KEY = 'softdo-skip-version';

if (process.platform === 'win32') {
  app.setAppUserModelId('com.paolulou.softdo');
}

// Single instance lock - prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Auto-launch (startup) handlers
ipcMain.handle('get-auto-launch', () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('set-auto-launch', (event, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
  });
  return app.getLoginItemSettings().openAtLogin;
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 540,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    minWidth: 320,
    minHeight: 480,
    icon: path.join(__dirname, '../build/icon.png')
  });

  // Re-apply always-on-top when window gains focus (fixes sometimes failing)
  mainWindow.on('focus', () => {
    if (isPinned) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  // IPC handlers for window controls
  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('toggle-always-on-top', (event, shouldPin) => {
    isPinned = shouldPin;
    mainWindow?.setAlwaysOnTop(shouldPin, shouldPin ? 'screen-saver' : 'normal');
  });

  ipcMain.handle('get-pin-state', () => {
    return isPinned;
  });

  ipcMain.on('resize-window', (event, { width, height, x, y }) => {
    if (x !== undefined && y !== undefined) {
      mainWindow?.setBounds({ 
        x: Math.round(x), 
        y: Math.round(y), 
        width: Math.round(width), 
        height: Math.round(height) 
      });
    } else {
      mainWindow?.setSize(Math.round(width), Math.round(height));
    }
  });

  ipcMain.on('close-to-tray', () => {
    mainWindow?.hide();
  });

  // Update check handlers
  ipcMain.handle('check-for-updates', async () => {
    return await checkForUpdates();
  });

  ipcMain.handle('get-current-version', () => {
    return CURRENT_VERSION;
  });

  ipcMain.on('open-release-page', () => {
    shell.openExternal(`https://github.com/${GITHUB_REPO}/releases/latest`);
  });

  // Load content
  const isDev = process.env.ELECTRON_START_URL;
  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  // Create tray icon
  createTray();
}

function createTray() {
  // Use a small icon for tray
  // Use icon.png (generated high res) and let internal resizing handle it, or resize here
  const iconPath = path.join(__dirname, '../build/icon.png');
  let trayIcon = nativeImage.createFromPath(iconPath);
  // nativeImage resizing handles scaling better than just loading raw?
  // 16x16 is small. Try 24x24 or 32x32 for modern displays
  trayIcon = trayIcon.resize({ width: 22, height: 22 }); 
  
  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Show SoftDo', 
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    { type: 'separator' },
    { 
      label: 'Always on Top', 
      type: 'checkbox',
      checked: isPinned,
      click: (menuItem) => {
        isPinned = menuItem.checked;
        mainWindow?.setAlwaysOnTop(menuItem.checked, menuItem.checked ? 'screen-saver' : 'normal');
        mainWindow?.webContents.send('pin-state-changed', menuItem.checked);
      }
    },
    { type: 'separator' },
    { 
      label: 'Check for Updates', 
      click: async () => {
        const update = await checkForUpdates();
        if (update.hasUpdate) {
          const result = dialog.showMessageBoxSync(mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: `A new version (${update.latestVersion}) is available!`,
            detail: 'Would you like to download it now?',
            buttons: ['Download', 'Later'],
            defaultId: 0
          });
          if (result === 0) {
            shell.openExternal(`https://github.com/${GITHUB_REPO}/releases/latest`);
          }
        } else {
          dialog.showMessageBoxSync(mainWindow, {
            type: 'info',
            title: 'No Updates',
            message: 'You are running the latest version!',
            buttons: ['OK']
          });
        }
      }
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('SoftDo - Your Tasks');
  tray.setContextMenu(contextMenu);

  // Click to show/hide window
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

// Notification Scheduler
let notificationTimer = null;
let scheduledTodos = [];

ipcMain.on('update-notification-schedule', (event, todos) => {
  scheduledTodos = todos.filter(t => t.dueTime && !t.completed);
  console.log(`[Notifications] Updated schedule: ${scheduledTodos.length} tasks with due times`);
  scheduledTodos.forEach(t => {
    console.log(`  - "${t.text}" due at ${new Date(t.dueTime).toLocaleString()}`);
  });
});

function checkNotifications() {
  const now = new Date();
  
  scheduledTodos.forEach(todo => {
    if (!todo.dueTime) return;
    const due = new Date(todo.dueTime);
    const diff = (due - now) / 1000; // seconds

    // Thresholds: 24h (86400), 1h (3600), 30m (1800), 5m (300), 0m (0)
    // We need a mechanism to not repeat notifications.
    // For simplicity in this version, we'll check if it's "close enough" and hasn't been fired recently?
    // Actually, renderer can send "next notification time" or main can track "last notified".
    // Let's use a simpler approach: Check if we just crossed a threshold.
    // To do this reliably without state, we might need a "lastCheckTime".
    
    // Better approach: User wanted "Windows Level Notification".
    // We will check strict ranges. e.g. if diff is between 0 and 10s -> Show "Due Now".
    // We need to store state "notified_due", "notified_5m", etc.
    // But main process is stateless regarding todo ID details usually.
    // Let's attach state to the todo list in main memory.
  });
}

// Robust Notification System using `node-schedule` logic or simple polling with state tracking
let notificationState = new Map(); // id -> { lastNotifiedStage: string }

function runScheduler() {
  const now = new Date();
  
  scheduledTodos.forEach(todo => {
    if (!todo.dueTime || todo.completed) return;
    const due = new Date(todo.dueTime);
    const diffInSeconds = (due - now) / 1000;
    const diffInMinutes = diffInSeconds / 60;
    
    let stage = '';
    let message = '';
    let title = 'SoftDo Reminder';

    // Due now: -60s to +30s window (wider for reliability)
    if (diffInSeconds <= 30 && diffInSeconds > -60) {
      stage = 'due';
      title = 'Task Due Now!';
      message = `"${todo.text}" is due now!`;
    }
    // 5 minutes before: 4m30s to 5m30s window  
    else if (diffInMinutes <= 5.5 && diffInMinutes > 4.5) {
      stage = '5m';
      title = '5 Minutes Left';
      message = `"${todo.text}" is due in 5 minutes.`;
    }
    // 1 hour before: 59m to 61m window
    else if (diffInMinutes <= 61 && diffInMinutes > 59) {
      stage = '1h';
      title = '1 Hour Left';
      message = `"${todo.text}" is due in 1 hour.`;
    }

    if (stage) {
      const state = notificationState.get(todo.id) || { notifiedStages: [] };
      if (!state.notifiedStages.includes(stage)) {
        console.log(`[Scheduler] Triggering ${stage} notification for: ${todo.text}`);
        // Send notification - urgent for 'due' stage
        showNotification(title, message, stage === 'due');
        
        state.notifiedStages.push(stage);
        notificationState.set(todo.id, state);
      }
    }
  });
}

function showNotification(title, body, urgent = false) {
  try {
    console.log(`[Notification] Showing: ${title} - ${body}`);
    
    // Play system sound for all notifications
    if (process.platform === 'win32') {
      shell.beep();
    }
    
    // For urgent notifications (due now), also show a dialog
    if (urgent && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: title,
        message: body,
        buttons: ['OK', 'Open SoftDo'],
        defaultId: 1,
        noLink: true
      }).then(result => {
        if (result.response === 1) {
          mainWindow.show();
          mainWindow.focus();
        }
      });
    }
    
    // Also show system notification
    if (!Notification.isSupported()) {
      console.log('[Notification] Not supported on this platform');
      return;
    }
    
    const notification = new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, '../build/icon.png'),
      silent: false,
      urgency: urgent ? 'critical' : 'normal',
      timeoutType: urgent ? 'never' : 'default'
    });
    
    notification.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    
    notification.show();
  } catch (err) {
    console.error('[Notification] Error:', err);
  }
}

// Start scheduler when app launches
app.whenReady().then(() => {
  createWindow();
  notificationTimer = setInterval(runScheduler, 1000); // Check every 1s for precise notifications
  
  // Auto-check for updates
  setTimeout(() => {
    checkForUpdates().then(update => {
       if (update.hasUpdate && mainWindow) {
           mainWindow.webContents.send('update-available', update);
       }
    });
  }, 3000); // Check 3s after launch

  // Check notification support and prompt user if needed
  setTimeout(() => {
    if (!Notification.isSupported()) {
      console.log('[Startup] Notifications not supported');
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Notifications Not Available',
        message: 'System notifications are not available on this device. Task reminders will use popup dialogs instead.',
        buttons: ['OK']
      });
    } else {
      // Send test notification with sound
      console.log('[Startup] Sending test notification...');
      shell.beep();
      
      const testNotification = new Notification({
        title: 'SoftDo Reminders Enabled',
        body: 'You will receive sound alerts and notifications for your tasks!',
        icon: path.join(__dirname, '../build/icon.png'),
        silent: false
      });
      
      testNotification.on('failed', () => {
        // If notification fails, prompt user to check Windows settings
        dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Enable Notifications',
          message: 'SoftDo needs notification permission to remind you about tasks.\\n\\nPlease enable notifications for SoftDo in Windows Settings.',
          buttons: ['Open Settings', 'Later'],
          defaultId: 0
        }).then(result => {
          if (result.response === 0) {
            shell.openExternal('ms-settings:notifications');
          }
        });
      });
      
      testNotification.show();
    }
  }, 2000);
});

app.on('window-all-closed', () => {
  // On Windows, quit the app when all windows are closed
  // User can use tray icon to show/hide instead
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Update window creation to handle "Run at startup" logic if needed (handled by builder)
// ... (previous logic)

app.on('before-quit', () => {
  clearInterval(notificationTimer);
  tray?.destroy();
});

// Helper to check updates
async function checkForUpdates() {
  try {
    const options = {
        hostname: 'api.github.com',
        path: `/repos/${GITHUB_REPO}/releases/latest`,
        headers: { 'User-Agent': 'SoftDo-App' }
    };
    
    return new Promise((resolve) => {
        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const release = JSON.parse(data);
                    const latestVersionTag = release.tag_name; // e.g. "v1.2.4"
                    
                    // Normalize versions
                    const currentNorm = CURRENT_VERSION.replace(/^v/, '');
                    const latestNorm = latestVersionTag ? latestVersionTag.replace(/^v/, '') : '';

                    if (latestNorm && latestNorm !== currentNorm) {
                        resolve({ 
                            hasUpdate: true, 
                            latestVersion: latestVersionTag, 
                            releaseUrl: release.html_url,
                            releaseNotes: release.body 
                        });
                    } else {
                        resolve({ hasUpdate: false });
                    }
                } catch (e) {
                    resolve({ hasUpdate: false, error: e.message });
                }
            });
        }).on('error', (e) => resolve({ hasUpdate: false, error: e.message }));
    });
  } catch (error) {
    return { hasUpdate: false, error: error.message };
  }
}
